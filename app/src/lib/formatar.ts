/**
 * Utilitários de formatação para exibição na interface.
 */

export function formatarPercentual(valor: number, casas = 1): string {
  const num = Number.isFinite(valor) ? (Math.abs(valor) < 1e-12 ? 0 : valor) : 0;
  const casasDecimais = Math.max(0, Math.floor(casas));
  return `${num.toFixed(casasDecimais).replace('.', ',')}%`;
}

export function pluralizar(qtd: number, singular: string, plural: string): string {
  const termo = qtd === 1 ? singular : plural;
  return `${qtd} ${termo}`;
}
