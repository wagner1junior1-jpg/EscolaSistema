import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * mock (padrão): a suíte e2e/ na base do localStorage, cada teste com dados novos.
 * supabase: a suíte e2e-supabase/ contra o Supabase de TESTE (Fase 7.3 do plano do back end),
 * com build própria e outra porta, para nunca reaproveitar o servidor do mock.
 * Rodar com `npm run e2e:supabase` (playwright.supabase.config.ts).
 * E2E_FONTE=supabase com este arquivo roda a suíte e2e/ contra o Supabase (diagnóstico; ela
 * supõe banco novo a cada teste e por isso não fica verde num banco compartilhado).
 */
export function criarConfig(fonte: 'mock' | 'supabase', testDir = './e2e'): PlaywrightTestConfig {
  const supabase = fonte === 'supabase';
  const porta = supabase ? 4174 : 4173;
  return defineConfig({
    testDir,
    workers: 1,
    retries: 0,
    // Com o Supabase cada tela espera a rede; os 5 s do mock não bastam (ex.: salvar atividade).
    timeout: supabase ? 90_000 : 30_000,
    expect: { timeout: supabase ? 15_000 : 5_000 },
    use: {
      baseURL: `http://localhost:${porta}`,
      trace: 'off',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: supabase
        ? `npx tsc -b && npx vite build --outDir dist-e2e-supabase --emptyOutDir && npx vite preview --outDir dist-e2e-supabase --port ${porta} --strictPort`
        : `npm run build && npx vite preview --port ${porta} --strictPort`,
      port: porta,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        VITE_DATA_SOURCE: fonte,
      },
    },
  });
}

const FONTE = process.env.E2E_FONTE === 'supabase' ? 'supabase' : 'mock';
process.env.VITE_DATA_SOURCE = FONTE;

export default criarConfig(FONTE);
