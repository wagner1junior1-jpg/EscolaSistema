# SaberPontual — Especificação Técnica (fonte da verdade)

> Este documento define O QUE construir. Qualquer mudança de modelo de dados, stack ou escopo precisa ser aprovada pelo Wagner antes de implementar.
> O protótipo antigo (pasta `prototipo/`) serve só como referência visual e de fluxo.

## 0. Escopo do produto

SaberPontual é uma **plataforma de questões** para escolas. Tem três portais:
1. **Aluno**: entra com código da turma + PIN, resolve as atividades e vê os avisos e o próprio desempenho.
2. **Professor**: monta o banco de questões (por matéria e assunto, com ajuda de IA a partir de fotos — ver seção 9), cria atividades, acompanha acertos e erros (mapa de calor, desempenho da turma, ficha do aluno) e manda recados para a turma.
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

Frequência/chamada, conselho de classe, acesso separado de pais/responsáveis, app nativo, chat, pontos/estrelas/medalhas/ranking (confete e sons de incentivo são permitidos, ver 7.2), caderno de erros, notificações push, integração com outros sistemas, pagamentos, multi-idioma.

## 9. Fase H — Banco de questões, IA, imagens e discursivas (aprovado pelo Wagner em 25/09/2026)

Objetivo: o professor monta um banco de questões por matéria e assunto e cria questões em minutos com ajuda de IA a partir de uma foto do conteúdo. Os relatórios atuais (seções 6 e 7, Fases E e F) continuam valendo.

### 9.1 Decisões
- Discursivas são corrigidas **só pelo professor**, com 3 notas: **certo = 1**, **parcial = 0,5** e **errado = 0**.
- O banco é **compartilhado entre os professores da mesma matéria e da mesma escola**. Só o autor edita; os outros usam "Duplicar para editar". A gestão vê o banco em modo leitura.
- A IA **nunca publica sozinha**. Tudo o que ela gera entra como sugestão, e o professor aprova, edita ou descarta cada questão.
- Ao adicionar uma questão do banco a uma atividade, o sistema **copia** a questão para a atividade (guardando `banco_questao_id`). Editar o banco depois não muda atividades já montadas.

### 9.2 Modelo de dados (acréscimos)
- **assuntos**: escola_id, disciplina_id, nome (ex.: "Frações"). unique(disciplina_id, nome). Professor da disciplina cria; gestão edita/arquiva.
- **banco_questoes**:
  - vínculo: escola_id, disciplina_id, assunto_id, criado_por → perfis;
  - classificação: serie (ex.: "7º Ano"), tipo (`objetiva`|`discursiva`), dificuldade (`facil`|`medio`|`dificil`);
  - conteúdo: enunciado, imagem_url null, dica null, explicacao null, resposta_esperada null (só discursiva; é o gabarito para o professor);
  - controle: origem (`manual`|`ia`), arquivada bool.
- **banco_alternativas**: banco_questao_id, letra, texto, correta, por_que_errou (as mesmas regras de `alternativas`).
- **questoes** ganha: tipo, imagem_url null, resposta_esperada null, banco_questao_id null, assunto_id null.
  - A discursiva não tem alternativas. A objetiva continua com 2 a 5 alternativas e exatamente 1 correta.
- **respostas** ganha:
  - `pontuacao numeric null`: 1 ou 0 na objetiva; 1, 0,5 ou 0 na discursiva; null enquanto não for corrigida;
  - `texto_resposta text null`: máximo de 2000 caracteres;
  - campos da correção: `correcao` (`pendente`|`certo`|`parcial`|`errado`) null, `comentario_professor` null, `corrigido_por` null, `corrigido_em` null.
  - Na discursiva, alternativa_id e acertou ficam null.
- **ia_geracoes** (controle de uso e custo): escola_id, professor_id, criado_em, qtd_fotos, qtd_objetivas, qtd_discursivas, status (`ok`|`erro`), custo_estimado null.
- **escolas** ganha `cota_ia_mensal int` (padrão 200 gerações por mês).

### 9.3 Cálculos (substituem as definições da seção 6 onde houver conflito)
- **Aproveitamento** e **média** passam a usar `soma(pontuacao) / total de questões`. Na objetiva, isso dá o mesmo resultado de hoje.
- Continua valendo só a 1ª resposta (tentativas e acertou_final não entram).
- Uma atividade com discursiva **pendente de correção** fica "aguardando correção" para aquele aluno e só entra na média depois de corrigida. Na atividade encerrada, questão sem resposta vale 0.
- **Questões críticas** e **mapa de calor** da discursiva: % = média da pontuação. Não há distrator; a tela mostra a distribuição certo/parcial/errado.

