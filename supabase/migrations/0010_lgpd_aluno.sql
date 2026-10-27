-- =============================================================================
-- SABERPONTUAL — LGPD: EXPORTAR E APAGAR OS DADOS DE UM ALUNO (Fase 8.2)
--
-- Roda DEPOIS da 0009. Não apaga dados sozinha.
--
-- Direitos do titular (LGPD art. 18): acesso/portabilidade e eliminação. A escola é a
-- controladora; quem atende o pedido no sistema é a equipe da escola:
--   * exportar_dados_aluno(aluno): direção ou coordenação. Devolve um JSON com o cadastro,
--     a turma, as respostas (sem gabarito), as observações dos professores e um resumo do acesso.
--     Nunca leva PIN, hash nem token.
--   * apagar_dados_aluno(aluno, confirmacao): SÓ a direção, digitando o nome completo do aluno.
--     Apaga de verdade o aluno e, em cascata, PIN, sessões, tentativas, respostas e observações.
--     Não tem volta (o backup diário do Supabase guarda cópias por alguns dias; ver 8.3).
--   * lgpd_registros: quem exportou/apagou e quando (prestação de contas). Guarda só o id do
--     aluno, sem nome nem conteúdo. A direção da escola lê; ninguém altera pelo cliente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lgpd_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('exportar', 'apagar')),
  aluno_id uuid NOT NULL, -- sem FK de propósito: o registro fica depois que o aluno é apagado
  feito_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  feito_em timestamptz NOT NULL DEFAULT now(),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS lgpd_registros_escola_idx ON public.lgpd_registros (escola_id, feito_em);
ALTER TABLE public.lgpd_registros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lgpd_registros FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lgpd_registros TO authenticated;
DROP POLICY IF EXISTS lgpd_registros_select ON public.lgpd_registros;
CREATE POLICY lgpd_registros_select ON public.lgpd_registros FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual() AND private.eh_direcao());

-- -----------------------------------------------------------------------------
-- Exportar (direção e coordenação)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exportar_dados_aluno(p_aluno_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escola uuid := private.escola_atual();
  v_aluno public.alunos%ROWTYPE;
  v_dados jsonb;
BEGIN
  IF v_escola IS NULL OR NOT private.eh_gestao() THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;
  -- Inclui aluno já excluído pela exclusão lógica: os dados dele continuam guardados.
  SELECT * INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = v_escola;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;

  v_dados := jsonb_build_object(
    'formato', 'saberpontual-exportacao-aluno-v1',
    'exportado_em', now(),
    'escola', (SELECT jsonb_build_object('nome', e.nome, 'cidade_uf', e.cidade_uf)
                 FROM public.escolas e WHERE e.id = v_escola),
    'aluno', jsonb_build_object(
      'id', v_aluno.id, 'nome_completo', v_aluno.nome_completo, 'numero_chamada', v_aluno.numero_chamada,
      'ativo', v_aluno.ativo, 'cadastrado_em', v_aluno.created_at, 'excluido_em', v_aluno.deleted_at),
    'turma', (SELECT jsonb_build_object('nome', t.nome, 'serie', t.serie, 'ano_letivo', t.ano_letivo)
                FROM public.turmas t WHERE t.id = v_aluno.turma_id),
    -- Sem alternativa correta, explicação nem "por que errou": a atividade pode estar aberta.
    'respostas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'disciplina', d.nome, 'periodo', pe.nome, 'atividade', at.titulo, 'modo', at.modo,
               'questao', q.ordem, 'enunciado', q.enunciado, 'tipo', q.tipo,
               'alternativa_escolhida', alt.letra, 'acertou', r.acertou, 'acertou_final', r.acertou_final,
               'tentativas', r.tentativas, 'texto_resposta', r.texto_resposta, 'correcao', r.correcao,
               'pontuacao', r.pontuacao, 'comentario_professor', r.comentario_professor,
               'respondida_em', r.respondida_em, 'corrigida_em', r.corrigido_em)
             ORDER BY r.respondida_em, q.ordem)
        FROM public.respostas r
        JOIN public.questoes q ON q.id = r.questao_id
        JOIN public.atividades at ON at.id = q.atividade_id
        JOIN public.ofertas o ON o.id = at.oferta_id
        LEFT JOIN public.disciplinas d ON d.id = o.disciplina_id
        LEFT JOIN public.periodos pe ON pe.id = at.periodo_id
        LEFT JOIN public.alternativas alt ON alt.id = r.alternativa_id
       WHERE r.aluno_id = v_aluno.id), '[]'::jsonb),
    'observacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'professor', ob.professor_nome, 'texto', ob.texto,
               'criada_em', ob.created_at, 'excluida_em', ob.deleted_at)
             ORDER BY ob.created_at)
        FROM public.aluno_observacoes ob WHERE ob.aluno_id = v_aluno.id), '[]'::jsonb),
    'acesso', jsonb_build_object(
      'pin_cadastrado', EXISTS (SELECT 1 FROM public.aluno_credenciais c WHERE c.aluno_id = v_aluno.id),
      'entradas_guardadas', (SELECT count(*) FROM public.aluno_sessoes s WHERE s.aluno_id = v_aluno.id),
      'ultima_entrada', (SELECT max(s.criada_em) FROM public.aluno_sessoes s WHERE s.aluno_id = v_aluno.id))
  );

  INSERT INTO public.lgpd_registros (escola_id, acao, aluno_id, feito_por)
  VALUES (v_escola, 'exportar', v_aluno.id, auth.uid());
  RETURN v_dados;
END $$;

-- -----------------------------------------------------------------------------
-- Apagar de verdade (só a direção, com o nome completo como confirmação)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apagar_dados_aluno(p_aluno_id uuid, p_confirmacao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escola uuid := private.escola_atual();
  v_aluno public.alunos%ROWTYPE;
  v_respostas int;
  v_observacoes int;
BEGIN
  IF v_escola IS NULL OR NOT private.eh_direcao() THEN
    RAISE EXCEPTION 'Só a direção pode apagar os dados de um aluno.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_aluno FROM public.alunos WHERE id = p_aluno_id AND escola_id = v_escola FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado ou sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF lower(btrim(coalesce(p_confirmacao, ''))) IS DISTINCT FROM lower(btrim(v_aluno.nome_completo)) THEN
    RAISE EXCEPTION 'Para apagar, digite o nome completo do aluno exatamente como está cadastrado.';
  END IF;

  SELECT count(*) INTO v_respostas FROM public.respostas WHERE aluno_id = v_aluno.id;
  SELECT count(*) INTO v_observacoes FROM public.aluno_observacoes WHERE aluno_id = v_aluno.id;
  -- Cascata: aluno_credenciais, pin_tentativas, aluno_sessoes, respostas, aluno_observacoes.
  DELETE FROM public.alunos WHERE id = v_aluno.id;

  INSERT INTO public.lgpd_registros (escola_id, acao, aluno_id, feito_por, detalhes)
  VALUES (v_escola, 'apagar', v_aluno.id, auth.uid(),
          jsonb_build_object('respostas', v_respostas, 'observacoes', v_observacoes));
  RETURN jsonb_build_object('respostas', v_respostas, 'observacoes', v_observacoes);
END $$;

REVOKE ALL ON FUNCTION public.exportar_dados_aluno(uuid), public.apagar_dados_aluno(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exportar_dados_aluno(uuid), public.apagar_dados_aluno(uuid, text)
  TO authenticated;
