-- =============================================================================
-- SABERPONTUAL — SCHEMA COMPLETO + RLS + SEED INICIAL (SUPABASE POSTGRES)
-- Cole e execute este script no SQL Editor do seu painel do Supabase.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabela de Sincronização de Estado (Garante funcionamento imediato de todas as telas)
CREATE TABLE IF NOT EXISTS public.saberpontual_store (
  id text PRIMARY KEY DEFAULT 'global',
  versao int NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saberpontual_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso completo ao store da aplicacao" ON public.saberpontual_store;
CREATE POLICY "Acesso completo ao store da aplicacao"
  ON public.saberpontual_store
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Tabelas Relacionais Principais (Especificação Seções 4 e 9.2)

CREATE TABLE IF NOT EXISTS public.escolas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  cidade_uf text NOT NULL,
  ano_letivo_atual int NOT NULL DEFAULT 2026,
  limite_otimo numeric NOT NULL DEFAULT 80,
  limite_bom numeric NOT NULL DEFAULT 60,
  cota_ia_mensal int NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.perfis (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  papel text NOT NULL CHECK (papel IN ('direcao', 'coordenacao', 'professor')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.periodos (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ano_letivo int NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disciplinas (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escola_id, nome)
);

CREATE TABLE IF NOT EXISTS public.turmas (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  serie text NOT NULL,
  segmento text NOT NULL CHECK (segmento IN ('fund1', 'fund2', 'medio')),
  ano_letivo int NOT NULL,
  codigo_acesso text NOT NULL UNIQUE,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ofertas (
  id text PRIMARY KEY,
  turma_id text NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id text NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  professor_id text NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(turma_id, disciplina_id)
);

CREATE TABLE IF NOT EXISTS public.alunos (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  turma_id text NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  numero_chamada int NOT NULL,
  pin_hash text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assuntos (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  disciplina_id text NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(disciplina_id, nome)
);

CREATE TABLE IF NOT EXISTS public.banco_questoes (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  disciplina_id text NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  assunto_id text NOT NULL REFERENCES public.assuntos(id) ON DELETE CASCADE,
  criado_por text NOT NULL,
  serie text NOT NULL,
  tipo text NOT NULL DEFAULT 'objetiva' CHECK (tipo IN ('objetiva', 'discursiva')),
  dificuldade text NOT NULL DEFAULT 'medio' CHECK (dificuldade IN ('facil', 'medio', 'dificil')),
  enunciado text NOT NULL,
  imagem_url text,
  dica text,
  explicacao text,
  resposta_esperada text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'ia')),
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.banco_alternativas (
  id text PRIMARY KEY,
  banco_questao_id text NOT NULL REFERENCES public.banco_questoes(id) ON DELETE CASCADE,
  letra text NOT NULL CHECK (letra IN ('A', 'B', 'C', 'D', 'E')),
  texto text NOT NULL,
  correta boolean NOT NULL DEFAULT false,
  por_que_errou text
);

CREATE TABLE IF NOT EXISTS public.atividades (
  id text PRIMARY KEY,
  oferta_id text NOT NULL REFERENCES public.ofertas(id) ON DELETE CASCADE,
  periodo_id text NOT NULL REFERENCES public.periodos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  prazo date,
  modo text NOT NULL DEFAULT 'exercicio' CHECK (modo IN ('prova', 'exercicio')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada', 'encerrada')),
  criado_por text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questoes (
  id text PRIMARY KEY,
  atividade_id text NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  tipo text NOT NULL DEFAULT 'objetiva' CHECK (tipo IN ('objetiva', 'discursiva')),
  dificuldade text DEFAULT 'medio',
  enunciado text NOT NULL,
  imagem_url text,
  dica text,
  explicacao text,
  resposta_esperada text,
  banco_questao_id text,
  assunto_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alternativas (
  id text PRIMARY KEY,
  questao_id text NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  letra text NOT NULL CHECK (letra IN ('A', 'B', 'C', 'D', 'E')),
  texto text NOT NULL,
  correta boolean NOT NULL DEFAULT false,
  por_que_errou text
);

CREATE TABLE IF NOT EXISTS public.respostas (
  id text PRIMARY KEY,
  aluno_id text NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  questao_id text NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  alternativa_id text,
  acertou boolean,
  pontuacao numeric,
  texto_resposta text,
  correcao text CHECK (correcao IN ('pendente', 'certo', 'parcial', 'errado')),
  comentario_professor text,
  corrigido_por text,
  corrigido_em timestamptz,
  respondida_em timestamptz NOT NULL DEFAULT now(),
  tentativas int NOT NULL DEFAULT 1,
  acertou_final boolean,
  UNIQUE(aluno_id, questao_id)
);

CREATE TABLE IF NOT EXISTS public.avisos (
  id text PRIMARY KEY,
  escola_id text NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  autor_id text NOT NULL,
  turma_id text,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  publicado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ia_geracoes (
  id text PRIMARY KEY,
  escola_id text NOT NULL,
  professor_id text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  qtd_fotos int NOT NULL DEFAULT 0,
  qtd_objetivas int NOT NULL DEFAULT 0,
  qtd_discursivas int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'erro')),
  custo_estimado numeric
);

-- Habilita RLS em todas as tabelas
ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_alternativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alternativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_geracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para o cliente da aplicação
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'escolas', 'perfis', 'periodos', 'disciplinas', 'turmas', 'ofertas',
    'alunos', 'assuntos', 'banco_questoes', 'banco_alternativas',
    'atividades', 'questoes', 'alternativas', 'respostas', 'avisos', 'ia_geracoes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Acesso app %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Acesso app %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;
