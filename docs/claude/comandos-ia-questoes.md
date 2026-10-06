# Comandos para o Antigravity: IA de questões (prompt, validação, revisão)

(Documento de 26/09/2026. Serve de especificação da IA de questões; confira no código o que já foi aplicado antes de reaplicar.)

**Para o Wagner:**
- São 3 comandos. Abra uma conversa NOVA no Antigravity para cada um e rode na ordem: 1, 2, 3.
- Mande o próximo só depois que eu conferir o `git status` e o build do anterior.
- Decisões já tomadas e escritas nos comandos:
  - questão com imagem é feita só pelo professor;
  - todo o feedback sai pronto na geração, porque nenhuma IA revisa depois;
  - matéria e série viram etiqueta na tela, e não texto dentro do enunciado.

---

## COMANDO 1: novo prompt do Gemini (só a montagem do prompt)

Contexto: ao pedir Ciências / 6º Ano / "Animais vertebrados", a IA gerou só contas. A causa é o prompt de `MockIAService.gerarQuestoes`, em `Escola/app/src/services/mock/ia.mock.ts`. Ele obriga números, cálculos e distratores de erro de conta em qualquer matéria, e chega a colocar o nome do assunto dentro da regra de cálculo.

Não leia arquivos inteiros: use busca (Select-String) e abra só os trechos necessários. Não leia AGENTS.md nem ESPECIFICACAO.

### O que fazer

1. Em `ia.mock.ts`, crie estas funções puras e exporte cada uma, para os testes:

   - **`identificarArea(nomeDisciplina)`**
     - Devolve `'exatas' | 'natureza' | 'humanas' | 'linguagens' | 'geral'`.
     - Olha SÓ o nome da disciplina, nunca o assunto. Compare sem acento e em minúsculas.
     - Mapa:

       | Área | Disciplinas |
       |---|---|
       | exatas | matemática, física, química |
       | natureza | ciências, ciências da natureza, biologia |
       | humanas | história, geografia, filosofia, sociologia |
       | linguagens | língua portuguesa, português, literatura, inglês, língua inglesa, espanhol, redação |
       | geral | qualquer outra |

   - **`diretrizesSerie(serie)`**: devolve o texto da tabela "Textos das diretrizes" abaixo. Se não reconhecer a série, usa o de 6º a 9º.
   - **`diretrizesArea(area)`**: texto da tabela abaixo.
   - **`regrasMaterial(temFotos, textoBase)`**: texto da tabela abaixo.
   - **`regrasFormatacao(area)`**: usa LaTeX só em `exatas`. Nas outras áreas, proíbe LaTeX.
   - **`distribuirDificuldade(qtd, dificuldade)`**: devolve `{facil, medio, dificil}`.
     - Com "facil", "medio" ou "dificil", tudo vai para aquele nível.
     - Com "misturada", divide cerca de 30% fácil, 50% médio e 20% difícil. Arredonde para a soma bater com `qtd` e sobras vão para médio.
     - Calcule separado para as objetivas e para as discursivas de cada lote.

2. Troque o texto do prompt pelo "Prompt do Gemini" abaixo, preenchendo as variáveis com as funções acima.

3. **Lotes:** a partir do 2º lote, passe em `${enunciadosAnteriores}` os primeiros 100 caracteres de cada enunciado já gerado nos lotes anteriores. No 1º lote, a seção inteira some.

4. Apague todas as frases antigas que obrigam cálculo, número, "passo a passo da conta" ou "erros comuns de cálculo" fora da área `exatas`. Isso vale também para os textos de fallback de `dica`, `explicacao` e `por_que_errou`.

