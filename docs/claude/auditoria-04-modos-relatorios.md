# Auditoria 04 — Modos prova/exercício, relatórios e remoção de frequência (commit 40f3eb6)

Data: 24/09/2026

## Veredito: aprovado, com 3 ajustes antes das telas

Confirmado no código:
- A prova devolve só { registrada: true }. carregarAtividade esconde o feedback enquanto a prova está incompleta. resultadoProva fica bloqueado até a última questão.
- tentarNovamente só funciona no exercício, só após erro, e não altera alternativa_id nem acertou da 1ª resposta.
- Relatórios com exigirUsuario; atividades em rascunho ficam fora; a regra "concluída ou encerrada" foi aplicada.
- Nenhuma ocorrência de frequência, conselho ou responsável.

## Ajustes
1. **Prova encerrada com aluno que não terminou**: resultadoProva lança erro para sempre. Deve liberar o resultado quando a atividade estiver encerrada (sem resposta = erro), igual ao cálculo da média.
2. **mesclarBancos do mock**: só ADICIONA itens que faltam. Não propaga edições (a versão velha vence) e ressuscita itens apagados em outra aba. Como getDatabase() já recarrega quando o localStorage está mais novo, a fusão quase nunca é necessária. Trocar por trava otimista: se a versão do storage estiver mais nova no momento de salvar, recarregar e lançar "Os dados foram atualizados em outra aba. Tente de novo.".
3. **Regra de média duplicada em 4 lugares** (aluno.meuDesempenho, professor.desempenhoOferta, relatorio.desempenhoTurmas, relatorio.alunosEmAtencao). Extrair para uma função única em calculos.ts, para evitar divergência.
4. Consistência: resultadoProva e fichaAluno devem conferir se o aluno é da turma da oferta.

## Sobre as críticas do Antigravity
- resetDatabase apagando a chave do localStorage: correto, não estava no comando. Boa correção.
- Questões críticas ordenadas da menor % de acerto para a maior: correto e útil. Aceito.
