import { describe, it, expect } from 'vitest';
import { formatarPercentual, pluralizar } from '@/lib/formatar';

describe('formatarPercentual', () => {
  it('deve formatar percentual com vírgula e 1 casa decimal por padrão', () => {
    expect(formatarPercentual(71.428)).toBe('71,4%');
  });

  it('deve formatar zero com uma casa decimal', () => {
    expect(formatarPercentual(0)).toBe('0,0%');
  });

  it('deve formatar 100 com uma casa decimal', () => {
    expect(formatarPercentual(100)).toBe('100,0%');
  });

  it('deve respeitar número customizado de casas decimais', () => {
    expect(formatarPercentual(71.428, 2)).toBe('71,43%');
    expect(formatarPercentual(71.428, 0)).toBe('71%');
  });
});

describe('pluralizar', () => {
  it('deve retornar singular quando a quantidade for 1', () => {
    expect(pluralizar(1, 'aluno', 'alunos')).toBe('1 aluno');
  });

  it('deve retornar plural quando a quantidade for 0', () => {
    expect(pluralizar(0, 'aluno', 'alunos')).toBe('0 alunos');
  });

  it('deve retornar plural quando a quantidade for 3', () => {
    expect(pluralizar(3, 'aluno', 'alunos')).toBe('3 alunos');
  });
});
