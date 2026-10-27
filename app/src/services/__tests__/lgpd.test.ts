/**
 * LGPD (Fase 8.2): exportar e apagar os dados de um aluno. Mock e Supabase (cliente falso).
 * A regra no banco (papel, escola, confirmação, cascata, registro) é testada no rls_teste.sql, seção 13.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase } from '../mock/db';
import { SupabaseGestaoService } from '../supabase/gestao.supabase';
import { nomeArquivoExportacao } from '@/features/gestao/components/ModalDadosAluno';

const ALUNO = 'aluno-7a-1';

describe('LGPD — mock', () => {
  const auth = new MockAuthService();
  const gestao = new MockGestaoService();
  const aluno = new MockAlunoService();

  beforeEach(async () => {
    await resetDatabase();
    await auth.logout();
  });

  it('coordenação exporta cadastro, turma, respostas e acesso, sem PIN nem gabarito', async () => {
    await aluno.login(ALUNO, '1420');
    await auth.login('coordenacao@demo.com', 'demo123');
    const dados = await gestao.exportarDadosAluno(ALUNO);
    const db = await getDatabase();

    expect(dados.formato).toBe('saberpontual-exportacao-aluno-v1');
    expect(dados.aluno.id).toBe(ALUNO);
    expect(dados.turma?.nome).toBeTruthy();
    expect(dados.respostas).toHaveLength(db.respostas.filter((r) => r.aluno_id === ALUNO).length);
    expect(dados.respostas.length).toBeGreaterThan(0);
    expect(dados.acesso).toMatchObject({ pin_cadastrado: true });
    expect(dados.acesso.entradas_guardadas).toBeGreaterThanOrEqual(1);

    const texto = JSON.stringify(dados);
    expect(texto).not.toMatch(/pin_hash|token|"correta"|por_que_errou|explicacao/);
    const hash = db.alunos.find((a) => a.id === ALUNO)!.pin_hash;
    expect(texto).not.toContain(hash);
  });

  it('professor não exporta nem apaga', async () => {
    await auth.login('ana@demo.com', 'demo123');
    await expect(gestao.exportarDadosAluno(ALUNO)).rejects.toThrow();
    await expect(gestao.apagarDadosAluno(ALUNO, 'x')).rejects.toThrow();
  });

  it('coordenação não apaga (só a direção)', async () => {
    await auth.login('coordenacao@demo.com', 'demo123');
    const nome = (await getDatabase()).alunos.find((a) => a.id === ALUNO)!.nome_completo;
    await expect(gestao.apagarDadosAluno(ALUNO, nome)).rejects.toThrow();
  });

  it('direção: nome errado não apaga; nome certo apaga o aluno e tudo dele', async () => {
    const { token } = await aluno.login(ALUNO, '1420');
    await auth.login('direcao@demo.com', 'demo123');
    let db = await getDatabase();
    const nome = db.alunos.find((a) => a.id === ALUNO)!.nome_completo;
    const respostasAntes = db.respostas.filter((r) => r.aluno_id === ALUNO).length;
    const outros = db.alunos.length - 1;

    await expect(gestao.apagarDadosAluno(ALUNO, 'Outro Nome')).rejects.toThrow('nome completo');
    expect((await getDatabase()).alunos.some((a) => a.id === ALUNO)).toBe(true);

    const r = await gestao.apagarDadosAluno(ALUNO, `  ${nome.toUpperCase()} `);
    expect(r.respostas).toBe(respostasAntes);

    db = await getDatabase();
    expect(db.alunos.some((a) => a.id === ALUNO)).toBe(false);
    expect(db.alunos).toHaveLength(outros);
    expect(db.respostas.some((x) => x.aluno_id === ALUNO)).toBe(false);
    expect(db.aluno_sessoes.some((x) => x.aluno_id === ALUNO)).toBe(false);
    expect(db.pin_tentativas.some((x) => x.aluno_id === ALUNO)).toBe(false);
    expect((db.aluno_observacoes || []).some((x) => x.aluno_id === ALUNO)).toBe(false);
    await expect(aluno.avisos(token)).rejects.toThrow();
  });
});

describe('LGPD — Supabase (cliente falso)', () => {
  function clienteRpc(resposta: { data: unknown; error: { message: string; code?: string } | null }) {
    const rpc = vi.fn(async () => resposta);
    return { cliente: { rpc } as unknown as SupabaseClient, rpc };
  }

  it('exportar chama a RPC da 0010', async () => {
    const dados = { formato: 'saberpontual-exportacao-aluno-v1' };
    const { cliente, rpc } = clienteRpc({ data: dados, error: null });
    expect(await new SupabaseGestaoService(cliente).exportarDadosAluno('a1')).toEqual(dados);
    expect(rpc).toHaveBeenCalledWith('exportar_dados_aluno', { p_aluno_id: 'a1' });
  });

  it('exportar sem permissão explica o motivo', async () => {
    const { cliente } = clienteRpc({ data: null, error: { message: 'x', code: '42501' } });
    await expect(new SupabaseGestaoService(cliente).exportarDadosAluno('a1')).rejects.toThrow('permissão');
  });

  it('apagar manda a confirmação e devolve as contagens', async () => {
    const { cliente, rpc } = clienteRpc({ data: { respostas: 12, observacoes: 1 }, error: null });
    expect(await new SupabaseGestaoService(cliente).apagarDadosAluno('a1', 'Lucas Souza')).toEqual({
      respostas: 12,
      observacoes: 1,
    });
    expect(rpc).toHaveBeenCalledWith('apagar_dados_aluno', { p_aluno_id: 'a1', p_confirmacao: 'Lucas Souza' });
  });

  it('apagar com confirmação errada mostra a mensagem do banco', async () => {
    const msg = 'Para apagar, digite o nome completo do aluno exatamente como está cadastrado.';
    const { cliente } = clienteRpc({ data: null, error: { message: msg, code: 'P0001' } });
    await expect(new SupabaseGestaoService(cliente).apagarDadosAluno('a1', 'x')).rejects.toThrow(msg);
  });

  it('apagar sem ser direção explica o motivo', async () => {
    const { cliente } = clienteRpc({ data: null, error: { message: 'x', code: '42501' } });
    await expect(new SupabaseGestaoService(cliente).apagarDadosAluno('a1', 'x')).rejects.toThrow('Só a direção');
  });
});

describe('LGPD — nome do arquivo exportado', () => {
  it('sem acento, sem espaço e com a data', () => {
    expect(nomeArquivoExportacao('João Ávila da Conceição', new Date('2026-10-27T12:00:00Z'))).toBe(
      'dados-aluno-joao-avila-da-conceicao-2026-10-27.json'
    );
    expect(nomeArquivoExportacao('   ', new Date('2026-10-27T12:00:00Z'))).toBe('dados-aluno-sem-nome-2026-10-27.json');
  });
});
