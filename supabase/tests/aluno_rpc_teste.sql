-- =============================================================================
-- SABERPONTUAL — TESTES DO PORTAL DO ALUNO (Fase 4)
--
-- Como rodar: SQL Editor do projeto Supabase de TESTE, DEPOIS das migrations 0003, 0004 e 0005.
-- Cola tudo e executa de uma vez. Igual ao rls_teste.sql: cria dados fictícios, simula o aluno
-- (papel anônimo, só com o token da sessão) e a equipe, confere o que cada um vê e, no fim,
-- lança um erro de propósito para desfazer tudo (nada fica gravado).
--
-- RESULTADO ESPERADO (aparece como erro em vermelho; é normal):
--     TODOS OS TESTES DO PORTAL DO ALUNO PASSARAM
-- Se algo falhar:  FALHOU: <nome do teste> ...
--
-- Para limpar as funções de teste depois:  DROP SCHEMA IF EXISTS zz_aluno CASCADE;
-- =============================================================================
DROP SCHEMA IF EXISTS zz_aluno CASCADE;
CREATE SCHEMA zz_aluno;

-- uuid de fixture a partir de um número (legibilidade)
CREATE FUNCTION zz_aluno.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
  SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$f$;

-- Executa `cmd` (um SELECT que devolve UM jsonb) como o usuário `uid` (null = anônimo).
-- Se o banco recusar, devolve {"__erro": mensagem, "__estado": sqlstate}.
CREATE FUNCTION zz_aluno.chamar(uid uuid, cmd text) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE r jsonb;
BEGIN
  IF uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', true);
    EXECUTE 'SET LOCAL ROLE anon';
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
  BEGIN
    EXECUTE cmd INTO r;
  EXCEPTION WHEN OTHERS THEN
    r := jsonb_build_object('__erro', SQLERRM, '__estado', SQLSTATE);
  END;
  EXECUTE 'RESET ROLE';
  RETURN r;
END $f$;

-- Executa um comando sem resultado (INSERT, função void) como `uid`. Devolve {"ok": true} ou o erro.
CREATE FUNCTION zz_aluno.chamar_void(uid uuid, cmd text) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE r jsonb;
BEGIN
  IF uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', true);
    EXECUTE 'SET LOCAL ROLE anon';
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
  BEGIN
    EXECUTE cmd;
    r := jsonb_build_object('ok', true);
  EXCEPTION WHEN OTHERS THEN
    r := jsonb_build_object('__erro', SQLERRM, '__estado', SQLSTATE);
  END;
  EXECUTE 'RESET ROLE';
  RETURN r;
END $f$;

