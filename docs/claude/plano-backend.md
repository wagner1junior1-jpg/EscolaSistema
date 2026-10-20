# Plano do back end real (Supabase) mantendo o modo de teste

Criado em 20/10/2026. Proposta: nada daqui entra na spec sem o OK do Wagner. Contexto: relatório de prontidão (o Supabase atual é cópia do mock, com RLS aberta) e decisões abaixo.

## Princípios
- Três ambientes, um código: **mock** (localStorage, como hoje), **Supabase Teste** (dados fictícios, RLS real) e **Supabase Produção** (projeto separado, só depois da etapa de segurança e da autorização da escola).
- O mock não muda de comportamento. Os serviços Supabase passam a ser independentes (deixam de herdar do mock).
- Nunca editar as migrations 0001 e 0002; usar migrations novas (0003 em diante).
- Sempre checar `{error}` do supabase-js (nada de `catch {}` vazio).
- Regras de ouro do CLAUDE.md continuam: commit só com OK do Wagner, `git add` explícito, E2E só com autorização.

## Legenda
- **[CLAUDE]** o Claude escreve o código aqui, roda build e testes.
- **[ANTIGRAVITY]** o Claude escreve o comando, o Antigravity codifica, o Claude revisa o diff antes do commit.
- **[WAGNER]** decisão ou ação só sua.
- 🆕 **ABRIR CONVERSA NOVA** antes deste passo (o Claude avisa e escreve o resumo de retomada em estado-atual.md).
- 🧠 **SONNET EM HIGH** neste passo (trocar o esforço do modelo; voltar ao normal depois).
- Tamanho: P (um comando), M (2 a 3), G (várias rodadas).

## Decisões pendentes do Wagner (responder na Fase 0)
1. Ids em uuid no Supabase? (recomendado: sim; o mock mantém os ids atuais)
2. Login do aluno por RPCs com token próprio (recomendado) ou JWT customizado via Edge Function?
3. Exclusão lógica (`deleted_at`) em todas as tabelas pedagógicas? (recomendado: sim)
4. Docker e Supabase CLI: NÃO instalados (conferido em 20/10). Testes de RLS rodam no projeto Supabase de teste (fictício), ou instalar Docker + CLI antes da Fase 2 (opcional).
5. Projeto de produção: NÃO criar agora. O sistema segue em modo teste para apresentações. Quando a escola autorizar: criar o projeto de produção, trocar as variáveis de ambiente e desligar o modo teste (faixa de teste, dados de demonstração, atalhos de login demo). Por isso a Fase 1 deve deixar o "modo teste" controlado por uma única configuração.
6. Cota de IA: continua sem limite (religar só na produção).
7. Piloto: sem data; depende da autorização da escola. Hoje não existe nenhum dado real.
8. Anon key: NÃO girar agora (decisão do Wagner, sem dados reais). Girar obrigatoriamente antes de qualquer dado real (Fase 8).

(Decisões 1 a 3 acima: todas SIM, conforme a recomendação. Respondidas em 20/10/2026.)

---

## Fase 0 — Preparação [WAGNER] (P)
1. Conferir se as migrations 0001 e 0002 estão aplicadas e se há dado real no Supabase atual.
2. Responder as decisões acima.
3. (Adiado) Girar a anon key: só antes de dado real, na Fase 8.
4. Autorizar o início da implementação.

Critério: decisões registradas aqui e no estado-atual.md.

## Fase 1 — Separar mock e Supabase (G)
Nenhuma mudança visível para o usuário.

| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 1.1 | Extrair de `mock/db.ts` a sincronização com a nuvem (realtime, polling, `saberpontual_store`, `mesclarDatabases`); o mock volta a ser só localStorage | ANTIGRAVITY | M |
| 1.2 | Interface única de "assinar mudanças, status e forçar sincronização" que a UI usa sem saber a fonte | ANTIGRAVITY | P |
| 1.3 | Stubs Supabase deixam de herdar do mock (lançam "não implementado" até as fases seguintes) | ANTIGRAVITY | P |
| 1.4 | Faixa "AMBIENTE DE TESTE" e checagem de configuração, controladas por UMA variável (ex.: `VITE_MODO_TESTE`); desligá-la remove faixa, atalhos de login demo e "Restaurar dados de demonstração" | ANTIGRAVITY | P |
| 1.5 | Revisar diffs, conferir `git status`, build e testes | CLAUDE | P |

