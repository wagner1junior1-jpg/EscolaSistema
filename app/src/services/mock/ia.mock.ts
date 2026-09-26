/**
 * SaberPontual — Serviço de IA (Integração Real Google Gemini + Gerador Matemático com Cálculos)
 * 
 * - Integra com a API do Google Gemini (VITE_GEMINI_API_KEY ou chave configurada no navegador).
 * - Garante que NENHUMA questão contenha numeração ("Questão 1:", "Questão 2:", etc.).
 * - Padroniza o prefixo de todas as questões como: (Matéria - Série) Enunciado...
 * - Gera problemas matemáticos com cálculos reais, frações e fórmulas em LaTeX ($...$).
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
 * Remove qualquer numeração ("Questão 1:", "Questão Discursiva 2:", "1.", "[Mat · 7º Ano]")
 * e padroniza rigorosamente como: (Disciplina - Série) Enunciado...
 */
export function padronizarEnunciadoQuestao(
  enunciadoBruto: string,
  nomeDisciplina: string,
  serie: string
): string {
  let limpo = (enunciadoBruto || '').trim();

  // Remove múltiplos prefixos de matéria/série ou numeração de questão repetidos no início
  let alterou = true;
  while (alterou) {
    const anterior = limpo;
    // Remove [Matemática · 7º Ano] ou (Matemática - 7º Ano) ou (Matemática)
    limpo = limpo.replace(/^\[[^\]]+\]\s*/i, '');
    limpo = limpo.replace(/^\([^)]+\)\s*/i, '');
    // Remove "Questão 1:", "Questão Discursiva 1:", "Questão 01 -", "#1", "1.", "1)"
    limpo = limpo.replace(/^quest[aã]o\s+(?:discursiva\s+|objetiva\s+)?\d+\s*[:.\-–—)\]]*\s*/i, '');
    limpo = limpo.replace(/^#?\d+\s*[:.\-–—)]\s*/i, '');
    limpo = limpo.trim();
    alterou = limpo !== anterior;
  }

  // Garante primeira letra maiúscula
  if (limpo.length > 0) {
    limpo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }

  return `(${nomeDisciplina} - ${serie}) ${limpo}`;
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

/**
 * Gera problemas matemáticos reais com cálculos explícitos, números variados e LaTeX ($...$).
 */