5. Testes: em `Escola/app/src/services/__tests__/ia.test.ts`, crie testes SÓ das funções puras e do texto do prompt montado. Não chame a API.
   - `identificarArea('Ciências') === 'natureza'`, `('Matemática') === 'exatas'` e `('Educação Física') === 'geral'`.
   - Prompt de Ciências / "Animais vertebrados":
     - NÃO contém "cálculos matemáticos explícitos" nem "erros comuns de cálculo";
     - CONTÉM a regra de "assunto conceitual" e a proibição de LaTeX.
   - Prompt de Matemática: contém a regra de LaTeX e a de distratores de erro de cálculo.
   - `diretrizesSerie('3º Ano')` usa o texto do Fundamental I; `('1ª Série EM')` usa o do Ensino Médio.
   - `distribuirDificuldade(10, 'misturada')` soma 10, e `(3, 'facil')` dá `{3, 0, 0}`.
   - O prompt do 2º lote contém os enunciados anteriores; o do 1º lote não contém a seção.

### Prompt do Gemini (texto final; as variáveis entre `${}` vêm do código)

```
Você é um professor especialista em elaborar avaliações para a educação básica brasileira, alinhadas à BNCC.

TAREFA
Escreva questões inéditas sobre:
- Disciplina: ${nomeDisciplina}
- Série: ${serie}
- Assunto: ${nomeAssunto}
Quantidade exata:
- ${obj.total} OBJETIVAS: ${obj.facil} fáceis, ${obj.medio} médias, ${obj.dificil} difíceis.
- ${disc.total} DISCURSIVAS: ${disc.facil} fáceis, ${disc.medio} médias, ${disc.dificil} difíceis.

O QUE CADA NÍVEL SIGNIFICA
- fácil: reconhecer ou lembrar um conceito, fato ou definição.
- médio: aplicar, comparar ou classificar usando o conceito.
- difícil: analisar uma situação, relacionar dois ou mais conceitos ou justificar.

SÉRIE E LINGUAGEM
${diretrizesSerie}

CONTEÚDO
${regrasMaterial}
- Varie os subtemas do assunto. Duas questões não podem cobrar a mesma ideia.
- Não faça afirmações absolutas que tenham exceções conhecidas. Exemplo: "todo mamífero nasce do ventre da mãe" (o ornitorrinco bota ovos).
${enunciadosAnteriores ? "Estas questões já foram criadas. Não repita as ideias delas:\n" + enunciadosAnteriores : ""}

ÁREA DA DISCIPLINA
${diretrizesArea}

SEM IMAGENS
Toda questão deve poder ser respondida só com o texto. Nunca escreva "observe a imagem", "de acordo com o gráfico" nem "analise a figura/tabela/mapa".

ENUNCIADO
- Escreva só o texto da questão. Não numere ("Questão 1", "1.", "#1") e não coloque a matéria ou a série no início.
- Evite perguntas negativas ("Qual NÃO é..."). Se usar uma (só do 6º ano em diante), escreva NÃO em maiúsculas.

OBJETIVAS
- Exatamente 4 alternativas e exatamente 1 correta.
- Cada alternativa errada representa um erro comum e plausível de alunos dessa série. Nada de alternativa absurda ou de brincadeira.
- As 4 alternativas têm tamanho e estilo parecidos. A correta não pode ser a mais longa nem a mais detalhada.
- É proibido usar "todas as anteriores", "nenhuma das anteriores", "todas estão corretas", "nenhuma está correta" ou combinações de itens ("apenas I e II").

FEEDBACK
Não existe outra correção automática depois. Tudo o que você escrever aqui é o que o aluno vai ler.
- "dica" (o aluno lê ANTES de responder): 1 frase que orienta o raciocínio sem revelar a resposta nem eliminar alternativas.
- "por_que_errou" (o aluno lê só se marcou aquela alternativa errada):
  - fale com o aluno em segunda pessoa ("Você confundiu..."), com tom acolhedor;
  - 1 ou 2 frases: diga qual foi o engano e corrija o conceito;
  - na alternativa correta, o valor é null.
- "explicacao" (o aluno lê DEPOIS de responder): 2 ou 3 frases dizendo por que a resposta correta está certa e qual conceito ela ensina.
- Nesses três campos, NUNCA cite letras ou posições ("alternativa C", "a opção acima"). As alternativas serão embaralhadas, então fale do conteúdo.
- Cada texto precisa fazer sentido sozinho, porque o aluno lê só o feedback da alternativa que marcou.

DISCURSIVAS
- "alternativas": null.
- "dica" e "explicacao" seguem as regras acima. A explicação é para o aluno e aparece depois que ele envia a resposta.
- A pergunta precisa caber numa resposta de até 5 linhas para a série.
- "resposta_esperada" é para o PROFESSOR corrigir. Use exatamente este formato:
  Resposta modelo: ...
  Certo: o que a resposta precisa conter para valer a nota inteira.
  Parcial: o que vale meia nota.
  Errado: o que vale zero.

FORMATAÇÃO
${regrasFormatacao}

MATERIAL OU ASSUNTO INSUFICIENTE
Se não for possível criar a quantidade pedida sem repetir ideias ou sair do conteúdo, crie menos questões e explique o motivo em "aviso". Caso contrário, "aviso" é null.

SAÍDA
Responda só com JSON neste formato (o exemplo mostra só a estrutura; a posição da correta varia):
{
  "aviso": null,
  "questoes": [
    {
      "tipo": "objetiva",
      "dificuldade": "medio",
      "enunciado": "...",
      "dica": "...",
      "explicacao": "...",
      "resposta_esperada": null,
      "alternativas": [
        { "letra": "A", "texto": "...", "correta": false, "por_que_errou": "..." },
        { "letra": "B", "texto": "...", "correta": true, "por_que_errou": null },
        { "letra": "C", "texto": "...", "correta": false, "por_que_errou": "..." },
        { "letra": "D", "texto": "...", "correta": false, "por_que_errou": "..." }
      ]
    },
    {
      "tipo": "discursiva",
      "dificuldade": "facil",
      "enunciado": "...",
      "dica": "...",
      "explicacao": "...",
      "resposta_esperada": "Resposta modelo: ...\nCerto: ...\nParcial: ...\nErrado: ...",
      "alternativas": null
    }
  ]
}

CHECAGEM FINAL (confira antes de responder)
- As quantidades e as dificuldades batem com o que foi pedido.
- Nenhum enunciado depende de imagem, tem numeração ou traz a matéria e a série.
- Nenhum feedback cita letra ou posição.
- ${checagemArea}
```

