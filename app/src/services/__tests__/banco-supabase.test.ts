import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseBancoService,
  criarSupabaseBancoService,
} from '../supabase/banco.supabase';
import { TAMANHO_PAGINA } from '../supabase/paginacao';

interface MockTabelaConfig {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

interface UsuarioSessao {
  id: string;
  escola_id: string;
  papel: string;
  nome: string;
  ativo?: boolean;
}

function criarClienteSimulado(
  tabelasConfig: Record<string, MockTabelaConfig | MockTabelaConfig[]> = {},
  usuarioSessao: UsuarioSessao = {
    id: 'prof-1',
    escola_id: 'escola-1',
    papel: 'professor',
    nome: 'Professor Carlos',
    ativo: true,
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
          ativo: usuarioSessao.ativo ?? true,
        },
        error: null,
      };
    } else if (tabela === 'escolas') {
      resultado = {
        data: { id: usuarioSessao.escola_id, ano_letivo_atual: 2026 },
        error: null,
      };
    }

    let rangeFatia: { de: number; ate: number } | null = null;
    const builder: Record<string, unknown> = {};

    const registrar = (metodo: string) => (...args: unknown[]) => {
      chamadasRegistradas.push({ tabela, metodo, args });
      return builder;
    };

    builder.select = vi.fn(registrar('select'));
    builder.insert = vi.fn(registrar('insert'));
    builder.update = vi.fn(registrar('update'));
    builder.delete = vi.fn(registrar('delete'));
    builder.eq = vi.fn(registrar('eq'));
    builder.neq = vi.fn(registrar('neq'));
    builder.not = vi.fn(registrar('not'));
    builder.is = vi.fn(registrar('is'));
    builder.in = vi.fn(registrar('in'));
    builder.order = vi.fn(registrar('order'));
    builder.limit = vi.fn(registrar('limit'));
    builder.range = vi.fn((de: number, ate: number) => {
      rangeFatia = { de, ate };
      chamadasRegistradas.push({ tabela, metodo: 'range', args: [de, ate] });
      return builder;
    });

    builder.single = vi.fn(async () => {
      chamadasRegistradas.push({ tabela, metodo: 'single', args: [] });
      let data = resultado.data;
      if (Array.isArray(data)) {
        data = data[0] ?? null;
      }
      return {
        data: data ?? null,
        error: resultado.error ?? null,
        count: resultado.count ?? null,
      };
    });

    builder.maybeSingle = vi.fn(async () => {
      chamadasRegistradas.push({ tabela, metodo: 'maybeSingle', args: [] });
      if (tabela === 'perfis') {
        return {
          data: {
            id: usuarioSessao.id,
            escola_id: usuarioSessao.escola_id,
            papel: usuarioSessao.papel,
            nome: usuarioSessao.nome,
            ativo: usuarioSessao.ativo ?? true,
          },
          error: null,
          count: null,
        };
      }
      let data = resultado.data;
      if (Array.isArray(data)) {
        data = data[0] ?? null;
      }
      return {
        data: data ?? null,
        error: resultado.error ?? null,
        count: resultado.count ?? null,
      };
    });

    builder.then = (
      resolve: (val: { data: unknown; error: unknown; count: unknown }) => void,
      reject: (err: unknown) => void
    ) => {
      let dadosRetorno = resultado.data ?? null;
      if (Array.isArray(dadosRetorno) && rangeFatia !== null) {
        dadosRetorno = dadosRetorno.slice(rangeFatia.de, rangeFatia.ate + 1);
      }
      const contagem =
        resultado.count !== undefined && resultado.count !== null
          ? resultado.count
          : Array.isArray(resultado.data)
          ? resultado.data.length
          : null;

      return Promise.resolve({
        data: dadosRetorno,
        error: resultado.error ?? null,
        count: contagem,
      }).then(resolve, reject);
    };

    return builder;
  });

  const cliente = {
    auth,
    from,
  } as unknown as SupabaseClient;

  return { cliente, chamadasRegistradas, contadoresTabela, auth };
}

