-- =============================================================================
-- SABERPONTUAL — ESQUEMA V2 + RLS REAL (Fase 2 do plano do back end)
--
-- ATENÇÃO: esta migration RECRIA todas as tabelas (ids passam de text para uuid).
-- Ela APAGA os dados do Supabase atual. Só pode rodar no projeto de TESTE, que
-- tem apenas dados fictícios (conferido em 20/10/2026). Nunca rodar com dado real.
--
-- O que muda:
--   * ids uuid; updated_at automático; deleted_at (exclusão lógica) nas tabelas pedagógicas;
--   * perfis.id = auth.users.id (login real pelo Supabase Auth, Fase 3);
--   * PIN do aluno sai da tabela alunos e vai para aluno_credenciais (sem política: só RPC);
--   * aluno_sessoes e pin_tentativas (Fase 4); ia_geracoes ajustada;
--   * funções auxiliares em schema privado (private), fora da API;
--   * RLS por papel: direção/coordenação na escola toda; professor só nas suas turmas;
--     anônimo sem acesso a nenhuma tabela; aluno só por RPC (Fase 4);
--   * remove saberpontual_store e todas as políticas USING (true).
--
-- Exclusão lógica: as políticas NÃO filtram deleted_at (um UPDATE que marca
-- deleted_at falharia se a política de leitura escondesse a linha). Os serviços
-- devem filtrar `deleted_at IS NULL` nas consultas.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 0. Limpeza do esquema antigo (dados fictícios)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS
  public.saberpontual_store,
  public.aluno_observacoes,
  public.ia_geracoes,
  public.avisos,
  public.respostas,
  public.alternativas,
  public.questoes,
  public.atividades,
  public.banco_alternativas,
  public.banco_questoes,
  public.assuntos,
  public.alunos,
  public.ofertas,
  public.turmas,
  public.disciplinas,
  public.periodos,
  public.perfis,
  public.escolas
CASCADE;

-- -----------------------------------------------------------------------------
-- 1. Trigger de updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Tabelas
-- -----------------------------------------------------------------------------
CREATE TABLE public.escolas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade_uf text NOT NULL,
  ano_letivo_atual int NOT NULL DEFAULT 2026,
  limite_otimo numeric NOT NULL DEFAULT 80,
  limite_bom numeric NOT NULL DEFAULT 60,
  cota_ia_mensal int NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  papel text NOT NULL CHECK (papel IN ('direcao', 'coordenacao', 'professor')),
  ativo boolean NOT NULL DEFAULT true,
  trocar_senha boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ano_letivo int NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.disciplinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (escola_id, nome)
);

CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  serie text NOT NULL,
  segmento text NOT NULL CHECK (segmento IN ('fund1', 'fund2', 'medio')),
  ano_letivo int NOT NULL,
  codigo_acesso text NOT NULL UNIQUE,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (turma_id, disciplina_id)
);

CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  numero_chamada int NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- PIN do aluno (hash bcrypt, Fase 4). Sem política: nunca legível pelo cliente.
CREATE TABLE public.aluno_credenciais (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bloqueio de PIN por tentativas, no servidor (Fase 4). Sem política.
CREATE TABLE public.pin_tentativas (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  tentativas int NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sessão do aluno com expiração e revogação (Fase 4). Só guarda o hash do token. Sem política.
CREATE TABLE public.aluno_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  revogada_em timestamptz
);
CREATE INDEX aluno_sessoes_aluno_idx ON public.aluno_sessoes (aluno_id);

CREATE TABLE public.assuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (disciplina_id, nome)
);

CREATE TABLE public.banco_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  assunto_id uuid NOT NULL REFERENCES public.assuntos(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.banco_alternativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_questao_id uuid NOT NULL REFERENCES public.banco_questoes(id) ON DELETE CASCADE,
  letra text NOT NULL CHECK (letra IN ('A', 'B', 'C', 'D', 'E')),
  texto text NOT NULL,
  correta boolean NOT NULL DEFAULT false,
  por_que_errou text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (banco_questao_id, letra)
);

