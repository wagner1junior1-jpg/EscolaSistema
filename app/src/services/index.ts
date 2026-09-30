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
  SupabaseAuthServiceStub,
  SupabaseGestaoServiceStub,
  SupabaseProfessorServiceStub,
  SupabaseAlunoServiceStub,
  SupabaseRelatorioServiceStub,
  SupabaseBancoServiceStub,
  SupabaseIAServiceStub,
} from './supabase/stub';

export * from './contracts';
export * from './calculos';
export * from '@/lib/types';

const dataSource = import.meta.env.VITE_DATA_SOURCE || 'mock';

export const authService: AuthService =
  dataSource === 'supabase' ? new SupabaseAuthServiceStub() : new MockAuthService();

export const gestaoService: GestaoService =
  dataSource === 'supabase' ? new SupabaseGestaoServiceStub() : new MockGestaoService();

export const professorService: ProfessorService =
  dataSource === 'supabase' ? new SupabaseProfessorServiceStub() : new MockProfessorService();

export const alunoService: AlunoService =
  dataSource === 'supabase' ? new SupabaseAlunoServiceStub() : new MockAlunoService();

export const relatorioService: RelatorioService =
  dataSource === 'supabase' ? new SupabaseRelatorioServiceStub() : new MockRelatorioService();

export const bancoService: BancoService =
  dataSource === 'supabase' ? new SupabaseBancoServiceStub() : new MockBancoService();

export const iaService: ServicoIA =
  dataSource === 'supabase' ? new SupabaseIAServiceStub() : new MockIAService();

if (typeof window !== 'undefined') {
  (window as unknown as { bancoService?: BancoService; iaService?: ServicoIA }).bancoService =
    bancoService;
  (window as unknown as { bancoService?: BancoService; iaService?: ServicoIA }).iaService =
    iaService;
}

export async function restaurarDadosDemo(): Promise<void> {
  const { resetDatabase } = await import('./mock/db');
  await resetDatabase();
}

export {
  assinarMudancas,
  assinarStatusSincronizacao,
  obterStatusSincronizacao,
  forcarSincronizacao,
  resetDatabase,
  type InfoSincronizacao,
} from './mock/db';


