/**
 * Ficha do aluno: as letras das alternativas (escolhida e correta) vêm na própria ficha.
 * Antes a tela carregava cada atividade completa só para descobrir essas letras.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resetDatabase, getDatabase } from '../mock/db';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { SupabaseProfessorService } from '../supabase/professor.supabase';
import type { FichaAluno, LetraAlternativa } from '@/lib/types';

describe('fichaAluno (mock): letras iguais às que a tela calculava', () => {
  const auth = new MockAuthService();
  const servico = new MockProfessorService();

  /** A conta antiga da tela: um mapa id -> letra montado com obterAtividade de cada atividade. */
  async function letrasAntigas(ficha: FichaAluno) {
    const mapa: Record<string, Record<string, LetraAlternativa>> = {};
    for (const ativ of ficha.atividades) {
      const completa = await servico.obterAtividade(ativ.atividade_id);
      mapa[ativ.atividade_id] = {};
      completa?.questoes.forEach((q) => q.alternativas.forEach((alt) => (mapa[ativ.atividade_id][alt.id] = alt.letra)));
    }
    const letra = (ativId: string, altId: string | null) => (altId ? mapa[ativId]?.[altId] || null : null);
    return ficha.atividades.flatMap((a) =>
      a.questoes.map((q) => [letra(a.atividade_id, q.alternativa_escolhida_id), letra(a.atividade_id, q.alternativa_correta_id)])
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

    it.each(['ana@demo.com', 'carlos@demo.com'])('mesmas letras nas fichas dos alunos de %s', async (email) => {
      await auth.login(email, 'demo123');
      const db = await getDatabase();
      let escolhidas = 0;
      for (const oferta of await servico.minhasOfertas()) {
        const alunos = db.alunos.filter((a) => a.turma_id === oferta.turma_id).slice(0, 6);
        for (const aluno of alunos) {
          const ficha = await servico.fichaAluno(oferta.id, aluno.id);
          const novas = ficha.atividades.flatMap((a) =>
            a.questoes.map((q) => [q.alternativa_escolhida_letra ?? null, q.alternativa_correta_letra ?? null])
          );
          expect(novas).toEqual(await letrasAntigas(ficha));
          escolhidas += novas.filter(([e]) => e !== null).length;
        }
      }
      expect(escolhidas).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Supabase: cliente falso; cada tabela devolve as linhas configuradas
// ---------------------------------------------------------------------------

function clienteFalso(tabelas: Record<string, unknown[]>) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const from = vi.fn((tabela: string) => {
    const linhas = tabelas[tabela] ?? [];
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'is', 'in', 'order', 'range', 'limit']) {
      builder[metodo] = (...args: unknown[]) => {
        chamadas.push({ tabela, metodo, args });
        return builder;
      };
    }
    builder.maybeSingle = async () => ({ data: linhas[0] ?? null, error: null });
    builder.then = (ok: (v: unknown) => void, falha: (e: unknown) => void) =>
      Promise.resolve({ data: linhas, error: null }).then(ok, falha);
    return builder;
  });
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'prof-1' } } }, error: null }) },
    from,
  } as unknown as SupabaseClient;
  return { cliente, chamadas, from };
}

describe('fichaAluno (Supabase)', () => {
  const tabelas = {
    perfis: [{ id: 'prof-1', escola_id: 'esc-1', papel: 'professor', nome: 'Ana', ativo: true }],
    alunos: [{ id: 'al-1', escola_id: 'esc-1', turma_id: 't-1', nome_completo: 'Lucas', numero_chamada: 1, ativo: true, created_at: '2026-01-01' }],
    ofertas: [{ id: 'of-1', professor_id: 'prof-1', turma_id: 't-1', disciplina_id: 'd-1' }],
    turmas: [{ id: 't-1', nome: '6º Ano A', escola_id: 'esc-1' }],
    disciplinas: [{ id: 'd-1', nome: 'Matemática' }],
    periodos: [{ id: 'per-1', ativo: true }],
    atividades: [{ id: 'a-1', created_at: '2026-03-01', titulo: 'Frações', modo: 'exercicio', status: 'publicada', oferta_id: 'of-1', periodo_id: 'per-1' }],
    questoes: [
      { id: 'q2', atividade_id: 'a-1', ordem: 2, enunciado: '2+2', tipo: 'objetiva' },
      { id: 'q1', atividade_id: 'a-1', ordem: 1, enunciado: '1+1', tipo: 'objetiva' },
    ],
    alternativas: [
      { id: 'alt-1a', questao_id: 'q1', correta: false, letra: 'A' },
      { id: 'alt-1b', questao_id: 'q1', correta: true, letra: 'B' },
      { id: 'alt-2a', questao_id: 'q2', correta: true, letra: 'A' },
      { id: 'alt-2c', questao_id: 'q2', correta: false, letra: 'C' },
    ],
    respostas: [
      { id: 'r1', aluno_id: 'al-1', questao_id: 'q1', alternativa_id: 'alt-1a', acertou: false, tentativas: 1, acertou_final: false, texto_resposta: null, correcao: null, pontuacao: null, comentario_professor: null },
    ],
    aluno_observacoes: [],
  };

  it('traz a letra escolhida e a correta, com as questões na ordem', async () => {
    const { cliente } = clienteFalso(tabelas);
    const ficha = await new SupabaseProfessorService(cliente).fichaAluno('of-1', 'al-1');
    const qs = ficha.atividades[0].questoes;
    expect(qs.map((q) => [q.ordem, q.alternativa_escolhida_letra, q.alternativa_correta_letra])).toEqual([
      [1, 'A', 'B'],
      [2, null, 'A'],
    ]);
    expect(ficha.desempenho_materias).toHaveLength(1);
    expect(ficha.observacoes).toEqual([]);
  });

  it('não lê nada por atividade: alternativas com letra numa leitura só', async () => {
    const { cliente, chamadas, from } = clienteFalso(tabelas);
    await new SupabaseProfessorService(cliente).fichaAluno('of-1', 'al-1');
    const lidas = from.mock.calls.map((c) => c[0]);
    expect(lidas.filter((t) => t === 'alternativas')).toHaveLength(1);
    // 1 da ficha + 1 do desempenho por matérias
    expect(lidas.filter((t) => t === 'atividades')).toHaveLength(2);
    const selectAlt = chamadas.find((c) => c.tabela === 'alternativas' && c.metodo === 'select');
    expect(String(selectAlt?.args[0])).toContain('letra');
  });

  it('erro numa leitura paralela vira a mensagem em português', async () => {
    const { cliente, from } = clienteFalso(tabelas);
    const original = from.getMockImplementation()!;
    from.mockImplementation((tabela: string) => {
      const b = original(tabela) as Record<string, unknown>;
      if (tabela === 'disciplinas') {
        b.maybeSingle = async () => ({ data: null, error: { message: 'x' } });
      }
      return b;
    });
    await expect(new SupabaseProfessorService(cliente).fichaAluno('of-1', 'al-1')).rejects.toThrow(
      'Não foi possível carregar os dados da disciplina.'
    );
  });
});
