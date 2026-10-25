/**
 * Painel do professor: o caminho do Supabase (snapshot da RPC + conta pura) tem que dar EXATAMENTE
 * o mesmo resultado que o caminho do mock (a conta antiga, chamando os métodos do serviço).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resetDatabase, getDatabase } from '../mock/db';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { SupabaseProfessorService } from '../supabase/professor.supabase';
import {
  calcularPainelProfessor,
  montarPainelPorChamadas,
  type DadosPainelProfessor,
} from '../painel-professor';
import type { Atividade } from '@/lib/types';

/** O que a RPC professor_painel_dados devolveria para as ofertas do usuário logado. */
async function snapshotDoMock(servico: MockProfessorService): Promise<DadosPainelProfessor> {
  const db = await getDatabase();
  const ofertas = await servico.minhasOfertas();
  const idsOfertas = new Set(ofertas.map((o) => o.id));
  const idsTurmas = new Set(ofertas.map((o) => o.turma_id));
  const atividades = db.atividades.filter((a) => idsOfertas.has(a.oferta_id)) as Atividade[];
  const abertas = new Set(
    atividades.filter((a) => a.status === 'publicada' || a.status === 'encerrada').map((a) => a.id)
  );
  const questoes = db.questoes
    .filter((q) => abertas.has(q.atividade_id))
    .map((q) => ({ id: q.id, atividade_id: q.atividade_id, tipo: q.tipo || ('objetiva' as const) }));
  const idsQuestoes = new Set(questoes.map((q) => q.id));
  return {
    ofertas,
    atividades,
    alunos: db.alunos
      .filter((a) => idsTurmas.has(a.turma_id) && a.ativo)
      .map((a) => ({ id: a.id, turma_id: a.turma_id, nome_completo: a.nome_completo, numero_chamada: a.numero_chamada })),
    questoes,
    respostas: db.respostas
      .filter((r) => idsQuestoes.has(r.questao_id))
      .map((r) => ({
        id: r.id,
        aluno_id: r.aluno_id,
        questao_id: r.questao_id,
        acertou: r.acertou ?? null,
        pontuacao: r.pontuacao ?? null,
        correcao: r.correcao ?? null,
      })),
  };
}

const HOJE = new Date(2026, 8, 20); // data fixa: os prazos do seed são relativos ao dia em que o seed é criado

