/**
 * SaberPontual — Cálculo de Placar do Aluno
 * 
 * Regra pedagógica oficial (docs/ESPECIFICACAO.md 5 e 6):
 * O placar e a média oficial são calculados ESTRITAMENTE pela 1ª tentativa do aluno.
 * Se o aluno errou na 1ª tentativa e acertou na 2ª (ou posteriores) via "Tentar novamente",
 * a questão continua contando como ERRO para o placar e para o aproveitamento oficial.
 */

export interface QuestaoPlacarItem {
  id?: string;
  questao_id?: string;
  acertou?: boolean | null;
  tentativas?: number;
  acertou_final?: boolean | null;
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

  // Conta como acerto APENAS se a 1ª tentativa foi bem-sucedida (acertou === true)
  const acertos = questoes.filter((q) => q.acertou === true).length;
  const erros = total_questoes - acertos;
  const aproveitamento = Math.round((acertos / total_questoes) * 1000) / 10;

  return {
    total_questoes,
    acertos,
    erros,
    aproveitamento,
  };
}
