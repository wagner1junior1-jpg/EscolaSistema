/**
 * SaberPontual — Utilitários de Data e Horário
 */

/**
 * Retorna a data no formato YYYY-MM-DD considerando o fuso horário local (do navegador/cliente).
 * Aceita uma instância de Date opcional para facilitar testes e manipulações.
 */
export function hojeLocal(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