function criarQuestaoObjetivaCalculada(
  indice: number,
  nomeDisciplina: string,
  serie: string,
  nomeAssunto: string,
  dificuldade: DificuldadeQuestao,
  fotoAnexada: string | null
): QuestaoSugeridaIA {
  const isMatematica =
    /matem[aá]tica|[aá]lgebra|geometria|aritm[eé]tica|f[ií]sica|qu[ií]mica/i.test(nomeDisciplina) ||
    /fra[cç][oõ]es|equa[cç][aã]o|porcentagem|n[uú]meros|raz[aã]o|propor[cç][aã]o|pot[eê]ncia|decimal|geometria|[aá]rea/i.test(
      nomeAssunto
    );

  if (!isMatematica) {
    const idTemp = `ia-sug-obj-${Date.now()}-${indice}-${gerarId('tmp')}`;
    return {
      id_temp: idTemp,
      tipo: 'objetiva',
      dificuldade,
      enunciado: padronizarEnunciadoQuestao(
        `Considerando o estudo sobre ${nomeAssunto}, analise o caso concreto apresentado em aula e assinale a alternativa que aplica corretamente esse conceito.`,
        nomeDisciplina,
        serie
      ),
      dica: `Revise a relação entre causa e efeito no tema ${nomeAssunto}.`,
      explicacao: `A resposta correta demonstra a aplicação prática de ${nomeAssunto} conforme trabalhado no ${serie}.`,
      resposta_esperada: null,
      imagem_url: fotoAnexada,
      alternativas: [
        {
          letra: 'A',
          texto: `Demonstra a aplicação direta de ${nomeAssunto} em um contexto real da disciplina.`,
          correta: true,
          por_que_errou: null,
        },
        {
          letra: 'B',
          texto: `Desconsidera a condição principal necessária para a ocorrência de ${nomeAssunto}.`,
          correta: false,
          por_que_errou: `O conceito de ${nomeAssunto} exige que a condição base seja respeitada.`,
        },
        {
          letra: 'C',
          texto: `Atribui a ${nomeAssunto} uma característica exclusiva de outro fenômeno distinto.`,
          correta: false,
          por_que_errou: `Houve confusão entre as propriedades específicas de ${nomeAssunto} e temas correlatos.`,
        },
        {
          letra: 'D',
          texto: `Restringe o conceito de ${nomeAssunto} apenas a casos isolados sem validade geral.`,
          correta: false,
          por_que_errou: `A regra estudada em ${nomeAssunto} se aplica de maneira ampla ao contexto apresentado.`,
        },
      ],
    };
  }

  const bancoProblemas: ProblemaMatematicoTemplate[] = [
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
          por_que_errou: `Você somou diretamente os numeradores ($2+1=3$) e os denominadores ($5+3=8$), o que não é permitido na adição de frações.`,
        },
        {
          letra: 'C',
          texto: `$\\frac{2}{15}$`,
          correta: false,
          por_que_errou: `Você multiplicou os numeradores ($2 \\times 1 = 2$) e os denominadores ($5 \\times 3 = 15$), realizando uma multiplicação em vez de uma soma.`,
        },
        {
          letra: 'D',
          texto: `$\\frac{4}{15}$`,
          correta: false,
          por_que_errou: `Você encontrou o denominador correto ($15$), mas esqueceu de multiplicar os numeradores pelos fatores equivalentes antes de somar.`,
        },
      ],
    },
    {
      enunciado: `Em uma turma de ${serie} com $36$ alunos, verificou-se que $\\frac{3}{4}$ dos estudantes participaram da Olimpíada de Matemática. Quantos alunos dessa turma participaram da olimpíada?`,
      dica: `Para calcular uma fração de um número inteiro, divida o total pelo denominador ($4$) e multiplique o resultado pelo numerador ($3$).`,
      explicacao: `Calculamos $\\frac{3}{4}$ de $36$: primeiro dividimos $36 \\div 4 = 9$ (que corresponde a $\\frac{1}{4}$ da turma) e depois multiplicamos $9 \\times 3 = 27$ alunos.`,
      alternativas: [
        { letra: 'A', texto: `$27$ alunos`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$9$ alunos`,
          correta: false,
          por_que_errou: `Você calculou apenas $\\frac{1}{4}$ da turma ($36 \\div 4 = 9$), que representa os alunos que não participaram, esquecendo de multiplicar por $3$.`,
        },
        {
          letra: 'C',
          texto: `$12$ alunos`,
          correta: false,
          por_que_errou: `Você dividiu $36$ pelo numerador $3$ ($36 \\div 3 = 12$) em vez de dividir pelo denominador $4$ e multiplicar por $3$.`,
        },
        {
          letra: 'D',
          texto: `$24$ alunos`,
          correta: false,
          por_que_errou: `Você considerou $\\frac{2}{3}$ de $36$ ($24$) em vez de calcular $\\frac{3}{4}$ de $36$ ($27$).`,
        },
      ],
    },
    {
      enunciado: `Um reservatório continha $\\frac{7}{8}$ de sua capacidade máxima com água. Após a irrigação da horta escolar, o volume consumido foi equivalente a $\\frac{1}{4}$ da capacidade total do reservatório. Que fração da capacidade total restou no reservatório?`,
      dica: `Reescreva a fração $\\frac{1}{4}$ com denominador $8$ para subtrair diretamente de $\\frac{7}{8}$.`,
      explicacao: `Como $\\frac{1}{4} = \\frac{2}{8}$, subtraímos as frações de mesmo denominador: $\\frac{7}{8} - \\frac{2}{8} = \\frac{5}{8}$.`,
      alternativas: [
        { letra: 'A', texto: `$\\frac{5}{8}$`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$\\frac{6}{4}$`,
          correta: false,
          por_que_errou: `Você subtraiu os numeradores ($7-1=6$) e os denominadores ($8-4=4$) separadamente, sem igualar os denominadores.`,
        },
        {
          letra: 'C',
          texto: `$\\frac{6}{8}$`,
          correta: false,
          por_que_errou: `Você manteve o denominador $8$, mas subtraiu $7 - 1 = 6$ sem converter $\\frac{1}{4}$ para a fração equivalente $\\frac{2}{8}$.`,
        },
        {
          letra: 'D',
          texto: `$\\frac{9}{8}$`,
          correta: false,
          por_que_errou: `Você somou $\\frac{7}{8} + \\frac{2}{8} = \\frac{9}{8}$ em vez de subtrair o volume consumido.`,
        },
      ],
    },
    {
      enunciado: `Simplificando a fração $\\frac{24}{36}$ até obter a sua forma irredutível, qual resultado encontramos?`,
      dica: `Divida o numerador ($24$) e o denominador ($36$) pelo máximo divisor comum (MDC) entre eles, que é $12$.`,
      explicacao: `O MDC entre $24$ e $36$ é $12$. Dividindo numerador e denominador por $12$: $\\frac{24 \\div 12}{36 \\div 12} = \\frac{2}{3}$.`,
      alternativas: [
        { letra: 'A', texto: `$\\frac{2}{3}$`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$\\frac{12}{18}$`,
          correta: false,
          por_que_errou: `A fração $\\frac{12}{18}$ é equivalente, mas você dividiu apenas por $2$, ainda não chegando na forma irredutível.`,
        },
        {
          letra: 'C',
          texto: `$\\frac{4}{6}$`,
          correta: false,
          por_que_errou: `Você simplificou por $6$, mas $\\frac{4}{6}$ ainda pode ser dividida por $2$ para chegar em $\\frac{2}{3}$.`,
        },
        {
          letra: 'D',
          texto: `$\\frac{3}{4}$`,
          correta: false,
          por_que_errou: `Erro na divisão: $24 \\div 8 = 3$, mas $36$ não é divisível por $8$ ($36 \\div 9 = 4$ usa divisores diferentes em cima e embaixo).`,
        },
      ],
    },
    {
      enunciado: `Calcule o valor do produto entre as frações $\\frac{3}{5} \\times \\frac{10}{9}$ na forma simplificada:`,
      dica: `Multiplique numerador por numerador e denominador por denominador, e depois simplifique o resultado pelo MDC.`,
      explicacao: `Multiplicando: $\\frac{3 \\times 10}{5 \\times 9} = \\frac{30}{45}$. Dividindo numerador e denominador por $15$, obtemos $\\frac{30 \\div 15}{45 \\div 15} = \\frac{2}{3}$.`,
      alternativas: [
        { letra: 'A', texto: `$\\frac{2}{3}$`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$\\frac{13}{14}$`,
          correta: false,
          por_que_errou: `Você somou os numeradores ($3+10=13$) e os denominadores ($5+9=14$) em vez de multiplicar.`,
        },
        {
          letra: 'C',
          texto: `$\\frac{27}{50}$`,
          correta: false,
          por_que_errou: `Você multiplicou cruzado ($3 \\times 9 = 27$ e $5 \\times 10 = 50$), procedimento usado na divisão e não na multiplicação.`,
        },
        {
          letra: 'D',
          texto: `$\\frac{3}{2}$`,
          correta: false,
          por_que_errou: `Você inverteu o numerador com o denominador ao final da simplificação de $\\frac{30}{45}$.`,
        },
      ],
    },
    {
      enunciado: `Uma garrafa contém $\\frac{6}{5}$ de litro de suco natural. Se esse conteúdo for dividido igualmente em copos de $\\frac{1}{5}$ de litro cada, quantos copos serão totalmente preenchidos?`,
      dica: `Para dividir uma fração por outra ($\\frac{6}{5} \\div \\frac{1}{5}$), conserve a primeira fração e multiplique pelo inverso da segunda.`,
      explicacao: `Efetuando a divisão de frações: $\\frac{6}{5} \\div \\frac{1}{5} = \\frac{6}{5} \\times \\frac{5}{1} = \\frac{30}{5} = 6$ copos.`,
      alternativas: [
        { letra: 'A', texto: `$6$ copos`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$\\frac{6}{25}$ de copo`,
          correta: false,
          por_que_errou: `Você multiplicou $\\frac{6}{5} \\times \\frac{1}{5} = \\frac{6}{25}$ diretamente sem inverter a segunda fração.`,
        },
        {
          letra: 'C',
          texto: `$5$ copos`,
          correta: false,
          por_que_errou: `Você subtraiu os numeradores ($6 - 1 = 5$) em vez de realizar a divisão entre as frações.`,
        },
        {
          letra: 'D',
          texto: `$\\frac{7}{5}$ copos`,
          correta: false,
          por_que_errou: `Você somou as duas frações ($\\frac{6}{5} + \\frac{1}{5} = \\frac{7}{5}$) em vez de dividir o volume total pelo volume de cada copo.`,
        },
      ],
    },
    {
      enunciado: `Lucas percorreu $\\frac{2}{7}$ de uma trilha ecológica na primeira hora e $\\frac{3}{7}$ na segunda hora. Se a trilha inteira possui $21\\text{ km}$, quantos quilômetros ainda faltam para Lucas completar o percurso?`,
      dica: `Some as frações percorridas, descubra a fração restante para completar $\\frac{7}{7}$ e calcule essa fração sobre os $21\\text{ km}$.`,
      explicacao: `Lucas percorreu $\\frac{2}{7} + \\frac{3}{7} = \\frac{5}{7}$ da trilha. Faltam $\\frac{7}{7} - \\frac{5}{7} = \\frac{2}{7}$ do percurso. Calculando $\\frac{2}{7}$ de $21\\text{ km}$: $(21 \\div 7) \\times 2 = 3 \\times 2 = 6\\text{ km}$.`,
      alternativas: [
        { letra: 'A', texto: `$6\\text{ km}$`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$15\\text{ km}$`,
          correta: false,
          por_que_errou: `$15\\text{ km}$ corresponde à distância que Lucas já percorreu ($\\frac{5}{7}$ de $21\\text{ km}$), e não ao que ainda falta.`,
        },
        {
          letra: 'C',
          texto: `$9\\text{ km}$`,
          correta: false,
          por_que_errou: `$9\\text{ km}$ corresponde apenas ao trecho da segunda hora ($\\frac{3}{7}$ de $21\\text{ km}$).`,
        },
        {
          letra: 'D',
          texto: `$3\\text{ km}$`,
          correta: false,
          por_que_errou: `Você calculou apenas $\\frac{1}{7}$ da trilha ($21 \\div 7 = 3\\text{ km}$), esquecendo de multiplicar por $2$.`,
        },
      ],
    },
    {
      enunciado: `Determine o resultado da expressão numérica envolvendo frações e decimais: $0,5 + \\frac{3}{4} - \\frac{1}{8}$.`,
      dica: `Transforme o número decimal $0,5$ na fração $\\frac{1}{2}$ e iguale todos os denominadores para $8$.`,
      explicacao: `Convertendo $0,5 = \\frac{1}{2} = \\frac{4}{8}$ e $\\frac{3}{4} = \\frac{6}{8}$. A expressão fica: $\\frac{4}{8} + \\frac{6}{8} - \\frac{1}{8} = \\frac{4 + 6 - 1}{8} = \\frac{9}{8}$.`,
      alternativas: [
        { letra: 'A', texto: `$\\frac{9}{8}$`, correta: true, por_que_errou: null },
        {
          letra: 'B',
          texto: `$\\frac{7}{8}$`,
          correta: false,
          por_que_errou: `Você converteu $0,5$ como $\\frac{2}{8}$ em vez de $\\frac{4}{8}$ ao montar a soma.`,
        },
        {
          letra: 'C',
          texto: `$\\frac{11}{8}$`,
          correta: false,
          por_que_errou: `Você somou $\\frac{1}{8}$ ao final ($\\frac{4+6+1}{8} = \\frac{11}{8}$) em vez de subtrair.`,
        },
        {
          letra: 'D',
          texto: `$\\frac{3}{4}$`,
          correta: false,
          por_que_errou: `Você desconsiderou a diferença entre os denominadores $4$ e $8$ ao operar as frações.`,
        },
      ],
    },
  ];

  const item = bancoProblemas[(indice - 1) % bancoProblemas.length];
  const idTemp = `ia-sug-obj-${Date.now()}-${indice}-${gerarId('tmp')}`;

  return {
    id_temp: idTemp,
    tipo: 'objetiva',
    dificuldade,
    enunciado: padronizarEnunciadoQuestao(item.enunciado, nomeDisciplina, serie),
    dica: item.dica,
    explicacao: item.explicacao,
    resposta_esperada: null,
    imagem_url: fotoAnexada,
    alternativas: item.alternativas,
  };
}

