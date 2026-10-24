# Comando 7.1 e 7.2 para o Antigravity: seed do Supabase de TESTE

(Escrito em 24/10/2026. Plano: docs/claude/plano-backend.md, Fase 7. Quem executa o script depois é o Wagner; o Claude revisa o diff antes do commit.)

**Para o Wagner:**
- Abra uma conversa NOVA no Antigravity e cole tudo a partir de "COMANDO".
- Quando o Antigravity terminar, cole aqui o `git status --short`, a linha do build e a dos testes. Eu reviso o diff antes do commit.
- Só depois da revisão você roda o script no Supabase de teste (passo a passo no fim deste arquivo).

---

## COMANDO

Contexto: o Supabase de teste agora tem o esquema v2 (migrations 0003 a 0007, ids uuid, RLS real, PIN só em hash bcrypt). O script antigo `app/src/scripts/seed-supabase.ts` está QUEBRADO: usa a chave anon, grava `saberpontual_store` (tabela removida), manda `pin_hash` na tabela alunos e usa ids legíveis (`esc-001`, `usr-prof-ana`...) onde o banco exige uuid. Reescreva-o para carregar no Supabase a MESMA base de demonstração ampliada do mock, de forma idempotente, e acrescente a opção de zerar e recarregar.

Não leia arquivos inteiros: use busca (Select-String) e abra só os trechos necessários. Para as colunas de cada tabela, leia SÓ os blocos `CREATE TABLE` de `supabase/migrations/0003_esquema_v2_rls.sql` (e `0006_respostas_colunas_correcao.sql` se precisar). Não leia AGENTS.md nem ESPECIFICACAO.

### Regras de ouro (valem para todo o comando)
1. O script usa a service role e roda SÓ na máquina do Wagner. A chave vem de `process.env.SUPABASE_SERVICE_ROLE_KEY` e NUNCA é impressa, gravada em arquivo, nem colocada em variável `VITE_*`.
2. Nunca editar as migrations existentes. Nada de migration nova neste comando.
3. Sempre checar `{ error }` do supabase-js; nada de `catch {}` vazio. Qualquer erro interrompe o script com mensagem clara e código de saída 1 (nunca "concluído" com falha no meio).
4. O PostgREST corta respostas em 1000 linhas SEM erro: ao conferir contagens use `select('id', { count: 'exact', head: true })`, e ao gravar use lotes de até 500 linhas.
5. Só tocar nos dados da escola de demonstração e nos usuários `@demo.com`. NÃO apagar nem alterar nenhuma outra escola nem outro usuário do Auth (o projeto de teste tem a escola e a direção reais do Wagner criadas pelo bootstrap).

### O que fazer

**Arquivos (só estes):**
- `app/src/scripts/seed-supabase.ts` (reescrever; é o programa principal)
- `app/src/scripts/seed-mapa.ts` (NOVO; lógica pura, sem rede, para os testes)
- `app/src/services/__tests__/seed-supabase.test.ts` (NOVO)

**1. Lógica pura em `seed-mapa.ts`** (exporte cada função):

- `uuidV5(nome: string): string`: UUID v5 (SHA-1, RFC 4122) com um namespace FIXO escrito no arquivo (gere um uuid qualquer e deixe como constante `NAMESPACE_SEED`). Use `node:crypto`. O mesmo nome dá sempre o mesmo uuid; é isso que torna o seed idempotente.
- `idDe(tabela: string, idLegivel: string): string` = `uuidV5(`${tabela}:${idLegivel}`)`.
- `recuperarPins(alunos): Map<alunoIdLegivel, string>`: o mock guarda `pin_hash = SHA-256("saberpontual_pin_" + pin)` (veja `hashPin` em `app/src/services/mock/crypto.ts`). Monte uma tabela com os 10.000 PINs possíveis ("0000" a "9999", cada um passado por `hashPin`) e, para cada aluno, descubra o PIN em texto pelo hash. Se algum aluno não bater, lance erro com o id dele (nunca invente PIN).
- `montarLinhas(db, mapaPerfis)`: recebe a base do mock (`MockDatabaseSchema`, de `criarBancoDemonstracao()` em `app/src/services/mock/seed.ts`) e o mapa `idLegivelDoPerfil -> uuid do Auth`, e devolve um objeto com as linhas prontas para o Postgres, por tabela, TODAS com uuid:
  `escolas, perfis, periodos, disciplinas, turmas, ofertas, alunos, assuntos, banco_questoes, banco_alternativas, atividades, questoes, alternativas, respostas, avisos, aluno_observacoes`.
  - Cada `id` vira `idDe(tabela, idLegivel)`, EXCETO `perfis.id`, que é o uuid do Auth (vem do mapa).
  - Toda coluna que é chave estrangeira também é traduzida (escola_id, turma_id, oferta_id, disciplina_id, periodo_id, professor_id, criado_por, corrigido_por, autor_id, atividade_id, questao_id, alternativa_id, aluno_id, banco_questao_id, assunto_id...). Perfis referenciados por `professor_id`, `criado_por`, `corrigido_por`, `autor_id` usam o mapa de perfis. Valores nulos continuam nulos.
  - Se uma chave estrangeira apontar para um id que não existe na base, lance erro com tabela, coluna e id (nada de linha com referência solta).
  - Envie SÓ as colunas que existem na tabela do Postgres (confira nos `CREATE TABLE`). Exemplos: `alunos` NÃO tem `pin_hash`; `perfis` leva `trocar_senha: false` para os usuários demo não cairem na troca obrigatória de senha; descarte campos do mock que não existem no banco (ex.: `credenciais`, `aluno_sessoes`, `pin_tentativas`, `versao`).
  - Não envie `updated_at` nem `deleted_at` (têm valor padrão).

