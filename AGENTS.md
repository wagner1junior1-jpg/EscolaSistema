# Regras do projeto SaberPontual
1. docs/ESPECIFICACAO.md é a fonte da verdade. Não mude stack, modelo de dados, nomes de tabelas/campos ou escopo sem aprovação explícita do Wagner. Se achar que a especificação está errada, PARE e pergunte.
2. Faça SOMENTE o que a tarefa pede. Não adicione funcionalidades, telas, bibliotecas ou refatorações não pedidas. Nada da seção "Fora do escopo".
3. A pasta prototipo/ é somente leitura (referência visual).
4. Componentes React nunca acessam dados diretamente; tudo passa pelas interfaces de app/src/services/.
5. TypeScript strict, sem "any". Nunca use dangerouslySetInnerHTML.
6. Nunca envie ao aluno a alternativa correta, o por_que_errou ou a explicação antes de ele responder. Isso vale para o mock e para o Supabase.
7. Toda tabela nova tem RLS ativado e políticas na mesma migration.
8. Nunca commite chaves: use .env (no .gitignore) e .env.example.
9. Todos os textos da interface em português do Brasil.
10. NUNCA faça commit nem push. Ao terminar cada tarefa, rode "npm run build" e "npm test" UMA vez (se falhar, corrija e rode de novo só o que falhou) e PARE. NÃO rode "npm run e2e" (Playwright) por padrão: só quando o comando da tarefa disser "rode o E2E", e apenas as specs citadas; a suíte inteira só com autorização explícita do Wagner. Responda de forma CURTA, SEM colar código nem diff (o auditor lê os arquivos direto na pasta): (a) a saída de "git status --short"; (b) uma linha "BUILD OK — 0 erros" ou "BUILD FALHOU — <erro>" e outra "TESTES: X passando, Y falhando"; (c) só se o E2E foi pedido: uma linha "E2E: X passando, Y falhando" e a tabela curta dos cenários que falharam (cenário | motivo | arquivo da evidência); (d) em no máximo 5 linhas, o que ficou de fora e as dúvidas. Não escreva avaliação do prompt. Se o build falhar em arquivo fora da lista permitida pela tarefa, NÃO conserte: só relate (outra conversa pode estar mexendo nele). O commit só é feito depois da aprovação do Wagner, com o comando de commit que ele mandar.
11. Não altere, crie nem apague arquivos que a tarefa não pediu. Isso inclui package.json, package-lock.json, arquivos de configuração e arquivos soltos. Se precisar instalar uma dependência que a tarefa não citou, PARE e pergunte.
12. Testes de uso real são automáticos (Playwright, em app/e2e/). É PROIBIDO relatar um teste como feito sem ter rodado. Se um E2E falhar, NÃO altere o teste para passar: relate a falha e o motivo. Só ajuste um teste quando o próprio teste estiver errado, explicando no item (e). As evidências (capturas de tela) ficam em app/e2e/evidencias/ e não vão para o git.
13. Não altere o AGENTS.md nem o docs/ESPECIFICACAO.md (quem altera é o auditor).