### Textos das diretrizes (as funções devolvem exatamente estes textos)

**`diretrizesSerie`**

| Série | Texto |
|---|---|
| 1º e 2º Ano | "Alunos em fase de alfabetização. Enunciados de no máximo 15 palavras, vocabulário do dia a dia, uma ideia por questão, situações concretas (casa, escola, animais, alimentos, brincadeiras). Nenhum termo técnico. Alternativas com poucas palavras." |
| 3º ao 5º Ano | "Frases curtas e diretas (até 20 palavras por frase), vocabulário do dia a dia, situações concretas do cotidiano. Termos do conteúdo só os que a série já estuda, sempre com linguagem simples." |
| 6º ao 9º Ano | "Enunciados contextualizados e curtos, com a situação e depois a pergunta. Os termos técnicos do assunto são esperados, e quando um termo aparece pela primeira vez ele é explicado no próprio enunciado. Exigir compreensão e aplicação, não só memorização." |
| Ensino Médio | "Estilo ENEM: situação-problema com texto-base curto (até 6 linhas) quando ajudar. Interdisciplinaridade quando for natural. Exigir análise, relação entre conceitos e leitura crítica." |

**`diretrizesArea`**

| Área | Texto |
|---|---|
| exatas | "Crie problemas contextualizados com números e cálculos explícitos. Os distratores devem vir de erros reais de cálculo (sinal, ordem das operações, unidade, fração invertida). A explicação mostra o cálculo em poucos passos." |
| natureza | "Cobre conceitos, classificação, características, funções dos organismos e relações com o ambiente e a saúde. Só use cálculo se o assunto for quantitativo por natureza (ex.: velocidade, densidade, circuitos elétricos). Se o assunto for conceitual (ex.: animais vertebrados, células, cadeia alimentar), nenhuma questão pode ser conta, contagem artificial ou expressão numérica. Números que fazem parte do conteúdo são permitidos (ex.: 'o coração dos anfíbios tem 3 cavidades'). Os distratores são confusões conceituais comuns (ex.: confundir a respiração do girino com a do sapo adulto, ou achar que o morcego é uma ave)." |
| humanas | "Cobre causas e consequências, contexto histórico e espacial, comparação entre períodos e lugares, e leitura crítica de fontes descritas em texto. Datas só quando forem essenciais, sem decoreba. Os distratores são anacronismo, confusão entre causa e consequência, e generalização." |
| linguagens | "Interpretação de textos curtos escritos por você (não copie trechos de obras protegidas; obras em domínio público podem ser citadas), gramática dentro do contexto e gêneros textuais. Em língua estrangeira, o texto-base pode estar na língua estudada, mas o enunciado e o feedback ficam em português. Os distratores são leituras equivocadas ou generalizações do texto." |
| geral | "Cobre os conceitos e as práticas do assunto, com situações reais. Não crie cálculos, a menos que o assunto seja sobre números." |

