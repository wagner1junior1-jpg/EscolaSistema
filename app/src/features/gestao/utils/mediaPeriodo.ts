import { DesempenhoTurmaHierarquico } from '@/lib/types';

/**
 * Média geral do período (0–100, uma casa decimal), ponderada pelo total de respostas
 * de cada matéria. `porcentagem_acerto` das matérias já vem em 0–100.
 * Retorna null quando não há nenhuma resposta no período.
 */
export function calcularMediaGeralPeriodo(
  turmas: Pick<DesempenhoTurmaHierarquico, 'materias'>[]
): number | null {
  let somaPontos = 0;
  let totalRespostas = 0;
  for (const turma of turmas) {
    for (const materia of turma.materias) {
      if (materia.total_respostas > 0) {
        somaPontos += materia.porcentagem_acerto * materia.total_respostas;
        totalRespostas += materia.total_respostas;
      }
    }
  }
  return totalRespostas > 0 ? Math.round((somaPontos / totalRespostas) * 10) / 10 : null;
}
