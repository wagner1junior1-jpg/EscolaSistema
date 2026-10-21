-- =============================================================================
-- SABERPONTUAL — PORTAL DO ALUNO SEGURO (Fase 4 do plano do back end)
--
-- Roda DEPOIS da 0003 e da 0004. Não apaga dados.
--
-- O aluno NÃO usa Supabase Auth: ele acessa só por funções RPC SECURITY DEFINER que recebem
-- um token de sessão (docs/ESPECIFICACAO.md, seção 5). Nenhuma tabela é aberta ao aluno.
--
--   * PIN em bcrypt (pgcrypto) e bloqueio por tentativas no servidor (5 erros em 15 min
--     bloqueiam por 15 min). aluno_login NUNCA lança erro por PIN errado: um erro desfaria a
--     transação e o contador de tentativas. Ele devolve { ok: false, mensagem, ... }.
--   * Sessão: token aleatório (só o hash SHA-256 fica no banco), validade de 30 dias,
--     revogação (aluno_sair, troca de PIN). Aluno/turma inativos perdem o acesso na hora.
--   * Gabarito protegido (regra 6): aluno_carregar_atividade nunca devolve `correta`,
--     `por_que_errou`, `explicacao` nem alternativa correta de questão ainda não respondida
--     (exceto atividade ENCERRADA, igual ao mock). Na prova, o feedback só sai depois de
--     responder TODAS as questões.
--   * Mesmas regras de cálculo do app (services/calculos.ts): pontuação da discursiva,
--     pendente fora da média, aproveitamento inteiro, prazo vencido pela data de São Paulo.
--   * definir_pin_aluno: a equipe (gestão ou professor da turma) define/redefine o PIN; o hash
--     bcrypt nunca volta ao cliente.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Auxiliares internos (schema private: fora da API)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.hoje_br()
RETURNS date LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;