### 9.4 Aluno e discursiva
- O aluno digita a resposta (contador de caracteres; máximo de 2000). Na discursiva não existe "Tentar novamente".
- **Modo exercício:** depois de enviar, aparece "Resposta enviada ✓. Seu professor vai corrigir." e a explicação, se houver. A resposta esperada só aparece depois da correção.
- **Modo prova:** igual à objetiva. Nada é mostrado até a prova terminar e, na discursiva, até ser corrigida.
- Quando o professor corrige, o aluno vê a nota (certo, parcial ou errado) e o comentário no resultado da atividade.
- As mesmas regras de segurança da seção 5 valem para resposta_esperada, explicação e a alternativa correta.

### 9.5 Professor — Banco de questões
- Novo item no menu: **Banco de questões**.
- Filtros: disciplina (só as dele), assunto, série, tipo, dificuldade, origem, e "Minhas" ou "Da escola".
- Ações: Nova questão, **Gerar com IA**, Editar (só o autor), Duplicar para editar, Arquivar, **Adicionar à atividade** (só atividades em rascunho da mesma disciplina).
- No editor de atividade, **"Adicionar do banco"**: escolhe o assunto e a quantidade por dificuldade (ex.: 5 fáceis e 3 médias) ou marca uma a uma.
- Questão nova criada direto na atividade: o professor pode marcar "Salvar também no banco".

### 9.6 Professor — Gerar com IA
1. O professor informa:
   - a disciplina, o assunto (pode criar um novo) e a série;
   - a quantidade de objetivas (0 a 10) e de discursivas (0 a 5), com pelo menos 1 no total;
   - a dificuldade (fácil, médio, difícil ou misturada).
2. Envia de 1 a 5 fotos (JPG, PNG ou WEBP), ou cola um texto. O navegador reduz cada foto para no máximo 1600px e cerca de 300 KB antes de enviar.
3. Opções:
   - "Anexar a foto às questões" (vira imagem_url; senão a foto só é usada para ler o conteúdo);
   - "Só transcrever o texto" (devolve o texto lido para o professor editar, sem gerar questões).
4. A IA devolve JSON, validado por zod:
   - objetivas com 4 alternativas, 1 correta, por_que_errou em cada errada, explicação e dica;
   - discursivas com resposta_esperada e explicação;
   - linguagem adequada à série.
   Se o JSON vier inválido, o sistema tenta mais uma vez e depois mostra o erro.
5. **Tela de revisão:** um cartão por questão, com os botões Aprovar, Editar e Descartar, e "Aprovar todas" depois de editar. Só as aprovadas vão para o banco (origem `ia`).
6. Aviso fixo na tela de envio: "Não envie fotos com nome ou dados de alunos."
7. Limite: a cota mensal da escola. Ao atingir, aparece a mensagem "Limite de gerações do mês atingido. Fale com a direção.". A gestão vê o uso do mês na Início.

### 9.7 Onde a IA roda
- Contrato `services/contracts.ts` → `ServicoIA`, com `gerarQuestoes(params)` e `transcreverImagem(fotos)`.
- **Mock:** `services/mock/ia.ts` devolve questões fixas coerentes com o assunto e a série pedidos, após 1,5 s. Tem um modo de erro para teste. Não chama nenhuma API externa e não gasta nada.
- **Supabase:** Edge Function `gerar-questoes`.
  - A chave do provedor de IA fica só nos secrets do Supabase, **nunca** no front nem no repositório.
  - O provedor fica atrás da interface. Recomendado: modelo com visão da Anthropic (Claude), a ser confirmado.
  - A função confere o papel professor, a cota da escola e registra em ia_geracoes.
- **Imagens:**
  - no Supabase, bucket privado `questoes` com URLs assinadas;
  - no mock, data URL já comprimida. O mock deve avisar se o localStorage passar de 4 MB.

### 9.8 Lista de reforço (sugestão 3 do Antigravity, aprovada)
- Nova tabela **atividade_alunos** (atividade_id, aluno_id). Se ela não tiver linhas, a atividade vale para a turma toda; se tiver, só os alunos listados a veem.
- Nos Resultados da atividade e nas Questões Críticas, o botão **"Criar reforço"** cria uma atividade **em rascunho**:
  - modo exercício, na mesma oferta;
  - com questões do banco dos mesmos assuntos das questões erradas (as mesmas questões podem entrar se o professor marcar);
  - destinada só aos alunos que erraram (pontuação < 1 na 1ª resposta).
- O professor revisa e publica. O reforço entra nas médias como qualquer atividade.

### 9.9 Ordem de implementação
- H1: assuntos + banco de questões + "Adicionar do banco" (sem IA).
- H2: imagens nas questões (upload, compressão, exibição no player e no editor).
- H3: discursivas (aluno, correção pelo professor com a fila "Correções pendentes", novos cálculos e relatórios).
- H4: Gerar com IA no mock + tela de revisão + cota.
- H5: Lista de reforço.
- A Edge Function real entra junto com a migração para o Supabase.
