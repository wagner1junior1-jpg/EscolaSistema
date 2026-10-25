-- =============================================================================
-- SABERPONTUAL — PAINEL DO PROFESSOR POR RPC (desempenho; depois da Fase 7)
--
-- Roda DEPOIS da 0007. Não apaga dados e não mexe nas tabelas.
--
-- Por que RPC: o painel do professor chamava, no navegador, dezenas de métodos por oferta
-- (atividades, correções pendentes, desempenho...) e cada um repetia as mesmas conferências:
-- 395 requisições e 27 s no painel da Profª Ana no Supabase de teste. Esta função devolve UM
-- jsonb com tudo o que o painel precisa (ofertas, atividades, alunos, questões e respostas) e o
-- app calcula com as MESMAS funções puras do mock (app/src/services/painel-professor.ts).
--
-- Quem recebe o quê:
--   * professor: só as SUAS ofertas (e o que depende delas);
--   * direção e coordenação: todas as ofertas da escola (igual a minhasOfertas);
--   * aluno, anônimo e usuário inativo: negado (42501).
--
-- Segurança: SECURITY DEFINER (a RLS não se aplica), por isso a função confere o papel e filtra
-- TUDO por private.escola_atual() e pelas ofertas permitidas. Nunca leva PIN, credenciais nem o
-- gabarito das alternativas (o painel não precisa: só `acertou`, `pontuacao` e `correcao`).
--
-- Teto conhecido: o snapshot cresce com (alunos x questões respondidas das atividades
-- publicadas/encerradas do professor). Serve bem para um professor com dezenas de turmas; se um
-- dia pesar, a agregação pode migrar para o SQL sem mudar o contrato.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.professor_painel_dados()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_escola uuid := private.escola_atual();
  v_uid uuid := auth.uid();
  v_gestao boolean := private.eh_gestao();
BEGIN
  IF v_escola IS NULL OR NOT (v_gestao OR private.papel_atual() = 'professor') THEN
    RAISE EXCEPTION 'Você não tem permissão para esta ação.' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH ofs AS MATERIALIZED (
      SELECT o.id, o.created_at, o.turma_id, o.disciplina_id, o.professor_id
        FROM public.ofertas o
        JOIN public.turmas t ON t.id = o.turma_id AND t.deleted_at IS NULL
       WHERE t.escola_id = v_escola AND o.deleted_at IS NULL
         AND (v_gestao OR o.professor_id = v_uid)
    ),
    ats AS MATERIALIZED (
      SELECT a.id, a.created_at, a.oferta_id, a.periodo_id, a.titulo, a.descricao, a.prazo,
             a.modo, a.status, a.criado_por
        FROM public.atividades a
        JOIN ofs ON ofs.id = a.oferta_id
       WHERE a.deleted_at IS NULL
    ),
    qs AS MATERIALIZED (
      SELECT q.id, q.atividade_id, q.tipo
        FROM public.questoes q
        JOIN ats ON ats.id = q.atividade_id
       WHERE q.deleted_at IS NULL AND ats.status IN ('publicada', 'encerrada')
    )
    SELECT jsonb_build_object(
      'ofertas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', ofs.id, 'created_at', ofs.created_at, 'turma_id', ofs.turma_id,
                 'disciplina_id', ofs.disciplina_id, 'professor_id', ofs.professor_id,
                 'turma_nome', t.nome, 'turma_codigo', t.codigo_acesso, 'turma_serie', t.serie,
                 'disciplina_nome', d.nome, 'professor_nome', p.nome))
          FROM ofs
          JOIN public.turmas t ON t.id = ofs.turma_id
          LEFT JOIN public.disciplinas d ON d.id = ofs.disciplina_id
          LEFT JOIN public.perfis p ON p.id = ofs.professor_id
      ), '[]'::jsonb),

      'atividades', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', ats.id, 'created_at', ats.created_at, 'oferta_id', ats.oferta_id,
                 'periodo_id', ats.periodo_id, 'titulo', ats.titulo, 'descricao', ats.descricao,
                 'prazo', ats.prazo, 'modo', ats.modo, 'status', ats.status,
                 'criado_por', ats.criado_por))
          FROM ats
      ), '[]'::jsonb),

      'alunos', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', al.id, 'turma_id', al.turma_id, 'nome_completo', al.nome_completo,
                 'numero_chamada', al.numero_chamada))
          FROM public.alunos al
         WHERE al.escola_id = v_escola AND al.ativo AND al.deleted_at IS NULL
           AND al.turma_id IN (SELECT turma_id FROM ofs)
      ), '[]'::jsonb),

      'questoes', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', qs.id, 'atividade_id', qs.atividade_id, 'tipo', qs.tipo))
          FROM qs
      ), '[]'::jsonb),

      'respostas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', r.id, 'aluno_id', r.aluno_id, 'questao_id', r.questao_id,
                 'acertou', r.acertou, 'pontuacao', r.pontuacao, 'correcao', r.correcao))
          FROM public.respostas r
          JOIN qs ON qs.id = r.questao_id
      ), '[]'::jsonb)
    )
  );
END $$;

REVOKE ALL ON FUNCTION public.professor_painel_dados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.professor_painel_dados() TO authenticated;