CREATE TABLE public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES public.periodos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  prazo date,
  modo text NOT NULL DEFAULT 'exercicio' CHECK (modo IN ('prova', 'exercicio')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada', 'encerrada')),
  criado_por uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  tipo text NOT NULL DEFAULT 'objetiva' CHECK (tipo IN ('objetiva', 'discursiva')),
  dificuldade text DEFAULT 'medio',
  enunciado text NOT NULL,
  imagem_url text,
  dica text,
  explicacao text,
  resposta_esperada text,
  banco_questao_id uuid REFERENCES public.banco_questoes(id) ON DELETE SET NULL,
  assunto_id uuid REFERENCES public.assuntos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.alternativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questao_id uuid NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  letra text NOT NULL CHECK (letra IN ('A', 'B', 'C', 'D', 'E')),
  texto text NOT NULL,
  correta boolean NOT NULL DEFAULT false,
  por_que_errou text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questao_id, letra)
);

-- Respostas: o aluno NUNCA escreve aqui direto; só a RPC "responder" (Fase 4).
CREATE TABLE public.respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  questao_id uuid NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  alternativa_id uuid REFERENCES public.alternativas(id) ON DELETE SET NULL,
  acertou boolean,
  pontuacao numeric,
  texto_resposta text,
  correcao text CHECK (correcao IN ('pendente', 'certo', 'parcial', 'errado')),
  comentario_professor text,
  corrigido_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  corrigido_em timestamptz,
  respondida_em timestamptz NOT NULL DEFAULT now(),
  tentativas int NOT NULL DEFAULT 1,
  acertou_final boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, questao_id)
);

CREATE TABLE public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  publicado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Gerações de IA: gravadas só pela Edge Function (service role). Cota mensal por escola.
CREATE TABLE public.ia_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  qtd_fotos int NOT NULL DEFAULT 0,
  qtd_objetivas int NOT NULL DEFAULT 0,
  qtd_discursivas int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'erro')),
  erro_msg text,
  custo_estimado numeric
);
CREATE INDEX ia_geracoes_escola_mes_idx ON public.ia_geracoes (escola_id, criado_em);

CREATE TABLE public.aluno_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  professor_nome text NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Índices de apoio às políticas
CREATE INDEX ofertas_professor_idx ON public.ofertas (professor_id);
CREATE INDEX ofertas_turma_idx ON public.ofertas (turma_id);
CREATE INDEX alunos_turma_idx ON public.alunos (turma_id);
CREATE INDEX atividades_oferta_idx ON public.atividades (oferta_id);
CREATE INDEX questoes_atividade_idx ON public.questoes (atividade_id);
CREATE INDEX alternativas_questao_idx ON public.alternativas (questao_id);
CREATE INDEX respostas_questao_idx ON public.respostas (questao_id);
CREATE INDEX banco_alt_questao_idx ON public.banco_alternativas (banco_questao_id);
CREATE INDEX observacoes_aluno_idx ON public.aluno_observacoes (aluno_id);

-- Triggers de updated_at
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'escolas', 'perfis', 'periodos', 'disciplinas', 'turmas', 'ofertas', 'alunos',
    'aluno_credenciais', 'pin_tentativas', 'assuntos', 'banco_questoes', 'banco_alternativas',
    'atividades', 'questoes', 'alternativas', 'respostas', 'avisos', 'aluno_observacoes'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Funções auxiliares (schema private: fora da API REST/RPC)
--    SECURITY DEFINER lê as tabelas sem passar pela RLS, evitando recursão.
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.escola_atual()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.escola_id FROM public.perfis p WHERE p.id = auth.uid() AND p.ativo
$$;

CREATE OR REPLACE FUNCTION private.papel_atual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.papel FROM public.perfis p WHERE p.id = auth.uid() AND p.ativo
$$;

CREATE OR REPLACE FUNCTION private.eh_gestao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.papel_atual() IN ('direcao', 'coordenacao'), false)
$$;

CREATE OR REPLACE FUNCTION private.eh_direcao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.papel_atual() = 'direcao', false)
$$;

-- Professor logado leciona alguma oferta nesta turma?
CREATE OR REPLACE FUNCTION private.professor_da_turma(p_turma uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ofertas o
    WHERE o.turma_id = p_turma AND o.professor_id = auth.uid() AND o.deleted_at IS NULL
  )
$$;

