/**
 * SaberPontual — Prompt do Gemini e regras puras da IA de questões
 *
 * Sem acesso a dados nem a rede: serve ao mock (ia.mock.ts) e ao serviço Supabase (ia.supabase.ts).
 * A Edge Function supabase/functions/gerar-questoes/index.ts carrega uma CÓPIA deste trecho
 * (ela é publicada como arquivo único). O teste ia-prompt-servidor.test.ts compara as duas
 * versões: ao mudar o prompt aqui, replique na função.
 */

import type { AreaConhecimento } from './mock/iaValidacao';

/**
 * Converte "6º Ano A", "6º Ano - Turma B", "Turma 8A" para "6º Ano" ou "8º Ano"
 */
export function normalizarSerieBase(serieOuTurma: string): string {
  if (!serieOuTurma) return '6º Ano';
  const s = serieOuTurma.trim();
  const matchNum = s.match(/(?:turma\s+)?(\d+)[ºo°]?\s*(?:ano)?\s*([a-z])?/i);
  if (matchNum && matchNum[1]) {
    return `${matchNum[1]}º Ano`;
  }
  return s
    .replace(/\s*[-–—]?\s*turma\s+[a-z0-9]+/i, '')
    .replace(/\s+[a-z]$/i, '')
    .trim() || '6º Ano';
}

/**
 * Classifica a disciplina na respectiva área do conhecimento segundo a BNCC.
 */
export function identificarArea(nomeDisciplina: string): AreaConhecimento {
  const norm = (nomeDisciplina || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/educacao\s+fisica/.test(norm)) return 'geral';
  if (/\b(?:matematica|fisica|quimica|algebra|geometria|aritmetica)\b/.test(norm)) return 'exatas';
  if (/ciencia|natureza|biologia/.test(norm)) return 'natureza';
  if (/historia|geografia|filosofia|sociologia/.test(norm)) return 'humanas';
  if (/portugues|literatura|redacao|ingles|espanhol|linguagens/.test(norm)) return 'linguagens';
  return 'geral';
}

/**
 * Retorna as diretrizes de linguagem e calibração por faixa etária (1º ao 9º Ano).
 */
export function diretrizesSerie(serie: string): string {
  const s = normalizarSerieBase(serie).toLowerCase();
  if (/1[ºo°]|2[ºo°]/.test(s)) {
    return 'Alunos em fase de alfabetização. Enunciados de no máximo 15 palavras, vocabulário do dia a dia, uma ideia por questão, situações concretas (casa, escola, animais, alimentos, brincadeiras). Nenhum termo técnico. Alternativas com poucas palavras.';
  }
  if (/3[ºo°]|4[ºo°]|5[ºo°]/.test(s)) {
    return 'Frases curtas e diretas (até 20 palavras por frase), vocabulário do dia a dia, situações concretas do cotidiano. Termos do conteúdo só os que a série já estuda, sempre com linguagem simples.';
  }
  // 6º ao 9º Ano (Fundamental II)
  return 'Enunciados contextualizados e curtos, com a situação e depois a pergunta. Os termos técnicos do assunto são esperados, e quando um termo aparece pela primeira vez ele é explicado no próprio enunciado. Exigir compreensão e aplicação, não só memorização.';
}

/**
 * Retorna as diretrizes temáticas e epistemológicas para cada área do conhecimento.
 */
export function diretrizesArea(area: AreaConhecimento): string {
  switch (area) {
    case 'exatas':
      return 'Crie problemas contextualizados com números e cálculos explícitos. Os distratores devem vir de erros reais de cálculo (sinal, ordem das operações, unidade, fração invertida). A explicação mostra o cálculo em poucos passos.';
    case 'natureza':
      return 'Cobre conceitos, classificação, características, funções dos organismos e relações com o ambiente e a saúde. Só use cálculo se o assunto for quantitativo por natureza (ex.: velocidade, densidade, circuitos elétricos). Se o assunto for conceitual (ex.: animais vertebrados, células, cadeia alimentar), nenhuma questão pode ser conta, contagem artificial ou expressão numérica. Números que fazem parte do conteúdo são permitidos (ex.: "o coração dos anfíbios tem 3 cavidades"). Os distratores são confusões conceituais comuns (ex.: confundir a respiração do girino com a do sapo adulto, ou achar que o morcego é uma ave).';
    case 'humanas':
      return 'Cobre causas e consequências, contexto histórico e espacial, comparação entre períodos e lugares, e leitura crítica de fontes descritas em texto. Datas só quando forem essenciais, sem decoreba. Os distratores são anacronismo, confusão entre causa e consequência, e generalização.';
    case 'linguagens':
      return 'Interpretação de textos curtos escritos por você (não copie trechos de obras protegidas; obras em domínio público podem ser citadas), gramática dentro do contexto e gêneros textuais. Em língua estrangeira, o texto-base pode estar na língua estudada, mas o enunciado e o feedback ficam em português. Os distratores são leituras equivocadas ou generalizações do texto.';
    default:
      return 'Cobre os conceitos e as práticas do assunto, com situações reais. Não crie cálculos, a menos que o assunto seja sobre números.';
  }
}

export function checagemArea(area: AreaConhecimento): string {
  switch (area) {
    case 'natureza':
      return 'Se o assunto for conceitual, nenhuma questão é conta.';
    case 'exatas':
      return 'Todo cálculo e toda resposta numérica estão corretos.';
    default:
      return 'Nenhuma questão virou conta.';
  }
}