describe('BancoService Supabase (Fase 5.6)', () => {
  it('criarSupabaseBancoService instancia a classe corretamente', () => {
    const { cliente } = criarClienteSimulado();
    const service = criarSupabaseBancoService(cliente);
    expect(service).toBeInstanceOf(SupabaseBancoService);
  });

  describe('Sessão e Autenticação', () => {
    it('falha se a sessão estiver expirada', async () => {
      const { cliente, auth } = criarClienteSimulado();
      auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any);
      const service = new SupabaseBancoService(cliente);
      await expect(service.listarAssuntos('disc-1')).rejects.toThrow('Sessão expirada. Entre novamente.');
    });

    it('falha se o usuário estiver inativo', async () => {
      const { cliente } = criarClienteSimulado({}, {
        id: 'u-1',
        escola_id: 'esc-1',
        papel: 'professor',
        nome: 'Inativo',
        ativo: false,
      });
      const service = new SupabaseBancoService(cliente);
      await expect(service.listarAssuntos('disc-1')).rejects.toThrow('Usuário não encontrado ou inativo.');
    });
  });

  describe('Assuntos (Submatérias)', () => {
    it('listarAssuntos filtra escola_id, disciplina_id e deleted_at IS NULL', async () => {
      const assuntosMock = [
        { id: 'ass-1', nome: 'Álgebra', disciplina_id: 'disc-mat', escola_id: 'escola-1' },
        { id: 'ass-2', nome: 'Geometria', disciplina_id: 'disc-mat', escola_id: 'escola-1' },
      ];
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        assuntos: { data: assuntosMock },
      });
      const service = new SupabaseBancoService(cliente);
      const resultado = await service.listarAssuntos('disc-mat');

      expect(resultado).toEqual(assuntosMock);
      expect(chamadasRegistradas.some((c) => c.metodo === 'eq' && c.args[0] === 'disciplina_id' && c.args[1] === 'disc-mat')).toBe(true);
      expect(chamadasRegistradas.some((c) => c.metodo === 'is' && c.args[0] === 'deleted_at' && c.args[1] === null)).toBe(true);
    });

    it('criarAssunto valida nome não vazio e permissão do professor', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [] }, // não leciona
      });
      const service = new SupabaseBancoService(cliente);

      await expect(service.criarAssunto('disc-mat', '   ')).rejects.toThrow('O nome do assunto não pode ficar vazio.');
      await expect(service.criarAssunto('disc-mat', 'Álgebra')).rejects.toThrow('Você não leciona esta disciplina.');
    });

    it('criarAssunto valida unicidade case-insensitive e insere assunto', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1' }] },
        assuntos: [
          { data: [{ id: 'ass-1', nome: 'Álgebra' }] }, // existentes na 1ª chamada
          { data: [] }, // existentes na 2ª chamada (sem colisão)
          { data: { id: 'ass-2', nome: 'Geometria', disciplina_id: 'disc-mat', escola_id: 'escola-1' } }, // inserido na 2ª chamada
        ],
      });
      const service = new SupabaseBancoService(cliente);

      await expect(service.criarAssunto('disc-mat', 'álgebra')).rejects.toThrow(
        'Já existe um assunto com este nome para esta disciplina.'
      );

      const novo = await service.criarAssunto('disc-mat', 'Geometria');
      expect(novo.nome).toBe('Geometria');
      expect(chamadasRegistradas.some((c) => c.metodo === 'insert' && (c.args[0] as any).nome === 'Geometria')).toBe(true);
    });

    it('renomearAssunto valida existência, unicidade e renomeia', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1' }] },
        assuntos: [
          { data: { id: 'ass-1', disciplina_id: 'disc-mat', escola_id: 'escola-1' } }, // busca
          { data: [] }, // existentes
          { data: { id: 'ass-1', nome: 'Álgebra Linear', disciplina_id: 'disc-mat', escola_id: 'escola-1' } }, // update
        ],
      });
      const service = new SupabaseBancoService(cliente);

      const renomeado = await service.renomearAssunto('ass-1', 'Álgebra Linear');
      expect(renomeado.nome).toBe('Álgebra Linear');
    });

    it('excluirAssunto impede exclusão se houver questões vinculadas no banco ou atividades', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1' }] },
        assuntos: { data: { id: 'ass-1', disciplina_id: 'disc-mat' } },
        banco_questoes: { count: 3, data: [] }, // possui 3 questões
      });
      const service = new SupabaseBancoService(cliente);

      await expect(service.excluirAssunto('ass-1')).rejects.toThrow(
        'Não é possível excluir esta submatéria pois existem 3 questão(ões) vinculada(s) no Banco.'
      );
    });

    it('excluirAssunto realiza exclusão lógica com deleted_at se não houver vínculos', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1' }] },
        assuntos: [
          { data: { id: 'ass-1', disciplina_id: 'disc-mat' } }, // busca
          { data: null }, // update soft-delete
        ],
        banco_questoes: { count: 0, data: [] },
        questoes: { count: 0, data: [] },
      });
      const service = new SupabaseBancoService(cliente);

      await service.excluirAssunto('ass-1');
      expect(chamadasRegistradas.some((c) => c.tabela === 'assuntos' && c.metodo === 'update' && (c.args[0] as any).deleted_at)).toBe(true);
    });
  });

  describe('Paginação e Limite de 1000 Linhas do PostgREST', () => {
    it('contarQuestoesPorAssunto percorre páginas de 1000 linhas via .range()', async () => {
      // 1500 questões no total: 1000 do ass-1 e 500 do ass-2
      const questoesSimuladas = [
        ...Array.from({ length: 1000 }, (_, i) => ({ id: `q-${i}`, assunto_id: 'ass-1' })),
        ...Array.from({ length: 500 }, (_, i) => ({ id: `q-${1000 + i}`, assunto_id: 'ass-2' })),
      ];

      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        banco_questoes: { data: questoesSimuladas },
      });

      const service = new SupabaseBancoService(cliente);
      const contagem = await service.contarQuestoesPorAssunto('disc-mat');

      expect(contagem).toEqual({
        'ass-1': 1000,
        'ass-2': 500,
      });

      const ranges = chamadasRegistradas.filter((c) => c.tabela === 'banco_questoes' && c.metodo === 'range');
      expect(ranges.length).toBe(2);
      expect(ranges[0].args).toEqual([0, TAMANHO_PAGINA - 1]);
      expect(ranges[1].args).toEqual([TAMANHO_PAGINA, TAMANHO_PAGINA * 2 - 1]);
    });

    it('listarBanco lê mais de 1000 questões usando paginação e lerTudoPorIds', async () => {
      const questoesLinhas = Array.from({ length: 1050 }, (_, i) => ({
        id: `bq-${i}`,
        created_at: '2026-10-22T00:00:00Z',
        escola_id: 'escola-1',
        disciplina_id: 'disc-mat',
        assunto_id: 'ass-1',
        criado_por: 'prof-1',
        serie: '6º Ano',
        tipo: 'objetiva' as const,
        dificuldade: 'facil' as const,
        enunciado: `Questão ${i}`,
        imagem_url: null,
        dica: null,
        explicacao: null,
        resposta_esperada: null,
        origem: 'manual' as const,
        arquivada: false,
      }));

      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 'turma-1', disciplina_id: 'disc-mat' }] },
        turmas: { data: [{ id: 'turma-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: { data: questoesLinhas },
        banco_alternativas: { data: [] },
        assuntos: { data: [{ id: 'ass-1', nome: 'Álgebra' }] },
        disciplinas: { data: { id: 'disc-mat', nome: 'Matemática' } },
        perfis: { data: [{ id: 'prof-1', nome: 'Professora Ana' }] },
      });

      const service = new SupabaseBancoService(cliente);
      const lista = await service.listarBanco({
        disciplina_id: 'disc-mat',
        serie: '6º Ano',
      });

      expect(lista.length).toBe(1050);
      expect(lista[0].enunciado).toBe('Questão 0');
      expect(lista[1049].enunciado).toBe('Questão 1049');
      expect(lista[0].disciplina_nome).toBe('Matemática');
      expect(lista[0].assunto_nome).toBe('Álgebra');
    });
  });

  describe('Combinações do Professor e da Gestão', () => {
    it('professor só vê combinações das suas ofertas ativas no ano letivo atual', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: {
          data: [
            { id: 'of-1', turma_id: 'turma-1', disciplina_id: 'disc-mat' },
            { id: 'of-2', turma_id: 'turma-2', disciplina_id: 'disc-geo' },
          ],
        },
        turmas: {
          data: [
            { id: 'turma-1', serie: '6º Ano A', ativa: true, ano_letivo: 2026 },
            { id: 'turma-2', serie: '7º Ano B', ativa: true, ano_letivo: 2026 },
          ],
        },
        disciplinas: {
          data: [
            { id: 'disc-mat', nome: 'Matemática' },
            { id: 'disc-geo', nome: 'Geografia' },
          ],
        },
      });

      const service = new SupabaseBancoService(cliente);
      const combinacoes = await service.listarCombinacoesDoProfessor();

      expect(combinacoes).toHaveLength(2);
      expect(combinacoes[0].label).toBe('Geografia · 7º Ano B');
      expect(combinacoes[1].label).toBe('Matemática · 6º Ano A');
    });

    it('gestão vê todas as combinações ativas da escola no ano atual', async () => {
      const { cliente } = criarClienteSimulado(
        {
          turmas: {
            data: [
              { id: 'turma-1', serie: '6º Ano A', ativa: true, ano_letivo: 2026 },
            ],
          },
          disciplinas: {
            data: [
              { id: 'disc-mat', nome: 'Matemática' },
              { id: 'disc-por', nome: 'Português' },
            ],
          },
        },
        {
          id: 'gestor-1',
          escola_id: 'escola-1',
          papel: 'direcao',
          nome: 'Diretor Pedro',
        }
      );

      const service = new SupabaseBancoService(cliente);
      const combinacoes = await service.listarCombinacoesDoProfessor();

      expect(combinacoes).toHaveLength(2);
      expect(combinacoes.map((c) => c.label)).toEqual([
        'Matemática · 6º Ano A',
        'Português · 6º Ano A',
      ]);
    });
  });

  describe('Salvar Questão e Rollback Compensatório', () => {
    it('valida campos obrigatórios de questão objetiva (alternativas e por que errou)', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1', disciplina_id: 'disc-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
      });
      const service = new SupabaseBancoService(cliente);

      await expect(
        service.salvarQuestaoBanco({
          disciplina_id: 'disc-1',
          serie: '6º Ano',
          assunto_id: 'ass-1',
          dificuldade: 'medio',
          tipo: 'objetiva',
          enunciado: 'Quanto é 2 + 2?',
          alternativas: [
            { texto: '4', correta: true },
            { texto: '5', correta: false, por_que_errou: '' }, // sem por que errou
          ],
        })
      ).rejects.toThrow('deve conter a explicação do erro');
    });

    it('executa rollback apagando a questão criada caso a inserção de alternativas falhe', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1', disciplina_id: 'disc-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: {
          data: {
            id: 'bq-nova-123',
            escola_id: 'escola-1',
            disciplina_id: 'disc-1',
            assunto_id: 'ass-1',
            serie: '6º Ano',
            tipo: 'objetiva',
            dificuldade: 'facil',
            enunciado: 'Teste rollback',
          },
        },
        banco_alternativas: { error: { message: 'network timeout on alternatives insert' } },
      });

      const service = new SupabaseBancoService(cliente);

      await expect(
        service.salvarQuestaoBanco({
          disciplina_id: 'disc-1',
          serie: '6º Ano',
          assunto_id: 'ass-1',
          dificuldade: 'facil',
          tipo: 'objetiva',
          enunciado: 'Teste rollback',
          alternativas: [
            { texto: 'Certa', correta: true },
            { texto: 'Errada', correta: false, por_que_errou: 'Explicação' },
          ],
        })
      ).rejects.toThrow('Não foi possível salvar as alternativas da questão.');

      // Verifica se houve chamada compensatória delete na tabela banco_questoes com o id criado
      const deleteChamadas = chamadasRegistradas.filter(
        (c) => c.tabela === 'banco_questoes' && c.metodo === 'delete'
      );
      expect(deleteChamadas.length).toBeGreaterThan(0);
      const eqChamadas = chamadasRegistradas.filter(
        (c) => c.tabela === 'banco_questoes' && c.metodo === 'eq' && c.args[0] === 'id' && c.args[1] === 'bq-nova-123'
      );
      expect(eqChamadas.length).toBeGreaterThan(0);
    });

    it('edição de questão rejeita se não for o autor ou se estiver arquivada', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1', disciplina_id: 'disc-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: [
          { data: { id: 'bq-1', criado_por: 'outro-prof', arquivada: false } }, // outro autor
          { data: { id: 'bq-2', criado_por: 'prof-1', arquivada: true } }, // arquivada
        ],
      });

      const service = new SupabaseBancoService(cliente);

      await expect(
        service.salvarQuestaoBanco({
          id: 'bq-1',
          disciplina_id: 'disc-1',
          serie: '6º Ano',
          assunto_id: 'ass-1',
          dificuldade: 'medio',
          tipo: 'discursiva',
          enunciado: 'Enunciado editado',
          resposta_esperada: 'Resposta esperada',
        })
      ).rejects.toThrow('Apenas o autor pode editar esta questão.');

      await expect(
        service.salvarQuestaoBanco({
          id: 'bq-2',
          disciplina_id: 'disc-1',
          serie: '6º Ano',
          assunto_id: 'ass-1',
          dificuldade: 'medio',
          tipo: 'discursiva',
          enunciado: 'Enunciado editado',
          resposta_esperada: 'Resposta esperada',
        })
      ).rejects.toThrow('Esta questão está arquivada e não pode ser editada.');
    });
  });

  describe('Duplicação e Arquivamento', () => {
    it('duplicarQuestaoBanco clona a questão e suas alternativas gerando cópia vinculada ao usuário', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1', disciplina_id: 'disc-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: [
          {
            data: {
              id: 'bq-origem',
              disciplina_id: 'disc-1',
              assunto_id: 'ass-1',
              serie: '6º Ano',
              tipo: 'objetiva',
              dificuldade: 'medio',
              enunciado: 'Origem',
            },
          },
          {
            data: {
              id: 'bq-copia',
              disciplina_id: 'disc-1',
              assunto_id: 'ass-1',
              serie: '6º Ano',
              tipo: 'objetiva',
              dificuldade: 'medio',
              enunciado: 'Origem',
              criado_por: 'prof-1',
            },
          },
        ],
        banco_alternativas: [
          {
            data: [
              { letra: 'A', texto: 'Alternativa A', correta: true, por_que_errou: null },
              { letra: 'B', texto: 'Alternativa B', correta: false, por_que_errou: 'Erro' },
            ],
          },
          {
            data: [
              { id: 'alt-c1', banco_questao_id: 'bq-copia', letra: 'A', texto: 'Alternativa A', correta: true, por_que_errou: null },
              { id: 'alt-c2', banco_questao_id: 'bq-copia', letra: 'B', texto: 'Alternativa B', correta: false, por_que_errou: 'Erro' },
            ],
          },
        ],
        assuntos: { data: { nome: 'Assunto 1' } },
        disciplinas: { data: { nome: 'Matemática' } },
      });

      const service = new SupabaseBancoService(cliente);
      const copia = await service.duplicarQuestaoBanco('bq-origem');

      expect(copia.id).toBe('bq-copia');
      expect(copia.alternativas).toHaveLength(2);
      expect(chamadasRegistradas.some((c) => c.tabela === 'banco_questoes' && c.metodo === 'insert')).toBe(true);
    });

    it('arquivarQuestaoBanco atualiza arquivada = true e NÃO usa deleted_at', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        banco_questoes: [
          { data: { id: 'bq-1', criado_por: 'prof-1' } }, // busca
          { data: null }, // update
        ],
      });

      const service = new SupabaseBancoService(cliente);
      await service.arquivarQuestaoBanco('bq-1');

      const updateCall = chamadasRegistradas.find(
        (c) => c.tabela === 'banco_questoes' && c.metodo === 'update'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall?.args[0]).toEqual({ arquivada: true });
      expect(chamadasRegistradas.some((c) => c.tabela === 'banco_questoes' && (c.args[0] as any)?.deleted_at)).toBe(false);
    });
  });

  describe('Adicionar e Sortear Questões para Atividades', () => {
    it('adicionarDoBanco bloqueia se a atividade não estiver em rascunho', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: { data: { id: 'ativ-1', status: 'publicada', oferta_id: 'of-1' } },
      });

      const service = new SupabaseBancoService(cliente);
      await expect(service.adicionarDoBanco('ativ-1', ['bq-1'])).rejects.toThrow(
        'Não é permitido alterar questões de atividades publicadas ou encerradas.'
      );
    });

    it('adicionarDoBanco valida compatibilidade de matéria e série com a oferta', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: { data: { id: 'ativ-1', status: 'rascunho', oferta_id: 'of-1' } },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1', disciplina_id: 'disc-mat' } },
        turmas: { data: { id: 't-1', serie: '6º Ano' } },
        questoes: { data: [] },
        banco_questoes: {
          data: [
            { id: 'bq-1', disciplina_id: 'disc-outra', serie: '7º Ano', arquivada: false },
          ],
        },
      });

      const service = new SupabaseBancoService(cliente);
      await expect(service.adicionarDoBanco('ativ-1', ['bq-1'])).rejects.toThrow(
        'A questão do banco não pertence à mesma matéria e série desta atividade.'
      );
    });

    it('sortearDoBanco emite avisos quando o banco tem menos questões que o solicitado', async () => {
      const questoesDisponiveis = [
        { id: 'bq-f1', dificuldade: 'facil' as const },
        { id: 'bq-m1', dificuldade: 'medio' as const },
      ]; // 1 fácil, 1 média, 0 difíceis

      const { cliente } = criarClienteSimulado({
        atividades: { data: { id: 'ativ-1', status: 'rascunho', oferta_id: 'of-1' } },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1', disciplina_id: 'disc-mat' } },
        turmas: { data: { id: 't-1', serie: '6º Ano' } },
        questoes: [
          { data: [] }, // questões já existentes na atividade (para pular repetidas)
          { data: [] }, // ordem atual
          { data: { id: 'q-nova-1' } }, // inserção questão 1
          { data: { id: 'q-nova-2' } }, // inserção questão 2
        ],
        banco_questoes: [
          { data: questoesDisponiveis }, // busca para sorteio
          {
            data: [
              { id: 'bq-f1', disciplina_id: 'disc-mat', serie: '6º Ano', tipo: 'objetiva', dificuldade: 'facil', enunciado: 'Fácil' },
              { id: 'bq-m1', disciplina_id: 'disc-mat', serie: '6º Ano', tipo: 'objetiva', dificuldade: 'medio', enunciado: 'Média' },
            ],
          }, // busca em adicionarDoBanco
        ],
        banco_alternativas: { data: [] },
        alternativas: { data: [] },
      });

      const service = new SupabaseBancoService(cliente);
      const resultado = await service.sortearDoBanco('ativ-1', 'ass-1', {
        facil: 2, // pediu 2, só tem 1
        medio: 1, // pediu 1, tem 1
        dificil: 1, // pediu 1, tem 0
      });

      expect(resultado.adicionadas).toBe(2);
      expect(resultado.aviso).toContain('Só há 1 questão(ões) fácil(eis)');
      expect(resultado.aviso).toContain('Não há questões difíceis disponíveis');
    });

    it('sortearDoBanco escolhe ao acaso entre as elegíveis (muda com o gerador aleatório)', async () => {
      const escolhidasCom = async (aleatorio: number) => {
        const espiao = vi.spyOn(Math, 'random').mockReturnValue(aleatorio);
        try {
          const disponiveis = [
            { id: 'bq-f1', dificuldade: 'facil' as const },
            { id: 'bq-f2', dificuldade: 'facil' as const },
            { id: 'bq-f3', dificuldade: 'facil' as const },
          ];
          const { cliente, chamadasRegistradas } = criarClienteSimulado({
            atividades: { data: { id: 'ativ-1', status: 'rascunho', oferta_id: 'of-1' } },
            ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1', disciplina_id: 'disc-mat' } },
            turmas: { data: { id: 't-1', serie: '6º Ano' } },
            questoes: [{ data: [] }, { data: [] }, { data: { id: 'q-1' } }, { data: { id: 'q-2' } }, { data: { id: 'q-3' } }],
            banco_questoes: [
              { data: disponiveis },
              {
                data: disponiveis.map((d) => ({
                  ...d, disciplina_id: 'disc-mat', serie: '6º Ano', tipo: 'objetiva', enunciado: d.id,
                })),
              },
            ],
            banco_alternativas: { data: [] },
            alternativas: { data: [] },
          });
          await new SupabaseBancoService(cliente).sortearDoBanco('ativ-1', 'ass-1', { facil: 1, medio: 0, dificil: 0 });
          const busca = chamadasRegistradas.find(
            (c) => c.tabela === 'banco_questoes' && c.metodo === 'in' && c.args[0] === 'id'
          );
          return busca?.args[1];
        } finally {
          espiao.mockRestore();
        }
      };

      expect(await escolhidasCom(0.999)).toEqual(['bq-f1']); // sem trocas: a 1ª da lista
      expect(await escolhidasCom(0)).toEqual(['bq-f2']); // trocas para o início: outra questão
    });

    it('sortearDoBanco retorna adicionadas 0 e aviso quando nenhuma questão está disponível', async () => {
      const { cliente } = criarClienteSimulado({
        atividades: { data: { id: 'ativ-1', status: 'rascunho', oferta_id: 'of-1' } },
        ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1', disciplina_id: 'disc-mat' } },
        turmas: { data: { id: 't-1', serie: '6º Ano' } },
        questoes: { data: [] },
        banco_questoes: { data: [] }, // vazio
      });

      const service = new SupabaseBancoService(cliente);
      const resultado = await service.sortearDoBanco('ativ-1', 'ass-1', {
        facil: 2,
        medio: 2,
        dificil: 2,
      });

      expect(resultado.adicionadas).toBe(0);
      expect(resultado.aviso).toBeDefined();
    });
  });

  describe('Correções da revisão (5.9)', () => {
    it('se o desfazer também falhar, avisa que a questão pode ter ficado incompleta', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1', disciplina_id: 'disc-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: [
          { data: { id: 'bq-nova', escola_id: 'escola-1', disciplina_id: 'disc-1', assunto_id: 'ass-1', serie: '6º Ano' } },
          { error: { message: 'delete negado' } },
        ],
        banco_alternativas: { error: { message: 'timeout' } },
      });

      await expect(
        new SupabaseBancoService(cliente).salvarQuestaoBanco({
          disciplina_id: 'disc-1',
          serie: '6º Ano',
          assunto_id: 'ass-1',
          dificuldade: 'facil',
          tipo: 'objetiva',
          enunciado: 'Teste',
          alternativas: [
            { texto: 'Certa', correta: true },
            { texto: 'Errada', correta: false, por_que_errou: 'Explicação' },
          ],
        })
      ).rejects.toThrow('o desfazer também falhou');
    });

    it('criarAssunto com nome de um assunto excluído reativa o antigo (índice único inclui excluídos)', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1' }] },
        assuntos: [
          { data: [] }, // sem colisão entre os ativos
          { error: { message: 'duplicate key', code: '23505' } }, // insert esbarra no índice único
          { data: [{ id: 'ass-velho', nome: 'Frações', disciplina_id: 'disc-mat', escola_id: 'escola-1' }] }, // reativação
        ],
      });

      const assunto = await new SupabaseBancoService(cliente).criarAssunto('disc-mat', 'Frações');
      expect(assunto.id).toBe('ass-velho');
      const reativou = chamadasRegistradas.some(
        (c) => c.tabela === 'assuntos' && c.metodo === 'update' && (c.args[0] as { deleted_at: unknown }).deleted_at === null
      );
      expect(reativou).toBe(true);
    });

    it('listarBanco ordena por data de criação (mesma ordem do mock) e depois por id', async () => {
      const { cliente, chamadasRegistradas } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: { data: [] },
      });
      await new SupabaseBancoService(cliente).listarBanco({ disciplina_id: 'disc-1', serie: '6º Ano' } as never);
      const ordens = chamadasRegistradas
        .filter((c) => c.tabela === 'banco_questoes' && c.metodo === 'order')
        .map((c) => c.args[0]);
      expect(ordens).toEqual(['created_at', 'id']);
    });
  });

  describe('Tratamento e propagação de erros em português', () => {
    it('propaga erro amigável caso ocorra falha ao listar banco de questões', async () => {
      const { cliente } = criarClienteSimulado({
        ofertas: { data: [{ id: 'of-1', turma_id: 't-1', disciplina_id: 'disc-1' }] },
        turmas: { data: [{ id: 't-1', serie: '6º Ano', ativa: true, ano_letivo: 2026 }] },
        banco_questoes: { error: { message: 'relation banco_questoes does not exist' } },
      });

      const service = new SupabaseBancoService(cliente);
      await expect(
        service.listarBanco({ disciplina_id: 'disc-1', serie: '6º Ano' })
      ).rejects.toThrow('Não foi possível listar as questões do banco.');
    });
  });
});