-- Pontuação de uma resposta (espelha pontuacaoDaResposta): objetiva 1/0; discursiva
-- certo=1, parcial=0.5, errado=0 ou a nota numérica (0..1 ou 0..100); pendente = NULL.
CREATE OR REPLACE FUNCTION private.pontos_resposta(
  p_tipo text, p_acertou boolean, p_correcao text, p_pontuacao numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_tipo = 'discursiva' THEN
      CASE
        WHEN p_correcao IS NULL OR p_correcao = 'pendente' THEN NULL
        WHEN p_pontuacao IS NOT NULL THEN
          least(1, greatest(0, CASE WHEN p_pontuacao > 1 THEN p_pontuacao / 100 ELSE p_pontuacao END))
        WHEN p_correcao = 'certo' THEN 1
        WHEN p_correcao = 'parcial' THEN 0.5
        WHEN p_correcao = 'errado' THEN 0
        ELSE NULL
      END
    ELSE CASE WHEN coalesce(p_acertou, false) THEN 1 ELSE 0 END
  END
$$;

-- Aluno dono da sessão. Lança erro se o token for inválido, expirado, revogado ou se o aluno/turma
-- estiverem inativos.
CREATE OR REPLACE FUNCTION private.aluno_da_sessao(p_token text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_token IS NOT NULL AND length(p_token) BETWEEN 20 AND 200 THEN
    SELECT s.aluno_id INTO v_id
    FROM public.aluno_sessoes s
    JOIN public.alunos a ON a.id = s.aluno_id AND a.ativo AND a.deleted_at IS NULL
    JOIN public.turmas t ON t.id = a.turma_id AND t.ativa AND t.deleted_at IS NULL
    WHERE s.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      AND s.revogada_em IS NULL
      AND s.expira_em > now();
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada ou inválida. Por favor, acesse novamente.';
  END IF;
  RETURN v_id;
END $$;

-- Placar do aluno numa atividade: total de questões, respondidas, se há discursiva pendente e
-- a soma dos pontos (questão sem resposta ou pendente soma 0).
CREATE OR REPLACE FUNCTION private.placar_atividade(p_aluno uuid, p_atividade uuid)
RETURNS TABLE (total int, respondidas int, pendente boolean, pontos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    count(*)::int,
    count(r.id)::int,
    coalesce(bool_or(
      q.tipo = 'discursiva' AND r.id IS NOT NULL
      AND private.pontos_resposta(q.tipo, r.acertou, r.correcao, r.pontuacao) IS NULL
    ), false),
    coalesce(sum(CASE WHEN r.id IS NULL THEN 0
      ELSE coalesce(private.pontos_resposta(q.tipo, r.acertou, r.correcao, r.pontuacao), 0) END), 0)
  FROM public.questoes q
  LEFT JOIN public.respostas r ON r.questao_id = q.id AND r.aluno_id = p_aluno
  WHERE q.atividade_id = p_atividade AND q.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION private.hoje_br(), private.pontos_resposta(text, boolean, text, numeric),
  private.aluno_da_sessao(text), private.placar_atividade(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Entrada do aluno: turma, nomes e login
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aluno_listar_turma(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_turma uuid; v_codigo text := upper(btrim(coalesce(p_codigo, '')));
BEGIN
  SELECT t.id INTO v_turma FROM public.turmas t
  WHERE upper(t.codigo_acesso) = v_codigo AND t.ativa AND t.deleted_at IS NULL;
  IF v_turma IS NULL THEN
    RAISE EXCEPTION 'Turma com código "%" não encontrada.', left(v_codigo, 30);
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'nome_completo', a.nome_completo, 'numero_chamada', a.numero_chamada
    ) ORDER BY a.numero_chamada)
    FROM public.alunos a WHERE a.turma_id = v_turma AND a.ativo AND a.deleted_at IS NULL
  ), '[]'::jsonb);
END $$;

-- Login do aluno. Devolve { ok: true, token, aluno } ou { ok: false, mensagem, ... }.
-- O token puro só aparece aqui, uma única vez; no banco fica apenas o hash.
-- pgcrypto pode estar no schema public ou extensions, por isso o search_path inclui os dois.
CREATE OR REPLACE FUNCTION public.aluno_login(p_aluno_id uuid, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_aluno public.alunos%ROWTYPE;
  v_tent public.pin_tentativas%ROWTYPE;
  v_hash text;
  v_token text;
  v_tentativas int;
  c_max_erros constant int := 5;
BEGIN
  SELECT a.* INTO v_aluno FROM public.alunos a
  WHERE a.id = p_aluno_id AND a.ativo AND a.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aluno não encontrado.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.turmas t WHERE t.id = v_aluno.turma_id AND t.ativa AND t.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sua turma está inativa. Procure a secretaria da escola.';
  END IF;

  INSERT INTO public.pin_tentativas (aluno_id) VALUES (p_aluno_id) ON CONFLICT (aluno_id) DO NOTHING;
  SELECT * INTO v_tent FROM public.pin_tentativas WHERE aluno_id = p_aluno_id FOR UPDATE;

  IF v_tent.bloqueado_ate IS NOT NULL AND v_tent.bloqueado_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'bloqueado', true,
      'mensagem', 'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.');
  END IF;

  -- Bloqueio já vencido ou último erro fora da janela de 15 minutos: recomeça a contagem.
  v_tentativas := v_tent.tentativas;
  IF v_tent.bloqueado_ate IS NOT NULL OR v_tent.updated_at < now() - interval '15 minutes' THEN
    v_tentativas := 0;
  END IF;

  SELECT c.pin_hash INTO v_hash FROM public.aluno_credenciais c WHERE c.aluno_id = p_aluno_id;
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'sem_pin', true,
      'mensagem', 'PIN ainda não cadastrado. Procure a sua professora.');
  END IF;

  IF p_pin IS NOT NULL AND p_pin ~ '^[0-9]{4}$' AND v_hash = crypt(p_pin, v_hash) THEN
    UPDATE public.pin_tentativas SET tentativas = 0, bloqueado_ate = NULL WHERE aluno_id = p_aluno_id;
    DELETE FROM public.aluno_sessoes
      WHERE aluno_id = p_aluno_id AND coalesce(revogada_em, expira_em) < now() - interval '7 days';
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    INSERT INTO public.aluno_sessoes (aluno_id, token_hash, expira_em)
    VALUES (p_aluno_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now() + interval '30 days');
    RETURN jsonb_build_object('ok', true, 'token', v_token, 'aluno', jsonb_build_object(
      'id', v_aluno.id, 'nome_completo', v_aluno.nome_completo, 'numero_chamada', v_aluno.numero_chamada));
  END IF;

  v_tentativas := v_tentativas + 1;
  IF v_tentativas >= c_max_erros THEN
    UPDATE public.pin_tentativas
      SET tentativas = v_tentativas, bloqueado_ate = now() + interval '15 minutes'
      WHERE aluno_id = p_aluno_id;
    RETURN jsonb_build_object('ok', false, 'bloqueado', true,
      'mensagem', 'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.');
  END IF;
  UPDATE public.pin_tentativas SET tentativas = v_tentativas, bloqueado_ate = NULL
    WHERE aluno_id = p_aluno_id;
  RETURN jsonb_build_object('ok', false, 'tentativas_restantes', c_max_erros - v_tentativas,
    'mensagem', format('PIN incorreto. Você tem mais %s tentativa(s).', c_max_erros - v_tentativas));
END $$;

