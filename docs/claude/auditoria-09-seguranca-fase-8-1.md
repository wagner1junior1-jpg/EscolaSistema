# Auditoria 09 — Revisão de segurança (Fase 8.1 do plano do back end)

25/10/2026, Claude. Só leitura e testes: nenhum código, migration ou configuração foi alterado.

## O que foi feito
1. Leitura das migrations 0003 a 0008 (RLS, privilégios, funções SECURITY DEFINER) e das Edge Functions `admin-usuarios` e `gerar-questoes`.
2. Testes ao vivo no Supabase de TESTE só com a anon key (a chave pública que está no bundle).
3. Build de produção (`VITE_DATA_SOURCE=supabase`, `VITE_MODO_TESTE=false`) e busca de segredos no bundle.
4. Busca de segredos no histórico inteiro do git.
5. Front: pontos de XSS (texto de questão vindo do professor/IA e mostrado ao aluno) e guarda do token do aluno.

## Conferido e OK
- Anon key: as 20 tabelas negam leitura (401/42501), escrita negada, `saberpontual_store` não existe mais, RPCs da equipe (`concluir_troca_senha`, `definir_pin_aluno`, `relatorio_*`, `professor_painel_dados`) negadas; RPCs do aluno sem token válido respondem "Sessão expirada ou inválida"; OpenAPI fechado; GraphQL desligado; Storage sem buckets; cadastro aberto desligado (`signup_disabled`).
- Funções auxiliares no schema `private`, todas com `search_path = ''`; tabelas de PIN, tentativas e sessões sem política e sem privilégio; respostas só alteráveis nas colunas de correção (0006).
- RPCs de relatório e painel conferem papel e escola; nenhuma devolve PIN ou credencial.
- Portal do aluno: gabarito protegido, PIN em bcrypt, token aleatório (244 bits) guardado só como hash, sessão cai com aluno/turma inativos ou troca de PIN.
- Edge Functions: JWT validado no servidor, escola sempre a do perfil (o corpo não escolhe escola), direção não pode ser alvo, limites de tamanho de foto/texto, chave do Gemini no cabeçalho (nunca na URL).
- Bundle: sem chave do Gemini (comparada com o valor do .env), sem service role, sem source map. Só a anon key (pública por desenho).
- Git: nenhum `.env` real nem chave em nenhum commit.
- XSS: KaTeX com `trust` desligado (padrão) e o resto renderizado pelo React; nenhum `dangerouslySetInnerHTML`.

## Achados

### ALTO (resolver antes de qualquer dado real)
**A1. Qualquer pessoa consegue listar os nomes completos dos alunos (menores) de uma turma sem saber o código.**
O código sugerido tem o formato `7A-XYZ`: prefixo previsível + 3 consoantes = 9.261 combinações por prefixo (e usa `Math.random`). A RPC `aluno_listar_turma` é anônima e não tem limite: medido 60 chamadas em 0,95 s sem nenhum 429. Varrer um prefixo leva ~2 a 3 minutos e devolve nome completo e número de chamada da turma inteira. É dado pessoal de criança (LGPD).
Correção proposta: código gerado pelo sistema com 8 caracteres aleatórios (`crypto.getRandomValues`, alfabeto sem letras ambíguas: ~10¹² combinações) e limite de códigos errados no servidor (ver A2). Decisão do Wagner: mostrar o nome completo ou só primeiro nome + inicial na tela de escolha.

**A2. A força bruta de PIN é viável em escala de turma.**
O limite é por aluno (5 erros a cada 15 min), não por turma nem por origem. Quem tem o código da turma (qualquer colega, ou via A1) tenta os 78 alunos em paralelo: ~1.560 tentativas por hora, ~1 PIN acertado a cada 6 horas, 3 a 4 contas de aluno por dia. Com a conta o atacante vê as notas e responde atividades e provas no lugar do aluno.
Correção proposta (decisão do Wagner, porque endurecer aumenta o risco de alguém bloquear colegas de propósito): (a) bloqueio progressivo: depois de 10 erros no dia, só a equipe destrava (redefinindo o PIN); (b) teto por turma: ex. 30 erros por hora na turma pausam o login da turma por 15 min; (c) aviso no painel do professor quando houver bloqueio.

