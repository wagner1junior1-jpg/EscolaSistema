import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockRelatorioService } from '../mock/relatorio.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase, saveDatabase, recarregarDoLocalStorage } from '../mock/db';
import { gerarId } from '../mock/ids';
import { Frequencia } from '@/lib/types';
import { hojeLocal } from '@/lib/datas';


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

  // 8. Trocar a correta de atividade publicada lança erro
  it('trocar a correta de atividade publicada lança erro', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // ativ-mat-01 é uma atividade publicada. Tentando alterar qual é a correta:
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
    ).rejects.toThrow('Atividade publicada: só é possível corrigir textos.');
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

  // 12. Publicar atividade, recarregar banco do localStorage (F5) e confirmar que o status é 'publicada'
  it('publica atividade, recarrega banco do localStorage (F5) e confirma persistência do status "publicada"', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // Cria nova atividade em rascunho
    const novaAtiv = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Atividade de Fixação',
      descricao: 'Exercícios sobre equações',
      prazo: '2026-11-15',
      periodo_id: 'per-bim-3',
    });

    // Salva questão válida na atividade
    await professorService.salvarQuestoes(novaAtiv.id, [
      {
        ordem: 1,
        enunciado: 'Quanto é 2 + 2?',
        dica: 'Soma simples',
        explicacao: '2 + 2 = 4',
        alternativas: [
          { texto: '3', correta: false, por_que_errou: 'Menos um' },
          { texto: '4', correta: true, por_que_errou: null },
          { texto: '5', correta: false, por_que_errou: 'Mais um' },
          { texto: '6', correta: false, por_que_errou: 'Mais dois' },
        ],
      },
    ]);

    // Publica a atividade
    await professorService.publicarAtividade(novaAtiv.id);

    // Simula o recarregamento do navegador (F5), limpando a instância da memória
    recarregarDoLocalStorage();

    // Verifica se ao recarregar do localStorage o status continua 'publicada'
    const atividadeRecarregada = await professorService.obterAtividade(novaAtiv.id);
    expect(atividadeRecarregada).not.toBeNull();
    expect(atividadeRecarregada?.status).toBe('publicada');
  });

  // 13. Carlos tentando passar ID de questão ou alternativa da Ana lança erro
  it('salvarQuestoes: Carlos passando ID de questão ou alternativa da Ana lança erro', async () => {
    await authService.login('carlos@demo.com', 'demo123');

    // Carlos tenta alterar sua atividade 'ativ-cien-01', mas injetando o ID de questão da Ana 'q-mat-1'
    await expect(
      professorService.salvarQuestoes('ativ-cien-01', [
        {
          id: 'q-mat-1', // Pertence a ativ-mat-01 da Ana, não a ativ-cien-01 do Carlos
          ordem: 1,
          enunciado: 'Enunciado qualquer',
          alternativas: [
            { texto: 'Opção 1', correta: true },
            { texto: 'Opção 2', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('Questão ou alternativa inválida para esta atividade.');

    // Agora tentando passar ID de alternativa da Ana 'alt-m1-a'
    await expect(
      professorService.salvarQuestoes('ativ-cien-01', [
        {
          id: 'q-cien-1',
          ordem: 1,
          enunciado: 'Questão de Ciências',
          alternativas: [
            { id: 'alt-m1-a', texto: 'Alternativa da Ana', correta: true }, // Pertence a q-mat-1 da Ana
            { texto: 'Opção B', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('Questão ou alternativa inválida para esta atividade.');
  });

  // 14. Alterações estruturais em atividade publicada são barradas, mas correções de texto são aceitas
  it('alterações estruturais em atividade publicada são bloqueadas, mas textos podem ser corrigidos', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // ativ-mat-01 é uma atividade publicada com 4 questões no seed
    const ativOriginal = await professorService.obterAtividade('ativ-mat-01');
    expect(ativOriginal?.status).toBe('publicada');
    expect(ativOriginal?.questoes.length).toBe(4);

    // 14.1. Tentar excluir uma questão de atividade publicada lança erro
    await expect(
      professorService.excluirQuestao('q-mat-1')
    ).rejects.toThrow('Atividade publicada: só é possível corrigir textos.');

    // 14.2. Tentar adicionar nova questão a atividade publicada lança erro
    const payloadComMaisUma = [
      ...ativOriginal!.questoes.map((q) => ({
        id: q.id,
        ordem: q.ordem,
        enunciado: q.enunciado,
        alternativas: q.alternativas.map((a) => ({
          id: a.id,
          texto: a.texto,
          correta: a.correta,
        })),
      })),
      {
        ordem: 5,
        enunciado: 'Questão Nova não permitida',
        alternativas: [
          { texto: 'Alt 1', correta: true },
          { texto: 'Alt 2', correta: false },
        ],
      },
    ];

    await expect(
      professorService.salvarQuestoes('ativ-mat-01', payloadComMaisUma)
    ).rejects.toThrow('Atividade publicada: só é possível corrigir textos.');

    // 14.3. Correção de texto mantendo toda a estrutura de questões e alternativas é permitida com sucesso
    const payloadApenasTexto = ativOriginal!.questoes.map((q, qIdx) => ({
      id: q.id,
      ordem: q.ordem,
      enunciado: qIdx === 0 ? 'Enunciado corrigido com texto melhorado' : q.enunciado,
      dica: q.dica,
      explicacao: q.explicacao,
      alternativas: q.alternativas.map((a, aIdx) => ({
        id: a.id,
        texto: qIdx === 0 && aIdx === 0 ? 'Alternativa A texto corrigido' : a.texto,
        correta: a.correta,
        por_que_errou: a.por_que_errou,
      })),
    }));

    await professorService.salvarQuestoes('ativ-mat-01', payloadApenasTexto);

    const ativAtualizada = await professorService.obterAtividade('ativ-mat-01');
    expect(ativAtualizada?.questoes[0].enunciado).toBe('Enunciado corrigido com texto melhorado');
    expect(ativAtualizada?.questoes[0].alternativas[0].texto).toBe('Alternativa A texto corrigido');
  });

  // 15. Validação de textos vazios no enunciado e nas alternativas
  it('validação de textos: enunciado ou alternativas em branco lançam erro', async () => {
    await authService.login('ana@demo.com', 'demo123');

    const novaAtiv = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Atividade Rascunho',
      descricao: 'Teste de validação',
      prazo: '2026-11-15',
      periodo_id: 'per-bim-3',
    });

    // Enunciado vazio
    await expect(
      professorService.salvarQuestoes(novaAtiv.id, [
        {
          ordem: 1,
          enunciado: '    ', // Vazio após trim
          alternativas: [
            { texto: 'A', correta: true },
            { texto: 'B', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('O enunciado da questão 1 não pode ficar vazio.');

    // Alternativa com texto vazio
    await expect(
      professorService.salvarQuestoes(novaAtiv.id, [
        {
          ordem: 1,
          enunciado: 'Enunciado válido',
          alternativas: [
            { texto: 'A', correta: true },
            { texto: '   ', correta: false }, // Vazia após trim
          ],
        },
      ])
    ).rejects.toThrow('O texto da alternativa B da questão 1 não pode ficar vazio.');
  });

  // 16. hojeLocal e validação de data futura na frequência
  it('hojeLocal retorna YYYY-MM-DD e frequência rejeita datas futuras', async () => {
    const hojeStr = hojeLocal();
    expect(hojeStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await authService.login('ana@demo.com', 'demo123');

    // Frequência para hoje é aceita
    await expect(
      professorService.salvarFrequencia('oferta-mat-7a', hojeStr, [
        { aluno_id: 'aluno-7a-1', status: 'P' },
      ])
    ).resolves.toBeUndefined();

    // Data futura (amanhã)
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataAmanhaStr = hojeLocal(amanha);

    await expect(
      professorService.salvarFrequencia('oferta-mat-7a', dataAmanhaStr, [
        { aluno_id: 'aluno-7a-1', status: 'P' },
      ])
    ).rejects.toThrow('Não é possível registrar frequência em data futura.');
  });

  // 17. Login do aluno: erros de PIN só contam após o último sucesso
  it('login do aluno: erros de PIN contam apenas após o último login bem-sucedido', async () => {
    // Aluno Lucas Souza (aluno-7a-1, PIN '1420')
    // 1. Aluno erra o PIN 4 vezes
    for (let i = 0; i < 4; i++) {
      await expect(
        alunoService.login('aluno-7a-1', '0000')
      ).rejects.toThrow('PIN incorreto.');
    }

    // 2. Aluno digita o PIN correto -> login com sucesso!
    const { token } = await alunoService.login('aluno-7a-1', '1420');
    expect(token).toBeDefined();

    // 3. Aluno tenta login novamente e erra o PIN 1 vez:
    // Não deve ser bloqueado, pois o contador de erros recentes foi resetado após o sucesso!
    await expect(
      alunoService.login('aluno-7a-1', '9999')
    ).rejects.toThrow('PIN incorreto. Você tem mais 4 tentativa(s).');

    // 4. Se agora errar mais 4 vezes seguidas (total 5 erros após o sucesso), é bloqueado
    for (let i = 0; i < 3; i++) {
      await expect(
        alunoService.login('aluno-7a-1', '9999')
      ).rejects.toThrow('PIN incorreto.');
    }

    // 5º erro consecutivo após o sucesso
    await expect(
      alunoService.login('aluno-7a-1', '9999')
    ).rejects.toThrow('Acesso bloqueado por 15 minutos');
  });
});
