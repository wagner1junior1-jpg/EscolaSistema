import { describe, it, expect, vi } from 'vitest';
import { lerTudoPorIds, TAMANHO_BLOCO_IDS, TAMANHO_PAGINA } from '../supabase/paginacao';

/** Tabela falsa que obedece a `.in('x', bloco)` e `.range(de, ate)` como o PostgREST. */
function tabelaFalsa(linhas: Array<{ id: string; grupo: string }>, falharNaPagina?: number) {
  const chamadas: Array<{ bloco: string[]; de: number; ate: number }> = [];
  let paginasLidas = 0;
  const montar = (bloco: string[]) => {
    const filtradas = linhas.filter((l) => bloco.includes(l.grupo));
    return {
      order: () => ({
        range: async (de: number, ate: number) => {
          chamadas.push({ bloco, de, ate });
          paginasLidas++;
          if (falharNaPagina === paginasLidas) return { data: null, error: { message: 'boom' } };
          return { data: filtradas.slice(de, ate + 1), error: null };
        },
      }),
    };
  };
  return { montar, chamadas };
}

describe('lerTudoPorIds (paginação e blocos de ids)', () => {
  it('lê todas as páginas: não corta em 1000 linhas', async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}`, grupo: 'g1' }));
    const { montar, chamadas } = tabelaFalsa(linhas);
    const resultado = await lerTudoPorIds<{ id: string }>(['g1'], montar, 'erro');
    expect(resultado).toHaveLength(2500);
    expect(chamadas.map((c) => c.de)).toEqual([0, TAMANHO_PAGINA, 2 * TAMANHO_PAGINA]);
  });

  it('com exatamente uma página cheia, ainda confere a próxima (que vem vazia)', async () => {
    const linhas = Array.from({ length: TAMANHO_PAGINA }, (_, i) => ({ id: `r${i}`, grupo: 'g1' }));
    const { montar, chamadas } = tabelaFalsa(linhas);
    const resultado = await lerTudoPorIds(['g1'], montar, 'erro');
    expect(resultado).toHaveLength(TAMANHO_PAGINA);
    expect(chamadas).toHaveLength(2);
  });

  it('divide os ids em blocos para não estourar a URL', async () => {
    const ids = Array.from({ length: TAMANHO_BLOCO_IDS * 2 + 5 }, (_, i) => `g${i}`);
    const linhas = ids.map((g, i) => ({ id: `r${i}`, grupo: g }));
    const { montar, chamadas } = tabelaFalsa(linhas);
    const resultado = await lerTudoPorIds(ids, montar, 'erro');
    expect(resultado).toHaveLength(ids.length);
    expect(chamadas.map((c) => c.bloco.length)).toEqual([TAMANHO_BLOCO_IDS, TAMANHO_BLOCO_IDS, 5]);
  });

  it('lista de ids vazia não consulta nada', async () => {
    const montar = vi.fn();
    expect(await lerTudoPorIds([], montar, 'erro')).toEqual([]);
    expect(montar).not.toHaveBeenCalled();
  });

  it('erro em qualquer página lança a mensagem e nunca devolve resultado parcial', async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}`, grupo: 'g1' }));
    const { montar } = tabelaFalsa(linhas, 2);
    await expect(lerTudoPorIds(['g1'], montar, 'Não foi possível carregar.')).rejects.toThrow(
      'Não foi possível carregar.'
    );
  });
});
