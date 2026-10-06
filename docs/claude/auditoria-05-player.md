# Auditoria 05 — Pacote demo (7.5) e Player do aluno (8)

Data: 24/09/2026 · Teste automatizado no navegador (Chromium, 390px) com os dados de demonstração.

## Roteiro rodado pelo Claude: tudo passou
- Painel do Lucas: 3 para fazer (Frações, Prova de Ciências, Português), 2 concluídas; "Geometria (rascunho)" NÃO aparece.
- Frações: errou a Q2 (B) → vermelho/verde, "Onde prestar atenção" e "Entenda a resposta"; "Tentar novamente" → acertou; placar final 80% (4/5), com a Q2 contando como erro.
- Prova de Ciências: 0 vazamentos (nenhum "Mandou bem", "Onde prestar", "Entenda" ou "Não foi dessa vez" durante as 5 questões); só "Resposta registrada ✓". O gabarito aparece no final.
- Prova encerrada de Inteiros: 1 acerto, 2 questões "Sem resposta".
- F5 no Português voltou na "Questão 2 de 4".
- Nenhum erro de JavaScript.

## Ajustes (Comando 8.1)
1. A correção final da prova não mostra o TEXTO da alternativa escolhida nem o da correta (só enunciado, por_que_errou e explicação). O comando pedia isso.
2. Depois do F5, uma questão errada e depois acertada no "Tentar novamente" volta a oferecer "Tentar novamente", e o serviço recusa. O carregarAtividade não devolve tentativas/acertou_final, e a tela fixa tentativas: 2.
3. A classe animate-slideDownFade não existe (não faz nada).
4. O roteiro do Antigravity citou nomes de atividades que não existem ("Números Inteiros e Operações", "Leitura e Interpretação de Texto"). Não é bug de código, mas é sinal de que ele escreveu o roteiro sem testar.
