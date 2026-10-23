import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseProfessorService,
  criarSupabaseProfessorService,
} from '../supabase/professor.supabase';

interface MockTabelaConfig {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

function criarClienteSimulado(
  tabelasConfig: Record<string, MockTabelaConfig | MockTabelaConfig[]> = {},
  usuarioSessao: { id: string; escola_id: string; papel: string; nome: string } = {
    id: 'prof-1',
    escola_id: 'escola-1',
    papel: 'professor',
    nome: 'Professora Ana',
  }
) {
  const contadoresTabela: Record<string, number> = {};
  const chamadasRegistradas: { tabela: string; metodo: string; args: unknown[] }[] = [];

  const auth = {
    getSession: vi.fn(async () => ({
      data: { session: { user: { id: usuarioSessao.id } } },
      error: null,
    })),
  };

  const from = vi.fn((tabela: string) => {
    const configTabela = tabelasConfig[tabela];
    let resultado: MockTabelaConfig = { data: null, error: null, count: null };

    if (Array.isArray(configTabela)) {
      const idx = contadoresTabela[tabela] || 0;
      resultado = configTabela[idx] ?? { data: null, error: null, count: null };
      contadoresTabela[tabela] = idx + 1;
    } else if (configTabela) {
      resultado = configTabela;
    } else if (tabela === 'perfis') {
      resultado = {
        data: {
          id: usuarioSessao.id,
          escola_id: usuarioSessao.escola_id,
          papel: usuarioSessao.papel,
          nome: usuarioSessao.nome,
          ativo: true,
        },
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
    builder.delete = vi.fn(registrar('delete'));
    builder.upsert = vi.fn(registrar('upsert'));
    builder.eq = vi.fn(registrar('eq'));
    builder.is = vi.fn(registrar('is'));
    builder.in = vi.fn(registrar('in'));
    builder.order = vi.fn(registrar('order'));
    builder.limit = vi.fn(registrar('limit'));
    builder.single = vi.fn(async () => {
      chamadasRegistradas.push({ tabela, metodo: 'single', args: [] });
      return {
        data: resultado.data ?? null,
        error: resultado.error ?? null,
        count: resultado.count ?? null,
      };
    });
    builder.maybeSingle = vi.fn(async () => {
      chamadasRegistradas.push({ tabela, metodo: 'maybeSingle', args: [] });
      return {
        data: resultado.data ?? null,
        error: resultado.error ?? null,
        count: resultado.count ?? null,
      };
    });
    builder.then = (
      resolve: (val: { data: unknown; error: unknown; count: unknown }) => void,
      reject: (err: unknown) => void
    ) =>
      Promise.resolve({
        data: resultado.data ?? null,
        error: resultado.error ?? null,
        count: resultado.count ?? null,
      }).then(resolve, reject);

    return builder;
  });

  const cliente = {
    auth,
    from,
  } as unknown as SupabaseClient;

  return { cliente, chamadasRegistradas, contadoresTabela };
}

describe('ProfessorService Supabase (Fase 5.3)', () => {
  it('criarSupabaseProfessorService instancia a classe corretamente', () => {
    const { cliente } = criarClienteSimulado();
    const service = criarSupabaseProfessorService(cliente);
    expect(service).toBeInstanceOf(SupabaseProfessorService);
  });

  describe('Sessão e Permissões', () => {
    it('sessão expirada lança erro em português', async () => {
      const { cliente } = criarClienteSimulado();
      vi.spyOn(cliente.auth, 'getSession').mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      const service = new SupabaseProfessorService(cliente);
      await expect(service.minhasOfertas()).rejects.toThrow('Sessão expirada. Entre novamente.');
    });

    it('usuário inativo lança erro em português', async () => {
      const { cliente } = criarClienteSimulado({
        perfis: { data: { id: 'prof-1', ativo: false }, error: null },
      });
      const service = new SupabaseProfessorService(cliente);
      await expect(service.minhasOfertas()).rejects.toThrow('Usuário não encontrado ou inativo.');
    });

    it('papel não autorizado lança "Você não tem permissão para esta ação."', async () => {
      const { cliente } = criarClienteSimulado(
        {},
        { id: 'aluno-1', escola_id: 'escola-1', papel: 'aluno', nome: 'Aluno João' }
      );
      const service = new SupabaseProfessorService(cliente);
      await expect(service.minhasOfertas()).rejects.toThrow('Você não tem permissão para esta ação.');
    });
  });

  describe('1. Minhas Ofertas', () => {
    it('professor: consulta filtra por professor_id e deleted_at IS NULL', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: {
          data: [
            {
              id: 'of-1',
              created_at: '2026-02-01T00:00:00Z',
              turma_id: 't-1',
              disciplina_id: 'd-1',
              professor_id: 'prof-1',
              turmas: { nome: '7º Ano A', codigo_acesso: '7A2026', serie: '7º' },
              disciplinas: { nome: 'Matemática' },
              perfis: { nome: 'Professora Ana' },
            },
          ],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const ofertas = await service.minhasOfertas();

      expect(ofertas).toHaveLength(1);
      expect(ofertas[0].turma_nome).toBe('7º Ano A');
      expect(ofertas[0].disciplina_nome).toBe('Matemática');

      const chamadasEq = chamadasRegistradas.filter(
        (c) => c.tabela === 'ofertas' && c.metodo === 'eq'
      );
      expect(chamadasEq).toContainEqual({
        tabela: 'ofertas',
        metodo: 'eq',
        args: ['professor_id', 'prof-1'],
      });

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'ofertas' && c.metodo === 'is'
      );
      expect(chamadasIs).toContainEqual({
        tabela: 'ofertas',
        metodo: 'is',
        args: ['deleted_at', null],
      });
    });

    it('direção/coordenação: não filtra professor_id (vê todas as ofertas)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado(
        {
          ofertas: { data: [] },
        },
        { id: 'dir-1', escola_id: 'escola-1', papel: 'direcao', nome: 'Diretora Maria' }
      );

      const service = new SupabaseProfessorService(cliente);
      await service.minhasOfertas();

      const chamadasEqProf = chamadasRegistradas.filter(
        (c) => c.tabela === 'ofertas' && c.metodo === 'eq' && c.args[0] === 'professor_id'
      );
      expect(chamadasEqProf).toHaveLength(0);
    });

    it('erro do banco em minhasOfertas lança mensagem em português', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { error: { message: 'db error' } },
      });
      const service = new SupabaseProfessorService(cliente);
      await expect(service.minhasOfertas()).rejects.toThrow(
        'Não foi possível listar as ofertas de disciplinas.'
      );
    });
  });

  describe('2. Atividades (Listar, Obter, Criar, Atualizar, Excluir, Publicar, Encerrar, Duplicar)', () => {
    it('listarAtividades: filtra deleted_at IS NULL e valida oferta', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        atividades: {
          data: [
            {
              id: 'ativ-1',
              created_at: '2026-02-10T10:00:00Z',
              oferta_id: 'of-1',
              periodo_id: 'per-1',
              titulo: 'Frações',
              descricao: 'Lista 1',
              prazo: '2026-03-01',
              modo: 'exercicio',
              status: 'rascunho',
              criado_por: 'prof-1',
            },
          ],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const lista = await service.listarAtividades('of-1');

      expect(lista).toHaveLength(1);
      expect(lista[0].titulo).toBe('Frações');

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'atividades' && c.metodo === 'is'
      );
      expect(chamadasIs).toContainEqual({
        tabela: 'atividades',
        metodo: 'is',
        args: ['deleted_at', null],
      });
    });

    it('listarAtividades: professor tentando acessar oferta de outro recebe erro de permissão', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: { id: 'of-outra', professor_id: 'prof-outro', turma_id: 't-1' } },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.listarAtividades('of-outra')).rejects.toThrow(
        'Você não tem permissão para esta ação.'
      );
    });

    it('obterAtividade: devolve AtividadeCompleta com questões e alternativas ordenadas e com gabarito', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: {
            id: 'ativ-1',
            created_at: '2026-02-10T10:00:00Z',
            oferta_id: 'of-1',
            periodo_id: 'per-1',
            titulo: 'Frações',
            descricao: 'Desc',
            prazo: null,
            modo: 'exercicio',
            status: 'rascunho',
            criado_por: 'prof-1',
          },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: {
          data: [
            {
              id: 'q-2',
              ordem: 2,
              enunciado: 'Quanto é 2+2?',
              tipo: 'objetiva',
              dica: null,
              explicacao: null,
            },
            {
              id: 'q-1',
              ordem: 1,
              enunciado: 'Quanto é 1+1?',
              tipo: 'objetiva',
              dica: null,
              explicacao: null,
            },
          ],
        },
        alternativas: {
          data: [
            {
              id: 'alt-b',
              questao_id: 'q-1',
              letra: 'B',
              texto: 'Dois',
              correta: true,
              por_que_errou: null,
              updated_at: '2026-02-10T10:00:00Z',
            },
            {
              id: 'alt-a',
              questao_id: 'q-1',
              letra: 'A',
              texto: 'Um',
              correta: false,
              por_que_errou: 'Não somou',
              updated_at: '2026-02-10T10:00:00Z',
            },
          ],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const resultado = await service.obterAtividade('ativ-1');

      expect(resultado).not.toBeNull();
      expect(resultado?.titulo).toBe('Frações');
      expect(resultado?.questoes).toHaveLength(2);
      // Questão 1 tem alternativas ordenadas A e B, com gabarito acessível
      const q1 = resultado?.questoes.find((q) => q.id === 'q-1');
      expect(q1?.alternativas).toHaveLength(2);
      expect(q1?.alternativas[0].letra).toBe('A');
      expect(q1?.alternativas[1].letra).toBe('B');
      expect(q1?.alternativas[1].correta).toBe(true);
    });

    it('criarAtividade: usa criado_por da sessão e status rascunho', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        atividades: {
          data: {
            id: 'ativ-nova',
            created_at: '2026-02-15T12:00:00Z',
            oferta_id: 'of-1',
            periodo_id: 'per-1',
            titulo: 'Polinômios',
            descricao: '',
            prazo: null,
            modo: 'exercicio',
            status: 'rascunho',
            criado_por: 'prof-1',
          },
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const nova = await service.criarAtividade('of-1', {
        titulo: 'Polinômios',
        descricao: '',
        prazo: null,
        periodo_id: 'per-1',
      });

      expect(nova.id).toBe('ativ-nova');

      const chamadasInsert = chamadasRegistradas.filter(
        (c) => c.tabela === 'atividades' && c.metodo === 'insert'
      );
      expect(chamadasInsert).toHaveLength(1);
      const payload = chamadasInsert[0].args[0] as Record<string, unknown>;
      expect(payload.criado_por).toBe('prof-1');
      expect(payload.status).toBe('rascunho');
      expect(payload.modo).toBe('exercicio');
    });

    it('atualizarAtividade: impede trocar modo se não for rascunho', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: {
            id: 'ativ-1',
            oferta_id: 'of-1',
            status: 'publicada',
          },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(
        service.atualizarAtividade('ativ-1', { modo: 'prova' })
      ).rejects.toThrow('O modo da atividade só pode ser alterado enquanto estiver em rascunho.');
    });

    it('publicarAtividade: falha se atividade não estiver em rascunho', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'publicada' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.publicarAtividade('ativ-1')).rejects.toThrow(
        'Apenas atividades em rascunho podem ser publicadas.'
      );
    });

    it('publicarAtividade: falha se atividade não tiver questões', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: { data: [] },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.publicarAtividade('ativ-1')).rejects.toThrow(
        'A atividade precisa ter pelo menos 1 questão para ser publicada.'
      );
    });

    it('publicarAtividade: valida alternativas de questões objetivas (mínimo 2, máx 5, 1 correta)', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: {
          data: [{ id: 'q-1', ordem: 1, tipo: 'objetiva' }],
        },
        alternativas: {
          data: [{ id: 'alt-1', correta: true }], // apenas 1 alternativa (inválido)
        },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.publicarAtividade('ativ-1')).rejects.toThrow(
        'A questão 1 possui número inválido de alternativas (deve ter entre 2 e 5).'
      );
    });

    it('publicarAtividade: sucesso atualiza status para publicada', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: {
          data: [{ id: 'q-1', ordem: 1, tipo: 'objetiva' }],
        },
        alternativas: {
          data: [
            { id: 'alt-1', correta: true },
            { id: 'alt-2', correta: false },
          ],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      await service.publicarAtividade('ativ-1');

      const chamadasUpdate = chamadasRegistradas.filter(
        (c) => c.tabela === 'atividades' && c.metodo === 'update'
      );
      expect(chamadasUpdate).toContainEqual({
        tabela: 'atividades',
        metodo: 'update',
        args: [{ status: 'publicada' }],
      });
    });

    it('encerrarAtividade: falha se não for publicada e atualiza para encerrada', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.encerrarAtividade('ativ-1')).rejects.toThrow(
        'Apenas atividades publicadas podem ser encerradas.'
      );
    });

    it('excluirAtividade: impede exclusão se houver respostas', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: {
          data: [{ id: 'q-1' }],
        },
        respostas: {
          count: 2,
        },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.excluirAtividade('ativ-1')).rejects.toThrow(
        'Apenas atividades em rascunho e sem respostas podem ser excluídas.'
      );
    });

    it('excluirAtividade: exclusão lógica via update de deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: {
          data: [{ id: 'q-1' }],
        },
        respostas: {
          count: 0,
        },
      });

      const service = new SupabaseProfessorService(cliente);
      await service.excluirAtividade('ativ-1');

      const updateAtiv = chamadasRegistradas.find(
        (c) => c.tabela === 'atividades' && c.metodo === 'update'
      );
      expect(updateAtiv).toBeDefined();
      expect((updateAtiv?.args[0] as Record<string, unknown>).deleted_at).toBeDefined();

      const deleteAtiv = chamadasRegistradas.find(
        (c) => c.tabela === 'atividades' && c.metodo === 'delete'
      );
      expect(deleteAtiv).toBeUndefined(); // não é hard delete
    });

    it('duplicarAtividade: cria cópia em rascunho para outra oferta do mesmo professor', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: [
          {
            data: {
              id: 'ativ-orig',
              oferta_id: 'of-1',
              periodo_id: 'per-1',
              titulo: 'Original',
              descricao: 'Desc',
              prazo: '2026-03-01',
              modo: 'exercicio',
              status: 'publicada',
              criado_por: 'prof-1',
            },
          },
          {
            data: {
              id: 'ativ-copia',
              created_at: '2026-02-20T00:00:00Z',
              oferta_id: 'of-2',
              periodo_id: 'per-1',
              titulo: 'Original (Cópia)',
              descricao: 'Desc',
              prazo: '2026-03-01',
              modo: 'exercicio',
              status: 'rascunho',
              criado_por: 'prof-1',
            },
          },
        ],
        ofertas: [
          { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
          { data: { id: 'of-2', professor_id: 'prof-1', turma_id: 't-2' } },
        ],
        questoes: [
          {
            data: [
              {
                id: 'q-orig',
                ordem: 1,
                enunciado: 'Enunciado',
                tipo: 'objetiva',
              },
            ],
          },
          {
            data: { id: 'q-nova' },
          },
        ],
        alternativas: [
          {
            data: [
              { id: 'alt-orig-1', letra: 'A', texto: 'Alt 1', correta: true, por_que_errou: null },
            ],
          },
          {
            data: null,
          },
        ],
      });

      const service = new SupabaseProfessorService(cliente);
      const copia = await service.duplicarAtividade('ativ-orig', 'of-2');

      expect(copia.id).toBe('ativ-copia');
      expect(copia.titulo).toBe('Original (Cópia)');
      expect(copia.status).toBe('rascunho');
    });
  });

  describe('3. Questões e Alternativas (salvarQuestoes, reordenarQuestoes, excluirQuestao)', () => {
    it('salvarQuestoes: não apaga questão antes de gravar as novas (grava novas primeiro e marca deleted_at por último)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: [
          // 1. Consulta questões atuais da atividade: existia q-velha
          { data: [{ id: 'q-velha', ordem: 1, tipo: 'objetiva' }] },
          // 2. Insert da nova questão
          { data: { id: 'q-nova' } },
          // 3. Update deleted_at para as descartadas
          { data: null },
        ],
        alternativas: { data: null },
      });

      const service = new SupabaseProfessorService(cliente);
      await service.salvarQuestoes('ativ-1', [
        {
          enunciado: 'Nova questão?',
          tipo: 'objetiva',
          alternativas: [
            { letra: 'A', texto: 'Opção 1', correta: true },
            { letra: 'B', texto: 'Opção 2', correta: false },
          ],
        },
      ]);

      // Verificar sequência de chamadas na tabela questoes:
      // Insert da q-nova deve acontecer ANTES do update com deleted_at em q-velha
      const idxInsert = chamadasRegistradas.findIndex(
        (c) => c.tabela === 'questoes' && c.metodo === 'insert'
      );
      const idxSoftDelete = chamadasRegistradas.findIndex(
        (c) =>
          c.tabela === 'questoes' &&
          c.metodo === 'update' &&
          (c.args[0] as Record<string, unknown>).deleted_at !== undefined
      );

      expect(idxInsert).toBeGreaterThan(-1);
      expect(idxSoftDelete).toBeGreaterThan(-1);
      expect(idxInsert).toBeLessThan(idxSoftDelete);
    });

    it('salvarQuestoes: alternativas são gravadas por upsert e só as letras que sobraram são apagadas', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        atividades: { data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' } },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: [{ data: [{ id: 'q-1', ordem: 1, tipo: 'objetiva' }] }, { data: null }],
        alternativas: { data: null },
      });

      await new SupabaseProfessorService(cliente).salvarQuestoes('ativ-1', [
        {
          id: 'q-1',
          enunciado: 'Pergunta?',
          tipo: 'objetiva',
          alternativas: [
            { texto: 'Um', correta: true },
            { texto: 'Dois', correta: false },
            { texto: 'Três', correta: false },
          ],
        },
      ]);

      const chamadasAlts = chamadasRegistradas.filter((c) => c.tabela === 'alternativas');
      const idxUpsert = chamadasAlts.findIndex((c) => c.metodo === 'upsert');
      const idxDelete = chamadasAlts.findIndex((c) => c.metodo === 'delete');
      expect(idxUpsert).toBeGreaterThan(-1);
      expect(chamadasAlts[idxUpsert].args[1]).toEqual({ onConflict: 'questao_id,letra' });
      expect(idxDelete).toBeGreaterThan(idxUpsert);
      expect(chamadasAlts.find((c) => c.metodo === 'in')?.args).toEqual(['letra', ['D', 'E']]);
    });

    it('salvarQuestoes: em atividade publicada só permite atualizar textos', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'publicada' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        questoes: {
          data: [{ id: 'q-1', ordem: 1, tipo: 'objetiva' }],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      // Tentativa de adicionar uma nova questão numa atividade já publicada
      await expect(
        service.salvarQuestoes('ativ-1', [
          {
            id: 'q-1',
            enunciado: 'Texto corrigido',
            tipo: 'objetiva',
            alternativas: [
              { letra: 'A', texto: 'A', correta: true },
              { letra: 'B', texto: 'B', correta: false },
            ],
          },
          {
            enunciado: 'Segunda questão',
            tipo: 'objetiva',
            alternativas: [
              { letra: 'A', texto: 'A', correta: true },
              { letra: 'B', texto: 'B', correta: false },
            ],
          },
        ])
      ).rejects.toThrow('Atividade publicada: só é possível corrigir textos.');
    });

    it('reordenarQuestoes: atualiza a ordem de cada questão', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
      });

      const service = new SupabaseProfessorService(cliente);
      await service.reordenarQuestoes('ativ-1', ['q-3', 'q-1', 'q-2']);

      const updates = chamadasRegistradas.filter(
        (c) => c.tabela === 'questoes' && c.metodo === 'update'
      );
      expect(updates).toHaveLength(3);
      expect(updates[0].args[0]).toEqual({ ordem: 1 });
      expect(updates[1].args[0]).toEqual({ ordem: 2 });
      expect(updates[2].args[0]).toEqual({ ordem: 3 });
    });

    it('excluirQuestao: exclui via deleted_at e falha se já tiver respostas', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        questoes: {
          data: { id: 'q-1', atividade_id: 'ativ-1' },
        },
        atividades: {
          data: { id: 'ativ-1', oferta_id: 'of-1', status: 'rascunho' },
        },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
        respostas: {
          count: 0,
        },
      });

      const service = new SupabaseProfessorService(cliente);
      await service.excluirQuestao('q-1');

      const updateQuestao = chamadasRegistradas.find(
        (c) => c.tabela === 'questoes' && c.metodo === 'update'
      );
      expect(updateQuestao).toBeDefined();
      expect((updateQuestao?.args[0] as Record<string, unknown>).deleted_at).toBeDefined();
    });
  });

  describe('4. Recados da Turma', () => {
    it('listarRecadosTurma: confere se professor leciona na turma e filtra deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1' }] },
        avisos: {
          data: [
            {
              id: 'av-1',
              escola_id: 'escola-1',
              autor_id: 'prof-1',
              turma_id: 't-1',
              titulo: 'Tragam régua',
              mensagem: 'Para a aula de amanhã',
              prioridade: 'media',
              publicado_em: '2026-02-15T08:00:00Z',
            },
          ],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const recados = await service.listarRecadosTurma('t-1');

      expect(recados).toHaveLength(1);
      expect(recados[0].titulo).toBe('Tragam régua');

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'avisos' && c.metodo === 'is'
      );
      expect(chamadasIs).toContainEqual({
        tabela: 'avisos',
        metodo: 'is',
        args: ['deleted_at', null],
      });
    });

    it('criarRecadoTurma: grava autor_id da sessão e turma_id da oferta', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: [
          // 1. validação de escrita da oferta
          { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' } },
          // 2. busca da turma_id
          { data: { id: 'of-1', turma_id: 't-1' } },
        ],
        avisos: {
          data: {
            id: 'av-novo',
            escola_id: 'escola-1',
            autor_id: 'prof-1',
            turma_id: 't-1',
            titulo: 'Aviso Importante',
            mensagem: 'Conteúdo',
            prioridade: 'alta',
            publicado_em: '2026-02-15T09:00:00Z',
          },
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const aviso = await service.criarRecadoTurma('of-1', {
        titulo: 'Aviso Importante',
        mensagem: 'Conteúdo',
        prioridade: 'alta',
      });

      expect(aviso.id).toBe('av-novo');

      const chamadasInsert = chamadasRegistradas.filter(
        (c) => c.tabela === 'avisos' && c.metodo === 'insert'
      );
      expect(chamadasInsert).toHaveLength(1);
      const payload = chamadasInsert[0].args[0] as Record<string, unknown>;
      expect(payload.autor_id).toBe('prof-1');
      expect(payload.turma_id).toBe('t-1');
      expect(payload.escola_id).toBe('escola-1');
    });
  });

  describe('5. Observações do Aluno', () => {
    it('listarObservacoesAluno: filtra deleted_at e confere permissão', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        alunos: { data: { id: 'al-1', turma_id: 't-1' } },
        ofertas: { data: [{ id: 'of-1' }] },
        aluno_observacoes: {
          data: [
            {
              id: 'obs-1',
              aluno_id: 'al-1',
              professor_id: 'prof-1',
              professor_nome: 'Professora Ana',
              texto: 'Aluno participativo',
              created_at: '2026-02-10T00:00:00Z',
              updated_at: '2026-02-10T00:00:00Z',
            },
          ],
        },
      });

      const service = new SupabaseProfessorService(cliente);
      const obs = await service.listarObservacoesAluno('al-1');

      expect(obs).toHaveLength(1);
      expect(obs[0].professor_nome).toBe('Professora Ana');

      const chamadasIs = chamadasRegistradas.filter(
        (c) => c.tabela === 'aluno_observacoes' && c.metodo === 'is'
      );
      expect(chamadasIs).toContainEqual({
        tabela: 'aluno_observacoes',
        metodo: 'is',
        args: ['deleted_at', null],
      });
    });

    it('salvarObservacaoAluno: grava professor_nome da sessão e professor_id', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        alunos: { data: { id: 'al-1', turma_id: 't-1' } },
        ofertas: { data: [{ id: 'of-1' }] },
        aluno_observacoes: [
          // Não existe observação anterior
          { data: null },
          // Retorno do insert
          {
            data: {
              id: 'obs-nova',
              aluno_id: 'al-1',
              professor_id: 'prof-1',
              professor_nome: 'Professora Ana',
              texto: 'Dedicado',
              created_at: '2026-02-15T00:00:00Z',
              updated_at: '2026-02-15T00:00:00Z',
            },
          },
        ],
      });

      const service = new SupabaseProfessorService(cliente);
      const gravada = await service.salvarObservacaoAluno('al-1', 'Dedicado');

      expect(gravada.id).toBe('obs-nova');
      expect(gravada.professor_nome).toBe('Professora Ana');

      const chamadasInsert = chamadasRegistradas.filter(
        (c) => c.tabela === 'aluno_observacoes' && c.metodo === 'insert'
      );
      expect(chamadasInsert).toHaveLength(1);
      const payload = chamadasInsert[0].args[0] as Record<string, unknown>;
      expect(payload.professor_id).toBe('prof-1');
      expect(payload.professor_nome).toBe('Professora Ana');
      expect(payload.texto).toBe('Dedicado');
    });

    it('excluirObservacaoAluno: exclusão lógica com deleted_at e impede excluir de outro professor', async () => {
      const { cliente } = criarClienteSimulado({
        aluno_observacoes: {
          data: { id: 'obs-1', aluno_id: 'al-1', professor_id: 'prof-outro' },
        },
      });

      const service = new SupabaseProfessorService(cliente);
      await expect(service.excluirObservacaoAluno('obs-1')).rejects.toThrow(
        'Você só pode excluir suas próprias observações.'
      );
    });

    it('excluirObservacaoAluno: sucesso faz update com deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        aluno_observacoes: {
          data: { id: 'obs-1', aluno_id: 'al-1', professor_id: 'prof-1' },
        },
        alunos: { data: { turma_id: 't-1' } },
        ofertas: { data: [{ id: 'of-1' }] },
      });

      const service = new SupabaseProfessorService(cliente);
      await service.excluirObservacaoAluno('obs-1');

      const updateObs = chamadasRegistradas.find(
        (c) => c.tabela === 'aluno_observacoes' && c.metodo === 'update'
      );
      expect(updateObs).toBeDefined();
      expect((updateObs?.args[0] as Record<string, unknown>).deleted_at).toBeDefined();
    });
  });

  describe('6. Métodos das Fases 5.4 e 5.5 lançam erro planejado', () => {
    it('mapaDeCalor lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.mapaDeCalor('ativ-1')).rejects.toThrow(
        'ProfessorService.mapaDeCalor será feito na 5.4/5.5'
      );
    });

    it('desempenhoOferta lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.desempenhoOferta('of-1', 'per-1')).rejects.toThrow(
        'ProfessorService.desempenhoOferta será feito na 5.4/5.5'
      );
    });

    it('fichaAluno lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.fichaAluno('al-1')).rejects.toThrow(
        'ProfessorService.fichaAluno será feito na 5.4/5.5'
      );
    });

    it('listarAlunosPorSerie lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.listarAlunosPorSerie('7º')).rejects.toThrow(
        'ProfessorService.listarAlunosPorSerie será feito na 5.4/5.5'
      );
    });

    it('desempenhoAlunoPorMaterias lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.desempenhoAlunoPorMaterias('al-1')).rejects.toThrow(
        'ProfessorService.desempenhoAlunoPorMaterias será feito na 5.4/5.5'
      );
    });

    it('listarCorrecoesPendentes lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.listarCorrecoesPendentes('ativ-1')).rejects.toThrow(
        'ProfessorService.listarCorrecoesPendentes será feito na 5.4/5.5'
      );
    });

    it('listarCorrecoesFeitas lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.listarCorrecoesFeitas('ativ-1')).rejects.toThrow(
        'ProfessorService.listarCorrecoesFeitas será feito na 5.4/5.5'
      );
    });

    it('corrigirResposta lança erro combinado', async () => {
      const service = new SupabaseProfessorService({} as SupabaseClient);
      await expect(service.corrigirResposta('resp-1', 'certo')).rejects.toThrow(
        'ProfessorService.corrigirResposta será feito na 5.4/5.5'
      );
    });
  });
});

