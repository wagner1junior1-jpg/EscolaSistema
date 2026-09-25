import { test, expect, Page, ConsoleMessage } from '@playwright/test';

interface VerificacaoResultado {
  scrollWidth: number;
  clientWidth: number;
}

const VIEWPORTS = [
  { largura: 390, altura: 844, rotulo: '390px' },
  { largura: 1280, altura: 900, rotulo: '1280px' },
];

async function loginAluno(page: Page) {
  await page.goto('/aluno');
  await page.getByPlaceholder('Ex: 7A-MAT').fill('7A-MAT');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Lucas Oliveira').click();
  for (const digito of '1420') {
    await page.getByRole('button', { name: digito, exact: true }).click();
  }
  await expect(page).toHaveURL(/\/aluno\/painel/);
}

async function loginProfessor(page: Page) {
  await page.goto('/entrar');
  await page.getByPlaceholder('exemplo@demo.com').fill('ana@demo.com');
  await page.getByPlaceholder('••••••••').fill('demo123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/professor/);
}

async function loginDirecao(page: Page) {
  await page.goto('/entrar');
  await page.getByPlaceholder('exemplo@demo.com').fill('direcao@demo.com');
  await page.getByPlaceholder('••••••••').fill('demo123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/gestao/);
}

async function testarTela(
  page: Page,
  rota: string,
  nomeArquivo: string,
  largura: number,
  altura: number,
  tituloEsperado: string | RegExp
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  };
  const pageErrorHandler = (err: Error) => {
    pageErrors.push(err.message);
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);

  try {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto(rota);
    await page.waitForLoadState('networkidle');

    // 1. Título esperado por tela (getByRole('heading'))
    await expect(
      page.getByRole('heading', { name: tituloEsperado }).first(),
      `Título esperado "${tituloEsperado}" não encontrado em ${rota} (${largura}px)`
    ).toBeVisible();

    // 2. Falhar se aparecer texto de erro ("não encontrad", "erro", "sem permissão")
    const padroesErro = [
      /não encontrad/i,
      /sem permissão/i,
      /\berro ao\b/i,
      /\bfalha ao\b/i,
      /não foi possível/i,
    ];
    for (const padrao of padroesErro) {
      const elErro = page.locator('main, [role="main"], body').getByText(padrao);
      const count = await elErro.count();
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          await expect(
            elErro.nth(i),
            `Texto de erro "${padrao}" visível em ${rota} (${largura}px)`
          ).not.toBeVisible();
        }
      }
    }

    // 3. Checagem de rolagem horizontal
    const dimensoes: VerificacaoResultado = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // 4. Captura de tela
    await page.screenshot({
      path: `e2e/evidencias/telas/${nomeArquivo}-${largura}.png`,
    });

    // 5. Asserções
    expect(
      dimensoes.scrollWidth,
      `Rolagem horizontal detectada em ${rota} (${largura}px): scrollWidth=${dimensoes.scrollWidth}, clientWidth=${dimensoes.clientWidth}`
    ).toBeLessThanOrEqual(dimensoes.clientWidth);

    expect(
      consoleErrors,
      `Erro de console detectado em ${rota} (${largura}px): ${consoleErrors.join(', ')}`
    ).toEqual([]);

    expect(
      pageErrors,
      `Erro de página (pageerror) detectado em ${rota} (${largura}px): ${pageErrors.join(', ')}`
    ).toEqual([]);
  } finally {
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
  }
}

test.describe('Inspeção Visual e Responsiva de Telas (390px e 1280px)', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`Viewport ${vp.rotulo}`, () => {
      test(`Rotas Públicas — ${vp.rotulo}`, async ({ page }) => {
        await testarTela(page, '/', 'publica-home', vp.largura, vp.altura, 'SaberPontual');
        await testarTela(
          page,
          '/entrar',
          'publica-login-equipe',
          vp.largura,
          vp.altura,
          'Acesso da Equipe Escolar'
        );
        await testarTela(
          page,
          '/aluno',
          'publica-login-aluno',
          vp.largura,
          vp.altura,
          'Portal do Aluno'
        );
      });

      test(`Portal do Aluno — ${vp.rotulo}`, async ({ page }) => {
        await loginAluno(page);
        await testarTela(
          page,
          '/aluno/painel',
          'aluno-painel',
          vp.largura,
          vp.altura,
          /Olá, Lucas Oliveira!/i
        );
        await testarTela(
          page,
          '/aluno/atividade/ativ-demo-mat-frac',
          'aluno-player-exercicio',
          vp.largura,
          vp.altura,
          /Uma pizza/i
        );
        await testarTela(
          page,
          '/aluno/atividade/ativ-demo-cien-prova',
          'aluno-player-prova',
          vp.largura,
          vp.altura,
          /Em qual parte do corpo/i
        );
      });

      test(`Portal do Professor — ${vp.rotulo}`, async ({ page }) => {
        await loginProfessor(page);
        await testarTela(
          page,
          '/professor',
          'professor-dashboard',
          vp.largura,
          vp.altura,
          'Minhas Turmas'
        );
        await testarTela(
          page,
          '/professor/oferta/oferta-mat-7a?aba=atividades',
          'professor-oferta-atividades',
          vp.largura,
          vp.altura,
          '7º Ano A'
        );
        await testarTela(
          page,
          '/professor/oferta/oferta-mat-7a?aba=desempenho',
          'professor-oferta-desempenho',
          vp.largura,
          vp.altura,
          '7º Ano A'
        );
        await testarTela(
          page,
          '/professor/oferta/oferta-mat-7a?aba=recados',
          'professor-oferta-recados',
          vp.largura,
          vp.altura,
          '7º Ano A'
        );
        await testarTela(
          page,
          '/professor/atividade/ativ-demo-mat-frac',
          'professor-atividade-editor',
          vp.largura,
          vp.altura,
          'Configurações Gerais da Atividade'
        );
        await testarTela(
          page,
          '/professor/atividade/ativ-demo-mat-frac/resultados',
          'professor-atividade-resultados',
          vp.largura,
          vp.altura,
          'Frações e Porcentagem no Dia a Dia'
        );
        await testarTela(
          page,
          '/professor/oferta/oferta-mat-7a/aluno/aluno-7a-1',
          'professor-ficha-aluno',
          vp.largura,
          vp.altura,
          'Lucas Oliveira'
        );
      });

      test(`Portal da Gestão — ${vp.rotulo}`, async ({ page }) => {
        await loginDirecao(page);
        await testarTela(
          page,
          '/gestao?secao=inicio',
          'gestao-inicio',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=turmas',
          'gestao-turmas',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=disciplinas',
          'gestao-disciplinas',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=professores',
          'gestao-professores',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=alunos',
          'gestao-alunos',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=desempenho',
          'gestao-desempenho',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=atencao',
          'gestao-atencao',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=questoes_criticas',
          'gestao-questoes-criticas',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=mural',
          'gestao-mural',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=bimestres',
          'gestao-bimestres',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
        await testarTela(
          page,
          '/gestao?secao=escola',
          'gestao-escola',
          vp.largura,
          vp.altura,
          'Painel de Gestão'
        );
      });
    });
  }
});
