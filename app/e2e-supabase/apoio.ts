/**
 * SaberPontual — apoio da suíte E2E contra o Supabase de TESTE (Fase 7.3 do plano do back end)
 *
 * O banco de teste é COMPARTILHADO e não é zerado entre rodadas, então esta suíte:
 * - usa nomes únicos por rodada (CARIMBO) para tudo o que cria;
 * - não confere contagens nem dados que só existem na base pequena ou na ampliada; usa só o que
 *   as duas têm: os logins demo, a oferta de Matemática do 7A-MAT com a Ana e o Lucas (PIN 1420);
 * - falha se o Supabase responder 4xx/5xx sem que o teste espere por isso.
 *
 * O que ela cria fica no banco (turma, alunos, atividade, recado e aviso com o carimbo); o seed
 * com --zerar limpa.
 */
import { expect, type Page } from '@playwright/test';
import { idDe } from '../src/scripts/seed-mapa';

const agora = new Date();
const doisDigitos = (n: number) => String(n).padStart(2, '0');
/** Ex.: "2510-1432-k7" (dia, mês, hora, minuto e 2 letras ao acaso). */
export const CARIMBO = `${doisDigitos(agora.getDate())}${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(
  agora.getHours()
)}${doisDigitos(agora.getMinutes())}-${Math.random().toString(36).slice(2, 4)}`;

export const OFERTA_MAT_7A = idDe('ofertas', 'oferta-mat-7a');
export const CODIGO_7A = '7A-MAT';
export const LUCAS = { nome: 'Lucas Oliveira', pin: '1420' };

/** Registra as respostas do Supabase com erro. Chame `conferir()` no fim do teste. */
export function vigiarSupabase(page: Page) {
  const erros: string[] = [];
  page.on('response', (r) => {
    const url = r.url();
    if (!url.includes('.supabase.co') || r.status() < 400) return;
    erros.push(`${r.status()} ${r.request().method()} ${url.replace(/^https:\/\/[^/]+/, '').split('?')[0]}`);
  });
  page.on('pageerror', (e) => erros.push(`JS: ${e.message.slice(0, 200)}`));
  return {
    erros,
    conferir: () => expect(erros, 'respostas com erro do Supabase ou erro de JavaScript').toEqual([]),
  };
}

export async function entrarEquipe(page: Page, email: string) {
  await page.goto('/entrar');
  await page.getByPlaceholder('exemplo@demo.com').fill(email);
  await page.getByPlaceholder('••••••••').fill('demo123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/entrar'));
}

export async function digitarPin(page: Page, pin: string) {
  for (const digito of pin) {
    await page.getByRole('button', { name: digito, exact: true }).click();
  }
}

export async function entrarAluno(page: Page, codigo: string, nome: string, pin: string) {
  await page.goto('/aluno');
  await page.getByPlaceholder('Ex: 7A-MAT').fill(codigo);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText(nome, { exact: true }).click();
  await digitarPin(page, pin);
  await expect(page).toHaveURL(/\/aluno\/painel/);
  await expect(page.getByText(`Olá, ${nome}!`)).toBeVisible();
}

/** A tela não pode estar mostrando mensagem de falha de carregamento. */
export async function semMensagemDeErro(page: Page) {
  await expect(page.getByText(/Não foi possível|ainda não foi implementado|Erro ao carregar/i)).toHaveCount(0);
}