Para `${checagemArea}`:
- em `natureza`: "Se o assunto for conceitual, nenhuma questão é conta."
- em `exatas`: "Todo cálculo e toda resposta numérica estão corretos."
- nas outras: "Nenhuma questão virou conta."

**`regrasMaterial`**
- **Com fotos ou texto-base:** "Use EXCLUSIVAMENTE o conteúdo do material enviado (fotos e/ou texto). Não traga conceitos que não estão nele. A série serve só para calibrar a linguagem e a dificuldade."
- **Sem material:** "Baseie-se no currículo da BNCC para essa disciplina, série e assunto. Se o assunto não for típico da série, adapte a linguagem e a profundidade à série, sem avançar conteúdo."

**`regrasFormatacao`**
- em `exatas`: "Use LaTeX ($...$) SÓ para fórmulas, equações, frações e variáveis. Nunca em palavras, unidades simples ou pontuação. Dentro do JSON, escreva a barra invertida dobrada (ex.: \\\\frac{1}{2})."
- nas outras áreas: "Não use LaTeX nem o símbolo $. Escreva tudo em texto comum."

### Arquivos permitidos
- `Escola/app/src/services/mock/ia.mock.ts`
- `Escola/app/src/services/__tests__/ia.test.ts`

### Rodapé
- Rode `npm run build` e `npm test` UMA vez no final. Se falhar, corrija e rode de novo só o que falhou. Não rode E2E.
- Resposta CURTA: `git status --short`, uma linha de build, uma de testes e até 3 linhas de dúvidas. Sem código nem diff.
- PARE: sem commit nem push. package.json e lock são proibidos.

---

## COMANDO 2: validação e ajustes da resposta no código

Contexto: o que o código consegue garantir não deve depender da IA. Depois que o Gemini responde, o sistema corrige o que dá para corrigir sozinho. O que não dá vira um aviso para o professor ver na tela de revisão.

Não leia arquivos inteiros: use busca (Select-String) e abra só os trechos necessários.

### O que fazer

1. **Chamada ao Gemini** em `ia.mock.ts`: passe `responseMimeType: 'application/json'` na configuração da geração. Se já houver um esquema zod da resposta, use esse. Se não houver, crie um com os campos do JSON do Comando 1, incluindo `aviso` na raiz.
   - Discursiva: `alternativas` null.
   - Objetiva: exatamente 4 alternativas e exatamente 1 correta.
   - Se o JSON vier inválido, tente mais uma vez e depois mostre o erro. Mantenha como está, se já for assim.