export function regrasFormatacao(area: AreaConhecimento): string {
  if (area === 'exatas') {
    return 'Use LaTeX ($...$) SÓ para fórmulas, equações, frações e variáveis. Nunca em palavras, unidades simples ou pontuação. Dentro do JSON, escreva a barra invertida dobrada (ex.: \\\\frac{1}{2}).';
  }
  return 'Não use LaTeX nem o símbolo $. Escreva tudo em texto comum.';
}

export function regrasMaterial(temFotos: boolean, textoBase?: string): string {
  if (temFotos || (textoBase && textoBase.trim().length > 0)) {
    return 'Use EXCLUSIVAMENTE o conteúdo do material enviado (fotos e/ou texto). Não traga conceitos que não estão nele. A série serve só para calibrar a linguagem e a dificuldade.';
  }
  return 'Baseie-se no currículo da BNCC para essa disciplina, série e assunto. Se o assunto não for típico da série, adapte a linguagem e a profundidade à série, sem avançar conteúdo.';
}

export function distribuirDificuldade(
  qtd: number,
  dificuldade?: string
): { facil: number; medio: number; dificil: number } {
  if (qtd <= 0) return { facil: 0, medio: 0, dificil: 0 };
  if (dificuldade === 'facil') return { facil: qtd, medio: 0, dificil: 0 };
  if (dificuldade === 'medio') return { facil: 0, medio: qtd, dificil: 0 };
  if (dificuldade === 'dificil') return { facil: 0, medio: 0, dificil: qtd };

  const facil = Math.round(qtd * 0.3);
  const dificil = Math.round(qtd * 0.2);
  const medio = qtd - (facil + dificil);
  return { facil, medio, dificil };
}

/**
 * Remove qualquer numeração ("Questão 1:", "Questão Discursiva 2:", "1.", "[Mat · 7º Ano]")
 * e padroniza rigorosamente como: (Disciplina - SérieBase) Enunciado...
 */
export function padronizarEnunciadoQuestao(
  enunciadoBruto: string,
  nomeDisciplina: string,
  serie: string
): string {
  const serieBase = normalizarSerieBase(serie);
  let limpo = (enunciadoBruto || '').trim();

  let alterou = true;
  while (alterou) {
    const anterior = limpo;
    limpo = limpo.replace(/^\[[^\]]+\]\s*/i, '');
    limpo = limpo.replace(/^\([^)]+\)\s*/i, '');
    limpo = limpo.replace(/^quest[aã]o\s+(?:discursiva\s+|objetiva\s+)?\d+\s*[:.\-–—)\]]*\s*/i, '');
    limpo = limpo.replace(/^#?\d+\s*[:.\-–—)]\s*/i, '');
    limpo = limpo.trim();
    alterou = limpo !== anterior;
  }

  if (limpo.length > 0) {
    limpo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }

  return `(${nomeDisciplina} - ${serieBase}) ${limpo}`;
}

export function montarPromptGemini(params: {
  nomeDisciplina: string;
  serie: string;
  nomeAssunto: string;
  obj: { total: number; facil: number; medio: number; dificil: number };
  disc: { total: number; facil: number; medio: number; dificil: number };
  temFotos: boolean;
  textoBase?: string;
  enunciadosAnteriores?: string;
}): string {
  const serieBase = normalizarSerieBase(params.serie);
  const area = identificarArea(params.nomeDisciplina);

  return `Você é um professor especialista em elaborar avaliações para a educação básica brasileira, alinhadas à BNCC.

TAREFA
Escreva questões inéditas sobre:
- Disciplina: ${params.nomeDisciplina}
- Série: ${serieBase}
- Assunto: ${params.nomeAssunto}
Quantidade exata:
- ${params.obj.total} OBJETIVAS: ${params.obj.facil} fáceis, ${params.obj.medio} médias, ${params.obj.dificil} difíceis.
- ${params.disc.total} DISCURSIVAS: ${params.disc.facil} fáceis, ${params.disc.medio} médias, ${params.disc.dificil} difíceis.

O QUE CADA NÍVEL SIGNIFICA
- fácil: reconhecer ou lembrar um conceito, fato ou definição.
- médio: aplicar, comparar ou classificar usando o conceito.
- difícil: analisar uma situação, relacionar dois ou mais conceitos ou justificar.

SÉRIE E LINGUAGEM
${diretrizesSerie(serieBase)}

CONTEÚDO
${regrasMaterial(params.temFotos, params.textoBase)}
- Varie os subtemas do assunto. Duas questões não podem cobrar a mesma ideia.
- Não faça afirmações absolutas que tenham exceções conhecidas. Exemplo: "todo mamífero nasce do ventre da mãe" (o ornitorrinco bota ovos).
${params.enunciadosAnteriores ? "Estas questões já foram criadas. Não repita as ideias delas:\n" + params.enunciadosAnteriores + "\n" : ""}
ÁREA DA DISCIPLINA
${diretrizesArea(area)}

SEM IMAGENS
Toda questão deve poder ser respondida só com o texto. Nunca escreva "observe a imagem", "de acordo com o gráfico" nem "analise a figura/tabela/mapa".

ENUNCIADO
- Escreva só o texto da questão. Não numere ("Questão 1", "1.", "#1") e não coloque a matéria ou a série no início.
- Nunca mencione letras de turmas específicas (como "Turma A", "Turma B", "6º A") no enunciado ou na contextualização.
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
${regrasFormatacao(area)}

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
      "resposta_esperada": "Resposta modelo: ...\\nCerto: ...\\nParcial: ...\\nErrado: ...",
      "alternativas": null
    }
  ]
}

CHECAGEM FINAL (confira antes de responder)
- As quantidades e as dificuldades batem com o que foi pedido.
- Nenhum enunciado depende de imagem, tem numeração ou traz a matéria e a série.
- Nenhum feedback cita letra ou posição.
- ${checagemArea(area)}`;
}
