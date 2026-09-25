import { test, expect, Page } from '@playwright/test';

test.describe.serial('Ensaio Geral da Demonstração (D1 a D6)', () => {
  let page: Page;
  const consoleErrorsAluno: string[] = [];
  const pageErrorsAluno: string[] = [];
  let trackingAluno = false;
  let valorDesempenhoMat7aD1 = '';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    page.on('console', (msg) => {
      if (trackingAluno && msg.type() === 'error') {
        consoleErrorsAluno.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      if (trackingAluno) {
        pageErrorsAluno.push(err.message);
      }
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('D1: Restaurar dados demo pela tela de login', async () => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: /Restaurar dados de demonstração/i }).click();
    await expect(page.getByText('Dados de demonstração restaurados.')).toBeVisible();

    // Entra como direção, anota o texto da célula de 7º Ano A / Matemática em Desempenho e guarda numa variável
    await page.getByPlaceholder('exemplo@demo.com').fill('direcao@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/gestao/);

    await page.getByRole('button', { name: 'Desempenho' }).click();
    const row7a = page
      .locator('tbody tr')
      .filter({ hasText: '7º Ano A' })
      .filter({ hasText: 'Matemática' });
    await expect(row7a).toBeVisible();

    const celulaMediaD1 = row7a.locator('td').nth(4);
    valorDesempenhoMat7aD1 = (await celulaMediaD1.innerText()).trim();
    expect(valorDesempenhoMat7aD1).toBeTruthy();

    await page.screenshot({ path: 'e2e/evidencias/demo/D1.png' });
  });

  test('D2: Professora Ana cria atividade Demo ao vivo – Porcentagem com 2 questões e publica', async () => {
    // Login Ana
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('ana@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/professor/);

    // Abre a oferta de Matemática 7º A
    await page.goto('/professor/oferta/oferta-mat-7a');

    // Clica em Nova Atividade
    await page.getByRole('button', { name: 'Nova Atividade' }).click();

    // Preenche cabeçalho
    await page.getByLabel('Título da Atividade *').fill('Demo ao vivo – Porcentagem');
    await page.getByLabel('Descrição / Orientações *').fill('Exercício prático de porcentagem');
    await page.getByRole('button', { name: 'Criar e editar questões' }).click();

    // Adiciona e edita Questão 1
    await page.getByRole('button', { name: 'Adicionar primeira questão' }).click();
    await page
      .getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...')
      .nth(0)
      .fill('Quanto é 10% de 200?');

    // Alternativas Q1 (A é correta por padrão)
    await page.getByPlaceholder('Texto da alternativa A...').nth(0).fill('20');
    await page.getByPlaceholder('Texto da alternativa B...').nth(0).fill('10');
    await page
      .getByPlaceholder('Ex: O aluno esqueceu de inverter a fração ao dividir...')
      .nth(0)
      .fill('Confundiu a taxa percentual com o valor absoluto.');
    await page.getByPlaceholder('Texto da alternativa C...').nth(0).fill('2');
    await page.getByPlaceholder('Texto da alternativa D...').nth(0).fill('200');

    // Explicação pedagógica Q1
    await page
      .getByPlaceholder('Explicação passo a passo da resolução...')
      .nth(0)
      .fill('10% de 200 é igual a (10/100) * 200 = 20.');

    // Adiciona e edita Questão 2
    await page.getByRole('button', { name: 'Adicionar questão' }).click();
    await page
      .getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...')
      .nth(1)
      .fill('Quanto é 50% de 80?');

    // Alternativas Q2
    await page.getByPlaceholder('Texto da alternativa A...').nth(1).fill('40');
    await page.getByPlaceholder('Texto da alternativa B...').nth(1).fill('20');
    await page
      .getByPlaceholder('Ex: O aluno esqueceu de inverter a fração ao dividir...')
      .nth(1)
      .fill('Calculou 25% em vez de 50%.');
    await page.getByPlaceholder('Texto da alternativa C...').nth(1).fill('8');
    await page.getByPlaceholder('Texto da alternativa D...').nth(1).fill('50');

    // Explicação pedagógica Q2
    await page
      .getByPlaceholder('Explicação passo a passo da resolução...')
      .nth(1)
      .fill('50% de 80 é a metade de 80, ou seja, 40.');

    // Salva a atividade
    await page.getByRole('button', { name: 'Salvar atividade' }).click();
    await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();

    // Volta para as atividades da turma
    await page.getByText('Voltar para as atividades da turma').click();

    // Na aba Rascunhos, publica a atividade
    const card = page.locator('.rounded-2xl').filter({ hasText: 'Demo ao vivo – Porcentagem' });
    await card.getByRole('button', { name: 'Publicar' }).click();

    // Confirma no modal
    await page.getByRole('button', { name: 'Publicar agora' }).click();
    await expect(page.getByText('Atividade publicada com sucesso!')).toBeVisible();

    await page.screenshot({ path: 'e2e/evidencias/demo/D2.png' });
  });

  test('D3: Lucas responde atividade, erra Q1, retenta com acerto, acerta Q2 e vê placar de 50%', async () => {
    // Inicia rastreamento estrito de erros na tela do aluno
    trackingAluno = true;

    // Login Lucas no celular / aluno
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7A-MAT');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lucas Oliveira').click();
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/aluno\/painel/);

    // Abre a atividade recém-publicada
    const cardNovaAtiv = page
      .locator('.rounded-3xl')
      .filter({ hasText: 'Demo ao vivo – Porcentagem' });
    await cardNovaAtiv.getByRole('button', { name: /Começar|Continuar/ }).click();
    await expect(page).toHaveURL(/\/aluno\/atividade\/.*/);

    // Q1: Quanto é 10% de 200?
    await expect(page.getByText('Quanto é 10% de 200?')).toBeVisible();

    // Erra escolhendo alternativa B ('10')
    await page.getByRole('button', { name: /B\s+10/ }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();

    // Vê o diagnóstico pedagógico de erro
    await expect(page.getByText(/Não foi dessa vez/i)).toBeVisible();
    await expect(page.getByText(/Confundiu a taxa percentual/i)).toBeVisible();

    // Clica em Tentar novamente
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    // Agora acerta escolhendo alternativa A ('20')
    await page.getByRole('button', { name: /A\s+20/ }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await expect(page.getByText(/Mandou bem!/i)).toBeVisible();

    // Avança para a próxima questão
    await page.getByRole('button', { name: 'Próxima' }).click();

    // Q2: Quanto é 50% de 80?
    await expect(page.getByText('Quanto é 50% de 80?')).toBeVisible();

    // Acerta de primeira escolhendo '40' (alternativa A)
    await page.getByRole('button', { name: /A\s+40/ }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await expect(page.getByText(/Mandou bem!/i)).toBeVisible();

    // Ver resultado
    await page.getByRole('button', { name: 'Ver resultado' }).click();

    // Placar final de 50%
    await expect(page.getByText('50%', { exact: true })).toBeVisible();
    await expect(page.getByText('Acertos (1ª resp)')).toBeVisible();

    await page.screenshot({ path: 'e2e/evidencias/demo/D3.png' });
  });

  test('D4: Ana abre Resultados e Desempenho e vê Lucas com 50%', async () => {
    // Login Ana
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('ana@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/professor/);

    // Abre a oferta de Matemática 7º A
    await page.goto('/professor/oferta/oferta-mat-7a');

    // Abre Resultados da atividade
    await page.getByRole('button', { name: /Publicadas/ }).click();
    const cardAtiv = page.locator('.rounded-2xl').filter({ hasText: 'Demo ao vivo – Porcentagem' });
    await cardAtiv.getByRole('button', { name: 'Ver resultados' }).click();
    await expect(page).toHaveURL(/\/professor\/atividade\/.*\/resultados/);
    await expect(page.getByText('1 aluno respondeu')).toBeVisible();

    // Aba Desempenho da oferta
    await page.goto('/professor/oferta/oferta-mat-7a?aba=desempenho');
    const linhaLucas = page.locator('tbody tr').filter({ hasText: 'Lucas Oliveira' });
    await expect(linhaLucas).toBeVisible();
    await expect(linhaLucas).toContainText('50%');

    await page.screenshot({ path: 'e2e/evidencias/demo/D4.png' });
  });

  test('D5: Direção vê atividade em Desempenho e q-demo-frac-2 em Questões Críticas', async () => {
    // Login Direção
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('direcao@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/gestao/);

    // Desempenho da Gestão
    await page.getByRole('button', { name: 'Desempenho' }).click();
    const rowDesempenho = page
      .locator('tbody tr')
      .filter({ hasText: '7º Ano A' })
      .filter({ hasText: 'Matemática' });
    await expect(rowDesempenho).toBeVisible();

    // A mesma célula de 7º A / Matemática deve estar DIFERENTE do valor guardado no D1
    const celulaMediaD5 = (await rowDesempenho.locator('td').nth(4).innerText()).trim();
    expect(celulaMediaD5).not.toBe(valorDesempenhoMat7aD1);

    // Questões Críticas
    await page.getByRole('button', { name: 'Questões Críticas' }).click();
    await expect(page.getByText('Quanto é 25% de 80?')).toBeVisible();

    await page.screenshot({ path: 'e2e/evidencias/demo/D5.png' });
  });

  test('D6: Na tela do aluno, nenhum erro de console em nenhum passo', async () => {
    trackingAluno = false;
    expect(consoleErrorsAluno).toEqual([]);
    expect(pageErrorsAluno).toEqual([]);

    await page.screenshot({ path: 'e2e/evidencias/demo/D6.png' });
  });
});
