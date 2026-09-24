/**
 * SaberPontual — Cálculos Oficiais do Sistema
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seção 6)
 * Funções puras, sem efeitos colaterais e com cobertura integral de testes.
 */

import {
  LetraAlternativa,
  SituacaoConselho,
  ItemMapaDeCalorQuestao,
  Questao,
  Alternativa,
  Resposta,
  Frequencia,
} from '@/lib/types';

/**
 * 1. Aproveitamento em uma atividade
 * Fórmula: (acertos / total de questões da atividade) * 100
 */
export function calcularAproveitamentoAtividade(
  acertos: number,
  totalQuestoes: number
): number {
  if (totalQuestoes <= 0) return 0;
  const valor = (acertos / totalQuestoes) * 100;
  return Math.round(valor * 10) / 10;
}

/**
 * 2. Média do aluno na oferta e no período
 * Fórmula: (soma dos acertos / soma das questões) * 100
 * Considerando apenas as atividades concluídas ou encerradas do período. Rascunhos nunca entram.
 */
export function calcularMediaPeriodo(
  somaAcertos: number,
  somaQuestoes: number
): number | null {
  if (somaQuestoes <= 0) return null;
  const valor = (somaAcertos / somaQuestoes) * 100;
  return Math.round(valor * 10) / 10;
}

/**
 * 3. Frequência Escolar
 * Fórmula: (P + J) / dias com registro para aquele aluno * 100
 * Regra obrigatória: "Dia sem registro do aluno não entra no cálculo."
 */
export function calcularFrequencia(
  presencas: number,
  justificadas: number,
  diasComRegistro: number
): number | null {
  if (diasComRegistro <= 0) return null;
  const valor = ((presencas + justificadas) / diasComRegistro) * 100;
  return Math.round(valor * 10) / 10;
}

/**
 * 4. Situação no Conselho de Classe
 * Definições oficiais:
 * - Sem avaliação: nenhuma atividade concluída
 * - Risco por infrequência: frequência < 75%
 * - Reforço: média < 60%
 * - Destaque: média >= 80% e frequência >= 85%
 * - Adequado: média >= 60% e frequência >= 75%
 */
export interface LimitesConselho {
  corteDestaqueMedia?: number; // padrão: 80
  corteDestaqueFreq?: number; // padrão: 85
  corteAprovadoMedia?: number; // padrão: 60
  corteAprovadoFreq?: number; // padrão: 75
}

export function determinarSituacaoConselho(
  media: number | null,
  frequencia: number | null,
  possuiAtividadesAvaliadas: boolean,
  limites: LimitesConselho = {}
): SituacaoConselho {
  if (!possuiAtividadesAvaliadas || media === null) {
    return 'Sem avaliação';
  }

  const corteDestaqueMedia = limites.corteDestaqueMedia ?? 80;
  const corteDestaqueFreq = limites.corteDestaqueFreq ?? 85;
  const corteAprovadoMedia = limites.corteAprovadoMedia ?? 60;
  const corteAprovadoFreq = limites.corteAprovadoFreq ?? 75;

  const freq = frequencia ?? 100;

  // Se infrequente, o risco de reprovação por falta é primário
  if (freq < corteAprovadoFreq) {
    return 'Risco por infrequência';
  }

  // Se a média estiver abaixo do mínimo pedagógico
  if (media < corteAprovadoMedia) {
    return 'Reforço';
  }

  // Destaque se atingir os critérios superiores
  if (media >= corteDestaqueMedia && freq >= corteDestaqueFreq) {
    return 'Destaque';
  }

  return 'Adequado';
}

/**
 * 5. Mapa de Calor por Questão
 * Calcula:
 * - % de acerto
 * - Distribuição de escolhas por alternativa
 * - Distrator mais escolhido com seu 'por_que_errou'
 */
export function calcularMapaDeCalorQuestao(
  questao: Questao,
  alternativas: Alternativa[],
  respostasDaQuestao: Resposta[]
): ItemMapaDeCalorQuestao {
  const totalRespostas = respostasDaQuestao.length;
  const acertos = respostasDaQuestao.filter((r) => r.acertou).length;
  const porcentagemAcerto =
    totalRespostas > 0 ? Math.round((acertos / totalRespostas) * 1000) / 10 : 0;

  const letras: LetraAlternativa[] = ['A', 'B', 'C', 'D', 'E'];
  const distribuicao = {} as Record<
    LetraAlternativa,
    { total: number; porcentagem: number; alternativa_id: string }
  >;

  // Inicializa mapa para todas as letras presentes
  for (const alt of alternativas) {
    const totalEscolhida = respostasDaQuestao.filter(
      (r) => r.alternativa_id === alt.id
    ).length;
    const pct =
      totalRespostas > 0 ? Math.round((totalEscolhida / totalRespostas) * 1000) / 10 : 0;

    distribuicao[alt.letra] = {
      total: totalEscolhida,
      porcentagem: pct,
      alternativa_id: alt.id,
    };
  }

  // Preenche letras ausentes com zeros
  for (const l of letras) {
    if (!distribuicao[l]) {
      distribuicao[l] = { total: 0, porcentagem: 0, alternativa_id: '' };
    }
  }

  // Distrator mais escolhido (alternativa errada com maior contagem > 0)
  const alternativasErradas = alternativas.filter((a) => !a.correta);
  let distratorMaisEscolhido: ItemMapaDeCalorQuestao['distrator_mais_escolhido'] = null;

  let maxVotosDistrator = 0;
  let altMaisVotada: Alternativa | null = null;

  for (const altErrada of alternativasErradas) {
    const votos = distribuicao[altErrada.letra]?.total ?? 0;
    if (votos > maxVotosDistrator) {
      maxVotosDistrator = votos;
      altMaisVotada = altErrada;
    }
  }

  if (altMaisVotada && maxVotosDistrator > 0) {
    distratorMaisEscolhido = {
      letra: altMaisVotada.letra,
      por_que_errou: altMaisVotada.por_que_errou,
      total_escolhas: maxVotosDistrator,
    };
  }

  return {
    questao_id: questao.id,
    ordem: questao.ordem,
    enunciado: questao.enunciado,
    total_respostas: totalRespostas,
    total_acertos: acertos,
    porcentagem_acerto: porcentagemAcerto,
    distribuicao,
    distrator_mais_escolhido: distratorMaisEscolhido,
  };
}

/**
 * Utilitário para cálculo de frequência a partir da lista de registros brutos de um aluno
 */
export function consolidarFrequenciaAluno(registrosDoAluno: Frequencia[]): {
  presencas: number;
  faltas: number;
  justificadas: number;
  diasComRegistro: number;
  porcentagem: number | null;
} {
  const presencas = registrosDoAluno.filter((r) => r.status === 'P').length;
  const faltas = registrosDoAluno.filter((r) => r.status === 'F').length;
  const justificadas = registrosDoAluno.filter((r) => r.status === 'J').length;
  const diasComRegistro = registrosDoAluno.length;

  return {
    presencas,
    faltas,
    justificadas,
    diasComRegistro,
    porcentagem: calcularFrequencia(presencas, justificadas, diasComRegistro),
  };
}
