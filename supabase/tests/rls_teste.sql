-- =============================================================================
-- SABERPONTUAL — TESTES DE RLS (Fase 2.5)
--
-- Como rodar: SQL Editor do projeto Supabase de TESTE, DEPOIS das migrations 0003 e 0004.
-- Cola tudo e executa de uma vez. O script cria funções de teste (schema zz_teste),
-- roda, e a função SE DESFAZ sozinha: ela cria dados fictícios, simula cada
-- usuário, confere o que cada um enxerga/altera e, no fim, lança um erro de
-- propósito para desfazer tudo (nada fica gravado).
--
-- RESULTADO ESPERADO (aparece como erro em vermelho; é normal):
--     TODOS OS TESTES DE RLS PASSARAM
-- Se algo falhar:  FALHOU: <nome do teste> (obtido X, esperado Y)
--
-- Depois, rode o arquivo de novo só se quiser repetir; para limpar as funções:
--     DROP SCHEMA IF EXISTS zz_teste CASCADE;
-- =============================================================================
DROP SCHEMA IF EXISTS zz_teste CASCADE;
CREATE SCHEMA zz_teste;

-- Roda um comando como o usuário `uid` (null = anônimo). Devolve nº de linhas (SELECT:
-- count(*) do resultado) ou -1 se o banco negou (42501: sem privilégio ou violação de RLS).
CREATE FUNCTION zz_teste.como(uid uuid, cmd text) RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  IF uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', true);
    EXECUTE 'SET LOCAL ROLE anon';
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
  BEGIN
    IF lower(ltrim(cmd)) LIKE 'select%' THEN
      EXECUTE 'SELECT count(*) FROM (' || cmd || ') s' INTO n;
    ELSE
      EXECUTE cmd;
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    n := -1;
  END;
  EXECUTE 'RESET ROLE';
  RETURN n;
END $f$;

CREATE FUNCTION zz_teste.confere(nome text, obtido bigint, esperado bigint) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF obtido IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'FALHOU: % (obtido %, esperado %)', nome, obtido, esperado;
  END IF;
END $f$;

CREATE FUNCTION zz_teste.rodar() RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  t text;
  -- escola X (ex) e Y (ey); usuários: direção X, coordenação X, professor A, professor B, direção Y
  v_ex uuid := '00000000-0000-0000-0000-0000000000e1';
  v_ey uuid := '00000000-0000-0000-0000-0000000000e2';
  v_dx uuid := '00000000-0000-0000-0000-0000000000d1';
  v_cx uuid := '00000000-0000-0000-0000-0000000000c1';
  v_pa uuid := '00000000-0000-0000-0000-0000000000a1';
  v_pb uuid := '00000000-0000-0000-0000-0000000000b1';
  v_dy uuid := '00000000-0000-0000-0000-0000000000d2';
  v_ta uuid := '00000000-0000-0000-0000-00000000aa01';
  v_tb uuid := '00000000-0000-0000-0000-00000000bb01';
  v_ty uuid := '00000000-0000-0000-0000-00000000cc01';
  v_aluno_a uuid := '00000000-0000-0000-0000-00000000a0a1';
  v_aluno_b uuid := '00000000-0000-0000-0000-00000000b0b1';
  v_aluno_y uuid := '00000000-0000-0000-0000-00000000c0c1';
  v_of_a uuid := '00000000-0000-0000-0000-0000000f0a01';
  v_of_b uuid := '00000000-0000-0000-0000-0000000f0b01';
  v_at_a uuid := '00000000-0000-0000-0000-000000a70a01';
  v_at_b uuid := '00000000-0000-0000-0000-000000a70b01';
  v_q_a uuid := '00000000-0000-0000-0000-00000009a001';
  v_q_b uuid := '00000000-0000-0000-0000-00000009b001';
  v_disc_x uuid := '00000000-0000-0000-0000-0000000d0001';
  v_per_x uuid := '00000000-0000-0000-0000-0000000e0001';
