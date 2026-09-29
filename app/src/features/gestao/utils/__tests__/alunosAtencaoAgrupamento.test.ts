import { describe, it, expect } from 'vitest';
import {
  agruparAlunosEmAtencao,
  formatarPautaMateriaTexto,
  formatarPautaTurmaTexto,
} from '../alunosAtencaoAgrupamento';
import { AlunoEmAtencaoItem } from '@/lib/types';

describe('alunosAtencaoAgrupamento', () => {
  const dadosExemplo: AlunoEmAtencaoItem[] = [
    {
      aluno_id: 'aluno-1',
      turma_id: 'turma-6a',
      turma_nome: '6º Ano A',
      disciplina_id: 'disc-mat',
      disciplina_nome: 'Matemática',
      professor_nome: 'Prof. Roberto',
      numero_chamada: 5,
      nome_completo: 'Lucas Santos',
      media: 45.0,
      faixa: 'Atenção',
      total_acertos: 9,
      total_questoes: 20,
      turma_total_alunos: 25,
    },
    {
      aluno_id: 'aluno-1',
      turma_id: 'turma-6a',
      turma_nome: '6º Ano A',
      disciplina_id: 'disc-port',
      disciplina_nome: 'Língua Portuguesa',
      professor_nome: 'Profª. Maria',
      numero_chamada: 5,
      nome_completo: 'Lucas Santos',
      media: 50.0,
      faixa: 'Atenção',
      total_acertos: 10,
      total_questoes: 20,
      turma_total_alunos: 25,
    },
    {
      aluno_id: 'aluno-2',
      turma_id: 'turma-6a',
      turma_nome: '6º Ano A',
      disciplina_id: 'disc-mat',
      disciplina_nome: 'Matemática',
      professor_nome: 'Prof. Roberto',
      numero_chamada: 12,
      nome_completo: 'Pedro Souza',
      media: 35.0,
      faixa: 'Atenção',
      total_acertos: 7,
      total_questoes: 20,
      turma_total_alunos: 25,
    },
    {
      aluno_id: 'aluno-3',
      turma_id: 'turma-7b',
      turma_nome: '7º Ano B',
      disciplina_id: 'disc-hist',
      disciplina_nome: 'História',
      professor_nome: 'Prof. João',
      numero_chamada: 3,
      nome_completo: 'Camila Rocha',
      media: 40.0,
      faixa: 'Atenção',
      total_acertos: 8,
      total_questoes: 20,
      turma_total_alunos: 20,
    },
  ];

  it('deve agrupar corretamente por Turma e por Matéria', () => {
    const resultado = agruparAlunosEmAtencao(dadosExemplo);

    expect(resultado.total_alunos_unicos).toBe(3); // Lucas, Pedro, Camila
    expect(resultado.total_turmas_afetadas).toBe(2); // 6º Ano A, 7º Ano B
    expect(resultado.turmas.length).toBe(2);

    const turma6A = resultado.turmas.find((t) => t.turma_nome === '6º Ano A');
    expect(turma6A).toBeDefined();
    expect(turma6A?.total_alunos_unicos).toBe(2); // Lucas e Pedro
    expect(turma6A?.porcentagem_alunos_atencao).toBe(8); // 2 de 25 = 8%
    expect(turma6A?.materias.length).toBe(2); // Matemática e Língua Portuguesa
  });

  it('deve identificar quando o aluno tem atenção em mais de uma matéria na mesma turma', () => {
    const resultado = agruparAlunosEmAtencao(dadosExemplo);
    const turma6A = resultado.turmas.find((t) => t.turma_nome === '6º Ano A')!;

    expect(turma6A.total_alunos_multipla_atencao).toBe(1); // Lucas Santos

    const mat = turma6A.materias.find((m) => m.disciplina_nome === 'Matemática')!;
    const lucasEmMat = mat.alunos.find((a) => a.aluno_id === 'aluno-1')!;
    expect(lucasEmMat.tem_multiplas_materias).toBe(true);
    expect(lucasEmMat.total_materias_em_atencao).toBe(2);
    expect(lucasEmMat.outras_materias.length).toBe(1);
    expect(lucasEmMat.outras_materias[0].disciplina_nome).toBe('Língua Portuguesa');

    const pedroEmMat = mat.alunos.find((a) => a.aluno_id === 'aluno-2')!;
    expect(pedroEmMat.tem_multiplas_materias).toBe(false);
    expect(pedroEmMat.outras_materias.length).toBe(0);
  });

  it('deve manter a quantidade exata de acertos e questões', () => {
    const resultado = agruparAlunosEmAtencao(dadosExemplo);
    const turma6A = resultado.turmas.find((t) => t.turma_nome === '6º Ano A')!;
    const mat = turma6A.materias.find((m) => m.disciplina_nome === 'Matemática')!;
    const pedro = mat.alunos.find((a) => a.aluno_id === 'aluno-2')!;

    expect(pedro.total_acertos_nesta_disciplina).toBe(7);
    expect(pedro.total_questoes_nesta_disciplina).toBe(20);
  });

  it('deve formatar a pauta da matéria incluindo a quantidade de acertos', () => {
    const resultado = agruparAlunosEmAtencao(dadosExemplo);
    const turma6A = resultado.turmas.find((t) => t.turma_nome === '6º Ano A')!;
    const mat = turma6A.materias.find((m) => m.disciplina_nome === 'Matemática')!;

    const pauta = formatarPautaMateriaTexto('6º Ano A', mat, '1º Bimestre');
    expect(pauta).toContain('PAUTA PEDAGÓGICA');
    expect(pauta).toContain('Matemática');
    expect(pauta).toContain('Pedro Souza');
    expect(pauta).toContain('7/20 acertos (35,0%)');
    expect(pauta).toContain('Lucas Santos');
    expect(pauta).toContain('9/20 acertos (45,0%)');
    expect(pauta).toContain('Atenção em 2 matérias: também em Língua Portuguesa');
  });

  it('deve formatar a pauta geral da turma incluindo acertos', () => {
    const resultado = agruparAlunosEmAtencao(dadosExemplo);
    const turma6A = resultado.turmas.find((t) => t.turma_nome === '6º Ano A')!;

    const pautaTurma = formatarPautaTurmaTexto(turma6A, '1º Bimestre');
    expect(pautaTurma).toContain('PAUTA PEDAGÓGICA DA TURMA');
    expect(pautaTurma).toContain('6º Ano A (2 de 25 alunos • 8% da sala)');
    expect(pautaTurma).toContain('MATEMÁTICA');
    expect(pautaTurma).toContain('LÍNGUA PORTUGUESA');
    expect(pautaTurma).toContain('7/20 acertos');
  });

  it('deve lidar com lista vazia sem erros', () => {
    const resultado = agruparAlunosEmAtencao([]);
    expect(resultado.total_alunos_unicos).toBe(0);
    expect(resultado.total_turmas_afetadas).toBe(0);
    expect(resultado.turmas.length).toBe(0);
  });
});
