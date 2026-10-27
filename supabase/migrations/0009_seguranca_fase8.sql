-- =============================================================================
-- SABERPONTUAL — CORREÇÕES DA REVISÃO DE SEGURANÇA (Fase 8.1)
--
-- Roda DEPOIS da 0008. Não apaga dados. Relatório: docs/claude/auditoria-09-seguranca-fase-8-1.md
--
-- O que faz:
--   * M1: a equipe não apaga mais linhas de verdade (DELETE) nas tabelas com exclusão lógica.
--     Apagar um assunto levava junto, em cascata, as questões do banco de outros professores;
--     apagar turma/disciplina/oferta levava atividades e respostas. O app sempre usou deleted_at.
--     Continuam com DELETE (o app usa): questoes, alternativas, banco_questoes, banco_alternativas.
--   * M2: professor não transforma recado da turma em aviso da escola toda pelo UPDATE.
--   * M3: a direção não altera a própria cota de IA (só a service role).
--   * A1: o código da turma é comparado sem hífen/espaço (o código novo tem 8 caracteres
--     aleatórios em dois blocos e o aluno pode digitar sem o hífen).
--   * A2: bloqueio de PIN mais forte:
--       - por aluno: 5 erros em 15 min bloqueiam 15 min (como antes); 10 erros em 24 h travam o
--         acesso até a equipe criar um PIN novo (definir_pin_aluno destrava);
--       - por turma: erros demais na turma em 1 hora (o maior entre 20 e o nº de alunos ativos)
--         pausam o login da turma inteira por 15 min (para a tentativa em massa de PINs);
--       - alunos_pin_bloqueado(): a equipe vê quem está bloqueado (gestão: escola; professor: suas turmas).
--   * B4: aluno_login e definir_pin_aluno passam a procurar só no schema do pgcrypto (e pg_temp
--     por último), nunca no public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. (M1) Sem DELETE físico para a equipe nas tabelas com exclusão lógica
-- -----------------------------------------------------------------------------
REVOKE DELETE ON
  public.periodos, public.disciplinas, public.turmas, public.ofertas, public.alunos,
  public.assuntos, public.atividades, public.avisos, public.aluno_observacoes
FROM authenticated;

-- -----------------------------------------------------------------------------
-- 2. (M2) UPDATE de aviso repete a regra do INSERT
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS avisos_update ON public.avisos;
CREATE POLICY avisos_update ON public.avisos FOR UPDATE TO authenticated
  USING (escola_id = private.escola_atual() AND (autor_id = auth.uid() OR private.eh_gestao()))
  WITH CHECK (
    escola_id = private.escola_atual() AND (autor_id = auth.uid() OR private.eh_gestao())
    AND ((turma_id IS NULL AND private.eh_gestao())
         OR (turma_id IS NOT NULL AND private.turma_visivel(turma_id))));

-- -----------------------------------------------------------------------------
-- 3. (M3) Escola: a equipe só altera as colunas de cadastro; a cota fica com a service role
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON public.escolas FROM authenticated;
GRANT UPDATE (nome, cidade_uf, ano_letivo_atual, limite_otimo, limite_bom)
  ON public.escolas TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. (A2) Estruturas do bloqueio
-- -----------------------------------------------------------------------------
ALTER TABLE public.pin_tentativas
  ADD COLUMN IF NOT EXISTS erros_dia int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erros_dia_desde timestamptz,
  ADD COLUMN IF NOT EXISTS travado_em timestamptz;

