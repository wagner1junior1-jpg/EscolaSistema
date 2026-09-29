/**
 * SaberPontual — Módulo de Validação e Ajuste de Questões Geradas por IA
 * 
 * Executa correções limpas (embaralhamento Fisher-Yates, normalização de prefixos)
 * e gera alertas diagnósticos (avisos) pedagógicos para o professor na tela de revisão.
 */

import { QuestaoSugeridaIA, LetraAlternativa } from '@/lib/types';

export type AreaConhecimento = 'exatas' | 'natureza' | 'humanas' | 'linguagens' | 'geral';

const LETRAS_PADRAO: LetraAlternativa[] = ['A', 'B', 'C', 'D'];

/**
 * Embaralha um array usando o algoritmo Fisher-Yates com gerador de números randômicos injetável.
 */
export function embaralharArray<T>(itens: T[], rand: () => number = Math.random): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Remove qualquer numeração estática ("Questão 1:", "1.", "#1") e qualquer prefixo antigo,
 * garantindo o formato limpo: (Disciplina - SérieBase) Enunciado...
 */
export function limparEnunciadoParaRevisao(
  enunciadoBruto: string,
  nomeDisciplina: string,
  serieBase: string
): string {
  let limpo = (enunciadoBruto || '').trim();

  let mudou = true;
  while (mudou) {
    const anterior = limpo;
    // Remove colchetes ou parênteses anteriores como [Ciências · 6º Ano] ou (Ciências - 6º Ano)
    limpo = limpo.replace(/^\[[^\]]+\]\s*/i, '');
    limpo = limpo.replace(/^\([^)]+\)\s*/i, '');
    // Remove "Questão 1:", "Questão Discursiva 1:", "Questão 01 -", "#1", "1.", "1)"
    limpo = limpo.replace(/^quest[aã]o\s+(?:discursiva\s+|objetiva\s+)?\d+\s*[:.\-–—)\]]*\s*/i, '');
    limpo = limpo.replace(/^#?\d+\s*[:.\-–—)]\s*/i, '');
    limpo = limpo.trim();
    mudou = limpo !== anterior;
  }

  if (limpo.length > 0) {
    limpo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }

  return `(${nomeDisciplina} - ${serieBase}) ${limpo}`;
}

/**
 * Ajusta e valida uma lista de questões sugeridas pela IA:
 * 1. Embaralha alternativas objetivas para evitar viés de gabarito na letra A ou B.
 * 2. Normaliza os enunciados no formato canônico (Disciplina - SérieBase).
 * 3. Analisa e anexa avisos pedagógicos (alertas não bloqueantes para o professor).
 */
export function ajustarQuestoesIA(
  questoes: QuestaoSugeridaIA[],
  area: AreaConhecimento,
  nomeDisciplina: string,
  serieBase: string,
  rand: () => number = Math.random
): QuestaoSugeridaIA[] {
  return questoes.map((q) => {
    const avisos: string[] = [];

    // 1. Normalização do enunciado
    const enunciadoAjustado = limparEnunciadoParaRevisao(q.enunciado, nomeDisciplina, serieBase);

    // Verificação de menção a imagens externas no enunciado
    if (
      /(?:observe|analise|veja|conforme|segundo)\s+(?:a\s+imagem|o\s+gr[aá]fico|a\s+figura|a\s+tabela|o\s+mapa)/i.test(
        enunciadoAjustado
      )
    ) {
      avisos.push('A questão parece depender de uma imagem externa.');
    }

    // Verificação de cálculos em disciplinas que não são de exatas
    if (area !== 'exatas') {
      const temSimboloLatex = /\$|\\frac|\\times|\\div/.test(enunciadoAjustado);
      const temExpressaoCalculo = /\b\d+\s*[\+\-\*\/÷×=]\s*\d+\b/.test(enunciadoAjustado);
      if (temSimboloLatex || temExpressaoCalculo) {
        avisos.push('Parece uma questão de cálculo em disciplina não exata.');
      }
    }

    // 2. Tratamento de questões objetivas
    let alternativasAjustadas = q.alternativas;

    if (q.tipo === 'objetiva' && Array.isArray(q.alternativas) && q.alternativas.length > 0) {
      // Embaralhamento Fisher-Yates
      const embaralhadas = embaralharArray(q.alternativas, rand);

      // Reatribuição das letras A, B, C, D
      alternativasAjustadas = embaralhadas.map((alt, idx) => ({
        ...alt,
        letra: (LETRAS_PADRAO[idx] || 'A') as LetraAlternativa,
        por_que_errou: alt.correta ? null : alt.por_que_errou || null,
      }));

      // Verificação de termos genéricos (todas/nenhuma das anteriores)
      const regexTermosGenericos = /\b(todas\s+(as\s+)?anteriores|nenhuma\s+(das\s+)?anteriores|todas\s+est[aã]o\s+corretas|nenhuma\s+est[aã]o?\s+correta)\b/i;
      const temGenerica = alternativasAjustadas.some((alt) => regexTermosGenericos.test(alt.texto));
      if (temGenerica) {
        avisos.push('Alternativa com termo genérico ("todas/nenhuma das anteriores").');
      }

      // Verificação de extensão desigual (resposta correta muito mais longa)
      const comprimentos = alternativasAjustadas.map((a) => (a.texto || '').trim().length);
      const minComp = Math.min(...comprimentos);
      const maxComp = Math.max(...comprimentos);
      const correta = alternativasAjustadas.find((a) => a.correta);

      if (correta && minComp > 0) {
        const compCorreta = (correta.texto || '').trim().length;
        if (compCorreta === maxComp && compCorreta > minComp * 1.5 && maxComp - minComp > 25) {
          avisos.push('A alternativa correta é bem mais longa que as outras.');
        }
      }

      // Verificação de justificativas faltantes em distratores
      alternativasAjustadas.forEach((alt) => {
        if (!alt.correta && (!alt.por_que_errou || !alt.por_que_errou.trim())) {
          avisos.push(`Falta explicar o erro da alternativa ${alt.letra}.`);
        }
      });
    }

    // 3. Verificação de citação de letras ou posições fixas nos feedbacks
    const regexLetrasFeedback = /\b(?:alternativa|op[cç][aã]o|letra)\s+[A-E]\b/i;
    const textosFeedback = [q.dica, q.explicacao, ...(alternativasAjustadas || []).map((a) => a.por_que_errou)];
    const citaLetra = textosFeedback.some((t) => typeof t === 'string' && regexLetrasFeedback.test(t));
    if (citaLetra) {
      avisos.push('O feedback cita uma letra; ela muda com o embaralhamento.');
    }

    // 4. Verificação de critérios de correção nas discursivas
    if (q.tipo === 'discursiva') {
      const resp = q.resposta_esperada || '';
      const temCriterios = /certo:/i.test(resp) || /parcial:/i.test(resp) || /errado:/i.test(resp);
      if (!temCriterios) {
        avisos.push('Faltam os critérios de correção detalhados na resposta esperada.');
      }
    }

    return {
      ...q,
      enunciado: enunciadoAjustado,
      alternativas: alternativasAjustadas,
      avisos: avisos.length > 0 ? avisos : undefined,
    };
  });
}
