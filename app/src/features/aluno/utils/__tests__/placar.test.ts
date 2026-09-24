import { describe, it, expect } from 'vitest';
import { calcularPlacar, QuestaoPlacarItem } from '../placar';

describe('calcularPlacar (features/aluno/utils/placar.ts)', () => {
  it('retorna zeros para lista vazia', () => {
    const resultado = calcularPlacar([]);
    expect(resultado).toEqual({
      total_questoes: 0,
      acertos: 0,
      erros: 0,
      aproveitamento: 0,
    });
  });

  it('calcula corretamente quando todas estão certas na 1ª tentativa', () => {
    const questoes: QuestaoPlacarItem[] = [
      { id: 'q1', acertou: true, tentativas: 1, acertou_final: true },
      { id: 'q2', acertou: true, tentativas: 1, acertou_final: true },
      { id: 'q3', acertou: true, tentativas: 1, acertou_final: true },
      { id: 'q4', acertou: true, tentativas: 1, acertou_final: true },
    ];

    const resultado = calcularPlacar(questoes);
    expect(resultado).toEqual({
      total_questoes: 4,
      acertos: 4,
      erros: 0,
      aproveitamento: 100,
    });
  });

  it('calcula corretamente quando todas estão erradas', () => {
    const questoes: QuestaoPlacarItem[] = [
      { id: 'q1', acertou: false, tentativas: 1, acertou_final: false },
      { id: 'q2', acertou: false, tentativas: 1, acertou_final: false },
    ];

    const resultado = calcularPlacar(questoes);
    expect(resultado).toEqual({
      total_questoes: 2,
      acertos: 0,
      erros: 2,
      aproveitamento: 0,
    });
  });

  it('arredonda o aproveitamento com precisão decimal', () => {
    const questoes: QuestaoPlacarItem[] = [
      { id: 'q1', acertou: true },
      { id: 'q2', acertou: false },
      { id: 'q3', acertou: false },
    ];

    const resultado = calcularPlacar(questoes);
    expect(resultado).toEqual({
      total_questoes: 3,
      acertos: 1,
      erros: 2,
      aproveitamento: 33.3,
    });
  });

  it('CRÍTICO: errou na 1ª e acertou na 2ª tentativa conta como erro no placar', () => {
    const questoes: QuestaoPlacarItem[] = [
      // Questão 1: aluno errou na 1ª (acertou: false), mas acertou na 2ª (acertou_final: true, tentativas: 2)
      { id: 'q1', acertou: false, tentativas: 2, acertou_final: true },
      // Questão 2: aluno acertou de primeira
      { id: 'q2', acertou: true, tentativas: 1, acertou_final: true },
      // Questão 3: aluno acertou de primeira
      { id: 'q3', acertou: true, tentativas: 1, acertou_final: true },
    ];

    const resultado = calcularPlacar(questoes);
    // A questão 1 deve ser contabilizada como ERRO para o placar oficial
    expect(resultado.total_questoes).toBe(3);
    expect(resultado.acertos).toBe(2);
    expect(resultado.erros).toBe(1);
    expect(resultado.aproveitamento).toBe(66.7);
  });
});
