import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

// Helper para login de aluno
async function loginAluno(page: any, codigoTurma = '7a-mat', nomeAluno = 'Lucas Oliveira', pin = '1420') {
  await page.goto('/aluno');
  await page.getByPlaceholder('Ex: 7A-MAT').fill(codigoTurma);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText(nomeAluno).click();
  for (const digito of pin) {
    await page.getByRole('button', { name: digito, exact: true }).click();
  }
  await expect(page).toHaveURL(/\/aluno\/painel/);
  await expect(page.getByText(`Olá, ${nomeAluno}!`)).toBeVisible();
}

test.describe('Portal do Aluno', () => {
  test('A1: Login do aluno com tentativa incorreta e sucesso', async ({ page }) => {
    await page.goto('/aluno');

    // Código da turma "7a-mat" vira 7A-MAT
    const inputCodigo = page.getByPlaceholder('Ex: 7A-MAT');
    await inputCodigo.fill('7a-mat');
    await expect(inputCodigo).toHaveValue('7A-MAT');

    await page.getByRole('button', { name: 'Continuar' }).click();

    // Seleciona Lucas Oliveira
    await page.getByText('Lucas Oliveira').click();

    // Digita PIN 9999 no teclado da tela
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: '9', exact: true }).click();
    }

    // Espera mensagem de erro
    await expect(
      page.getByText('PIN incorreto. Você tem mais 4 tentativa(s).')
    ).toBeVisible();

    // Digita PIN correto 1420
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }

    // Valida painel do aluno
    await expect(page).toHaveURL(/\/aluno\/painel/);
    await expect(page.getByText('Olá, Lucas Oliveira!')).toBeVisible();

    // Captura A1-painel
    await page.screenshot({ path: 'e2e/evidencias/A1-painel.png' });
  });

  test('A2: Atividades para fazer no painel', async ({ page }) => {
    await loginAluno(page);

    // "Para fazer" mostra exatamente as 3 atividades esperadas
    await expect(page.getByText('Frações e Porcentagem no Dia a Dia')).toBeVisible();
    await expect(page.getByText('Prova: Alimentação e Sistema Digestório')).toBeVisible();
    await expect(page.getByText('Leitura, Acentuação e Classes de Palavras')).toBeVisible();

    // Geometria Básica NÃO aparece na página
    await expect(page.getByText('Geometria Básica')).toHaveCount(0);
  });

  test('A3: Exercício de Frações e Porcentagem com retentativa', async ({ page }) => {
    await loginAluno(page);

    // Abre a atividade de Frações através do botão Começar do cartão
    const cardFad = page.locator('.rounded-3xl').filter({ hasText: 'Frações e Porcentagem no Dia a Dia' });
    await cardFad.getByRole('button', { name: /Começar|Continuar/ }).click();

    // Q1: escolhe "3/8" + Confirmar -> "Mandou bem"; Próxima
    await page.locator('button').filter({ hasText: '3/8' }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await expect(page.getByText('Mandou bem')).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();

    // Q2: escolhe "25" + Confirmar -> "Não foi dessa vez" e diagnóstico
    await page.locator('button').filter({ hasText: '25' }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await expect(page.getByText('Não foi dessa vez')).toBeVisible();
    await expect(
      page.getByText('Você usou o número da porcentagem como se fosse o resultado')
    ).toBeVisible();

    // Captura A3-erro
    await page.screenshot({ path: 'e2e/evidencias/A3-erro.png' });

    // "Tentar novamente" -> "20" -> Confirmar -> "Mandou bem"
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.locator('button').filter({ hasText: '20' }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await expect(page.getByText('Mandou bem')).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();

    // Q3: "4/6"
    await page.locator('button').filter({ hasText: '4/6' }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();

    // Q4: "Verdadeiro"
    await page.locator('button').filter({ hasText: 'Verdadeiro' }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();

    // Q5: "R$ 45,00" -> Ver resultado
    await page.locator('button').filter({ hasText: 'R$ 45,00' }).click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.getByRole('button', { name: 'Ver resultado' }).click();

    // Tela final com 80%
    await expect(page.getByText('80%')).toBeVisible();

    // Captura A3-final
    await page.screenshot({ path: 'e2e/evidencias/A3-final.png' });
  });

  test('A4: Prova de Ciências com sigilo pedagógico e gabarito final', async ({ page }) => {
    await loginAluno(page);

    // Abre Prova de Ciências
    const cardProva = page.locator('.rounded-3xl').filter({ hasText: 'Prova: Alimentação e Sistema Digestório' });
    await cardProva.getByRole('button', { name: /Começar|Continuar/ }).click();

    const respostasProva = [
      'Na boca',
      'Proteínas',
      'Intestino delgado',
      'Feijão',
      'Porque ajudam o intestino a funcionar bem',
    ];

    for (let i = 0; i < respostasProva.length; i++) {
      const resp = respostasProva[i];
      await page.locator('button').filter({ hasText: resp }).click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();

      // Após cada confirmação: NÃO pode ter feedbacks informativos, apenas "Resposta registrada"
      await expect(page.getByText('Resposta registrada')).toBeVisible();
      await expect(page.getByText('Mandou bem')).toHaveCount(0);
      await expect(page.getByText('Onde prestar')).toHaveCount(0);
      await expect(page.getByText('Entenda a resposta')).toHaveCount(0);
      await expect(page.getByText('Não foi dessa vez')).toHaveCount(0);

      if (i < respostasProva.length - 1) {
        await page.getByRole('button', { name: 'Próxima' }).click();
      } else {
        await page.getByRole('button', { name: 'Finalizar prova' }).click();
      }
    }

    // Tela final: 80% e seção de gabarito
    await expect(page.getByText('80%')).toBeVisible();
    await expect(page.getByText(/Gabarito/i)).toBeVisible();

    // "Proteínas" marcada como escolhida errada e "Carboidratos" como a correta
    await expect(page.getByText('Proteínas', { exact: true })).toBeVisible();
    await expect(page.getByText('Carboidratos', { exact: true })).toBeVisible();
    await expect(page.getByText('Resposta correta', { exact: true })).toBeVisible();

    // Captura A4-final
    await page.screenshot({ path: 'e2e/evidencias/A4-final.png' });
  });

  test('A5: Consulta a prova encerrada com questões em branco', async ({ page }) => {
    await loginAluno(page);

    // Aba Concluídas
    await page.getByRole('button', { name: /Concluídas/ }).click();

    // Prova: Números Inteiros (encerrada) -> Ver resultado
    const card = page.locator('.rounded-3xl').filter({ hasText: 'Prova: Números Inteiros (encerrada)' });
    await card.getByRole('button', { name: 'Ver resultado' }).click();

    // O texto "Em branco" aparece 2 vezes e o placar mostra 1 acerto
    await expect(page.getByText('Em branco', { exact: true })).toHaveCount(2);
    const boxAcertos = page.locator('.rounded-2xl').filter({ hasText: 'Acertos' });
    await expect(boxAcertos.getByText('1', { exact: true })).toBeVisible();
    await expect(page.getByText('Você acertou')).toBeVisible();

    // Captura A5
    await page.screenshot({ path: 'e2e/evidencias/A5.png' });
  });

  test('A6: Persistência após F5 no meio da atividade', async ({ page }) => {
    await loginAluno(page);

    // Português
    const cardPort = page.locator('.rounded-3xl').filter({ hasText: 'Leitura, Acentuação e Classes de Palavras' });
    await cardPort.getByRole('button', { name: /Começar|Continuar/ }).click();

    // Responde Q1
    await page
      .locator('button')
      .filter({ hasText: 'Porque tinha se preparado e ficou protegida da chuva.' })
      .click();
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();

    // Recarrega a página
    await page.reload();

    // Mostra Questão 2
    await expect(page.getByText(/Questão 2 de 4/i)).toBeVisible();
  });

  test('A7: Bloqueio por 5 tentativas inválidas de PIN', async ({ page }) => {
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7a-mat');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Seleciona Beatriz Santos
    await page.getByText('Beatriz Santos').click();

    // Digita PIN 0000 5 vezes
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', { name: '0', exact: true }).click();
      }
      if (tentativa < 5) {
        await expect(
          page.getByText(new RegExp(`Você tem mais ${5 - tentativa} tentativa`))
        ).toBeVisible();
      }
    }

    // Na 5ª tentativa, aparece "Acesso bloqueado"
    await expect(page.getByText(/Acesso bloqueado/i)).toBeVisible();

    // Na 6ª vez com o PIN correto 3891, continua bloqueado
    for (const digito of '3891') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await expect(page.getByText(/Acesso bloqueado/i)).toBeVisible();
  });

  test('A8: Sem rolagem horizontal no painel do aluno', async ({ page }) => {
    await loginAluno(page);

    // Valida scrollWidth <= 390
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});
