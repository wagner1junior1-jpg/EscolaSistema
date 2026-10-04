import { test, expect, Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

async function loginDemo(page: Page, nomeOuEmail: string) {
  await page.goto('/entrar');
  await page.getByText(nomeOuEmail).click();
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('Portal do Professor', () => {
  test('P1: Painel do professor com turmas ofertadas', async ({ page }) => {
    await loginDemo(page, 'Profª Ana Paula');
    await expect(page).toHaveURL(/\/professor/);

    // Mostra os cartões Matemática e Língua Portuguesa do 7º Ano A
    await expect(page.getByText('Matemática')).toBeVisible();
    await expect(page.getByText('Língua Portuguesa')).toBeVisible();
    await expect(page.getByText('7º Ano A').first()).toBeVisible();

    // Captura P1
    await page.screenshot({ path: 'e2e/evidencias/P1.png' });
  });

  // P2, P3 e P4 compartilham o mesmo ciclo de vida e estado
  test.describe.serial('Ciclo de Atividade: Criação, Resposta e Edição de Textos (P2 a P4)', () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    });

    test.afterAll(async () => {
      await page.close();
    });

    test('P2: Ana cria e publica a atividade Teste E2E', async () => {
      await loginDemo(page, 'Profª Ana Paula');
      await expect(page).toHaveURL(/\/professor/);

      // Abre a oferta de Matemática 7º A
      await page.goto('/professor/oferta/oferta-mat-7a');

      // Clica em Nova Atividade
      await page.getByRole('button', { name: 'Nova Atividade' }).click();

      // Preenche os dados
      await page.getByLabel('Título da Atividade *').fill('Teste E2E');
      await page.getByLabel('Descrição / Orientações *').fill('Exercício para teste automatizado');
      await page.getByRole('button', { name: 'Criar e editar questões' }).click();

      // No editor: Adiciona 1 questão
      await page.getByRole('button', { name: 'Adicionar primeira questão' }).click();
      await page
        .getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...')
        .fill('Quanto é 2 + 2?');

      // Alternativa A: 4 (correta por padrão)
      await page.getByPlaceholder('Texto da alternativa A...').fill('4');

      // Alternativa B: 5 com diagnóstico
      await page.getByPlaceholder('Texto da alternativa B...').fill('5');
      await page
        .getByPlaceholder('Ex: O aluno esqueceu de inverter a fração ao dividir...')
        .first()
        .fill('Contou um a mais.');

      // Alternativa C: 22
      await page.getByPlaceholder('Texto da alternativa C...').fill('22');

      // Alternativa D: 3
      await page.getByPlaceholder('Texto da alternativa D...').fill('3');

      // Salva a atividade (retorna automaticamente para a matéria)
      await page.getByRole('button', { name: 'Salvar atividade' }).click();
      await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();

      // Na aba Rascunhos, publica a atividade
      const card = page.locator('.rounded-2xl').filter({ hasText: 'Teste E2E' });
      await card.getByRole('button', { name: 'Publicar' }).click();

      // Confirma no modal
      await page.getByRole('button', { name: 'Publicar agora' }).click();
      await expect(page.getByText('Atividade publicada com sucesso!')).toBeVisible();

      // Aparece na aba Publicadas
      await page.getByRole('button', { name: /Publicadas/ }).click();
      await expect(page.getByText('Teste E2E')).toBeVisible();
    });

    test('P3: Lucas responde e vê o diagnóstico de erro', async () => {
      // Vai para o portal do aluno
      await page.goto('/aluno');
      await page.getByPlaceholder('Ex: 7A-MAT').fill('7a-mat');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByText('Lucas Oliveira').click();

      // Digita PIN 1420
      for (const digito of '1420') {
        await page.getByRole('button', { name: digito, exact: true }).click();
      }
      await expect(page).toHaveURL(/\/aluno\/painel/);

      // Abre Teste E2E
      const cardAluno = page.locator('.rounded-3xl').filter({ hasText: 'Teste E2E' });
      await cardAluno.getByRole('button', { name: /Começar|Continuar/ }).click();

      // Escolhe 5
      await page.locator('div[role="radiogroup"] button').filter({ hasText: '5' }).click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();

      // Vê a explicação da pegadinha
      await expect(page.getByText('Contou um a mais.')).toBeVisible();
    });

    test('P4: Ana edita textos da atividade publicada', async () => {
      // Volta para login do professor
      await loginDemo(page, 'Profª Ana Paula');
      await page.goto('/professor/oferta/oferta-mat-7a?aba=atividades');

      // Aba Publicadas
      await page.getByRole('button', { name: /Publicadas/ }).click();

      // Clica em Editar textos
      const card = page.locator('.rounded-2xl').filter({ hasText: 'Teste E2E' });
      await card.getByRole('button', { name: 'Editar textos' }).click();

      // Rádios de correta estão desabilitados
      const radio = page.locator('input[type="radio"]').first();
      await expect(radio).toBeDisabled();

      // Não existe o botão Adicionar questão
      await expect(page.getByRole('button', { name: 'Adicionar questão' })).toHaveCount(0);

      // Altera o texto da alternativa A para "4 (quatro)"
      await page.getByPlaceholder('Texto da alternativa A...').fill('4 (quatro)');

      // Salva
      await page.getByRole('button', { name: 'Salvar atividade' }).click();
      await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();

      // Captura P4
      await page.screenshot({ path: 'e2e/evidencias/P4.png' });
    });
  });

  test('P5: Mapa de calor e questão crítica', async ({ page }) => {
    await loginDemo(page, 'Profª Ana Paula');

    // Abre resultados de Frações
    await page.goto('/professor/atividade/ativ-demo-mat-frac/resultados');

    // A questão 2 tem o chip "Questão crítica", o acerto 28,6% ou 28.6% e "Letra B (3 alunos)"
    const q2 = page.locator('.rounded-2xl').filter({ hasText: 'Questão 2' });
    await expect(q2.getByText('Questão crítica')).toBeVisible();
    await expect(q2.getByText(/28[,\.]6%/).first()).toBeVisible();
    await expect(q2.getByText(/Letra B \(3 alunos\)/)).toBeVisible();

    // Captura P5
    await page.screenshot({ path: 'e2e/evidencias/P5.png' });
  });

  test('P6: Aba Desempenho e filtro de alunos em Atenção', async ({ page }) => {
    await loginDemo(page, 'Profª Ana Paula');

    await page.goto('/professor/oferta/oferta-mat-7a?aba=desempenho');

    // As linhas dos 4 alunos mostram "Atenção"
    await expect(page.locator('tr').filter({ hasText: 'Gabriel Lima' })).toContainText('Atenção');
    await expect(page.locator('tr').filter({ hasText: 'Enzo Gabriel Ferreira' })).toContainText('Atenção');
    await expect(page.locator('tr').filter({ hasText: 'Matheus Carvalho' })).toContainText('Atenção');
    await expect(page.locator('tr').filter({ hasText: 'Isabella Martins' })).toContainText('Atenção');

    // Beatriz Santos mostra "Ótimo"
    await expect(page.locator('tr').filter({ hasText: 'Beatriz Santos' })).toContainText('Ótimo');

    // Marcando "Mostrar só alunos em Atenção", Beatriz some
    await page.getByLabel('Mostrar só alunos em Atenção').check();
    await expect(page.locator('tr').filter({ hasText: 'Beatriz Santos' })).toHaveCount(0);

    // Captura P6
    await page.screenshot({ path: 'e2e/evidencias/P6.png' });
  });

  test('P7: Ficha individual do aluno com retentativa', async ({ page }) => {
    await loginDemo(page, 'Profª Ana Paula');

    // Abre ficha do aluno-7a-3
    await page.goto('/professor/oferta/oferta-mat-7a/aluno/aluno-7a-3');

    // Contém "2ª tentativa"
    await expect(page.getByText(/2ª tentativa/)).toBeVisible();
  });

  test('P8: Controle de acesso e permissões de perfil', async ({ page }) => {
    // Carlos tenta acessar oferta de Matemática da Ana
    await loginDemo(page, 'Prof. Carlos Roberto');

    await page.goto('/professor/oferta/oferta-mat-7a');
    await expect(page.getByText(/permissão/i)).toBeVisible();

    // Carlos tenta acessar /gestao
    await page.goto('/gestao');
    await expect(page.getByText(/Sem permissão/i)).toBeVisible();
  });

  test('P9: Envio de recado e visualização no mural do aluno', async ({ page }) => {
    // Ana cria o recado
    await loginDemo(page, 'Profª Ana Paula');
    await page.goto('/professor/oferta/oferta-mat-7a?aba=recados');

    await page.getByLabel('Título do Recado *').fill('Recado E2E');
    await page.getByLabel('Mensagem *').fill('Conteúdo de aviso enviado pelo teste automatizado.');
    await page.getByRole('button', { name: 'Publicar recado' }).click();

    // Aparece na lista
    await expect(page.getByText('Recado E2E')).toBeVisible();

    // Entra como Lucas e confere no mural
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7a-mat');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lucas Oliveira').click();
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }

    await expect(page).toHaveURL(/\/aluno\/painel/);
    await expect(page.getByText('Recado E2E')).toBeVisible();
  });

  test('P10: Aba Desempenho do professor mostra 33,3% (incompleta) para Lucas', async ({ page }) => {
    await loginDemo(page, 'Profª Ana Paula');
    await page.goto('/professor/oferta/oferta-mat-7a?aba=desempenho');

    // A célula do Lucas na "Prova: Números Inteiros (encerrada)" mostra 33% (incompleta)
    const lucasRow = page.locator('tr').filter({ hasText: 'Lucas Oliveira' });
    await expect(lucasRow).toContainText(/33%\s*\(incompleta\)/);
  });

  test('P11: Navegação por Séries e Matérias no painel do professor', async ({ page }) => {
    // Entra como Prof. Carlos Roberto (leciona 6º Ano B e 7º Ano A)
    await loginDemo(page, 'Prof. Carlos Roberto');
    await expect(page).toHaveURL(/\/professor/);

    // Confere que ambas as séries aparecem como botões de seleção
    const aba6 = page.getByRole('tab', { name: /6º Ano/ });
    const aba7 = page.getByRole('tab', { name: /7º Ano/ });
    await expect(aba6).toBeVisible();
    await expect(aba7).toBeVisible();

    // Inicialmente 6º Ano está selecionado por padrão: exibe 6º Ano B e NÃO 7º Ano A
    await expect(page.getByText('6º Ano B')).toBeVisible();
    await expect(page.getByText('7º Ano A')).not.toBeVisible();

    // Clica na série 7º Ano: visualização filtra e abre a matéria do 7º Ano A
    await aba7.click();
    await expect(page.getByText('7º Ano A')).toBeVisible();
    await expect(page.getByText('6º Ano B')).not.toBeVisible();

    // Clica de volta na série 6º Ano: reabre a matéria do 6º Ano B
    await aba6.click();
    await expect(page.getByText('6º Ano B')).toBeVisible();
    await expect(page.getByText('7º Ano A')).not.toBeVisible();

    // Evidência de tela
    await page.screenshot({ path: 'e2e/evidencias/P11.png' });
  });

  test('P12: Professor cria atividade a partir do Banco de Questões e edita em formato compacto', async ({ page }) => {
    await loginDemo(page, 'Profª Ana Paula');
    await expect(page).toHaveURL(/\/professor/);

    // Abre a oferta de Matemática 7º A
    await page.goto('/professor/oferta/oferta-mat-7a');

    // Clica no botão "Criar a partir do Banco"
    const btnCriarBanco = page.getByRole('button', { name: 'Criar a partir do Banco' });
    await expect(btnCriarBanco).toBeVisible();
    await btnCriarBanco.click();

    // Modal de criação direta do banco
    await expect(page.getByRole('heading', { name: 'Criar a partir do Banco de Questões' })).toBeVisible();

    // Preenche dados da atividade
    await page.getByLabel('Título da Atividade *').fill('Atividade Banco Compacta');
    await page.getByLabel('Descrição / Orientações *').fill('Exercícios selecionados do banco para validação de layout compacto.');

    // Testa o botão "Ver gabarito" na primeira questão do modal
    const btnVerGabarito = page.getByRole('button', { name: 'Ver gabarito' }).first();
    await expect(btnVerGabarito).toBeVisible();
    await btnVerGabarito.click();
    await expect(page.getByText('Alternativas e Gabarito:')).toBeVisible();

    // Seleciona as duas primeiras questões do banco
    const checkboxes = page.locator('input[type="checkbox"][aria-label^="Selecionar questão"]');
    await expect(checkboxes.first()).toBeVisible();
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // Confere contador
    await expect(page.getByText('2 questão(ões) selecionada(s)')).toBeVisible();

    // Clica para criar atividade
    await page.getByRole('button', { name: 'Criar atividade (2)' }).click();

    // Redireciona para o editor de atividade
    await expect(page).toHaveURL(/\/professor\/atividade\//);
    await expect(page.getByRole('heading', { name: 'Questões (2)' })).toBeVisible();

    // Confere presença do selo de status "Pronta" e etiqueta "Objetiva" na linha compacta
    await expect(page.getByText('Pronta').first()).toBeVisible();
    await expect(page.getByText('Objetiva').first()).toBeVisible();

    // Testa o botão "Duplicar questão" na primeira questão compacta
    const btnDuplicar = page.getByRole('button', { name: 'Duplicar questão' }).first();
    await expect(btnDuplicar).toBeVisible();
    await btnDuplicar.click();
    await expect(page.getByRole('heading', { name: 'Questões (3)' })).toBeVisible();

    // Confere botões de visualização compacta / expandida
    const btnRecolherTodas = page.getByRole('button', { name: 'Recolher todas' });
    const btnExpandirTodas = page.getByRole('button', { name: 'Expandir todas' });
    await expect(btnRecolherTodas).toBeVisible();
    await expect(btnExpandirTodas).toBeVisible();

    // Clica em "Recolher todas": todas as questões ficam recolhidas no formato compacto
    await btnRecolherTodas.click();
    await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible();

    // Clica para expandir e editar a Questão 1
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByRole('button', { name: 'Recolher' }).first()).toBeVisible();

    // Verifica que o textarea de enunciado da questão 1 está visível
    const textareaEnunciado = page.getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...').first();
    await expect(textareaEnunciado).toBeVisible();

    // Clica em Salvar rascunho
    const btnSalvar = page.getByRole('button', { name: 'Salvar rascunho' });
    if (await btnSalvar.isEnabled()) {
      await btnSalvar.click();
      await expect(page.getByText('Alterações salvas com sucesso!')).toBeVisible();
    }

    // Rola para a seção de questões para evidenciar o layout compacto, selos e controles
    await page.getByRole('heading', { name: 'Questões (3)' }).scrollIntoViewIfNeeded();

    // Captura evidência de tela
    await page.screenshot({ path: 'e2e/evidencias/P12.png' });
  });

  test('P13: Professora amplia prazo de atividade publicada e reabre para o aluno', async ({ page }) => {
    // 1. Professora Ana abre "Editar textos" da atividade publicada "Frações e Porcentagem no Dia a Dia"
    await loginDemo(page, 'Profª Ana Paula');
    await page.goto('/professor/oferta/oferta-mat-7a?aba=atividades');
    await page.getByRole('button', { name: /Publicadas/ }).click();

    const cardProf = page.locator('.rounded-2xl').filter({ hasText: 'Frações e Porcentagem no Dia a Dia' });
    await cardProf.getByRole('button', { name: 'Editar textos' }).click();

    // Coloca o prazo numa data passada e salva
    await page.getByLabel('Prazo de Entrega').fill('2020-01-01');
    await page.getByRole('button', { name: 'Salvar atividade' }).click();
    await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();

    // 2. Aluno Lucas (7A-MAT, PIN 1420) vê a atividade em "Concluídas", com "Prazo encerrado"
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7a-mat');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lucas Oliveira').click();
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/aluno\/painel/);

    await page.getByRole('button', { name: /Concluídas/ }).click();
    const cardAlunoConcluidas = page.locator('.rounded-3xl').filter({ hasText: 'Frações e Porcentagem no Dia a Dia' });
    await expect(cardAlunoConcluidas).toBeVisible();
    await expect(cardAlunoConcluidas.getByText('Prazo encerrado')).toBeVisible();

    // 3. Professora amplia o prazo para uma data futura e salva
    await loginDemo(page, 'Profª Ana Paula');
    await page.goto('/professor/oferta/oferta-mat-7a?aba=atividades');
    await page.getByRole('button', { name: /Publicadas/ }).click();

    const cardProf2 = page.locator('.rounded-2xl').filter({ hasText: 'Frações e Porcentagem no Dia a Dia' });
    await cardProf2.getByRole('button', { name: 'Editar textos' }).click();
    await page.getByLabel('Prazo de Entrega').fill('2030-12-31');
    await page.getByRole('button', { name: 'Salvar atividade' }).click();
    await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();

    // 4. Lucas vê a atividade de volta em "Para fazer"
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7a-mat');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lucas Oliveira').click();
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/aluno\/painel/);

    await page.getByRole('button', { name: /Para fazer/ }).click();
    const cardAlunoParaFazer = page.locator('.rounded-3xl').filter({ hasText: 'Frações e Porcentagem no Dia a Dia' });
    await expect(cardAlunoParaFazer).toBeVisible();
  });
});

