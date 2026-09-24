/**
 * SaberPontual — Cálculos Oficiais do Sistema
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seção 6)
 * Funções puras, sem efeitos colaterais e com cobertura integral de testes.
 */

import {
  LetraAlternativa,
  FaixaDesempenho,
  ItemMapaDeCalorQuestao,
  Questao,
  Alternativa,
  Resposta,
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
  somaAcertosOrAtividades: number | Array<{ acertos: number; totalQuestoes: number }>,
  somaQuestoes?: number
): number | null {
  if (Array.isArray(somaAcertosOrAtividades)) {
    const acertos = somaAcertosOrAtividades.reduce((acc, a) => acc + a.acertos, 0);
    const total = somaAcertosOrAtividades.reduce((acc, a) => acc + a.totalQuestoes, 0);
    if (total <= 0) return null;
    return Math.round((acertos / total) * 1000) / 10;
  }

  if (somaQuestoes === undefined || somaQuestoes <= 0) return null;
  const valor = (somaAcertosOrAtividades / somaQuestoes) * 100;
  return Math.round(valor * 10) / 10;
}

/**
 * 3. Faixa de Desempenho
 * Definições oficiais:
 * - Sem atividades: média null (nenhuma atividade concluída ou encerrada)
 * - Ótimo: média >= 80
 * - Bom: média >= 60 e < 80
 * - Atenção: média < 60
 */
export interface LimitesFaixa {
  otimo?: number; // padrão: 80
  bom?: number;   // padrão: 60
}

export function faixaDesempenho(
  media: number | null,
  limites: LimitesFaixa = {}
): FaixaDesempenho {
  if (media === null || media === undefined) {
    return 'Sem atividades';
  }

  const corteOtimo = limites.otimo ?? 80;
  const corteBom = limites.bom ?? 60;

  if (media >= corteOtimo) {
    return 'Ótimo';
  }
  if (media >= corteBom) {
    return 'Bom';
  }
  return 'Atenção';
}

/**
 * 4. Questões Críticas
 * Definição: questões com % de acerto < corte (padrão 50), considerando pelo menos minRespostas (padrão 5).
 */
export function questoesCriticas(
  itensMapa: ItemMapaDeCalorQuestao[],
  minRespostas: number = 5,
  corte: number = 50
): ItemMapaDeCalorQuestao[] {
  return itensMapa
    .filter(
      (item) => item.total_respostas >= minRespostas && item.porcentagem_acerto < corte
    )
    .sort((a, b) => a.porcentagem_acerto - b.porcentagem_acerto);
}

/**
 * 5. Mapa de Calor por Questão
 * Calcula:
 * - % de acerto (baseado sempre na 1ª resposta)
 * - Distribuição de escolhas por alternativa
 * - Distrator mais escolhido com seu 'por_que_errou'
 */
export function calcularMapaDeCalorQuestao(
  questao: Questao,
  alternativas: Alternativa[],
  respostasDaQuestao: Resposta[]
): ItemMapaDeCalorQuestao {
  const totalRespostas = respostasDaQuestao.length;
  // Sempre considera a primeira tentativa (campo 'acertou')
  const acertos = respostasDaQuestao.filter((r) => r.acertou).length;
  const porcentagemAcerto =
    totalRespostas > 0 ? Math.round((acertos / totalRespostas) * 1000) / 10 : 0;

  const letras: LetraAlternativa[] = ['A', 'B', 'C', 'D', 'E'];
  const distribuicao = {} as Record<
    LetraAlternativa,
    { total: number; porcentagem: number; alternativa_id: string }
  >;

  // Inicializa mapa para todas as alternativas da questão
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
