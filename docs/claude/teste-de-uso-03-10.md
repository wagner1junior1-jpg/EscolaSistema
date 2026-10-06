# Teste de uso no navegador — 03/10/2026

Método: Claude no navegador do app, em localhost:5173, com os dados de demonstração (seed ampliado, versao_seed 321). Sem build/testes; só uso real da tela. Os testes alteraram os dados locais da demo (resposta do Lucas); para voltar: login da equipe > "Restaurar dados de demonstração".

## O que funcionou
- Login da equipe pelo atalho de demonstração (preenche os campos; depois clicar em "Entrar"): OK.
- Painel do professor (Profª Ana) em 390px: KPIs em 2 colunas, indicador de sincronização com bolinha verde.
- Portal do aluno: código 7A-MAT, escolha do aluno (22 alunos), PIN 1420 pelo teclado: OK.
- Atividade "Produção e Coesão" (modo exercício): resposta objetiva certa e errada com feedback ("Mandou bem!" / "Onde prestar atenção" / "Entenda a resposta correta"), botão "Tentar novamente", confete: OK.
- Discursiva: o rascunho sobrevive ao recarregar a página (155/2000 caracteres e voltou na questão 4); o envio pede confirmação ("Depois de enviar, você não poderá mudar esta resposta"); depois do envio aparece "Resposta enviada ✓. Seu professor vai corrigir.": OK (A10 da auditoria-08 resolvido).
- "Sair" do portal do aluno volta ao código da turma: OK.

## Problemas encontrados (uso)
1. RESULTADO DO ALUNO com discursiva pendente: a tela mostra APROVEITAMENTO 50%, ACERTOS 2, ERROS 2, TOTAL 4 (Q1 e Q3 certas, Q2 errada, Q4 aguardando correção). A discursiva pendente está sendo contada como erro e dentro do 50%. O certo seria 2 acertos, 1 erro, 1 aguardando correção, e o aproveitamento só depois de corrigida (ou "parcial") — ver regra "pendente fora da média" e A12 da auditoria-08. RESOLVIDO no commit 5121a1b.
2. Atividade vencida ainda aparece em "Para fazer" com botão "Começar": "Frações e Porcentagem no Dia a Dia" (venceu em 02/10, hoje é 03/10). Decidida a regra (ver segunda rodada) e implementada (entrou no commit 8bd092e).
3. Mural: aviso de 30/09 "Prova de Ciências liberada" cita a prova "Alimentação e Sistema Digestório", mas a prova de Ciências na lista do aluno é "Ecologia e Cadeias Alimentares" (dados do seed inconsistentes).
4. Na troca de usuário, o /entrar da equipe redireciona para o painel do aluno enquanto a sessão do aluno está aberta (precisa sair antes). Comportamento aceitável, só registrar.

## Não testado
- Estado "Salvo neste aparelho" do indicador.
- Criar atividade, Banco de questões, Gerar com IA, Gestão.

## Segunda rodada (03/10, tarde) — professora corrige, aluno confere
- Problema 1 resolvido no commit 5121a1b (pendente fora da média).
- Problema 2 confirmado no navegador: "Começar" na atividade vencida abria a Questão 1 e deixaria responder. Wagner aprovou a regra: vencida e não concluída sai de "Para fazer", vai para "Concluídas" com chip "Prazo encerrado", aluno não responde mais; professora reabre ampliando o prazo. Implementado (prazoVencido em calculos.ts, prazo_vencido no resumo, bloqueio de resposta, painel e página da atividade); relato do Antigravity: build OK, 214 testes. AINDA NÃO TESTADO NO NAVEGADOR pelo Claude.
- Professora Ana corrigiu a discursiva do Lucas (Resultados da atividade > aba Correções): atalho 75 (Bom) e "Salvar Nota (75 pts)" funcionaram; pendentes caiu para 0 e corrigidas para 3. XP do Lucas subiu de 920 para 954.
- NOVO problema A: painel do aluno mostra aproveitamento 68.8% (decimal) em "Produção e Coesão"; as outras mostram inteiro.
- NOVO problema B: tela de resultado do exercício mostra 50%, acertos 2, erros 2 (conta a discursiva de 75 como erro). Esperado 69% (2,75 de 4). Causa: calcularPlacar (features/aluno/utils/placar.ts) só olha `acertou === true`. Correção especificada em estado-atual.md ("Em andamento"); ainda não aplicada até 03/10 à noite.
- Observação: painel do aluno mostra "6º ANO A" para a turma de código 7A-MAT (rótulo do seed; conferir se é só nome da série).
- Dados da demo alterados: nota 75 na discursiva do Lucas (restaurar pela tela de login da equipe se quiser).
