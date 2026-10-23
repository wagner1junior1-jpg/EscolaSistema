import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseGestaoService,
  criarSupabaseGestaoService,
} from '../supabase/gestao.supabase';

interface MockTabelaConfig {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

function criarClienteSimulado(
  tabelasConfig: Record<string, MockTabelaConfig | MockTabelaConfig[]> = {},
  respostasRpc: Array<{ message: string; code?: string } | null> = []
) {
  const contadoresTabela: Record<string, number> = {};
  const chamadasRegistradas: { tabela: string; metodo: string; args: unknown[] }[] = [];

  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    })),
  };

  const functions = {
    invoke: vi.fn(async (_fnName: string, options?: { body?: unknown }) => {
      const body = options?.body as { acao: string; email?: string; nome?: string; id?: string; senha?: string };
      if (body?.acao === 'criar') {
        return {
          data: {
            perfil: {
              id: 'prof-novo',
              created_at: '2026-10-22T00:00:00Z',
              escola_id: 'escola-1',
              nome: body.nome,
              papel: 'professor',
              ativo: true,
              email: body.email,
              trocar_senha: true,
            },
            senha_provisoria: 'prov123456',
          },
          error: null,
        };
      }
      if (body?.acao === 'redefinir-senha') {
        return {
          data: { senha_provisoria: body.senha || 'novaSenha123' },
          error: null,
        };
      }
      if (body?.acao === 'desativar') {
        return {
          data: { ok: true },
          error: null,
        };
      }
      return { data: null, error: null };
    }),
  };

  const from = vi.fn((tabela: string) => {
    const configTabela = tabelasConfig[tabela];
    let resultado: MockTabelaConfig = { data: null, error: null };

    if (Array.isArray(configTabela)) {
      const idx = contadoresTabela[tabela] || 0;
      resultado = configTabela[idx] ?? { data: null, error: null };
      contadoresTabela[tabela] = idx + 1;
    } else if (configTabela) {
      resultado = configTabela;
    } else if (tabela === 'perfis') {
      resultado = {
        data: { id: 'user-1', escola_id: 'escola-1', papel: 'direcao', ativo: true },
        error: null,
      };
    }

    const builder: Record<string, unknown> = {};

    const registrar = (metodo: string) => (...args: unknown[]) => {
      chamadasRegistradas.push({ tabela, metodo, args });
      return builder;
    };

    builder.select = vi.fn(registrar('select'));
    builder.insert = vi.fn(registrar('insert'));
    builder.update = vi.fn(registrar('update'));
    builder.eq = vi.fn(registrar('eq'));
    builder.is = vi.fn(registrar('is'));
    builder.order = vi.fn(registrar('order'));
    builder.limit = vi.fn(registrar('limit'));
    builder.in = vi.fn(registrar('in'));
    builder.single = vi.fn(async () => {
      chamadasRegistradas.push({ tabela, metodo: 'single', args: [] });
      return { data: resultado.data ?? null, error: resultado.error ?? null };
    });
    builder.maybeSingle = vi.fn(async () => {
      chamadasRegistradas.push({ tabela, metodo: 'maybeSingle', args: [] });
      return { data: resultado.data ?? null, error: resultado.error ?? null };
    });
    builder.then = (
      resolve: (val: { data: unknown; error: unknown }) => void,
      reject: (err: unknown) => void
    ) => Promise.resolve({ data: resultado.data ?? null, error: resultado.error ?? null }).then(resolve, reject);

    return builder;
  });

  // Cada chamada de rpc consome a próxima resposta (null = sucesso).
  let indiceRpc = 0;
  const rpc = vi.fn(async (_nome: string, _args?: unknown) => ({
    data: null,
    error: respostasRpc[indiceRpc++] ?? null,
  }));

  const cliente = {
    auth,
    functions,
    from,
    rpc,
  } as unknown as SupabaseClient;

  return { cliente, chamadasRegistradas, functions, rpc };
}

