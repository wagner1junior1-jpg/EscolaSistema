# Auditoria 08 — Geral, depois do commit da13949 (FINAL)

Data: 30/09/2026. Método: leitura direta dos arquivos da pasta (db.ts, seed.ts, seed-escola-ampliada.ts, auth/autorizacao, professor/aluno/relatorio/banco/ia.mock, calculos.ts, types.ts, migrations 0001 e 0002, package.json, supabase.ts, stub.ts, AGENTS.md, as telas Atividade/Oferta/Resultados/Banco/Aluno, ModalGeradorIA, MathText, discursiva.test.ts e os 6 specs E2E). NÃO rodei build, testes nem E2E (sem shell na máquina do Wagner). Itens "(verificar)" vieram da leitura do código e merecem teste manual antes de virar tarefa.

Não lidas linha a linha: ProfessorOfertaPage, ProfessorResultadosPage e ProfessorDashboardPage (só busca por termos-chave); GestaoConselhoSecao (só busca).

Atualização de 03/10: A10 (rascunho e confirmação da discursiva) foi RESOLVIDO e conferido no navegador; B7 (@types/katex em dev) e `window.bancoService` (B8) foram tratados no commit 7865005; a regra de discursiva pendente (A12/B8) foi unificada em estaAguardandoCorrecao (7865005/5121a1b), restando professor.mock.ts e relatorio.mock.ts a conferir; A6 (E2E em base diferente) foi tratado em e94ed2f (playwright com base mock fixa).

---

# PARTE A — Problemas que podem aparecer durante o uso

## A1. Exclusões "voltam" depois da sincronização (Supabase) — ALTA (verificar)
db.ts, `mesclarDatabases` / `mesclarPorId`: a fusão local + remoto faz a UNIÃO por id. Se o usuário exclui algo (observação, aviso, questão, atividade) e existe uma cópia em outro navegador/aba ou no store da nuvem, o item reaparece no próximo merge.
Como o usuário vê: professora exclui uma observação ou aviso, atualiza a página e ele está lá de novo.
Teste: com Supabase ligado, abrir 2 navegadores, excluir uma observação no A, mexer em algo no B.

## A2. Edição antiga sobrescreve edição nova — ALTA (verificar)
Mesma função: para o mesmo id, o item LOCAL sempre ganha do remoto, mesmo desatualizado. Só as respostas dos alunos usam data para desempatar.
Como o usuário vê: professor A altera o título/status de uma atividade; professor B, com a tela antiga aberta, salva outra coisa e desfaz a mudança do A. Vale para questões, avisos, turmas etc.

## A3. Senha alterada pode voltar à antiga — ALTA (verificar)
`credenciais: { ...remoto, ...local }` (db.ts, linha 154): o local vence. Quem trocou a senha no computador 1 e depois abre o computador 2 (localStorage antigo) pode restaurar a senha antiga para todos. O login usa `db.credenciais`, não o Supabase Auth; `supabase.auth.updateUser` (stub.ts) provavelmente falha sem sessão e só dá `console.warn`.
Como o usuário vê: "troquei a senha e ela não vale mais / a antiga voltou".

## A4. Fotos sem limite de tamanho e falta de upload de imagem nas questões — ALTA (novo)
- O relatório do Antigravity diz que H2 tem "upload local com compressão responsiva (até 1600px e 300 KB)" no editor da atividade, no banco e no player. NÃO encontrei isso no código: nenhum FileReader/canvas/toDataURL/`type="file"` nem o número 1600/300 KB em ProfessorAtividadePage, ProfessorBancoPage ou AlunoAtividadePage. O único upload é o de fotos do ModalGeradorIA (`FileReader.readAsDataURL`), até 5 fotos, sem redução de tamanho nem limite de peso.
- Uma foto de celular tem alguns MB; em base64 5 fotos passam facilmente de 10 MB, acima do limite de ~5 MB do localStorage. No modo demo de IA (ia.mock.ts, linhas ~586 a 730) a foto anexada é copiada para o `imagem_url` de CADA questão gerada, multiplicando o peso.
- O editor da atividade e o banco só exibem/copiam `imagem_url`; o professor não consegue anexar imagem manualmente numa questão (verificar na tela do Banco).
Como o usuário vê: professora envia 3 fotos do caderno para gerar questões, o sistema trava ou perde os dados ao recarregar (ver A5).
Correção: reduzir a imagem no navegador (máx. 1600 px, ~300 KB) ANTES de guardar; não copiar a foto de origem para todas as questões; ou implementar de fato o upload que o relatório descreve.