Critério: build OK, 243 testes passando, E2E no mock inalterado (rodar E2E só com autorização).

🆕 **Abrir conversa nova ao terminar a Fase 1** (mudança de assunto: de refatoração para segurança/SQL).

## Fase 2 — Esquema v2 e RLS (G) 🧠 SONNET EM HIGH
Tudo em migration nova `0003`. Esta é a parte mais crítica: feita pelo Claude.

| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 2.1 | Estrutura: ids uuid, `updated_at` automático, `deleted_at`, tabelas `aluno_sessoes`, `pin_tentativas`, ajuste de `ia_geracoes` | CLAUDE 🧠 | M |
| 2.2 | Funções auxiliares `SECURITY DEFINER` (`escola_atual`, `papel_atual`, `professor_da_turma`) | CLAUDE 🧠 | M |
| 2.3 | Políticas RLS por papel (direção/coordenação na escola; professor só nas suas turmas; anônimo sem acesso às tabelas) | CLAUDE 🧠 | G |
| 2.4 | Remover as políticas `USING (true)` e a tabela `saberpontual_store` | CLAUDE 🧠 | P |
| 2.5 | Testes SQL (pgTAP ou script): professor A não vê turma do B; anônimo não lê nada; escola X não vê escola Y | CLAUDE 🧠 | M |

Critério: suíte de testes de RLS passando; tentativa com a anon key a qualquer tabela falha.

## Fase 3 — Autenticação da equipe (M) 🧠 SONNET EM HIGH
| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 3.1 | `SupabaseAuthService` com Supabase Auth; `perfis.id = auth.users.id` | CLAUDE 🧠 | M |
| 3.2 | Edge Function `admin-usuarios` (criar, redefinir senha, desativar professor) com service role só no servidor | CLAUDE 🧠 | M |
| 3.3 | Troca de senha e senha provisória com troca obrigatória no primeiro acesso | CLAUDE | P |
| 3.4 | Script de bootstrap da primeira direção | CLAUDE | P |

Critério: nenhuma senha em texto puro no banco; login real em teste.

## Fase 4 — Portal do aluno seguro (G) 🧠 SONNET EM HIGH
| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 4.1 | RPCs `SECURITY DEFINER`: listar turma, login, atividades, carregar atividade, responder, resultado, desempenho, avisos | CLAUDE 🧠 | M |
| 4.2 | PIN em bcrypt (`pgcrypto`) e bloqueio por tentativas no servidor | CLAUDE 🧠 | M |
| 4.3 | Gabarito protegido: `carregar atividade` nunca devolve `correta`, `por_que_errou` nem explicação; só `responder` devolve, depois da resposta (regra 6 e A11) | CLAUDE 🧠 | M |
| 4.4 | Sessão do aluno com expiração e revogação no servidor | CLAUDE 🧠 | P |
| 4.5 | Testes: ler `alternativas` com a anon key falha; bloqueio de PIN com navegador limpo funciona | CLAUDE 🧠 | M |

Critério: o aluno só acessa o que as RPCs devolvem; o gabarito não aparece no tráfego antes de responder.

🆕 **Abrir conversa nova ao terminar a Fase 4** (fim da parte de segurança; começa a parte volumosa). Voltar o Sonnet ao esforço normal.

## Fase 5 — Serviços da equipe (G)
O Claude faz o primeiro serviço como modelo (5.1); os demais seguem o padrão e vão ao Antigravity. Sempre checar `{error}`.

| # | Serviço | Quem | Tamanho |
|---|---|---|---|
| 5.1 | `GestaoService` (escola, períodos, disciplinas, turmas, ofertas, avisos) — serviço modelo | CLAUDE | M |
| 5.2 | Alunos e PIN (cadastro, lote, redefinir PIN; PIN puro devolvido uma única vez) | CLAUDE 🧠 | M |
| 5.3 | `ProfessorService` (atividades, questões, recados, observações só da turma + direção/coordenação) | ANTIGRAVITY | G |
| 5.4 | Correção de discursiva e mapa de calor (reaproveitar `calculos.ts`) | ANTIGRAVITY | M |
| 5.5 | `RelatorioService` com views ou RPCs no servidor | ANTIGRAVITY | M |
| 5.6 | `BancoService` (banco da escola, filtros por série e assunto) | ANTIGRAVITY | M |
| 5.7 | `AlunoService` Supabase chamando as RPCs da Fase 4 | ANTIGRAVITY | M |
| 5.8 | Testes de contrato rodando nas duas implementações (mock e Supabase) | ANTIGRAVITY | M |
| 5.9 | Revisão de cada diff, build e testes | CLAUDE | contínuo |