function criarQuestaoDiscursivaCalculada(
  indice: number,
  nomeDisciplina: string,
  serie: string,
  nomeAssunto: string,
  dificuldade: DificuldadeQuestao,
  fotoAnexada: string | null
): QuestaoSugeridaIA {
  const isMatematica =
    /matem[aá]tica|[aá]lgebra|geometria|aritm[eé]tica|f[ií]sica|qu[ií]mica/i.test(nomeDisciplina) ||
    /fra[cç][oõ]es|equa[cç][aã]o|porcentagem|n[uú]meros|raz[aã]o|propor[cç][aã]o|pot[eê]ncia|decimal|geometria|[aá]rea/i.test(
      nomeAssunto
    );

  const idTemp = `ia-sug-disc-${Date.now()}-${indice}-${gerarId('tmp')}`;

  if (!isMatematica) {
    return {
      id_temp: idTemp,
      tipo: 'discursiva',
      dificuldade,
      enunciado: padronizarEnunciadoQuestao(
        `Explique com suas palavras como os conceitos de ${nomeAssunto} se aplicam na resolução de situações práticas e apresente um exemplo fundamentado.`,
        nomeDisciplina,
        serie
      ),
      dica: `Apresente a definição central de ${nomeAssunto} antes de desenvolver o exemplo.`,
      explicacao: `Espera-se domínio conceitual de ${nomeAssunto} e clareza na argumentação para o nível de ${serie}.`,
      resposta_esperada: `Gabarito esperado: O aluno deve conceituar ${nomeAssunto} com precisão, relacionar os elementos principais e exemplificar sua aplicação prática.`,
      imagem_url: fotoAnexada,
      alternativas: undefined,
    };
  }

  const discursivasMat = [
    {
      enunciado: `Uma biblioteca escolar recebeu uma doação de $120$ livros novos. Sabendo que $\\frac{2}{5}$ desses livros são de Literatura, $\\frac{1}{3}$ são de Matemática e o restante é de Ciências, calcule quantos livros de cada área a biblioteca recebeu e determine a fração que representa os livros de Ciências. Apresente todos os cálculos.`,
      dica: `Calcule separadamente $\\frac{2}{5}$ de $120$ e $\\frac{1}{3}$ de $120$, ou encontre o MMC entre $5$ e $3$ para descobrir a fração restante.`,
      explicacao: `O aluno deve calcular a quantidade de livros de Literatura ($48$), de Matemática ($40$) e subtrair de $120$ para obter Ciências ($32$), além de indicar a fração $\\frac{4}{15}$.`,
      resposta_esperada: `Cálculo passo a passo: 1) Literatura: $\\frac{2}{5} \\times 120 = 48$ livros. 2) Matemática: $\\frac{1}{3} \\times 120 = 40$ livros. 3) Ciências: $120 - (48 + 40) = 120 - 88 = 32$ livros. 4) Fração de Ciências: $1 - (\\frac{2}{5} + \\frac{1}{3}) = 1 - \\frac{6+5}{15} = \\frac{15}{15} - \\frac{11}{15} = \\frac{4}{15}$.`,
    },
    {
      enunciado: `Pedro reservou $\\frac{1}{4}$ de sua mesada para comprar um livro e $\\frac{3}{8}$ para o lanche da semana, sobrando ainda $\\text{R\\$ } 30,00$. Demonstre por meio de cálculos qual era o valor total da mesada de Pedro.`,
      dica: `Some as frações gastas ($\\frac{1}{4} + \\frac{3}{8}$) para descobrir que fração da mesada corresponde aos $\\text{R\\$ } 30,00$ restantes.`,
      explicacao: `Igualando os denominadores, o gasto total foi de $\\frac{5}{8}$ da mesada. Logo, os $\\text{R\\$ } 30,00$ equivalem a $\\frac{3}{8}$ do valor total.`,
      resposta_esperada: `1) Fração gasta: $\\frac{1}{4} + \\frac{3}{8} = \\frac{2}{8} + \\frac{3}{8} = \\frac{5}{8}$. 2) Fração restante: $1 - \\frac{5}{8} = \\frac{3}{8}$. 3) Como $\\frac{3}{8}$ equivalem a $\\text{R\\$ } 30,00$, temos que $\\frac{1}{8}$ equivale a $30 \\div 3 = \\text{R\\$ } 10,00$. 4) Valor total da mesada: $10 \\times 8 = \\text{R\\$ } 80,00$.`,
    },
    {
      enunciado: `Resolva a expressão fracionária $\\left(\\frac{3}{4} + \\frac{1}{2}\\right) \\div \\frac{5}{8}$, apresentando todas as etapas de cálculo até a forma mais simples do resultado.`,
      dica: `Resolva primeiro a adição dentro dos parênteses igualando os denominadores e, em seguida, multiplique pelo inverso de $\\frac{5}{8}$.`,
      explicacao: `Soma-se $\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$ e divide-se por $\\frac{5}{8}$ multiplicando por $\\frac{8}{5}$, resultando em $2$.`,
      resposta_esperada: `1) Parênteses: $\\frac{3}{4} + \\frac{1}{2} = \\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$. 2) Divisão: $\\frac{5}{4} \\div \\frac{5}{8} = \\frac{5}{4} \\times \\frac{8}{5} = \\frac{40}{20} = 2$.`,
    },
  ];

  const item = discursivasMat[(indice - 1) % discursivasMat.length];

  return {
    id_temp: idTemp,
    tipo: 'discursiva',
    dificuldade,
    enunciado: padronizarEnunciadoQuestao(item.enunciado, nomeDisciplina, serie),
    dica: item.dica,
    explicacao: item.explicacao,
    resposta_esperada: item.resposta_esperada,
    imagem_url: fotoAnexada,
    alternativas: undefined,
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

    // Contagem de gerações do mês atual
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
                text: 'Transcreva fielmente todo o texto pedagógico, enunciados, fórmulas (usando LaTeX entre $...$) e exercícios contidos nas imagens enviadas, em português do Brasil.',
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
      'Conteúdo programático da unidade. Principais definições, fórmulas e propriedades ' +
      'a serem exercitadas em sala de aula, incluindo resolução de problemas práticos do cotidiano ' +
      'e análise crítica dos resultados obtidos.'
    );
  }

  async gerarQuestoes(params: GerarQuestoesIAParams): Promise<RespostaGeracaoIA> {
    const usuario = await exigirUsuario(['professor', 'direcao', 'coordenacao']);
    const db = await getDatabase();

    // 1. Verificação de cota
    const cota = await this.consultarCota();
    if (cota.uso_mes >= cota.limite_mes) {
      throw new Error('Limite de gerações do mês atingido. Fale com a direção.');
    }

    // 2. Busca nomes descritivos
    const disciplina = db.disciplinas.find((d) => d.id === params.disciplina_id);
    const assunto = db.assuntos?.find((a) => a.id === params.assunto_id);
    const nomeDisciplina = disciplina?.nome || 'Matemática';
    const nomeAssunto = assunto?.nome || 'Frações';
    const serie = params.serie || '7º Ano';

    const totalDesejado = params.qtd_total || (params.qtd_objetivas + params.qtd_discursivas) || 20;
    const qtdDiscursivas = Math.min(params.qtd_discursivas ?? 0, totalDesejado);
    const qtdObjetivas = Math.max(0, totalDesejado - qtdDiscursivas);

    const dificuldades: DificuldadeQuestao[] =
      params.dificuldade && params.dificuldade !== 'misturada'
        ? [params.dificuldade]
        : ['facil', 'medio', 'dificil'];

    const fotoAnexada =
      params.anexar_foto && params.fotos && params.fotos.length > 0 ? params.fotos[0] : null;

    let questoes: QuestaoSugeridaIA[] = [];

    const isTest =
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
      (typeof navigator !== 'undefined' && navigator.webdriver === true);
    const apiKey = obterGeminiApiKey();

    // 3. Se houver chave do Google Gemini configurada, gera questões inéditas com cálculos reais via IA
    if (!isTest && apiKey) {
      try {
        const imgParts = extrairPartesImagem(params.fotos);

        // Divide em lotes de até 5 questões em paralelo para resposta rápida e sem truncamento de JSON
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

        const gerarLote = async (lote: { obj: number; disc: number; loteIdx: number }) => {
          const prompt = `Você é um professor especialista da educação básica brasileira (BNCC).
Elabore exatamente ${lote.obj} questões OBJETIVAS e ${lote.disc} questões DISCURSIVAS inéditas (Lote ${
            lote.loteIdx + 1
          }, crie enunciados e valores numéricos diferentes) sobre:
- Disciplina: ${nomeDisciplina}
- Série: ${serie}
- Assunto: ${nomeAssunto}
- Nível de dificuldade: ${params.dificuldade || 'misturada'}
${params.texto_base ? `- Conteúdo/Texto de apoio fornecido pelo professor:\n${params.texto_base}\n` : ''}

REGRAS OBRIGATÓRIAS E INEGOCIÁVEIS:
1. PROIBIDO numerar as questões (NUNCA escreva "Questão 1:", "Questão 2:", "1.", "#1" no enunciado).
2. O enunciado de CADA questão deve iniciar EXATAMENTE com "(${nomeDisciplina} - ${serie}) " seguido do problema completo.
3. Para Matemática, Física, Química ou temas com contas (como ${nomeAssunto}):
   - CRIE PROBLEMAS REAIS COM NÚMEROS, CONTAS E CÁLCULOS MATEMÁTICOS EXPLÍCITOS!
   - É TERMINANTEMENTE PROIBIDO gerar textos genéricos como "Afirmação correta sobre...", "Inverte a relação...".
   - Escreva todas as frações, equações, potências e expressões matemáticas em formato LaTeX entre cifrões simples, por exemplo: $\\frac{3}{4}$, $\\frac{2}{5} + \\frac{1}{3} = \\frac{11}{15}$, $2x + 5 = 17$.
4. Cada questão OBJETIVA deve conter exatamente 4 alternativas (letras "A", "B", "C", "D") com os valores numéricos/calculados:
   - Exatamente 1 alternativa com "correta": true e "por_que_errou": null.
   - As outras 3 alternativas com "correta": false e valores resultantes de erros comuns de cálculo dos alunos (distratores reais), explicando em "por_que_errou" qual foi o erro exato da conta.
5. O campo "explicacao" deve demonstrar o passo a passo completo da conta até chegar ao resultado correto.
6. Nas questões DISCURSIVAS, "alternativas" deve ser omitido/null e "resposta_esperada" deve conter a resolução matemática completa passo a passo com o resultado final.

Retorne APENAS um JSON válido no formato:
{
  "questoes": [
    {
      "tipo": "objetiva" | "discursiva",
      "dificuldade": "facil" | "medio" | "dificil",
      "enunciado": "(${nomeDisciplina} - ${serie}) ...",
      "dica": "...",
      "explicacao": "...",
      "resposta_esperada": null | "...",
      "alternativas": [
        { "letra": "A", "texto": "...", "correta": true, "por_que_errou": null },
        { "letra": "B", "texto": "...", "correta": false, "por_que_errou": "..." },
        { "letra": "C", "texto": "...", "correta": false, "por_que_errou": "..." },
        { "letra": "D", "texto": "...", "correta": false, "por_que_errou": "..." }
      ]
    }
  ]
}`;

          const rawResponse = await chamarGeminiAPI(
            apiKey,
            [...imgParts, { text: prompt }],
            true
          );
          const parsed = extrairJsonDeResposta(rawResponse);
          return parsed.questoes || [];
        };

        const resultadosLotes = await Promise.allSettled(lotes.map((l) => gerarLote(l)));
        const questoesBrutas: NonNullable<ReturnType<typeof extrairJsonDeResposta>['questoes']> = [];

        for (const res of resultadosLotes) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            questoesBrutas.push(...res.value);
          }
        }

        if (questoesBrutas.length > 0) {
          questoes = questoesBrutas.map((q, idx) => {
            const tipo = q.tipo === 'discursiva' ? 'discursiva' : 'objetiva';
            const dif: DificuldadeQuestao =
              q.dificuldade && ['facil', 'medio', 'dificil'].includes(q.dificuldade)
                ? q.dificuldade
                : dificuldades[idx % dificuldades.length];

            return {
              id_temp: `ia-gemini-${Date.now()}-${idx}-${gerarId('tmp')}`,
              tipo,
              dificuldade: dif,
              enunciado: padronizarEnunciadoQuestao(q.enunciado || '', nomeDisciplina, serie),
              dica: q.dica || `Utilize as propriedades de ${nomeAssunto} para estruturar o cálculo.`,
              explicacao: q.explicacao || `Resolução passo a passo aplicando ${nomeAssunto}.`,
              resposta_esperada:
                tipo === 'discursiva'
                  ? q.resposta_esperada || q.explicacao || 'Resolução demonstrada etapa por etapa.'
                  : null,
              imagem_url: fotoAnexada,
              alternativas:
                tipo === 'objetiva' && Array.isArray(q.alternativas) && q.alternativas.length >= 2
                  ? q.alternativas.slice(0, 4).map((alt, aIdx) => ({
                      letra: (['A', 'B', 'C', 'D'][aIdx] || 'A') as 'A' | 'B' | 'C' | 'D',
                      texto: alt.texto,
                      correta: Boolean(alt.correta),
                      por_que_errou: alt.correta
                        ? null
                        : alt.por_que_errou || 'Verifique a operação realizada nesta etapa do cálculo.',
                    }))
                  : undefined,
            };
          });
        }
      } catch (err) {
        console.warn('[SaberPontual IA] Fallback para banco matemático calculado:', err);
      }
    }

    // 4. Garante que a quantidade exata de objetivas e discursivas solicitadas seja entregue
    const objetivasGeradas = questoes.filter((q) => q.tipo === 'objetiva').slice(0, qtdObjetivas);
    const discursivasGeradas = questoes.filter((q) => q.tipo === 'discursiva').slice(0, qtdDiscursivas);

    if (objetivasGeradas.length === 0 && discursivasGeradas.length === 0) {
      await this.esperarDelay();
    }

    while (objetivasGeradas.length < qtdObjetivas) {
      const i = objetivasGeradas.length + 1;
      const dif = dificuldades[(i - 1) % dificuldades.length];
      objetivasGeradas.push(
        criarQuestaoObjetivaCalculada(i, nomeDisciplina, serie, nomeAssunto, dif, fotoAnexada)
      );
    }

    while (discursivasGeradas.length < qtdDiscursivas) {
      const j = discursivasGeradas.length + 1;
      const dif = dificuldades[(j - 1) % dificuldades.length];
      discursivasGeradas.push(
        criarQuestaoDiscursivaCalculada(j, nomeDisciplina, serie, nomeAssunto, dif, fotoAnexada)
      );
    }

    questoes = [...objetivasGeradas, ...discursivasGeradas];

    // 5. Registra histórico de geração no banco local e no Supabase (de forma resiliente)
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