## A5. Estouro do localStorage sem aviso — MÉDIA/ALTA
db.ts `saveDatabase`: se o navegador recusar gravar (~5 MB), só há `console.warn`. Junto com A4 e com a escola ampliada (~165 alunos, +120 questões) o limite é realista.
Como o usuário vê: no demo, o professor salva e ao recarregar perdeu o trabalho, sem nenhuma mensagem.
Correção: toast de erro quando a gravação falhar.

## A6. E2E testa uma base diferente da que o usuário usa — MÉDIA (tratado em e94ed2f)
seed.ts: `isTestEnvironment()` usa `navigator.webdriver`; no Playwright o seed é a versão 3 (dados-demo.json) e no navegador normal é 321 (com a escola ampliada do 3º ao 6º ano). Os 55 E2E nunca exercitam a escola ampliada que o Wagner vê.
Também (verificar): db.ts ~linha 583, no modo mock, se a `versao_seed` gravada for diferente da esperada os dados locais são refeitos — trocar a versão do seed apaga o que a pessoa criou no demo.

## A7. Cota de IA não é mensal — MÉDIA (novo; adiado: IA sem limite por enquanto)
ia.mock.ts `consultarCota`: conta TODAS as gerações já registradas em `ia_geracoes` (sem filtrar mês nem escola) contra `cota_ia_mensal` (200). Depois da 200ª geração de todos os tempos a IA trava para sempre até alguém apagar o registro. Além disso `ia_geracoes` não faz parte do tipo do banco (é acessada por cast) e cada professor/escola divide o mesmo contador.
Como o usuário vê: "Limite de gerações do mês atingido" em pleno mês novo. Correção: filtrar por escola e mês corrente.

## A8. Correção discursiva com nota 0–100: fora do combinado — MÉDIA (decidido: valem os dois, botões 100/75/50/0 e nota livre)
professor.mock.ts `corrigirResposta(respostaId, correcao, comentario?, nota?)` aceita nota de 0 a 100 e converte em pontuação proporcional; 100 vira "certo", 0 vira "errado" (e o teste mostra `'parcial'` + 100 virando `'certo'`). A decisão registrada era "Parcial fixa em 0,5", e o relatório do Antigravity também descreve só Certo/Parcial/Errado. Não é um defeito nas médias (cálculo confere), mas é escopo novo sem registro, e explica a ambiguidade `nota` vs `pontuacao` (A12).

## A9. Observações pedagógicas: quem vê o quê — MÉDIA (decidido: só professores da turma + direção/coordenação; feito)
professor.mock.ts: `listarObservacoesAluno` exigia só ser professor/direção/coordenação logado. Qualquer professor da escola lia as observações de QUALQUER aluno, mesmo de turma em que não leciona. O código assume 1 observação por professor por aluno; o banco não garante (B4).
Dado sensível de criança; definir a regra antes de usar com alunos reais.

## A10. Aluno: resposta discursiva sem rascunho e sem confirmação — RESOLVIDO (conferido em 03/10)
AlunoAtividadePage: rascunho local e confirmação antes de enviar. Ainda vale conferir que o "sair" limpa o token do aluno (`saberpontual_aluno_token` em localStorage) e que o token expira, para o próximo aluno não entrar na sessão do anterior.