CREATE OR REPLACE FUNCTION public.aluno_sair(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) NOT BETWEEN 20 AND 200 THEN RETURN; END IF;
  UPDATE public.aluno_sessoes SET revogada_em = now()
  WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') AND revogada_em IS NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Painel e atividade
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aluno_atividades(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno uuid := private.aluno_da_sessao(p_token);
  v_turma uuid;
  v_hoje date := private.hoje_br();
BEGIN
  SELECT turma_id INTO v_turma FROM public.alunos WHERE id = v_aluno;
  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', x.id, 'titulo', x.titulo, 'descricao', x.descricao, 'prazo', x.prazo,
        'prazo_vencido', x.prazo IS NOT NULL AND x.prazo < v_hoje,
        'modo', x.modo, 'status', x.status,
        'disciplina_id', coalesce(x.disciplina_id::text, ''),
        'disciplina_nome', coalesce(x.disciplina_nome, 'Disciplina'),
        'total_questoes', x.total, 'questoes_respondidas', x.respondidas,
        'concluida', x.total > 0 AND x.respondidas = x.total,
        'aguardando_correcao', x.pendente
      ) || CASE
        WHEN x.pendente THEN '{}'::jsonb
        WHEN (x.total > 0 AND x.respondidas = x.total) OR x.status = 'encerrada' THEN
          jsonb_build_object('aproveitamento',
            CASE WHEN x.total > 0 THEN round(x.pontos / x.total * 100) ELSE 0 END)
        ELSE '{}'::jsonb
      END
      ORDER BY x.prazo NULLS LAST, x.titulo
    )
    FROM (
      SELECT a.id, a.titulo, a.descricao, a.prazo, a.modo, a.status,
             d.id AS disciplina_id, d.nome AS disciplina_nome, p.*
      FROM public.atividades a
      JOIN public.ofertas o ON o.id = a.oferta_id AND o.turma_id = v_turma AND o.deleted_at IS NULL
      LEFT JOIN public.disciplinas d ON d.id = o.disciplina_id
      CROSS JOIN LATERAL private.placar_atividade(v_aluno, a.id) p
      WHERE a.status <> 'rascunho' AND a.deleted_at IS NULL
    ) x
  ), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.aluno_carregar_atividade(p_token text, p_atividade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno uuid := private.aluno_da_sessao(p_token);
  v_turma uuid;
  v_at public.atividades%ROWTYPE;
  v_of public.ofertas%ROWTYPE;
  v_q public.questoes%ROWTYPE;
  v_r public.respostas%ROWTYPE;
  v_placar record;
  v_disc text;
  v_prof text;
  v_alts jsonb;
  v_correta uuid;
  v_esc public.alternativas%ROWTYPE;
  v_item jsonb;
  v_questoes jsonb := '[]'::jsonb;
  v_completa boolean;
  v_corrigida boolean;
BEGIN
  SELECT turma_id INTO v_turma FROM public.alunos WHERE id = v_aluno;

  SELECT * INTO v_at FROM public.atividades WHERE id = p_atividade_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  SELECT * INTO v_of FROM public.ofertas WHERE id = v_at.oferta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta não encontrada.'; END IF;
  IF v_of.turma_id <> v_turma THEN RAISE EXCEPTION 'Esta atividade não pertence à sua turma.'; END IF;
  IF v_at.status NOT IN ('publicada', 'encerrada') THEN RAISE EXCEPTION 'Atividade indisponível.'; END IF;

  SELECT d.nome INTO v_disc FROM public.disciplinas d WHERE d.id = v_of.disciplina_id;
  SELECT p.nome INTO v_prof FROM public.perfis p WHERE p.id = v_of.professor_id;

  SELECT * INTO v_placar FROM private.placar_atividade(v_aluno, v_at.id);
  v_completa := v_placar.total > 0 AND v_placar.respondidas = v_placar.total;

  FOR v_q IN
    SELECT * FROM public.questoes WHERE atividade_id = v_at.id AND deleted_at IS NULL ORDER BY ordem
  LOOP
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'letra', x.letra, 'texto', x.texto)
             ORDER BY x.letra), '[]'::jsonb)
      INTO v_alts FROM public.alternativas x WHERE x.questao_id = v_q.id;
    SELECT x.id INTO v_correta FROM public.alternativas x
      WHERE x.questao_id = v_q.id AND x.correta ORDER BY x.letra LIMIT 1;

    -- Campos sempre seguros (nunca revelam gabarito).
    v_item := jsonb_build_object(
      'id', v_q.id, 'ordem', v_q.ordem, 'enunciado', v_q.enunciado, 'dica', v_q.dica,
      'alternativas', v_alts, 'tipo', v_q.tipo, 'imagem_url', v_q.imagem_url);

    SELECT * INTO v_r FROM public.respostas WHERE aluno_id = v_aluno AND questao_id = v_q.id;
    IF FOUND THEN
      v_corrigida := v_r.correcao IS NOT NULL AND v_r.correcao <> 'pendente';
      v_item := v_item || jsonb_build_object('respondida', true);
      IF v_r.alternativa_id IS NOT NULL THEN
        v_item := v_item || jsonb_build_object('alternativa_respondida_id', v_r.alternativa_id);
      END IF;
      IF v_r.texto_resposta IS NOT NULL THEN
        v_item := v_item || jsonb_build_object('texto_respondido', v_r.texto_resposta);
      END IF;
      IF v_r.correcao IS NOT NULL THEN
        v_item := v_item || jsonb_build_object('correcao', v_r.correcao);
      END IF;
      IF v_r.comentario_professor IS NOT NULL THEN
        v_item := v_item || jsonb_build_object('comentario_professor', v_r.comentario_professor);
      END IF;
      IF v_corrigida AND coalesce(v_q.resposta_esperada, '') <> '' THEN
        v_item := v_item || jsonb_build_object('resposta_esperada', v_q.resposta_esperada);
      END IF;

      -- Prova publicada e incompleta: nenhum feedback pedagógico (impede repassar o gabarito).
      IF NOT (v_at.modo = 'prova' AND v_at.status = 'publicada' AND NOT v_completa) THEN
        SELECT * INTO v_esc FROM public.alternativas WHERE id = v_r.alternativa_id;
        v_item := v_item || jsonb_build_object(
          'pontuacao', v_r.pontuacao,
          'nota', CASE WHEN v_r.pontuacao IS NULL THEN NULL
                  ELSE round(CASE WHEN v_r.pontuacao <= 1 THEN v_r.pontuacao * 100 ELSE v_r.pontuacao END) END,
          'por_que_errou', CASE WHEN coalesce(v_r.acertou, false) THEN NULL ELSE v_esc.por_que_errou END,
          'explicacao', v_q.explicacao,
          'tentativas', coalesce(v_r.tentativas, 1));
        IF v_r.acertou IS NOT NULL THEN
          v_item := v_item || jsonb_build_object('acertou', v_r.acertou);
        END IF;
        IF v_correta IS NOT NULL THEN
          v_item := v_item || jsonb_build_object('alternativa_correta_id', v_correta);
        END IF;
        IF coalesce(v_r.acertou_final, v_r.acertou) IS NOT NULL THEN
          v_item := v_item || jsonb_build_object('acertou_final', coalesce(v_r.acertou_final, v_r.acertou));
        END IF;
      END IF;
    ELSE
      v_item := v_item || jsonb_build_object('respondida', false);
      -- Questão não respondida: gabarito só em atividade ENCERRADA.
      IF v_at.status = 'encerrada' THEN
        v_item := v_item || jsonb_build_object(
          'acertou', false, 'explicacao', v_q.explicacao, 'tentativas', 0, 'acertou_final', false);
        IF v_correta IS NOT NULL THEN
          v_item := v_item || jsonb_build_object('alternativa_correta_id', v_correta);
        END IF;
      END IF;
    END IF;

    v_questoes := v_questoes || jsonb_build_array(v_item);
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_at.id, 'titulo', v_at.titulo, 'descricao', v_at.descricao, 'prazo', v_at.prazo,
    'modo', v_at.modo, 'status', v_at.status,
    'disciplina_nome', coalesce(v_disc, 'Disciplina'), 'professor_nome', coalesce(v_prof, 'Professor'),
    'questoes', v_questoes);