Critério: o mesmo comportamento no mock e no Supabase; nenhuma tela acessa dados direto (regra 4).

🧠 Colocar o Sonnet em high de novo apenas nos passos 5.2 e na revisão de qualquer serviço que mexa em permissão.

## Fase 6 — IA e imagens (M)
| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 6.1 | Edge Function `gerar-questoes` com a chave Gemini em segredo do servidor; remover `VITE_GEMINI_API_KEY` do front | CLAUDE 🧠 | M |
| 6.2 | Cota mensal por escola no servidor (`ia_geracoes`) | CLAUDE | P |
| 6.3 | Storage privado para fotos e imagens de questões, URLs assinadas, limite de tamanho | ANTIGRAVITY | M |

## Fase 7 — Dados de teste e validação (M)
| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 7.1 | Reescrever `seed-supabase.ts`: criar usuários no Auth, escola, turmas e alunos fictícios (mesma base ampliada do mock), idempotente | ANTIGRAVITY | M |
| 7.2 | Comando para zerar e recarregar o ambiente de teste | ANTIGRAVITY | P |
| 7.3 | E2E em modo Supabase-teste (direção, coordenação, professor, aluno) — **só com autorização do Wagner** | CLAUDE | M |
| 7.4 | Varredura de telas e teste de uso, como em 06/10 | CLAUDE | P |

🆕 **Abrir conversa nova antes da Fase 8** (revisão final com contexto limpo). 🧠 Sonnet em high na Fase 8.

## Fase 8 — Segurança, LGPD e piloto (G) 🧠 SONNET EM HIGH
| # | Tarefa | Quem | Tamanho |
|---|---|---|---|
| 8.1 | Revisão de segurança: auditar RLS, tentar acesso com a anon key, procurar segredos no bundle | CLAUDE 🧠 | M |
| 8.2 | LGPD para menores: termo, política de privacidade, consentimento do responsável, exportar e apagar dados | WAGNER + CLAUDE (texto) | M |
| 8.3 | Backup e procedimento de restauração | WAGNER + CLAUDE | P |
| 8.4 | Projeto de produção, variáveis por ambiente, deploy (Vercel já tem `vercel.json`) | WAGNER + CLAUDE | M |
| 8.5 | Piloto com uma turma; dado real só depois do aceite da escola | WAGNER | G |

## Resumo: quando abrir conversa nova e quando usar Sonnet em high
| Momento | Conversa nova | Sonnet em high |
|---|---|---|
| Início da implementação (esta conversa já está grande) | 🆕 sim | não |
| Fase 1 (refatoração, Antigravity) | — | não |
| Depois da Fase 1, antes da 2 | 🆕 sim | 🧠 liga na Fase 2 |
| Fases 2, 3 e 4 (RLS, auth, RPCs) | — | 🧠 sim, durante as três |
| Depois da Fase 4 | 🆕 sim | desliga |
| Fase 5 (serviços) | — | só no 5.2 e em revisão de permissão |
| Fase 6 (Edge Function da IA) | — | 🧠 só no 6.1 |
| Fase 7 | — | não |
| Antes da Fase 8 | 🆕 sim | 🧠 liga e fica até o fim |

O Claude avisa em cada ponto marcado com 🆕 ou 🧠, e atualiza `estado-atual.md` antes de você abrir a conversa nova.

## Riscos e cuidados
- Mock e Supabase podem divergir: mitigação com os testes de contrato (5.8) e o mock sempre nos E2E.
- Os ids legíveis do seed viram uuid no Supabase: o mapeamento não pode quebrar as referências cruzadas (turma, oferta, atividade, aluno).
- Os problemas A1–A3 (sincronização otimista) desaparecem no Supabase ao gravar por linha, mas continuam no mock.
- O Antigravity já relatou edição que não estava no disco: conferir sempre `git status` e build antes de commitar.
- Sem Docker/Supabase CLI, os testes de RLS rodam no projeto de teste, com mais cuidado.
- Nenhum dado real de aluno antes da Fase 8 e do aceite da escola.
