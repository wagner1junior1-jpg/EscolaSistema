import { describe, it, expect, beforeEach } from 'vitest';
import { professorService, authService } from '@/services';
import { resetDatabase, getDatabase, saveDatabase } from '../mock/db';

describe('Controle de Acesso — Observações Pedagógicas do Aluno', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('1. Professor da turma consegue listar e salvar observação de aluno da própria turma', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // aluno-7a-1 pertence à turma-7a, na qual a Profª Ana Paula tem oferta
    const alunoId = 'aluno-7a-1';

    // Lista observações iniciais sem erro
    const listaInicial = await professorService.listarObservacoesAluno(alunoId);
    expect(Array.isArray(listaInicial)).toBe(true);

    // Salva nova observação
    const novaObs = await professorService.salvarObservacaoAluno(
      alunoId,
      'Aluno participativo nas aulas de matemática.'
    );
    expect(novaObs.id).toBeTruthy();
    expect(novaObs.aluno_id).toBe(alunoId);
    expect(novaObs.texto).toBe('Aluno participativo nas aulas de matemática.');

    // Lista novamente e confirma presença da observação
    const listaAtualizada = await professorService.listarObservacoesAluno(alunoId);
    expect(listaAtualizada.some((o) => o.id === novaObs.id)).toBe(true);
  });

  it('2. Professor SEM oferta na turma do aluno recebe erro ao listar e ao salvar', async () => {
    await authService.login('carlos@demo.com', 'demo123');

    const db = await getDatabase();
    const turmasCarlos = new Set(
      db.ofertas.filter((o) => o.professor_id === 'usr-prof-carlos').map((o) => o.turma_id)
    );
    let alunoSemOferta = db.alunos.find((a) => !turmasCarlos.has(a.turma_id) && a.ativo);

    if (!alunoSemOferta) {
      alunoSemOferta = {
        id: 'aluno-teste-sem-oferta',
        created_at: new Date().toISOString(),
        escola_id: 'esc-001',
        turma_id: 'turma-sem-oferta-carlos',
        nome_completo: 'Aluno Teste Sem Oferta',
        numero_chamada: 99,
        pin_hash: 'hash',
        ativo: true,
      };
      db.alunos.push(alunoSemOferta);
      saveDatabase(db);
    }

    // Tentativa de listar observações
    await expect(
      professorService.listarObservacoesAluno(alunoSemOferta.id)
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    // Tentativa de salvar observação
    await expect(
      professorService.salvarObservacaoAluno(alunoSemOferta.id, 'Tentativa não autorizada.')
    ).rejects.toThrow('Você não tem permissão para esta ação.');
  });

  it('3. Direção lê e salva observação de qualquer aluno', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    // Aluno do 7º Ano A
    const aluno7a = 'aluno-7a-1';
    const lista7a = await professorService.listarObservacoesAluno(aluno7a);
    expect(Array.isArray(lista7a)).toBe(true);

    const obs7a = await professorService.salvarObservacaoAluno(
      aluno7a,
      'Observação registrada pela Direção para aluno do 7A.'
    );
    expect(obs7a.id).toBeTruthy();
    expect(obs7a.texto).toBe('Observação registrada pela Direção para aluno do 7A.');

    // Aluno do 6º Ano B
    const aluno6b = 'aluno-6b-1';
    const lista6b = await professorService.listarObservacoesAluno(aluno6b);
    expect(Array.isArray(lista6b)).toBe(true);

    const obs6b = await professorService.salvarObservacaoAluno(
      aluno6b,
      'Observação registrada pela Direção para aluno do 6B.'
    );
    expect(obs6b.id).toBeTruthy();
    expect(obs6b.texto).toBe('Observação registrada pela Direção para aluno do 6B.');
  });

  it('4. Professor não exclui observação de outro professor', async () => {
    // 1. Profª Ana cria uma observação para seu aluno na turma 7A
    await authService.login('ana@demo.com', 'demo123');
    const obsAna = await professorService.salvarObservacaoAluno(
      'aluno-7a-1',
      'Observação feita pela Profª Ana Paula.'
    );

    // 2. Garante que Prof. Carlos leciona na mesma turma para que ele veja a observação
    const db = await getDatabase();
    const jaTemOferta = db.ofertas.some(
      (o) => o.professor_id === 'usr-prof-carlos' && o.turma_id === 'turma-7a'
    );
    if (!jaTemOferta) {
      db.ofertas.push({
        id: 'oferta-carlos-7a',
        created_at: new Date().toISOString(),
        turma_id: 'turma-7a',
        disciplina_id: 'disc-cien',
        professor_id: 'usr-prof-carlos',
      });
      saveDatabase(db);
    }

    // 3. Prof. Carlos se autentica: ele tem acesso à turma para listar (reunião de conselho)
    await authService.login('carlos@demo.com', 'demo123');
    const obsTurma = await professorService.listarObservacoesAluno('aluno-7a-1');
    expect(obsTurma.some((o) => o.id === obsAna.id)).toBe(true);

    // 4. Mas Carlos não pode excluir a observação criada pela Profª Ana
    await expect(
      professorService.excluirObservacaoAluno(obsAna.id)
    ).rejects.toThrow('Você só pode excluir suas próprias observações.');

    // 5. Profª Ana consegue excluir a sua própria observação
    await authService.login('ana@demo.com', 'demo123');
    await expect(professorService.excluirObservacaoAluno(obsAna.id)).resolves.toBeUndefined();
  });
});
