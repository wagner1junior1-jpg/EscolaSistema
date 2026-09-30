import { describe, it, expect } from 'vitest';
import { calcularDimensoes } from '../../lib/imagem';

describe('calcularDimensoes', () => {
  it('deve reduzir imagem horizontal mantendo proporção: (4000, 3000, 1600) -> (1600, 1200)', () => {
    const resultado = calcularDimensoes(4000, 3000, 1600);
    expect(resultado).toEqual({ largura: 1600, altura: 1200 });
  });

  it('deve manter dimensões quando a imagem já cabe no limite: (800, 600, 1600) -> igual', () => {
    const resultado = calcularDimensoes(800, 600, 1600);
    expect(resultado).toEqual({ largura: 800, altura: 600 });
  });

  it('deve reduzir imagem vertical mantendo proporção: (3000, 4000, 1600) -> (1200, 1600)', () => {
    const resultado = calcularDimensoes(3000, 4000, 1600);
    expect(resultado).toEqual({ largura: 1200, altura: 1600 });
  });

  it('deve manter dimensões quando a imagem for exatamente igual ao limite: (1600, 1600, 1600) -> igual', () => {
    const resultado = calcularDimensoes(1600, 1600, 1600);
    expect(resultado).toEqual({ largura: 1600, altura: 1600 });
  });
});