**2. Programa principal em `seed-supabase.ts`:**

Variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `VITE_SUPABASE_ANON_KEY` (a anon é usada só para entrar como a direção e para o teste final). Se faltar alguma, explique no console qual e pare. Documente no cabeçalho do arquivo, como o `bootstrap-direcao.ts`, o comando de execução em PowerShell.

Argumentos:
- `--confirmo-teste` OBRIGATÓRIO. Sem ele o script imprime o endereço do projeto e a frase "Este script grava dados fictícios e, com --zerar, apaga a escola de demonstração. Rode de novo com --confirmo-teste se este é o projeto de TESTE." e sai com código 1.
- `--zerar` (opcional; é a tarefa 7.2): antes de carregar, apaga a escola de demonstração e os usuários demo (veja abaixo) e recarrega tudo do zero.

Fluxo:
1. Gerar a base com `criarBancoDemonstracao()` (sem NODE_ENV=test, ela já vem ampliada) e imprimir as contagens (turmas, alunos, atividades, questões, respostas).
2. Se `--zerar`: guardar os ids dos perfis da escola demo (`idDe('escolas', 'esc-001')`), apagar essa escola (as tabelas filhas caem por `ON DELETE CASCADE`; confirme nos `CREATE TABLE` e, se alguma tabela não cair, apague-a antes na ordem certa) e apagar do Auth os usuários que eram dessa escola e QUALQUER usuário com e-mail terminado em `@demo.com` (lista paginada: `admin.auth.admin.listUsers({ page, perPage: 1000 })`). Não apagar mais nada.
3. Usuários do Auth: para cada perfil da base, procurar o usuário pelo e-mail (primeiro em `perfis`, depois na lista do Auth); se não existir, criar com `admin.auth.admin.createUser({ email, password, email_confirm: true })`, usando a senha de `db.credenciais[email]` ("demo123"). Montar o mapa `idLegivel -> uuid do Auth`. Se o usuário já existir, reaproveitar o uuid.
4. Gravar na ordem das chaves estrangeiras, com `upsert(linhas, { onConflict: 'id' })` em lotes de até 500: escolas, perfis, periodos, disciplinas, turmas, ofertas, alunos, assuntos, banco_questoes, banco_alternativas, atividades, questoes, alternativas, respostas, avisos, aluno_observacoes. Imprimir "✔ tabela: N linhas" a cada uma.
5. PINs: entrar com a anon key como `direcao@demo.com` (`signInWithPassword`) e, para cada aluno, chamar a RPC `definir_pin_aluno(p_aluno_id, p_pin)` com o PIN recuperado (`recuperarPins`). Essa RPC grava o bcrypt em `aluno_credenciais`; NUNCA escreva em `aluno_credenciais` direto nem guarde PIN em texto. Se já houver PIN igual, tudo bem repetir (a RPC regrava).
6. Verificação final (o script termina com código 1 se qualquer item falhar):
   - para cada tabela, a contagem no banco (com `count: 'exact', head: true`, filtrando pela escola demo quando a tabela tiver `escola_id`) é IGUAL ao número de linhas enviadas;
   - com a anon key, `aluno_listar_turma(<codigo_acesso da turma 7A-MAT>)` devolve a lista de alunos;
   - com a anon key, `aluno_login(<id do Lucas>, '1420')` devolve `ok: true` (PIN do Lucas é 1420; veja o CLAUDE.md) e `aluno_login(<id do Lucas>, '0000')` devolve `ok: false` SEM lançar erro; logo depois faça `aluno_login` correto de novo para zerar o contador de tentativas (o PIN errado conta uma tentativa);
   - entrando como `ana@demo.com`, `select` em `turmas` devolve pelo menos 1 turma, e entrando sem login (anon) `select` em `turmas` devolve 0 linhas.
   - Imprimir "✔" ou "✖" por item e, no fim, "SEED OK" ou "SEED COM FALHAS".
