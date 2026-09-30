/**
 * SaberPontual — Serviço de IA (Integração Google Gemini + Modo Demonstração Multi-disciplinar)
 * 
 * - Integração com Google Gemini (VITE_GEMINI_API_KEY ou chave configurada no navegador).
 * - Calibração pedagógica por segmento da Educação Básica (1º ao 9º Ano da BNCC).
 * - Identificação automática da área do conhecimento (natureza, exatas, humanas, linguagens).
 * - Veto estrito a cálculos matemáticos forçados em Ciências da Natureza / Biologia.
 * - Padronização canônica de enunciados no formato: (Disciplina - SérieBase) sem menção a turmas (A/B).
 * - Validação e embaralhamento das alternativas (Fisher-Yates) via iaValidacao.ts.
 */

import { ServicoIA } from '../contracts';
import {
  GerarQuestoesIAParams,
  RespostaGeracaoIA,
  QuestaoSugeridaIA,
  DificuldadeQuestao,
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { exigirUsuario } from './autorizacao';
import { gerarId } from './ids';
import { supabase } from '@/lib/supabase';
import { AreaConhecimento, ajustarQuestoesIA } from './iaValidacao';

export type { AreaConhecimento };
export { ajustarQuestoesIA };

// TEMPORÁRIO: uso livre da IA. Voltar para false para exigir a cota mensal definida pela escola.
export const IA_SEM_LIMITE = true;

export const GEMINI_KEY_STORAGE = 'saberpontual_gemini_api_key';

export function obterGeminiApiKey(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const localKey = window.localStorage.getItem(GEMINI_KEY_STORAGE)?.trim();
    if (localKey && localKey.length >= 20) {
      return localKey;
    }
  }
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (envKey && envKey.length >= 20 && !envKey.includes('placeholder') && !envKey.includes('sua-chave')) {
    return envKey;
  }
  return '';
}

export function salvarGeminiApiKeyLocal(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const trimmed = key.trim();
    if (trimmed) {
      window.localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  }
}

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

interface ProblemaMatematicoTemplate {
  enunciado: string;
  dica: string;
  explicacao: string;
  alternativas: Array<{
    letra: 'A' | 'B' | 'C' | 'D';
    texto: string;
    correta: boolean;
    por_que_errou: string | null;
  }>;
}

const BANCO_EXEMPLOS_MATEMATICA: ProblemaMatematicoTemplate[] = [
  {
    enunciado: `Para preparar uma receita na aula de culinária, Ana utilizou $\\frac{2}{5}$ de uma barra de chocolate pela manhã e $\\frac{1}{3}$ da mesma barra à tarde. Qual fração representa a quantidade total de chocolate utilizada por Ana?`,
    dica: `Para somar frações com denominadores diferentes ($5$ e $3$), encontre primeiro o mínimo múltiplo comum (MMC) entre eles.`,
    explicacao: `Calculando o MMC entre $5$ e $3$, obtemos $15$. Convertendo as frações: $\\frac{2}{5} = \\frac{6}{15}$ e $\\frac{1}{3} = \\frac{5}{15}$. Somando os numeradores: $\\frac{6}{15} + \\frac{5}{15} = \\frac{11}{15}$.`,
    alternativas: [
      { letra: 'A', texto: `$\\frac{11}{15}$`, correta: true, por_que_errou: null },
      {
        letra: 'B',
        texto: `$\\frac{3}{8}$`,
        correta: false,
        por_que_errou: `Você somou diretamente os numeradores e os denominadores sem igualar as bases fracionárias.`,
      },
      {
        letra: 'C',
        texto: `$\\frac{2}{15}$`,
        correta: false,
        por_que_errou: `Você multiplicou os numeradores em vez de somar as frações equivalentes.`,
      },
      {
        letra: 'D',
        texto: `$\\frac{4}{15}$`,
        correta: false,
        por_que_errou: `Você encontrou o denominador comum, mas não ajustou os numeradores antes da soma.`,
      },
    ],
  },
  {
    enunciado: `Em uma turma com $36$ alunos, verificou-se que $\\frac{3}{4}$ dos estudantes participaram da gincana escolar. Quantos alunos dessa turma participaram do evento?`,
    dica: `Para calcular uma fração de um valor inteiro, divida pelo denominador ($4$) e multiplique pelo numerador ($3$).`,
    explicacao: `Dividindo $36 \\div 4 = 9$ e multiplicando por $3$: $9 \\times 3 = 27$ alunos.`,
    alternativas: [
      { letra: 'A', texto: `$27$ alunos`, correta: true, por_que_errou: null },
      {
        letra: 'B',
        texto: `$9$ alunos`,
        correta: false,
        por_que_errou: `Você encontrou apenas o valor de um quarto da turma, esquecendo de multiplicar por 3.`,
      },
      {
        letra: 'C',
        texto: `$12$ alunos`,
        correta: false,
        por_que_errou: `Você dividiu pelo numerador 3 em vez de dividir pelo denominador 4.`,
      },
      {
        letra: 'D',
        texto: `$24$ alunos`,
        correta: false,
        por_que_errou: `Esse cálculo corresponde a dois terços da turma, e não a três quartos.`,
      },
    ],
  },
  {
    enunciado: `Um reservatório continha $\\frac{7}{8}$ de sua capacidade máxima com água. Após o consumo da horta, o volume gasto foi de $\\frac{1}{4}$ da capacidade total. Que fração restou no reservatório?`,
    dica: `Converta a fração $\\frac{1}{4}$ para denominador $8$ antes de realizar a subtração.`,
    explicacao: `Como $\\frac{1}{4} = \\frac{2}{8}$, temos: $\\frac{7}{8} - \\frac{2}{8} = \\frac{5}{8}$.`,
    alternativas: [
      { letra: 'A', texto: `$\\frac{5}{8}$`, correta: true, por_que_errou: null },
      {
        letra: 'B',
        texto: `$\\frac{6}{4}$`,
        correta: false,
        por_que_errou: `Você subtraiu os numeradores e os denominadores diretamente, o que não é correto.`,
      },
      {
        letra: 'C',
        texto: `$\\frac{6}{8}$`,
        correta: false,
        por_que_errou: `Você subtraiu os numeradores sem converter a segunda fração para o mesmo denominador.`,
      },
      {
        letra: 'D',
        texto: `$\\frac{9}{8}$`,
        correta: false,
        por_que_errou: `Você realizou uma soma em vez de calcular a sobra do reservatório.`,
      },
    ],
  },
];

