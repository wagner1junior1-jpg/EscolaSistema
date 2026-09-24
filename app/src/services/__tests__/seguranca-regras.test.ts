import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockRelatorioService } from '../mock/relatorio.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase, saveDatabase } from '../mock/db';
import { gerarId } from '../mock/ids';
import { Frequencia } from '@/lib/types';

describe('Bateria de Segurança, Autorização e Regras de Negócio (Auditoria)', () => {
  const authService = new MockAuthService();
  const gestaoService = new MockGestaoService();
  const professorService = new MockProfessorService();
  const relatorioService = new MockRelatorioService();
  const alunoService = new MockAlunoService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
  });

  // 1. Sem login, chamar qualquer método de Gestao/Professor/Relatorio lança erro
  it('sem login, chamar métodos de Gestao/Professor/Relatorio lança "Você precisa entrar no sistema."', async () => {
    await expect(gestaoService.obterEscola()).rejects.toThrow(
      'Você precisa entrar no sistema.'
    );
    await expect(professorService.minhasOfertas()).rejects.toThrow(
      'Você precisa entrar no sistema.'
    );
    await expect(relatorioService.visaoGeralEscola()).rejects.toThrow(
      'Você precisa entrar no sistema.'
    );
  });

  // 2. Professor Carlos não consegue ler/editar atividade nem salvar frequência de oferta da Ana
  it('professor Carlos não consegue ler/editar atividade nem salvar frequência de oferta da Ana', async () => {
    // Login do Prof. Carlos (usr-prof-carlos)
    await authService.login('carlos@demo.com', 'demo123');

    // Oferta da Profª Ana: oferta-mat-7a
    // Atividade da Profª Ana: ativ-mat-01

    // Tentativa de listar atividades da oferta da Ana
    await expect(
      professorService.listarAtividades('oferta-mat-7a')
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    // Tentativa de obter atividade da Ana
    await expect(
      professorService.obterAtividade('ativ-mat-01')
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    // Tentativa de atualizar atividade da Ana
    await expect(
      professorService.atualizarAtividade('ativ-mat-01', { titulo: 'Tentativa Hacking' })
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    // Tentativa de salvar frequência na turma da Ana
    await expect(
      professorService.salvarFrequencia('oferta-mat-7a', '2026-09-20', [
        { aluno_id: 'aluno-7a-1', status: 'P' },
      ])
    ).rejects.toThrow('Você não tem permissão para esta ação.');
  });

  // 3. Professor não consegue chamar gerarOuResetarPin nem criarTurma
  it('professor não consegue chamar gerarOuResetarPin nem criarTurma', async () => {
    await authService.login('ana@demo.com', 'demo123');

    await expect(
      gestaoService.gerarOuResetarPin('aluno-7a-1')
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    await expect(
      gestaoService.criarTurma({
        escola_id: 'esc-001',
        nome: 'Turma Ilegal',
        serie: '8º Ano',
        segmento: 'fund2',
        ano_letivo: 2026,
        codigo_acesso: 'ILEGAL8',
        ativa: true,
      })
    ).rejects.toThrow('Você não tem permissão para esta ação.');
  });

  // 4. Coordenação não consegue atualizarEscola (exclusivo da direção)
  it('coordenação não consegue atualizarEscola', async () => {
    await authService.login('coordenacao@demo.com', 'demo123');

    await expect(
      gestaoService.atualizarEscola({ nome: 'Nome Alterado pela Coordenação' })
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    // Já a direção consegue
    await authService.login('direcao@demo.com', 'demo123');
    const atualizada = await gestaoService.atualizarEscola({ nome: 'Escola Atualizada pela Direção' });
    expect(atualizada.nome).toBe('Escola Atualizada pela Direção');
  });

  // 5. Aluno do 6º B não consegue carregarAtividade nem responder questão do 7º A
  it('aluno do 6º B não consegue carregarAtividade nem responder questão do 7º A', async () => {
    // Aluno do 6º B: Arthur Guimarães (aluno-6b-1, PIN 1098)
    const { token } = await alunoService.login('aluno-6b-1', '1098');

    // Tentativa de carregar atividade do 7º A (ativ-mat-01)
    await expect(
      alunoService.carregarAtividade(token, 'ativ-mat-01')
    ).rejects.toThrow('Esta atividade não pertence à sua turma.');

    // Tentativa de responder questão do 7º A (q-mat-1)
    await expect(
      alunoService.responder(token, 'q-mat-1', 'alt-m1-a')
    ).rejects.toThrow('Esta questão não pertence a uma atividade da sua turma.');
  });

  // 6. Responder em atividade encerrada é recusado
  it('responder em atividade encerrada é recusado', async () => {
    // Profª Ana encerra a atividade ativ-mat-01
    await authService.login('ana@demo.com', 'demo123');
    await professorService.encerrarAtividade('ativ-mat-01');

    // Aluna do 7º A: Isabella Martins (aluno-7a-8, PIN 4173) tenta responder
    const { token } = await alunoService.login('aluno-7a-8', '4173');

    await expect(
      alunoService.responder(token, 'q-mat-1', 'alt-m1-a')
    ).rejects.toThrow('Esta atividade já foi encerrada e não aceita mais respostas.');
  });

  // 7. boletim, listarAlunos e cadastrarAluno não contêm a chave pin_hash
  it('boletim, listarAlunos e cadastrarAluno não contêm a chave pin_hash', async () => {
    // 7.1. listarAlunos
    await authService.login('direcao@demo.com', 'demo123');
    const alunos = await gestaoService.listarAlunos('turma-7a');
    expect(alunos.length).toBeGreaterThan(0);
    for (const a of alunos) {
      expect((a as Record<string, unknown>).pin_hash).toBeUndefined();
    }

    // 7.2. cadastrarAluno
    const { aluno } = await gestaoService.cadastrarAluno({
      escola_id: 'esc-001',
      turma_id: 'turma-7a',
      nome_completo: 'Novo Aluno Teste',
      numero_chamada: 99,
      ativo: true,
    });
    expect((aluno as Record<string, unknown>).pin_hash).toBeUndefined();

    // 7.3. boletim
    const { token } = await alunoService.login('aluno-7a-1', '1420');
    const boletim = await alunoService.boletim(token);
    expect((boletim.aluno as Record<string, unknown>).pin_hash).toBeUndefined();
  });

  // 8. Trocar a correta de questão já respondida lança erro
  it('trocar a correta de questão já respondida lança erro', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // q-mat-1 já possui respostas cadastradas no seed (Lucas, Beatriz...)
    // Alternativa A era a correta. Tentando mudar para B como correta:
    await expect(
      professorService.salvarQuestoes('ativ-mat-01', [
        {
          id: 'q-mat-1',
          ordem: 1,
          enunciado: 'Enunciado atualizado',
          dica: 'Dica',
          explicacao: 'Explicação',
          alternativas: [
            { id: 'alt-m1-a', texto: 'Texto A', correta: false, por_que_errou: 'Erro' },
            { id: 'alt-m1-b', texto: 'Texto B', correta: true, por_que_errou: null }, // trocou a correta!
            { id: 'alt-m1-c', texto: 'Texto C', correta: false, por_que_errou: 'Erro' },
            { id: 'alt-m1-d', texto: 'Texto D', correta: false, por_que_errou: 'Erro' },
          ],
        },
      ])
    ).rejects.toThrow(
      'Esta questão já foi respondida por alunos: só é possível editar os textos.'
    );
  });

  // 9. Publicar atividade sem questões lança erro
  it('publicar atividade sem questões lança erro', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // Cria nova atividade em rascunho
    const novaAtiv = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Atividade Vazia',
      descricao: 'Sem questões',
      prazo: '2026-10-30',
      periodo_id: 'per-bim-3',
    });

    await expect(
      professorService.publicarAtividade(novaAtiv.id)
    ).rejects.toThrow('A atividade precisa ter pelo menos 1 questão para ser publicada.');
  });

  // 10. Frequência fora das datas do período não entra no boletim
  it('frequência fora das datas do período não entra no boletim', async () => {
    // 3º Bimestre no seed: 2026-07-27 a 2026-10-02
    const db = await getDatabase();

    // Adiciona uma frequência do aluno-7a-1 em maio (2º bimestre: 2026-05-10) como Falta (F)
    const freqAntiga: Frequencia = {
      id: 'freq-antiga-fora-periodo',
      created_at: new Date().toISOString(),
      oferta_id: 'oferta-mat-7a',
      aluno_id: 'aluno-7a-1',
      data: '2026-05-10', // Fora do 3º Bimestre
      status: 'F',
      registrado_por: 'usr-prof-ana',
    };
    db.frequencias.push(freqAntiga);
    saveDatabase(db);

    const { token } = await alunoService.login('aluno-7a-1', '1420');
    const boletim = await alunoService.boletim(token);
    const discMat = boletim.disciplinas.find((d) => d.oferta_id === 'oferta-mat-7a');

    // As frequências do seed no 3º Bimestre para o Lucas são todas presentes (3 registros P)
    // A falta de maio (2026-05-10) NÃO deve ser contabilizada no 3º Bimestre!
    expect(discMat?.total_faltas).toBe(0);
    expect(discMat?.frequencia_porcentagem).toBe(100);
  });

  // 11. gerarId gera 10.000 IDs sem repetição
  it('gerarId gera 10.000 IDs sem repetição', () => {
    const ids = new Set<string>();
    const total = 10000;

    for (let i = 0; i < total; i++) {
      const id = gerarId('test');
      ids.add(id);
    }

    expect(ids.size).toBe(total);
  });
});
