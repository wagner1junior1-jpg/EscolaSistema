# SaberPontual — Especificação Técnica (fonte da verdade)

> Este documento define O QUE construir. Qualquer mudança de modelo de dados, stack ou escopo precisa ser aprovada pelo Wagner antes de implementar.
> O protótipo antigo (pasta `prototipo/`) serve só como referência visual e de fluxo.

## 0. Escopo do produto

SaberPontual é uma **plataforma de questões** para escolas. Tem três portais:
1. **Aluno**: entra com código da turma + PIN, resolve as atividades e vê os avisos e o próprio desempenho.
2. **Professor**: cria atividades e questões, acompanha acertos e erros (mapa de calor, desempenho da turma, ficha do aluno) e manda recados para a turma.
3. **Gestão escolar** (direção e coordenação): cadastros (turmas, disciplinas, professores, alunos, períodos), visão de desempenho da escola e mural institucional.

Não fazem parte do produto: frequência/chamada, conselho de classe e um acesso separado para pais ou responsáveis.

## 1. Stack (fixa)

- Front-end: Vite + React 18 + TypeScript (strict) + Tailwind CSS (instalado via npm, sem CDN)
- Rotas: react-router-dom
- Dados/servidor: Supabase (Postgres + Auth + Row Level Security + funções RPC)
- Cliente: @supabase/supabase-js
- Formulários/validação: react-hook-form + zod
- Ícones: lucide-react
- Testes: Vitest (lógica) + testes SQL das políticas RLS quando possível
- Hospedagem: Vercel (front) + Supabase Cloud (back)
- Nada de localStorage para dados de negócio. localStorage só para preferências de UI e token de sessão do aluno (exceção: adaptador mock, ver 7.1).

## 2. Estrutura de pastas

```
SISTEMA ESCOLAR/
├── AGENTS.md
├── docs/ESPECIFICACAO.md
├── prototipo/                 # protótipo antigo, não editar
├── supabase/
│   ├── migrations/            # SQL numerado: 0001_schema.sql, 0002_rls.sql, ...
│   └── seed.sql               # dados de demonstração
└── app/
    ├── src/
    │   ├── lib/               # supabase.ts, tipos gerados, utilidades
    │   ├── services/          # ÚNICO lugar que acessa dados: contratos + mock/ + supabase/
    │   ├── features/
    │   │   ├── auth/          # login professor/direção, login aluno
    │   │   ├── aluno/         # painel do aluno
    │   │   ├── professor/     # turmas, atividades, questões, mural, diagnóstico
    │   │   └── gestao/        # direção/coordenação
    │   ├── components/ui/     # botões, inputs, modal, toast, tabela, card
    │   └── routes.tsx
    └── .env.example           # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## 3. Perfis e acesso

| Perfil | Como entra | O que pode |
|---|---|---|
| direcao | e-mail + senha (Supabase Auth) | tudo da sua escola: config, períodos, turmas, disciplinas, professores, avisos da escola, relatórios |
| coordenacao | e-mail + senha | igual à direção, exceto configurações da escola e gestão de usuários de direção |
| professor | e-mail + senha | só as ofertas (turma+disciplina) dele: alunos (ver/PIN), atividades, questões, recados, diagnóstico e desempenho |
| aluno | código da turma → escolhe nome → PIN 4 dígitos | resolver atividades publicadas das suas turmas, ver avisos, ver o próprio boletim |

Regras:
- Toda tabela tem RLS ativado. Nenhuma tabela é legível pela chave anon sem política.
- Aluno NÃO usa Supabase Auth. Ele acessa só via funções RPC `SECURITY DEFINER` que recebem o token de sessão (ver seção 5).
- Cadastro de usuários (professores/coordenação) é feito pela direção através de convite (Supabase Auth invite). Não existe cadastro público.

## 4. Modelo de dados (Postgres)

Todas as tabelas: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`.

- **escolas**: nome, cidade_uf, ano_letivo_atual (int)
- **perfis**: id = auth.users.id (pk), escola_id → escolas, nome, papel (`direcao`|`coordenacao`|`professor`), ativo bool
- **periodos**: escola_id, nome ("1º Bimestre"), ano_letivo int, data_inicio date, data_fim date, ativo bool (apenas 1 ativo por escola)
- **disciplinas**: escola_id, nome. unique(escola_id, nome)
- **turmas**: escola_id, nome ("7º Ano A"), serie ("7º Ano"), segmento (`fund1`|`fund2`|`medio`), ano_letivo int, codigo_acesso text unique (ex: `7A-K3P`), ativa bool
- **ofertas** (turma + disciplina + professor): turma_id, disciplina_id, professor_id → perfis. unique(turma_id, disciplina_id)
- **alunos**: escola_id, turma_id, nome_completo, numero_chamada int, pin_hash text (bcrypt via pgcrypto), ativo bool
  - Um aluno tem UM PIN e vê todas as ofertas da sua turma.