const BANCO_EXEMPLOS_CIENCIAS: ProblemaMatematicoTemplate[] = [
  {
    enunciado: `Os animais vertebrados apresentam como característica diagnóstica a presença de um esqueleto interno rígido articulado. Qual estrutura anatômica é exclusiva desse grupo e atua na sustentação do corpo e proteção da medula espinhal?`,
    dica: `Pense na estrutura formada por pequenos ossos articulados que dá nome a todo o subfilo.`,
    explicacao: `A coluna vertebral, composta por vértebras articuladas, sustenta o corpo dos vertebrados e protege a medula espinhal, sendo exclusiva deste grupo.`,
    alternativas: [
      {
        letra: 'A',
        texto: `A coluna vertebral articulada com crânio protetor.`,
        correta: true,
        por_que_errou: null,
      },
      {
        letra: 'B',
        texto: `O exoesqueleto formado por camadas de quitina.`,
        correta: false,
        por_que_errou: `Você confundiu o esqueleto interno dos vertebrados com o exoesqueleto de quitina dos artrópodes.`,
      },
      {
        letra: 'C',
        texto: `A carapaça externa calcária secretada pela pele.`,
        correta: false,
        por_que_errou: `Carapaças calcárias externas são estruturas típicas de moluscos, e não o esqueleto axial dos vertebrados.`,
      },
      {
        letra: 'D',
        texto: `Os apêndices articulados sem suporte ósseo interno.`,
        correta: false,
        por_que_errou: `Os vertebrados possuem sustentação óssea ou cartilaginosa interna em seus membros.`,
      },
    ],
  },
  {
    enunciado: `Durante o desenvolvimento biológico da maioria dos anfíbios, ocorre um processo de metamorfose marcante. Qual mudança respiratória ocorre na transição da fase larval (girino) para a fase adulta?`,
    dica: `Lembre-se do ambiente onde vive o girino (aquático) em comparação com o ambiente do sapo adulto.`,
    explicacao: `Na fase larval aquática, os girinos respiram por brânquias. Ao completarem a metamorfose, desenvolvem pulmões simples e passam a realizar também respiração cutânea através da pele úmida.`,
    alternativas: [
      {
        letra: 'A',
        texto: `Passam da respiração branquial para a pulmonar e cutânea.`,
        correta: true,
        por_que_errou: null,
      },
      {
        letra: 'B',
        texto: `Iniciam com respiração traqueal e passam para a branquial.`,
        correta: false,
        por_que_errou: `Você confundiu a respiração traqueal (típica dos insetos) com o sistema respiratório dos anfíbios.`,
      },
      {
        letra: 'C',
        texto: `Mantêm respiração exclusivamente branquial por toda a vida.`,
        correta: false,
        por_que_errou: `Apenas algumas espécies neotênicas retêm brânquias; sapos e rãs adultas utilizam pulmões e pele.`,
      },
      {
        letra: 'D',
        texto: `Substituem a respiração cutânea apenas pela respiração branquial.`,
        correta: false,
        por_que_errou: `A respiração cutânea é desenvolvida e mantida pelos adultos, invertendo a ordem do ciclo biológico.`,
      },
    ],
  },
  {
    enunciado: `A conquista definitiva do ambiente terrestre pelos répteis foi possibilitada por importantes adaptações evolutivas contra o dessecamento. Qual conjunto de características viabilizou essa independência da água para a reprodução?`,
    dica: `Observe as propriedades da pele dos répteis e a estrutura protetora de seus ovos.`,
    explicacao: `A pele impermeável recoberta por escamas córneas e o desenvolvimento de ovos com casca protetora permitiram que os répteis se reproduzissem em terra firme sem risco de desidratação embrionária.`,
    alternativas: [
      {
        letra: 'A',
        texto: `Pele impermeável queratinizada e ovos protegidos por casca.`,
        correta: true,
        por_que_errou: null,
      },
      {
        letra: 'B',
        texto: `Pele delgada e úmida associada a ovos gelatinosos aquáticos.`,
        correta: false,
        por_que_errou: `Pele úmida e ovos sem casca são características de anfíbios, que dependem diretamente de ambientes aquáticos.`,
      },
      {
        letra: 'C',
        texto: `Respiração branquial eficiente e fecundação sempre externa.`,
        correta: false,
        por_que_errou: `Répteis respiram exclusivamente por pulmões e realizam fecundação interna para proteção dos gametas.`,
      },
      {
        letra: 'D',
        texto: `Manutenção constante da temperatura corpórea por endotermia.`,
        correta: false,
        por_que_errou: `Os répteis são animais ectotérmicos, dependendo do calor do ambiente para regular sua temperatura.`,
      },
    ],
  },
  {
    enunciado: `As aves apresentam uma série de adaptações anatômicas e fisiológicas essenciais para a eficiência do voo. Entre essas adaptações esqueléticas e respiratórias, destacam-se:`,
    dica: `Pense em estruturas ósseas leves e órgãos respiratórios acessórios que armazenam ar.`,
    explicacao: `As aves possuem ossos pneumáticos que reduzem o peso corporal e sacos aéreos acoplados aos pulmões que otimizam as trocas gasosas durante o voo.`,
    alternativas: [
      {
        letra: 'A',
        texto: `Ossos pneumáticos com cavidades internas de ar e sacos aéreos.`,
        correta: true,
        por_que_errou: null,
      },
      {
        letra: 'B',
        texto: `Ossos densos e maciços para suportar o impacto de pousos bruscos.`,
        correta: false,
        por_que_errou: `Ossos maciços aumentariam o peso do animal, dificultando a sustentação aerodinâmica no voo.`,
      },
      {
        letra: 'C',
        texto: `Dentição resistente para mastigação rápida de sementes e frutos.`,
        correta: false,
        por_que_errou: `As aves modernas não possuem dentes; apresentam bico córneo leve para diminuir o peso na cabeça.`,
      },
      {
        letra: 'D',
        texto: `Pele rica em glândulas sudoríparas para resfriamento corpóreo.`,
        correta: false,
        por_que_errou: `Aves não possuem glândulas sudoríparas na pele; a perda de calor ocorre principalmente pelo trato respiratório.`,
      },
    ],
  },
  {
    enunciado: `Os mamíferos compartilham características anatômicas e reprodutivas marcantes em relação aos demais vertebrados. Quais estruturas são diagnósticas e exclusivas desta classe biológica?`,
    dica: `Lembre-se da forma como esses animais alimentam seus filhotes recém-nascidos e do revestimento do corpo.`,
    explicacao: `A presença de glândulas mamárias produtoras de leite para nutrição dos filhotes e pelos na superfície corporal são características exclusivas dos mamíferos.`,
    alternativas: [
      {
        letra: 'A',
        texto: `Presença de glândulas mamárias funcionais e pelos pelo corpo.`,
        correta: true,
        por_que_errou: null,
      },
      {
        letra: 'B',
        texto: `Postura de ovos gelatinosos sem casca em poças d'água temporárias.`,
        correta: false,
        por_que_errou: `A reprodução com ovos gelatinosos é típica de peixes e anfíbios; a grande maioria dos mamíferos é vivípara.`,
      },
      {
        letra: 'C',
        texto: `Controle da temperatura dependente unicamente do calor solar externo.`,
        correta: false,
        por_que_errou: `Os mamíferos são animais endotérmicos que mantêm a temperatura interna constante através do metabolismo.`,
      },
      {
        letra: 'D',
        texto: `Trocas gasosas através de brânquias situadas na cavidade faríngea.`,
        correta: false,
        por_que_errou: `Mesmo os mamíferos aquáticos (como baleias e golfinhos) respiram exclusivamente por pulmões na superfície.`,
      },
    ],
  },
];

