-- =============================================================================
-- SABERPONTUAL — RELATÓRIOS DA ESCOLA POR RPC (Fase 5.5 do plano do back end)
--
-- Roda DEPOIS da 0006. Não apaga dados e não mexe nas tabelas.
--
-- Por que RPC: o PostgREST devolve no máximo 1000 linhas por consulta e corta SEM erro, e a
-- URL com centenas de ids em `in (...)` estoura o limite do gateway. Relatório da escola
-- inteira passa disso fácil. Uma RPC que devolve UM jsonb não sofre nenhum dos dois limites.
--
--   * relatorio_visao_geral(): os 5 números do painel, calculados no servidor.
--   * relatorio_dados_periodo(p_periodo_id): as tabelas que os relatórios leem, já filtradas
--     pela escola e pelo período. O app calcula com as MESMAS funções puras do mock
--     (app/src/services/relatorios-escola.ts), então a regra pedagógica existe uma vez só.
--
-- Segurança: SECURITY DEFINER (a RLS não se aplica), por isso cada função exige direção ou
-- coordenação (private.eh_gestao) e filtra TUDO por private.escola_atual(). Anônimo não executa.
-- O snapshot leva o gabarito (alternativas.correta, por_que_errou) porque os relatórios da gestão
-- o mostram e a RLS já dá esse acesso a direção/coordenação; nunca leva PIN nem credenciais.
--
-- Teto conhecido: o snapshot cresce com (alunos x questões respondidas do período). Serve bem
-- para dezenas de turmas; se um dia pesar, a agregação pode migrar para o SQL sem mudar o contrato.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.relatorio_visao_geral()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_escola uuid := private.escola_atual();
  v_alunos int;
  v_prof int;
  v_turmas int;
  v_ativ int;
  v_resp int;
  v_pontos numeric;
BEGIN
  IF NOT private.eh_gestao() THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_alunos FROM public.alunos
   WHERE escola_id = v_escola AND ativo AND deleted_at IS NULL;

  SELECT count(*) INTO v_prof FROM public.perfis
   WHERE escola_id = v_escola AND papel = 'professor' AND ativo;

  SELECT count(*) INTO v_turmas FROM public.turmas
   WHERE escola_id = v_escola AND ativa AND deleted_at IS NULL;

  SELECT count(*) INTO v_ativ
    FROM public.atividades a
    JOIN public.ofertas o ON o.id = a.oferta_id AND o.deleted_at IS NULL
    JOIN public.turmas t ON t.id = o.turma_id AND t.deleted_at IS NULL
   WHERE t.escola_id = v_escola AND a.deleted_at IS NULL
     AND a.status IN ('publicada', 'encerrada');

  -- Mesma conta do mock: pontos de todas as respostas / número de respostas (pendente soma 0
  -- pontos mas conta no denominador).
  SELECT count(*), coalesce(sum(coalesce(private.pontos_resposta(q.tipo, r.acertou, r.correcao, r.pontuacao), 0)), 0)
    INTO v_resp, v_pontos
    FROM public.respostas r
    JOIN public.alunos al ON al.id = r.aluno_id AND al.deleted_at IS NULL
    JOIN public.questoes q ON q.id = r.questao_id
   WHERE al.escola_id = v_escola;

  RETURN jsonb_build_object(
    'total_alunos', v_alunos,
    'total_turmas', v_turmas,
    'total_professores', v_prof,
    'total_atividades_publicadas', v_ativ,
    'aproveitamento_medio',
      CASE WHEN v_resp > 0 THEN round((v_pontos / v_resp) * 1000) / 10 ELSE NULL END
  );
END $$;