2. Crie `Escola/app/src/services/mock/iaValidacao.ts` com a função pura `ajustarQuestoesIA(questoes, area, rand = Math.random)`.
   - Ela devolve cada questão ajustada com um novo campo `avisos: string[]`.
   - Esse campo é só para a tela de revisão. Não grave `avisos` no banco.

   **Corrige sozinha:**
   - embaralha as alternativas da objetiva (Fisher-Yates usando `rand`) e refaz as letras A, B, C, D;
   - tira do início do enunciado qualquer numeração (`Questão 1:`, `1.`, `1)`, `#1`) e o prefixo "(Matéria - Série)", se a IA tiver colocado.

   **Só gera aviso (não corrige):**
   - alternativa com "todas as anteriores", "nenhuma das anteriores", "todas estão corretas" ou "nenhuma está correta". Use regex sem distinguir maiúsculas nem acento.
   - a correta tem mais de 1,5x o tamanho da menor alternativa E é a mais longa das 4: "A correta é bem mais longa que as outras.";
   - `dica`, `explicacao` ou `por_que_errou` cita letra ou posição, com regex do tipo `(alternativa|opção|opcao|letra)\s+[A-E]\b`: "O feedback cita uma letra; ela muda com o embaralhamento.";
   - enunciado fala de imagem, figura, gráfico, tabela ou mapa com verbo de observação ("observe", "analise", "de acordo com"): "A questão depende de uma imagem.";
   - área diferente de `exatas` e a questão tem `$` ou um padrão de conta como `número operador número =`: "Parece uma questão de cálculo.";
   - alternativa errada com `por_que_errou` vazio: "Falta explicar o erro da alternativa X".
     - O X aqui é a letra FINAL, depois do embaralhamento.
     - Deixe o campo vazio: não invente um texto genérico.
   - discursiva cuja `resposta_esperada` não tem "Certo:", "Parcial:" e "Errado:": "Faltam os critérios de correção.".

   **Aviso geral do lote:**
   - se o total de questões recebido for diferente do pedido, gere um aviso;
   - se o Gemini mandou `aviso`, mostre o texto dele.

3. Em `gerarQuestoes`, chame `ajustarQuestoesIA` antes de devolver as questões para a tela.

4. **Fallbacks:** tire os textos genéricos que o código colocava em campos vazios. Campo vazio fica vazio e ganha um aviso. Um texto genérico engana o aluno.

5. Testes em `ia.test.ts` (use um `rand` fixo):
   - o embaralhamento mantém exatamente 1 correta, as letras ficam A, B, C, D e o texto da correta não muda;
   - "Questão 3: Qual..." vira "Qual...", e "(Ciências - 6º Ano) Qual..." vira "Qual...";
   - "Todas as anteriores" gera aviso;
   - `por_que_errou` com "a alternativa C" gera aviso;
   - uma questão de Ciências com "3 cavidades" NÃO gera o aviso de cálculo, e uma com "$2 + 3 = 5$" gera;
   - uma discursiva sem os critérios gera aviso.

### Arquivos permitidos
- `Escola/app/src/services/mock/ia.mock.ts`
- `Escola/app/src/services/mock/iaValidacao.ts` (novo)
- `Escola/app/src/services/__tests__/ia.test.ts`
- o arquivo do esquema zod da resposta da IA, se ele existir em outro lugar (diga qual foi)

### Rodapé
- Rode `npm run build` e `npm test` UMA vez no final. Se falhar, corrija e rode de novo só o que falhou. Não rode E2E.
- Resposta CURTA: `git status --short`, uma linha de build, uma de testes e até 3 linhas de dúvidas. Sem código nem diff.
- PARE: sem commit nem push. package.json e lock são proibidos.

---

## COMANDO 3: tela do gerador, revisão e modo sem chave

Não leia arquivos inteiros: use busca (Select-String) e abra só os trechos necessários.

### O que fazer

