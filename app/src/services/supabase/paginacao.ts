/**
 * SaberPontual — leitura completa do Supabase (paginação e ids em blocos)
 *
 * Dois limites do PostgREST que não dão erro e quebram relatório em silêncio:
 *  1. uma consulta devolve no máximo 1000 linhas (o resto é cortado sem aviso);
 *  2. `.in('coluna', [centenas de ids])` vai na URL, e o gateway recusa URL muito grande.
 * `lerTudoPorIds` resolve os dois: divide os ids em blocos e lê cada bloco de página em página.
 */

/** Linhas por página (igual ao teto padrão do PostgREST). */
export const TAMANHO_PAGINA = 1000;
/** Ids por consulta. 100 uuids ocupam cerca de 4 KB de URL. */
export const TAMANHO_BLOCO_IDS = 100;

/** O que o helper precisa do construtor de consultas do supabase-js. */
interface ConsultaPaginavel {
  order(coluna: string, opcoes?: { ascending: boolean }): ConsultaPaginavel;
  range(de: number, ate: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
}

/**
 * Lê TODAS as linhas de uma consulta filtrada por uma lista de ids.
 * `montar(bloco)` devolve o `from(...).select(...)` com os filtros e o `.in(...)` desse bloco.
 * A tabela precisa ter coluna `id` (usada para a ordem estável entre as páginas).
 * Qualquer erro vira `Error(mensagemErro)`: nunca devolve resultado parcial.
 */
export async function lerTudoPorIds<T>(
  ids: readonly string[],
  montar: (bloco: string[]) => unknown,
  mensagemErro: string
): Promise<T[]> {
  const resultado: T[] = [];
  for (let i = 0; i < ids.length; i += TAMANHO_BLOCO_IDS) {
    const bloco = ids.slice(i, i + TAMANHO_BLOCO_IDS);
    for (let de = 0; ; de += TAMANHO_PAGINA) {
      const consulta = montar(bloco) as ConsultaPaginavel;
      const { data, error } = await consulta.order('id', { ascending: true }).range(de, de + TAMANHO_PAGINA - 1);
      if (error) throw new Error(mensagemErro);
      const linhas = (data ?? []) as T[];
      resultado.push(...linhas);
      if (linhas.length < TAMANHO_PAGINA) break;
    }
  }
  return resultado;
}
