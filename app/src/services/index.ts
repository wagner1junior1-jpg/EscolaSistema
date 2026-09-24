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
} from './contracts';

import {
  MockAuthService,
  MockGestaoService,
  MockProfessorService,
  MockAlunoService,
  MockRelatorioService,
} from './mock';

import {
  SupabaseAuthServiceStub,
  SupabaseGestaoServiceStub,
  SupabaseProfessorServiceStub,
  SupabaseAlunoServiceStub,
  SupabaseRelatorioServiceStub,
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

export async function restaurarDadosDemo(): Promise<void> {
  if (dataSource === 'mock') {
    const { resetDatabase } = await import('./mock/db');
    await resetDatabase();
  } else {
    throw new Error('Disponível só no modo de demonstração.');
  }
}