-- Erros de PIN da turma na janela de 1 hora. Sem política: só as funções SECURITY DEFINER.
CREATE TABLE IF NOT EXISTS public.turma_login_erros (
  turma_id uuid PRIMARY KEY REFERENCES public.turmas(id) ON DELETE CASCADE,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  erros int NOT NULL DEFAULT 0,
  pausada_ate timestamptz
);
ALTER TABLE public.turma_login_erros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.turma_login_erros FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. (A1) Lista da turma: código comparado sem hífen/espaço
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aluno_listar_turma(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_codigo text := regexp_replace(upper(coalesce(p_codigo, '')), '[^A-Z0-9]', '', 'g');
  v_turma text;
  v_qtd int;
BEGIN
  SELECT min(t.id::text), count(*) INTO v_turma, v_qtd FROM public.turmas t
  WHERE v_codigo <> ''
    AND regexp_replace(upper(t.codigo_acesso), '[^A-Z0-9]', '', 'g') = v_codigo
    AND t.ativa AND t.deleted_at IS NULL;
  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Turma com código "%" não encontrada.', left(upper(btrim(coalesce(p_codigo, ''))), 30);
  END IF;
  IF v_qtd > 1 THEN
    RAISE EXCEPTION 'Este código vale para mais de uma turma. Procure a secretaria da escola.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'nome_completo', a.nome_completo, 'numero_chamada', a.numero_chamada
    ) ORDER BY a.numero_chamada)
    FROM public.alunos a WHERE a.turma_id = v_turma::uuid AND a.ativo AND a.deleted_at IS NULL
  ), '[]'::jsonb);
END $$;