BEGIN
  -- ---------- fixtures (como postgres, ignora RLS) ----------
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (v_dx, 'authenticated', 'authenticated', 'dx@teste.local'),
    (v_cx, 'authenticated', 'authenticated', 'cx@teste.local'),
    (v_pa, 'authenticated', 'authenticated', 'pa@teste.local'),
    (v_pb, 'authenticated', 'authenticated', 'pb@teste.local'),
    (v_dy, 'authenticated', 'authenticated', 'dy@teste.local');

  INSERT INTO public.escolas (id, nome, cidade_uf) VALUES
    (v_ex, 'Escola X', 'Goiânia/GO'), (v_ey, 'Escola Y', 'Goiânia/GO');

  INSERT INTO public.perfis (id, escola_id, nome, email, papel) VALUES
    (v_dx, v_ex, 'Direção X', 'dx@teste.local', 'direcao'),
    (v_cx, v_ex, 'Coord X', 'cx@teste.local', 'coordenacao'),
    (v_pa, v_ex, 'Prof A', 'pa@teste.local', 'professor'),
    (v_pb, v_ex, 'Prof B', 'pb@teste.local', 'professor'),
    (v_dy, v_ey, 'Direção Y', 'dy@teste.local', 'direcao');

  INSERT INTO public.turmas (id, escola_id, nome, serie, segmento, ano_letivo, codigo_acesso) VALUES
    (v_ta, v_ex, 'Turma A', '7', 'fund2', 2026, 'TESTE-A'),
    (v_tb, v_ex, 'Turma B', '7', 'fund2', 2026, 'TESTE-B'),
    (v_ty, v_ey, 'Turma Y', '7', 'fund2', 2026, 'TESTE-Y');

  INSERT INTO public.disciplinas (id, escola_id, nome) VALUES (v_disc_x, v_ex, 'Matemática');
  INSERT INTO public.periodos (id, escola_id, nome, ano_letivo, data_inicio, data_fim, ativo)
    VALUES (v_per_x, v_ex, '1º Bimestre', 2026, '2026-02-01', '2026-04-30', true);

  INSERT INTO public.ofertas (id, turma_id, disciplina_id, professor_id) VALUES
    (v_of_a, v_ta, v_disc_x, v_pa),
    (v_of_b, v_tb, v_disc_x, v_pb);

  INSERT INTO public.alunos (id, escola_id, turma_id, nome_completo, numero_chamada) VALUES
    (v_aluno_a, v_ex, v_ta, 'Aluno A', 1),
    (v_aluno_b, v_ex, v_tb, 'Aluno B', 1),
    (v_aluno_y, v_ey, v_ty, 'Aluno Y', 1);
  INSERT INTO public.aluno_credenciais (aluno_id, pin_hash)
    VALUES (v_aluno_a, 'hash-de-teste');

  INSERT INTO public.atividades (id, oferta_id, periodo_id, titulo, criado_por, status) VALUES
    (v_at_a, v_of_a, v_per_x, 'Atividade A', v_pa, 'publicada'),
    (v_at_b, v_of_b, v_per_x, 'Atividade B', v_pb, 'publicada');
  INSERT INTO public.questoes (id, atividade_id, ordem, enunciado) VALUES
    (v_q_a, v_at_a, 1, '1+1?'), (v_q_b, v_at_b, 1, '2+2?');
  INSERT INTO public.alternativas (questao_id, letra, texto, correta) VALUES
    (v_q_a, 'A', '2', true), (v_q_b, 'A', '4', true);
  INSERT INTO public.respostas (aluno_id, questao_id, acertou) VALUES
    (v_aluno_a, v_q_a, true), (v_aluno_b, v_q_b, true);

  -- ---------- 1. Anônimo não acessa nenhuma tabela ----------
  FOREACH t IN ARRAY ARRAY['escolas','perfis','periodos','disciplinas','turmas','ofertas','alunos',
    'aluno_credenciais','pin_tentativas','aluno_sessoes','assuntos','banco_questoes','banco_alternativas',
    'atividades','questoes','alternativas','respostas','avisos','ia_geracoes','aluno_observacoes']
  LOOP
    PERFORM zz_teste.confere('anon não lê ' || t, zz_teste.como(NULL, 'select * from public.' || t), -1);
  END LOOP;
  PERFORM zz_teste.confere('anon não lê alternativas (gabarito)',
    zz_teste.como(NULL, 'select correta from public.alternativas'), -1);

  -- ---------- 2. Tabelas só de RPC: nem a equipe lê ----------
  PERFORM zz_teste.confere('direção não lê aluno_credenciais (PIN)', zz_teste.como(v_dx, 'select * from public.aluno_credenciais'), -1);
  PERFORM zz_teste.confere('professor não lê aluno_sessoes', zz_teste.como(v_pa, 'select * from public.aluno_sessoes'), -1);
  PERFORM zz_teste.confere('professor não lê pin_tentativas', zz_teste.como(v_pa, 'select * from public.pin_tentativas'), -1);
  PERFORM zz_teste.confere('anon não chama função private', zz_teste.como(NULL, 'select private.escola_atual()'), -1);

  -- ---------- 3. Professor A: só a sua turma ----------
  PERFORM zz_teste.confere('prof A vê 1 turma', zz_teste.como(v_pa, 'select * from public.turmas'), 1);
  PERFORM zz_teste.confere('prof A vê 1 aluno', zz_teste.como(v_pa, 'select * from public.alunos'), 1);
  PERFORM zz_teste.confere('prof A vê 1 oferta', zz_teste.como(v_pa, 'select * from public.ofertas'), 1);
  PERFORM zz_teste.confere('prof A vê 1 atividade', zz_teste.como(v_pa, 'select * from public.atividades'), 1);
  PERFORM zz_teste.confere('prof A vê 1 questão', zz_teste.como(v_pa, 'select * from public.questoes'), 1);
  PERFORM zz_teste.confere('prof A vê 1 alternativa', zz_teste.como(v_pa, 'select * from public.alternativas'), 1);
  PERFORM zz_teste.confere('prof A vê 1 resposta', zz_teste.como(v_pa, 'select * from public.respostas'), 1);
  PERFORM zz_teste.confere('prof A não vê a turma B', zz_teste.como(v_pa, format('select * from public.turmas where id = %L', v_tb)), 0);
  PERFORM zz_teste.confere('prof A não altera atividade da turma B',
    zz_teste.como(v_pa, format('update public.atividades set titulo = ''hack'' where id = %L', v_at_b)), 0);
  PERFORM zz_teste.confere('prof A não apaga atividade da turma B',
    zz_teste.como(v_pa, format('delete from public.atividades where id = %L', v_at_b)), 0);
  PERFORM zz_teste.confere('prof A não cria atividade na oferta da turma B',
    zz_teste.como(v_pa, format('insert into public.atividades (oferta_id, periodo_id, titulo, criado_por) values (%L, %L, ''x'', %L)', v_of_b, v_per_x, v_pa)), -1);
  PERFORM zz_teste.confere('prof A cria atividade na própria oferta',
    zz_teste.como(v_pa, format('insert into public.atividades (oferta_id, periodo_id, titulo, criado_por) values (%L, %L, ''ok'', %L)', v_of_a, v_per_x, v_pa)), 1);
  PERFORM zz_teste.confere('prof A não cria atividade em nome de outro',
    zz_teste.como(v_pa, format('insert into public.atividades (oferta_id, periodo_id, titulo, criado_por) values (%L, %L, ''x'', %L)', v_of_a, v_per_x, v_pb)), -1);
  PERFORM zz_teste.confere('prof A corrige resposta da turma A',
    zz_teste.como(v_pa, format('update public.respostas set correcao = ''certo'' where questao_id = %L', v_q_a)), 1);
  PERFORM zz_teste.confere('prof A não corrige resposta da turma B',
    zz_teste.como(v_pa, format('update public.respostas set correcao = ''certo'' where questao_id = %L', v_q_b)), 0);
  PERFORM zz_teste.confere('equipe não insere resposta',
    zz_teste.como(v_pa, format('insert into public.respostas (aluno_id, questao_id) values (%L, %L)', v_aluno_a, v_q_a)), -1);
  PERFORM zz_teste.confere('prof A não cria turma',
    zz_teste.como(v_pa, format('insert into public.turmas (escola_id, nome, serie, segmento, ano_letivo, codigo_acesso) values (%L, ''N'', ''7'', ''fund2'', 2026, ''ZZ'')', v_ex)), -1);
  PERFORM zz_teste.confere('prof A não altera escola',
    zz_teste.como(v_pa, format('update public.escolas set nome = ''x'' where id = %L', v_ex)), 0);
  PERFORM zz_teste.confere('prof A não escreve em perfis',
    zz_teste.como(v_pa, format('update public.perfis set papel = ''direcao'' where id = %L', v_pa)), 0);

  -- ---------- 4. Observações: só professor/gestão da turma ----------
  PERFORM zz_teste.confere('prof A anota aluno da turma A',
    zz_teste.como(v_pa, format('insert into public.aluno_observacoes (aluno_id, professor_id, professor_nome, texto) values (%L, %L, ''Prof A'', ''ok'')', v_aluno_a, v_pa)), 1);
  PERFORM zz_teste.confere('prof A não anota aluno da turma B',
    zz_teste.como(v_pa, format('insert into public.aluno_observacoes (aluno_id, professor_id, professor_nome, texto) values (%L, %L, ''Prof A'', ''x'')', v_aluno_b, v_pa)), -1);
  PERFORM zz_teste.confere('prof B não lê a observação da turma A', zz_teste.como(v_pb, 'select * from public.aluno_observacoes'), 0);
  PERFORM zz_teste.confere('coordenação lê a observação', zz_teste.como(v_cx, 'select * from public.aluno_observacoes'), 1);

  -- ---------- 5. Gestão da escola X: toda a escola X, nada da Y ----------
  PERFORM zz_teste.confere('direção X vê 2 turmas', zz_teste.como(v_dx, 'select * from public.turmas'), 2);
  PERFORM zz_teste.confere('direção X vê 2 alunos', zz_teste.como(v_dx, 'select * from public.alunos'), 2);
  PERFORM zz_teste.confere('coordenação X vê 2 turmas', zz_teste.como(v_cx, 'select * from public.turmas'), 2);
  PERFORM zz_teste.confere('direção X não vê a turma Y', zz_teste.como(v_dx, format('select * from public.turmas where id = %L', v_ty)), 0);
  PERFORM zz_teste.confere('direção X não vê o aluno Y', zz_teste.como(v_dx, format('select * from public.alunos where id = %L', v_aluno_y)), 0);
  PERFORM zz_teste.confere('direção X vê só a própria escola', zz_teste.como(v_dx, 'select * from public.escolas'), 1);
  PERFORM zz_teste.confere('direção X vê perfis só da escola X', zz_teste.como(v_dx, 'select * from public.perfis'), 4);
  PERFORM zz_teste.confere('direção X não altera a turma Y',
    zz_teste.como(v_dx, format('update public.turmas set nome = ''hack'' where id = %L', v_ty)), 0);
  PERFORM zz_teste.confere('direção X não cria turma na escola Y',
    zz_teste.como(v_dx, format('insert into public.turmas (escola_id, nome, serie, segmento, ano_letivo, codigo_acesso) values (%L, ''N'', ''7'', ''fund2'', 2026, ''ZY'')', v_ey)), -1);
  PERFORM zz_teste.confere('direção X cria turma na escola X',
    zz_teste.como(v_dx, format('insert into public.turmas (escola_id, nome, serie, segmento, ano_letivo, codigo_acesso) values (%L, ''N'', ''7'', ''fund2'', 2026, ''ZX'')', v_ex)), 1);
  PERFORM zz_teste.confere('direção X altera a própria escola',
    zz_teste.como(v_dx, format('update public.escolas set nome = ''Escola X2'' where id = %L', v_ex)), 1);
  PERFORM zz_teste.confere('coordenação não altera a escola',
    zz_teste.como(v_cx, format('update public.escolas set nome = ''x'' where id = %L', v_ex)), 0);
  PERFORM zz_teste.confere('direção X vê as 3 atividades da escola X (2 + 1 criada no teste)',
    zz_teste.como(v_dx, 'select * from public.atividades'), 3);

  -- ---------- 6. Escola Y não enxerga a X ----------
  PERFORM zz_teste.confere('direção Y vê 1 turma', zz_teste.como(v_dy, 'select * from public.turmas'), 1);
  PERFORM zz_teste.confere('direção Y vê 1 aluno', zz_teste.como(v_dy, 'select * from public.alunos'), 1);
  PERFORM zz_teste.confere('direção Y não vê atividades da X', zz_teste.como(v_dy, 'select * from public.atividades'), 0);
  PERFORM zz_teste.confere('direção Y não vê questões da X', zz_teste.como(v_dy, 'select * from public.questoes'), 0);
  PERFORM zz_teste.confere('direção Y não vê respostas da X', zz_teste.como(v_dy, 'select * from public.respostas'), 0);

  -- ---------- 7. Avisos ----------
  PERFORM zz_teste.confere('prof A não publica aviso para a escola toda',
    zz_teste.como(v_pa, format('insert into public.avisos (escola_id, autor_id, titulo, mensagem) values (%L, %L, ''t'', ''m'')', v_ex, v_pa)), -1);
  PERFORM zz_teste.confere('prof A publica aviso para a própria turma',
    zz_teste.como(v_pa, format('insert into public.avisos (escola_id, autor_id, turma_id, titulo, mensagem) values (%L, %L, %L, ''t'', ''m'')', v_ex, v_pa, v_ta)), 1);
  PERFORM zz_teste.confere('prof A não publica aviso para a turma B',
    zz_teste.como(v_pa, format('insert into public.avisos (escola_id, autor_id, turma_id, titulo, mensagem) values (%L, %L, %L, ''t'', ''m'')', v_ex, v_pa, v_tb)), -1);
  PERFORM zz_teste.confere('direção Y não lê avisos da X', zz_teste.como(v_dy, 'select * from public.avisos'), 0);

  -- ---------- 8. Troca obrigatória de senha (migration 0004) ----------
  -- (precisa da 0004 aplicada; sem ela estes testes falham com "function does not exist")
  UPDATE public.perfis SET trocar_senha = true WHERE id IN (v_pa, v_pb);
  PERFORM zz_teste.confere('anon não chama concluir_troca_senha',
    zz_teste.como(NULL, 'select public.concluir_troca_senha()'), -1);
  PERFORM zz_teste.confere('prof A conclui a própria troca de senha',
    zz_teste.como(v_pa, 'select public.concluir_troca_senha()'), 1);
  PERFORM zz_teste.confere('a troca do prof A zerou só a flag dele',
    (SELECT count(*) FROM public.perfis WHERE id = v_pa AND NOT trocar_senha), 1);
  PERFORM zz_teste.confere('a flag do prof B continua ligada',
    (SELECT count(*) FROM public.perfis WHERE id = v_pb AND trocar_senha), 1);
  PERFORM zz_teste.confere('prof A não escreve trocar_senha direto em perfis',
    zz_teste.como(v_pa, format('update public.perfis set trocar_senha = true where id = %L', v_pb)), 0);

  -- Erro de propósito: desfaz TODAS as inserções acima (nada fica gravado).
  RAISE EXCEPTION 'TODOS OS TESTES DE RLS PASSARAM';
END $f$;

SELECT zz_teste.rodar();
