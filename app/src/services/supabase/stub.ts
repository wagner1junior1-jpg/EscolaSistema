/**
 * SaberPontual — Ponto de entrada dos serviços Supabase
 *
 * Desde a Fase 1 do plano do back end (docs/claude/plano-backend.md) os serviços
 * Supabase NÃO herdam mais do mock. Todos já são reais (Fases 3, 5 e 6); o nome do arquivo
 * ficou da época em que eram stubs.
 */

export { criarSupabaseGestaoService } from './gestao.supabase';
export { criarSupabaseProfessorService } from './professor.supabase';
export { criarSupabaseAlunoService } from './aluno.supabase';
export { criarSupabaseRelatorioService } from './relatorio.supabase';
export { criarSupabaseBancoService } from './banco.supabase';
export { criarSupabaseIAService } from './ia.supabase';