END $$;

-- -----------------------------------------------------------------------------
-- 4. Responder
-- -----------------------------------------------------------------------------
-- Valida a questão para o aluno e devolve a atividade. Usado pelas três RPCs de resposta.
CREATE OR REPLACE FUNCTION private.atividade_para_responder(p_aluno uuid, p_questao uuid, p_exigir_aberta boolean)
RETURNS public.atividades LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_q public.questoes%ROWTYPE;
  v_at public.atividades%ROWTYPE;
  v_turma uuid;
  v_placar record;
BEGIN
  SELECT * INTO v_q FROM public.questoes WHERE id = p_questao AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questão não encontrada.'; END IF;
  SELECT * INTO v_at FROM public.atividades WHERE id = v_q.atividade_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  SELECT a.turma_id INTO v_turma FROM public.alunos a WHERE a.id = p_aluno;
  IF NOT EXISTS (
    SELECT 1 FROM public.ofertas o WHERE o.id = v_at.oferta_id AND o.turma_id = v_turma AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta questão não pertence a uma atividade da sua turma.';
  END IF;
  IF v_at.status = 'encerrada' THEN
    RAISE EXCEPTION 'Esta atividade já foi encerrada e não aceita mais respostas.';
  END IF;
  IF v_at.status <> 'publicada' THEN
    RAISE EXCEPTION 'Atividade indisponível para resposta.';
  END IF;
  IF p_exigir_aberta THEN
    SELECT * INTO v_placar FROM private.placar_atividade(p_aluno, v_at.id);
    IF v_at.prazo IS NOT NULL AND v_at.prazo < private.hoje_br()
       AND NOT (v_placar.total > 0 AND v_placar.respondidas = v_placar.total) THEN
      RAISE EXCEPTION 'O prazo desta atividade terminou.';
    END IF;
  END IF;
  RETURN v_at;
END $$;

REVOKE ALL ON FUNCTION private.atividade_para_responder(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.aluno_responder(p_token text, p_questao_id uuid, p_alternativa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno uuid := private.aluno_da_sessao(p_token);
  v_q public.questoes%ROWTYPE;
  v_at public.atividades%ROWTYPE;
  v_esc public.alternativas%ROWTYPE;
  v_correta public.alternativas%ROWTYPE;
BEGIN
  SELECT * INTO v_q FROM public.questoes WHERE id = p_questao_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questão não encontrada.'; END IF;
  IF v_q.tipo = 'discursiva' THEN
    RAISE EXCEPTION 'Esta questão é discursiva e não aceita alternativas.';
  END IF;
  v_at := private.atividade_para_responder(v_aluno, p_questao_id, true);

  IF EXISTS (SELECT 1 FROM public.respostas WHERE aluno_id = v_aluno AND questao_id = p_questao_id) THEN
    RAISE EXCEPTION 'Esta questão já foi respondida e não pode ser alterada.';
  END IF;

  SELECT * INTO v_esc FROM public.alternativas WHERE id = p_alternativa_id AND questao_id = p_questao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alternativa selecionada inválida.'; END IF;
  SELECT * INTO v_correta FROM public.alternativas WHERE questao_id = p_questao_id AND correta
    ORDER BY letra LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inconsistência pedagógica: questão sem alternativa correta.'; END IF;

  INSERT INTO public.respostas (aluno_id, questao_id, alternativa_id, acertou, tentativas, acertou_final)
  VALUES (v_aluno, p_questao_id, p_alternativa_id, v_esc.correta, 1, v_esc.correta)
  ON CONFLICT (aluno_id, questao_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta questão já foi respondida e não pode ser alterada.';
  END IF;

  IF v_at.modo = 'prova' THEN
    RETURN jsonb_build_object('modo', 'prova', 'registrada', true);
  END IF;
  RETURN jsonb_build_object(
    'modo', 'exercicio', 'acertou', v_esc.correta, 'alternativa_correta_id', v_correta.id,
    'por_que_errou', CASE WHEN v_esc.correta THEN NULL ELSE v_esc.por_que_errou END,
    'explicacao', v_q.explicacao);
END $$;

CREATE OR REPLACE FUNCTION public.aluno_responder_discursiva(p_token text, p_questao_id uuid, p_texto text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno uuid := private.aluno_da_sessao(p_token);
  v_q public.questoes%ROWTYPE;
  v_at public.atividades%ROWTYPE;
  v_texto text := btrim(coalesce(p_texto, ''));
BEGIN
  SELECT * INTO v_q FROM public.questoes WHERE id = p_questao_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questão não encontrada.'; END IF;
  v_at := private.atividade_para_responder(v_aluno, p_questao_id, true);
  IF v_q.tipo <> 'discursiva' THEN RAISE EXCEPTION 'Esta questão não é discursiva.'; END IF;
  IF v_texto = '' THEN RAISE EXCEPTION 'A resposta não pode ser vazia.'; END IF;
  IF length(v_texto) > 2000 THEN RAISE EXCEPTION 'A resposta deve ter no máximo 2000 caracteres.'; END IF;

  INSERT INTO public.respostas (aluno_id, questao_id, texto_resposta, correcao, tentativas)
  VALUES (v_aluno, p_questao_id, v_texto, 'pendente', 1)
  ON CONFLICT (aluno_id, questao_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questão já respondida.'; END IF;

  IF v_at.modo = 'exercicio' THEN
    RETURN jsonb_build_object('registrada', true, 'explicacao', v_q.explicacao);
  END IF;
  RETURN jsonb_build_object('registrada', true);
END $$;

-- "Tentar novamente" (só exercício): conta a tentativa e atualiza acertou_final; a 1ª resposta
-- (alternativa_id e acertou) nunca muda.
CREATE OR REPLACE FUNCTION public.aluno_tentar_novamente(p_token text, p_questao_id uuid, p_alternativa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno uuid := private.aluno_da_sessao(p_token);
  v_q public.questoes%ROWTYPE;
  v_at public.atividades%ROWTYPE;
  v_r public.respostas%ROWTYPE;
  v_esc public.alternativas%ROWTYPE;
  v_correta public.alternativas%ROWTYPE;
BEGIN
  SELECT * INTO v_q FROM public.questoes WHERE id = p_questao_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questão não encontrada.'; END IF;
  SELECT * INTO v_at FROM public.atividades WHERE id = v_q.atividade_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  IF v_at.modo <> 'exercicio' THEN
    RAISE EXCEPTION '"Tentar novamente" está disponível apenas no modo exercício.';
  END IF;
  -- Valida turma, status publicada e (sem exceção de "concluída") o prazo.
  PERFORM private.atividade_para_responder(v_aluno, p_questao_id, false);
  IF v_at.prazo IS NOT NULL AND v_at.prazo < private.hoje_br() THEN
    RAISE EXCEPTION 'O prazo desta atividade terminou.';
  END IF;
  IF v_q.tipo = 'discursiva' THEN
    RAISE EXCEPTION 'Esta questão é discursiva e não aceita alternativas.';
  END IF;

  SELECT * INTO v_r FROM public.respostas WHERE aluno_id = v_aluno AND questao_id = p_questao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta questão ainda não foi respondida.'; END IF;
  IF coalesce(v_r.acertou, false) OR coalesce(v_r.acertou_final, false) THEN
    RAISE EXCEPTION 'Você já acertou esta questão e não precisa tentar novamente.';
  END IF;

  SELECT * INTO v_esc FROM public.alternativas WHERE id = p_alternativa_id AND questao_id = p_questao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alternativa selecionada inválida.'; END IF;
  SELECT * INTO v_correta FROM public.alternativas WHERE questao_id = p_questao_id AND correta
    ORDER BY letra LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inconsistência pedagógica: questão sem alternativa correta.'; END IF;

  UPDATE public.respostas SET tentativas = tentativas + 1, acertou_final = v_esc.correta WHERE id = v_r.id;

  RETURN jsonb_build_object(
    'modo', 'exercicio', 'acertou', v_esc.correta, 'alternativa_correta_id', v_correta.id,
    'por_que_errou', CASE WHEN v_esc.correta THEN NULL ELSE v_esc.por_que_errou END,
    'explicacao', v_q.explicacao);
END $$;

-- -----------------------------------------------------------------------------
-- 5. Resultado da prova, desempenho e avisos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aluno_resultado_prova(p_token text, p_atividade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno uuid := private.aluno_da_sessao(p_token);
  v_turma uuid;
  v_at public.atividades%ROWTYPE;
  v_q public.questoes%ROWTYPE;
  v_r public.respostas%ROWTYPE;
  v_placar record;
  v_correta uuid;
  v_esc public.alternativas%ROWTYPE;
  v_item jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_pontos numeric;
  v_total_pontos numeric := 0;
  v_pendentes int := 0;
  v_total int;
  v_avaliadas int;
  v_aproveitamento numeric;
  v_corrigida boolean;
BEGIN
  SELECT turma_id INTO v_turma FROM public.alunos WHERE id = v_aluno;
  SELECT * INTO v_at FROM public.atividades WHERE id = p_atividade_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ofertas o WHERE o.id = v_at.oferta_id AND o.turma_id = v_turma AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta atividade não pertence à sua turma.';
  END IF;
  IF v_at.modo <> 'prova' THEN
    RAISE EXCEPTION 'O resultado detalhado de prova só se aplica a atividades no modo prova.';
  END IF;
  IF v_at.status NOT IN ('publicada', 'encerrada') THEN RAISE EXCEPTION 'Atividade indisponível.'; END IF;

  SELECT * INTO v_placar FROM private.placar_atividade(v_aluno, v_at.id);
  v_total := v_placar.total;
  IF v_at.status = 'publicada' AND (v_total = 0 OR v_placar.respondidas < v_total) THEN
    RAISE EXCEPTION 'Termine todas as questões para ver o resultado.';
  END IF;

  FOR v_q IN
    SELECT * FROM public.questoes WHERE atividade_id = v_at.id AND deleted_at IS NULL ORDER BY ordem
  LOOP
    SELECT x.id INTO v_correta FROM public.alternativas x
      WHERE x.questao_id = v_q.id AND x.correta ORDER BY x.letra LIMIT 1;
    SELECT * INTO v_r FROM public.respostas WHERE aluno_id = v_aluno AND questao_id = v_q.id;

    IF NOT FOUND THEN
      v_item := jsonb_build_object(
        'questao_id', v_q.id, 'ordem', v_q.ordem, 'enunciado', v_q.enunciado,
        'alternativa_escolhida_id', NULL, 'alternativa_correta_id', coalesce(v_correta::text, ''),
        'acertou', false, 'por_que_errou', NULL, 'explicacao', v_q.explicacao,
        'tipo', v_q.tipo, 'imagem_url', v_q.imagem_url);
    ELSIF v_q.tipo = 'discursiva' THEN
      v_pontos := private.pontos_resposta(v_q.tipo, v_r.acertou, v_r.correcao, v_r.pontuacao);
      IF v_pontos IS NULL THEN v_pendentes := v_pendentes + 1; ELSE v_total_pontos := v_total_pontos + v_pontos; END IF;
      v_corrigida := v_r.correcao IS NOT NULL AND v_r.correcao <> 'pendente';
      v_item := jsonb_build_object(
        'questao_id', v_q.id, 'ordem', v_q.ordem, 'enunciado', v_q.enunciado,
        'alternativa_escolhida_id', NULL, 'alternativa_correta_id', '',
        'acertou', coalesce(v_r.correcao = 'certo', false), 'por_que_errou', NULL, 'explicacao', v_q.explicacao,
        'tipo', 'discursiva', 'imagem_url', v_q.imagem_url, 'texto_respondido', v_r.texto_resposta,
        'correcao', v_r.correcao, 'pontuacao', v_r.pontuacao,
        'nota', CASE
          WHEN v_r.pontuacao IS NOT NULL THEN round(CASE WHEN v_r.pontuacao <= 1 THEN v_r.pontuacao * 100 ELSE v_r.pontuacao END)
          WHEN v_r.correcao = 'certo' THEN 100
          WHEN v_r.correcao = 'parcial' THEN 50
          WHEN v_r.correcao = 'errado' THEN 0
          ELSE NULL END,
        'comentario_professor', v_r.comentario_professor);
      IF v_corrigida AND coalesce(v_q.resposta_esperada, '') <> '' THEN
        v_item := v_item || jsonb_build_object('resposta_esperada', v_q.resposta_esperada);
      END IF;
    ELSE
      v_total_pontos := v_total_pontos + coalesce(private.pontos_resposta(v_q.tipo, v_r.acertou, v_r.correcao, v_r.pontuacao), 0);
      SELECT * INTO v_esc FROM public.alternativas WHERE id = v_r.alternativa_id;
      v_item := jsonb_build_object(
        'questao_id', v_q.id, 'ordem', v_q.ordem, 'enunciado', v_q.enunciado,
        'alternativa_escolhida_id', v_r.alternativa_id, 'alternativa_correta_id', coalesce(v_correta::text, ''),
        'acertou', coalesce(v_r.acertou, false),
        'por_que_errou', CASE WHEN coalesce(v_r.acertou, false) THEN NULL ELSE v_esc.por_que_errou END,
        'explicacao', v_q.explicacao, 'tipo', 'objetiva', 'imagem_url', v_q.imagem_url);
    END IF;
    v_itens := v_itens || jsonb_build_array(v_item);
  END LOOP;

  v_avaliadas := v_total - v_pendentes;
  v_aproveitamento := CASE
    WHEN v_avaliadas <= 0 THEN 0
    WHEN v_pendentes > 0 THEN round(v_total_pontos / v_avaliadas * 100)
    ELSE round(v_total_pontos / v_total * 100) END;

  RETURN jsonb_build_object(
    'atividade_id', v_at.id, 'titulo', v_at.titulo, 'total_questoes', v_total,
    'acertos', v_total_pontos, 'erros', greatest(0, v_avaliadas - floor(v_total_pontos)),
    'pendentes', v_pendentes, 'aguardando_correcao', v_pendentes,
    'aproveitamento', v_aproveitamento, 'questoes', v_itens);
END $$;

CREATE OR REPLACE FUNCTION public.aluno_meu_desempenho(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno_id uuid := private.aluno_da_sessao(p_token);
  v_aluno public.alunos%ROWTYPE;
  v_turma public.turmas%ROWTYPE;
  v_escola public.escolas%ROWTYPE;
  v_periodo public.periodos%ROWTYPE;
  v_disciplinas jsonb;
BEGIN
  SELECT * INTO v_aluno FROM public.alunos WHERE id = v_aluno_id;
  SELECT * INTO v_turma FROM public.turmas WHERE id = v_aluno.turma_id;
  SELECT * INTO v_escola FROM public.escolas WHERE id = v_turma.escola_id;
  SELECT * INTO v_periodo FROM public.periodos
    WHERE escola_id = v_turma.escola_id AND deleted_at IS NULL
    ORDER BY ativo DESC, data_inicio DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum período letivo cadastrado.'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'oferta_id', y.oferta_id, 'disciplina_nome', y.disciplina_nome, 'professor_nome', y.professor_nome,
      'atividades_concluidas', y.avaliadas, 'media_periodo', y.media,
      'faixa', CASE
        WHEN y.media IS NULL THEN 'Sem atividades'
        WHEN y.media >= v_escola.limite_otimo THEN 'Ótimo'
        WHEN y.media >= v_escola.limite_bom THEN 'Bom'
        ELSE 'Atenção' END
    ) ORDER BY y.disciplina_nome), '[]'::jsonb)
  INTO v_disciplinas
  FROM (
    SELECT o.id AS oferta_id, coalesce(d.nome, 'Disciplina') AS disciplina_nome,
           coalesce(pf.nome, 'Professor') AS professor_nome,
           coalesce(sum(1) FILTER (WHERE pl.elegivel), 0)::int AS avaliadas,
           CASE WHEN coalesce(sum(pl.total) FILTER (WHERE pl.elegivel), 0) > 0
                THEN round(sum(pl.pontos) FILTER (WHERE pl.elegivel)
                           / sum(pl.total) FILTER (WHERE pl.elegivel) * 100, 1) END AS media
    FROM public.ofertas o
    LEFT JOIN public.disciplinas d ON d.id = o.disciplina_id
    LEFT JOIN public.perfis pf ON pf.id = o.professor_id
    LEFT JOIN LATERAL (
      SELECT p.total, p.pontos,
             (p.total > 0 AND NOT p.pendente AND (p.respondidas = p.total OR a.status = 'encerrada')) AS elegivel
      FROM public.atividades a
      CROSS JOIN LATERAL private.placar_atividade(v_aluno_id, a.id) p
      WHERE a.oferta_id = o.id AND a.periodo_id = v_periodo.id
        AND a.status IN ('publicada', 'encerrada') AND a.deleted_at IS NULL
    ) pl ON true
    WHERE o.turma_id = v_turma.id AND o.deleted_at IS NULL
    GROUP BY o.id, d.nome, pf.nome
  ) y;

  RETURN jsonb_build_object(
    'aluno', jsonb_build_object(
      'id', v_aluno.id, 'created_at', v_aluno.created_at, 'escola_id', v_aluno.escola_id,
      'turma_id', v_aluno.turma_id, 'nome_completo', v_aluno.nome_completo,
      'numero_chamada', v_aluno.numero_chamada, 'ativo', v_aluno.ativo),
    'turma', jsonb_build_object(
      'id', v_turma.id, 'created_at', v_turma.created_at, 'escola_id', v_turma.escola_id,
      'nome', v_turma.nome, 'serie', v_turma.serie, 'segmento', v_turma.segmento,
      'ano_letivo', v_turma.ano_letivo, 'codigo_acesso', v_turma.codigo_acesso, 'ativa', v_turma.ativa),
    'periodo_atual', jsonb_build_object(
      'id', v_periodo.id, 'created_at', v_periodo.created_at, 'escola_id', v_periodo.escola_id,
      'nome', v_periodo.nome, 'ano_letivo', v_periodo.ano_letivo, 'data_inicio', v_periodo.data_inicio,
      'data_fim', v_periodo.data_fim, 'ativo', v_periodo.ativo),
    'disciplinas', v_disciplinas);
END $$;

CREATE OR REPLACE FUNCTION public.aluno_avisos(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_aluno_id uuid := private.aluno_da_sessao(p_token);
  v_aluno public.alunos%ROWTYPE;
BEGIN
  SELECT * INTO v_aluno FROM public.alunos WHERE id = v_aluno_id;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', av.id, 'created_at', av.publicado_em, 'escola_id', av.escola_id, 'autor_id', av.autor_id,
      'turma_id', av.turma_id, 'titulo', av.titulo, 'mensagem', av.mensagem,
      'prioridade', av.prioridade, 'publicado_em', av.publicado_em
    ) ORDER BY av.publicado_em DESC)
    FROM public.avisos av
    WHERE av.escola_id = v_aluno.escola_id AND av.deleted_at IS NULL
      AND (av.turma_id IS NULL OR av.turma_id = v_aluno.turma_id)
  ), '[]'::jsonb);
END $$;

-- -----------------------------------------------------------------------------
-- 6. PIN definido pela equipe (bcrypt). O hash nunca volta ao cliente.
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
  -- PIN novo: zera bloqueio e encerra as sessões antigas.
  INSERT INTO public.pin_tentativas (aluno_id) VALUES (p_aluno_id)
  ON CONFLICT (aluno_id) DO UPDATE SET tentativas = 0, bloqueado_ate = NULL;
  UPDATE public.aluno_sessoes SET revogada_em = now() WHERE aluno_id = p_aluno_id AND revogada_em IS NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Privilégios: RPCs do aluno para anon e authenticated; definir_pin só autenticado
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.aluno_listar_turma(text), public.aluno_login(uuid, text), public.aluno_sair(text),
  public.aluno_atividades(text), public.aluno_carregar_atividade(text, uuid),
  public.aluno_responder(text, uuid, uuid), public.aluno_responder_discursiva(text, uuid, text),
  public.aluno_tentar_novamente(text, uuid, uuid), public.aluno_resultado_prova(text, uuid),
  public.aluno_meu_desempenho(text), public.aluno_avisos(text), public.definir_pin_aluno(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.aluno_listar_turma(text), public.aluno_login(uuid, text), public.aluno_sair(text),
  public.aluno_atividades(text), public.aluno_carregar_atividade(text, uuid),
  public.aluno_responder(text, uuid, uuid), public.aluno_responder_discursiva(text, uuid, text),
  public.aluno_tentar_novamente(text, uuid, uuid), public.aluno_resultado_prova(text, uuid),
  public.aluno_meu_desempenho(text), public.aluno_avisos(text)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.definir_pin_aluno(uuid, text) TO authenticated;
