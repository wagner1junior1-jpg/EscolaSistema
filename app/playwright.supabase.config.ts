import { criarConfig } from './playwright.config';

// Suíte E2E contra o Supabase de TESTE (Fase 7.3). Ver e2e-supabase/apoio.ts.
export default criarConfig('supabase', './e2e-supabase');
