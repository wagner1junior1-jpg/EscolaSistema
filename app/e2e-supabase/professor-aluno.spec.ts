import { test, expect, type Page } from '@playwright/test';
import {
  CARIMBO,
  CODIGO_7A,
  LUCAS,
  OFERTA_MAT_7A,
  digitarPin,
  entrarAluno,
  entrarEquipe,
  semMensagemDeErro,
  vigiarSupabase,
} from './apoio';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Supabase — Professor e Aluno', () => {
  test('SP1: Ana abre o painel, a turma (3 abas) e o banco com dados do banco', async ({ page }) => {
    const rede = vigiarSupabase(page);
    await entrarEquipe(page, 'ana@demo.com');
    await expect(page).toHaveURL(/\/professor/);
    await expect(page.getByText(/Sincronizado com o BD/)).toBeVisible();
    await expect(page.getByText('Matemática').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await semMensagemDeErro(page);

    for (const aba of ['atividades', 'desempenho', 'recados']) {
      await page.goto(`/professor/oferta/${OFERTA_MAT_7A}?aba=${aba}`);
      await page.waitForLoadState('networkidle');
      await semMensagemDeErro(page);
    }
    await page.goto('/professor/banco');
    await page.waitForLoadState('networkidle');
    await semMensagemDeErro(page);
    rede.conferir();
  });

  test.describe.serial('atividade: criar, publicar, responder, ver resultado e corrigir texto', () => {
    let page: Page;
    let rede: ReturnType<typeof vigiarSupabase>;
    const titulo = `E2E Atividade ${CARIMBO}`;
    const respostasCarregar: string[] = [];

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      rede = vigiarSupabase(page);
      page.on('response', async (r) => {
        if (r.url().includes('/rpc/aluno_carregar_atividade')) respostasCarregar.push(await r.text());
      });
    });
    test.afterAll(async () => {
      await page.close();
    });

    test('SP2: Ana cria a atividade com 1 questão e publica', async () => {
      await entrarEquipe(page, 'ana@demo.com');
      await page.goto(`/professor/oferta/${OFERTA_MAT_7A}`);
      await page.getByRole('button', { name: 'Nova Atividade' }).click();
      await page.getByLabel('Título da Atividade *').fill(titulo);
      await page.getByLabel('Descrição / Orientações *').fill('Atividade da suíte E2E do Supabase de teste.');
      await page.getByRole('button', { name: 'Criar e editar questões' }).click();

      await page.getByRole('button', { name: 'Adicionar primeira questão' }).click();
      await page.getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...').fill('Quanto é 2 + 2?');
      await page.getByPlaceholder('Texto da alternativa A...').fill('4');
      await page.getByPlaceholder('Texto da alternativa B...').fill('5');
      await page.getByPlaceholder('Ex: O aluno esqueceu de inverter a fração ao dividir...').first().fill('Contou um a mais.');
      await page.getByPlaceholder('Texto da alternativa C...').fill('22');
      await page.getByPlaceholder('Texto da alternativa D...').fill('3');
      await page.getByRole('button', { name: 'Salvar atividade' }).click();
      await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();

      await page.locator('.rounded-2xl').filter({ hasText: titulo }).getByRole('button', { name: 'Publicar' }).click();
      await page.getByRole('button', { name: 'Publicar agora' }).click();
      await expect(page.getByText('Atividade publicada com sucesso!')).toBeVisible();
      await page.getByRole('button', { name: /Publicadas/ }).click();
      await expect(page.getByText(titulo)).toBeVisible();
      rede.conferir();
    });

    test('SP3: Lucas abre a atividade sem receber o gabarito, erra e vê o "por que errou"', async () => {
      await entrarAluno(page, CODIGO_7A, LUCAS.nome, LUCAS.pin);
      await page.locator('.rounded-3xl').filter({ hasText: titulo }).getByRole('button', { name: /Começar|Continuar/ }).click();
      await expect(page.getByText('Quanto é 2 + 2?')).toBeVisible();

      // Regra 6: antes de responder, o tráfego não traz a correta nem o diagnóstico
      expect(respostasCarregar.length).toBeGreaterThan(0);
      for (const corpo of respostasCarregar) {
        expect(corpo).not.toContain('Contou um a mais.');
        expect(corpo).not.toMatch(/"correta"\s*:\s*true/);
      }

      await page.locator('div[role="radiogroup"] button').filter({ hasText: '5' }).click();
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();
      await expect(page.getByText('Contou um a mais.')).toBeVisible();
      rede.conferir();
    });

    test('SP4: Ana vê o resultado (1 aluno, pegadinha na B) e corrige o texto da atividade publicada', async () => {
      await entrarEquipe(page, 'ana@demo.com');
      await page.goto(`/professor/oferta/${OFERTA_MAT_7A}?aba=atividades`);
      await page.getByRole('button', { name: /Publicadas/ }).click();
      await page.locator('.rounded-2xl').filter({ hasText: titulo }).getByRole('button', { name: 'Ver resultados' }).click();
      await expect(page).toHaveURL(/\/resultados/);
      await expect(page.getByText(/1\s+aluno respondeu/)).toBeVisible();
      await expect(page.getByText(/Pegadinha: Letra B \(1 aluno\)/)).toBeVisible();
      await semMensagemDeErro(page);

      await page.goto(`/professor/oferta/${OFERTA_MAT_7A}?aba=atividades`);
      await page.getByRole('button', { name: /Publicadas/ }).click();
      await page.locator('.rounded-2xl').filter({ hasText: titulo }).getByRole('button', { name: 'Editar textos' }).click();
      await expect(page.locator('input[type="radio"]').first()).toBeDisabled();
      await page.getByPlaceholder('Texto da alternativa A...').fill('4 (quatro)');
      await page.getByRole('button', { name: 'Salvar atividade' }).click();
      await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();
      rede.conferir();
    });
  });

  test('SP5: Ana publica recado na turma e o Lucas o vê', async ({ page }) => {
    const rede = vigiarSupabase(page);
    const titulo = `Recado E2E ${CARIMBO}`;
    await entrarEquipe(page, 'ana@demo.com');
    await page.goto(`/professor/oferta/${OFERTA_MAT_7A}?aba=recados`);
    await page.getByLabel('Título do Recado *').fill(titulo);
    await page.getByLabel('Mensagem *').fill('Recado da suíte E2E do Supabase de teste.');
    await page.getByRole('button', { name: 'Publicar recado' }).click();
    await expect(page.getByText(titulo)).toBeVisible();

    await entrarAluno(page, CODIGO_7A, LUCAS.nome, LUCAS.pin);
    await expect(page.getByText(titulo)).toBeVisible();
    rede.conferir();
  });

  test('SP6: Carlos não abre a turma da Ana nem a Gestão', async ({ page }) => {
    const rede = vigiarSupabase(page);
    await entrarEquipe(page, 'carlos@demo.com');
    await page.goto(`/professor/oferta/${OFERTA_MAT_7A}`);
    await expect(page.getByText(/permissão/i).first()).toBeVisible();
    await page.goto('/gestao');
    await expect(page.getByText(/Sem permissão/i)).toBeVisible();
    rede.conferir();
  });

  test('SA1: Lucas erra o PIN uma vez, entra com o certo e continua logado depois do F5', async ({ page }) => {
    const rede = vigiarSupabase(page);
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill(CODIGO_7A.toLowerCase());
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText(LUCAS.nome, { exact: true }).click();
    await digitarPin(page, '0000');
    await expect(page.getByText(/Você tem mais \d tentativa/)).toBeVisible();
    await digitarPin(page, LUCAS.pin);
    await expect(page).toHaveURL(/\/aluno\/painel/);
    await page.waitForLoadState('networkidle');
    await semMensagemDeErro(page);

    await page.reload();
    await expect(page).toHaveURL(/\/aluno\/painel/);
    await expect(page.getByText(`Olá, ${LUCAS.nome}!`)).toBeVisible();
    rede.conferir();
  });
});