/**
 * Cria questões de exemplo (modo demonstração) quando sem chave de IA configurada.
 */
function criarQuestaoObjetivaExemplo(
  indice: number,
  nomeDisciplina: string,
  serie: string,
  nomeAssunto: string,
  dificuldade: DificuldadeQuestao,
  _fotoAnexada: string | null,
  area: AreaConhecimento
): QuestaoSugeridaIA {
  const idTemp = `ia-sug-obj-${Date.now()}-${indice}-${gerarId('tmp')}`;
  const serieBase = normalizarSerieBase(serie);

  if (area === 'exatas') {
    const item = BANCO_EXEMPLOS_MATEMATICA[(indice - 1) % BANCO_EXEMPLOS_MATEMATICA.length];
    return {
      id_temp: idTemp,
      tipo: 'objetiva',
      dificuldade,
      enunciado: padronizarEnunciadoQuestao(item.enunciado, nomeDisciplina, serieBase),
      dica: item.dica,
      explicacao: item.explicacao,
      resposta_esperada: null,
      imagem_url: null,
      alternativas: item.alternativas,
      avisos: ['Questão de exemplo (modo demonstração). Revise antes de usar.'],
    };
  }

  if (area === 'natureza') {
    const item = BANCO_EXEMPLOS_CIENCIAS[(indice - 1) % BANCO_EXEMPLOS_CIENCIAS.length];
    return {
      id_temp: idTemp,
      tipo: 'objetiva',
      dificuldade,
      enunciado: padronizarEnunciadoQuestao(item.enunciado, nomeDisciplina, serieBase),
      dica: item.dica,
      explicacao: item.explicacao,
      resposta_esperada: null,
      imagem_url: null,
      alternativas: item.alternativas,
      avisos: ['Questão de exemplo (modo demonstração). Revise antes de usar.'],
    };
  }

  // Demais áreas (Humanas, Linguagens, Geral)
  return {
    id_temp: idTemp,
    tipo: 'objetiva',
    dificuldade,
    enunciado: padronizarEnunciadoQuestao(
      `Considerando o estudo sobre ${nomeAssunto} no ${serieBase}, analise as situações trabalhadas e assinale a afirmativa correta.`,
      nomeDisciplina,
      serieBase
    ),
    dica: `Revise os conceitos centrais de ${nomeAssunto} apresentados nas aulas.`,
    explicacao: `A resposta correta reflete a fundamentação teórica de ${nomeAssunto} indicada na BNCC.`,
    resposta_esperada: null,
    imagem_url: null,
    alternativas: [
      {
        letra: 'A',
        texto: `Apresenta a aplicação correta dos conceitos centrais de ${nomeAssunto}.`,
        correta: true,
        por_que_errou: null,
      },
      {
        letra: 'B',
        texto: `Atribui propriedades de outro contexto à definição de ${nomeAssunto}.`,
        correta: false,
        por_que_errou: `Houve confusão conceitual entre os elementos essenciais deste tema.`,
      },
      {
        letra: 'C',
        texto: `Desconsidera as condições e relações básicas necessárias do conteúdo.`,
        correta: false,
        por_que_errou: `O conteúdo estudado exige que os fatores estruturantes sejam mantidos.`,
      },
      {
        letra: 'D',
        texto: `Generaliza um caso excepcional como se fosse uma regra universal.`,
        correta: false,
        por_que_errou: `Não é possível generalizar exceções no estudo deste conteúdo curricular.`,
      },
    ],
    avisos: ['Questão de exemplo (modo demonstração). Revise antes de usar.'],
  };
}

