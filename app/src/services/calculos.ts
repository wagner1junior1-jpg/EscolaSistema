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
  Atividade,
  ResultadoMediaAluno,
  TipoQuestao,
  StatusCorrecao,
} from '@/lib/types';

declare module '@/lib/types' {
  interface DesempenhoOfertaAtividadeAluno {
    aguardando_correcao?: boolean;
  }
  interface AtividadeResumoAluno {
    aguardando_correcao?: boolean;
  }
  interface DesempenhoTurmaDisciplinaItem {
    aguardando_correcao?: boolean;
  }
  interface ItemMapaDeCalorQuestao {
    distribuicao_discursiva?: {
      certo: { total: number; porcentagem: number };
      parcial: { total: number; porcentagem: number };
      errado: { total: number; porcentagem: number };
    };
  }
}

/**
 * Fonte flexível para consulta de questões de atividades
 */
export type FonteQuestoes =
  | Questao[]
  | Record<string, Questao[]>
  | Map<string, Questao[]>
  | ((atividadeId: string) => Questao[]);

function obterQuestoesDaAtividade(fonte: FonteQuestoes, atividadeId: string): Questao[] {
  if (typeof fonte === 'function') {
    return fonte(atividadeId);
  }
  if (fonte instanceof Map) {
    return fonte.get(atividadeId) || [];
  }
  if (Array.isArray(fonte)) {
    return fonte.filter((q) => q.atividade_id === atividadeId);
  }
  if (fonte && typeof fonte === 'object') {
    return (fonte as Record<string, Questao[]>)[atividadeId] || [];
  }
  return [];
}

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
 * 2.1 Média unificada do aluno nas atividades (Seção 6)
 * Regra única:
 * - Apenas atividades com status 'publicada' ou 'encerrada' (rascunhos nunca entram)
 * - Conta apenas se concluída ou se a atividade estiver 'encerrada'
 * - Na atividade encerrada incompleta, questões sem resposta contam como erro
 * - Considera estritamente a 1ª resposta (campo r.acertou)
 * - Retorna { media, atividades_avaliadas, soma_acertos, soma_questoes }
 */