-- -----------------------------------------------------------------------------
-- 6. (A2) Login do aluno com bloqueio por aluno, travamento diário e pausa da turma
--    Continua sem lançar erro por PIN errado (o erro desfaria os contadores).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aluno_login(p_aluno_id uuid, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_aluno public.alunos%ROWTYPE;
  v_tent public.pin_tentativas%ROWTYPE;
  v_pausada_ate timestamptz;
  v_hash text;
  v_token text;
  v_tentativas int;
  v_erros_dia int;
  v_desde timestamptz;
  v_erros_turma int;
  v_limite_turma int;
  c_max_erros constant int := 5;
  c_max_erros_dia constant int := 10;
  c_msg_bloqueio constant text := 'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.';
  c_msg_travado constant text :=
    'Seu acesso foi bloqueado por muitas tentativas erradas. Peça à secretaria ou à coordenação um PIN novo.';
  c_msg_pausa constant text :=
    'Muitas tentativas erradas de PIN nesta turma. Aguarde 15 minutos ou chame a professora.';
BEGIN
  SELECT a.* INTO v_aluno FROM public.alunos a
  WHERE a.id = p_aluno_id AND a.ativo AND a.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aluno não encontrado.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.turmas t WHERE t.id = v_aluno.turma_id AND t.ativa AND t.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sua turma está inativa. Procure a secretaria da escola.';
  END IF;

  -- Turma pausada: nem confere o PIN (senão a pausa não impediria a tentativa em massa).
  SELECT e.pausada_ate INTO v_pausada_ate FROM public.turma_login_erros e WHERE e.turma_id = v_aluno.turma_id;
  IF v_pausada_ate IS NOT NULL AND v_pausada_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'pausado', true, 'mensagem', c_msg_pausa);
  END IF;

  INSERT INTO public.pin_tentativas (aluno_id) VALUES (p_aluno_id) ON CONFLICT (aluno_id) DO NOTHING;
  SELECT * INTO v_tent FROM public.pin_tentativas WHERE aluno_id = p_aluno_id FOR UPDATE;

  IF v_tent.travado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'bloqueado', true, 'travado', true, 'mensagem', c_msg_travado);
  END IF;
  IF v_tent.bloqueado_ate IS NOT NULL AND v_tent.bloqueado_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'bloqueado', true, 'mensagem', c_msg_bloqueio);
  END IF;

  -- Bloqueio já vencido ou último erro fora da janela de 15 minutos: recomeça a contagem curta.
  v_tentativas := v_tent.tentativas;
  IF v_tent.bloqueado_ate IS NOT NULL OR v_tent.updated_at < now() - interval '15 minutes' THEN
    v_tentativas := 0;
  END IF;
  -- Contagem diária: janela de 24 h a partir do primeiro erro.
  v_erros_dia := v_tent.erros_dia;
  v_desde := v_tent.erros_dia_desde;
  IF v_desde IS NULL OR v_desde < now() - interval '24 hours' THEN
    v_erros_dia := 0;
    v_desde := NULL;
  END IF;

  SELECT c.pin_hash INTO v_hash FROM public.aluno_credenciais c WHERE c.aluno_id = p_aluno_id;
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'sem_pin', true,
      'mensagem', 'PIN ainda não cadastrado. Procure a sua professora.');
  END IF;

  IF p_pin IS NOT NULL AND p_pin ~ '^[0-9]{4}$' AND v_hash = crypt(p_pin, v_hash) THEN
    UPDATE public.pin_tentativas
      SET tentativas = 0, bloqueado_ate = NULL, erros_dia = 0, erros_dia_desde = NULL
      WHERE aluno_id = p_aluno_id;
    DELETE FROM public.aluno_sessoes
      WHERE aluno_id = p_aluno_id AND coalesce(revogada_em, expira_em) < now() - interval '7 days';
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    INSERT INTO public.aluno_sessoes (aluno_id, token_hash, expira_em)
    VALUES (p_aluno_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now() + interval '30 days');
    RETURN jsonb_build_object('ok', true, 'token', v_token, 'aluno', jsonb_build_object(
      'id', v_aluno.id, 'nome_completo', v_aluno.nome_completo, 'numero_chamada', v_aluno.numero_chamada));
  END IF;

  -- PIN errado: conta no aluno e na turma.
  v_tentativas := v_tentativas + 1;
  v_erros_dia := v_erros_dia + 1;
  v_desde := coalesce(v_desde, now());

  INSERT INTO public.turma_login_erros AS e (turma_id, janela_inicio, erros)
  VALUES (v_aluno.turma_id, now(), 1)
  ON CONFLICT (turma_id) DO UPDATE SET
    erros = CASE WHEN e.janela_inicio < now() - interval '1 hour' THEN 1 ELSE e.erros + 1 END,
    janela_inicio = CASE WHEN e.janela_inicio < now() - interval '1 hour' THEN now() ELSE e.janela_inicio END
  RETURNING e.erros INTO v_erros_turma;
  SELECT greatest(20, count(*)) INTO v_limite_turma FROM public.alunos a
    WHERE a.turma_id = v_aluno.turma_id AND a.ativo AND a.deleted_at IS NULL;
  IF v_erros_turma >= v_limite_turma THEN
    UPDATE public.turma_login_erros
      SET pausada_ate = now() + interval '15 minutes', erros = 0, janela_inicio = now()
      WHERE turma_id = v_aluno.turma_id;
  END IF;

  IF v_erros_dia >= c_max_erros_dia THEN
    UPDATE public.pin_tentativas
      SET tentativas = v_tentativas, bloqueado_ate = NULL, erros_dia = v_erros_dia,
          erros_dia_desde = v_desde, travado_em = now()
      WHERE aluno_id = p_aluno_id;
    RETURN jsonb_build_object('ok', false, 'bloqueado', true, 'travado', true, 'mensagem', c_msg_travado);
  END IF;
  IF v_tentativas >= c_max_erros THEN
    UPDATE public.pin_tentativas
      SET tentativas = v_tentativas, bloqueado_ate = now() + interval '15 minutes',
          erros_dia = v_erros_dia, erros_dia_desde = v_desde
      WHERE aluno_id = p_aluno_id;
    RETURN jsonb_build_object('ok', false, 'bloqueado', true, 'mensagem', c_msg_bloqueio);
  END IF;
  UPDATE public.pin_tentativas
    SET tentativas = v_tentativas, bloqueado_ate = NULL, erros_dia = v_erros_dia, erros_dia_desde = v_desde
    WHERE aluno_id = p_aluno_id;
  RETURN jsonb_build_object('ok', false,
    'tentativas_restantes', least(c_max_erros - v_tentativas, c_max_erros_dia - v_erros_dia),
    'mensagem', format('PIN incorreto. Você tem mais %s tentativa(s).',
      least(c_max_erros - v_tentativas, c_max_erros_dia - v_erros_dia)));