CREATE OR REPLACE FUNCTION public.relatorio_dados_periodo(p_periodo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_escola uuid := private.escola_atual();
BEGIN
  IF NOT private.eh_gestao() THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;

  -- O período precisa ser da escola de quem chama (senão devolve tudo vazio, sem vazar nada).
  IF NOT EXISTS (
    SELECT 1 FROM public.periodos p
     WHERE p.id = p_periodo_id AND p.escola_id = v_escola AND p.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'turmas', '[]'::jsonb, 'ofertas', '[]'::jsonb, 'disciplinas', '[]'::jsonb,
      'perfis', '[]'::jsonb, 'alunos', '[]'::jsonb, 'atividades', '[]'::jsonb,
      'questoes', '[]'::jsonb, 'alternativas', '[]'::jsonb, 'respostas', '[]'::jsonb,
      'assuntos', '[]'::jsonb, 'banco_questoes', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'turmas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'serie', t.serie, 'ativa', t.ativa))
        FROM public.turmas t WHERE t.escola_id = v_escola AND t.deleted_at IS NULL), '[]'::jsonb),

    'ofertas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'turma_id', o.turma_id,
                                          'disciplina_id', o.disciplina_id, 'professor_id', o.professor_id))
        FROM public.ofertas o JOIN public.turmas t ON t.id = o.turma_id
       WHERE t.escola_id = v_escola AND t.deleted_at IS NULL AND o.deleted_at IS NULL), '[]'::jsonb),

    'disciplinas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'nome', d.nome))
        FROM public.disciplinas d WHERE d.escola_id = v_escola AND d.deleted_at IS NULL), '[]'::jsonb),

    'perfis', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'papel', p.papel, 'ativo', p.ativo))
        FROM public.perfis p WHERE p.escola_id = v_escola), '[]'::jsonb),

    'alunos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'turma_id', a.turma_id, 'nome_completo', a.nome_completo,
                                          'numero_chamada', a.numero_chamada, 'ativo', a.ativo))
        FROM public.alunos a WHERE a.escola_id = v_escola AND a.deleted_at IS NULL), '[]'::jsonb),

    'atividades', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'oferta_id', a.oferta_id, 'periodo_id', a.periodo_id,
                                          'titulo', a.titulo, 'modo', a.modo, 'status', a.status))
        FROM public.atividades a
        JOIN public.ofertas o ON o.id = a.oferta_id AND o.deleted_at IS NULL
        JOIN public.turmas t ON t.id = o.turma_id AND t.deleted_at IS NULL
       WHERE t.escola_id = v_escola AND a.periodo_id = p_periodo_id AND a.deleted_at IS NULL
         AND a.status IN ('publicada', 'encerrada')), '[]'::jsonb),

    'questoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', q.id, 'atividade_id', q.atividade_id, 'ordem', q.ordem,
                                          'tipo', q.tipo, 'enunciado', q.enunciado, 'imagem_url', q.imagem_url,
                                          'dica', q.dica, 'explicacao', q.explicacao,
                                          'resposta_esperada', q.resposta_esperada,
                                          'banco_questao_id', q.banco_questao_id, 'assunto_id', q.assunto_id))
        FROM public.questoes q
        JOIN public.atividades a ON a.id = q.atividade_id AND a.deleted_at IS NULL
        JOIN public.ofertas o ON o.id = a.oferta_id AND o.deleted_at IS NULL
        JOIN public.turmas t ON t.id = o.turma_id AND t.deleted_at IS NULL
       WHERE t.escola_id = v_escola AND a.periodo_id = p_periodo_id AND q.deleted_at IS NULL
         AND a.status IN ('publicada', 'encerrada')), '[]'::jsonb),

    'alternativas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', alt.id, 'questao_id', alt.questao_id, 'letra', alt.letra,
                                          'texto', alt.texto, 'correta', alt.correta,
                                          'por_que_errou', alt.por_que_errou))
        FROM public.alternativas alt
        JOIN public.questoes q ON q.id = alt.questao_id AND q.deleted_at IS NULL
        JOIN public.atividades a ON a.id = q.atividade_id AND a.deleted_at IS NULL
        JOIN public.ofertas o ON o.id = a.oferta_id AND o.deleted_at IS NULL
        JOIN public.turmas t ON t.id = o.turma_id AND t.deleted_at IS NULL
       WHERE t.escola_id = v_escola AND a.periodo_id = p_periodo_id
         AND a.status IN ('publicada', 'encerrada')), '[]'::jsonb),

    'respostas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'aluno_id', r.aluno_id, 'questao_id', r.questao_id,
                                          'alternativa_id', r.alternativa_id, 'acertou', r.acertou,
                                          'pontuacao', r.pontuacao, 'correcao', r.correcao))
        FROM public.respostas r
        JOIN public.alunos al ON al.id = r.aluno_id AND al.deleted_at IS NULL
        JOIN public.questoes q ON q.id = r.questao_id AND q.deleted_at IS NULL
        JOIN public.atividades a ON a.id = q.atividade_id AND a.deleted_at IS NULL
        JOIN public.ofertas o ON o.id = a.oferta_id AND o.deleted_at IS NULL
        JOIN public.turmas t ON t.id = o.turma_id AND t.deleted_at IS NULL
       WHERE al.escola_id = v_escola AND t.escola_id = v_escola AND a.periodo_id = p_periodo_id
         AND a.status IN ('publicada', 'encerrada')), '[]'::jsonb),

    'assuntos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'disciplina_id', s.disciplina_id, 'nome', s.nome))
        FROM public.assuntos s WHERE s.escola_id = v_escola AND s.deleted_at IS NULL), '[]'::jsonb),

    'banco_questoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'assunto_id', b.assunto_id))
        FROM public.banco_questoes b WHERE b.escola_id = v_escola AND b.deleted_at IS NULL), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.relatorio_visao_geral(), public.relatorio_dados_periodo(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_visao_geral(), public.relatorio_dados_periodo(uuid)
  TO authenticated;