export function mediaDoAlunoNasAtividades(
  atividades: Array<Pick<Atividade, 'id' | 'status'>>,
  questoesPorAtividade: FonteQuestoes,
  respostasDoAluno: Resposta[]
): ResultadoMediaAluno {
  let soma_acertos = 0;
  let soma_questoes = 0;
  let atividades_avaliadas = 0;

  for (const ativ of atividades) {
    if (ativ.status !== 'publicada' && ativ.status !== 'encerrada') {
      continue;
    }

    const questoes = obterQuestoesDaAtividade(questoesPorAtividade, ativ.id);
    const totalQ = questoes.length;
    if (totalQ === 0) continue;

    const questaoIds = new Set(questoes.map((q) => q.id));
    const respostasDaAtividade = respostasDoAluno.filter((r) => questaoIds.has(r.questao_id));

    const concluida = respostasDaAtividade.length === totalQ;

    // Se o aluno tem discursiva PENDENTE numa atividade, essa atividade fica "aguardando correção" para ele e NÃO entra na média.
    let temDiscursivaPendente = false;
    for (const q of questoes) {
      if (q.tipo === 'discursiva') {
        const r = respostasDaAtividade.find((resp) => resp.questao_id === q.id);
        if (r && (r.correcao === 'pendente' || pontuacaoDaResposta(q, r) === null)) {
          temDiscursivaPendente = true;
          break;
        }
      }
    }

    if (temDiscursivaPendente) {
      continue;
    }

    if (concluida || ativ.status === 'encerrada') {
      atividades_avaliadas++;
      // Usa estritamente a 1ª resposta do aluno e soma os pontos (objetiva: 1 ou 0; discursiva: 1, 0.5 ou 0; sem resposta na encerrada: 0)
      let pontosAtividade = 0;
      for (const q of questoes) {
        const r = respostasDaAtividade.find((resp) => resp.questao_id === q.id);
        const p = pontuacaoDaResposta(q, r);
        if (p !== null) {
          pontosAtividade += p;
        }
      }
      soma_acertos += pontosAtividade;
      soma_questoes += totalQ;
    }
  }

  const media = calcularMediaPeriodo(soma_acertos, soma_questoes);

  return {
    media,
    atividades_avaliadas,
    soma_acertos,
    soma_questoes,
  };
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

  if (questao.tipo === 'discursiva') {
    let somaPontos = 0;
    let totalCerto = 0;
    let totalParcial = 0;
    let totalErrado = 0;

    for (const r of respostasDaQuestao) {
      const p = pontuacaoDaResposta(questao, r);
      if (p !== null) {
        somaPontos += p;
      }
      if (r.correcao === 'certo') totalCerto++;
      else if (r.correcao === 'parcial') totalParcial++;
      else if (r.correcao === 'errado') totalErrado++;
    }

    // % = média dos pontos
    const porcentagemAcerto =
      totalRespostas > 0 ? Math.round((somaPontos / totalRespostas) * 1000) / 10 : 0;

    const pctCerto = totalRespostas > 0 ? Math.round((totalCerto / totalRespostas) * 1000) / 10 : 0;
    const pctParcial = totalRespostas > 0 ? Math.round((totalParcial / totalRespostas) * 1000) / 10 : 0;
    const pctErrado = totalRespostas > 0 ? Math.round((totalErrado / totalRespostas) * 1000) / 10 : 0;

    const letras: LetraAlternativa[] = ['A', 'B', 'C', 'D', 'E'];
    const distribuicao = {} as Record<
      LetraAlternativa,
      { total: number; porcentagem: number; alternativa_id: string }
    >;
    for (const l of letras) {
      distribuicao[l] = { total: 0, porcentagem: 0, alternativa_id: '' };
    }

    return {
      questao_id: questao.id,
      ordem: questao.ordem,
      enunciado: questao.enunciado,
      total_respostas: totalRespostas,
      total_acertos: somaPontos,
      porcentagem_acerto: porcentagemAcerto,
      distribuicao,
      distrator_mais_escolhido: null, // sem distrator
      distribuicao_discursiva: {
        certo: { total: totalCerto, porcentagem: pctCerto },
        parcial: { total: totalParcial, porcentagem: pctParcial },
        errado: { total: totalErrado, porcentagem: pctErrado },
      },
    };
  }

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

/**
 * 6. Pontuação individual da resposta (Fase H - docs/ESPECIFICACAO.md 9.2, 9.3)
 * - Objetiva: 1 se acertou, 0 se errou
 * - Discursiva: certo = 1, parcial = 0.5, errado = 0, pendente ou sem correção = null
 */
export function pontuacaoDaResposta(
  questaoOuCorrecao: { tipo?: TipoQuestao | null } | StatusCorrecao | null | undefined,
  resposta?: {
    acertou?: boolean | null;
    correcao?: StatusCorrecao | null;
    pontuacao?: number | null;
  } | null | undefined
): number | null {
  if (typeof questaoOuCorrecao === 'string') {
    if (questaoOuCorrecao === 'certo') return 1;
    if (questaoOuCorrecao === 'parcial') return 0.5;
    if (questaoOuCorrecao === 'errado') return 0;
    return null;
  }

  if (!resposta) return null;

  // Questão discursiva
  if (questaoOuCorrecao?.tipo === 'discursiva') {
    if (resposta.correcao === 'pendente' || !resposta.correcao) {
      return null;
    }
    // Se a resposta possui pontuação numérica customizada (escala 0..1 ou 0..100)
    if (typeof resposta.pontuacao === 'number' && !isNaN(resposta.pontuacao)) {
      return resposta.pontuacao > 1
        ? Math.min(1, Math.max(0, resposta.pontuacao / 100))
        : Math.min(1, Math.max(0, resposta.pontuacao));
    }
    if (resposta.correcao === 'certo') return 1;
    if (resposta.correcao === 'parcial') return 0.5;
    if (resposta.correcao === 'errado') return 0;
    return null; // 'pendente' ou sem correção (null/undefined)
  }

  // Questão objetiva (padrão)
  return resposta.acertou ? 1 : 0;
}

/**
 * 7. Funções auxiliares para Desempenho Hierárquico e Semáforo Pedagógico
 */

export function calcularTaxaErro(pontosObtidos: number, totalPossivel: number): number {
  if (totalPossivel <= 0) return 0;
  const erro = Math.max(0, totalPossivel - pontosObtidos);
  const valor = (erro / totalPossivel) * 100;
  return Math.round(valor * 10) / 10;
}

export function calcularTaxaAcerto(pontosObtidos: number, totalPossivel: number): number {
  if (totalPossivel <= 0) return 0;
  const valor = (pontosObtidos / totalPossivel) * 100;
  return Math.round(valor * 10) / 10;
}

export type SemaforoPedagogicoCor = 'verde' | 'ambar' | 'vermelho';

export function classificarSemaforoPedagogico(porcentagemErro: number | null): SemaforoPedagogicoCor {
  if (porcentagemErro === null) return 'verde';
  if (porcentagemErro < 25) return 'verde';
  if (porcentagemErro <= 45) return 'ambar';
  return 'vermelho';
}