function criarQuestaoDiscursivaExemplo(
  indice: number,
  nomeDisciplina: string,
  serie: string,
  nomeAssunto: string,
  dificuldade: DificuldadeQuestao,
  _fotoAnexada: string | null,
  area: AreaConhecimento
): QuestaoSugeridaIA {
  const idTemp = `ia-sug-disc-${Date.now()}-${indice}-${gerarId('tmp')}`;
  const serieBase = normalizarSerieBase(serie);

  if (area === 'exatas') {
    const discursivasMat = [
      {
        enunciado: `Uma biblioteca escolar recebeu $120$ livros novos. Sabendo que $\\frac{2}{5}$ desses livros são de Literatura e $\\frac{1}{3}$ são de Matemática, calcule quantos livros correspondem a cada uma dessas áreas e determine quantos livros restaram para as outras disciplinas. Mostre os cálculos.`,
        dica: `Calcule as frações sobre $120$ dividindo pelo denominador e multiplicando pelo numerador.`,
        explicacao: `Literatura: $\\frac{2}{5} \\times 120 = 48$. Matemática: $\\frac{1}{3} \\times 120 = 40$. Restante: $120 - (48 + 40) = 32$ livros.`,
        resposta_esperada: `Resposta modelo: Literatura = 48 livros; Matemática = 40 livros; Restante = 32 livros.\nCerto: Apresenta os três valores corretos com os cálculos demonstrados.\nParcial: Encontra dois dos três valores ou erra apenas a soma final.\nErrado: Não apresenta raciocínio fracionário coerente.`,
      },
    ];
    const item = discursivasMat[(indice - 1) % discursivasMat.length];
    return {
      id_temp: idTemp,
      tipo: 'discursiva',
      dificuldade,
      enunciado: padronizarEnunciadoQuestao(item.enunciado, nomeDisciplina, serieBase),
      dica: item.dica,
      explicacao: item.explicacao,
      resposta_esperada: item.resposta_esperada,
      imagem_url: null,
      alternativas: undefined,
      avisos: ['Questão de exemplo (modo demonstração). Revise antes de usar.'],
    };
  }

  if (area === 'natureza') {
    const discursivasCiencias = [
      {
        enunciado: `Explique a principal diferença entre animais ectotérmicos e animais endotérmicos no grupo dos vertebrados, citando um exemplo de classe de vertebrados para cada um dos dois grupos.`,
        dica: `Lembre-se de como répteis e mamíferos reagem às variações térmicas do meio ambiente.`,
        explicacao: `Animais ectotérmicos regulam sua temperatura corpórea através do calor do ambiente externo, enquanto endotérmicos produzem calor metabolicamente.`,
        resposta_esperada: `Resposta modelo: Ectotérmicos (ex.: répteis ou anfíbios) dependem de fontes externas de calor para regular a temperatura; endotérmicos (ex.: aves ou mamíferos) mantêm temperatura interna constante através do metabolismo celular.\nCerto: Explica com clareza os dois mecanismos térmicos e cita exemplos corretos de classes para ambos.\nParcial: Explica corretamente apenas um dos grupos ou erra os exemplos.\nErrado: Não define ectotermia/endotermia ou confunde calor metabólico com fontes externas.`,
      },
      {
        enunciado: `Descreva duas adaptações corporais fundamentais que permitiram aos répteis conquistar o ambiente terrestre em definitivo, diferenciando-os da dependência hídrica dos anfíbios.`,
        dica: `Pense nas características de perda de água pela pele e na proteção dos ovos na reprodução.`,
        explicacao: `A pele impermeável e o ovo com casca resistente evitaram a perda de água, viabilizando a vida em locais secos.`,
        resposta_esperada: `Resposta modelo: 1) Pele impermeável queratinizada com escamas/placas que impede o dessecamento. 2) Ovos com casca rígida protetora que retêm água internamente para o embrião.\nCerto: Cita e explica a importância de ambas as adaptações (pele impermeável e ovo com casca).\nParcial: Explica apenas uma das duas adaptações ou não relaciona com a economia de água.\nErrado: Cita características inexistentes ou confunde com adaptações de anfíbios.`,
      },
    ];
    const item = discursivasCiencias[(indice - 1) % discursivasCiencias.length];
    return {
      id_temp: idTemp,
      tipo: 'discursiva',
      dificuldade,
      enunciado: padronizarEnunciadoQuestao(item.enunciado, nomeDisciplina, serieBase),
      dica: item.dica,
      explicacao: item.explicacao,
      resposta_esperada: item.resposta_esperada,
      imagem_url: null,
      alternativas: undefined,
      avisos: ['Questão de exemplo (modo demonstração). Revise antes de usar.'],
    };
  }

  return {
    id_temp: idTemp,
    tipo: 'discursiva',
    dificuldade,
    enunciado: padronizarEnunciadoQuestao(
      `Com base nos conceitos de ${nomeAssunto} estudados no ${serieBase}, elabore uma explicação fundamentada relacionando a teoria a um exemplo prático.`,
      nomeDisciplina,
      serieBase
    ),
    dica: `Apresente a definição principal de ${nomeAssunto} antes de detalhar o exemplo.`,
    explicacao: `Espera-se clareza conceitual sobre ${nomeAssunto} e argumentação adequada para o ${serieBase}.`,
    resposta_esperada: `Resposta modelo: O aluno conceitua ${nomeAssunto} de forma precisa e desenvolve um exemplo contextualizado coerente.\nCerto: Conceitua o tema e apresenta exemplo fundamentado.\nParcial: Apenas conceitua sem exemplificar ou exemplifica sem embasamento.\nErrado: Resposta desconexa ou sem relação com o conteúdo.`,
    imagem_url: null,
    alternativas: undefined,
    avisos: ['Questão de exemplo (modo demonstração). Revise antes de usar.'],
  };
}