## A11. Gabarito visível para aluno esperto — MÉDIA (arquitetura, conhecida)
No mock e no modo Supabase atual o banco inteiro (inclusive `alternativas.correta`, `por_que_errou`, `resposta_esperada`) fica no navegador (localStorage/DevTools) ou na tabela aberta. A regra 6 do AGENTS.md vale na interface e no serviço (conferi: `resposta_esperada` só sai após correção), mas não nos dados. Só a etapa de segurança resolve (RLS por papel + Edge Functions). Registrar como risco aceito enquanto for demo.

## A12. Menores
- Discursiva sem resposta em atividade encerrada conta 0 (correto pela regra), mas a tela do aluno recebe `acertou: false` (aluno.mock.ts ~linha 369), o que pode aparecer como "errou" em vez de "não respondeu". (verificar na tela)
- `nota` (aluno.mock.ts) trata pontuação <= 1 como fração e `pontuacaoDaResposta` (calculos.ts) trata > 1 como percentual, de forma oposta. Com nota livre (A8) há valores que caem na zona ambígua (ex.: pontuação 1 = 100% ou 1%?).

---

# PARTE B — Problemas que ficam só no back end (código, banco, testes, segurança)

## B1. RLS aberta em todas as tabelas — ALTA (decidido na auditoria-07 só para teste)
Migrations 0001 e 0002: todas as tabelas com `USING (true) WITH CHECK (true)` para `anon`. A anon key vai no JavaScript público; qualquer pessoa com a URL do site lê, altera e apaga tudo (alunos, `pin_hash`, respostas, observações).
Regra: nenhum dado real de aluno (LGPD, menores) até a etapa de segurança.

## B2. Senhas em texto puro dentro do store da nuvem — ALTA
seed.ts (`credenciais`, "senha pura") e db.ts: `saberpontual_store.payload` guarda `credenciais` (e-mail → senha) e é enviado ao Supabase (linha 383) numa tabela aberta (B1). Hoje são demo123, mas qualquer senha trocada em `alterarSenha` vai para lá em texto puro.
Correção: nunca gravar senha; usar Supabase Auth e tirar `credenciais` do payload.

## B3. Duas fontes da verdade no Supabase — MÉDIA
`sincronizarParaSupabase` grava o banco inteiro em `saberpontual_store` E faz upsert nas tabelas relacionais, sem nunca apagar linhas. As duas divergem depois de qualquer exclusão (causa técnica do A1). Cada salvar envia o banco inteiro (com imagens base64) e há polling de 10 s baixando tudo por cliente: não escala.

## B4. Migrations — inconsistências — MÉDIA
- `aluno_observacoes`: sem `UNIQUE(aluno_id, professor_id)`; `professor_nome` duplicado.
- `questoes`: `dificuldade` sem CHECK; `banco_questao_id` e `assunto_id` sem FK; `criado_por`/`autor_id` sem FK.
- `alunos`: sem `UNIQUE(turma_id, numero_chamada)`.
- `ia_geracoes`: `escola_id` e `professor_id` sem FK; sem índice por escola/mês (necessário para a cota, A7).
- O relatório diz que `questoes` ganhou `origem`; na migration só `banco_questoes` tem `origem` (tipo `OrigemQuestao` = 'manual' | 'ia', sem 'banco', o que resolve a dúvida da auditoria-06).
- Tabelas que existem só dentro do store (aluno_sessoes, pin_tentativas, conselho): sem migration, sem RLS.

## B5. Bloqueio de PIN só no navegador — MÉDIA
aluno.mock.ts: as 5 tentativas erradas ficam em `pin_tentativas` no banco local; limpar o localStorage zera o bloqueio. No merge o array é concatenado sem remover duplicados e só cresce. Precisa ir para o servidor.

## B6. Chave do Gemini no navegador — ALTA para deploy
ia.mock.ts: chave em `VITE_GEMINI_API_KEY` (entra no bundle público) ou no localStorage, e ainda vai na URL (`?key=`) de cada chamada. Ok só para teste local. Em produção só via Edge Function (spec 9.7). Não enviar fotos com dados de alunos.

## B7. Dependências (regra 11) — BAIXA (@types/katex movido para dev em 7865005)
`katex` ^0.18.9 foi adicionado sem aprovação registrada (verificar no npm).

