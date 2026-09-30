/**
 * Utilitários para processamento e redução de imagens.
 */

export interface OpcoesReducaoImagem {
  maxLado?: number;
  maxBytes?: number;
}

/**
 * Calcula novas dimensões mantendo a proporção original.
 * Se a imagem já couber dentro de maxLado, devolve as dimensões originais (nunca amplia).
 */
export function calcularDimensoes(
  largura: number,
  altura: number,
  maxLado: number
): { largura: number; altura: number } {
  if (largura <= maxLado && altura <= maxLado) {
    return { largura, altura };
  }

  if (largura >= altura) {
    return {
      largura: maxLado,
      altura: Math.round((altura * maxLado) / largura),
    };
  }

  return {
    largura: Math.round((largura * maxLado) / altura),
    altura: maxLado,
  };
}

/**
 * Carrega um arquivo de imagem em um elemento HTMLImageElement.
 */
function carregarElementoImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!arquivo || typeof arquivo.type !== 'string' || !arquivo.type.startsWith('image/')) {
      reject(new Error('Escolha um arquivo de imagem.'));
      return;
    }

    const objectUrl = URL.createObjectURL(arquivo);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error('Escolha um arquivo de imagem.'));
      } else {
        resolve(img);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Escolha um arquivo de imagem.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Reduz uma imagem ajustando resolução e qualidade JPEG até que o tamanho em bytes
 * estimado não exceda maxBytes.
 */
export async function reduzirImagem(
  arquivo: File,
  opcoes?: OpcoesReducaoImagem
): Promise<string> {
  if (!arquivo || typeof arquivo.type !== 'string' || !arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.');
  }

  const img = await carregarElementoImagem(arquivo);

  let maxLado = opcoes?.maxLado ?? 1600;
  const maxBytes = opcoes?.maxBytes ?? 307200; // 300 KB padrão

  const MAX_TENTATIVAS_REDUCAO = 3;

  for (let tentativa = 0; tentativa <= MAX_TENTATIVAS_REDUCAO; tentativa++) {
    if (tentativa > 0) {
      maxLado = Math.round(maxLado * 0.8);
    }

    const { largura, altura } = calcularDimensoes(img.naturalWidth, img.naturalHeight, maxLado);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, largura);
    canvas.height = Math.max(1, altura);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Não foi possível processar a imagem.');
    }

    // Fundo branco caso a imagem original tenha transparência (ex: PNG/WebP)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Começa em q = 0.85 e baixa de 0.05 em 0.05 até 0.5
    for (let qInt = 85; qInt >= 50; qInt -= 5) {
      const q = qInt / 100;
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const tamanhoEstimado = Math.round((base64Data.length * 3) / 4);

      if (tamanhoEstimado <= maxBytes) {
        return dataUrl;
      }
    }
  }

  throw new Error('Não foi possível reduzir esta imagem. Tente uma foto menor.');
}
