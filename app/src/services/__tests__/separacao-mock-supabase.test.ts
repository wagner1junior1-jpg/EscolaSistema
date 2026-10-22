import { describe, it, expect } from 'vitest';
import { criarSupabaseAlunoService, criarSupabaseProfessorService } from '../supabase/stub';
import { obterStatusSincronizacao, assinarMudancas } from '../sincronizacao';
import { saveDatabase, getDatabase } from '../mock/db';

describe('Separação mock x Supabase (Fase 1)', () => {
  it('serviços Supabase falham com mensagem clara em vez de herdar o mock', async () => {
    await expect(criarSupabaseProfessorService().minhasOfertas()).rejects.toThrow(
      'ainda não foi implementado'
    );
    await expect(criarSupabaseAlunoService().login('a', '1')).rejects.toThrow('AlunoService.login');
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
