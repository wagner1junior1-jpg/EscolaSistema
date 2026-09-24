import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockRelatorioService } from '../mock/relatorio.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase, recarregarDoLocalStorage, saveDatabase } from '../mock/db';
import { gerarId } from '../mock/ids';
import { hojeLocal } from '@/lib/datas';

describe('Bateria de Segurança, Autorização e Regras de Negócio', () => {
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

  // 2. Professor Carlos não consegue acessar atividades, relatórios nem ficha de alunos de oferta da Ana
  it('professor Carlos não consegue ler/editar atividade nem acessar desempenho de oferta da Ana', async () => {
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

    // Tentativa de acessar desempenho da oferta da Ana
    await expect(
      professorService.desempenhoOferta('oferta-mat-7a', 'per-bim-3')
    ).rejects.toThrow('Você não tem permissão para esta ação.');

    // Tentativa de acessar ficha de aluno na oferta da Ana
    await expect(
      professorService.fichaAluno('oferta-mat-7a', 'aluno-7a-1')
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

  // 7. meuDesempenho, listarAlunos e cadastrarAluno não contêm a chave pin_hash
  it('meuDesempenho, listarAlunos e cadastrarAluno não contêm a chave pin_hash', async () => {
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

    // 7.3. meuDesempenho
    const { token } = await alunoService.login('aluno-7a-1', '1420');
    const desempenho = await alunoService.meuDesempenho(token);
    expect((desempenho.aluno as Record<string, unknown>).pin_hash).toBeUndefined();
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
      modo: 'exercicio',
    });

    await expect(
      professorService.publicarAtividade(novaAtiv.id)
    ).rejects.toThrow('A atividade precisa ter pelo menos 1 questão para ser publicada.');
  });

  // 10. Bloqueio de alteração de modo em atividade publicada
  it('não deve permitir alterar o modo de uma atividade já publicada ou encerrada', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // ativ-mat-01 está publicada (modo exercicio)
    await expect(
      professorService.atualizarAtividade('ativ-mat-01', {
        modo: 'prova',
      })
    ).rejects.toThrow('O modo da atividade só pode ser alterado enquanto estiver em rascunho.');
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

    const novaAtiv = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Atividade de Fixação',
      descricao: 'Exercícios sobre equações',
      prazo: '2026-11-15',
      periodo_id: 'per-bim-3',
      modo: 'exercicio',
    });

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

    await professorService.publicarAtividade(novaAtiv.id);

    // Simula F5
    recarregarDoLocalStorage();

    const atividadeRecarregada = await professorService.obterAtividade(novaAtiv.id);
    expect(atividadeRecarregada).not.toBeNull();
    expect(atividadeRecarregada?.status).toBe('publicada');
  });

  // 13. Carlos tentando passar ID de questão ou alternativa da Ana lança erro
  it('salvarQuestoes: Carlos passando ID de questão ou alternativa da Ana lança erro', async () => {
    await authService.login('carlos@demo.com', 'demo123');

    await expect(
      professorService.salvarQuestoes('ativ-cien-01', [
        {
          id: 'q-mat-1',
          ordem: 1,
          enunciado: 'Enunciado qualquer',
          alternativas: [
            { texto: 'Opção 1', correta: true },
            { texto: 'Opção 2', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('Questão ou alternativa inválida para esta atividade.');

    await expect(
      professorService.salvarQuestoes('ativ-cien-01', [
        {
          id: 'q-cien-1',
          ordem: 1,
          enunciado: 'Questão de Ciências',
          alternativas: [
            { id: 'alt-m1-a', texto: 'Alternativa da Ana', correta: true },
            { texto: 'Opção B', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('Questão ou alternativa inválida para esta atividade.');
  });

  // 14. Alterações estruturais em atividade publicada são barradas, mas correções de texto são aceitas
  it('alterações estruturais em atividade publicada são bloqueadas, mas textos podem ser corrigidos', async () => {
    await authService.login('ana@demo.com', 'demo123');

    const ativOriginal = await professorService.obterAtividade('ativ-mat-01');
    expect(ativOriginal?.status).toBe('publicada');
    expect(ativOriginal?.questoes.length).toBe(4);

    // 14.1. Tentar excluir questão de atividade publicada lança erro
    await expect(
      professorService.excluirQuestao('q-mat-1')
    ).rejects.toThrow('Atividade publicada: só é possível corrigir textos.');

    // 14.2. Tentar adicionar questão em atividade publicada lança erro
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

    // 14.3. Correção de texto permitida
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
      modo: 'exercicio',
    });

    await expect(
      professorService.salvarQuestoes(novaAtiv.id, [
        {
          ordem: 1,
          enunciado: '    ',
          alternativas: [
            { texto: 'A', correta: true },
            { texto: 'B', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('O enunciado da questão 1 não pode ficar vazio.');

    await expect(
      professorService.salvarQuestoes(novaAtiv.id, [
        {
          ordem: 1,
          enunciado: 'Enunciado válido',
          alternativas: [
            { texto: 'A', correta: true },
            { texto: '   ', correta: false },
          ],
        },
      ])
    ).rejects.toThrow('O texto da alternativa B da questão 1 não pode ficar vazio.');
  });

  // 16. hojeLocal utilitário
  it('hojeLocal retorna data no formato YYYY-MM-DD', () => {
    const hojeStr = hojeLocal();
    expect(hojeStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // 17. Modo Prova: sigilo total e liberação de resultado apenas após conclusão
  describe('Regras do Modo Prova', () => {
    it('responder devolve apenas { registrada: true, modo: "prova" } sem correta ou por_que_errou', async () => {
      // Aluna Manuela Costa da turma 6B (aluno-6b-4, PIN 6543)
      // ativ-cien-01 pertence à oferta de Ciências do 6B e é modo PROVA
      const { token } = await alunoService.login('aluno-6b-4', '6543');

      const resposta = await alunoService.responder(token, 'q-cien-1', 'alt-c1-a');
      expect('registrada' in resposta).toBe(true);
      expect((resposta as unknown as Record<string, unknown>).acertou).toBeUndefined();
      expect((resposta as unknown as Record<string, unknown>).alternativa_correta_id).toBeUndefined();
      expect((resposta as unknown as Record<string, unknown>).explicacao).toBeUndefined();
    });

    it('recusa resultadoProva antes de todas as questões serem respondidas', async () => {
      const { token } = await alunoService.login('aluno-6b-4', '6543');

      // Responde apenas à primeira questão de Ciências
      await alunoService.responder(token, 'q-cien-1', 'alt-c1-a');

      // Tenta acessar resultadoProva antes de concluir todas as 4 questões
      await expect(
        alunoService.resultadoProva(token, 'ativ-cien-01')
      ).rejects.toThrow('Termine todas as questões para ver o resultado.');
    });

    it('libera resultadoProva completo com acertos e explicações após responder todas as questões', async () => {
      const { token } = await alunoService.login('aluno-6b-4', '6543');

      // Responde todas as 4 questões da prova de Ciências (3 corretas e 1 errada)
      await alunoService.responder(token, 'q-cien-1', 'alt-c1-b'); // Correta
      await alunoService.responder(token, 'q-cien-2', 'alt-c2-a'); // Correta
      await alunoService.responder(token, 'q-cien-3', 'alt-c3-b'); // Correta
      await alunoService.responder(token, 'q-cien-4', 'alt-c4-b'); // Errada

      const resultado = await alunoService.resultadoProva(token, 'ativ-cien-01');
      expect(resultado.atividade_id).toBe('ativ-cien-01');
      expect(resultado.total_questoes).toBe(4);
      expect(resultado.acertos).toBe(3);
      expect(resultado.aproveitamento).toBe(75);
      expect(resultado.questoes).toHaveLength(4);
      expect(resultado.questoes[0].alternativa_correta_id).toBe('alt-c1-b');
      expect(resultado.questoes[0].explicacao).toBeDefined();
    });

    it('tentarNovamente é rejeitado em modo prova', async () => {
      const { token } = await alunoService.login('aluno-6b-4', '6543');

      await alunoService.responder(token, 'q-cien-1', 'alt-c1-b');

      await expect(
        alunoService.tentarNovamente(token, 'q-cien-1', 'alt-c1-a')
      ).rejects.toThrow('"Tentar novamente" está disponível apenas no modo exercício.');
    });

    it('resultadoProva liberado numa prova encerrada e incompleta, com as questões em branco contando como erro', async () => {
      // 1. Aluna Manuela Costa (6º B) responde apenas à q-cien-1 enquanto a prova está publicada
      const { token } = await alunoService.login('aluno-6b-4', '6543');
      await alunoService.responder(token, 'q-cien-1', 'alt-c1-b'); // Correta

      // Enquanto a prova está publicada e incompleta, resultadoProva continua bloqueado
      await expect(
        alunoService.resultadoProva(token, 'ativ-cien-01')
      ).rejects.toThrow('Termine todas as questões para ver o resultado.');

      // 2. Professor Carlos encerra a prova
      await authService.login('carlos@demo.com', 'demo123');
      await professorService.encerrarAtividade('ativ-cien-01');

      // 3. Agora a aluna pode acessar resultadoProva mesmo incompleta
      const resultado = await alunoService.resultadoProva(token, 'ativ-cien-01');
      expect(resultado.atividade_id).toBe('ativ-cien-01');
      expect(resultado.total_questoes).toBe(4);
      expect(resultado.acertos).toBe(1);
      expect(resultado.erros).toBe(3);
      expect(resultado.aproveitamento).toBe(25);

      // Questão 1 (respondida)
      expect(resultado.questoes[0].alternativa_escolhida_id).toBe('alt-c1-b');
      expect(resultado.questoes[0].acertou).toBe(true);

      // Questões 2, 3 e 4 (não respondidas) aparecem com alternativa_escolhida_id null e acertou false
      for (let i = 1; i < 4; i++) {
        expect(resultado.questoes[i].alternativa_escolhida_id).toBeNull();
        expect(resultado.questoes[i].acertou).toBe(false);
        expect(resultado.questoes[i].alternativa_correta_id).toBeTruthy();
        expect(resultado.questoes[i].explicacao).toBeTruthy();
      }

      // 4. carregarAtividade em prova encerrada também mostra o feedback das questões
      const ativCarregada = await alunoService.carregarAtividade(token, 'ativ-cien-01');
      expect(ativCarregada.status).toBe('encerrada');
      expect(ativCarregada.questoes[0].respondida).toBe(true);
      expect(ativCarregada.questoes[0].acertou).toBe(true);
      expect(ativCarregada.questoes[1].respondida).toBe(false);
      expect(ativCarregada.questoes[1].acertou).toBe(false);
      expect(ativCarregada.questoes[1].alternativa_correta_id).toBeTruthy();
    });

    it('aluno do 6º B recebe erro em resultadoProva de prova do 7º A', async () => {
      // Cria uma prova no 7º A
      await authService.login('ana@demo.com', 'demo123');
      const prova7A = await professorService.criarAtividade('oferta-mat-7a', {
        titulo: 'Prova 7A',
        descricao: 'Avaliação de Matemática',
        prazo: '2026-11-20',
        periodo_id: 'per-bim-3',
        modo: 'prova',
      });

      // Aluno do 6º B (aluno-6b-1) tenta acessar resultadoProva da prova do 7º A
      const { token } = await alunoService.login('aluno-6b-1', '1098');
      await expect(
        alunoService.resultadoProva(token, prova7A.id)
      ).rejects.toThrow('Esta atividade não pertence à sua turma.');
    });
  });

  // Teste específico de validação de turma na fichaAluno
  it('fichaAluno com aluno de outra turma recebe erro', async () => {
    // Carlos é professor do 6º B (oferta-cien-6b)
    await authService.login('carlos@demo.com', 'demo123');

    // aluno-7a-1 (Lucas) pertence à turma 7º A, não à turma 6º B
    await expect(
      professorService.fichaAluno('oferta-cien-6b', 'aluno-7a-1')
    ).rejects.toThrow('O aluno não pertence à turma desta oferta.');
  });

  // 18. Modo Exercício: tentarNovamente e invariância pedagógica
  describe('Regras do Modo Exercício (tentarNovamente)', () => {
    it('recusa tentarNovamente se o aluno já acertou a questão na primeira tentativa', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012');

      // Responde corretamente à q-mat-1
      await alunoService.responder(token, 'q-mat-1', 'alt-m1-a');

      await expect(
        alunoService.tentarNovamente(token, 'q-mat-1', 'alt-m1-b')
      ).rejects.toThrow(/Você já acertou esta questão/);
    });

    it('permite tentarNovamente quando errou, atualiza tentativas e acertou_final, mas NUNCA altera a 1ª resposta', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012');

      // 1. Responde errado à q-mat-1 (marcou B em vez de A)
      const resp1 = await alunoService.responder(token, 'q-mat-1', 'alt-m1-b');
      expect('acertou' in resp1).toBe(true);
      if ('acertou' in resp1) {
        expect(resp1.acertou).toBe(false);
      }

      // 2. Tenta novamente marcando agora a correta (A)
      const retryResult = await alunoService.tentarNovamente(token, 'q-mat-1', 'alt-m1-a');
      expect(retryResult.acertou).toBe(true);

      // 3. Verifica no banco se a resposta canônica preservou alternativa_id e acertou da 1ª resposta!
      const db = await getDatabase();
      const respostaSalva = db.respostas.find(
        (r) => r.aluno_id === 'aluno-7a-4' && r.questao_id === 'q-mat-1'
      );

      expect(respostaSalva).toBeDefined();
      expect(respostaSalva?.alternativa_id).toBe('alt-m1-b'); // 1ª resposta mantida intacta!
      expect(respostaSalva?.acertou).toBe(false); // 1ª resposta foi erro!
      expect(respostaSalva?.tentativas).toBe(2);
      expect(respostaSalva?.acertou_final).toBe(true);

      // 4. Se tentar uma 3ª vez tendo já acertado_final, deve recusar
      await expect(
        alunoService.tentarNovamente(token, 'q-mat-1', 'alt-m1-c')
      ).rejects.toThrow(/Você já acertou esta questão/);
    });

    it('tentarNovamente bem-sucedido NÃO altera a média do aluno no período (baseada estritamente na 1ª resposta)', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012');

      // Responde as 4 questões de Matemática: 3 acertos e 1 erro
      await alunoService.responder(token, 'q-mat-1', 'alt-m1-b'); // Errou (1ª resposta = false)
      await alunoService.responder(token, 'q-mat-2', 'alt-m2-a'); // Acertou
      await alunoService.responder(token, 'q-mat-3', 'alt-m3-b'); // Acertou
      await alunoService.responder(token, 'q-mat-4', 'alt-m4-c'); // Acertou

      // Média inicial esperada: 8 acertos em 12 questões (ativ-mat-01: 3/4, ativ-demo-mat-frac: 3/5, ativ-demo-mat-inteiros-enc: 2/3) = 66.7%
      const desempenhoAntes = await alunoService.meuDesempenho(token);
      const discMatAntes = desempenhoAntes.disciplinas.find(
        (d) => d.oferta_id === 'oferta-mat-7a'
      );
      expect(discMatAntes?.media_periodo).toBe(66.7);

      // Agora o aluno usa tentarNovamente na questão 1 e acerta!
      await alunoService.tentarNovamente(token, 'q-mat-1', 'alt-m1-a');

      // A média no período DEVE continuar 66.7% (estatística pedagógica usa só a 1ª resposta)
      const desempenhoDepois = await alunoService.meuDesempenho(token);
      const discMatDepois = desempenhoDepois.disciplinas.find(
        (d) => d.oferta_id === 'oferta-mat-7a'
      );
      expect(discMatDepois?.media_periodo).toBe(66.7);
    });
  });

  // 19. Simulação Multi-Aba (Parte E - Trava Otimista)
  describe('Simulação Multi-Aba com LocalStorage e Sincronização (Trava Otimista)', () => {
    it('segunda aba recebe erro ao tentar salvar versão defasada e grava com sucesso na nova tentativa', async () => {
      // 1. Aba 1 lê o banco
      const dbAba1 = await getDatabase();
      const versaoInicial = dbAba1.versao || 1;

      // 2. Aba 2 lê o banco simultaneamente (versão igual à aba 1)
      const dbAba2 = JSON.parse(JSON.stringify(dbAba1));

      // 3. Aba 1 cria uma turma nova e salva
      dbAba1.turmas.push({
        id: 'turma-aba-1',
        created_at: new Date().toISOString(),
        escola_id: 'esc-001',
        nome: '8º Ano Aba 1',
        serie: '8º Ano',
        segmento: 'fund2',
        ano_letivo: 2026,
        codigo_acesso: 'ABA101',
        ativa: true,
      });
      saveDatabase(dbAba1);

      // Confirma que a versão subiu no localStorage
      expect(dbAba1.versao).toBe(versaoInicial + 1);

      // 4. Aba 2 tenta salvar modificação baseada na versão defasada
      dbAba2.turmas.push({
        id: 'turma-aba-2',
        created_at: new Date().toISOString(),
        escola_id: 'esc-001',
        nome: '9º Ano Aba 2',
        serie: '9º Ano',
        segmento: 'fund2',
        ano_letivo: 2026,
        codigo_acesso: 'ABA202',
        ativa: true,
      });

      // A segunda aba deve receber erro e não gravar
      expect(() => saveDatabase(dbAba2)).toThrow(
        'Os dados foram atualizados em outra aba. Tente de novo.'
      );

      // 5. Na nova tentativa, Aba 2 busca os dados atualizados (que já contêm a alteração da Aba 1)
      const dbAba2Atualizado = await getDatabase();
      expect(dbAba2Atualizado.turmas.some((t) => t.id === 'turma-aba-1')).toBe(true);

      // Aplica a alteração da Aba 2 sobre o banco atualizado e salva
      dbAba2Atualizado.turmas.push({
        id: 'turma-aba-2',
        created_at: new Date().toISOString(),
        escola_id: 'esc-001',
        nome: '9º Ano Aba 2',
        serie: '9º Ano',
        segmento: 'fund2',
        ano_letivo: 2026,
        codigo_acesso: 'ABA202',
        ativa: true,
      });
      saveDatabase(dbAba2Atualizado);

      // 6. Confirma que o banco final contém as turmas criadas por AMBAS as abas e versão = versaoInicial + 2
      const dbFinal = await getDatabase();
      expect(dbFinal.turmas.some((t) => t.id === 'turma-aba-1')).toBe(true);
      expect(dbFinal.turmas.some((t) => t.id === 'turma-aba-2')).toBe(true);
      expect(dbFinal.versao).toBe(versaoInicial + 2);
    });
  });
});
