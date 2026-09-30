-- =============================================================================
-- SABERPONTUAL — TABELA DE OBSERVAÇÕES PEDAGÓGICAS DO ALUNO
-- Permite que professores registrem e consultem anotações sobre os estudantes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.aluno_observacoes (
  id text PRIMARY KEY,
  aluno_id text NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  professor_id text NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  professor_nome text NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aluno_observacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso app aluno_observacoes" ON public.aluno_observacoes;
CREATE POLICY "Acesso app aluno_observacoes"
  ON public.aluno_observacoes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
