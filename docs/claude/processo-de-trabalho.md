# Processo de trabalho — SaberPontual

Papéis (até 04/10/2026): o Wagner decide; o Antigravity (ou outro agente) escreve o código; o Claude audita e escreve os comandos. A partir da migração para o VS Code, o Claude pode editar o código e rodar build/testes diretamente, mas commit e push continuam só com o OK do Wagner (ver CLAUDE.md na raiz).

## 3 comandos em paralelo (decidido em 30/09/2026)
- O Claude manda 3 comandos de uma vez, para o Wagner rodar em 3 conversas diferentes do Antigravity (rende mais).
- Os 3 comandos devem mexer em ARQUIVOS DIFERENTES (lista de permitidos no comando), para não haver conflito.
- Cada comando avisa: se o build falhar em arquivo fora da lista, não consertar, só relatar (outra conversa pode estar mexendo).
- O `git status --short` de cada um mostra só os seus arquivos. Depois das 3 respostas, o Claude confere na pasta e manda 3 commits, um por assunto, com `git add` explícito.

## Cota mensal de IA (decidido em 30/09/2026)
- NÃO vamos tratar por enquanto. Ver auditoria-08 (A7): a cota hoje conta todas as gerações de todos os tempos.

## Economia de tokens no Antigravity (decidido em 26/09/2026)
O que fazia gastar muito: o comando mandava ler a spec inteira; o agente lia arquivos inteiros (types.ts ~600 linhas, aluno.mock.ts ~650) para se localizar; rodava build e testes várias vezes; E2E; e a conversa do Antigravity ficava longa (cada mensagem reenvia todo o histórico).
Nos comandos do Claude daqui em diante:
- NÃO mandar "leia o AGENTS.md / a ESPECIFICACAO". A regra necessária vai escrita no próprio comando, em poucas linhas.
- Citar o arquivo e o nome da função exatos. Incluir a frase: "Não leia arquivos inteiros: use busca (Select-String) e abra só os trechos necessários."
- "Rode build e testes UMA vez no final; se falhar, corrija e rode de novo só o que falhou."
- E2E só com autorização (seção abaixo).
- Recomendação ao Wagner: abrir uma conversa NOVA no Antigravity a cada etapa. Para tarefas simples (renomear, trocar texto, commit), usar o modelo mais barato, se o Antigravity oferecer.

## E2E só com autorização (decidido em 26/09/2026)
- Por padrão, o Antigravity roda só `npm run build` e `npm test` (Vitest). NÃO roda Playwright.
- E2E só quando o comando disser "rode o E2E", e só as specs citadas. A suíte inteira só no fechamento de uma etapa grande e com o OK do Wagner.
- Registrado no AGENTS.md, regra 10.

## Tamanho dos comandos (decidido em 25/09/2026)
- Cada comando faz UMA coisa pequena, com até ~5 arquivos.
- Uma etapa grande vira de 3 a 5 comandos em sequência.

## Rodapé padrão
- Build e testes uma vez no final.
- Resposta CURTA: `git status --short`, uma linha de build, uma de testes e até 3 linhas de dúvidas. Sem código nem diff.
- PARAR: sem commit nem push.
- Lista de arquivos permitidos. package.json e lock são proibidos sem pedido.

## Antes de aprovar um commit, o Claude confere
1. `git status --short`: barrar arquivo não pedido.
2. Amostragem dos arquivos na pasta, contra o que o comando pediu.
3. Build e testes.
4. Commit com `git add` explícito (nunca `git add .`).

## Lição de 03/10/2026 (conversas paralelas)
Com outra conversa commitando ao mesmo tempo, o `git add` do passo 1 deixou arquivos no stage e o commit da outra conversa (8bd092e) os levou junto, com mensagem que não descrevia a mudança. Antes de cada passo 1: `git branch --show-current` e `git status -sb`, e confirmar que nenhuma outra conversa vai commitar naquele intervalo.
