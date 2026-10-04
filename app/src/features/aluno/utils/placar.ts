/**
 * SaberPontual — Cálculo de Placar do Aluno
 * 
 * Regra pedagógica oficial (docs/ESPECIFICACAO.md 5 e 6):
 * O placar e a média oficial são calculados ESTRITAMENTE pela 1ª tentativa do aluno.
 * Se o aluno errou na 1ª tentativa e acertou na 2ª (ou posteriores) via "Tentar novamente",
 * a questão continua contando como ERRO para o placar e para o aproveitamento oficial.
 */

import { TipoQuestao, StatusCorrecao } from '@/lib/types';

export interface QuestaoPlacarItem {
  id?: string;
  questao_id?: string;
  acertou?: boolean | null;
  tentativas?: number;
  acertou_final?: boolean | null;
  tipo?: TipoQuestao;
  pontuacao?: number | null;
  correcao?: StatusCorrecao | null;
}

export interface PlacarCalculado {
  total_questoes: number;
  acertos: number;
  erros: number;
  aproveitamento: number;
}

export function calcularPlacar(questoes: QuestaoPlacarItem[]): PlacarCalculado {
  const total_questoes = questoes.length;
  if (total_questoes === 0) {
    return {
      total_questoes: 0,
      acertos: 0,
      erros: 0,
      aproveitamento: 0,
    };
  }

  let acertos = 0;
  let pendentes = 0;
  let erros = 0;

  for (const q of questoes) {
    if (q.tipo === 'discursiva') {
      const isPendente =
        q.correcao === 'pendente' ||
        (!q.correcao && (q.pontuacao === null || q.pontuacao === undefined));

      if (isPendente) {
        pendentes++;
        continue;
      }

      let pontos = 0;
      if (typeof q.pontuacao === 'number' && !isNaN(q.pontuacao)) {
        pontos = Math.min(1, Math.max(0, q.pontuacao / 100));
      } else if (q.correcao === 'certo') {
        pontos = 1;
      } else if (q.correcao === 'parcial') {
        pontos = 0.5;
      } else if (q.correcao === 'errado') {
        pontos = 0;
      }

      acertos += pontos;
      if (pontos === 0) {
        erros++;
      }
    } else {
      // Conta como acerto APENAS se a 1ª tentativa foi bem-sucedida (acertou === true)
      if (q.acertou === true) {
        acertos += 1;
      } else {
        erros += 1;
      }
    }
  }

  const avaliadas = total_questoes - pendentes;
  const aproveitamento =
    avaliadas > 0 ? Math.round((acertos / avaliadas) * 100) : 0;

  const acertosFormatado = Math.round(acertos * 100) / 100;

  return {
    total_questoes,
    acertos: acertosFormatado,
    erros,
    aproveitamento,
  };
}
