/**
 * SaberPontual — Utilitários Criptográficos (Mock)
 * 
 * SHA-256 padrão para hash de PINs e sessões.
 * Se crypto.subtle não existir, utiliza uma implementação pura de SHA-256 em JS
 * sem expor dados em claro nem depender de bibliotecas externas.
 */

// Implementação pura de SHA-256 (FIPS 180-4) para fallback
function sha256Puro(mensagem: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;

  let result = '';
  const words: number[] = [];
  const asciiBitLength = mensagem[lengthProperty] * 8;

  // Constantes de inicialização (primeiros 32 bits das partes fracionárias das raízes quadradas dos primeiros 8 primos)
  const hash: number[] = [];
  // Constantes de rodada (primeiros 32 bits das partes fracionárias das raízes cúbicas dos primeiros 64 primos)
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = candidate;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  mensagem += '\x80';
  while ((mensagem[lengthProperty] % 64) - 56) mensagem += '\x00';

  for (i = 0; i < mensagem[lengthProperty]; i++) {
    j = mensagem.charCodeAt(i);
    if (j >> 8) return ''; // Apenas ASCII
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        w[i];
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function hashString(value: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback em caso de falha de contexto
    }
  }

  return sha256Puro(value);
}

export async function hashPin(pin: string): Promise<string> {
  return hashString(`saberpontual_pin_${pin.trim()}`);
}

export async function hashToken(token: string): Promise<string> {
  return hashString(`saberpontual_session_${token}`);
}

export function gerarTokenAleatorio(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function gerarPin4Digitos(): string {
  const bytes = new Uint8Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    const num = ((bytes[0] << 8) | bytes[1]) % 9000 + 1000;
    return num.toString();
  }
  const pin = Math.floor(1000 + Math.random() * 9000);
  return pin.toString();
}
