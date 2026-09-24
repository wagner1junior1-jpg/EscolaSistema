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
    await expect(aside.getByText('Escola', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bimestres' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Escola', exact: true })).toHaveCount(0);
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

      // Na impressão, o modal NÃO está visível
      await expect(page.getByText(/PINs de Acesso Gerados/)).not.toBeVisible();

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

      // Verifica que o localStorage não contém o PIN entre aspas ("1059", com as aspas) e que nenhuma chave ou campo se chama pin_puro
      const resultadoLocalStorage = await page.evaluate((pin) => {
        const pinComAspas = `"${pin}"`;
        let contemPinComAspas = false;
        let contemPinPuro = false;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const v = localStorage.getItem(k) || '';
          if (k.includes('pin_puro') || v.includes('pin_puro')) {
            contemPinPuro = true;
          }
          if (k.includes(pinComAspas) || v.includes(pinComAspas)) {
            contemPinComAspas = true;
          }
        }
        return { contemPinComAspas, contemPinPuro };
      }, pinGerado);
      expect(resultadoLocalStorage.contemPinComAspas).toBe(false);
      expect(resultadoLocalStorage.contemPinPuro).toBe(false);
    });
  });

  test('G6: Coordenação entra em /gestao e os cartões de Início mostram 16 alunos, 2 turmas, 2 professores', async ({ page }) => {
    await loginDemo(page, 'coordenacao@demo.com');
    await expect(page).toHaveURL(/\/gestao/);

    await expect(page.getByText('16 alunos')).toBeVisible();
    await expect(page.getByText('2 turmas')).toBeVisible();
    await expect(page.getByText('2 professores')).toBeVisible();

    await page.screenshot({ path: 'e2e/evidencias/G6.png' });
  });

  test('G7: Navega para Desempenho, seleciona 3º Bimestre, confere linha com 7º Ano A e Matemática', async ({ page }) => {
    await loginDemo(page, 'coordenacao@demo.com');
    await page.getByRole('button', { name: 'Desempenho' }).click();

    // Seleciona o 3º Bimestre se já não estiver
    const selectBimestre = page.locator('select').first();
    const optBim3 = await selectBimestre.locator('option').filter({ hasText: '3º Bimestre' }).getAttribute('value');
    if (optBim3) {
      await selectBimestre.selectOption(optBim3);
    }

    const row = page.locator('tbody tr').filter({ hasText: '7º Ano A' }).filter({ hasText: 'Matemática' });
    await expect(row).toBeVisible();
  });

  test('G8: Navega para Alunos em Atenção, confere alunos esperados e ausência de Beatriz', async ({ page }) => {
    await loginDemo(page, 'coordenacao@demo.com');
    await page.getByRole('button', { name: 'Alunos em Atenção' }).click();

    // Seleciona o 3º Bimestre se já não estiver
    const selectBimestre = page.locator('select').first();
    const optBim3 = await selectBimestre.locator('option').filter({ hasText: '3º Bimestre' }).getAttribute('value');
    if (optBim3) {
      await selectBimestre.selectOption(optBim3);
    }

    await expect(page.getByText('Enzo Gabriel Ferreira')).toBeVisible();
    await expect(page.getByText('Matheus Carvalho')).toBeVisible();
    await expect(page.getByText('Gabriel Lima')).toBeVisible();
    await expect(page.getByText('Isabella Martins')).toBeVisible();
    await expect(page.getByText('Beatriz Santos')).toHaveCount(0);

    await page.screenshot({ path: 'e2e/evidencias/G8.png' });
  });

  test('G9: Navega para Questões Críticas, confere questão crítica de porcentagem', async ({ page }) => {
    await loginDemo(page, 'coordenacao@demo.com');
    await page.getByRole('button', { name: 'Questões Críticas' }).click();

    // Seleciona o 3º Bimestre se já não estiver
    const selectBimestre = page.locator('select').first();
    const optBim3 = await selectBimestre.locator('option').filter({ hasText: '3º Bimestre' }).getAttribute('value');
    if (optBim3) {
      await selectBimestre.selectOption(optBim3);
    }

    await expect(page.getByText('Quanto é 25% de 80?')).toBeVisible();

    await page.screenshot({ path: 'e2e/evidencias/G9.png' });
  });

  test('G10: Direção cria aviso Aviso E2E no Mural e aluno Lucas visualiza em /aluno', async ({ page }) => {
    // 1. Direção loga e cria aviso no Mural
    await loginDemo(page, 'direcao@demo.com');
    await page.getByRole('button', { name: 'Mural da Escola' }).click();

    await page.getByRole('button', { name: 'Novo Aviso' }).click();
    const modalAviso = page.getByRole('dialog');
    await modalAviso.getByLabel('Título do Aviso').fill('Aviso E2E');
    await modalAviso.locator('textarea').fill('Este é um aviso institucional de teste E2E.');
    await modalAviso.locator('select').selectOption('alta');
    await modalAviso.getByRole('button', { name: 'Publicar Aviso' }).click();

    await expect(page.getByText('Aviso publicado no mural da escola com sucesso!')).toBeVisible();

    // 2. Aluno Lucas entra em /aluno
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7A-MAT');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lucas Oliveira').click();

    // PIN: 1420
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }

    await expect(page).toHaveURL(/\/aluno\/painel/);
    await expect(page.getByText('Olá, Lucas Oliveira!')).toBeVisible();
    await expect(page.getByText('Aviso E2E')).toBeVisible();
  });

  test('G11: Clica em Baixar CSV em Alunos em Atenção e confere arquivo baixado', async ({ page }) => {
    await loginDemo(page, 'coordenacao@demo.com');
    await page.getByRole('button', { name: 'Alunos em Atenção' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar CSV' }).click();
    const download = await downloadPromise;

    const nomeArquivo = download.suggestedFilename();
    expect(nomeArquivo.endsWith('.csv')).toBe(true);

    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    if (readable) {
      for await (const chunk of readable) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const conteudo = Buffer.concat(chunks).toString('utf-8');

    // Começa com \uFEFF (BOM UTF-8)
    expect(conteudo.startsWith('\uFEFF')).toBe(true);

    // Tem cabeçalho separado por ;
    const primeiraLinha = conteudo.replace('\uFEFF', '').split(/\r?\n/)[0];
    expect(primeiraLinha).toContain(';');

    // Contém "Enzo"
    expect(conteudo).toContain('Enzo');
  });

  test('G12: Impressão das filipetas (@media print) esconde modal e exibe nomes dos alunos', async ({ page }) => {
    await loginDemo(page, 'direcao@demo.com');
    await page.goto('/gestao?secao=alunos');

    // Reseta PIN de um aluno para abrir o modal de PINs
    const row = page.locator('.divide-y > div').first();
    const nomeAluno = await row.locator('p.font-semibold').innerText();
    await row.getByRole('button', { name: 'Resetar PIN' }).click();
    await page.getByRole('button', { name: 'Gerar Novo PIN' }).click();

    const modalPins = page.getByRole('dialog');
    await expect(modalPins.getByText(/PINs de Acesso Gerados/)).toBeVisible();

    // Clica em Imprimir Filipetas
    await page.evaluate(() => { window.print = () => {}; });
    await modalPins.getByRole('button', { name: /Imprimir Filipetas/ }).click();

    // Simula @media print
    await page.emulateMedia({ media: 'print' });

    // Verifica que o texto "PINs de Acesso Gerados" NÃO está visível
    await expect(page.getByText(/PINs de Acesso Gerados/)).not.toBeVisible();

    // Verifica que o nome do aluno ESTÁ visível no container de filipetas
    const filipetasContainer = page.locator('.print\\:block');
    await expect(filipetasContainer.getByText(nomeAluno)).toBeVisible();

    await page.emulateMedia({ media: 'screen' });
  });
});
