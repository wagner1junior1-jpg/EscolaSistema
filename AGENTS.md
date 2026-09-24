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
10. NUNCA faça commit nem push. Ao terminar cada tarefa: rode "npm run build", "npm test" e "npm run e2e" e PARE. Responda de forma CURTA, SEM colar código nem diff (o auditor lê os arquivos direto na pasta): (a) a saída de "git status --short"; (b) a saída de "git diff --stat"; (c) uma linha "BUILD OK — 0 erros" ou "BUILD FALHOU — <erro>", outra "TESTES: X passando, Y falhando" e outra "E2E: X passando, Y falhando"; (d) a tabela curta dos cenários E2E (cenário | passou/falhou | arquivo da evidência); (e) em no máximo 5 linhas, o que ficou de fora e as dúvidas. Não escreva avaliação do prompt. O commit só é feito depois da aprovação do Wagner, com o comando de commit que ele mandar.
11. Não altere, crie nem apague arquivos que a tarefa não pediu. Isso inclui package.json, package-lock.json, arquivos de configuração e arquivos soltos. Se precisar instalar uma dependência que a tarefa não citou, PARE e pergunte.
12. Testes de uso real são automáticos (Playwright, em app/e2e/). É PROIBIDO relatar um teste como feito sem ter rodado. Se um E2E falhar, NÃO altere o teste para passar: relate a falha e o motivo. Só ajuste um teste quando o próprio teste estiver errado, explicando no item (e). As evidências (capturas de tela) ficam em app/e2e/evidencias/ e não vão para o git.
13. Não altere o AGENTS.md nem o docs/ESPECIFICACAO.md (quem altera é o auditor).
