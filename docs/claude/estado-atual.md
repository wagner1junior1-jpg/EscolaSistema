# Estado atual — SaberPontual (para retomar numa conversa nova)

Atualizado em 06/10/2026 (versão 10: teste de uso do prazo vencido/WTJ/69% concluído; meta do bimestre mostra "não entregues"; baseUrl removido do tsconfig).

## LEIA PRIMEIRO (se você é o Claude no VS Code)
- Estes documentos ficam em docs/claude/ no repositório (cópia dos documentos do projeto do claude.ai). Fonte da verdade do código/escopo: docs/ESPECIFICACAO.md e AGENTS.md.
- Até 04/10 o fluxo era: Wagner decide; Antigravity escreve código; Claude (no claude.ai) audita, escreve comandos e testa o uso no navegador. No VS Code o Claude pode ler e editar o código, rodar build/testes e usar git DIRETAMENTE, mas só depois de combinar com o Wagner (as regras do AGENTS.md 10 e 13 foram escritas para o Antigravity: não commitar/pushar sem o OK do Wagner, não mexer em AGENTS.md/ESPECIFICACAO sem ele).
- Regras de ouro que continuam: commit só com OK do Wagner e `git add` explícito (nunca `git add .`); nunca git checkout/restore/reset/stash; push só com OK; trailers de commit: Co-Authored-By e Claude-Session; textos da interface em português do Brasil; dados de demo só fictícios.
- Antes de qualquer commit: `git branch --show-current` e `git status -sb` (houve conversas paralelas e um commit levou arquivos que estavam no stage — 8bd092e).

## Como trabalhamos (combinado com o Wagner)
- Foco atual (decidido em 03/10): USO primeiro (testar fluxos reais e consertar o que atrapalha o uso), visual só se atrapalhar.
- Em cada plano, dizer quem faz o item.
- Commit em 2 passos, um por vez: (1) `git add` + `git status --short`; (2) `git commit` + `git log --oneline -1` + `git status --short`.
- Teste de uso: navegador em http://localhost:5173/ com `npm run dev`; usuários demo abaixo.
- Ao citar números num comando, não abreviar.

## Execução do plano de 06/10 (Claude escreveu o código)
- Plano: plano-06-10.md. Relatório completo: relatorio-06-10.md. Commits LOCAIS (NÃO enviados; push só com OK do Wagner): 572fe29 (média do período do Conselho estava /100: 0,7% em vez de ~73%), 6f305fd (sem contagem regressiva de prazo em atividade concluída), 471ed31 (função única discursivaPendente), 90bda88 (KPIs do painel do professor no celular). Build OK, 243 testes.
- Parte 2 do teste de uso (A criar atividade, B aluno responde, C Banco, D Gerar com IA, E "Salvo neste aparelho", F Gestão, G observações): tudo OK. G só pareceu falha porque na base ampliada o Carlos leciona no 7A (turma do Lucas); o bloqueio funciona para outra turma.
- A4 (fotos) e A5 (localStorage cheio) já estavam resolvidos no código; a auditoria 08 está desatualizada nesses dois pontos.
- "6º Ano A" com código 7A-MAT é intencional (base ampliada); código é herança do seed antigo.
- Pasta app/scratch/ (scripts de teste) está fora do git; sugestão: ignorar no .gitignore (decisão do Wagner).

