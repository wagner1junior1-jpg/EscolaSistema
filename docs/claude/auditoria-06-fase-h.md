# Auditoria 06 — Fase H feita só no Antigravity (H2 a H4 + sincronização)

Data: 26/09/2026. Base: docs/RELATORIO-MUDANCAS.md + leitura de package.json, .gitignore, ia.mock.ts, seed-escola-real.ts e das datas dos arquivos do mock.

## Situação
- Último commit: 5220ea9 (H1). H2, H3, H4 e a "sincronização entre portais" estão TODOS sem commit. O risco de perder trabalho é alto.
- Resultados informados: build OK, 95 testes de unidade e 51 E2E.

## Problemas (por prioridade)
1. **Sem commit desde o H1.** Fazer um commit de segurança num branch `wip-fase-h` antes de qualquer coisa.
2. **H3 discursivas incompleta.**
   - aluno.mock.ts, professor.mock.ts e relatorio.mock.ts não mudaram desde antes do H1 (pelas datas dos arquivos).
   - Então não existem: pontuacao, a correção pelo professor (certo, parcial, errado), a fila de correções pendentes, o estado "aguardando correção" nem os cálculos da 9.3.
   - Risco: uma resposta discursiva pode estar contando como ERRO nas médias.
3. **E2E sumiram.** Eram 52; entraram 3 novos (B9, P11, P12) e o total deu 51. Então 4 testes antigos foram apagados ou juntados. A regra 12 proíbe afrouxar testes.
4. **IA real (Gemini) chamada direto do navegador.**
   - A chave vem de VITE_GEMINI_API_KEY (.env, que está no .gitignore, OK) ou do localStorage. Não há chave no código-fonte (conferido).
   - Serve só para teste local: toda variável VITE_ entra no JavaScript publicado. NUNCA fazer deploy assim; na produção, a chamada vai para a Edge Function (9.7).
   - Não enviar fotos com dados de alunos.
5. **seed-escola-real.ts** (novo): cerca de 165 alunos com nomes fictícios e o mesmo PIN, mais de 120 questões do 3º ao 6º Ano.
   - Confirmar que os nomes são inventados.
   - Renomear para seed-escola-ampliada.
   - Isso difere do docs/seed-demo-questoes.json (a spec pede os dois iguais).
   - Risco de estourar o localStorage (5 MB), somando as imagens em base64.
6. **Fora da spec, sem registro de aprovação:** a sincronização entre portais (assinarMudancas), o slider de 1 a 20 questões (o Wagner diz que pediu) e origem 'banco'.
7. **Relatório impreciso:** diz que a 9.6 "previa sempre 20 questões fixas". Falso: a spec previa 0 a 10 objetivas e 0 a 5 discursivas.
8. **Menor:**
   - `@types/katex` está em dependencies; deveria estar em devDependencies.
   - katex foi adicionado ao package.json (dependência nova; a regra 11 manda perguntar antes).

## O que está OK
- .env e dist estão no .gitignore.
- O KaTeX não usa dangerouslySetInnerHTML.
- A cota de 200 gerações existe.
- A tela de revisão antes de salvar no banco existe.
