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
10. NUNCA faça commit nem push. Ao terminar cada tarefa: rode "npm run build" (e "npm test" quando houver testes) e PARE. Responda com: (a) a saída de "git status --short"; (b) o diff completo ("git diff" e o conteúdo dos arquivos novos); (c) uma linha com o resultado do build (ex.: "BUILD OK — 0 erros" ou "BUILD FALHOU — <erro>") e outra com o resultado dos testes; (d) o que ficou de fora e as dúvidas; (e) como testar. O commit só é feito depois da aprovação do Wagner, com o comando de commit que ele mandar.
11. Não altere, crie nem apague arquivos que a tarefa não pediu. Isso inclui package.json, package-lock.json, arquivos de configuração e arquivos soltos. Se precisar instalar uma dependência que a tarefa não citou, PARE e pergunte.