## Onde paramos (06/10/2026, antes do plano)
- Branch **main**, igual à origin/main. Último commit: **3059220** "fix(aluno): meta do bimestre mostra as atividades não entregues". Commits desta sessão (todos no GitHub): ec85fa8 (professora amplia o prazo e reabre para quem não concluiu), 4a3493e (vencida e não feita não conta na meta nem no XP), 50489f2 (prazos do seed relativos a hoje, E2E atualizados), af07127 (remove baseUrl do tsconfig; paths agora "./src/*"), 3059220 (indicador "N para fazer • M não entregues • T no total"). Build OK e 234 testes.
- Teste de uso de 06/10 (feito pelo Antigravity, sem editar código): PASSARAM prazo vencido em "Concluídas" com chip "Prazo encerrado" e botão "Ver" (aviso sem campos de resposta); concluída com prazo vencido abre "Ver resultado" sem bloqueio; "Produção e Coesão" 69% inteiro (acertos 2,75); vencida e não feita fora da meta e do XP; assinatura WTJ em desktop e 360px (só na "/"); ampliar o prazo reabre para quem não fez e mantém concluída para quem fez.
- Regra da meta (conferida): concluídas = só as feitas; "para fazer" = abertas e em dia; "não entregues" = vencidas não feitas + encerradas incompletas (ex.: "Prova: Números Inteiros (encerrada)", 1 de 3); total = todas. Aba "Concluídas" é histórico (feitas + encerradas + vencidas), por isso tem mais itens que a meta.
- Atenção ao revisar o Antigravity: em 06/10 ele relatou uma edição em gamificacao.ts que não estava no disco; conferir sempre `git status` e o build antes de commitar.
- Nota: os prazos do seed são relativos à data de hoje, então os números do painel mudam com o dia (em 06/10 o Lucas apareceu com 8 concluídas, 5 para fazer, 1 não entregue, 14 no total).

## Onde paramos (04/10/2026)
- Branch: **main**, igual à origin/main (push feito em 04/10). Último commit: **2213a65** "fix(aluno): nota da discursiva é fração 0–1" (a nota da discursiva é GRAVADA como fração, 75 vira 0,75 em professor.mock.ts; calcularPlacar aceita 0,75 e 75). Testado no navegador em 04/10: antes da correção 67% (1 aguardando); depois da nota 75, painel 69% e resultado 69% com acertos 2,75; assinatura WTJ OK em desktop e 360px (aparece só na tela inicial "/"). Dica de teste: o navegador automatizado (webdriver) recebe a base pequena; para ver "Produção e Coesão" é preciso mascarar navigator.webdriver. Antes: **48e6a7a** "fix(aluno): discursiva corrigida entra no aproveitamento do exercício e aproveitamento sempre inteiro" (COMANDO 2 aplicado; build OK e 219 testes) e **af2ad3e** "feat: assinatura WTJ Soluções Tecnológicas na tela de entrada" (ver decisao-identidade-wtj.md). Visual da assinatura ainda não conferido no navegador (desktop e 360px). CLAUDE.md e docs/claude/ ainda não estão no git (Wagner decide).
- Divisão de trabalho (04/10): Antigravity escreve o código e roda build/testes; Claude escreve o comando, revisa o diff e atualiza docs; commit/push só com OK do Wagner.
- Commits recentes: 8a7d573 (visual celular), 7865005, 07eed1f, e94ed2f (playwright base mock), 5121a1b (discursiva pendente fora da média), **8bd092e** "chore: finaliza fase H e prepara deploy" (já no GitHub; levou junto, por causa do stage, o PRAZO VENCIDO: calculos.ts prazoVencido, types.ts prazo_vencido, aluno.mock.ts, AlunoPainelPage.tsx, AlunoAtividadePage.tsx e testes; também mexeu nos dois .gitignore). Não reescrever (já no GitHub).
- Claude ainda NÃO conferiu o código do prazo vencido nem testou no navegador. Ponto de risco: atividade CONCLUÍDA com prazo vencido tem que continuar abrindo "Ver resultado" (a tela de bloqueio usa `prazoVencido && !exibirTelaFinal`).
- Teste de uso: ver teste-de-uso-03-10.md (segunda rodada: professora corrigiu a discursiva do Lucas com nota 75).
- V5 (contraste dos campos travados): resposta do Antigravity não recebida.

## Em andamento
- COMANDO 2: FEITO em 04/10 (commit 48e6a7a). Falta só conferir no navegador: "Produção e Coesão" do Lucas deve mostrar 69% no painel e na tela de resultado. Regras aplicadas: nota da discursiva sempre 0–100 (dividida por 100), pendente fora, aproveitamento inteiro. Texto original do comando, para referência: aproveitamento do exercício com discursiva corrigida. Problemas: painel mostra 68.8% (decimal) em "Produção e Coesão" do Lucas; tela de resultado do exercício mostra 50%, acertos 2, erros 2 (conta a discursiva de 75 como erro). Esperado 69% (2,75 de 4). Causa: calcularPlacar (app/src/features/aluno/utils/placar.ts) só considera `acertou === true`. Correção: pontuação da discursiva corrigida entra, pendente fica fora (aproveitamento sobre as questões já corrigidas), aproveitamento sempre inteiro (Math.round) em calcularPlacar, calcularAproveitamentoAtividade e chip do painel; testes: 69 com 3 objetivas (2 certas) + discursiva 75; 67 com a discursiva pendente; sem discursiva igual ao de antes. Arquivos: features/aluno/utils/placar.ts, AlunoAtividadePage.tsx (useMemo placarExercicio passa tipo/pontuacao/correcao; "Acertos" pode ser decimal com vírgula, ex. 2,75), AlunoPainelPage.tsx, services/calculos.ts, testes.

