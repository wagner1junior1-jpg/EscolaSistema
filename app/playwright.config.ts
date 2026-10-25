import { defineConfig, devices } from '@playwright/test';

// Padrão: base mock. E2E_FONTE=supabase roda contra o Supabase de TESTE (Fase 7.3 do plano do
// back end), com build própria e outra porta, para nunca reaproveitar o servidor do mock.
const SUPABASE = process.env.E2E_FONTE === 'supabase';
const FONTE = SUPABASE ? 'supabase' : 'mock';
const PORTA = SUPABASE ? 4174 : 4173;

process.env.VITE_DATA_SOURCE = FONTE;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  // Com o Supabase cada tela espera a rede; os 5 s do mock não bastam (ex.: salvar atividade).
  timeout: SUPABASE ? 90_000 : 30_000,
  expect: { timeout: SUPABASE ? 15_000 : 5_000 },
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: SUPABASE
      ? `npx tsc -b && npx vite build --outDir dist-e2e-supabase --emptyOutDir && npx vite preview --outDir dist-e2e-supabase --port ${PORTA} --strictPort`
      : `npm run build && npx vite preview --port ${PORTA} --strictPort`,
    port: PORTA,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_DATA_SOURCE: FONTE,
    },
  },
});