1. `Escola/app/src/features/professor/components/ModalGeradorIA.tsx`:
   - Sem chave da IA, o badge "Modo Matemático Local" vira **"Modo demonstração"**, com a legenda: "Sem a chave da IA, o sistema mostra questões de exemplo."
   - Texto do topo: "Informe a matéria, a série, o assunto e, se quiser, fotos ou o texto do conteúdo. A IA cria as questões com gabarito comentado. Você revisa cada uma antes de salvar."
   - Se existir a opção "Anexar a foto às questões", remova. As fotos servem só para a IA ler o conteúdo. A questão com imagem é feita pelo professor, no editor.
   - O aviso "Não envie fotos com nome ou dados de alunos." continua.

2. **Cartão de revisão** de cada questão gerada (encontre o componente com Select-String a partir do ModalGeradorIA):
   - Mostre a matéria e a série como etiqueta no cartão, não no texto do enunciado.
   - Mostre os `avisos` no topo do cartão, com fundo amarelo e ícone de atenção. O botão "Aprovar" continua liberado.
   - Deixe o feedback visível, não escondido: dica, explicação e o "por que errou" embaixo de cada alternativa errada. Na discursiva, mostre a resposta esperada.
   - Se o professor editar o texto de uma alternativa errada, mostre abaixo do "por que errou" dela: "Você mudou esta alternativa. Confira se a explicação ainda vale."

3. **Gerador sem chave** (em `ia.mock.ts`, as funções `criarQuestaoObjetivaCalculada` e `criarQuestaoDiscursivaCalculada`):
   - Renomeie para `criarQuestaoObjetivaExemplo` e `criarQuestaoDiscursivaExemplo`.
   - Tire tudo o que fala de cálculo, fora da Matemática.
   - Para as outras matérias, gere questões neutras sobre o assunto informado, sem inventar conteúdo específico.
   - Todas as questões vêm com o aviso "Questão de exemplo (modo demonstração). Revise antes de usar."
   - Mantenha o gerador de Matemática que já existe.
   - Não crie um banco fixo de um assunto só.

4. Testes em `ia.test.ts`: no modo sem chave, Ciências / "Animais vertebrados" não tem nenhuma questão com `$` nem a palavra "cálculo", e toda questão tem o aviso de exemplo.

### Arquivos permitidos
- `Escola/app/src/features/professor/components/ModalGeradorIA.tsx`
- o componente do cartão de revisão (diga qual foi)
- `Escola/app/src/services/mock/ia.mock.ts`
- `Escola/app/src/services/__tests__/ia.test.ts`

### Rodapé
- Rode `npm run build` e `npm test` UMA vez no final. Se falhar, corrija e rode de novo só o que falhou. Não rode E2E.
- Resposta CURTA: `git status --short`, uma linha de build, uma de testes e até 3 linhas de dúvidas. Sem código nem diff.
- PARE: sem commit nem push. package.json e lock são proibidos.

---

## Teste manual (Wagner, depois do Comando 3, com a chave configurada)

Gere estes 3 casos e confira em cada um:
- nenhuma conta fora de Exatas;
- alternativas de tamanho parecido, sem "Todas/Nenhuma das anteriores";
- a correta em letras variadas;
- feedback sem letras;
- discursivas com Certo, Parcial e Errado;
- nenhuma questão pede para observar uma imagem.

1. Ciências / 6º Ano / Animais vertebrados: 15 objetivas + 5 discursivas, dificuldade misturada.
2. Matemática / 7º Ano / Frações: confira o LaTeX na tela do aluno.
3. História / 1ª Série EM / um assunto à sua escolha.

## Fica para depois (não entra nestes comandos)
- Campo `area` na tabela de disciplinas, no lugar do mapa por nome.
- Código de habilidade BNCC em cada questão, conferido contra uma lista oficial no banco. A IA inventa códigos.
- Em produção, a chamada ao Gemini deve sair do navegador e ir para uma Edge Function, para a chave não ficar exposta.
- Ajustar a ESPECIFICACAO 9.6:
  - limite de questões por geração (hoje diz 10 objetivas + 5 discursivas; o gerador usa 20);
  - tirar a opção "Anexar a foto".
