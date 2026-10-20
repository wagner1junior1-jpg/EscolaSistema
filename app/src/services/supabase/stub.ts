/**
 * SaberPontual — Serviços Supabase (ainda não implementados)
 *
 * Desde a Fase 1 do plano do back end (docs/claude/plano-backend.md) os serviços
 * Supabase NÃO herdam mais do mock. Cada chamada falha com uma mensagem clara até
 * que o serviço real seja escrito (Fases 3 a 5).
 */

import {
  AuthService,
  GestaoService,
  ProfessorService,
  AlunoService,
  RelatorioService,
  BancoService,
  ServicoIA,
} from '../contracts';

function criarServicoNaoImplementado<T extends object>(nome: string): T {
  return new Proxy({} as T, {
    get(_alvo, propriedade) {
      // `then` precisa ser undefined para o objeto não ser tratado como Promise ao ser aguardado.
      if (typeof propriedade === 'symbol' || propriedade === 'then') return undefined;
      return async () => {
        throw new Error(`${nome}.${propriedade} ainda não foi implementado para o Supabase.`);
      };
    },
  });
}

export const criarSupabaseAuthService = (): AuthService =>
  criarServicoNaoImplementado<AuthService>('AuthService');
export const criarSupabaseGestaoService = (): GestaoService =>
  criarServicoNaoImplementado<GestaoService>('GestaoService');
export const criarSupabaseProfessorService = (): ProfessorService =>
  criarServicoNaoImplementado<ProfessorService>('ProfessorService');
export const criarSupabaseAlunoService = (): AlunoService =>
  criarServicoNaoImplementado<AlunoService>('AlunoService');
export const criarSupabaseRelatorioService = (): RelatorioService =>
  criarServicoNaoImplementado<RelatorioService>('RelatorioService');
export const criarSupabaseBancoService = (): BancoService =>
  criarServicoNaoImplementado<BancoService>('BancoService');
export const criarSupabaseIAService = (): ServicoIA =>
  criarServicoNaoImplementado<ServicoIA>('ServicoIA');