- **atividades**: oferta_id, periodo_id, titulo, descricao, prazo date null, modo (`prova`|`exercicio`, padrão `exercicio`), status (`rascunho`|`publicada`|`encerrada`), criado_por → perfis
  - O modo só pode ser alterado enquanto a atividade estiver em rascunho.
- **questoes**: atividade_id, ordem int, enunciado, dica null, explicacao null
- **alternativas**: questao_id, letra (`A`..`E`), texto, correta bool, por_que_errou text null
  - Exatamente 1 correta por questão (validar por trigger ou na função de salvar). Mínimo 2, máximo 5 alternativas.
- **respostas**: aluno_id, questao_id, alternativa_id, acertou bool, respondida_em, tentativas int (padrão 1), acertou_final bool. unique(aluno_id, questao_id).
  - alternativa_id e acertou guardam SEMPRE a 1ª tentativa, que é a que vale para nota, média, relatórios de desempenho e mapa de calor. Nunca são alterados.
  - tentativas e acertou_final só mudam no modo exercício, quando o aluno usa "Tentar novamente".
- **avisos**: escola_id, autor_id → perfis, turma_id null (null = escola toda), titulo, mensagem, prioridade (`baixa`|`media`|`alta`), publicado_em
- **aluno_sessoes**: aluno_id, token_hash, expira_em, criado_em
- **pin_tentativas**: aluno_id, tentativa_em, sucesso bool

## 5. Login do aluno e segurança das respostas

- RPC `aluno_listar_turma(codigo)`: devolve só `id`, `nome_completo`, `numero_chamada` dos alunos ativos da turma.
- RPC `aluno_login(aluno_id, pin)`: confere o bcrypt. Se houver 5 erros em 15 minutos, bloqueia por 15 minutos. Em caso de sucesso, cria a sessão (validade de 30 dias) e devolve o token puro uma única vez.
- Todas as outras RPCs do aluno recebem `p_token`, validam a sessão e trabalham só com o aluno_id dela.
- **A alternativa correta, o texto de por_que_errou e a explicação NUNCA são enviados ao aluno antes da resposta.** O aluno recebe o enunciado, a dica e as alternativas (id, letra, texto).
- RPC `aluno_responder(p_token, questao_id, alternativa_id)`, com comportamento que depende do modo da atividade:
  - **Modo exercício**: a 1ª resposta é gravada e devolve na hora `{acertou, alternativa_correta_id, por_que_errou, explicacao}`. Se o aluno errar, pode usar "Tentar novamente": a RPC `aluno_tentar_novamente(p_token, questao_id, alternativa_id)` incrementa tentativas, atualiza acertou_final e devolve o mesmo feedback. A 1ª resposta continua valendo para a nota.
  - **Modo prova**: resposta definitiva, sem "Tentar novamente". A RPC devolve só `{registrada: true}`, sem dizer se acertou. A correção completa (acertou, correta, por_que_errou, explicação de cada questão) só é liberada quando o aluno termina TODAS as questões da prova, pela RPC `aluno_resultado_prova(p_token, atividade_id)`. Assim um aluno não consegue repassar o gabarito no meio da prova.
- A professora vê o PIN só no momento em que o gera ou reseta, e pode imprimir as filipetas nessa hora. Depois disso fica apenas o hash guardado.

## 6. Cálculos (definições oficiais)

- **Aproveitamento em uma atividade** = acertos / total de questões da atividade × 100. Lista incompleta conta a parte respondida como "em andamento" e só entra na média depois de concluída ou encerrada (na encerrada, questões sem resposta contam como erro).
- **Média do aluno na oferta e no período** = soma dos acertos / soma das questões, considerando as atividades concluídas ou encerradas do período. Rascunhos nunca entram.
- **Faixa de desempenho** (por aluno, na oferta e no período): Ótimo (média ≥ 80); Bom (60 a 79); Atenção (< 60); Sem atividades (nenhuma atividade concluída ou encerrada). Os limites ficam configuráveis por escola.
- **Questões críticas**: questões com % de acerto < 50, considerando pelo menos 5 respostas.
- **Mapa de calor**: por questão, % de acerto, distribuição de escolhas por alternativa e distrator mais escolhido com o seu por_que_errou.
- Cálculos pesados ficam em views ou RPCs no Postgres, não no front.

## 7. Funcionalidades por fase

**Fase A — Fundação:** estrutura de pastas, Vite+React+TS+Tailwind, cliente Supabase, migrations do schema, RLS, seed de demonstração, login de professor/direção e layout base com as rotas dos perfis.

**Fase B — Cadastro (gestão):** configurar escola e períodos; CRUD de disciplinas e turmas; ofertas (turma × disciplina × professor); convite de professores; cadastro de alunos, individual e em lote colando a lista; geração de PIN e impressão de filipetas.

