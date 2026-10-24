import { describe, it, expect, vi } from 'vitest';
import { CacheCurto } from '../supabase/cacheCurto';

describe('CacheCurto', () => {
  it('chamadas simultâneas para a mesma chave fazem uma única consulta', async () => {
    const cache = new CacheCurto<number>(1000);
    const carregar = vi.fn(async () => 42);
    const [a, b, c] = await Promise.all([
      cache.obter('x', carregar),
      cache.obter('x', carregar),
      cache.obter('x', carregar),
    ]);
    expect([a, b, c]).toEqual([42, 42, 42]);
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it('chaves diferentes não se misturam', async () => {
    const cache = new CacheCurto<string>(1000);
    expect(await cache.obter('a', async () => 'A')).toBe('A');
    expect(await cache.obter('b', async () => 'B')).toBe('B');
    expect(await cache.obter('a', async () => 'outro')).toBe('A');
  });

  it('depois do prazo lê de novo', async () => {
    let agora = 1000;
    const cache = new CacheCurto<number>(500, () => agora);
    const carregar = vi.fn(async () => agora);
    expect(await cache.obter('k', carregar)).toBe(1000);
    agora = 1499;
    expect(await cache.obter('k', carregar)).toBe(1000); // ainda vale
    agora = 1501;
    expect(await cache.obter('k', carregar)).toBe(1501); // venceu
    expect(carregar).toHaveBeenCalledTimes(2);
  });

  it('erro NÃO fica guardado: a próxima chamada tenta de novo', async () => {
    const cache = new CacheCurto<number>(1000);
    const carregar = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValueOnce(7);
    await expect(cache.obter('k', carregar)).rejects.toThrow('falhou');
    expect(await cache.obter('k', carregar)).toBe(7);
    expect(carregar).toHaveBeenCalledTimes(2);
  });

  it('chamadas simultâneas que falham recebem o mesmo erro', async () => {
    const cache = new CacheCurto<number>(1000);
    const carregar = vi.fn(async () => {
      throw new Error('sem acesso');
    });
    const r = await Promise.allSettled([cache.obter('k', carregar), cache.obter('k', carregar)]);
    expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected']);
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it('limpar esquece tudo', async () => {
    const cache = new CacheCurto<number>(1000);
    const carregar = vi.fn(async () => 1);
    await cache.obter('k', carregar);
    cache.limpar();
    await cache.obter('k', carregar);
    expect(carregar).toHaveBeenCalledTimes(2);
  });
});