### MÉDIO
**M1. Professor consegue apagar questões do banco de outros professores.** A política `assuntos_write` vale para DELETE físico e `banco_questoes.assunto_id` é `ON DELETE CASCADE`: apagar um assunto pela API apaga todas as questões do banco daquele assunto, de qualquer autor. Do mesmo jeito, a gestão pode apagar fisicamente disciplina, turma, oferta, período ou aluno, e a cascata leva atividades e respostas. O app nunca faz isso (usa `deleted_at`), mas a API permite.
Correção: migration nova revogando DELETE de `authenticated` em periodos, disciplinas, turmas, ofertas, alunos, assuntos, atividades, avisos e aluno_observacoes (os serviços só apagam de verdade em questoes, alternativas, banco_questoes e banco_alternativas; conferido no código).

**M2. Professor transforma recado da turma em aviso da escola toda.** `avisos_insert` só deixa a gestão publicar com `turma_id` vazio, mas `avisos_update` não repete a regra: o professor cria o recado na turma e depois faz UPDATE com `turma_id = null`.
Correção: repetir a condição do insert no WITH CHECK do update.

**M3. A direção pode aumentar a própria cota de IA.** `escolas_update` libera todas as colunas, inclusive `cota_ia_mensal`, que a Edge Function usa como limite. Só pesa quando a cota for cobrada (plano premium).
Correção: privilégio por coluna em escolas (como a 0006 fez em respostas), deixando a cota só para a service role.

**M4. "Transcrever foto" não tem limite.** A ação `transcrever` da `gerar-questoes` não conta na cota nem tem limite por minuto: qualquer professor pode gerar custo ilimitado no Gemini.
Correção: registrar em `ia_geracoes` e/ou limitar por minuto por usuário.

**M5. Senha da equipe fraca para o tipo de dado.** Mínimo de 6 caracteres e sem MFA, para contas que veem dados de menores. Recomendo mínimo 8 (Edge Function, tela e painel do Supabase Auth) e ligar a proteção contra senha vazada se o plano do Supabase permitir.

**M6. Site sem cabeçalhos de segurança.** O `vercel.json` só tem o rewrite. Faltam `Content-Security-Policy` (ou ao menos `frame-ancestors`), `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`; sem eles a página pode ser embutida em outro site (clickjacking).

### BAIXO
- **B1.** O bundle de produção leva o mock inteiro com os dados de demonstração (senhas `demo123`, hashes de PIN fictícios, nomes fictícios), mesmo com Supabase e modo teste desligado. Não é segredo, mas é peso e ruído; carregar o mock com `import()` só quando `VITE_DATA_SOURCE=mock`.
- **B2.** Várias políticas não conferem se o id referenciado é da mesma escola (ofertas.disciplina_id/professor_id, atividades.periodo_id, assuntos.disciplina_id, banco_questoes.disciplina_id/assunto_id, questoes.assunto_id). Exige conhecer uuid de outra escola; afeta integridade, não encontrei vazamento de leitura. Resolver com triggers de conferência ou FKs compostas quando houver mais de uma escola.
- **B3.** O "Sair" do aluno apaga o token do navegador mas não chama `aluno_sair`: o token continua válido no servidor por 30 dias.
- **B4.** `aluno_login` e `definir_pin_aluno` (SECURITY DEFINER) usam `search_path = public, extensions, pg_temp`. Hoje não é explorável (ninguém cria função pela API), mas o ideal é `search_path = ''` e `extensions.crypt`/`extensions.gen_salt` qualificados (conferir antes em qual schema o pgcrypto está).
- **B5.** CORS `*` nas Edge Functions: aceitável com Bearer; restringir ao domínio na produção.
- **B6.** A linha `VITE_GEMINI_API_KEY` ainda está no `app/.env` local. O código não lê mais e ela não vai para o bundle (conferido), mas apagar a linha evita que volte por engano.
- **B7.** (já conhecido) `corrigido_por` vem do cliente; afeta só auditoria.

## Proposta de execução (aguarda OK do Wagner)
1. Migration `0009_seguranca_fase8.sql` [CLAUDE]: M1, M2, M3, B4 e as regras escolhidas para A1/A2 no servidor; novas seções no `rls_teste.sql` e no `aluno_rpc_teste.sql`. O Wagner roda no SQL Editor do Supabase de teste.
2. Front [CLAUDE]: código de turma aleatório de 8 caracteres, `aluno_sair` no "Sair", cabeçalhos no `vercel.json` (M6), mock por `import()` (B1).
3. Edge Function [CLAUDE]: limite do `transcrever` (M4), senha mínima 8 (M5). O Wagner republica pelo painel.
4. Painel do Supabase [WAGNER]: senha mínima 8 e proteção contra senha vazada (M5); apagar `VITE_GEMINI_API_KEY` do .env (B6).