/**
 * Faz chamada direta à API Google Gemini (com fallback rápido e timeout por modelo).
 */
async function chamarGeminiAPI(
  apiKey: string,
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  jsonMode: boolean
): Promise<string> {
  const modelos = [
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
  ];

  let ultimoErro = 'Falha ao comunicar com a API do Gemini.';

  for (const modelo of modelos) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const generationConfig: Record<string, unknown> = {
        temperature: 0.4,
        maxOutputTokens: 8192,
      };
      if (jsonMode && !modelo.startsWith('gemma')) {
        generationConfig.responseMimeType = 'application/json';
      }
      if (modelo.startsWith('gemini-3') || modelo.startsWith('gemini-2.5') || modelo.includes('flash-lite')) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const bodyPayload: Record<string, unknown> = {
        contents: [{ parts }],
        generationConfig,
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = (await resp.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          }>;
        };
        const respParts = data.candidates?.[0]?.content?.parts || [];
        const nonThoughtText = respParts
          .filter((p) => !p.thought && typeof p.text === 'string')
          .map((p) => p.text)
          .join('\n')
          .trim();
        const text = nonThoughtText || respParts[respParts.length - 1]?.text;
        if (text) return text;
      } else {
        const errJson = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        ultimoErro = errJson.error?.message || `HTTP ${resp.status}`;
      }
    } catch (e) {
      clearTimeout(timeoutId);
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(ultimoErro);
}