**Fase C — Atividades (professor):** CRUD de atividades por oferta; editor de questões com 2 a 5 alternativas, marcação da correta, por_que_errou por alternativa, dica e explicação; editar e reordenar questões; duplicar atividade para outra oferta; publicar e encerrar. Uma questão já respondida por algum aluno só pode ter o texto editado, não a alternativa correta.

**Fase D — Portal do aluno:** login por código, nome e PIN; painel com as atividades pendentes e concluídas por disciplina; player de questões com feedback imediato; tela de resultado; avisos da escola e recados da turma; "Meu desempenho" (aproveitamento por disciplina no período).

**Fase E — Acompanhamento (professor):** mural da turma; mapa de calor da atividade; desempenho da turma na oferta (aluno × atividade, com faixa de desempenho); ficha do aluno (atividades, acertos e erros por questão).

**Fase F — Gestão:** visão geral da escola (alunos, turmas, professores, atividades publicadas, aproveitamento médio); desempenho por turma × disciplina no período; alunos na faixa Atenção; questões críticas da escola; mural institucional; exportação CSV.

**Fase G — Produção:** LGPD (termo de aceite da escola, política de privacidade, exclusão de dados do aluno), deploy na Vercel, backups, domínio.

## 7.2 Identidade visual do portal do aluno

- Referência: sistema "Jornada do Saber" (pasta `Estudo Meninas`), com capturas de tela e CSS em `docs/referencia-layout-aluno/`.
- Vale para TODAS as telas do aluno (código da turma, escolha do nome, PIN, painel, player de questões, resultado e Meu desempenho). As telas de professor e gestão continuam com o visual sóbrio (indigo, fundo slate-50).
- O que manter: fundo em degradê (#f0f4ff → #fae8ff → #fef3c7) com bolhas desfocadas; cartões "vidro" brancos com borda clara e sombra suave; fontes Nunito (texto) e Outfit (títulos); chips no topo da questão (disciplina, modo, questão X de Y); barra de progresso fina no topo do cartão; alternativas em cartões grandes com a letra em quadrado, que ficam vermelho (escolhida errada, com ❌) e verde (correta, com ✅) após a resposta; faixa de resultado (verde no acerto; degradê vermelho→laranja no erro, com "Não foi dessa vez, mas faz parte aprender!"); cartão rosa "Onde prestar atenção / Por que não é essa" (por_que_errou); cartão verde "Entenda a resposta correta" (explicação); botão "💡 Precisa de uma dica?"; botão 🔊 de ouvir a questão (speechSynthesis, pt-BR); confete e sons curtos gerados pelo navegador no acerto e ao terminar; tela final com placar (questões, acertos, erros, aproveitamento).
- O que NÃO trazer: estrelas, sequência 🔥, medalhas, ranking, "Nova Questão", "Embaralhar", "Reiniciar", "Trocar filha", e "Tentar novamente" no modo prova.
- No modo prova, o player não mostra acerto/erro por questão: só "Resposta registrada ✓" e o botão Próxima. A correção completa aparece na tela final.
- Confete: pacote npm `canvas-confetti` (sem CDN). Respeitar `prefers-reduced-motion` e ter um botão para desligar o som.
- Mobile first (360px), alvos de toque de pelo menos 48px, contraste AA e zoom liberado.

## 7.1 Modo local (enquanto não houver conta no Supabase)

- A variável `VITE_DATA_SOURCE` define a origem dos dados: `mock` (padrão por enquanto) ou `supabase`.
- `app/src/services/` expõe **interfaces** (contratos) por domínio. Existem duas implementações: `services/mock/` e `services/supabase/`. As telas só conhecem as interfaces, escolhidas em `services/index.ts`.
- O adaptador mock guarda os dados em `localStorage` na chave `saberpontual_mock_db`. Esta é a ÚNICA exceção à regra de não usar localStorage para dados de negócio, e vale só no modo mock.
- O mock precisa imitar as regras do servidor: a API do aluno nunca devolve a correta, o por_que_errou ou a explicação antes da resposta; a resposta é definitiva; o bloqueio de PIN funciona após 5 erros; o professor só enxerga as próprias ofertas.
- Usuários de demonstração no mock (senha `demo123`): `direcao@demo.com`, `coordenacao@demo.com`, `ana@demo.com` (professora de Matemática), `carlos@demo.com` (professor de Ciências).
- Os dados de demonstração do mock e o `supabase/seed.sql` devem ter o mesmo conteúdo.
- As migrations SQL são escritas na Fase A2, mas só são executadas quando houver um projeto Supabase (nuvem ou local via Docker).

## 8. Fora do escopo do MVP (não implementar sem pedido)

Frequência/chamada, conselho de classe, acesso separado de pais/responsáveis, imagens nas questões, questões dissertativas, app nativo, chat, pontos/estrelas/medalhas/ranking (confete e sons de incentivo são permitidos, ver 7.2), caderno de erros, notificações push, integração com outros sistemas, pagamentos, multi-idioma.
