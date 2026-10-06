# Auditoria 07 — Supabase já ligado (26/09/2026)

O Wagner informou que o Supabase está funcionando. A migration `supabase/migrations/0001_schema_completo.sql` (feita pelo Antigravity, sem revisão) mostra:

## Problema crítico de segurança
- A tabela `saberpontual_store` guarda o banco inteiro do mock num único JSON (payload, id 'global').
- Essa tabela e TODAS as outras 16 têm a política `FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`.
- A chave anon vai dentro do JavaScript do site. Então qualquer pessoa com o endereço do site consegue:
  - ler todos os alunos, os pin_hash (SHA-256 de 4 dígitos, que se quebra na hora), os gabaritos, as explicações e as respostas;
  - apagar ou alterar tudo.
- Isso anula as regras 6 e 7 do AGENTS.md e as seções 3 e 5 da spec: o aluno não usa RPC, não existe login real e não há RLS por papel.
- Os ids são text, não uuid. Não existem aluno_sessoes, pin_tentativas, atividade_alunos nem as RPCs do aluno.

## Consequência
- Serve SÓ para testar com dados fictícios, num endereço que ninguém conhece.
- NUNCA cadastrar alunos reais, nem publicar o link para a escola, enquanto isso não for refeito.
- A migração correta (Fase A2 da spec) é uma etapa própria, em comandos pequenos:
  - Auth real para a equipe;
  - RLS por escola e por papel;
  - RPCs SECURITY DEFINER do aluno, com o PIN em bcrypt;
  - Edge Function da IA;
  - Storage privado para as imagens.
  Quando estiver pronta, apagar `saberpontual_store`.

## Perguntas feitas ao Wagner
- Há dados reais de alunos no Supabase?
- O site está publicado em algum endereço (Vercel etc.)?
