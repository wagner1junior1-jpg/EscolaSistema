# Relatório de Mudanças — Fase H (Banco, Imagens, Discursivas e IA)

### 1. Git Log (desde "feat: H1 - banco de questões...")
- 5220ea9 feat: H1 - banco de questões por matéria e série, sorteio e cópia para atividade
(Nenhum commit posterior; etapas H2 a H4 desenvolvidas na working directory sem commit automático, conforme regra 10 do AGENTS.md).

### 2. Mudanças por Etapa
- **H2 (Imagens nas Questões)**: Suporte a anexo de foto/imagem (imagem_url) via upload local/base64, compressão visual e exibição no player do aluno, no editor do professor e no banco de questões. Arquivos: ProfessorAtividadePage.tsx, ProfessorBancoPage.tsx, AlunoAtividadePage.tsx. Regra: fotos opcionais no enunciado; visualização responsiva.
- **H3 (Questões Discursivas)**: Suporte ao tipo discursiva com gabarito em resposta_esperada, sem alternativas, integrado ao player do aluno e banco. Renderização de fórmulas matemáticas com KaTeX via MathText.tsx. Arquivos: AlunoAtividadePage.tsx, ProfessorAtividadePage.tsx, MathText.tsx. Regra: aluno redige texto livre; resposta esperada oculta até entrega/encerramento.
- **H4 (Gerador de Questões com IA & Revisão)**: Modal ModalGeradorIA.tsx permitindo gerar de 1 a 20 questões (com divisão entre objetivas e discursivas), integração com API Google Gemini (com fallback entre modelos ativos e modo matemático local) e transcrição de imagens didáticas. Tela de revisão antes de salvar no banco. Arquivos: ModalGeradorIA.tsx, ia.mock.ts, ia.test.ts. Regras: cota mensal de 200 gerações; prefixo padronizado (Matéria - Série); sem numeração no enunciado.
- **Sincronização Inter-Portais**: Exportação de assinarMudancas para reatividade multi-aba automática entre os portais do Aluno, Professor e Direção, com bateria de testes de comunicação ponta a ponta. Arquivos: AlunoPainelPage.tsx, ProfessorDashboardPage.tsx, ProfessorOfertaPage.tsx, GestaoInicioSecao.tsx, comunicacao-portais.test.ts.

### 3. Mudanças no Modelo de Dados e Seed
- **Tipos e Campos Novos**:
  - Questao e BancoQuestao: adicionados imagem_url (string opcional), tipo ('objetiva' | 'discursiva'), resposta_esperada (string opcional), origem ('manual' | 'banco' | 'ia').
  - Escola: adicionado campo cota_ia_mensal (padrão 200).
  - Tabela/lista no banco: ia_geracoes (histórico de gerações por escola e professor).
  - Novas interfaces: GerarQuestoesIAParams, QuestaoSugeridaIA, RespostaGeracaoIA.
- **Seed**: versao_seed mantida alinhada com dados-demo.json, contendo questões pré-cadastradas nos modos objetiva e discursiva.

### 4. Desvios da ESPECIFICACAO.md ou do AGENTS.md e Justificativas
- **Quantidade flexível na IA**: A especificação 9.6 previa sempre 20 questões fixas. A pedido expresso do Wagner no chat, foi implementado slider permitindo que o professor escolha entre 1 e 20 questões com ajuste proporcional de discursivas.
- **Chamada real à API Gemini no mock**: A especificação previa apenas mock simulado. Implementou-se a chamada real aos endpoints do Google Gemini com fallback automático para testes práticos imediatos com a chave informada em ambiente.
- **Renderização KaTeX segura**: Criado o componente MathText.tsx usando katex.render com modo estrito desativado, evitando dangerouslySetInnerHTML e cumprindo a Regra 5 do AGENTS.md.
- **Ausência de commit automático**: Conforme a Regra 10 do AGENTS.md, todo o desenvolvimento permaneceu na árvore de trabalho aguardando aprovação explícita para commit.

### 5. Resultado Atual dos Testes e Build
- **BUILD**: OK — 0 erros (tsc -b && vite build concluído com sucesso).
- **TESTES UNITÁRIOS E INTEGRAÇÃO**: 95 testes passando em 9 suítes Vitest (100% aprovados).
- **TESTES E2E**: 51 cenários existentes no Playwright, incluindo 3 cenários novos:
  1. B9: Professora Ana gera questões por IA (com subjetivas), revisa e salva no Banco (banco.spec.ts).
  2. P11: Navegação por Séries e Matérias no painel do professor (professor.spec.ts).
  3. P12: Professor cria atividade a partir do Banco de Questões e edita em formato compacto (professor.spec.ts).

### 6. Pendências e Bugs Conhecidos
- **Bugs funcionais**: Nenhum bug funcional bloqueante identificado nos fluxos e portais.
- **Pendências de especificação**:
  - Etapa H5: Sorteio de Lista de Reforço com base nos erros históricos dos alunos (planejada para a próxima etapa).
  - Migração da Edge Function do Gemini para o backend Supabase na fase de implantação em produção.
