-- =============================================================================
-- SABERPONTUAL — RESPOSTAS: A EQUIPE SÓ ALTERA AS COLUNAS DE CORREÇÃO (Fase 5.4)
--
-- Roda DEPOIS da 0005. Não apaga dados e não mexe nas RPCs do aluno.
--
-- Problema (pendência da Fase 2): a política respostas_update deixa o professor da turma
-- alterar QUALQUER coluna de respostas (aluno_id, acertou, alternativa_id, texto_resposta,
-- tentativas...). Isso permitiria trocar o dono de uma resposta ou virar um erro em acerto.
--
-- Correção: privilégio por coluna. A equipe (role authenticated) só pode atualizar as colunas
-- da correção da discursiva. As RPCs do aluno são SECURITY DEFINER (rodam como dono da
-- tabela) e continuam gravando todas as colunas normalmente.
-- =============================================================================

REVOKE UPDATE ON public.respostas FROM authenticated;
GRANT UPDATE (correcao, pontuacao, comentario_professor, corrigido_por, corrigido_em)
  ON public.respostas TO authenticated;