function extrairJsonDeResposta(rawResponse: string): {
  aviso?: string | null;
  questoes?: Array<{
    tipo?: 'objetiva' | 'discursiva';
    dificuldade?: DificuldadeQuestao;
    enunciado?: string;
    dica?: string;
    explicacao?: string;
    resposta_esperada?: string | null;
    alternativas?: Array<{
      letra: 'A' | 'B' | 'C' | 'D';
      texto: string;
      correta: boolean;
      por_que_errou: string | null;
    }>;
  }>;
} {
  const limpo = rawResponse
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = limpo.indexOf('{');
  const lastBrace = limpo.lastIndexOf('}');
  const jsonCandidate =
    firstBrace !== -1 && lastBrace > firstBrace ? limpo.slice(firstBrace, lastBrace + 1) : limpo;

  return JSON.parse(jsonCandidate);
}

function extrairPartesImagem(fotos?: string[]): Array<{ inlineData: { mimeType: string; data: string } }> {
  if (!fotos || fotos.length === 0) return [];
  const partes: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  for (const foto of fotos) {
    const match = foto.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      partes.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }
  }
  return partes;
}

export class MockIAService implements ServicoIA {
  private async esperarDelay(): Promise<void> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  async consultarCota(): Promise<{ uso_mes: number; limite_mes: number }> {
    const usuario = await exigirUsuario(['professor', 'direcao', 'coordenacao']);
    const db = await getDatabase();
    const escola = db.escolas.find((e) => e.id === usuario.escola_id) || db.escolas[0];
    const limite = (escola as { cota_ia_mensal?: number })?.cota_ia_mensal || 200;

    const uso = (db as unknown as { ia_geracoes?: Array<{ id: string }> })?.ia_geracoes?.length || 0;
    return { uso_mes: uso, limite_mes: limite };
  }

  async transcreverImagem(fotos: string[]): Promise<string> {
    await exigirUsuario(['professor', 'direcao', 'coordenacao']);

    if (!fotos || fotos.length === 0) {
      return '';
    }

    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    const apiKey = obterGeminiApiKey();

    if (!isTest && apiKey) {
      const imgParts = extrairPartesImagem(fotos);
      if (imgParts.length > 0) {
        try {
          const textoGemini = await chamarGeminiAPI(
            apiKey,
            [
              ...imgParts,
              {
                text: 'Transcreva fielmente todo o texto pedagógico, enunciados e exercícios contidos nas imagens enviadas, em português do Brasil.',
              },
            ],
            false
          );
          return `Texto extraído das imagens enviadas:\n${textoGemini.trim()}`;
        } catch {
          // Fallback abaixo se falhar
        }
      }
    }

    await this.esperarDelay();
    return (
      'Texto extraído das imagens enviadas:\n' +
      'Conteúdo programático da unidade. Principais definições e propriedades ' +
      'a serem exercitadas em sala de aula, incluindo análise e resolução de situações do cotidiano.'
    );
  }

