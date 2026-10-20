/**
 * SaberPontual — Ponto Central de Serviços
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seção 7.1)
 * Seleciona a implementação com base em VITE_DATA_SOURCE ('mock' | 'supabase').
 */

import {
  AuthService,
  GestaoService,
  ProfessorService,
  AlunoService,
  RelatorioService,
  BancoService,
  ServicoIA,
} from './contracts';

import {
  MockAuthService,
  MockGestaoService,
  MockProfessorService,
  MockAlunoService,
  MockRelatorioService,
  MockBancoService,
  MockIAService,
} from './mock';

import {
  criarSupabaseAuthService,
  criarSupabaseGestaoService,
  criarSupabaseProfessorService,
  criarSupabaseAlunoService,
  criarSupabaseRelatorioService,
  criarSupabaseBancoService,
  criarSupabaseIAService,
} from './supabase/stub';
import { MODO_TESTE } from '@/lib/ambiente';

export * from './contracts';
export * from './calculos';
export * from '@/lib/types';

const dataSource = import.meta.env.VITE_DATA_SOURCE || 'mock';

export const authService: AuthService =
  dataSource === 'supabase' ? criarSupabaseAuthService() : new MockAuthService();

export const gestaoService: GestaoService =
  dataSource === 'supabase' ? criarSupabaseGestaoService() : new MockGestaoService();

export const professorService: ProfessorService =
  dataSource === 'supabase' ? criarSupabaseProfessorService() : new MockProfessorService();

export const alunoService: AlunoService =
  dataSource === 'supabase' ? criarSupabaseAlunoService() : new MockAlunoService();

export const relatorioService: RelatorioService =
  dataSource === 'supabase' ? criarSupabaseRelatorioService() : new MockRelatorioService();

export const bancoService: BancoService =
  dataSource === 'supabase' ? criarSupabaseBancoService() : new MockBancoService();

export const iaService: ServicoIA =
  dataSource === 'supabase' ? criarSupabaseIAService() : new MockIAService();

// Exposição no window restrita a desenvolvimento/base mock para testes E2E
if (typeof window !== 'undefined' && (import.meta.env.DEV || dataSource === 'mock')) {
  (window as unknown as { bancoService?: BancoService; iaService?: ServicoIA }).bancoService =
    bancoService;
  (window as unknown as { bancoService?: BancoService; iaService?: ServicoIA }).iaService =
    iaService;
}

export async function restaurarDadosDemo(): Promise<void> {
  if (!MODO_TESTE) throw new Error('Restaurar dados de demonstração só existe no ambiente de teste.');
  const { resetDatabase } = await import('./mock/db');
  await resetDatabase();
}

export {
  assinarMudancas,
  assinarStatusSincronizacao,
  obterStatusSincronizacao,
  forcarSincronizacao,
  type InfoSincronizacao,
} from './sincronizacao';
export { resetDatabase } from './mock/db';