## Correções feitas (27/10/2026, com OK do Wagner: "faça conforme suas recomendações")
- **Migration `0009_seguranca_fase8.sql`**: M1 (REVOKE DELETE nas 9 tabelas com exclusão lógica), M2 (avisos_update repete a regra do insert), M3 (UPDATE de escolas só em nome, cidade_uf, ano_letivo_atual, limite_otimo, limite_bom), A1 (código comparado sem hífen/espaço; código que vale para 2 turmas não lista ninguém), A2 (5 erros em 15 min = 15 min; 10 erros em 24 h = travado até a equipe criar PIN novo; erros na turma em 1 h ≥ maior entre 20 e o nº de alunos = turma pausada 15 min, sem conferir PIN; RPC `alunos_pin_bloqueado()`), B4 (search_path das duas funções = só o schema do pgcrypto + pg_temp).
- **Testes SQL**: `rls_teste.sql` seção 12 e `aluno_rpc_teste.sql` seção 15. Rodados num Postgres local (PGlite, fora do repositório) com 0003 a 0009: as duas suítes passam; 8 quebras deliberadas (DELETE de volta, policy antiga de avisos, cota liberada, sem travamento, sem pausa, lista sem filtro de professor, código sem normalizar, PIN novo sem destravar) foram todas detectadas.
- **Front**: código sugerido `7A-XXXX-XXXX` (8 caracteres aleatórios por `crypto.getRandomValues`, sem 0/O/1/I/L); código novo ou alterado precisa de 10+ letras/números (turmas antigas continuam editáveis); `AlunoService.sair` (mock remove a sessão; Supabase chama `aluno_sair`) usado no "Sair"; `GestaoService.listarPinsBloqueados` + aviso `AvisoPinsBloqueados` em Gestão > Alunos e PINs (com selo "PIN bloqueado" no aluno) e no painel do professor; PIN novo no mock também destrava; mock aceita o código sem hífen; senha mínima 8 (`lib/senha.ts`) nas telas e nos serviços Supabase; cabeçalhos de segurança no `vercel.json` (frame-ancestors/X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy; sem CSP de scripts para não quebrar sem teste no navegador).
- **Edge Functions**: `admin-usuarios` senha mínima 8; `gerar-questoes` com limite de 20 pedidos (gerar + transcrever) por pessoa a cada 10 min, transcrição gravada em `ia_geracoes` (com 0 questões, fora da cota). Não dependem da 0009.
- **Script** `bootstrap-direcao.ts`: senha mínima 8.
- Testes: `seguranca-fase8.test.ts` (13) e +6 em `gerar-questoes-funcao.test.ts`; 577 testes, build OK. E2E não rodado (só o seletor do campo de código mudou nos dois `gestao.spec.ts`).
- **Não feito**: B1 (tirar o mock do bundle) exige refatorar ~10 arquivos que importam o mock; adiado por ser achado leve, sem segredo real. B2, B5 ficam para a produção. Nomes na tela de entrada do aluno: mantido o nome completo (com o código forte, só quem recebeu o código vê a lista).

## Falta o Wagner
1. SQL Editor do Supabase de TESTE: rodar a `0009`, depois `rls_teste.sql` e `aluno_rpc_teste.sql` (esperado: "TODOS OS TESTES ... PASSARAM" nas duas).
2. Republicar as Edge Functions `admin-usuarios` (apelido `swift-processor`) e `gerar-questoes` colando os `index.ts` novos (Verify JWT ligado).
3. Authentication > Providers > Email: "Minimum password length" = 8; ligar "Leaked password protection" se o plano permitir.
4. Apagar a linha `VITE_GEMINI_API_KEY` do `app/.env`.
5. Turmas antigas do seed seguem com código curto (ex.: `7A-MAT`); na produção todas nascem com o código novo. Para trocar uma turma existente: Gestão > Turmas > Editar > "Sugerir novo".

## Para a produção (8.4), lembrar
Projeto novo (chaves novas, então a anon key de teste deixa de importar), `VITE_MODO_TESTE=false`, `IA_COTA_ATIVA=true`, cadastro aberto desligado, Verify JWT ligado nas duas funções, CORS restrito ao domínio, rodar as suítes `rls_teste.sql` e `aluno_rpc_teste.sql` lá antes de qualquer dado real.