7. Ao terminar (com sucesso ou falha), fazer `signOut` das sessões abertas. Nunca imprimir a service role key, tokens ou o JWT.

**3. Testes em `seed-supabase.test.ts`** (só da lógica pura; não chamam rede nem o Supabase):
- `uuidV5` bate com o vetor oficial: namespace DNS `6ba7b810-9dad-11d1-80b4-00c04fd430c8`, nome `python.org` => `886313e1-3b8a-5372-9b90-0c9aee199e5d` (se a sua função aceita namespace como parâmetro, teste assim; se o namespace é fixo, exporte também `uuidV5Com(namespace, nome)` para este teste). E: mesmo nome => mesmo uuid; nomes diferentes => uuids diferentes; formato uuid válido, versão 5.
- `idDe('turmas', 'x')` e `idDe('alunos', 'x')` são diferentes (a tabela entra no nome).
- `recuperarPins` com uma base pequena (alunos com `hashPin` de "1420", "3891", "0007") devolve os PINs certos e lança erro para um hash desconhecido.
- `montarLinhas` com `await criarBancoDemonstracao()`:
  - nenhum id é repetido dentro de cada tabela e todos são uuid;
  - TODA chave estrangeira aponta para uma linha existente (percorra: alunos.turma_id→turmas, ofertas→turmas/disciplinas/perfis, atividades→ofertas/periodos/perfis, questoes→atividades, alternativas→questoes, respostas→alunos/questoes/alternativas, avisos→escola/perfis/turmas, banco_alternativas→banco_questoes etc.);
  - nenhuma linha de `alunos` tem `pin_hash`; nenhuma tabela contém campo `credenciais`;
  - as contagens por tabela são iguais às da base do mock;
  - rodar `montarLinhas` duas vezes dá exatamente os mesmos ids (idempotência);
  - uma base com uma FK solta (apague uma turma que tem aluno) faz `montarLinhas` lançar erro com o nome da tabela e da coluna.
- (Se a base do mock tiver datas relativas a hoje, não compare datas nos testes.)

### Arquivos permitidos
- `app/src/scripts/seed-supabase.ts`
- `app/src/scripts/seed-mapa.ts` (novo)
- `app/src/services/__tests__/seed-supabase.test.ts` (novo)

Proibido: `package.json`, lock, migrations, `AGENTS.md`, `ESPECIFICACAO.md`, qualquer serviço em `app/src/services/` (exceto importar `criarBancoDemonstracao`, `hashPin` e tipos), arquivos `.env*`.

### Rodapé
- Rode `npm run build` e `npm test` UMA vez no final. Se falhar, corrija e rode de novo só o que falhou. Não rode E2E. NÃO rode o seed contra o Supabase (quem roda é o Wagner).
- Resposta CURTA: `git status --short`, uma linha de build, uma de testes e até 3 linhas de dúvidas. Sem código nem diff.
- PARE: sem commit nem push.

---

## Depois que o Claude revisar: como o Wagner roda (PowerShell, na pasta `app/`)

1. No painel do Supabase de TESTE: Project Settings > API: copie a chave **service_role** (secreta; só para esta sessão do PowerShell).
2. Rodar:
   ```
   $env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY = "cole a service_role aqui"
   $env:VITE_SUPABASE_ANON_KEY = "a anon key (a mesma do app/.env)"
   npx vite-node src/scripts/seed-supabase.ts -- --confirmo-teste
   ```
   Para zerar e recarregar tudo: acrescentar `--zerar`.
3. Esperado: uma linha "✔" por tabela e, no fim, "SEED OK". Depois feche o PowerShell (a chave some da sessão).
4. Com `VITE_DATA_SOURCE=supabase` no `app/.env`, entre com `ana@demo.com` / `demo123`: as telas devem mostrar as turmas e atividades. E teste o "Gerar com IA" (a função gerar-questoes já está publicada). Depois volte `VITE_DATA_SOURCE=mock`.