-- Turma da minha escola que eu posso ver (gestão: todas; professor: as suas).
CREATE OR REPLACE FUNCTION private.turma_visivel(p_turma uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = p_turma
      AND t.escola_id = private.escola_atual()
      AND (private.eh_gestao() OR private.professor_da_turma(t.id))
  )
$$;

-- Turma da minha escola e eu sou gestão.
CREATE OR REPLACE FUNCTION private.turma_gerenciavel(p_turma uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_gestao() AND EXISTS (
    SELECT 1 FROM public.turmas t WHERE t.id = p_turma AND t.escola_id = private.escola_atual()
  )
$$;

-- Oferta que posso editar (gestão da escola, ou o professor dono da oferta).
CREATE OR REPLACE FUNCTION private.oferta_editavel(p_oferta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ofertas o
    JOIN public.turmas t ON t.id = o.turma_id
    WHERE o.id = p_oferta
      AND t.escola_id = private.escola_atual()
      AND (private.eh_gestao() OR o.professor_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION private.turma_da_oferta(p_oferta uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.turma_id FROM public.ofertas o WHERE o.id = p_oferta
$$;

CREATE OR REPLACE FUNCTION private.oferta_da_atividade(p_atividade uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.oferta_id FROM public.atividades a WHERE a.id = p_atividade
$$;

CREATE OR REPLACE FUNCTION private.atividade_da_questao(p_questao uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT q.atividade_id FROM public.questoes q WHERE q.id = p_questao
$$;

CREATE OR REPLACE FUNCTION private.turma_do_aluno(p_aluno uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.turma_id FROM public.alunos a WHERE a.id = p_aluno
$$;

CREATE OR REPLACE FUNCTION private.escola_do_banco(p_banco uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT b.escola_id FROM public.banco_questoes b WHERE b.id = p_banco
$$;

-- Atalhos compostos usados nas políticas
CREATE OR REPLACE FUNCTION private.atividade_visivel(p_atividade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.turma_visivel(private.turma_da_oferta(private.oferta_da_atividade(p_atividade)))
$$;

CREATE OR REPLACE FUNCTION private.atividade_editavel(p_atividade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.oferta_editavel(private.oferta_da_atividade(p_atividade))
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Privilégios: anônimo sem nada; autenticado só passa pela RLS
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.escolas, public.perfis, public.periodos, public.disciplinas, public.turmas,
  public.ofertas, public.alunos, public.assuntos, public.banco_questoes,
  public.banco_alternativas, public.atividades, public.questoes, public.alternativas,
  public.respostas, public.avisos, public.aluno_observacoes
TO authenticated;
GRANT SELECT ON public.ia_geracoes TO authenticated;
-- aluno_credenciais, pin_tentativas, aluno_sessoes: nenhum privilégio (só funções SECURITY DEFINER).

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- -----------------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.escolas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofertas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_credenciais  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_tentativas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_sessoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assuntos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_questoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_alternativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alternativas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_geracoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_observacoes  ENABLE ROW LEVEL SECURITY;

-- escolas: toda a equipe lê a sua; só a direção edita. Criar/apagar escola: só service role.
CREATE POLICY escolas_select ON public.escolas FOR SELECT TO authenticated
  USING (id = private.escola_atual());
CREATE POLICY escolas_update ON public.escolas FOR UPDATE TO authenticated
  USING (id = private.escola_atual() AND private.eh_direcao())
  WITH CHECK (id = private.escola_atual() AND private.eh_direcao());

-- perfis: equipe da escola lê (nomes de professores). Escrita só pela Edge Function (service role).
CREATE POLICY perfis_select ON public.perfis FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual());

-- periodos, disciplinas, assuntos: leitura na escola; escrita pela gestão.
CREATE POLICY periodos_select ON public.periodos FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual());
CREATE POLICY periodos_write ON public.periodos FOR ALL TO authenticated
  USING (escola_id = private.escola_atual() AND private.eh_gestao())
  WITH CHECK (escola_id = private.escola_atual() AND private.eh_gestao());

CREATE POLICY disciplinas_select ON public.disciplinas FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual());
CREATE POLICY disciplinas_write ON public.disciplinas FOR ALL TO authenticated
  USING (escola_id = private.escola_atual() AND private.eh_gestao())
  WITH CHECK (escola_id = private.escola_atual() AND private.eh_gestao());

CREATE POLICY assuntos_select ON public.assuntos FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual());
CREATE POLICY assuntos_write ON public.assuntos FOR ALL TO authenticated
  USING (escola_id = private.escola_atual() AND (private.eh_gestao() OR private.papel_atual() = 'professor'))
  WITH CHECK (escola_id = private.escola_atual() AND (private.eh_gestao() OR private.papel_atual() = 'professor'));

-- turmas: gestão vê todas da escola; professor só as suas.
CREATE POLICY turmas_select ON public.turmas FOR SELECT TO authenticated
  USING (private.turma_visivel(id));
CREATE POLICY turmas_write ON public.turmas FOR ALL TO authenticated
  USING (escola_id = private.escola_atual() AND private.eh_gestao())
  WITH CHECK (escola_id = private.escola_atual() AND private.eh_gestao());

-- ofertas: lê quem vê a turma; escreve a gestão.
CREATE POLICY ofertas_select ON public.ofertas FOR SELECT TO authenticated
  USING (private.turma_visivel(turma_id));
CREATE POLICY ofertas_write ON public.ofertas FOR ALL TO authenticated
  USING (private.turma_gerenciavel(turma_id))
  WITH CHECK (private.turma_gerenciavel(turma_id));

-- alunos: lê quem vê a turma; escreve a gestão (PIN pela RPC/Edge Function da Fase 5.2).
CREATE POLICY alunos_select ON public.alunos FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual() AND private.turma_visivel(turma_id));
CREATE POLICY alunos_write ON public.alunos FOR ALL TO authenticated
  USING (escola_id = private.escola_atual() AND private.turma_gerenciavel(turma_id))
  WITH CHECK (escola_id = private.escola_atual() AND private.turma_gerenciavel(turma_id));

-- banco de questões: banco da escola é compartilhado (leitura); escreve o autor ou a gestão.
CREATE POLICY banco_select ON public.banco_questoes FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual());
CREATE POLICY banco_insert ON public.banco_questoes FOR INSERT TO authenticated
  WITH CHECK (escola_id = private.escola_atual() AND criado_por = auth.uid());
CREATE POLICY banco_update ON public.banco_questoes FOR UPDATE TO authenticated
  USING (escola_id = private.escola_atual() AND (criado_por = auth.uid() OR private.eh_gestao()))
  WITH CHECK (escola_id = private.escola_atual() AND (criado_por = auth.uid() OR private.eh_gestao()));
CREATE POLICY banco_delete ON public.banco_questoes FOR DELETE TO authenticated
  USING (escola_id = private.escola_atual() AND (criado_por = auth.uid() OR private.eh_gestao()));

CREATE POLICY banco_alt_select ON public.banco_alternativas FOR SELECT TO authenticated
  USING (private.escola_do_banco(banco_questao_id) = private.escola_atual());
CREATE POLICY banco_alt_write ON public.banco_alternativas FOR ALL TO authenticated
  USING (
    private.escola_do_banco(banco_questao_id) = private.escola_atual()
    AND EXISTS (SELECT 1 FROM public.banco_questoes b
                WHERE b.id = banco_questao_id AND (b.criado_por = auth.uid() OR private.eh_gestao())))
  WITH CHECK (
    private.escola_do_banco(banco_questao_id) = private.escola_atual()
    AND EXISTS (SELECT 1 FROM public.banco_questoes b
                WHERE b.id = banco_questao_id AND (b.criado_por = auth.uid() OR private.eh_gestao())));

-- atividades: lê quem vê a turma da oferta; escreve gestão ou professor dono da oferta.
CREATE POLICY atividades_select ON public.atividades FOR SELECT TO authenticated
  USING (private.turma_visivel(private.turma_da_oferta(oferta_id)));
CREATE POLICY atividades_insert ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (private.oferta_editavel(oferta_id) AND criado_por = auth.uid());
CREATE POLICY atividades_update ON public.atividades FOR UPDATE TO authenticated
  USING (private.oferta_editavel(oferta_id))
  WITH CHECK (private.oferta_editavel(oferta_id));
CREATE POLICY atividades_delete ON public.atividades FOR DELETE TO authenticated
  USING (private.oferta_editavel(oferta_id));

-- questoes e alternativas (com gabarito): só a equipe; o aluno só por RPC.
CREATE POLICY questoes_select ON public.questoes FOR SELECT TO authenticated
  USING (private.atividade_visivel(atividade_id));
CREATE POLICY questoes_write ON public.questoes FOR ALL TO authenticated
  USING (private.atividade_editavel(atividade_id))
  WITH CHECK (private.atividade_editavel(atividade_id));

CREATE POLICY alternativas_select ON public.alternativas FOR SELECT TO authenticated
  USING (private.atividade_visivel(private.atividade_da_questao(questao_id)));
CREATE POLICY alternativas_write ON public.alternativas FOR ALL TO authenticated
  USING (private.atividade_editavel(private.atividade_da_questao(questao_id)))
  WITH CHECK (private.atividade_editavel(private.atividade_da_questao(questao_id)));

-- respostas: a equipe lê as da sua turma e corrige (UPDATE) as das suas ofertas.
-- Sem INSERT/DELETE para a equipe: quem grava resposta é a RPC do aluno.
CREATE POLICY respostas_select ON public.respostas FOR SELECT TO authenticated
  USING (private.turma_visivel(private.turma_do_aluno(aluno_id)));
CREATE POLICY respostas_update ON public.respostas FOR UPDATE TO authenticated
  USING (private.atividade_editavel(private.atividade_da_questao(questao_id)))
  WITH CHECK (private.atividade_editavel(private.atividade_da_questao(questao_id)));
GRANT SELECT, UPDATE ON public.respostas TO authenticated;
REVOKE INSERT, DELETE ON public.respostas FROM authenticated;

-- avisos: a equipe lê os da escola; escreve a gestão (escola toda) ou o professor (suas turmas).
CREATE POLICY avisos_select ON public.avisos FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual());
CREATE POLICY avisos_insert ON public.avisos FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = private.escola_atual() AND autor_id = auth.uid()
    AND ((turma_id IS NULL AND private.eh_gestao())
         OR (turma_id IS NOT NULL AND private.turma_visivel(turma_id))));
CREATE POLICY avisos_update ON public.avisos FOR UPDATE TO authenticated
  USING (escola_id = private.escola_atual() AND (autor_id = auth.uid() OR private.eh_gestao()))
  WITH CHECK (escola_id = private.escola_atual() AND (autor_id = auth.uid() OR private.eh_gestao()));
CREATE POLICY avisos_delete ON public.avisos FOR DELETE TO authenticated
  USING (escola_id = private.escola_atual() AND (autor_id = auth.uid() OR private.eh_gestao()));

-- ia_geracoes: gestão vê da escola; professor vê as suas. Escrita só service role.
CREATE POLICY ia_select ON public.ia_geracoes FOR SELECT TO authenticated
  USING (escola_id = private.escola_atual() AND (private.eh_gestao() OR professor_id = auth.uid()));

-- observações: professores da turma + direção/coordenação (regra do produto).
CREATE POLICY obs_select ON public.aluno_observacoes FOR SELECT TO authenticated
  USING (private.turma_visivel(private.turma_do_aluno(aluno_id)));
CREATE POLICY obs_insert ON public.aluno_observacoes FOR INSERT TO authenticated
  WITH CHECK (private.turma_visivel(private.turma_do_aluno(aluno_id)) AND professor_id = auth.uid());
CREATE POLICY obs_update ON public.aluno_observacoes FOR UPDATE TO authenticated
  USING (private.turma_visivel(private.turma_do_aluno(aluno_id)) AND (professor_id = auth.uid() OR private.eh_gestao()))
  WITH CHECK (private.turma_visivel(private.turma_do_aluno(aluno_id)) AND (professor_id = auth.uid() OR private.eh_gestao()));
CREATE POLICY obs_delete ON public.aluno_observacoes FOR DELETE TO authenticated
  USING (private.turma_visivel(private.turma_do_aluno(aluno_id)) AND (professor_id = auth.uid() OR private.eh_gestao()));

-- aluno_credenciais, pin_tentativas, aluno_sessoes: RLS ligada e NENHUMA política = ninguém acessa pelo cliente.