  async gerarQuestoes(params: GerarQuestoesIAParams): Promise<RespostaGeracaoIA> {
    const usuario = await exigirUsuario(['professor', 'direcao', 'coordenacao']);
    const db = await getDatabase();

    // 1. Verificação de cota
    const cota = await this.consultarCota();
    if (!IA_SEM_LIMITE && cota.uso_mes >= cota.limite_mes) {
      throw new Error('Limite de gerações do mês atingido. Fale com a direção.');
    }

    // 2. Identificação descritiva e higienização
    const disciplina = db.disciplinas.find((d) => d.id === params.disciplina_id);
    const assunto = db.assuntos?.find((a) => a.id === params.assunto_id);
    const nomeDisciplina = disciplina?.nome || 'Ciências';
    const nomeAssunto = assunto?.nome || 'Animais vertebrados';
    const serieBase = normalizarSerieBase(params.serie || '6º Ano');
    const area = identificarArea(nomeDisciplina);

    const totalDesejado = params.qtd_total || (params.qtd_objetivas + params.qtd_discursivas) || 20;
    const qtdDiscursivas = Math.min(params.qtd_discursivas ?? 0, totalDesejado);
    const qtdObjetivas = Math.max(0, totalDesejado - qtdDiscursivas);

    const fotoAnexada =
      params.anexar_foto && params.fotos && params.fotos.length > 0 ? params.fotos[0] : null;

    let questoes: QuestaoSugeridaIA[] = [];

    const isTest =
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
      (typeof navigator !== 'undefined' && navigator.webdriver === true);
    const apiKey = obterGeminiApiKey();

    // 3. Chamada real à API Google Gemini se a chave estiver configurada
    if (!isTest && apiKey) {
      try {
        const imgParts = extrairPartesImagem(params.fotos);

        const lotes: Array<{ obj: number; disc: number; loteIdx: number }> = [];
        let objRest = qtdObjetivas;
        let discRest = qtdDiscursivas;
        let loteIdx = 0;

        while (objRest > 0 || discRest > 0) {
          const objLote = Math.min(objRest, 5);
          objRest -= objLote;
          const capRestante = 5 - objLote;
          const discLote = Math.min(discRest, capRestante);
          discRest -= discLote;
          lotes.push({ obj: objLote, disc: discLote, loteIdx: loteIdx++ });
        }

        const questoesBrutas: NonNullable<ReturnType<typeof extrairJsonDeResposta>['questoes']> = [];

        for (const lote of lotes) {
          const distObj = distribuirDificuldade(lote.obj, params.dificuldade);
          const distDisc = distribuirDificuldade(lote.disc, params.dificuldade);

          const enunciadosAnteriores = questoesBrutas
            .map((q) => (q.enunciado || '').slice(0, 100).trim())
            .filter(Boolean)
            .map((e, idx) => `${idx + 1}. ${e}...`)
            .join('\n');

          const prompt = montarPromptGemini({
            nomeDisciplina,
            serie: serieBase,
            nomeAssunto,
            obj: { total: lote.obj, ...distObj },
            disc: { total: lote.disc, ...distDisc },
            temFotos: Boolean(params.fotos && params.fotos.length > 0),
            textoBase: params.texto_base,
            enunciadosAnteriores: enunciadosAnteriores || undefined,
          });

          const rawResponse = await chamarGeminiAPI(
            apiKey,
            [...imgParts, { text: prompt }],
            true
          );
          const parsed = extrairJsonDeResposta(rawResponse);
          if (Array.isArray(parsed.questoes)) {
            questoesBrutas.push(...parsed.questoes);
          }
        }

        if (questoesBrutas.length > 0) {
          questoes = questoesBrutas.map((q, idx) => {
            const tipo = q.tipo === 'discursiva' ? 'discursiva' : 'objetiva';
            const dif: DificuldadeQuestao =
              q.dificuldade && ['facil', 'medio', 'dificil'].includes(q.dificuldade)
                ? q.dificuldade
                : 'medio';

            return {
              id_temp: `ia-gemini-${Date.now()}-${idx}-${gerarId('tmp')}`,
              tipo,
              dificuldade: dif,
              enunciado: padronizarEnunciadoQuestao(q.enunciado || '', nomeDisciplina, serieBase),
              dica:
                q.dica ||
                (area === 'exatas'
                  ? `Utilize as propriedades de ${nomeAssunto} para estruturar a resolução.`
                  : `Considere os conceitos essenciais de ${nomeAssunto} para orientar sua resposta.`),
              explicacao:
                q.explicacao ||
                (area === 'exatas'
                  ? `Resolução passo a passo aplicando ${nomeAssunto}.`
                  : `Explicação conceitual de ${nomeAssunto} conforme trabalhado no ${serieBase}.`),
              resposta_esperada:
                tipo === 'discursiva'
                  ? q.resposta_esperada ||
                    q.explicacao ||
                    `Resposta modelo: Explicação conceitual de ${nomeAssunto}.\nCerto: Responde com fundamentação completa.\nParcial: Responde parcialmente.\nErrado: Resposta incorreta.`
                  : null,
              imagem_url: null,
              alternativas:
                tipo === 'objetiva' && Array.isArray(q.alternativas) && q.alternativas.length >= 2
                  ? q.alternativas.slice(0, 4).map((alt, aIdx) => ({
                      letra: (['A', 'B', 'C', 'D'][aIdx] || 'A') as 'A' | 'B' | 'C' | 'D',
                      texto: alt.texto,
                      correta: Boolean(alt.correta),
                      por_que_errou: alt.correta
                        ? null
                        : alt.por_que_errou ||
                          (area === 'exatas'
                            ? 'Verifique a operação realizada nesta etapa do cálculo.'
                            : 'Esta afirmativa contraria os conceitos fundamentais do conteúdo.'),
                    }))
                  : undefined,
            };
          });
        }
      } catch (err) {
        console.warn('[SaberPontual IA] Modo demonstração/fallback ativado:', err);
      }
    }

    // 4. Garante a entrega da quantidade exata solicitada (modo demonstração/fallback)
    const objetivasGeradas = questoes.filter((q) => q.tipo === 'objetiva').slice(0, qtdObjetivas);
    const discursivasGeradas = questoes.filter((q) => q.tipo === 'discursiva').slice(0, qtdDiscursivas);

    if (objetivasGeradas.length === 0 && discursivasGeradas.length === 0) {
      await this.esperarDelay();
    }

    const distObjTotal = distribuirDificuldade(qtdObjetivas, params.dificuldade);
    const listaDifObj: DificuldadeQuestao[] = [
      ...Array(distObjTotal.facil).fill('facil'),
      ...Array(distObjTotal.medio).fill('medio'),
      ...Array(distObjTotal.dificil).fill('dificil'),
    ];

    while (objetivasGeradas.length < qtdObjetivas) {
      const i = objetivasGeradas.length + 1;
      const dif = listaDifObj[i - 1] || 'medio';
      objetivasGeradas.push(
        criarQuestaoObjetivaExemplo(i, nomeDisciplina, serieBase, nomeAssunto, dif, fotoAnexada, area)
      );
    }

    const distDiscTotal = distribuirDificuldade(qtdDiscursivas, params.dificuldade);
    const listaDifDisc: DificuldadeQuestao[] = [
      ...Array(distDiscTotal.facil).fill('facil'),
      ...Array(distDiscTotal.medio).fill('medio'),
      ...Array(distDiscTotal.dificil).fill('dificil'),
    ];

    while (discursivasGeradas.length < qtdDiscursivas) {
      const j = discursivasGeradas.length + 1;
      const dif = listaDifDisc[j - 1] || 'medio';
      discursivasGeradas.push(
        criarQuestaoDiscursivaExemplo(j, nomeDisciplina, serieBase, nomeAssunto, dif, fotoAnexada, area)
      );
    }

    // 5. Aplica validação, embaralhamento Fisher-Yates e geração de avisos diagnósticos
    const questoesCombinadas = [...objetivasGeradas, ...discursivasGeradas];
    questoes = ajustarQuestoesIA(questoesCombinadas, area, nomeDisciplina, serieBase);

    // 6. Registra histórico de geração no banco local e no Supabase (resiliente)
    try {
      const dbAtualizado = await getDatabase();
      const dbAny = dbAtualizado as unknown as {
        ia_geracoes?: Array<{
          id: string;
          escola_id: string;
          professor_id: string;
          criado_em: string;
          qtd_fotos: number;
          qtd_objetivas: number;
          qtd_discursivas: number;
          status: 'ok' | 'erro';
        }>;
      };

      if (!dbAny.ia_geracoes) {
        dbAny.ia_geracoes = [];
      }

      const registroGeracao = {
        id: gerarId('iager'),
        escola_id: usuario.escola_id,
        professor_id: usuario.id,
        criado_em: new Date().toISOString(),
        qtd_fotos: params.fotos?.length || 0,
        qtd_objetivas: qtdObjetivas,
        qtd_discursivas: qtdDiscursivas,
        status: 'ok' as const,
      };

      dbAny.ia_geracoes.push(registroGeracao);
      saveDatabase(dbAtualizado);

      if (!isTest && import.meta.env.VITE_DATA_SOURCE === 'supabase') {
        await supabase.from('ia_geracoes').insert(registroGeracao);
      }
    } catch (err) {
      console.warn('[SaberPontual IA] Aviso ao registrar log de geração:', err);
    }

    return {
      questoes,
    };
  }
}