describe('GestaoService Supabase (Fase 5.1)', () => {
  it('criarSupabaseGestaoService instancia o serviço corretamente', () => {
    const { cliente } = criarClienteSimulado();
    const service = criarSupabaseGestaoService(cliente);
    expect(service).toBeInstanceOf(SupabaseGestaoService);
  });

  describe('Tratamento de erros em português', () => {
    it('erro do supabase ao obterEscola lança Error em português', async () => {
      const { cliente } = criarClienteSimulado({
        escolas: { error: { message: 'database connection lost' } },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(service.obterEscola()).rejects.toThrow(
        'Não foi possível obter os dados da escola.'
      );
    });

    it('escola não encontrada lança Error em português', async () => {
      const { cliente } = criarClienteSimulado({
        escolas: { data: null, error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(service.obterEscola()).rejects.toThrow('Escola não encontrada.');
    });

    it('erro ao listarPeriodos lança Error em português', async () => {
      const { cliente } = criarClienteSimulado({
        periodos: { error: { message: 'permission denied' } },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(service.listarPeriodos()).rejects.toThrow(
        'Não foi possível listar os períodos letivos.'
      );
    });

    it('disciplina duplicada no criarDisciplina lança mensagem amigável', async () => {
      const { cliente } = criarClienteSimulado({
        disciplinas: {
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(service.criarDisciplina('Matemática')).rejects.toThrow(
        'Já existe uma disciplina cadastrada com este nome.'
      );
    });

    it('código de turma duplicado no criarTurma lança mensagem amigável', async () => {
      const { cliente } = criarClienteSimulado({
        turmas: {
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(
        service.criarTurma({
          escola_id: 'escola-1',
          nome: '7º Ano A',
          serie: '7º Ano',
          segmento: 'fund2',
          ano_letivo: 2026,
          codigo_acesso: '7A-DEMO',
          ativa: true,
        })
      ).rejects.toThrow(
        'O código de acesso 7A-DEMO já está sendo utilizado por outra turma.'
      );
    });

    it('oferta duplicada no criarOferta lança mensagem amigável', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: {
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(
        service.criarOferta({
          turma_id: 'turma-1',
          disciplina_id: 'disc-1',
          professor_id: 'prof-1',
        })
      ).rejects.toThrow(
        'Já existe uma oferta desta disciplina cadastrada para esta turma.'
      );
    });

    it('não permite excluir disciplina se houver ofertas associadas', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'oferta-1' }], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(service.excluirDisciplina('disc-1')).rejects.toThrow(
        'Não é possível excluir esta disciplina pois ela já possui ofertas associadas.'
      );
    });

    it('não permite excluir oferta se houver atividades pedagógicas vinculadas', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: { data: [{ id: 'ativ-1' }], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await expect(service.excluirOferta('oferta-1')).rejects.toThrow(
        'Esta oferta possui atividades pedagógicas registradas e não pode ser excluída.'
      );
    });
  });

  describe('Listagem filtra deleted_at IS NULL', () => {
    it('listarPeriodos aplica .is("deleted_at", null)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        periodos: { data: [], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.listarPeriodos();

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'periodos' && c.metodo === 'is'
      );
      expect(chamadasIs).toEqual(
        expect.arrayContaining([{ tabela: 'periodos', metodo: 'is', args: ['deleted_at', null] }])
      );
    });

    it('listarDisciplinas aplica .is("deleted_at", null)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        disciplinas: { data: [], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.listarDisciplinas();

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'disciplinas' && c.metodo === 'is'
      );
      expect(chamadasIs).toEqual(
        expect.arrayContaining([{ tabela: 'disciplinas', metodo: 'is', args: ['deleted_at', null] }])
      );
    });

    it('listarTurmas aplica .is("deleted_at", null)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        turmas: { data: [], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.listarTurmas();

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'turmas' && c.metodo === 'is'
      );
      expect(chamadasIs).toEqual(
        expect.arrayContaining([{ tabela: 'turmas', metodo: 'is', args: ['deleted_at', null] }])
      );
    });

    it('listarOfertas aplica .is("deleted_at", null)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.listarOfertas();

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'ofertas' && c.metodo === 'is'
      );
      expect(chamadasIs).toEqual(
        expect.arrayContaining([{ tabela: 'ofertas', metodo: 'is', args: ['deleted_at', null] }])
      );
    });

    it('listarAvisosEscola aplica .is("deleted_at", null) e .is("turma_id", null)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        avisos: { data: [], error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.listarAvisosEscola();

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'avisos' && c.metodo === 'is'
      );
      expect(chamadasIs).toEqual(
        expect.arrayContaining([
          { tabela: 'avisos', metodo: 'is', args: ['turma_id', null] },
          { tabela: 'avisos', metodo: 'is', args: ['deleted_at', null] },
        ])
      );
    });
  });

  describe('Exclusão lógica usa deleted_at', () => {
    it('excluirDisciplina faz update de deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [], error: null },
        disciplinas: { data: null, error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.excluirDisciplina('disc-1');

      const updateChamada = chamadasRegistradas.find(
        (c) => c.tabela === 'disciplinas' && c.metodo === 'update'
      );
      expect(updateChamada).toBeDefined();
      expect(updateChamada?.args[0]).toHaveProperty('deleted_at');
      expect(typeof (updateChamada?.args[0] as { deleted_at: string }).deleted_at).toBe('string');
    });

    it('excluirOferta faz update de deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        atividades: { data: [], error: null },
        ofertas: { data: null, error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.excluirOferta('oferta-1');

      const updateChamada = chamadasRegistradas.find(
        (c) => c.tabela === 'ofertas' && c.metodo === 'update'
      );
      expect(updateChamada).toBeDefined();
      expect(updateChamada?.args[0]).toHaveProperty('deleted_at');
    });

    it('excluirAvisoEscola faz update de deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        avisos: { data: null, error: null },
      });
      const service = new SupabaseGestaoService(cliente);
      await service.excluirAvisoEscola('aviso-1');

      const updateChamada = chamadasRegistradas.find(
        (c) => c.tabela === 'avisos' && c.metodo === 'update'
      );
      expect(updateChamada).toBeDefined();
      expect(updateChamada?.args[0]).toHaveProperty('deleted_at');
    });
  });

  describe('definirPeriodoAtivo na ordem segura', () => {
    it('desativa o período atual antes de ativar o novo', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        periodos: [
          { data: null, error: null }, // 1º update: desativar atual
          { data: null, error: null }, // 2º update: ativar novo
        ],
      });
      const service = new SupabaseGestaoService(cliente);
      await service.definirPeriodoAtivo('per-2');

      const updatesPeriodos = chamadasRegistradas.filter(
        (c) => c.tabela === 'periodos' && c.metodo === 'update'
      );
      expect(updatesPeriodos.length).toBe(2);
      expect(updatesPeriodos[0].args[0]).toEqual({ ativo: false });
      expect(updatesPeriodos[1].args[0]).toEqual({ ativo: true });
    });
  });

  describe('Professores via Edge Function', () => {
    it('convidarProfessor repassa senha_provisoria devolvida pela Edge Function', async () => {
      const { cliente, functions } = criarClienteSimulado();
      const service = new SupabaseGestaoService(cliente);
      const resultado = await service.convidarProfessor('prof@escola.com', 'Professor Teste');

      expect(functions.invoke).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: {
            acao: 'criar',
            email: 'prof@escola.com',
            nome: 'Professor Teste',
            papel: 'professor',
            senha: undefined,
          },
        })
      );
      expect(resultado.senha_provisoria).toBe('prov123456');
      expect(resultado.email).toBe('prof@escola.com');
      expect(resultado.papel).toBe('professor');
    });

    it('redefinirSenhaProfessor valida tamanho mínimo de 6 caracteres', async () => {
      const { cliente } = criarClienteSimulado();
      const service = new SupabaseGestaoService(cliente);
      await expect(service.redefinirSenhaProfessor('prof-1', '12345')).rejects.toThrow(
        'A nova senha deve ter pelo menos 6 caracteres.'
      );
    });

    it('desativarProfessor chama a Edge Function com acao desativar', async () => {
      const { cliente, functions } = criarClienteSimulado();
      const service = new SupabaseGestaoService(cliente);
      await service.desativarProfessor('prof-1');

      expect(functions.invoke).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: {
            acao: 'desativar',
            id: 'prof-1',
          },
        })
      );
    });
  });

  describe('Alunos e PIN (Fase 5.2)', () => {
    const linhaAluno = (id: string, numero: number) => ({
      id,
      created_at: '2026-10-22T00:00:00Z',
      escola_id: 'escola-1',
      turma_id: 'turma-1',
      nome_completo: `Aluno ${numero}`,
      numero_chamada: numero,
      ativo: true,
    });
    const novoAluno = {
      escola_id: 'ignorado',
      turma_id: 'turma-1',
      nome_completo: '  Maria Souza  ',
      numero_chamada: 5,
      ativo: true,
    };

    it('listarAlunos filtra ativos e deleted_at, e por turma quando informada', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        alunos: { data: [linhaAluno('a1', 1)], error: null },
      });
      const lista = await new SupabaseGestaoService(cliente).listarAlunos('turma-1');

      expect(lista).toHaveLength(1);
      const filtros = chamadasRegistradas.filter((c) => c.tabela === 'alunos').map((c) => [c.metodo, ...c.args]);
      expect(filtros).toEqual(
        expect.arrayContaining([
          ['eq', 'ativo', true],
          ['is', 'deleted_at', null],
          ['eq', 'turma_id', 'turma-1'],
        ])
      );
    });

    it('listarAlunos nunca pede a coluna do PIN e traduz o erro', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        alunos: { error: { message: 'permission denied' } },
      });
      await expect(new SupabaseGestaoService(cliente).listarAlunos()).rejects.toThrow(
        'Não foi possível listar os alunos.'
      );
      const select = chamadasRegistradas.find((c) => c.tabela === 'alunos' && c.metodo === 'select');
      expect(String(select?.args[0])).not.toMatch(/pin/i);
    });

    it('cadastrarAluno grava o PIN pela RPC e devolve o PIN puro uma única vez', async () => {
      const { cliente, rpc, chamadasRegistradas } = criarClienteSimulado({
        alunos: { data: linhaAluno('a1', 5), error: null },
      });
      const resultado = await new SupabaseGestaoService(cliente).cadastrarAluno({
        ...novoAluno,
        pin: '4321',
      });

      expect(resultado.pin_puro).toBe('4321');
      expect(resultado.aluno).not.toHaveProperty('pin_hash');
      expect(rpc).toHaveBeenCalledWith('definir_pin_aluno', { p_aluno_id: 'a1', p_pin: '4321' });
      const insercao = chamadasRegistradas.find((c) => c.tabela === 'alunos' && c.metodo === 'insert');
      expect(insercao?.args[0]).toMatchObject({
        escola_id: 'escola-1', // vem da sessão, não do parâmetro
        nome_completo: 'Maria Souza',
      });
      expect(insercao?.args[0]).not.toHaveProperty('pin');
    });

    it('cadastrarAluno sem PIN gera um de 4 dígitos', async () => {
      const { cliente, rpc } = criarClienteSimulado({
        alunos: { data: linhaAluno('a1', 5), error: null },
      });
      const { pin_puro } = await new SupabaseGestaoService(cliente).cadastrarAluno(novoAluno);
      expect(pin_puro).toMatch(/^[1-9]\d{3}$/);
      expect(rpc).toHaveBeenCalledWith('definir_pin_aluno', { p_aluno_id: 'a1', p_pin: pin_puro });
    });

    it('cadastrarAluno rejeita nome vazio e PIN inválido antes de gravar', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado();
      const service = new SupabaseGestaoService(cliente);
      await expect(service.cadastrarAluno({ ...novoAluno, nome_completo: '   ' })).rejects.toThrow(
        'Informe o nome do aluno.'
      );
      await expect(service.cadastrarAluno({ ...novoAluno, pin: '12a4' })).rejects.toThrow(
        'O PIN deve conter exatamente 4 dígitos numéricos.'
      );
      expect(chamadasRegistradas.some((c) => c.metodo === 'insert')).toBe(false);
    });

    it('cadastrarAluno desfaz o cadastro (deleted_at) quando a RPC do PIN falha', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado(
        { alunos: [{ data: linhaAluno('a1', 5), error: null }, { data: null, error: null }] },
        [{ message: 'Aluno não encontrado ou sem permissão.', code: 'P0001' }]
      );
      await expect(new SupabaseGestaoService(cliente).cadastrarAluno(novoAluno)).rejects.toThrow(
        'Aluno não encontrado ou sem permissão.'
      );
      const desfazer = chamadasRegistradas.find((c) => c.tabela === 'alunos' && c.metodo === 'update');
      expect(desfazer?.args[0]).toMatchObject({ ativo: false });
      expect(desfazer?.args[0]).toHaveProperty('deleted_at');
    });

    it('erro técnico da RPC não vaza para a tela', async () => {
      const { cliente } = criarClienteSimulado({}, [
        { message: 'function definir_pin_aluno(uuid, text) does not exist', code: '42883' },
      ]);
      await expect(new SupabaseGestaoService(cliente).gerarOuResetarPin('a1')).rejects.toThrow(
        'Não foi possível definir o PIN do aluno.'
      );
    });

    it('cadastrarAlunosEmLote numera a partir do maior número e gera um PIN por aluno', async () => {
      const { cliente, rpc, chamadasRegistradas } = criarClienteSimulado({
        alunos: [
          { data: [{ numero_chamada: 22 }], error: null },
          { data: [linhaAluno('a2', 24), linhaAluno('a1', 23)], error: null },
        ],
      });
      const resultados = await new SupabaseGestaoService(cliente).cadastrarAlunosEmLote('turma-1', [
        ' Ana ',
        '',
        'Bia',
      ]);

      const insercao = chamadasRegistradas.find((c) => c.tabela === 'alunos' && c.metodo === 'insert');
      const linhas = insercao?.args[0] as Array<{ nome_completo: string; numero_chamada: number }>;
      expect(linhas.map((l) => [l.nome_completo, l.numero_chamada])).toEqual([
        ['Ana', 23],
        ['Bia', 24],
      ]);
      expect(resultados.map((r) => r.aluno.id)).toEqual(['a1', 'a2']);
      expect(rpc).toHaveBeenCalledTimes(2);
      resultados.forEach((r) => expect(r.pin_puro).toMatch(/^[1-9]\d{3}$/));
    });

    it('cadastrarAlunosEmLote sem nomes não chama o servidor', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado();
      expect(await new SupabaseGestaoService(cliente).cadastrarAlunosEmLote('turma-1', [' ', ''])).toEqual([]);
      expect(chamadasRegistradas).toHaveLength(0);
    });

    it('cadastrarAlunosEmLote desfaz o lote inteiro se um PIN falhar', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado(
        {
          alunos: [
            { data: [], error: null },
            { data: [linhaAluno('a1', 1), linhaAluno('a2', 2)], error: null },
            { data: null, error: null },
          ],
        },
        [null, { message: 'falha', code: 'XX000' }]
      );
      await expect(
        new SupabaseGestaoService(cliente).cadastrarAlunosEmLote('turma-1', ['Ana', 'Bia'])
      ).rejects.toThrow('Não foi possível definir o PIN do aluno.');

      const desfazer = chamadasRegistradas.find((c) => c.tabela === 'alunos' && c.metodo === 'in');
      expect(desfazer?.args).toEqual(['id', ['a1', 'a2']]);
    });

    it('atualizarAluno aplica só os campos informados e avisa quando não encontra', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        alunos: { data: linhaAluno('a1', 1), error: null },
      });
      await new SupabaseGestaoService(cliente).atualizarAluno('a1', { nome_completo: ' Novo ', ativo: false });
      const update = chamadasRegistradas.find((c) => c.tabela === 'alunos' && c.metodo === 'update');
      expect(update?.args[0]).toEqual({ nome_completo: 'Novo', ativo: false });

      const { cliente: vazio } = criarClienteSimulado({ alunos: { data: null, error: null } });
      await expect(new SupabaseGestaoService(vazio).atualizarAluno('x', { ativo: true })).rejects.toThrow(
        'Aluno não encontrado.'
      );
    });

    it('gerarOuResetarPin usa o PIN informado ou gera um novo', async () => {
      const { cliente, rpc } = criarClienteSimulado();
      const service = new SupabaseGestaoService(cliente);
      expect(await service.gerarOuResetarPin('a1', '0007')).toEqual({ pin_puro: '0007' });
      const { pin_puro } = await service.gerarOuResetarPin('a1');
      expect(pin_puro).toMatch(/^\d{4}$/);
      expect(rpc).toHaveBeenNthCalledWith(1, 'definir_pin_aluno', { p_aluno_id: 'a1', p_pin: '0007' });
      await expect(service.gerarOuResetarPin('a1', '123')).rejects.toThrow(
        'O PIN deve conter exatamente 4 dígitos numéricos.'
      );
    });
  });
});