CREATE FUNCTION zz_aluno.ok(nome text, condicao boolean, info text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF condicao IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FALHOU: %', nome || coalesce(' (' || left(info, 400) || ')', '');
  END IF;
END $f$;

-- O jsonb (em qualquer nível) tem a chave `k`?
CREATE FUNCTION zz_aluno.chave(j jsonb, k text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $f$
  SELECT jsonb_path_exists(j, ('$.**.' || k)::jsonpath)
$f$;

-- Questão `id` dentro do resultado de aluno_carregar_atividade
CREATE FUNCTION zz_aluno.questao(j jsonb, id uuid) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
  SELECT jsonb_path_query_first(j, '$.questoes[*] ? (@.id == $id)', jsonb_build_object('id', id::text))
$f$;

CREATE FUNCTION zz_aluno.erro_contem(j jsonb, trecho text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(j->>'__erro' ILIKE '%' || trecho || '%', false)
$f$;

CREATE FUNCTION zz_aluno.rodar() RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  j jsonb; j2 jsonb; qj jsonb; t1 text; t2 text; t1b text; v_n bigint;
  tok text;
  -- ids: ver zz_aluno.u(n)
  v_ex uuid := zz_aluno.u(1);
  v_dx uuid := zz_aluno.u(11); v_pa uuid := zz_aluno.u(12); v_pb uuid := zz_aluno.u(13);
  v_ta uuid := zz_aluno.u(21); v_tb uuid := zz_aluno.u(22); v_tc uuid := zz_aluno.u(23);
  v_a1 uuid := zz_aluno.u(31); v_a2 uuid := zz_aluno.u(32); v_b1 uuid := zz_aluno.u(33);
  v_c1 uuid := zz_aluno.u(34); v_a5 uuid := zz_aluno.u(35);
  v_disc uuid := zz_aluno.u(41); v_per uuid := zz_aluno.u(51);
  v_ofa uuid := zz_aluno.u(61); v_ofb uuid := zz_aluno.u(62);
  v_exa uuid := zz_aluno.u(71); v_pra uuid := zz_aluno.u(72); v_rasc uuid := zz_aluno.u(73);
  v_enc uuid := zz_aluno.u(74); v_ven uuid := zz_aluno.u(75); v_atb uuid := zz_aluno.u(76);
  q1 uuid := zz_aluno.u(81); q2 uuid := zz_aluno.u(82); q3 uuid := zz_aluno.u(83);
  p1 uuid := zz_aluno.u(84); p2 uuid := zz_aluno.u(85); qr uuid := zz_aluno.u(86);
  e1 uuid := zz_aluno.u(87); e2 uuid := zz_aluno.u(88); qv uuid := zz_aluno.u(89); qb uuid := zz_aluno.u(90);
  i int;
BEGIN
  -- ---------- fixtures (como postgres, ignora RLS) ----------
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_dx, 'authenticated', 'authenticated', 'dx@teste.local'),
    (v_pa, 'authenticated', 'authenticated', 'pa@teste.local'),
    (v_pb, 'authenticated', 'authenticated', 'pb@teste.local');
  INSERT INTO public.escolas (id, nome, cidade_uf) VALUES (v_ex, 'Escola X', 'Goiânia/GO');
  INSERT INTO public.perfis (id, escola_id, nome, email, papel) VALUES
    (v_dx, v_ex, 'Direção X', 'dx@teste.local', 'direcao'),
    (v_pa, v_ex, 'Prof A', 'pa@teste.local', 'professor'),
    (v_pb, v_ex, 'Prof B', 'pb@teste.local', 'professor');
  INSERT INTO public.turmas (id, escola_id, nome, serie, segmento, ano_letivo, codigo_acesso, ativa) VALUES
    (v_ta, v_ex, 'Turma A', '7', 'fund2', 2026, 'TESTE-A', true),
    (v_tb, v_ex, 'Turma B', '7', 'fund2', 2026, 'TESTE-B', true),
    (v_tc, v_ex, 'Turma C', '7', 'fund2', 2026, 'TESTE-C', false);
  INSERT INTO public.disciplinas (id, escola_id, nome) VALUES (v_disc, v_ex, 'Matemática');
  INSERT INTO public.periodos (id, escola_id, nome, ano_letivo, data_inicio, data_fim, ativo)
    VALUES (v_per, v_ex, '1º Bimestre', 2026, '2026-02-01', '2026-12-31', true);
  INSERT INTO public.ofertas (id, turma_id, disciplina_id, professor_id) VALUES
    (v_ofa, v_ta, v_disc, v_pa), (v_ofb, v_tb, v_disc, v_pb);
  INSERT INTO public.alunos (id, escola_id, turma_id, nome_completo, numero_chamada) VALUES
    (v_a1, v_ex, v_ta, 'Aluno 1', 1), (v_a2, v_ex, v_ta, 'Aluno 2', 2), (v_a5, v_ex, v_ta, 'Aluno 5 sem PIN', 3),
    (v_b1, v_ex, v_tb, 'Aluno B1', 1), (v_c1, v_ex, v_tc, 'Aluno C1', 1);
  INSERT INTO public.aluno_credenciais (aluno_id, pin_hash) VALUES
    (v_a1, crypt('1234', gen_salt('bf', 4))), (v_a2, crypt('5678', gen_salt('bf', 4))),
    (v_b1, crypt('1111', gen_salt('bf', 4))), (v_c1, crypt('2222', gen_salt('bf', 4)));

  INSERT INTO public.atividades (id, oferta_id, periodo_id, titulo, prazo, modo, status, criado_por) VALUES
    (v_exa, v_ofa, v_per, 'Exercício A', NULL, 'exercicio', 'publicada', v_pa),
    (v_pra, v_ofa, v_per, 'Prova A', NULL, 'prova', 'publicada', v_pa),
    (v_rasc, v_ofa, v_per, 'Rascunho A', NULL, 'exercicio', 'rascunho', v_pa),
    (v_enc, v_ofa, v_per, 'Prova encerrada A', NULL, 'prova', 'encerrada', v_pa),
    (v_ven, v_ofa, v_per, 'Exercício vencido A', (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1, 'exercicio', 'publicada', v_pa),
    (v_atb, v_ofb, v_per, 'Exercício B', NULL, 'exercicio', 'publicada', v_pb);
  INSERT INTO public.questoes (id, atividade_id, ordem, tipo, enunciado, explicacao, resposta_esperada) VALUES
    (q1, v_exa, 1, 'objetiva', 'Q1?', 'EXPL-81', NULL),
    (q2, v_exa, 2, 'objetiva', 'Q2?', 'EXPL-82', NULL),
    (q3, v_exa, 3, 'discursiva', 'Q3 discursiva?', 'EXPL-83', 'ESPERADA-83'),
    (p1, v_pra, 1, 'objetiva', 'P1?', 'EXPL-84', NULL),
    (p2, v_pra, 2, 'objetiva', 'P2?', 'EXPL-85', NULL),
    (qr, v_rasc, 1, 'objetiva', 'R1?', 'EXPL-86', NULL),
    (e1, v_enc, 1, 'objetiva', 'E1?', 'EXPL-87', NULL),
    (e2, v_enc, 2, 'objetiva', 'E2?', 'EXPL-88', NULL),
    (qv, v_ven, 1, 'objetiva', 'V1?', 'EXPL-89', NULL),
    (qb, v_atb, 1, 'objetiva', 'B1?', 'EXPL-90', NULL);
  -- Alternativas: certa = 1000+n (letra A), errada = 2000+n (letra B, com por_que_errou)
  INSERT INTO public.alternativas (id, questao_id, letra, texto, correta, por_que_errou)
  SELECT zz_aluno.u(1000 + n), zz_aluno.u(n), 'A', 'ALT-CERTA-' || n, true, NULL
    FROM unnest(ARRAY[81, 82, 84, 85, 86, 87, 88, 89, 90]) AS n;
  INSERT INTO public.alternativas (id, questao_id, letra, texto, correta, por_que_errou)
  SELECT zz_aluno.u(2000 + n), zz_aluno.u(n), 'B', 'ALT-ERRADA-' || n, false, 'PQE-' || n
    FROM unnest(ARRAY[81, 82, 84, 85, 86, 87, 88, 89, 90]) AS n;
  INSERT INTO public.avisos (escola_id, autor_id, turma_id, titulo, mensagem, publicado_em) VALUES
    (v_ex, v_dx, NULL, 'Aviso da escola', 'm', now() - interval '2 hours'),
    (v_ex, v_pa, v_ta, 'Recado turma A', 'm', now() - interval '1 hour'),
    (v_ex, v_pb, v_tb, 'Recado turma B', 'm', now());
  INSERT INTO public.avisos (escola_id, autor_id, turma_id, titulo, mensagem, deleted_at)
    VALUES (v_ex, v_dx, NULL, 'Aviso apagado', 'm', now());

  -- ---------- 1. Anônimo não toca nas tabelas do aluno ----------
  FOREACH tok IN ARRAY ARRAY['aluno_credenciais', 'pin_tentativas', 'aluno_sessoes', 'respostas', 'alternativas', 'questoes'] LOOP
    j := zz_aluno.chamar(NULL, format('select to_jsonb(count(*)) from public.%I', tok));
    PERFORM zz_aluno.ok('anon não lê ' || tok, j->>'__estado' = '42501', j::text);
  END LOOP;
  j := zz_aluno.chamar_void(NULL, format('insert into public.respostas (aluno_id, questao_id, acertou) values (%L, %L, true)', v_a1, q1));
  PERFORM zz_aluno.ok('anon não escreve em respostas', j->>'__estado' = '42501', j::text);
  j := zz_aluno.chamar_void(NULL, format('select public.definir_pin_aluno(%L, ''1234'')', v_a1));
  PERFORM zz_aluno.ok('anon não chama definir_pin_aluno', j->>'__estado' = '42501', j::text);

  -- ---------- 2. Código da turma e lista de nomes ----------
  j := zz_aluno.chamar(NULL, 'select public.aluno_listar_turma(''teste-a'')');
  PERFORM zz_aluno.ok('código da turma não diferencia maiúscula; lista os 3 alunos da turma A', jsonb_array_length(j) = 3, j::text);
  PERFORM zz_aluno.ok('lista na ordem de chamada', j->0->>'nome_completo' = 'Aluno 1', j::text);
  PERFORM zz_aluno.ok('lista não expõe PIN nem hash', NOT (zz_aluno.chave(j, 'pin_hash') OR zz_aluno.chave(j, 'pin')), j::text);
  j := zz_aluno.chamar(NULL, 'select public.aluno_listar_turma(''NAO-EXISTE'')');
  PERFORM zz_aluno.ok('código inexistente dá erro', zz_aluno.erro_contem(j, 'não encontrada'), j::text);
  j := zz_aluno.chamar(NULL, 'select public.aluno_listar_turma(''TESTE-C'')');
  PERFORM zz_aluno.ok('turma inativa não lista alunos', zz_aluno.erro_contem(j, 'não encontrada'), j::text);

  -- ---------- 3. Login: PIN em bcrypt e bloqueio por tentativas (aluno 2) ----------
  PERFORM zz_aluno.ok('PIN guardado em bcrypt',
    (SELECT pin_hash LIKE '$2%' FROM public.aluno_credenciais WHERE aluno_id = v_a2));
  FOR i IN 1..4 LOOP
    j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''0000'')', v_a2));
    PERFORM zz_aluno.ok('erro ' || i || ' de PIN: segue sem bloquear',
      (j->>'ok')::boolean = false AND (j->>'tentativas_restantes')::int = 5 - i AND j->>'__erro' IS NULL, j::text);
  END LOOP;
  PERFORM zz_aluno.ok('o contador de erros foi gravado (não desfeito pelo erro)',
    (SELECT tentativas FROM public.pin_tentativas WHERE aluno_id = v_a2) = 4);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''0000'')', v_a2));
  PERFORM zz_aluno.ok('5º erro bloqueia', (j->>'bloqueado')::boolean AND j->>'mensagem' ILIKE '%bloqueado%', j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''5678'')', v_a2));
  PERFORM zz_aluno.ok('PIN certo durante o bloqueio continua bloqueado', (j->>'ok')::boolean = false AND (j->>'bloqueado')::boolean, j::text);
  PERFORM zz_aluno.ok('nenhuma sessão criada durante o bloqueio',
    (SELECT count(*) FROM public.aluno_sessoes WHERE aluno_id = v_a2) = 0);
  UPDATE public.pin_tentativas SET bloqueado_ate = now() - interval '1 minute' WHERE aluno_id = v_a2;
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''5678'')', v_a2));
  PERFORM zz_aluno.ok('depois de 15 minutos o PIN certo entra', (j->>'ok')::boolean AND length(j->>'token') >= 60, j::text);
  t2 := j->>'token';
  PERFORM zz_aluno.ok('login zera tentativas',
    (SELECT tentativas = 0 AND bloqueado_ate IS NULL FROM public.pin_tentativas WHERE aluno_id = v_a2));
  PERFORM zz_aluno.ok('token puro não fica no banco; só o hash',
    (SELECT count(*) FROM public.aluno_sessoes WHERE token_hash = t2) = 0
    AND (SELECT count(*) FROM public.aluno_sessoes WHERE token_hash = encode(sha256(convert_to(t2, 'UTF8')), 'hex')) = 1);

  -- janela de 15 minutos: erros antigos não contam
  FOR i IN 1..3 LOOP
    PERFORM zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''0000'')', v_b1));
  END LOOP;
  ALTER TABLE public.pin_tentativas DISABLE TRIGGER trg_updated_at;
  UPDATE public.pin_tentativas SET updated_at = now() - interval '20 minutes' WHERE aluno_id = v_b1;
  ALTER TABLE public.pin_tentativas ENABLE TRIGGER trg_updated_at;
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''0000'')', v_b1));
  PERFORM zz_aluno.ok('erros com mais de 15 min não contam', (j->>'tentativas_restantes')::int = 4, j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''abcd'')', v_a5));
  PERFORM zz_aluno.ok('aluno sem PIN cadastrado não entra', (j->>'ok')::boolean = false AND (j->>'sem_pin')::boolean, j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''2222'')', v_c1));
  PERFORM zz_aluno.ok('aluno de turma inativa não entra', zz_aluno.erro_contem(j, 'turma está inativa'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''1234'')', zz_aluno.u(999)));
  PERFORM zz_aluno.ok('aluno inexistente dá erro', zz_aluno.erro_contem(j, 'Aluno não encontrado'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''12'')', v_a1));
  PERFORM zz_aluno.ok('PIN fora do formato conta como erro', (j->>'ok')::boolean = false AND (j->>'tentativas_restantes')::int = 4, j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''1234'')', v_a1));
  PERFORM zz_aluno.ok('aluno 1 entra com o PIN certo', (j->>'ok')::boolean, j::text);
  t1 := j->>'token';
  PERFORM zz_aluno.ok('login devolve só id, nome e chamada do aluno',
    (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(j->'aluno') k) = ARRAY['id', 'nome_completo', 'numero_chamada']);

  -- ---------- 4. Sessão: inválida, expirada, revogada, aluno/turma inativos ----------
  FOREACH tok IN ARRAY ARRAY[
    format('select public.aluno_atividades(%L)', 'token-invalido-com-mais-de-20-caracteres'),
    format('select public.aluno_avisos(%L)', ''),
    format('select public.aluno_meu_desempenho(%L)', 'x'),
    format('select public.aluno_carregar_atividade(%L, %L)', 'token-invalido-com-mais-de-20-caracteres', v_exa),
    format('select public.aluno_responder(%L, %L, %L)', 'token-invalido-com-mais-de-20-caracteres', q1, zz_aluno.u(1081)),
    format('select public.aluno_resultado_prova(%L, %L)', 'token-invalido-com-mais-de-20-caracteres', v_pra)
  ] LOOP
    j := zz_aluno.chamar(NULL, tok);
    PERFORM zz_aluno.ok('token inválido é recusado: ' || left(tok, 40), zz_aluno.erro_contem(j, 'Sessão expirada'), j::text);
  END LOOP;

  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''1234'')', v_a1));
  t1b := j->>'token';
  UPDATE public.aluno_sessoes SET expira_em = now() - interval '1 minute'
    WHERE token_hash = encode(sha256(convert_to(t1b, 'UTF8')), 'hex');
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t1b));
  PERFORM zz_aluno.ok('sessão expirada é recusada', zz_aluno.erro_contem(j, 'Sessão expirada'), j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''1234'')', v_a1));
  t1b := j->>'token';
  PERFORM zz_aluno.chamar(NULL, format('select to_jsonb(1) from (select public.aluno_sair(%L)) s', t1b));
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t1b));
  PERFORM zz_aluno.ok('sessão revogada (aluno_sair) é recusada', zz_aluno.erro_contem(j, 'Sessão expirada'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t1));
  PERFORM zz_aluno.ok('sair numa sessão não derruba as outras', jsonb_typeof(j) = 'array', j::text);

  UPDATE public.alunos SET ativo = false WHERE id = v_a2;
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t2));
  PERFORM zz_aluno.ok('aluno desativado perde a sessão na hora', zz_aluno.erro_contem(j, 'Sessão expirada'), j::text);
  UPDATE public.alunos SET ativo = true WHERE id = v_a2;
  UPDATE public.turmas SET ativa = false WHERE id = v_ta;
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t2));
  PERFORM zz_aluno.ok('turma desativada derruba a sessão', zz_aluno.erro_contem(j, 'Sessão expirada'), j::text);
  UPDATE public.turmas SET ativa = true WHERE id = v_ta;
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t2));
  PERFORM zz_aluno.ok('turma reativada: a sessão volta a valer', jsonb_typeof(j) = 'array', j::text);

  -- ---------- 5. Painel de atividades ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_atividades(%L)', t1));
  PERFORM zz_aluno.ok('painel mostra 4 atividades (sem rascunho e sem a da turma B)', jsonb_array_length(j) = 4, j::text);
  PERFORM zz_aluno.ok('rascunho não aparece', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Rascunho A'), j::text);
  PERFORM zz_aluno.ok('atividade da turma B não aparece', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Exercício B'), j::text);
  PERFORM zz_aluno.ok('prazo vencido marcado',
    (SELECT (e->>'prazo_vencido')::boolean FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Exercício vencido A'), j::text);
  PERFORM zz_aluno.ok('atividade aberta: sem aproveitamento, não concluída',
    (SELECT NOT (e ? 'aproveitamento') AND NOT (e->>'concluida')::boolean AND (e->>'total_questoes')::int = 3
       FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Exercício A'), j::text);
  PERFORM zz_aluno.ok('encerrada sem respostas: aproveitamento 0',
    (SELECT (e->>'aproveitamento')::int = 0 FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Prova encerrada A'), j::text);
  PERFORM zz_aluno.ok('painel não vaza gabarito', NOT (zz_aluno.chave(j, 'correta') OR zz_aluno.chave(j, 'explicacao')), j::text);

  -- ---------- 6. Carregar atividade: gabarito protegido ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_exa));
  PERFORM zz_aluno.ok('carrega o exercício com 3 questões', jsonb_array_length(j->'questoes') = 3, j::text);
  PERFORM zz_aluno.ok('questão não respondida NÃO traz gabarito, motivo, explicação nem resposta esperada',
    NOT (zz_aluno.chave(j, 'correta') OR zz_aluno.chave(j, 'por_que_errou') OR zz_aluno.chave(j, 'explicacao')
      OR zz_aluno.chave(j, 'alternativa_correta_id') OR zz_aluno.chave(j, 'acertou') OR zz_aluno.chave(j, 'resposta_esperada')), j::text);
  PERFORM zz_aluno.ok('alternativas têm só id, letra e texto',
    (SELECT array_agg(DISTINCT k ORDER BY k) FROM jsonb_path_query(j, '$.questoes[*].alternativas[*]') a, jsonb_object_keys(a) k) = ARRAY['id', 'letra', 'texto']);
  PERFORM zz_aluno.ok('o texto do JSON não contém os textos de explicação',
    position('EXPL-' IN j::text) = 0 AND position('PQE-' IN j::text) = 0 AND position('ESPERADA' IN j::text) = 0, j::text);
  j2 := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_atb));
  PERFORM zz_aluno.ok('atividade de outra turma é recusada', zz_aluno.erro_contem(j2, 'não pertence à sua turma'), j2::text);
  j2 := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_rasc));
  PERFORM zz_aluno.ok('rascunho é indisponível', zz_aluno.erro_contem(j2, 'indisponível'), j2::text);
  j2 := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, zz_aluno.u(998)));
  PERFORM zz_aluno.ok('atividade inexistente dá erro', zz_aluno.erro_contem(j2, 'não encontrada'), j2::text);
  j2 := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_enc));
  PERFORM zz_aluno.ok('atividade encerrada libera o gabarito das questões não respondidas',
    zz_aluno.chave(j2, 'alternativa_correta_id') AND NOT zz_aluno.chave(j2, 'por_que_errou'), j2::text);

  -- ---------- 7. Responder (exercício) e tentar novamente ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, q1, zz_aluno.u(2081)));
  PERFORM zz_aluno.ok('exercício: errou e recebe o feedback na hora',
    j->>'modo' = 'exercicio' AND (j->>'acertou')::boolean = false AND j->>'alternativa_correta_id' = zz_aluno.u(1081)::text
    AND j->>'por_que_errou' = 'PQE-81' AND j->>'explicacao' = 'EXPL-81', j::text);
  PERFORM zz_aluno.ok('1ª resposta gravada',
    (SELECT acertou = false AND tentativas = 1 AND acertou_final = false AND alternativa_id = zz_aluno.u(2081)
       FROM public.respostas WHERE aluno_id = v_a1 AND questao_id = q1));
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, q1, zz_aluno.u(1081)));
  PERFORM zz_aluno.ok('resposta é definitiva: não responde de novo', zz_aluno.erro_contem(j, 'já foi respondida'), j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_exa));
  qj := zz_aluno.questao(j, q1);
  PERFORM zz_aluno.ok('depois de responder, a questão 1 mostra o feedback',
    qj->>'alternativa_correta_id' = zz_aluno.u(1081)::text AND qj->>'explicacao' = 'EXPL-81' AND qj->>'por_que_errou' = 'PQE-81', qj::text);
  qj := zz_aluno.questao(j, q2);
  PERFORM zz_aluno.ok('a questão 2, ainda não respondida, continua sem gabarito',
    NOT (qj ? 'alternativa_correta_id' OR qj ? 'explicacao' OR qj ? 'por_que_errou' OR qj ? 'acertou'), qj::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_tentar_novamente(%L, %L, %L)', t1, q2, zz_aluno.u(1082)));
  PERFORM zz_aluno.ok('tentar novamente sem ter respondido dá erro', zz_aluno.erro_contem(j, 'ainda não foi respondida'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, q2, zz_aluno.u(1081)));
  PERFORM zz_aluno.ok('alternativa de outra questão é inválida', zz_aluno.erro_contem(j, 'inválida'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, q3, zz_aluno.u(1081)));
  PERFORM zz_aluno.ok('questão discursiva não aceita alternativa', zz_aluno.erro_contem(j, 'discursiva'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, qb, zz_aluno.u(1090)));
  PERFORM zz_aluno.ok('questão de outra turma é recusada', zz_aluno.erro_contem(j, 'não pertence'), j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_tentar_novamente(%L, %L, %L)', t1, q1, zz_aluno.u(2081)));
  PERFORM zz_aluno.ok('tentar novamente: errou de novo', (j->>'acertou')::boolean = false, j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_tentar_novamente(%L, %L, %L)', t1, q1, zz_aluno.u(1081)));
  PERFORM zz_aluno.ok('tentar novamente: acertou', (j->>'acertou')::boolean, j::text);
  PERFORM zz_aluno.ok('a 1ª resposta e a nota original NÃO mudam; só tentativas e acertou_final',
    (SELECT acertou = false AND alternativa_id = zz_aluno.u(2081) AND tentativas = 3 AND acertou_final = true
       FROM public.respostas WHERE aluno_id = v_a1 AND questao_id = q1));
  j := zz_aluno.chamar(NULL, format('select public.aluno_tentar_novamente(%L, %L, %L)', t1, q1, zz_aluno.u(1081)));
  PERFORM zz_aluno.ok('quem já acertou não tenta de novo', zz_aluno.erro_contem(j, 'já acertou'), j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, q2, zz_aluno.u(1082)));
  PERFORM zz_aluno.ok('questão 2 certa de primeira', (j->>'acertou')::boolean AND j->>'por_que_errou' IS NULL, j::text);

  -- ---------- 8. Discursiva ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder_discursiva(%L, %L, %L)', t1, q3, '   '));
  PERFORM zz_aluno.ok('discursiva vazia é recusada', zz_aluno.erro_contem(j, 'vazia'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder_discursiva(%L, %L, %L)', t1, q3, repeat('x', 2001)));
  PERFORM zz_aluno.ok('discursiva com mais de 2000 caracteres é recusada', zz_aluno.erro_contem(j, '2000'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder_discursiva(%L, %L, %L)', t1, q1, 'texto'));
  PERFORM zz_aluno.ok('responder_discursiva em objetiva dá erro', zz_aluno.erro_contem(j, 'já respondida') OR zz_aluno.erro_contem(j, 'não é discursiva'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder_discursiva(%L, %L, %L)', t1, q3, '  Minha resposta  '));
  PERFORM zz_aluno.ok('discursiva registrada (exercício devolve a explicação)',
    (j->>'registrada')::boolean AND j->>'explicacao' = 'EXPL-83', j::text);
  PERFORM zz_aluno.ok('discursiva gravada como pendente, sem nota',
    (SELECT correcao = 'pendente' AND pontuacao IS NULL AND texto_resposta = 'Minha resposta' AND acertou IS NULL
       FROM public.respostas WHERE aluno_id = v_a1 AND questao_id = q3));
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder_discursiva(%L, %L, %L)', t1, q3, 'outra'));
  PERFORM zz_aluno.ok('discursiva também é definitiva', zz_aluno.erro_contem(j, 'já respondida'), j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_atividades(%L)', t1));
  PERFORM zz_aluno.ok('com discursiva pendente: aguardando correção e fora da média',
    (SELECT (e->>'aguardando_correcao')::boolean AND (e->>'concluida')::boolean AND NOT (e ? 'aproveitamento')
       FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Exercício A'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_exa));
  qj := zz_aluno.questao(j, q3);
  PERFORM zz_aluno.ok('discursiva pendente não mostra a resposta esperada', NOT (qj ? 'resposta_esperada') AND qj->>'correcao' = 'pendente', qj::text);

  -- a professora corrige com nota 75 (como a equipe, ignorando RLS aqui; a RLS já é testada no outro arquivo)
  UPDATE public.respostas SET correcao = 'parcial', pontuacao = 75, corrigido_por = v_pa, corrigido_em = now()
    WHERE aluno_id = v_a1 AND questao_id = q3;
  j := zz_aluno.chamar(NULL, format('select public.aluno_atividades(%L)', t1));
  PERFORM zz_aluno.ok('discursiva corrigida entra: (0 + 1 + 0,75) / 3 = 58%',
    (SELECT (e->>'aproveitamento')::int = 58 AND NOT (e->>'aguardando_correcao')::boolean
       FROM jsonb_array_elements(j) e WHERE e->>'titulo' = 'Exercício A'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_exa));
  qj := zz_aluno.questao(j, q3);
  PERFORM zz_aluno.ok('corrigida: mostra nota e resposta esperada', (qj->>'nota')::int = 75 AND qj->>'resposta_esperada' = 'ESPERADA-83', qj::text);

  -- ---------- 9. Prova: sigilo até terminar ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, p1, zz_aluno.u(1084)));
  PERFORM zz_aluno.ok('prova: só confirma o registro, sem dizer se acertou', j = '{"modo": "prova", "registrada": true}'::jsonb, j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_pra));
  PERFORM zz_aluno.ok('prova incompleta: nenhum feedback, nem da questão já respondida',
    zz_aluno.questao(j, p1) ? 'respondida'
    AND NOT (zz_aluno.chave(j, 'acertou') OR zz_aluno.chave(j, 'alternativa_correta_id') OR zz_aluno.chave(j, 'por_que_errou')
      OR zz_aluno.chave(j, 'explicacao') OR zz_aluno.chave(j, 'acertou_final')), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_resultado_prova(%L, %L)', t1, v_pra));
  PERFORM zz_aluno.ok('resultado da prova incompleta é bloqueado', zz_aluno.erro_contem(j, 'Termine todas'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_tentar_novamente(%L, %L, %L)', t1, p1, zz_aluno.u(1084)));
  PERFORM zz_aluno.ok('prova não tem tentar novamente', zz_aluno.erro_contem(j, 'apenas no modo exercício'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_resultado_prova(%L, %L)', t1, v_exa));
  PERFORM zz_aluno.ok('resultado de prova só vale para prova', zz_aluno.erro_contem(j, 'modo prova'), j::text);

  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, p2, zz_aluno.u(2085)));
  PERFORM zz_aluno.ok('última questão da prova (errada) também só registra', j->>'registrada' = 'true' AND NOT (j ? 'acertou'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_resultado_prova(%L, %L)', t1, v_pra));
  PERFORM zz_aluno.ok('prova completa: resultado 1 de 2 = 50%',
    (j->>'total_questoes')::int = 2 AND (j->>'acertos')::numeric = 1 AND (j->>'erros')::int = 1 AND (j->>'aproveitamento')::int = 50, j::text);
  PERFORM zz_aluno.ok('resultado traz a correção de cada questão',
    zz_aluno.chave(j, 'alternativa_correta_id') AND position('PQE-85' IN j::text) > 0 AND position('EXPL-84' IN j::text) > 0, j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t1, v_pra));
  PERFORM zz_aluno.ok('prova completa: agora o feedback aparece', zz_aluno.chave(j, 'alternativa_correta_id') AND zz_aluno.chave(j, 'explicacao'), j::text);

  -- ---------- 10. Prazo e atividade encerrada ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, qv, zz_aluno.u(1089)));
  PERFORM zz_aluno.ok('prazo vencido não aceita resposta', zz_aluno.erro_contem(j, 'prazo'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, e1, zz_aluno.u(1087)));
  PERFORM zz_aluno.ok('atividade encerrada não aceita resposta', zz_aluno.erro_contem(j, 'encerrada'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_responder(%L, %L, %L)', t1, qr, zz_aluno.u(1086)));
  PERFORM zz_aluno.ok('rascunho não aceita resposta', zz_aluno.erro_contem(j, 'indisponível'), j::text);

  -- ---------- 11. Meu desempenho ----------
  -- Matemática: Exercício A 1,75/3 + Prova A 1/2 + Prova encerrada A 0/2 = 2,75/7 = 39,3% (Atenção)
  j := zz_aluno.chamar(NULL, format('select public.aluno_meu_desempenho(%L)', t1));
  PERFORM zz_aluno.ok('desempenho: 3 atividades avaliadas, média 39,3 e faixa Atenção',
    (j->'disciplinas'->0->>'atividades_concluidas')::int = 3 AND (j->'disciplinas'->0->>'media_periodo')::numeric = 39.3
    AND j->'disciplinas'->0->>'faixa' = 'Atenção' AND j->'disciplinas'->0->>'professor_nome' = 'Prof A', j::text);
  PERFORM zz_aluno.ok('desempenho traz aluno, turma e período, sem hash de PIN',
    j->'aluno'->>'nome_completo' = 'Aluno 1' AND j->'turma'->>'nome' = 'Turma A' AND j->'periodo_atual'->>'nome' = '1º Bimestre'
    AND NOT zz_aluno.chave(j, 'pin_hash'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_meu_desempenho(%L)', t2));
  PERFORM zz_aluno.ok('aluno 2 (sem respostas): média só da encerrada = 0%',
    (j->'disciplinas'->0->>'media_periodo')::numeric = 0 AND (j->'disciplinas'->0->>'atividades_concluidas')::int = 1, j::text);

  -- ---------- 12. Isolamento entre alunos ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_carregar_atividade(%L, %L)', t2, v_exa));
  PERFORM zz_aluno.ok('aluno 2 não vê as respostas do aluno 1',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'questoes') e WHERE (e->>'respondida')::boolean)
    AND NOT (zz_aluno.chave(j, 'alternativa_correta_id') OR zz_aluno.chave(j, 'explicacao')), j::text);

  -- ---------- 13. Avisos ----------
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t1));
  PERFORM zz_aluno.ok('avisos: escola + turma A (sem turma B e sem apagado), do mais novo ao mais antigo',
    jsonb_array_length(j) = 2 AND j->0->>'titulo' = 'Recado turma A' AND j->1->>'titulo' = 'Aviso da escola', j::text);

  -- ---------- 14. PIN definido pela equipe ----------
  j := zz_aluno.chamar_void(v_pb, format('select public.definir_pin_aluno(%L, ''4321'')', v_a1));
  PERFORM zz_aluno.ok('professor de outra turma não define PIN', zz_aluno.erro_contem(j, 'sem permissão'), j::text);
  j := zz_aluno.chamar_void(v_pa, format('select public.definir_pin_aluno(%L, ''12a4'')', v_a1));
  PERFORM zz_aluno.ok('PIN precisa ter 4 dígitos', zz_aluno.erro_contem(j, '4 dígitos'), j::text);
  j := zz_aluno.chamar_void(v_pa, format('select public.definir_pin_aluno(%L, ''4321'')', v_a1));
  PERFORM zz_aluno.ok('professor da turma define o PIN', (j->>'ok')::boolean, j::text);
  PERFORM zz_aluno.ok('hash novo em bcrypt, nunca o PIN puro',
    (SELECT pin_hash LIKE '$2%' AND pin_hash <> '4321' FROM public.aluno_credenciais WHERE aluno_id = v_a1));
  j := zz_aluno.chamar(NULL, format('select public.aluno_avisos(%L)', t1));
  PERFORM zz_aluno.ok('trocar o PIN encerra as sessões antigas', zz_aluno.erro_contem(j, 'Sessão expirada'), j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''1234'')', v_a1));
  PERFORM zz_aluno.ok('PIN antigo não entra mais', (j->>'ok')::boolean = false, j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''4321'')', v_a1));
  PERFORM zz_aluno.ok('PIN novo entra', (j->>'ok')::boolean, j::text);
  j := zz_aluno.chamar_void(v_dx, format('select public.definir_pin_aluno(%L, ''1111'')', v_a5));
  PERFORM zz_aluno.ok('direção cria PIN de aluno que ainda não tinha', (j->>'ok')::boolean, j::text);
  j := zz_aluno.chamar(NULL, format('select public.aluno_login(%L, ''1111'')', v_a5));
  PERFORM zz_aluno.ok('aluno com PIN recém-criado entra', (j->>'ok')::boolean, j::text);
  j := zz_aluno.chamar(v_dx, 'select to_jsonb(count(*)) from public.aluno_credenciais');
  PERFORM zz_aluno.ok('nem a direção lê o hash do PIN', j->>'__estado' = '42501', j::text);

  RAISE EXCEPTION 'TODOS OS TESTES DO PORTAL DO ALUNO PASSARAM';
END $f$;

SELECT zz_aluno.rodar();
