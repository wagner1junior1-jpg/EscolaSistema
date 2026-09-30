# Relatório de Mudanças — Fase H e Melhorias

## 1. Git Log (desde "feat: H1 - banco de questões...")
- da13949 feat: gerador IA com validacao e modo demo, conselho de classe e melhorias nos portais
- b633bef feat: H3e - pontuação da discursiva nas médias e relatórios
- 53b200a feat: H3b - gravar e corrigir discursiva no mock
- a3161ae feat: H3a - tipos, contrato e pontuação da discursiva
- 1d2db5f fix: placeholder do login do aluno, renomeia seed ampliada; docs: E2E só sob pedido; wip: migration inicial
- 7871d81 wip: fase H (imagens, discursivas, IA gemini local, sincronização) - não revisado
- 5220ea9 feat: H1 - banco de questões por matéria e série, sorteio e cópia para atividade

## 2. O que foi feito por Etapa, Arquivos Principais e Regras Novas
- H2 (Imagens nas Questões): Upload local e base64 com compressão responsiva (até 1600px e 300 KB) no player do aluno, editor e banco de questões. Arquivos: AlunoAtividadePage.tsx, ProfessorAtividadePage.tsx, ProfessorBancoPage.tsx. Regra: imagem opcional; preservação de proporção e legibilidade em mobile e desktop.
- H3 (Questões Discursivas e Correção): Digitação livre pelo aluno (até 2000 caracteres); correção pelo professor com notas Certo (1,0), Parcial (0,5) ou Errado (0,0) e comentário; atualização da média (soma das notas sobre total de questões); mapa de calor com distribuição; renderização KaTeX segura via MathText.tsx. Arquivos: AlunoAtividadePage.tsx, ProfessorResultadosPage.tsx, calculos.ts, aluno.mock.ts, professor.mock.ts, MathText.tsx. Regras: resposta esperada oculta do aluno até correção ou encerramento; sem retentativas em discursivas; atividades pendentes de correção ficam sinalizadas.
- H4 (Gerador de Questões com IA): Geração via Google Gemini com diretrizes pedagógicas BNCC por disciplina e série, validação de distratores e formato via iaValidacao.ts, tela de revisão (aprovar, editar, descartar) e modo de demonstração. Arquivos: ModalGeradorIA.tsx, ia.mock.ts, iaValidacao.ts, ia.test.ts. Regras: cota mensal escolar (200 gerações); enunciados sem numeração nem matéria no texto; publicação no banco somente após aprovação do professor.
- Melhorias nos Portais e Conselho de Classe: Módulo de conselho de classe com pauta imprimível, desempenho hierárquico em árvore na gestão, observações pedagógicas sobre alunos, mascote Adão Mendes e reatividade multi-aba. Arquivos: GestaoConselhoSecao.tsx, DesempenhoArvoreSubitens.tsx, ProfessorDashboardPage.tsx, ProfessorFichaAlunoPage.tsx, db.ts. Regras: observações vinculadas ao professor e aluno; sincronização contínua entre abas.

## 3. Mudanças no Modelo de Dados e no Seed
- Tabelas e Migrations: Criadas as tabelas assuntos, banco_questoes, banco_alternativas, ia_geracoes, saberpontual_store (migration 0001) e aluno_observacoes (migration 0002).
- Novos Campos: Em questoes e banco_questoes: tipo, imagem_url, resposta_esperada, origem, banco_questao_id e assunto_id. Em respostas: texto_resposta, pontuacao, correcao, comentario_professor, corrigido_por e corrigido_em. Em escolas: cota_ia_mensal.
- Novos Tipos: TipoQuestao, DificuldadeQuestao, OrigemQuestao, BancoQuestao, BancoAlternativa, StatusCorrecao, GerarQuestoesIAParams, QuestaoSugeridaIA, RespostaGeracaoIA, AlunoObservacao e DesempenhoTurmaHierarquico.
- Seed e versao_seed: versao_seed padrão mantida em 3 (dados-demo.json) para estabilidade dos testes automatizados. Em modo demonstração no navegador, versao_seed ativa torna-se 321 (3 + 318) via seed-escola-ampliada.ts, populando turmas reais do 3º ao 6º ano sem quebrar testes unitários.

## 4. Desvios da ESPECIFICACAO.md ou do AGENTS.md e Justificativas
- Geração IA Flexível (1 a 20 questões): A especificação previa de 0 a 10 objetivas e 0 a 5 discursivas; foi disponibilizado slider de 1 a 20 questões totais a pedido do usuário.
- Modo Demonstração na IA: Implementado fallback e modo demo para geração imediata sem necessidade de chave de API externa ativa.
- Renderização Matemática Segura: Utilizado componente MathText.tsx com KaTeX puro no DOM sem dangerouslySetInnerHTML, respeitando a Regra 5 do AGENTS.md.
- Observações Pedagógicas e Conselho: Adição da tabela aluno_observacoes e pauta de conselho para atendimento às necessidades de acompanhamento discente levantadas nas reuniões pedagógicas.

## 5. Resultado Atual dos Testes e Build
- BUILD: OK — 0 erros (tsc -b && vite build concluídos com sucesso).
- TESTES UNITÁRIOS E INTEGRAÇÃO: 187 testes passando em 19 suítes Vitest (100% de aprovação).
- TESTES E2E: 55 cenários implementados no Playwright (aluno: 8, banco: 9, demo: 6, gestao: 12, professor: 12, telas: 8).
  Cenários novos da Fase H:
  1. B9 (banco.spec.ts): Professora Ana gera questões por IA (com discursivas), revisa e salva no Banco.
  2. P11 (professor.spec.ts): Navegação por Séries e Matérias no painel do professor.
  3. P12 (professor.spec.ts): Professor cria atividade a partir do Banco de Questões e edita em formato compacto.

## 6. Pendências e Bugs Conhecidos
- Bugs Conhecidos: Nenhum bug funcional impeditivo nos fluxos do aluno, professor ou gestão.
- Pendências de Especificação:
  1. Etapa H5: Sorteio de Lista de Reforço com base nos erros históricos dos alunos (planejada para o próximo ciclo).
  2. Migração para Nuvem: Implementação de Edge Function no Supabase para chamadas à API da IA em ambiente produtivo.
