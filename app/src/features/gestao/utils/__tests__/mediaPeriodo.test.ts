import { describe, it, expect } from 'vitest';
import { calcularMediaGeralPeriodo } from '../mediaPeriodo';

const materia = (total_respostas: number, porcentagem_acerto: number) =>
  ({ total_respostas, porcentagem_acerto }) as never;

describe('calcularMediaGeralPeriodo', () => {
  it('devolve a média em 0–100 (não em fração) ponderada pelas respostas', () => {
    // (80 * 10 + 60 * 30) / 40 = 65
    const media = calcularMediaGeralPeriodo([
      { materias: [materia(10, 80)] },
      { materias: [materia(30, 60)] },
    ]);
    expect(media).toBe(65);
  });

  it('arredonda para uma casa decimal', () => {
    // (100 * 1 + 50 * 2) / 3 = 66,666...
    expect(calcularMediaGeralPeriodo([{ materias: [materia(1, 100), materia(2, 50)] }])).toBe(66.7);
  });

  it('ignora matérias sem respostas', () => {
    expect(calcularMediaGeralPeriodo([{ materias: [materia(0, 0), materia(4, 75)] }])).toBe(75);
  });

  it('retorna null sem nenhuma resposta no período', () => {
    expect(calcularMediaGeralPeriodo([])).toBeNull();
    expect(calcularMediaGeralPeriodo([{ materias: [materia(0, 0)] }])).toBeNull();
  });
});
