# SaberPontual — instruções para o Claude (Claude Code / VS Code)

O Wagner é nutricionista e formado em Ciência da Computação. Fale com ele em português do Brasil, de forma curta e clara. Ele decide; você propõe e executa o que ele aprovar.

## Comece por aqui
1. Leia `docs/claude/estado-atual.md`: onde paramos, decisões já tomadas, pendências e próximos passos.
2. As regras do código estão em `AGENTS.md` e `docs/ESPECIFICACAO.md` (fonte da verdade). Não mude stack, modelo de dados, nomes de tabelas/campos ou escopo sem aprovação do Wagner. `AGENTS.md` e `ESPECIFICACAO.md` só mudam com ele.
3. O processo de trabalho está em `docs/claude/processo-de-trabalho.md`.

## Adaptação para o Claude Code
As regras 10 e 13 do `AGENTS.md` foram escritas para o Antigravity (que só edita e roda build/testes). No VS Code, você pode:
- ler e editar o código, rodar `npm run build` e `npm test` (UMA vez no final de cada tarefa; E2E/Playwright só com autorização do Wagner) e usar `git status`, `git diff` e `git log`;
- NÃO commitar nem fazer push sem o OK explícito do Wagner naquela hora;
- sempre `git add` com arquivos explícitos (nunca `git add .`);
- NUNCA usar `git checkout`, `git restore`, `git reset` nem `git stash`;
- antes de qualquer commit: `git branch --show-current` e `git status -sb` (outra conversa pode ter commitado ou deixado arquivos no stage);
- trailers nos commits: `Co-Authored-By: Claude <noreply@anthropic.com>` e, se houver, o `Claude-Session`.

## Regras de ouro do produto
- Aluno nunca recebe a alternativa correta, o `por_que_errou` nem a explicação antes de responder (regra 6).
- Discursiva pendente fica fora da média; aproveitamento é sempre inteiro.
- Textos da interface em português do Brasil.
- Dados de demonstração só fictícios; nenhum dado real de aluno antes da etapa de segurança (RLS aberta no Supabase de teste).
- Back end (sincronização, RLS, senhas, PIN, chave Gemini, LGPD, deploy) só depois que a escola autorizar.

## Documentos em docs/claude/
- `estado-atual.md`: ler sempre primeiro e ATUALIZAR no fim de cada sessão (data, commits, pendências).
- `teste-de-uso-03-10.md`: teste de uso no navegador (problemas achados e resolvidos).
- `decisao-identidade-wtj.md`: assinatura WTJ na tela de entrada.
- `auditoria-08-geral-pos-commit-grande.md`: backlog geral (problemas de uso A1–A12 e de back end B1–B12). Ainda é a lista de pendências mais completa.
- `auditoria-01` a `auditoria-07`: histórico das auditorias anteriores.
- `roadmap-premium.md`: ideias de recursos premium (proposta, nada entra na spec sem o Wagner).
- `comandos-ia-questoes.md`: especificação dos 3 comandos da IA de questões (prompt, validação, tela).
- `processo-de-trabalho.md`: como o trabalho era dividido entre Wagner, Antigravity e Claude.

## Teste de uso
`npm run dev` em `app/` e abrir http://localhost:5173/. Usuários demo (senha demo123): direcao@, coordenacao@, ana@, carlos@demo.com (todos @demo.com). Turma 7A-MAT; PINs de teste: Lucas 1420, Beatriz 3891, Gabriel 7254, Mariana 5012; demais alunos 1234. "Restaurar dados de demonstração" na tela de login da equipe limpa os dados locais.
