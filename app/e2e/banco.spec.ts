import { test, expect, Page, ConsoleMessage } from '@playwright/test';

test.describe.serial('Fase H1 — Banco de Questões (B1 a B8)', () => {
  let page: Page;
  const consoleErrorsAluno: string[] = [];
  const pageErrorsAluno: string[] = [];
  let trackingAluno = false;

  let b4AtividadeId = '';
  let questaoEnunciadoOriginal = '';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    page.on('console', (msg: ConsoleMessage) => {
      if (trackingAluno && msg.type() === 'error') {
        consoleErrorsAluno.push(msg.text());
      }
    });

    page.on('pageerror', (err: Error) => {
      if (trackingAluno) {
        pageErrorsAluno.push(err.message);
      }
    });

    // 0. Restaura dados demo para garantir estado limpo
    await page.goto('/entrar');
    await page.getByRole('button', { name: /Restaurar dados de demonstração/i }).click();
    await expect(page.getByText('Dados de demonstração restaurados.')).toBeVisible();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('B1: Professora Ana entra no Banco e consulta questões por matéria e assunto', async () => {
    // Login Ana
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('ana@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/professor/);

    // Navega para o Banco de Questões
    await page.getByRole('button', { name: 'Banco de questões' }).click();
    await expect(page).toHaveURL(/\/professor\/banco/);

    // Dropdown Matéria e Série mostra "Matemática · 7º Ano" selecionado
    const selectMateriaSerie = page.locator('select').first();
    await expect(selectMateriaSerie).toHaveValue(/mat.*7/i);

    // Lista mostra 7 questões
    await expect(page.getByText('Exibindo 7 questão(ões) no banco')).toBeVisible();

    // Filtra por assunto "Porcentagem"
    const selectAssunto = page.locator('select').nth(1);
    await selectAssunto.selectOption({ label: 'Porcentagem' });

    // Lista cai para 5 questões
    await expect(page.getByText('Exibindo 5 questão(ões) no banco')).toBeVisible();

    // Captura evidência B1
    await page.screenshot({ path: 'e2e/evidencias/B1.png' });
  });

  test('B2: Professor Carlos vê apenas Ciências · 7º Ano e 2 questões de Digestão', async () => {
    // Login Carlos
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('carlos@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/professor/);

    // Abre Banco de Questões
    await page.getByRole('button', { name: 'Banco de questões' }).click();
    await expect(page).toHaveURL(/\/professor\/banco/);

    // O select de Matéria e Série deve ter APENAS 1 opção: "Ciências · 7º Ano"
    const selectMateriaSerie = page.locator('select').first();
    const options = await selectMateriaSerie.locator('option').allInnerTexts();
    expect(options.length).toBe(1);
    expect(options[0]).toContain('Ciências');
    expect(options[0]).toContain('7º Ano');
    expect(options[0]).not.toContain('6º Ano');
    expect(options[0]).not.toContain('Matemática');

    // Lista mostra 2 questões de Digestão
    await expect(page.getByText('Exibindo 2 questão(ões) no banco')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Digestão' }).first()).toBeVisible();

    // Captura evidência B2
    await page.screenshot({ path: 'e2e/evidencias/B2.png' });
  });

  test('B3: Ana cria nova questão no banco e contador de Porcentagem sobe para 6', async () => {
    // Login Ana novamente
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('ana@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/professor/);

    await page.goto('/professor/banco');
    await expect(page.getByText('Exibindo 7 questão(ões) no banco')).toBeVisible();

    // Clica no botão Nova questão
    await page.getByRole('button', { name: 'Nova questão' }).click();

    // Preenche o modal de criação de questão
    await expect(page.getByRole('heading', { name: /Nova Questão no Banco/i })).toBeVisible();

    // Seleciona Assunto Porcentagem
    await page.locator('form select').nth(0).selectOption({ label: 'Porcentagem' });

    // Dificuldade Fácil
    await page.locator('form select').nth(1).selectOption({ value: 'facil' });

    // Enunciado
    await page
      .getByPlaceholder('Digite a pergunta ou situação-problema...')
      .fill('Qual é o valor de 25% de 80?');

    // Alternativas
    await page.getByPlaceholder('Texto da alternativa A...').fill('20');
    await page.getByPlaceholder('Texto da alternativa B...').fill('15');
    await page
      .getByPlaceholder(/Por que errou na letra B\?/)
      .fill('Subtraiu 5 ao invés de calcular um quarto.');

    await page.getByPlaceholder('Texto da alternativa C...').fill('25');
    await page
      .getByPlaceholder(/Por que errou na letra C\?/)
      .fill('Confundiu a porcentagem com o valor absoluto.');

    await page.getByPlaceholder('Texto da alternativa D...').fill('40');
    await page
      .getByPlaceholder(/Por que errou na letra D\?/)
      .fill('Calculou 50% em vez de 25%.');

    // Dica e Explicação
    await page
      .getByPlaceholder(/Lembre-se que 25%/)
      .fill('Divida 80 por 4.');
    await page
      .getByPlaceholder(/Para achar 25%/)
      .fill('25% equivale a um quarto (1/4). 80 dividido por 4 é 20.');

    // Salva a questão
    await page.getByRole('button', { name: 'Salvar no banco' }).click();
    await expect(page.getByText('Questão criada com sucesso no banco!')).toBeVisible();

    // Filtra por Porcentagem e confere que agora exibe 6 questões
    const selectAssunto = page.locator('select').nth(1);
    await selectAssunto.selectOption({ label: 'Porcentagem' });
    await expect(page.getByText('Exibindo 6 questão(ões) no banco')).toBeVisible();

    // Captura evidência B3
    await page.screenshot({ path: 'e2e/evidencias/B3.png' });
  });

  test('B4: Ana sorteia 3 questões do banco para uma atividade em rascunho', async () => {
    // Abre a oferta de Matemática do 7º Ano A
    await page.goto('/professor/oferta/oferta-mat-7a');

    // Cria nova atividade
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await page.getByLabel('Título da Atividade *').fill('Atividade B4 Banco');
    await page.getByLabel('Descrição / Orientações *').fill('Exercício com 3 questões sorteadas do banco');
    await page.getByRole('button', { name: 'Criar e editar questões' }).click();

    // Captura o ID da atividade pela URL
    await expect(page).toHaveURL(/\/professor\/atividade\/([a-zA-Z0-9_-]+)/);
    const url = page.url();
    const match = url.match(/\/professor\/atividade\/([a-zA-Z0-9_-]+)/);
    expect(match).not.toBeNull();
    b4AtividadeId = match![1];

    // Clica no botão "Adicionar do banco"
    await page.getByRole('button', { name: 'Adicionar do banco' }).first().click();

    // Abre modal do Banco de Questões
    await expect(page.getByRole('heading', { name: 'Banco de Questões' })).toBeVisible();

    // Alterna para a aba "Sortear questões"
    await page.getByRole('button', { name: 'Sortear questões' }).click();

    // Escolhe o assunto "Porcentagem"
    await page.getByLabel('Selecione o Assunto *').selectOption({ label: 'Porcentagem' });

    // Informa 2 fáceis e 1 média
    await page.getByLabel('Fáceis').fill('2');
    await page.getByLabel('Médias').fill('1');

    // Clica em sortear e adicionar
    await page.getByRole('button', { name: 'Sortear e adicionar' }).click();
    await expect(page.getByText(/sorteada\(s\) e adicionada\(s\)!/)).toBeVisible();

    // Atividade agora tem exatamente 3 questões
    await expect(page.getByRole('heading', { name: 'Questões (3)' })).toBeVisible();

    // Guarda o enunciado da primeira questão para testar imutabilidade no B5
    questaoEnunciadoOriginal = await page
      .getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...')
      .nth(0)
      .inputValue();
    expect(questaoEnunciadoOriginal.length).toBeGreaterThan(5);

    // Se houver alterações para salvar, clica em Salvar atividade
    const btnSalvar = page.getByRole('button', { name: 'Salvar atividade' });
    if (await btnSalvar.isEnabled()) {
      await btnSalvar.click();
      await expect(page.getByText('Atividade salva com sucesso!')).toBeVisible();
    }

    // Captura evidência B4
    await page.screenshot({ path: 'e2e/evidencias/B4.png' });
  });

  test('B5: Ana edita uma das questões no banco e a atividade do B4 mantém cópia imutável', async () => {
    // Ana vai ao Banco de Questões
    await page.goto('/professor/banco');

    // Filtra por Porcentagem
    const selectAssunto = page.locator('select').nth(1);
    await selectAssunto.selectOption({ label: 'Porcentagem' });

    // Localiza e abre edição da questão que possui o enunciado sorteado
    const cardQuestao = page
      .locator('.border-slate-200')
      .filter({ hasText: questaoEnunciadoOriginal })
      .first();
    await cardQuestao.getByRole('button', { name: 'Editar' }).click();

    // Altera o enunciado no banco acrescentando marcador
    await expect(page.getByRole('heading', { name: /Editar Questão do Banco/i })).toBeVisible();
    const textarea = page.getByPlaceholder('Digite a pergunta ou situação-problema...');
    await textarea.fill(questaoEnunciadoOriginal + ' [TEXTO MODIFICADO NO BANCO]');

    // Salva as alterações no banco
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Questão atualizada com sucesso!')).toBeVisible();

    // Volta para o editor da atividade do B4
    await page.goto(`/professor/atividade/${b4AtividadeId}`);

    // Verifica que todas as questões da atividade permanecem com o texto original (cópia imutável)
    const inputs = await page
      .getByPlaceholder('Digite aqui o problema ou enunciado completo da questão...')
      .all();
    const enunciados = await Promise.all(inputs.map((inp) => inp.inputValue()));
    expect(enunciados).toContain(questaoEnunciadoOriginal);
    expect(enunciados.join(' ')).not.toContain('[TEXTO MODIFICADO NO BANCO]');

    // Captura evidência B5
    await page.screenshot({ path: 'e2e/evidencias/B5.png' });
  });

  test('B6: Ana publica a atividade e Adicionar do banco fica bloqueado na UI e no serviço', async () => {
    // Abre a oferta para publicar a atividade
    await page.goto('/professor/oferta/oferta-mat-7a');

    // Localiza o card da atividade em rascunho e clica em Publicar
    const card = page.locator('.rounded-2xl, .border-slate-200').filter({ hasText: 'Atividade B4 Banco' }).first();
    await card.getByRole('button', { name: 'Publicar' }).click();
    await page.getByRole('button', { name: 'Publicar agora' }).click();
    await expect(page.getByText('Atividade publicada com sucesso!')).toBeVisible();

    // Abre a tela de edição da atividade agora publicada
    await page.goto(`/professor/atividade/${b4AtividadeId}`);
    await expect(page.getByText('PUBLICADA', { exact: true })).toBeVisible();

    // O botão "Adicionar do banco" NÃO deve estar visível
    await expect(page.getByRole('button', { name: 'Adicionar do banco' })).not.toBeVisible();

    // Tentar chamar o serviço diretamente pelo console rejeita com erro de validação
    const tentativaChamada = await page.evaluate(async (ativId) => {
      try {
        const win = window as unknown as { bancoService?: { adicionarDoBanco: (id: string, qIds: string[]) => Promise<void> } };
        if (!win.bancoService) {
          return { sucesso: false, erro: 'bancoService não encontrado no window' };
        }
        await win.bancoService.adicionarDoBanco(ativId, ['q-demo-porc-1']);
        return { sucesso: true, erro: null };
      } catch (err: unknown) {
        return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
      }
    }, b4AtividadeId);

    expect(tentativaChamada.sucesso).toBe(false);
    expect(tentativaChamada.erro).toMatch(/rascunho|publicad/i);

    // Captura evidência B6
    await page.screenshot({ path: 'e2e/evidencias/B6.png' });
  });

  test('B7: Direção consulta o banco em modo somente leitura (sem botões de alteração)', async () => {
    // Login Direção
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('direcao@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/gestao/);

    // Clica no menu "Banco de Questões"
    await page.getByRole('button', { name: 'Banco de Questões' }).click();

    // Seleciona Matemática (deve ver 8 questões: 7 iniciais + 1 criada no B3)
    const selectDisciplina = page.getByLabel('Disciplina');
    await selectDisciplina.selectOption({ label: 'Matemática' });
    await expect(page.getByText('Exibindo 8 questão(ões)')).toBeVisible();

    // Seleciona Ciências (deve ver 2 questões)
    await selectDisciplina.selectOption({ label: 'Ciências' });
    await expect(page.getByText('Exibindo 2 questão(ões)')).toBeVisible();

    // Confere que NÃO existem botões de criação ou alteração (somente leitura para gestão)
    await expect(page.getByRole('button', { name: 'Nova questão' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Arquivar' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Duplicar para editar' })).not.toBeVisible();

    // Captura evidência B7
    await page.screenshot({ path: 'e2e/evidencias/B7.png' });
  });

  test('B8: Aluno Lucas responde às 3 questões sorteadas sem erros de console', async () => {
    // Inicia rastreamento estrito de erros na tela do aluno
    trackingAluno = true;
    consoleErrorsAluno.length = 0;
    pageErrorsAluno.length = 0;

    // Login Lucas no portal do aluno
    await page.goto('/aluno');
    await page.getByPlaceholder('Ex: 7A-MAT').fill('7A-MAT');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByText('Lucas Oliveira').click();
    for (const digito of '1420') {
      await page.getByRole('button', { name: digito, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/aluno\/painel/);

    // Abre a atividade criada no B4
    const cardAtividade = page
      .locator('.rounded-3xl')
      .filter({ hasText: 'Atividade B4 Banco' });
    await expect(cardAtividade).toBeVisible();
    await cardAtividade.getByRole('button', { name: /Começar|Continuar/ }).click();
    await expect(page).toHaveURL(new RegExp(`/aluno/atividade/${b4AtividadeId}`));

    // Responde às 3 questões
    for (let i = 1; i <= 3; i++) {
      // Escolhe alternativa A
      const alt = page.locator('[role="radiogroup"] button').first();
      await expect(alt).toBeVisible();
      await alt.click();

      // Confirma resposta
      await page.getByRole('button', { name: 'Confirmar resposta' }).click();

      if (i < 3) {
        // Avança para próxima
        await page.getByRole('button', { name: /Próxima/i }).click();
      } else {
        // Finaliza atividade
        await page.getByRole('button', { name: /Ver resultado|Finalizar/i }).click();
      }
    }

    // Tela final ou placar exibido
    await expect(page.getByRole('heading', { name: 'Revisão das Questões' })).toBeVisible();

    // NENHUM erro de console ou de página ocorreu
    expect(consoleErrorsAluno).toEqual([]);
    expect(pageErrorsAluno).toEqual([]);

    // Captura evidência B8
    await page.screenshot({ path: 'e2e/evidencias/B8.png' });
  });

  test('B9: Professora Ana gera 20 questões por IA (com subjetivas), revisa e salva no Banco', async () => {
    // Login Ana
    await page.goto('/entrar');
    await page.getByPlaceholder('exemplo@demo.com').fill('ana@demo.com');
    await page.getByPlaceholder('••••••••').fill('demo123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/professor/);

    await page.goto('/professor/banco');

    // Clica no botão "Cadastrar por IA"
    const btnCadastrarIA = page.getByRole('button', { name: 'Cadastrar por IA' });
    await expect(btnCadastrarIA).toBeVisible();
    await btnCadastrarIA.click();

    // Modal aberto com título "Cadastrar Questões por IA"
    await expect(page.getByRole('heading', { name: 'Cadastrar Questões por IA' })).toBeVisible();

    // Confere cabeçalho de limite e aviso de privacidade
    await expect(page.getByText('Quantidade de Questões (Limite de 20 por vez)')).toBeVisible();
    await expect(page.getByText(/Não envie fotos com nomes/i)).toBeVisible();

    // Clica em "Gerar 20 questões com IA"
    const btnGerar = page.getByRole('button', { name: 'Gerar 20 questões com IA' });
    await expect(btnGerar).toBeVisible();
    await btnGerar.click();

    // Aguarda transição para a Tela de Revisão
    await expect(page.getByRole('heading', { name: /Revisão das Questões Geradas/i })).toBeVisible();
    await expect(page.getByText('20 Questões Geradas')).toBeVisible();

    // Confere que inicialmente as questões aparecem em formato de 1 linha e expande ao clicar
    await expect(page.getByText('Subjetiva (Discursiva)').first()).toBeVisible();
    await expect(page.getByText('Objetiva').first()).toBeVisible();
    await expect(page.getByText(/\(Matemática - 7º Ano\)/).first()).toBeVisible();

    // Clica para abrir os detalhes das questões geradas
    await page.getByRole('dialog').getByRole('button', { name: 'Expandir todas' }).click();
    await expect(page.getByText('Resposta Esperada (Gabarito do professor):').first()).toBeVisible();
    await expect(page.getByText('Correta').first()).toBeVisible();
    await expect(page.getByText(/Questão 1:/i)).toHaveCount(0);

    await page.screenshot({ path: 'e2e/evidencias/B9-revisao-ia.png' });

    // Clica em "Aprovar" na primeira questão (com exact: true para não casar com "Aprovar todas")
    const btnAprovarPrimeira = page.getByRole('button', { name: 'Aprovar', exact: true }).first();
    await btnAprovarPrimeira.click();
    await expect(page.getByText('Salva no Banco').first()).toBeVisible();

    // Clica em "Aprovar todas para o Banco" (botão superior do resumo)
    await page.getByRole('button', { name: 'Aprovar todas para o Banco' }).first().click();

    // Modal fecha e volta para a listagem do banco
    await expect(page.getByRole('heading', { name: 'Banco de Questões' })).toBeVisible();

    // Captura evidência B9
    await page.screenshot({ path: 'e2e/evidencias/B9.png' });
  });
});

