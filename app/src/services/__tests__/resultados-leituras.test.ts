import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseProfessorService } from '../supabase/professor.supabase';

/**
 * A tela de resultados da atividade chama, de uma vez, obterAtividade, mapaDeCalor,
 * listarCorrecoesPendentes e listarCorrecoesFeitas. Cada um lia a atividade e as questões
 * sozinho (18 requisições). Agora as leituras iguais em andamento são uma só.
 */

type Linha = Record<string, unknown>;

/** Banco em memória: aplica eq/neq/is/in/not e range, e responde depois de um tique (como a rede). */
function clienteEmMemoria(tabelas: Record<string, Linha[]>) {
  const leituras: Record<string, number> = {};

  const from = (tabela: string) => {
    const filtros: ((l: Linha) => boolean)[] = [];
    let faixa: [number, number] | null = null;
    const executar = () => {
      leituras[tabela] = (leituras[tabela] ?? 0) + 1;
      let linhas = (tabelas[tabela] ?? []).filter((l) => filtros.every((f) => f(l)));
      if (faixa) linhas = linhas.slice(faixa[0], faixa[1] + 1);
      return new Promise<{ data: Linha[]; error: null }>((ok) =>
        setTimeout(() => ok({ data: JSON.parse(JSON.stringify(linhas)), error: null }), 0)
      );
    };
    const q: Record<string, unknown> = {
      select: () => q,
      order: () => q,
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
      neq: (c: string, v: unknown) => (filtros.push((l) => l[c] !== v), q),
      is: (c: string, v: unknown) => (filtros.push((l) => (l[c] ?? null) === v), q),
      in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), q),
      not: (c: string, _op: string, v: unknown) => (filtros.push((l) => (l[c] ?? null) !== v), q),
      range: (de: number, ate: number) => ((faixa = [de, ate]), q),
      maybeSingle: async () => {
        const { data } = await executar();
        return { data: data[0] ?? null, error: null };
      },
      then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => executar().then(ok, falha),
    };
    return q;
  };

  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'prof-1' } } }, error: null }) },
    from,
  } as unknown as SupabaseClient;
  return { cliente, leituras };
}

const tabelas = (): Record<string, Linha[]> => ({
  perfis: [{ id: 'prof-1', escola_id: 'esc-1', papel: 'professor', nome: 'Ana', ativo: true }],
  ofertas: [{ id: 'of-1', professor_id: 'prof-1', turma_id: 't-1' }],
  atividades: [
    {
      id: 'ativ-1', created_at: '2026-10-01T10:00:00Z', oferta_id: 'of-1', periodo_id: 'per-1',
      titulo: 'Frações', descricao: '', prazo: null, modo: 'exercicio', status: 'publicada', criado_por: 'prof-1',
    },
  ],
  questoes: [
    { id: 'q-1', atividade_id: 'ativ-1', ordem: 1, tipo: 'objetiva', dificuldade: 'facil', enunciado: '1/2 + 1/2?', explicacao: 'soma', resposta_esperada: null },
    { id: 'q-2', atividade_id: 'ativ-1', ordem: 2, tipo: 'discursiva', dificuldade: 'media', enunciado: 'Explique', explicacao: null, resposta_esperada: 'metades' },
    { id: 'q-x', atividade_id: 'ativ-outra', ordem: 1, tipo: 'objetiva', dificuldade: 'facil', enunciado: 'outra', explicacao: null, resposta_esperada: null },
  ],
  alternativas: [
    { id: 'a-1', updated_at: '2026-10-01T10:00:00Z', questao_id: 'q-1', letra: 'A', texto: '1', correta: true, por_que_errou: null },
    { id: 'a-2', updated_at: '2026-10-01T10:00:00Z', questao_id: 'q-1', letra: 'B', texto: '2', correta: false, por_que_errou: 'somou os denominadores' },
  ],
  respostas: [
    { id: 'r-1', aluno_id: 'al-1', questao_id: 'q-1', alternativa_id: 'a-2', acertou: false, tentativas: 1, respondida_em: '2026-10-02T10:00:00Z' },
    { id: 'r-2', aluno_id: 'al-1', questao_id: 'q-2', texto_resposta: 'meio', correcao: 'pendente', respondida_em: '2026-10-02T10:01:00Z' },
    { id: 'r-3', aluno_id: 'al-2', questao_id: 'q-2', texto_resposta: 'metades', correcao: 'certo', pontuacao: 1, corrigido_em: '2026-10-03T10:00:00Z', respondida_em: '2026-10-02T11:00:00Z' },
  ],
  alunos: [
    { id: 'al-1', nome_completo: 'Lucas Fictício' },
    { id: 'al-2', nome_completo: 'Beatriz Fictícia' },
  ],
});

function carregarTela(servico: SupabaseProfessorService) {
  return Promise.all([
    servico.obterAtividade('ativ-1'),
    servico.mapaDeCalor('ativ-1'),
    servico.listarCorrecoesPendentes('ativ-1'),
    servico.listarCorrecoesFeitas('ativ-1'),
  ]);
}

describe('tela de resultados da atividade (Supabase): leituras compartilhadas', () => {
  it('lê a atividade, as questões e as alternativas UMA vez cada', async () => {
    const { cliente, leituras } = clienteEmMemoria(tabelas());
    await carregarTela(new SupabaseProfessorService(cliente));
    expect(leituras.atividades).toBe(1);
    expect(leituras.questoes).toBe(1);
    expect(leituras.alternativas).toBe(1);
  });

  it('dá o mesmo resultado que chamar cada método sozinho', async () => {
    const juntos = await carregarTela(new SupabaseProfessorService(clienteEmMemoria(tabelas()).cliente));

    const sozinhos = [];
    for (const chamar of [
      (s: SupabaseProfessorService) => s.obterAtividade('ativ-1'),
      (s: SupabaseProfessorService) => s.mapaDeCalor('ativ-1'),
      (s: SupabaseProfessorService) => s.listarCorrecoesPendentes('ativ-1'),
      (s: SupabaseProfessorService) => s.listarCorrecoesFeitas('ativ-1'),
    ]) {
      sozinhos.push(await chamar(new SupabaseProfessorService(clienteEmMemoria(tabelas()).cliente)));
    }
    expect(juntos).toEqual(sozinhos);

    const [atividade, mapa, pendentes, feitas] = juntos;
    expect(atividade!.questoes.map((q) => q.id)).toEqual(['q-1', 'q-2']);
    expect(atividade!.questoes[0].alternativas.map((a) => a.letra)).toEqual(['A', 'B']);
    expect(mapa.total_alunos_responderam).toBe(2);
    expect(pendentes.map((p) => p.resposta_id)).toEqual(['r-2']);
    expect(feitas.map((f) => [f.resposta_id, f.nota])).toEqual([['r-3', 100]]);
  });

  it('ao recarregar a tela (depois de corrigir), lê tudo de novo: nada velho fica guardado', async () => {
    const dados = tabelas();
    const { cliente, leituras } = clienteEmMemoria(dados);
    const servico = new SupabaseProfessorService(cliente);
    await carregarTela(servico);

    dados.respostas[1].correcao = 'parcial';
    dados.respostas[1].corrigido_em = '2026-10-04T10:00:00Z';
    const [, , pendentes, feitas] = await carregarTela(servico);

    expect(leituras.questoes).toBe(2);
    expect(pendentes).toEqual([]);
    expect(feitas.map((f) => f.resposta_id).sort()).toEqual(['r-2', 'r-3']);
  });
});
