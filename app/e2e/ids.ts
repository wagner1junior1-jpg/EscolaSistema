/**
 * Ids usados nas URLs do E2E.
 *
 * No mock (padrão) são os ids legíveis do seed. Com E2E_FONTE=supabase (Fase 7.3 do plano do
 * back end) são os uuid que o seed-supabase.ts gravou para esses mesmos registros.
 */
import { idDe } from '../src/scripts/seed-mapa';

export const E2E_SUPABASE = process.env.E2E_FONTE === 'supabase';

const id = (tabela: string, legivel: string) => (E2E_SUPABASE ? idDe(tabela, legivel) : legivel);

export const OFERTA_MAT_7A = id('ofertas', 'oferta-mat-7a');
export const ATIV_DEMO_MAT_FRAC = id('atividades', 'ativ-demo-mat-frac');
export const ALUNO_7A_1 = id('alunos', 'aluno-7a-1');
export const ALUNO_7A_3 = id('alunos', 'aluno-7a-3');
