/**
 * SaberPontual — sorteio de questões do banco
 *
 * Embaralhamento Fisher-Yates, usado pelo sortearDoBanco do mock e do Supabase para que o
 * "sorteio" seja de fato aleatório (antes pegava sempre as primeiras questões da lista).
 */

/** Devolve uma cópia embaralhada de `lista`. `aleatorio` devolve um número em [0, 1) (injetável em testes). */
export function embaralhar<T>(lista: readonly T[], aleatorio: () => number = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