END $$;

-- -----------------------------------------------------------------------------
-- 7. PIN novo pela equipe: também destrava o travamento diário
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_pin_aluno(p_aluno_id uuid, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_aluno public.alunos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'O PIN deve conter exatamente 4 dígitos numéricos.';
  END IF;
  SELECT * INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_aluno.escola_id IS DISTINCT FROM private.escola_atual()
     OR NOT (private.eh_gestao() OR private.professor_da_turma(v_aluno.turma_id)) THEN
    RAISE EXCEPTION 'Aluno não encontrado ou sem permissão.';
  END IF;

  INSERT INTO public.aluno_credenciais (aluno_id, pin_hash)
  VALUES (p_aluno_id, crypt(p_pin, gen_salt('bf', 10)))
  ON CONFLICT (aluno_id) DO UPDATE SET pin_hash = excluded.pin_hash;
  -- PIN novo: zera bloqueios e encerra as sessões antigas.
  INSERT INTO public.pin_tentativas (aluno_id) VALUES (p_aluno_id)
  ON CONFLICT (aluno_id) DO UPDATE
    SET tentativas = 0, bloqueado_ate = NULL, erros_dia = 0, erros_dia_desde = NULL, travado_em = NULL;
  UPDATE public.aluno_sessoes SET revogada_em = now() WHERE aluno_id = p_aluno_id AND revogada_em IS NULL;
END $$;

-- (B4) As duas funções acima procuram só no schema do pgcrypto (public ou extensions, conforme o
-- projeto) e pg_temp por último. Os demais nomes do corpo já são qualificados (public., private., auth.).
DO $$
DECLARE v_schema text;
BEGIN
  SELECT n.nspname INTO v_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pgcrypto';
  IF v_schema IS NULL THEN RAISE EXCEPTION 'pgcrypto não está instalado.'; END IF;
  EXECUTE format('ALTER FUNCTION public.aluno_login(uuid, text) SET search_path = %I, pg_temp', v_schema);
  EXECUTE format('ALTER FUNCTION public.definir_pin_aluno(uuid, text) SET search_path = %I, pg_temp', v_schema);
END $$;

-- -----------------------------------------------------------------------------
-- 8. (A2) Quem está com o PIN bloqueado (aviso para a equipe)
--    motivo 'equipe' = travado até a equipe criar um PIN novo; 'temporario' = 15 minutos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alunos_pin_bloqueado()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escola uuid := private.escola_atual();
  v_gestao boolean := private.eh_gestao();
BEGIN
  IF v_escola IS NULL THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'aluno_id', a.id, 'nome_completo', a.nome_completo, 'numero_chamada', a.numero_chamada,
      'turma_id', t.id, 'turma_nome', t.nome,
      'motivo', CASE WHEN pt.travado_em IS NOT NULL THEN 'equipe' ELSE 'temporario' END,
      'bloqueado_ate', CASE WHEN pt.travado_em IS NULL THEN pt.bloqueado_ate END
    ) ORDER BY t.nome, a.numero_chamada)
    FROM public.pin_tentativas pt
    JOIN public.alunos a ON a.id = pt.aluno_id AND a.ativo AND a.deleted_at IS NULL
    JOIN public.turmas t ON t.id = a.turma_id AND t.deleted_at IS NULL
    WHERE t.escola_id = v_escola
      AND (pt.travado_em IS NOT NULL OR pt.bloqueado_ate > now())
      AND (v_gestao OR private.professor_da_turma(t.id))
  ), '[]'::jsonb);
END $$;

-- -----------------------------------------------------------------------------
-- 9. Privilégios (CREATE OR REPLACE mantém os antigos; reafirmados aqui)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.aluno_listar_turma(text), public.aluno_login(uuid, text),
  public.definir_pin_aluno(uuid, text), public.alunos_pin_bloqueado()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_listar_turma(text), public.aluno_login(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.definir_pin_aluno(uuid, text), public.alunos_pin_bloqueado() TO authenticated;
