/**
 * Página da turma: listarAtividadesComContagem tem que dar as mesmas contagens que a tela fazia
 * antes (obterAtividade + listarCorrecoesPendentes por atividade), nas duas implementações.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resetDatabase, getDatabase } from '../mock/db';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { SupabaseProfessorService } from '../supabase/professor.supabase';

describe('listarAtividadesComContagem (mock) = conta antiga da tela', () => {
  const auth = new MockAuthService();
  const servico = new MockProfessorService();

  /** O que a tela calculava antes, chamando uma atividade por vez. */
  async function contaAntiga(ofertaId: string) {
    const atividades = await servico.listarAtividades(ofertaId);
    return Promise.all(
      atividades.map(async (ativ) => {
        const completa = await servico.obterAtividade(ativ.id);
        const pendentes =
          ativ.status !== 'rascunho' ? (await servico.listarCorrecoesPendentes(ativ.id)).length : 0;
        return { ...ativ, total_questoes: completa?.questoes.length ?? 0, pendentes_correcao: pendentes };
      })
    );
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

    it.each(['ana@demo.com', 'carlos@demo.com'])('contagens iguais em todas as turmas de %s', async (email) => {
      await auth.login(email, 'demo123');
      const ofertas = await servico.minhasOfertas();
      expect(ofertas.length).toBeGreaterThan(0);
      let totalQuestoes = 0;
      for (const oferta of ofertas) {
        const nova = await servico.listarAtividadesComContagem(oferta.id);
        expect(nova).toEqual(await contaAntiga(oferta.id));
        totalQuestoes += nova.reduce((s, a) => s + a.total_questoes, 0);
      }
      expect(totalQuestoes).toBeGreaterThan(0);
    });
  });

  it('a Ana (base ampliada) vê a 1 discursiva pendente; a direção vê as atividades com 0 pendentes', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { webdriver: false });
    try {
      await resetDatabase();
      await auth.login('ana@demo.com', 'demo123');
      const ofertas = await servico.minhasOfertas();
      const porOferta = new Map<string, number>();
      for (const o of ofertas) {
        const lista = await servico.listarAtividadesComContagem(o.id);
        porOferta.set(o.id, lista.reduce((s, a) => s + a.pendentes_correcao, 0));
      }
      expect([...porOferta.values()].reduce((s, n) => s + n, 0)).toBe(1);

      const ofertaComPendente = [...porOferta].find(([, n]) => n > 0)![0];
      await auth.login('direcao@demo.com', 'demo123');
      const daDirecao = await servico.listarAtividadesComContagem(ofertaComPendente);
      const db = await getDatabase();
      expect(daDirecao).toHaveLength(db.atividades.filter((a) => a.oferta_id === ofertaComPendente).length);
      expect(daDirecao.every((a) => a.pendentes_correcao === 0)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// Supabase: cliente falso que devolve, por tabela, as linhas configuradas
// ---------------------------------------------------------------------------

type Resultado = { data: unknown; error: { message: string } | null };

function clienteFalso(
  tabelas: Record<string, Resultado>,
  papel: 'professor' | 'direcao' = 'professor'
) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const perfil = { id: 'prof-1', escola_id: 'esc-1', papel, nome: 'Ana', ativo: true };

  const from = vi.fn((tabela: string) => {
    const resultado: Resultado =
      tabela === 'perfis' ? { data: perfil, error: null } : tabelas[tabela] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'is', 'in', 'order', 'range']) {
      builder[metodo] = (...args: unknown[]) => {
        chamadas.push({ tabela, metodo, args });
        return builder;
      };
    }
    builder.maybeSingle = async () => ({
      data: Array.isArray(resultado.data) ? resultado.data[0] ?? null : resultado.data,
      error: resultado.error,
    });
    builder.then = (ok: (v: Resultado) => void, falha: (e: unknown) => void) =>
      Promise.resolve(resultado).then(ok, falha);
    return builder;
  });

  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'prof-1' } } }, error: null }) },
    from,
  } as unknown as SupabaseClient;
  return { cliente, chamadas, from };
}

const ativ = (id: string, status: string) => ({
  id, created_at: '2026-03-01T00:00:00Z', oferta_id: 'of-1', periodo_id: 'per-1', titulo: id,
  descricao: '', prazo: null, modo: 'exercicio', status, criado_por: 'prof-1',
});