describe('Painel do professor: Supabase (snapshot) = mock (chamadas)', () => {
  const auth = new MockAuthService();
  const servico = new MockProfessorService();

  async function comparar(email: string) {
    await auth.login(email, 'demo123');
    const db = await getDatabase();
    const periodo = db.periodos.find((p) => p.ativo) || db.periodos[0];
    const porChamadas = await montarPainelPorChamadas(servico, periodo.id, HOJE);
    const porSnapshot = calcularPainelProfessor(
      await snapshotDoMock(servico),
      { id: periodo.id, nome: periodo.nome },
      HOJE
    );
    return { porChamadas, porSnapshot };
  }

  describe.each([
    ['base pequena (testes)', false],
    ['base ampliada (a que o seed grava)', true],
  ])('%s', (_nome, ampliada) => {
    beforeEach(async () => {
      if (ampliada) {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubGlobal('navigator', { webdriver: false });
      }
      await resetDatabase();
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    // (O mock só abre este painel para professor; o acesso da direção é testado no SQL, rls_teste.sql.)
    it.each(['ana@demo.com', 'carlos@demo.com'])('painel igual para %s', async (email) => {
      const { porChamadas, porSnapshot } = await comparar(email);
      expect(porSnapshot).toEqual(porChamadas);
      expect(porSnapshot.ofertas.length).toBeGreaterThan(0);
    });

    it('as contagens fecham: rascunhos + publicadas + encerradas = total de cada oferta', async () => {
      const { porSnapshot } = await comparar('ana@demo.com');
      for (const o of porSnapshot.ofertas) {
        expect(o.totalRascunhos + o.totalPublicadas + o.totalEncerradas).toBe(o.totalGeral);
      }
    });
  });

  it('a Ana (base ampliada) tem 1 correção pendente de discursiva, igual ao painel que o professor vê', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { webdriver: false });
    try {
      await resetDatabase();
      const { porSnapshot } = await comparar('ana@demo.com');
      const pendentes = porSnapshot.ofertas.reduce((s, o) => s + o.totalPendentesCorrecao, 0);
      expect(pendentes).toBe(1);
      expect(porSnapshot.ofertas.some((o) => o.primeiraAtividadeComPendenteId)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

describe('calcularPainelProfessor: casos de borda', () => {
  const oferta = {
    id: 'of1', created_at: '2026-01-01T00:00:00Z', turma_id: 't1', disciplina_id: 'd1', professor_id: 'p1',
    turma_nome: '7A', turma_codigo: 'X', disciplina_nome: 'Mat', professor_nome: 'Ana', turma_serie: '7º Ano',
  };
  const ativ = (id: string, over: Partial<Atividade> = {}): Atividade => ({
    id, created_at: '2026-03-01T00:00:00Z', oferta_id: 'of1', periodo_id: 'per1', titulo: id, descricao: '',
    prazo: null, modo: 'exercicio', status: 'publicada', criado_por: 'p1', ...over,
  });
  const base: DadosPainelProfessor = {
    ofertas: [oferta], atividades: [], alunos: [{ id: 'al1', turma_id: 't1', nome_completo: 'Zé', numero_chamada: 1 }],
    questoes: [], respostas: [],
  };

  it('sem período não calcula alunos em atenção nem total de alunos', () => {
    const r = calcularPainelProfessor({ ...base, atividades: [ativ('a1')] }, null, HOJE);
    expect(r.alunosEmAtencao).toEqual([]);
    expect(r.totalAlunos).toBe(0);
    expect(r.ofertas[0].totalPublicadas).toBe(1);
  });

  it('prazo: hoje e até 4 dias entram; ontem e 5 dias não; só atividade publicada', () => {
    const dia = (n: number) => {
      const d = new Date(HOJE);
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const r = calcularPainelProfessor(
      {
        ...base,
        atividades: [
          ativ('ontem', { prazo: dia(-1) }),
          ativ('hoje', { prazo: dia(0) }),
          ativ('quatro', { prazo: dia(4) }),
          ativ('cinco', { prazo: dia(5) }),
          ativ('encerrada', { prazo: dia(1), status: 'encerrada' }),
          ativ('rascunho', { prazo: dia(1), status: 'rascunho' }),
        ],
      },
      null,
      HOJE
    );
    expect(r.atividadesPrazoProximo.map((p) => [p.id, p.diasRestantes])).toEqual([
      ['hoje', 0],
      ['quatro', 4],
    ]);
  });

  it('pendente de questão objetiva não conta como correção; de rascunho também não', () => {
    const dados: DadosPainelProfessor = {
      ...base,
      atividades: [ativ('pub'), ativ('ras', { status: 'rascunho' })],
      questoes: [
        { id: 'qobj', atividade_id: 'pub', tipo: 'objetiva' },
        { id: 'qras', atividade_id: 'ras', tipo: 'discursiva' },
      ],
      respostas: [
        { id: 'r1', aluno_id: 'al1', questao_id: 'qobj', acertou: null, pontuacao: null, correcao: 'pendente' },
        { id: 'r2', aluno_id: 'al1', questao_id: 'qras', acertou: null, pontuacao: null, correcao: 'pendente' },
      ],
    };
    const r = calcularPainelProfessor(dados, null, HOJE);
    expect(r.ofertas[0].totalPendentesCorrecao).toBe(0);
    expect(r.ofertas[0].primeiraAtividadeComPendenteId).toBeNull();
  });

  it('só o período pedido entra no desempenho: atividade ruim de outro bimestre não põe o aluno em atenção', () => {
    const dados: DadosPainelProfessor = {
      ...base,
      atividades: [ativ('outroBim', { periodo_id: 'per2' }), ativ('bimAtual', { periodo_id: 'per1' })],
      questoes: [
        { id: 'q1', atividade_id: 'outroBim', tipo: 'objetiva' },
        { id: 'q2', atividade_id: 'bimAtual', tipo: 'objetiva' },
      ],
      respostas: [
        { id: 'r1', aluno_id: 'al1', questao_id: 'q1', acertou: false, pontuacao: null, correcao: null },
        { id: 'r2', aluno_id: 'al1', questao_id: 'q2', acertou: true, pontuacao: null, correcao: null },
      ],
    };
    const r = calcularPainelProfessor(dados, { id: 'per1', nome: '3º Bimestre' }, HOJE);
    expect(r.alunosEmAtencao).toEqual([]);
    expect(r.totalAlunos).toBe(1);
    const r2 = calcularPainelProfessor(dados, { id: 'per2', nome: '2º Bimestre' }, HOJE);
    expect(r2.alunosEmAtencao.map((a) => a.aluno_id)).toEqual(['al1']);
  });

  it('discursiva pendente de atividade encerrada conta; de rascunho não', () => {
    const dados: DadosPainelProfessor = {
      ...base,
      atividades: [ativ('enc', { status: 'encerrada' }), ativ('ras', { status: 'rascunho' })],
      questoes: [{ id: 'q1', atividade_id: 'enc', tipo: 'discursiva' }],
      respostas: [
        { id: 'r1', aluno_id: 'al1', questao_id: 'q1', acertou: null, pontuacao: null, correcao: 'pendente' },
      ],
    };
    const r = calcularPainelProfessor(dados, null, HOJE);
    expect(r.ofertas[0].totalPendentesCorrecao).toBe(1);
    expect(r.ofertas[0].primeiraAtividadeComPendenteId).toBe('enc');
  });
});

describe('SupabaseProfessorService.painelProfessor: uma RPC e nada de leituras por oferta', () => {
  function clienteFalso(rpcResposta: { data: unknown; error: { message: string } | null }) {
    const tabelasLidas: string[] = [];
    const from = vi.fn((tabela: string) => {
      tabelasLidas.push(tabela);
      const dados =
        tabela === 'perfis'
          ? { id: 'p1', escola_id: 'e1', papel: 'professor', nome: 'Ana', ativo: true }
          : { id: 'per1', nome: '3º Bimestre' };
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => ({ data: dados, error: null });
      return b;
    });
    const rpc = vi.fn(async () => rpcResposta);
    const cliente = {
      auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'p1' } } }, error: null })) },
      from,
      rpc,
    } as unknown as SupabaseClient;
    return { cliente, rpc, tabelasLidas };
  }

  const snapshot: DadosPainelProfessor = {
    ofertas: [
      { id: 'of1', created_at: '2026-01-01T00:00:00Z', turma_id: 't1', disciplina_id: 'd1', professor_id: 'p1',
        turma_nome: '7A', turma_codigo: 'X', disciplina_nome: 'Mat', professor_nome: 'Ana', turma_serie: '7º Ano' },
    ],
    atividades: [], alunos: [], questoes: [], respostas: [],
  };

  it('chama a RPC uma vez e só lê perfis e o período (nada de ofertas/atividades)', async () => {
    const { cliente, rpc, tabelasLidas } = clienteFalso({ data: snapshot, error: null });
    const painel = await new SupabaseProfessorService(cliente).painelProfessor('per1');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('professor_painel_dados');
    expect(tabelasLidas.sort()).toEqual(['perfis', 'periodos']);
    expect(painel.ofertas).toHaveLength(1);
    expect(painel.ofertas[0].totalGeral).toBe(0);
  });

  it('sem período não consulta a tabela de períodos', async () => {
    const { cliente, tabelasLidas } = clienteFalso({ data: snapshot, error: null });
    await new SupabaseProfessorService(cliente).painelProfessor(null);
    expect(tabelasLidas).toEqual(['perfis']);
  });

  it('erro da RPC vira mensagem em português (nunca painel vazio em silêncio)', async () => {
    const { cliente } = clienteFalso({ data: null, error: { message: 'boom' } });
    await expect(new SupabaseProfessorService(cliente).painelProfessor('per1')).rejects.toThrow(
      'Não foi possível carregar o painel do professor.'
    );
  });

  it('resposta sem o formato esperado também é erro', async () => {
    const { cliente } = clienteFalso({ data: { foo: 1 }, error: null });
    await expect(new SupabaseProfessorService(cliente).painelProfessor(null)).rejects.toThrow(
      'Não foi possível carregar o painel do professor.'
    );
  });
});
