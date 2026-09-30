import { describe, it, expect, beforeEach } from 'vitest';
import { professorService, authService } from '@/services';
import { resetDatabase } from '../mock/db';

describe('ProfessorService — Observações e Médias por Matéria por Série', () => {
  beforeEach(async () => {
    await resetDatabase();
    // Autentica como Profª Ana Paula (Matemática - 7º Ano A)
    await authService.login('ana@demo.com', 'demo123');
  });

  it('deve listar os alunos da série selecionada (7º Ano) com suas médias por matéria', async () => {
    const alunos = await professorService.listarAlunosPorSerie('7º Ano');

    expect(alunos.length).toBeGreaterThan(0);
    // Todos devem ser do 7º Ano
    alunos.forEach((item) => {
      expect(item.turma_serie).toBe('7º Ano');
      expect(item.aluno.nome_completo).toBeTruthy();
      expect(Array.isArray(item.materias)).toBe(true);
      // Deve conter ao menos a matéria de Matemática
      const mat = item.materias.find((m) => m.disciplina_nome === 'Matemática');
      expect(mat).toBeDefined();
    });
  });

  it('não deve listar alunos de outras séries ao filtrar pelo 7º Ano', async () => {
    const alunos7 = await professorService.listarAlunosPorSerie('7º Ano');
    const aluno6b = alunos7.find((a) => a.turma_nome === '6º Ano B');
    expect(aluno6b).toBeUndefined();
  });

  it('deve permitir que a professora registre e atualize uma observação para um aluno', async () => {
    const alunos = await professorService.listarAlunosPorSerie('7º Ano');
    const primeiroAluno = alunos[0];

    // Registra observação
    const obs = await professorService.salvarObservacaoAluno(
      primeiroAluno.aluno.id,
      'Aluno muito participativo, necessita de reforço em números negativos.'
    );

    expect(obs.id).toBeTruthy();
    expect(obs.aluno_id).toBe(primeiroAluno.aluno.id);
    expect(obs.texto).toBe('Aluno muito participativo, necessita de reforço em números negativos.');
    expect(obs.professor_nome).toBe('Profª Ana Paula');

    // Consulta observações do aluno
    const lista = await professorService.listarObservacoesAluno(primeiroAluno.aluno.id);
    expect(lista.length).toBe(1);
    expect(lista[0].texto).toBe('Aluno muito participativo, necessita de reforço em números negativos.');

    // Atualiza a observação
    const obsAtualizada = await professorService.salvarObservacaoAluno(
      primeiroAluno.aluno.id,
      'Avançou bastante após lista de exercícios de fixação.'
    );

    expect(obsAtualizada.id).toBe(obs.id);
    expect(obsAtualizada.texto).toBe('Avançou bastante após lista de exercícios de fixação.');

    const listaAposAtualizacao = await professorService.listarObservacoesAluno(primeiroAluno.aluno.id);
    expect(listaAposAtualizacao.length).toBe(1);
    expect(listaAposAtualizacao[0].texto).toBe('Avançou bastante após lista de exercícios de fixação.');
  });

  it('deve rejeitar observação vazia', async () => {
    const alunos = await professorService.listarAlunosPorSerie('7º Ano');
    const primeiroAluno = alunos[0];

    await expect(
      professorService.salvarObservacaoAluno(primeiroAluno.aluno.id, '   ')
    ).rejects.toThrow('A observação não pode ser vazia.');
  });

  it('deve excluir observação existente do professor', async () => {
    const alunos = await professorService.listarAlunosPorSerie('7º Ano');
    const primeiroAluno = alunos[0];

    const obs = await professorService.salvarObservacaoAluno(
      primeiroAluno.aluno.id,
      'Observação temporária para exclusão.'
    );

    await professorService.excluirObservacaoAluno(obs.id);

    const lista = await professorService.listarObservacoesAluno(primeiroAluno.aluno.id);
    expect(lista.find((o) => o.id === obs.id)).toBeUndefined();
  });

  it('deve calcular médias por matéria de um aluno específico', async () => {
    // Aluno Lucas Oliveira (aluno-7a-1) tem respostas registradas no seed
    const materias = await professorService.desempenhoAlunoPorMaterias('aluno-7a-1');

    expect(materias.length).toBeGreaterThan(0);
    const matMatematica = materias.find((m) => m.disciplina_nome === 'Matemática');
    expect(matMatematica).toBeDefined();
    // Lucas tem média calculada a partir de todas as atividades avaliadas de Matemática
    expect(matMatematica?.media).toBe(71.4);
    expect(matMatematica?.faixa).toBe('Bom');
  });

  it('fichaAluno deve incluir desempenhos por matéria e observações', async () => {
    const alunoId = 'aluno-7a-1';
    await professorService.salvarObservacaoAluno(alunoId, 'Excelente rendimento no bimestre.');

    // Chama fichaAluno apenas com alunoId
    const ficha = await professorService.fichaAluno(alunoId);

    expect(ficha.aluno.id).toBe(alunoId);
    expect(ficha.desempenho_materias).toBeDefined();
    expect(ficha.desempenho_materias!.length).toBeGreaterThan(0);
    expect(ficha.observacoes).toBeDefined();
    expect(ficha.observacoes!.length).toBe(1);
    expect(ficha.observacoes![0].texto).toBe('Excelente rendimento no bimestre.');
  });
});
