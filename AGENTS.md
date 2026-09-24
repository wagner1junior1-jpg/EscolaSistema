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
10. Ao terminar cada tarefa, responda com: (a) arquivos criados/alterados/apagados, (b) resumo do que foi feito, (c) o que ficou de fora e as dúvidas, (d) como testar. Faça um commit git por tarefa e mostre a saída de "git log --oneline -3".