## Decisões pendentes do Wagner
1. (Resolvido em 04/10: push do af2ad3e e 48e6a7a feito.) Falta conferir a identidade WTJ no navegador.
2. O 8bd092e mexeu nos .gitignore: confirmar que foi intencional.
3. Destino de conselho de classe/observações na spec.
4. Landing comercial (mockup separado): entra neste repositório ou num site à parte?

## Decisões já tomadas
- Identidade WTJ na tela de entrada: opção A, assinatura discreta no fim do cartão (decisao-identidade-wtj.md). Contato só WhatsApp (62) 99254-9588; sem e-mail e sem CNPJ.
- IA sem limite por enquanto (IA_SEM_LIMITE = true em ia.mock.ts). Ao religar: limite definido pela ESCOLA, campo editável só pela direção, contar só mês e escola.
- Discursiva: valem os dois (botões 100/75/50/0 e nota livre 0–100). Pendente fica fora da média.
- Prazo vencido (decidido em 03/10): atividade vencida e não concluída sai de "Para fazer", vai para "Concluídas" com chip "Prazo encerrado" e botão "Ver"; aluno não responde mais; professora reabre ampliando o prazo (conferir se a edição do prazo pela professora existe e funciona).
- Observações do aluno: só professores da turma + direção/coordenação (feito).
- Anexar imagem manual numa questão: não é prioridade.
- Back end (sincronização, RLS, senhas, PIN, chave Gemini, LGPD, deploy) só depois que a escola autorizar. Demo só com dados fictícios. Supabase só para testes; antes de dados reais: etapa de segurança e girar a anon key.
- .env.example: padrão `supabase`, com comentário indicando `mock`. E2E sempre na base mock (já fixado no playwright.config.ts). E2E só com autorização do Wagner.
- Repositório do GitHub: PRIVADO (conferido em 03/10).

## Próximos passos
1. (Feito) Comando 2 aplicado e no GitHub (48e6a7a).
2. (Feito em 06/10) Teste no navegador do prazo vencido, 69% e assinatura WTJ.
3. (Feito em 06/10) Professora amplia o prazo e reabre.
4. Continuar o teste de uso: estado "Salvo neste aparelho", criar atividade, Banco de questões, Gerar com IA, Gestão (direção/coordenação). "Restaurar dados de demonstração" na tela de login da equipe limpa a nota 75 do Lucas.
5. Backlog pequeno: unificar a regra de discursiva pendente em professor.mock.ts e relatorio.mock.ts; painel do aluno mostra "6º ANO A" para a turma 7A-MAT (conferir rótulo do seed); aviso do mural cita prova de Ciências com nome diferente da lista do aluno.
5b. Backlog novo (06/10): chip "Restam 2 dias" aparece em atividade já concluída ("Produção e Coesão"); só detalhe visual.
6. Visual (baixa prioridade): 3º KPI do painel do professor sozinho na 2ª linha em 390px; rótulos dos KPIs cortados com reticências; favicon com a marca WTJ (opcional).
7. Depois da escola autorizar: sincronização (A1–A3, B3), segurança, cota de IA, H5 reforço, LGPD, deploy.

Pasta local: C:\Users\Wagner\Downloads\SISTEMAS\Comercial\SISTEMA ESCOLAR\Escola

Usuários demo (senha demo123): direcao@, coordenacao@, ana@, carlos@demo.com. Turma 7A-MAT (22 alunos); PINs: Lucas 1420, Beatriz 3891, Gabriel 7254, Mariana 5012. Demais alunos da escola ampliada: PIN 1234.
