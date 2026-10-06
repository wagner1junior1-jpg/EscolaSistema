# Plano de trabalho do Claude — 06/10/2026

Decisão do Wagner (06/10): hoje o Claude escreve o código, testa, deixa pronto e segue para a próxima etapa; no final audita, corrige as falhas e gera um relatório. Só começa depois que o Antigravity terminar o teste de uso (parte 2) e o Wagner der o OK.

## Fora do plano (não fazer)
- Back end (sincronização, RLS, senhas, PIN, chave Gemini, LGPD, deploy): só com a escola autorizando.
- Decisões do Wagner: .gitignore do 8bd092e, destino de conselho de classe, landing comercial.
- Suíte E2E/Playwright: só com autorização do Wagner. Scripts avulsos de navegador para conferir tela são permitidos.
- Não mudar AGENTS.md, ESPECIFICACAO.md, stack, modelo de dados ou escopo.

## Regras de execução
- Antes de cada etapa: `git branch --show-current` e `git status -sb`.
- Cada etapa: ler o código afetado, implementar o mínimo, escrever testes, rodar `npm run build` e `npm test` UMA vez no fim da etapa.
- Commit: um por etapa, `git add` com arquivos explícitos (nunca `git add .`), nunca checkout/restore/reset/stash. AUTORIZADO pelo Wagner em 06/10: commitar localmente sem pedir a cada vez. PROIBIDO: push (só com OK explícito do Wagner depois do relatório final).
- Textos da interface em português do Brasil; dados de demo só fictícios.
- Se uma etapa esbarrar em decisão de produto, parar nela, anotar no relatório e seguir para a próxima.

## Etapa 0 — Portão
1. Receber o relatório da parte 2 do teste de uso (itens A–G).
2. Separar o que é bug que atrapalha o uso do que é detalhe.
3. Wagner dá o OK para começar.

## Etapa 1 — Bugs achados na parte 2 do teste
Tudo o que o teste marcar FALHOU ou PARCIAL e atrapalhar o uso, na ordem de gravidade. Se não houver, pular.

## Etapa 2 — A5: estouro do localStorage sem aviso
- Achar onde o mock grava (services/mock/db.ts) e como falha hoje quando o localStorage enche.
- Capturar o erro de gravação (QuotaExceededError) e mostrar um aviso claro em português ao usuário, sem perder o que já está na tela.
- Teste unitário simulando o estouro.

## Etapa 3 — A4: limite de tamanho das fotos
- Achar onde entram fotos (avatar, perfil, anexos) e limitar o tamanho/dimensão, redimensionando antes de gravar quando possível.
- Mensagem em português quando a imagem for rejeitada.
- Testes unitários da regra de limite. Anexar imagem manual numa questão continua fora (não é prioridade).

## Etapa 4 — Backlog pequeno
1. Unificar a regra de discursiva pendente (fora da média) em professor.mock.ts e relatorio.mock.ts, numa função única com teste.
2. Rótulo "6º ANO A" no painel do aluno da turma 7A-MAT: achar a origem no seed e corrigir.
3. Aviso do mural que cita prova de Ciências com nome diferente da lista do aluno: alinhar o seed.
4. Chip "Restam N dias" some em atividade já concluída.

## Etapa 5 — Visual (baixa prioridade, só se sobrar tempo)
- 3º KPI do painel do professor sozinho na 2ª linha em 390px; rótulos dos KPIs cortados com reticências.
- Conferir por script de navegador em 360px, 390px e desktop.

## Etapa 6 — Auditoria final
1. `git diff origin/main` completo; revisar cada mudança (correção, regras de ouro, texto em português, nada de dado real).
2. `npm run build` e `npm test` finais, com os totais exatos.
3. Conferir no navegador (script) as telas alteradas.
4. Corrigir as falhas achadas e repetir build/testes.
5. Gerar `docs/claude/relatorio-06-10.md`: o que foi feito por etapa, commits, testes, o que ficou de fora e por quê, riscos.
6. Atualizar `docs/claude/estado-atual.md`.
