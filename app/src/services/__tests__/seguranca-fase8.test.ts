/**
 * Correções da revisão de segurança (Fase 8.1, docs/claude/auditoria-09-seguranca-fase-8-1.md):
 * código da turma forte e sem hífen obrigatório, PINs bloqueados visíveis para a equipe,
 * PIN novo destrava, "Sair" encerra a sessão. Mock e Supabase (cliente falso).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase } from '../mock/db';
import { SupabaseAlunoService } from '../supabase/aluno.supabase';
import { SupabaseGestaoService } from '../supabase/gestao.supabase';
import {
  gerarCodigoAcessoSugerido,
  codigoAcessoForte,
} from '@/features/gestao/components/GestaoTurmasSecao';

const ALUNO = 'aluno-7a-1';
const PIN = '1420';

describe('Fase 8.1 — mock', () => {
  const auth = new MockAuthService();
  const gestao = new MockGestaoService();
  const aluno = new MockAlunoService();

  beforeEach(async () => {
    await resetDatabase();
    await auth.logout();
  });

  async function errarPin(vezes: number) {
    for (let i = 0; i < vezes; i++) {
      await expect(aluno.login(ALUNO, '0000')).rejects.toThrow();
    }
  }

  it('código da turma vale sem hífen e sem espaço', async () => {
    const comHifen = await aluno.listarTurma('7A-MAT');
    expect(comHifen.length).toBeGreaterThan(0);
    expect(await aluno.listarTurma(' 7a mat ')).toEqual(comHifen);
    expect(await aluno.listarTurma('7AMAT')).toEqual(comHifen);
    await expect(aluno.listarTurma('-')).rejects.toThrow('não encontrada');
  });

  it('5 erros de PIN: a direção vê o aluno bloqueado até um horário', async () => {
    await errarPin(5);
    await auth.login('direcao@demo.com', 'demo123');
    const lista = await gestao.listarPinsBloqueados();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ aluno_id: ALUNO, motivo: 'temporario', turma_id: 'turma-7a' });
    const ate = new Date(lista[0].bloqueado_ate!).getTime();
    expect(ate).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(ate).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
  });

  it('4 erros não aparecem na lista', async () => {
    await errarPin(4);
    await auth.login('direcao@demo.com', 'demo123');
    expect(await gestao.listarPinsBloqueados()).toEqual([]);
  });

  it('professor só vê os bloqueados das suas turmas', async () => {
    // 6º B: só o Carlos leciona lá (a Ana não).
    const db = await getDatabase();
    const professoresDo6B = db.ofertas.filter((o) => o.turma_id === 'turma-6b').map((o) => o.professor_id);
    expect(professoresDo6B).toEqual(['usr-prof-carlos']);
    for (let i = 0; i < 5; i++) {
      await expect(aluno.login('aluno-6b-1', '0000')).rejects.toThrow();
    }

    await auth.login('carlos@demo.com', 'demo123');
    expect((await gestao.listarPinsBloqueados()).map((p) => p.aluno_id)).toEqual(['aluno-6b-1']);
    await auth.logout();
    await auth.login('ana@demo.com', 'demo123');
    expect(await gestao.listarPinsBloqueados()).toEqual([]);
  });

  it('PIN novo pela gestão destrava na hora e tira o aluno da lista', async () => {
    await errarPin(5);
    await expect(aluno.login(ALUNO, PIN)).rejects.toThrow('bloqueado');
    await auth.login('direcao@demo.com', 'demo123');
    const { pin_puro } = await gestao.gerarOuResetarPin(ALUNO, '2468');
    expect(pin_puro).toBe('2468');
    expect(await gestao.listarPinsBloqueados()).toEqual([]);
    await expect(aluno.login(ALUNO, '2468')).resolves.toMatchObject({ aluno: { id: ALUNO } });
  });

  it('sair encerra a sessão: o token deixa de valer', async () => {
    const { token } = await aluno.login(ALUNO, PIN);
    await expect(aluno.avisos(token)).resolves.toBeDefined();
    await aluno.sair(token);
    await expect(aluno.avisos(token)).rejects.toThrow('Sessão expirada');
    // sair de novo (token já encerrado) não dá erro
    await expect(aluno.sair(token)).resolves.toBeUndefined();
  });
});

describe('Fase 8.1 — Supabase (cliente falso)', () => {
  function clienteRpc(resposta: { data: unknown; error: { message: string } | null }) {
    const rpc = vi.fn(async () => resposta);
    return { cliente: { rpc } as unknown as SupabaseClient, rpc };
  }

  it('listarPinsBloqueados chama a RPC da 0009 e devolve a lista', async () => {
    const item = {
      aluno_id: 'a1', nome_completo: 'Lucas', numero_chamada: 3, turma_id: 't1',
      turma_nome: '6º Ano A', motivo: 'equipe', bloqueado_ate: null,
    };
    const { cliente, rpc } = clienteRpc({ data: [item], error: null });
    expect(await new SupabaseGestaoService(cliente).listarPinsBloqueados()).toEqual([item]);
    expect(rpc).toHaveBeenCalledWith('alunos_pin_bloqueado');
  });

  it('listarPinsBloqueados com erro do banco lança erro (nunca devolve lista vazia em silêncio)', async () => {
    const { cliente } = clienteRpc({ data: null, error: { message: 'function does not exist' } });
    await expect(new SupabaseGestaoService(cliente).listarPinsBloqueados()).rejects.toThrow(
      'Não foi possível consultar os PINs bloqueados.'
    );
  });

  it('sair chama aluno_sair com o token (data null é sucesso)', async () => {
    const { cliente, rpc } = clienteRpc({ data: null, error: null });
    await expect(new SupabaseAlunoService(cliente).sair('tok-123')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('aluno_sair', { p_token: 'tok-123' });
  });

  it('sair com erro do servidor lança erro', async () => {
    const { cliente } = clienteRpc({ data: null, error: { message: 'Sem conexão' } });
    await expect(new SupabaseAlunoService(cliente).sair('tok-123')).rejects.toThrow('Sem conexão');
  });
});

describe('Fase 8.1 — código de acesso da turma', () => {
  it('formato: série + letra + 8 caracteres sem letras/números que se confundem', () => {
    const codigo = gerarCodigoAcessoSugerido('7º Ano', '7º Ano A');
    expect(codigo).toMatch(/^7A-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(codigoAcessoForte(codigo)).toBe(true);
  });

  it('é aleatório (500 sugestões, nenhuma repetida) e usa o alfabeto todo', () => {
    const codigos = Array.from({ length: 500 }, () => gerarCodigoAcessoSugerido('6º Ano', '6º Ano B'));
    expect(new Set(codigos).size).toBe(500);
    const letras = new Set(codigos.join('').replace(/^6B-|-/g, '').split(''));
    expect(letras.size).toBeGreaterThanOrEqual(31);
  });

  it('códigos curtos do formato antigo não são aceitos como fortes', () => {
    expect(codigoAcessoForte('7A-MAT')).toBe(false);
    expect(codigoAcessoForte('7A-KRT')).toBe(false);
    expect(codigoAcessoForte('CIEN6B')).toBe(false);
    expect(codigoAcessoForte('7A-K3MQ-9XT2')).toBe(true);
  });
});
