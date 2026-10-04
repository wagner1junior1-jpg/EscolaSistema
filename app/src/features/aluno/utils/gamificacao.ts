/**
 * SaberPontual — Cálculos de Gamificação e Progresso do Aluno
 * 
 * Regra de Negócio:
 * - Atividades vencidas e não feitas permanecem na lista de exibição da aba "Concluídas",
 *   e contam no total geral (denominador Y) como pendência perdida da meta do bimestre.
 * - No entanto, NÃO contam como concluídas (X), nem inflam a porcentagem de conclusão ou o XP.
 * - Cada atividade feita confere 50 XP + proporcional de aproveitamento (aproveitamento * 0.5).
 * - Cada dia de streak diário confere 15 XP.
 */

/**
 * Calcula o percentual de conclusão da meta do bimestre (0-100%).
 * 
 * As atividades vencidas não feitas ficam no total Y (totalGeral),
 * porque contam como pendência perdida.
 */
export function calcularProgressoGeral(
  totalFeitas: number,
  totalGeral: number
): number {
  if (totalGeral <= 0) return 0;
  return Math.round((totalFeitas / totalGeral) * 100);
}

/**
 * Calcula o XP acumulado do aluno a partir das atividades concluídas (feitas)
 * e dos dias de streak.
 * 
 * Atividades vencidas não concluídas NÃO entram em atividadesFeitas e
 * portanto não geram XP.
 */
export function calcularXpAcumulado(
  atividadesFeitas: Array<{ aproveitamento?: number | null }>,
  diasStreak: number
): number {
  let xp = 0;
  // Cada atividade concluída (feita) confere 50 XP
  xp += atividadesFeitas.length * 50;
  // Aproveitamento de cada atividade feita soma XP proporcional
  for (const ativ of atividadesFeitas) {
    if (ativ.aproveitamento !== undefined && ativ.aproveitamento !== null) {
      xp += Math.round(ativ.aproveitamento * 0.5);
    }
  }
  // Bônus de streak de frequência diária: 15 XP por dia
  xp += Math.max(0, diasStreak) * 15;
  return xp;
}
