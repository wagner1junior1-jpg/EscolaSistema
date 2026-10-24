import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criarSupabaseIAService } from '../supabase/stub';
import { obterStatusSincronizacao, assinarMudancas } from '../sincronizacao';
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