const tabelasBase: Record<string, Resultado> = {
  ofertas: { data: { id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' }, error: null },
  atividades: { data: [ativ('a-pub', 'publicada'), ativ('a-ras', 'rascunho'), ativ('a-enc', 'encerrada')], error: null },
  questoes: {
    data: [
      { id: 'q1', atividade_id: 'a-pub', tipo: 'objetiva' },
      { id: 'q2', atividade_id: 'a-pub', tipo: 'discursiva' },
      { id: 'q3', atividade_id: 'a-ras', tipo: 'discursiva' },
      { id: 'q4', atividade_id: 'a-enc', tipo: 'discursiva' },
    ],
    error: null,
  },
  respostas: {
    data: [
      { id: 'r1', questao_id: 'q2' },
      { id: 'r2', questao_id: 'q2' },
      { id: 'r3', questao_id: 'q4' },
    ],
    error: null,
  },
};

describe('listarAtividadesComContagem (Supabase)', () => {
  it('conta questões e pendências por atividade em 3 leituras, sem carregar alternativas', async () => {
    const { cliente, chamadas, from } = clienteFalso(tabelasBase);
    const lista = await new SupabaseProfessorService(cliente).listarAtividadesComContagem('of-1');

    expect(lista.map((a) => [a.id, a.total_questoes, a.pendentes_correcao])).toEqual([
      ['a-pub', 2, 2],
      ['a-ras', 1, 0],
      ['a-enc', 1, 1],
    ]);

    const tabelasLidas = from.mock.calls.map((c) => c[0]);
    expect(tabelasLidas).not.toContain('alternativas');
    expect(tabelasLidas.filter((t) => t === 'atividades')).toHaveLength(1);
    expect(tabelasLidas.filter((t) => t === 'questoes')).toHaveLength(1);
    expect(tabelasLidas.filter((t) => t === 'respostas')).toHaveLength(1);

    expect(chamadas).toContainEqual({ tabela: 'questoes', metodo: 'is', args: ['deleted_at', null] });
    expect(chamadas).toContainEqual({ tabela: 'respostas', metodo: 'eq', args: ['correcao', 'pendente'] });
    // Pendências só das discursivas de atividades fora do rascunho
    const inRespostas = chamadas.find((c) => c.tabela === 'respostas' && c.metodo === 'in');
    expect(inRespostas?.args).toEqual(['questao_id', ['q2', 'q4']]);
  });

  it('direção vê as contagens de questões, mas 0 pendências e não lê respostas', async () => {
    const { cliente, from } = clienteFalso(tabelasBase, 'direcao');
    const lista = await new SupabaseProfessorService(cliente).listarAtividadesComContagem('of-1');

    expect(lista.map((a) => a.total_questoes)).toEqual([2, 1, 1]);
    expect(lista.every((a) => a.pendentes_correcao === 0)).toBe(true);
    expect(from.mock.calls.map((c) => c[0])).not.toContain('respostas');
  });

  it('oferta sem atividades não lê questões nem respostas', async () => {
    const { cliente, from } = clienteFalso({ ...tabelasBase, atividades: { data: [], error: null } });
    expect(await new SupabaseProfessorService(cliente).listarAtividadesComContagem('of-1')).toEqual([]);
    expect(from.mock.calls.map((c) => c[0])).not.toContain('questoes');
  });

  it('professor de outra oferta é barrado', async () => {
    const { cliente } = clienteFalso({
      ...tabelasBase,
      ofertas: { data: { id: 'of-1', professor_id: 'prof-outro', turma_id: 't-1' }, error: null },
    });
    await expect(new SupabaseProfessorService(cliente).listarAtividadesComContagem('of-1')).rejects.toThrow(
      'Você não tem permissão para esta ação.'
    );
  });

  it.each([
    ['questoes', 'Não foi possível contar as questões das atividades.'],
    ['respostas', 'Não foi possível contar as correções pendentes.'],
  ])('erro do banco em %s vira mensagem em português (nunca contagem parcial)', async (tabela, mensagem) => {
    const { cliente } = clienteFalso({ ...tabelasBase, [tabela]: { data: null, error: { message: 'x' } } });
    await expect(new SupabaseProfessorService(cliente).listarAtividadesComContagem('of-1')).rejects.toThrow(
      mensagem
    );
  });
});
