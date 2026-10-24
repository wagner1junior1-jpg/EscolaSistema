import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A Edge Function gerar-questoes é publicada como arquivo único e carrega uma CÓPIA do prompt de
 * ia-prompt.ts. Este teste impede que as duas versões se afastem.
 */
const FUNCAO = resolve(process.cwd(), '../supabase/functions/gerar-questoes/index.ts');
const PROMPT = resolve(process.cwd(), 'src/services/ia-prompt.ts');

// No Windows o Git pode converter as quebras de linha para CRLF: compara sempre com LF.
const ler = (caminho: string) => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');

function trechoDoServidor(): string {
  const fonte = ler(FUNCAO);
  const ini = fonte.indexOf('\n// PROMPT:INICIO\n');
  const fim = fonte.indexOf('\n// PROMPT:FIM\n');
  expect(ini).toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(ini);
  return fonte.slice(ini + '\n// PROMPT:INICIO\n'.length, fim + 1);
}

function trechoDoApp(): string {
  const fonte = ler(PROMPT);
  const marca = "import type { AreaConhecimento } from './mock/iaValidacao';\n";
  const ini = fonte.indexOf(marca);
  expect(ini).toBeGreaterThan(-1);
  return fonte.slice(ini + marca.length);
}

describe('prompt do servidor x prompt do app', () => {
  it('a cópia na Edge Function é idêntica a ia-prompt.ts', () => {
    expect(trechoDoServidor().trim()).toBe(trechoDoApp().trim());
  });

  it('a Edge Function não usa chave em variável VITE_* nem na URL do Gemini', () => {
    const fonte = ler(FUNCAO);
    expect(fonte).not.toMatch(/VITE_/);
    expect(fonte).not.toMatch(/\?key=|&key=/);
    expect(fonte).toContain("Deno.env.get('GEMINI_API_KEY')");
  });
});
