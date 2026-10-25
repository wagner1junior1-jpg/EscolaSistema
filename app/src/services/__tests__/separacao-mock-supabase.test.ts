import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarSupabaseIAService } from '../supabase/stub';
import { obterStatusSincronizacao, assinarMudancas, criarFonteSupabase } from '../sincronizacao';
import { saveDatabase, getDatabase } from '../mock/db';

describe('Separação mock x Supabase (Fase 1)', () => {
  it('serviço Supabase não herda o mock: fala com o servidor e falha se ele falhar', async () => {
    const invoke = vi.fn(async () => ({ data: null, error: new Error('FunctionsFetchError') }));
    const cliente = { functions: { invoke } } as unknown as SupabaseClient;
    await expect(criarSupabaseIAService(cliente).consultarCota()).rejects.toThrow(
      'Não foi possível concluir a operação'
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('fonte de sincronização do Supabase: sempre conectada, e o botão de atualizar avisa as telas', async () => {
    const hora = new Date('2026-10-25T10:00:00Z');
    const fonte = criarFonteSupabase(() => hora);
    expect(fonte.obterStatus()).toMatchObject({ status: 'conectado', origem: 'supabase', ultimaSincronizacao: null });

    const status: string[] = [];
    const desassinarStatus = fonte.assinarStatus((i) => status.push(i.status));
    let recargas = 0;
    const desassinarMudancas = fonte.assinarMudancas(() => {
      recargas += 1;
    });

    await fonte.forcar();
    expect(recargas).toBe(1);
    expect(status).toEqual(['conectado', 'sincronizando', 'conectado']);
    expect(fonte.obterStatus().ultimaSincronizacao).toEqual(hora);

    desassinarMudancas();
    desassinarStatus();
    await fonte.forcar();
    expect(recargas).toBe(1); // quem saiu não é mais avisado
    expect(status).toHaveLength(3);
  });

  it('se uma tela falhar ao recarregar, o selo não fica preso em "sincronizando"', async () => {
    const fonte = criarFonteSupabase();
    fonte.assinarMudancas(() => {
      throw new Error('tela quebrou');
    });
    await expect(fonte.forcar()).rejects.toThrow('tela quebrou');
    expect(fonte.obterStatus().status).toBe('conectado');
  });

  it('interface única de sincronização usa o mock por padrão', async () => {
    expect(obterStatusSincronizacao().origem).toBe('mock');
    let chamadas = 0;
    const desassinar = assinarMudancas(() => {
      chamadas += 1;
    });
    saveDatabase(await getDatabase());
    desassinar();
    expect(chamadas).toBeGreaterThan(0);
  });
});
