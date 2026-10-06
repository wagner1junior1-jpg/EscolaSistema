# Auditoria 02 — Organização + Camada de dados (mock)

Data: 24/09/2026 · Commits auditados: 7b66033, 62c90ea

## Comando 3 (organização): aprovado
- O protótipo foi para prototipo/, o AGENTS.md está com o texto exato e o git foi iniciado na raiz. O build passa.

## Comando 4 (camada de dados): aprovado com correções obrigatórias

### Pontos positivos
- Os tipos seguem a especificação à risca (snake_case, 15 entidades) e os DTOs do aluno são separados.
- O aluno nunca recebe a correta, o por_que_errou ou a explicação antes de responder, e há teste para isso.
- Resposta definitiva, bloqueio de PIN após 5 erros e sessão com token funcionam, com testes.
- Os cálculos são funções puras, e a regra "dia sem registro não conta" tem teste.
- Validações de 2 a 5 alternativas com exatamente 1 correta; a correta fica travada após a primeira resposta.

### Problemas críticos
1. **Não há autorização em Gestão, Professor e Relatório.** Nenhum método verifica quem está logado. Um professor consegue resetar PIN, criar turma, ver e editar atividades de outro professor. Sem login, minhasOfertas() cai para a Ana (fallback 'usr-prof-ana'). Isso viola a especificação 7.1.
2. **pin_hash vaza para a tela**: boletim() do aluno devolve o objeto Aluno completo, e listarAlunos/cadastrarAluno também. Um SHA-256 de 4 dígitos se quebra em milissegundos (são só 10 mil combinações).
3. **IDOR no aluno**: carregarAtividade e responder não verificam se a atividade é da turma do aluno nem se está publicada. Também dá para responder uma atividade encerrada.
4. **IDs com colisão**: `${Date.now()}-${random(1000)}` dentro de laços (duplicar, lote, alternativas) pode gerar IDs repetidos e corromper os dados.
5. **Quem é o autor vem do cliente**: criarRecadoTurma aceita turma_id null (um professor publicaria aviso para a escola toda), e autor_id e escola_id vêm do chamador. atualizarAtividade aceita qualquer campo, inclusive status, oferta_id e criado_por.

### Bugs
- Frequência no boletim e no conselho não é filtrada pelas datas do período.
- avisos() do aluno não filtra por escola_id (vazaria entre escolas no Supabase).
- Editar uma questão já respondida ignora em silêncio a troca da correta ou a inclusão/remoção de alternativa. Deveria dar erro claro.
- Não há transições de status: dá para publicar sem questões e voltar uma encerrada para rascunho.
- Faltam no contrato: excluirQuestao, excluirAtividade, atualizar/desativar aluno, desativar professor.
- Ao revisar uma atividade concluída, o aluno não vê a correção das questões que já respondeu.
- O fallback do hash (sem crypto.subtle) grava o PIN em texto puro. Isso acontece quando o site é aberto pelo IP da rede (http://192.168...), por exemplo no celular, porque ali não é um contexto seguro.

### Menores (anotados para depois)
- O conselho mostra só a média geral; o ideal é média e frequência por disciplina.
- O aproveitamento global da visão geral conta respostas de listas incompletas.
- A HomePage de vitrine de componentes deve ser removida quando as telas reais existirem.

## Próximo passo
Comando 5: autorização, proteção de dados e correções. Depois disso, começam as telas.
