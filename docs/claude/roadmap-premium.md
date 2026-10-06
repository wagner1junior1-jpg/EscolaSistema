# Roadmap premium — SaberPontual (proposta, 25/09/2026)

Status: proposta em análise pelo Wagner. Nada entra na ESPECIFICACAO.md até ele escolher.
A demonstração para a diretora foi adiada até o sistema ter os recursos premium.

## Análise das 5 sugestões do Antigravity
1. **Banco de questões + montador:** SIM, essencial.
   - Depende de etiquetar cada questão com habilidade e dificuldade.
   - Criar uma "Questão aprovada pela coordenação" (controle de qualidade).
   - A "importação inteligente" precisa de IA (chave e custo). Fica para depois. Antes disso, dá para importar por modelo de planilha/CSV.
2. **Prova impressa + correção por câmera:** o valor é alto, mas a leitura por câmera é difícil de acertar.
   - Fase 1: PDF da prova + folha de respostas + grade de lançamento rápido (o professor digita A/B/C/D por aluno, ~1 min por aluno).
   - Fase 2: leitura por câmera.
   - A prova impressa não mostra feedback, igual ao modo prova.
3. **Lista de reforço automática:** SIM, é o melhor custo-benefício.
   - Nasce das Questões Críticas e dos Alunos em Atenção, e vai só para quem errou.
   - Usa o modo exercício e o banco de questões por habilidade.
4. **Ficha PDF para reunião de pais/conselho:** SIM, como documento impresso, sem reabrir o portal dos pais nem o módulo de conselho (que saíram do escopo).
   - Usar o mesmo padrão de impressão das filipetas.
   - Mostrar: evolução, pontos fortes e pontos de atenção por habilidade.
   - Cuidado com a linguagem: nada de rótulo para o aluno.
5. **Prontidão SAEB:** SIM, forte para a escola pública.
   - Depende da mesma etiqueta de habilidade (BNCC + descritores SAEB).
   - Precisa de pelo menos 5 respostas por descritor para exibir, como já é feito nas questões críticas.
- Pitch: tirar "escola concorrente nenhuma tem" até a pesquisa de mercado confirmar.

## Sugestões do Claude
- **Base de tudo:** etiquetar cada questão com habilidade (BNCC/descritor SAEB), conteúdo e dificuldade. Sem isso, os itens 1, 3, 4 e 5 não funcionam.
- **Imagens e fórmulas nas questões** (figuras de geometria, gráficos, frações). Hoje é só texto, e Matemática e Ciências precisam disso.
- **Multi-escola / rede municipal:** escola_id em todas as tabelas e RLS por escola. Decidir ANTES das migrations do Supabase, porque mudar depois é caro. É o que permite vender para a secretaria.
- **Anti-cola no modo prova:**
  - embaralhar questões e alternativas por aluno;
  - tempo limite;
  - registrar quando o aluno sai da tela.
- **Acessibilidade e inclusão:** fonte ampliada, alto contraste, modo com menos estímulos (TEA/TDAH), tempo estendido por aluno e leitura em voz (já existe).
- **Caderno de erros:** o aluno refaz o que errou, sem mudar a nota (vale a 1ª resposta). Já estava na lista futura.
- **App instalável (PWA) com modo offline:** responde sem internet e sincroniza depois. Útil na realidade da escola pública.
- **Painel de uso para a direção:** professores ativos, atividades por semana e % de alunos que responderam. Mostra que o sistema está sendo usado (o retorno do investimento).
- **Prazo e agendamento:** publicar numa data, com prazo e aviso no painel do aluno. (O prazo e o bloqueio depois do vencimento já existem; falta o agendamento de publicação.)
- **LGPD de menores:** termo, consentimento do responsável e exportação/exclusão de dados. É requisito para contrato público.

## Ordem sugerida
1. **Fundação (antes do Supabase):** etiquetas de habilidade e dificuldade; imagens e fórmulas; escola_id multi-escola.
2. **Valor rápido:** banco de questões + montador; lista de reforço; ficha PDF; anti-cola.
3. **Realidade da escola:** prova impressa + lançamento rápido; Prontidão SAEB; acessibilidade; caderno de erros; painel de uso.
4. **Avançado:** correção por câmera; importação por IA; PWA offline.
