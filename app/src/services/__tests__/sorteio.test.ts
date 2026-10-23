import { describe, it, expect } from 'vitest';
import { embaralhar } from '../sorteio';

describe('embaralhar (sorteio das questões do banco)', () => {
  it('não altera a lista original e mantém os mesmos elementos', () => {
    const original = [1, 2, 3, 4, 5];
    const resultado = embaralhar(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect([...resultado].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('com sequências diferentes do gerador, devolve ordens diferentes', () => {
    const lista = ['a', 'b', 'c', 'd'];
    const ordemA = embaralhar(lista, () => 0);
    const ordemB = embaralhar(lista, () => 0.999);
    expect(ordemB).toEqual(lista); // j = i em todas as trocas: nada muda
    expect(ordemA).not.toEqual(ordemB);
  });

  it('lista vazia ou de um item não quebra', () => {
    expect(embaralhar([])).toEqual([]);
    expect(embaralhar(['x'])).toEqual(['x']);
  });

  it('todas as ordens possíveis aparecem (não é sempre a mesma)', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 400; i++) vistas.add(embaralhar([1, 2, 3]).join(''));
    expect(vistas.size).toBe(6);
  });
});
