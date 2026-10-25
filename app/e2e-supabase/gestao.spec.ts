import { test, expect, type Page } from '@playwright/test';
import {
  CARIMBO,
  CODIGO_7A,
  LUCAS,
  digitarPin,
  entrarAluno,
  entrarEquipe,
  semMensagemDeErro,
  vigiarSupabase,
} from './apoio';

test.use({ viewport: { width: 1280, height: 900 } });

async function abrirSecao(page: Page, nome: string) {
  await page.getByRole('button', { name: new RegExp(`^\\s*${nome}\\s*$`) }).first().click();
  await page.waitForLoadState('networkidle');
  await semMensagemDeErro(page);
}

test.describe('Supabase — Gestão', () => {
  test('SG1: direção abre todas as seções da Gestão com dados do banco', async ({ page }) => {
    const rede = vigiarSupabase(page);
    await entrarEquipe(page, 'direcao@demo.com');
    await expect(page).toHaveURL(/\/gestao/);
    await expect(page.getByText('Painel de Gestão')).toBeVisible();
    await expect(page.getByText(/Sincronizado com o BD/)).toBeVisible();

    for (const secao of [
      'Desempenho',
      'Alunos em Atenção',
      'Questões Críticas',
      'Conselho de Professores',
      'Banco de Questões',
      'Mural da Escola',
      'Turmas',
      'Disciplinas',
      'Professores',
      'Alunos e PINs',
      'Bimestres',
      'Escola',
    ]) {
      await abrirSecao(page, secao);
    }
    rede.conferir();
  });

  test('SG2: coordenação não vê Bimestres nem Escola e abre os relatórios', async ({ page }) => {
    const rede = vigiarSupabase(page);
    await entrarEquipe(page, 'coordenacao@demo.com');
    await expect(page).toHaveURL(/\/gestao/);
    await expect(page.getByRole('button', { name: 'Bimestres' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Escola', exact: true })).toHaveCount(0);

    for (const secao of ['Desempenho', 'Alunos em Atenção', 'Questões Críticas', 'Conselho de Professores']) {
      await abrirSecao(page, secao);
    }
    rede.conferir();
  });

  test.describe.serial('turma nova, alunos em lote e PIN', () => {
    let page: Page;
    let rede: ReturnType<typeof vigiarSupabase>;
    const nomeTurma = `E2E Turma ${CARIMBO}`;
    const alunoUm = `Aluno E2E Um ${CARIMBO}`;
    const alunoDois = `Aluno E2E Dois ${CARIMBO}`;
    let codigoTurma = '';
    let pinDois = '';

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      rede = vigiarSupabase(page);
    });
    test.afterAll(async () => {
      await page.close();
    });

    test('SG3: direção cria a turma (logo ao abrir a seção) e cadastra 2 alunos em lote', async () => {
      await entrarEquipe(page, 'direcao@demo.com');
      // Sem esperar a seção carregar: era assim que aparecia "Escola não configurada."
      await page.getByRole('button', { name: 'Turmas' }).click();
      await page.getByRole('button', { name: 'Nova Turma' }).click();
      const modal = page.getByRole('dialog');
      await modal.getByLabel('Nome da Turma').fill(nomeTurma);
      await modal.getByLabel('Série / Ano').fill('9º Ano');
      await modal.locator('select').selectOption('fund2');
      codigoTurma = (await modal.getByPlaceholder('Ex: 7A-KRT').inputValue()).trim().toUpperCase();
      expect(codigoTurma).toBeTruthy();
      await modal.getByRole('button', { name: 'Salvar Turma' }).click();
      await expect(page.getByText('Turma cadastrada com sucesso!')).toBeVisible();

      await page.getByRole('button', { name: 'Alunos e PINs' }).click();
      const seletor = page.locator('select').first();
      await expect(seletor.locator('option').filter({ hasText: nomeTurma })).toHaveCount(1);
      const valor = await seletor.locator('option').filter({ hasText: nomeTurma }).getAttribute('value');
      await seletor.selectOption(valor!);

      await page.getByRole('button', { name: 'Cadastrar em Lote' }).click();
      await page.locator('textarea').fill(`${alunoUm}\n${alunoDois}`);
      await page.getByRole('button', { name: 'Cadastrar Alunos' }).click();
      await expect(page.getByText('2 alunos cadastrados com sucesso!')).toBeVisible();

      const modalPins = page.getByRole('dialog');
      await expect(modalPins.getByText(/PINs de Acesso Gerados \(2\)/)).toBeVisible();
      pinDois = await modalPins.locator('.divide-y > div').filter({ hasText: alunoDois }).locator('.tracking-widest').innerText();
      expect(pinDois).toMatch(/^\d{4}$/);
      await modalPins.getByRole('button', { name: 'Concluir' }).click();

      // O PIN puro não fica na página depois de fechar o modal
      await expect(page.getByText(pinDois, { exact: true })).toHaveCount(0);
      rede.conferir();
    });

    test('SG4: o aluno entra com o PIN gerado; depois de resetar, o antigo falha e o novo entra', async () => {
      await entrarAluno(page, codigoTurma, alunoDois, pinDois);

      await entrarEquipe(page, 'direcao@demo.com');
      await page.goto('/gestao?secao=alunos');
      const seletor = page.locator('select').first();
      const valor = await seletor.locator('option').filter({ hasText: nomeTurma }).getAttribute('value');
      await seletor.selectOption(valor!);
      await page.locator('.divide-y > div').filter({ hasText: alunoDois }).getByRole('button', { name: 'Resetar PIN' }).click();
      await page.getByRole('button', { name: 'Gerar Novo PIN' }).click();
      const modal = page.getByRole('dialog');
      await expect(modal.getByText(/PINs de Acesso Gerados \(1\)/)).toBeVisible();
      const novoPin = await modal.locator('.tracking-widest').innerText();
      expect(novoPin).toMatch(/^\d{4}$/);
      expect(novoPin).not.toBe(pinDois);
      await modal.getByRole('button', { name: 'Concluir' }).click();

      await page.goto('/aluno');
      await page.getByPlaceholder('Ex: 7A-MAT').fill(codigoTurma);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByText(alunoDois, { exact: true }).click();
      await digitarPin(page, pinDois);
      await expect(page.getByText(/PIN incorreto/i)).toBeVisible();
      await digitarPin(page, novoPin);
      await expect(page).toHaveURL(/\/aluno\/painel/);
      rede.conferir();
    });
  });

  test('SG5: direção publica aviso no Mural e o Lucas o vê no portal', async ({ page }) => {
    const rede = vigiarSupabase(page);
    const titulo = `Aviso E2E ${CARIMBO}`;
    await entrarEquipe(page, 'direcao@demo.com');
    await page.getByRole('button', { name: 'Mural da Escola' }).click();
    await page.getByRole('button', { name: 'Novo Aviso' }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('Título do Aviso').fill(titulo);
    await modal.locator('textarea').fill('Aviso da suíte E2E do Supabase de teste.');
    await modal.locator('select').selectOption('alta');
    await modal.getByRole('button', { name: 'Publicar Aviso' }).click();
    await expect(page.getByText('Aviso publicado no mural da escola com sucesso!')).toBeVisible();

    await entrarAluno(page, CODIGO_7A, LUCAS.nome, LUCAS.pin);
    await expect(page.getByText(titulo)).toBeVisible();
    rede.conferir();
  });
});
