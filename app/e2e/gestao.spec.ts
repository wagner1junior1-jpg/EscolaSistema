import { test, expect, Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

async function loginDemo(page: Page, nomeOuEmail: string) {
  await page.goto('/entrar');
  await page.getByText(nomeOuEmail).click();
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('Portal de Gestão', () => {
  test('G1: Coordenação em /gestao não mostra Bimestres nem Escola', async ({ page }) => {
    await loginDemo(page, 'coordenacao@demo.com');
    await expect(page).toHaveURL(/\/gestao/);

    // O menu lateral NÃO mostra "Bimestres" nem "Escola"
    const aside = page.locator('aside');
    await expect(aside.getByText('Bimestres')).toHaveCount(0);
    await expect(aside.getByText('Escola')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bimestres' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Escola' })).toHaveCount(0);
  });

  test.describe.serial('Ciclo de Gestão: Turmas, Alunos, PINs e Sigilo (G2 a G5)', () => {
    let page: Page;
    let codigoTurma: string;
    let pinAlunoDois: string;
    let novoPinAlunoDois: string;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    });

    test.afterAll(async () => {
      await page.close();
    });

    test('G2: Direção cria turma 9º Ano C, oferta com Ana, alunos em lote e filipetas', async () => {
      await loginDemo(page, 'direcao@demo.com');
      await expect(page).toHaveURL(/\/gestao/);

      // Abre seção Turmas
      await page.getByRole('button', { name: 'Turmas' }).click();

      // Clica em Nova Turma
      await page.getByRole('button', { name: 'Nova Turma' }).click();

      // Preenche os dados
      const modalTurma = page.getByRole('dialog');
      await modalTurma.getByLabel('Nome da Turma').fill('9º Ano C');
      await modalTurma.getByLabel('Série / Ano').fill('9º Ano');
      await modalTurma.locator('select').selectOption('fund2');

      // Anota o código gerado
      codigoTurma = (await modalTurma.getByPlaceholder('Ex: 7A-KRT').inputValue()).trim().toUpperCase();
      expect(codigoTurma).toBeTruthy();

      // Salva a turma
      await modalTurma.getByRole('button', { name: 'Salvar Turma' }).click();
      await expect(page.getByText('Turma cadastrada com sucesso!')).toBeVisible();

      // Encontra o cartão da turma criada
      const turmaCard = page.locator('.overflow-hidden').filter({ hasText: '9º Ano C' });
      await expect(turmaCard).toBeVisible();
      await expect(turmaCard.getByText(codigoTurma)).toBeVisible();

      // Adiciona a oferta Matemática com a Ana
      await turmaCard.getByRole('button', { name: /Ofertas/ }).click();
      await turmaCard.getByRole('button', { name: 'Adicionar Oferta' }).click();

      const modalOferta = page.getByRole('dialog');
      await modalOferta.locator('select').first().selectOption({ label: 'Matemática' });
      const optProfessor = await modalOferta.locator('option').filter({ hasText: 'Ana Paula' }).getAttribute('value');
      await modalOferta.locator('select').nth(1).selectOption(optProfessor!);
      await modalOferta.getByRole('button', { name: 'Adicionar Oferta' }).click();
      await expect(page.getByText('Oferta adicionada com sucesso!')).toBeVisible();

      // Vai para a seção Alunos e PINs
      await page.getByRole('button', { name: 'Alunos e PINs' }).click();

      // Seleciona a turma 9º Ano C
      const optTurma = await page.locator('select').first().locator('option').filter({ hasText: '9º Ano C' }).getAttribute('value');
      await page.locator('select').first().selectOption(optTurma!);

      // Cadastra em lote
      await page.getByRole('button', { name: 'Cadastrar em Lote' }).click();
      await page
        .locator('textarea')
        .fill('Aluno Teste Um\nAluno Teste Dois\nAluno Teste Três');
      await page.getByRole('button', { name: 'Cadastrar Alunos' }).click();
      await expect(page.getByText('3 alunos cadastrados com sucesso!')).toBeVisible();

      // Modal PINs gerados mostra 3 PINs de 4 dígitos
      const modalPins = page.getByRole('dialog');
      await expect(modalPins.getByText(/PINs de Acesso Gerados \(3\)/)).toBeVisible();
      await expect(modalPins.getByText('Aluno Teste Um')).toBeVisible();
      await expect(modalPins.getByText('Aluno Teste Dois')).toBeVisible();
      await expect(modalPins.getByText('Aluno Teste Três')).toBeVisible();

      const pins = modalPins.locator('.tracking-widest');
      await expect(pins).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        const p = await pins.nth(i).innerText();
        expect(p).toMatch(/^\d{4}$/);
      }

      // Lê o PIN do Aluno Teste Dois
      const rowDois = modalPins.locator('.divide-y > div').filter({ hasText: 'Aluno Teste Dois' });
      pinAlunoDois = await rowDois.locator('.tracking-widest').innerText();
      expect(pinAlunoDois).toMatch(/^\d{4}$/);

      // Captura G2-pins
      await page.screenshot({ path: 'e2e/evidencias/G2-pins.png' });

      // Abre Imprimir filipetas
      await page.evaluate(() => { window.print = () => {}; });
      await modalPins.getByRole('button', { name: /Imprimir Filipetas/ }).click();
      await page.emulateMedia({ media: 'print' });

      // A página contém os 3 nomes e o código da turma
      const filipetasContainer = page.locator('.print\\:block');
      await expect(filipetasContainer.getByText('Aluno Teste Um')).toBeVisible();
      await expect(filipetasContainer.getByText('Aluno Teste Dois')).toBeVisible();
      await expect(filipetasContainer.getByText('Aluno Teste Três')).toBeVisible();
      await expect(filipetasContainer.getByText(codigoTurma).first()).toBeVisible();

      // Captura G2-filipetas
      await page.screenshot({ path: 'e2e/evidencias/G2-filipetas.png' });
      await page.emulateMedia({ media: 'screen' });

      // Fecha o modal
      await modalPins.getByRole('button', { name: 'Concluir' }).click();
    });

    test('G3: Aluno Teste Dois entra em /aluno com código e PIN do G2', async () => {
      await page.goto('/aluno');
      await page.getByPlaceholder('Ex: 7A-MAT').fill(codigoTurma);
      await page.getByRole('button', { name: 'Continuar' }).click();

      await page.getByText('Aluno Teste Dois').click();
      for (const digito of pinAlunoDois) {
        await page.getByRole('button', { name: digito, exact: true }).click();
      }

      await expect(page).toHaveURL(/\/aluno\/painel/);
      await expect(page.getByText('Olá, Aluno Teste Dois!')).toBeVisible();
    });

    test('G4: Direção gera novo PIN para Aluno Teste Dois (PIN antigo falha e novo funciona)', async () => {
      // Direção loga novamente
      await loginDemo(page, 'direcao@demo.com');
      await page.goto('/gestao?secao=alunos');
      const optTurmaG4 = await page.locator('select').first().locator('option').filter({ hasText: '9º Ano C' }).getAttribute('value');
      await page.locator('select').first().selectOption(optTurmaG4!);

      // Gera novo PIN para Aluno Teste Dois
      const row = page.locator('.divide-y > div').filter({ hasText: 'Aluno Teste Dois' });
      await row.getByRole('button', { name: 'Resetar PIN' }).click();
      await page.getByRole('button', { name: 'Gerar Novo PIN' }).click();

      // Modal abre com o novo PIN
      const modalReset = page.getByRole('dialog');
      await expect(modalReset.getByText(/PINs de Acesso Gerados \(1\)/)).toBeVisible();
      novoPinAlunoDois = await modalReset.locator('.tracking-widest').innerText();
      expect(novoPinAlunoDois).toMatch(/^\d{4}$/);
      expect(novoPinAlunoDois).not.toBe(pinAlunoDois);

      await modalReset.getByRole('button', { name: 'Concluir' }).click();

      // Testa em /aluno
      await page.goto('/aluno');
      await page.getByPlaceholder('Ex: 7A-MAT').fill(codigoTurma);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByText('Aluno Teste Dois').click();

      // PIN antigo dá "PIN incorreto"
      for (const digito of pinAlunoDois) {
        await page.getByRole('button', { name: digito, exact: true }).click();
      }
      await expect(page.getByText(/PIN incorreto/i)).toBeVisible();

      // Novo PIN funciona
      for (const digito of novoPinAlunoDois) {
        await page.getByRole('button', { name: digito, exact: true }).click();
      }
      await expect(page).toHaveURL(/\/aluno\/painel/);
      await expect(page.getByText('Olá, Aluno Teste Dois!')).toBeVisible();
    });

    test('G5: Sigilo do PIN — após fechar o modal, PIN não aparece na página nem no localStorage', async () => {
      await loginDemo(page, 'direcao@demo.com');
      await page.goto('/gestao?secao=alunos');
      const optTurmaG5 = await page.locator('select').first().locator('option').filter({ hasText: '9º Ano C' }).getAttribute('value');
      await page.locator('select').first().selectOption(optTurmaG5!);

      // Reseta PIN do Aluno Teste Três
      const row = page.locator('.divide-y > div').filter({ hasText: 'Aluno Teste Três' });
      await row.getByRole('button', { name: 'Resetar PIN' }).click();
      await page.getByRole('button', { name: 'Gerar Novo PIN' }).click();

      const modalG5 = page.getByRole('dialog');
      await expect(modalG5.getByText(/PINs de Acesso Gerados/)).toBeVisible();
      const pinGerado = await modalG5.locator('.tracking-widest').innerText();
      expect(pinGerado).toMatch(/^\d{4}$/);

      // Fecha o modal de PINs
      await modalG5.getByRole('button', { name: 'Concluir' }).click();
      await expect(page.getByText(/PINs de Acesso Gerados/)).toHaveCount(0);

      // O PIN não aparece em nenhum lugar da página
      await expect(page.locator(`text=${pinGerado}`)).toHaveCount(0);

      // O localStorage não contém esse PIN (percorra todas as chaves)
      const pinEncontrado = await page.evaluate((pin) => {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const v = localStorage.getItem(k) || '';
          if (k.includes(pin) || v.includes(pin)) {
            return true;
          }
        }
        return false;
      }, pinGerado);
      expect(pinEncontrado).toBe(false);
    });
  });
});
