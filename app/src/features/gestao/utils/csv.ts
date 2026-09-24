/**
 * Utilitário de Geração e Exportação de CSV
 * 
 * Padrão brasileiro:
 * - Prefixo BOM UTF-8 (\uFEFF) para correta abertura no Excel
 * - Separador de colunas: ponto e vírgula (;)
 * - Escape de campos com ;, aspas duplas ("") ou quebras de linha
 */

export interface ColunaCsv<T = Record<string, unknown>> {
  chave: keyof T | string;
  rotulo: string;
}

export function gerarCsv<T extends Record<string, unknown>>(
  linhas: T[],
  colunas: ColunaCsv<T>[]
): string {
  const BOM = '\uFEFF';
  const delimitador = ';';

  const formatarValor = (valor: unknown): string => {
    if (valor === null || valor === undefined) {
      return '';
    }
    const str = String(valor);
    if (
      str.includes(delimitador) ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const cabecalho = colunas.map((col) => formatarValor(col.rotulo)).join(delimitador);

  const corpo = linhas.map((linha) => {
    return colunas
      .map((col) => {
        const val = linha[col.chave as string];
        return formatarValor(val);
      })
      .join(delimitador);
  });

  return BOM + [cabecalho, ...corpo].join('\r\n');
}

export function baixarCsv(nomeArquivo: string, conteudoCsv: string): void {
  const nomeFinal = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', nomeFinal);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