## B8. Qualidade do código — BAIXA/MÉDIA
- A lógica "discursiva pendente → aguardando correção" estava copiada em vários lugares (calculos.ts, aluno.mock.ts, professor.mock.ts x2, relatorio.mock.ts x3). Função única estaAguardandoCorrecao criada em calculos.ts (7865005); conferir professor.mock.ts e relatorio.mock.ts.
- Arquivos muito grandes: ProfessorOfertaPage (~97 KB), ProfessorAtividadePage (~85 KB), ProfessorResultadosPage (~85 KB), ProfessorDashboardPage (~64 KB), AlunoAtividadePage (~69 KB), ia.mock.ts (~50 KB), seed-escola-ampliada (~68 KB). Difíceis de auditar e caros de editar.
- `isTestEnvironment` (navigator.webdriver) põe lógica de teste no código de produção.
- Classes `Supabase*ServiceStub` herdam o mock; nome enganoso.
- Bom: KaTeX sem `dangerouslySetInnerHTML` (MathText.tsx confere), só um `any` em src/scripts/seed-supabase.ts (regra 5), .env no .gitignore.

## B9. Testes — MÉDIA (novo)
- Contagem confere: 8+9+6+12+12 mais telas (4 testes x 2 viewports = 8) = 55 E2E. Sem `skip`/`only`/`fixme`. (03/10: 55/55 no seed pequeno.)
- Nenhum E2E cobre discursiva de ponta a ponta (aluno digita → professor corrige → média). Só uma checagem visual em banco.spec.ts. O caminho crítico da fase H fica coberto só pelos testes Vitest de discursiva (discursiva.test.ts: certo, parcial 0,5, errado, nota 0–100, pendente fora da média).
- Os specs E2E não foram alterados desde antes das maiores mudanças; antes de confiar, rodar a suíte inteira uma vez (com autorização do Wagner, regra 10).

## B10. Seed ampliada — BAIXA
seed-escola-ampliada.ts: alunos extras com nomes fictícios (ok) e TODOS com o mesmo PIN 1234 (aceitável em demo; nunca em dado real). Sem risco de dado pessoal real.

## B11. Relatório do Antigravity — precisão
- Descreve H2 (compressão, upload no editor/banco/player) de forma que o código não sustenta (A4).
- Diz "certo/parcial/errado" sem mencionar a nota 0–100 (A8).
- Diz que `questoes` tem `origem` (B4) e que a resposta esperada fica oculta "até correção ou encerramento" (o código só libera após correção, mais restritivo).
- Tratar os números de build/testes como "informados", não verificados.

## B12. Processo
- O commit da13949 mistura IA, conselho de classe, observações (migration 0002), mascote, seed ampliada e portais. Regra 2 do AGENTS.md e o processo de comandos pequenos não foram seguidos; conselho/observações não estão na ESPECIFICACAO (registrar na spec ou remover).
- Não reescrever `da13949`. Daqui em diante, um commit por assunto com `git add` explícito.

---

# Ordem sugerida
1. A4 + A5: limitar/reduzir imagens e avisar quando a gravação falhar (pequeno, visível e evita perda de dados agora).
2. A7 (cota mensal de verdade; adiado).
3. A8: alinhar A12 (nota vs pontuação).
4. B9: rodar a suíte E2E inteira uma vez com autorização.
5. A1, A2, A3 e B3 andam juntos: decidir o modelo de sincronização (escrita por linha, com exclusão e data por registro) antes de qualquer piloto com mais de uma pessoa ao mesmo tempo.
6. B1, B2, B5, B6 (+ A11): etapa de segurança do Supabase, antes de qualquer dado real.
7. B4, B8, B10: comandos pequenos.

# Não verificado
Build, testes Vitest e E2E rodados por mim; comportamento real com 2 navegadores (A1 a A3); as telas Oferta, Resultados, Dashboard e a seção Conselho (lidas só por busca); a tela do Banco para confirmar que não existe upload manual de imagem (A4).
