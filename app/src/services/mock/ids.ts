/**
 * SaberPontual — Gerador de IDs Criptográficos (Mock)
 * 
 * Gera identificadores únicos baseados em 16 bytes aleatórios (128 bits) em hexadecimal
 * via crypto.getRandomValues, eliminando colisões de Date.now() e Math.random().
 */

export function gerarId(prefixo?: string): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback defensivo caso crypto não esteja disponível
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return prefixo ? `${prefixo}_${hex}` : hex;
}
