import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockRelatorioService } from '../mock/relatorio.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase } from '../mock/db';

describe('Integração e Comunicação entre Portais: Gestão (Diretor/Coordenação), Professor e Aluno', () => {
  const authService = new MockAuthService();
  const gestaoService = new MockGestaoService();
  const professorService = new MockProfessorService();
  const relatorioService = new MockRelatorioService();
  const alunoService = new MockAlunoService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
  });

  it('1. Fluxo Diretor -> Professor & Aluno: criação de turma, oferta, aluno e aviso institucional', async () => {
    // === ETAPA A: Diretor cria estrutura escolar ===
    await authService.login('direcao@demo.com', 'demo123');

    // 1. Cria nova turma
    const novaTurma = await gestaoService.criarTurma({
      escola_id: 'esc-001',
      nome: '8º Ano C - 2026',
      serie: '8º Ano',
      segmento: 'fund2',
      ano_letivo: 2026,
      codigo_acesso: '8ANO-C',
      ativa: true,
    });
    expect(novaTurma.id).toBeTruthy();

    // 2. Cria nova disciplina
    const novaDisciplina = await gestaoService.criarDisciplina('Robótica e Tecnologia');
    expect(novaDisciplina.id).toBeTruthy();

    // 3. Obtém o professor e cria oferta vinculando à nova turma e disciplina
    const professores = await gestaoService.listarProfessores();
    const profAna = professores.find((p) => p.email === 'ana@demo.com')!;
    expect(profAna).toBeDefined();

    const novaOferta = await gestaoService.criarOferta({
      turma_id: novaTurma.id,
      disciplina_id: novaDisciplina.id,
      professor_id: profAna.id,
    });
    expect(novaOferta.id).toBeTruthy();

    // 4. Cadastra novo aluno na turma criada
    const { aluno: novoAluno, pin_puro: pinAluno } = await gestaoService.cadastrarAluno({
      escola_id: 'esc-001',
      turma_id: novaTurma.id,
      nome_completo: 'Lucas Medeiros da Silva',
      numero_chamada: 1,
      ativo: true,
    });
    expect(novoAluno.id).toBeTruthy();
    expect(pinAluno).toHaveLength(4);

    // 5. Diretor publica aviso institucional para toda a escola
    const avisoDiretoria = await gestaoService.criarAvisoEscola({
      titulo: 'Boas-vindas ao Novo Bimestre',
      mensagem: 'Sejam bem-vindos ao novo período letivo!',
      prioridade: 'alta',
    });
    expect(avisoDiretoria.id).toBeTruthy();

    // === ETAPA B: Professor acessa o portal e vê a nova oferta ===
    await authService.login('ana@demo.com', 'demo123');
    const minhasOfertas = await professorService.minhasOfertas();
    const ofertaEncontrada = minhasOfertas.find((o) => o.id === novaOferta.id);

    expect(ofertaEncontrada).toBeDefined();
    expect(ofertaEncontrada?.turma_nome).toBe('8º Ano C - 2026');
    expect(ofertaEncontrada?.disciplina_nome).toBe('Robótica e Tecnologia');
    expect(ofertaEncontrada?.turma_codigo).toBe('8ANO-C');

    // === ETAPA C: Aluno acessa o portal do aluno com código da turma e PIN ===
    const alunosDaTurma = await alunoService.listarTurma('8ANO-C');
    expect(alunosDaTurma).toHaveLength(1);
    expect(alunosDaTurma[0].id).toBe(novoAluno.id);
    expect(alunosDaTurma[0].nome_completo).toBe('Lucas Medeiros da Silva');

    const sessaoAluno = await alunoService.login(novoAluno.id, pinAluno);
    expect(sessaoAluno.token).toBeTruthy();
    expect(sessaoAluno.aluno.nome_completo).toBe('Lucas Medeiros da Silva');

    // Aluno recebe o aviso institucional criado pela direção
    const avisosAluno = await alunoService.avisos(sessaoAluno.token);
    const avisoEscolaRecebido = avisosAluno.find((a) => a.id === avisoDiretoria.id);
    expect(avisoEscolaRecebido).toBeDefined();
    expect(avisoEscolaRecebido?.titulo).toBe('Boas-vindas ao Novo Bimestre');
  });

  it('2. Fluxo Professor -> Aluno: publicação de atividade, questões e recado de turma', async () => {
    // Login do professor
    await authService.login('ana@demo.com', 'demo123');

    // Oferta existente da Ana: oferta-mat-7a (Turma: turma-7a-2026, Código: 7ANOA)
    const periodos = await gestaoService.listarPeriodos();
    const periodoAtivo = periodos.find((p) => p.ativo) || periodos[0];

    // 1. Professor cria atividade
    const atividade = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Desafio Semanal de Equações',
      descricao: 'Resolva com atenção',
      prazo: '2026-10-15',
      periodo_id: periodoAtivo.id,
      modo: 'exercicio',
    });

    // 2. Professor adiciona questão
    await professorService.salvarQuestoes(atividade.id, [
      {
        enunciado: 'Quanto é 2x + 4 = 10?',
        dica: 'Isole o x',
        explicacao: '2x = 6 logo x = 3',
        dificuldade: 'facil',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: 'x = 3', correta: true, por_que_errou: null },
          { letra: 'B', texto: 'x = 5', correta: false, por_que_errou: 'Subtraiu errado' },
          { letra: 'C', texto: 'x = 2', correta: false, por_que_errou: 'Dividiu errado' },
          { letra: 'D', texto: 'x = 7', correta: false, por_que_errou: 'Somou em vez de subtrair' },
        ],
      },
    ]);

    // 3. Enquanto estiver como rascunho, NÃO aparece para o aluno
    const sessaoAluno = await alunoService.login('aluno-7a-1', '1420');
    let ativsAluno = await alunoService.atividadesPendentes(sessaoAluno.token);
    expect(ativsAluno.some((a) => a.id === atividade.id)).toBe(false);

    // 4. Professor publica a atividade
    await professorService.publicarAtividade(atividade.id);

    // 5. Professor posta recado exclusivo para a turma
    const recadoTurma = await professorService.criarRecadoTurma('oferta-mat-7a', {
      titulo: 'Atividade Publicada',
      mensagem: 'A atividade de equações já está liberada no portal!',
      prioridade: 'media',
    });

    // 6. Aluno agora visualiza a atividade publicada e o recado
    ativsAluno = await alunoService.atividadesPendentes(sessaoAluno.token);
    const ativVisivel = ativsAluno.find((a) => a.id === atividade.id);
    expect(ativVisivel).toBeDefined();
    expect(ativVisivel?.titulo).toBe('Desafio Semanal de Equações');
    expect(ativVisivel?.concluida).toBe(false);

    const avisosAluno = await alunoService.avisos(sessaoAluno.token);
    const recadoRecebido = avisosAluno.find((a) => a.id === recadoTurma.id);
    expect(recadoRecebido).toBeDefined();
    expect(recadoRecebido?.titulo).toBe('Atividade Publicada');
  });

  it('3. Fluxo Aluno -> Professor & Direção: resolução de atividade atualiza mapa de calor, relatórios docentes e gestão escolar', async () => {
    // 1. Professor cria e publica uma atividade com 2 questões
    await authService.login('ana@demo.com', 'demo123');
    const periodos = await gestaoService.listarPeriodos();
    const periodoAtivo = periodos.find((p) => p.ativo) || periodos[0];

    const novaAtiv = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Avaliação Diagnóstica de Frações',
      descricao: 'Responda com atenção às questões.',
      prazo: '2026-11-20',
      periodo_id: periodoAtivo.id,
      modo: 'exercicio',
    });

    await professorService.salvarQuestoes(novaAtiv.id, [
      {
        enunciado: 'Quanto é 1/2 + 1/4?',
        dica: 'Encontre o MMC',
        explicacao: '2/4 + 1/4 = 3/4',
        dificuldade: 'facil',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: '3/4', correta: true, por_que_errou: null },
          { letra: 'B', texto: '2/6', correta: false, por_que_errou: 'Somou denominadores' },
        ],
      },
      {
        enunciado: 'Quanto é 3/5 de 50?',
        dica: 'Multiplique 50 por 3 e divida por 5',
        explicacao: '50 * 3 / 5 = 30',
        dificuldade: 'medio',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: '30', correta: true, por_que_errou: null },
          { letra: 'B', texto: '15', correta: false, por_que_errou: 'Calculou metade' },
        ],
      },
    ]);

    await professorService.publicarAtividade(novaAtiv.id);

    // 2. Aluno Lucas (aluno-7a-1) acessa a atividade e responde
    const sessaoAluno = await alunoService.login('aluno-7a-1', '1420');
    const ativCarregada = await alunoService.carregarAtividade(sessaoAluno.token, novaAtiv.id);
    expect(ativCarregada.questoes).toHaveLength(2);

    // Responde questão 1 com alternativa correta (letra A)
    const q1 = ativCarregada.questoes[0];
    const alt1 = q1.alternativas.find((a) => a.letra === 'A')!;
    await alunoService.responder(sessaoAluno.token, q1.id, alt1.id);

    // Responde questão 2 com alternativa incorreta (letra B)
    const q2 = ativCarregada.questoes[1];
    const alt2 = q2.alternativas.find((a) => a.letra === 'B')!;
    await alunoService.responder(sessaoAluno.token, q2.id, alt2.id);

    // Verifica que para o aluno a atividade agora consta como concluída
    const pendentes = await alunoService.atividadesPendentes(sessaoAluno.token);
    const ativNoPainel = pendentes.find((a) => a.id === novaAtiv.id);
    expect(ativNoPainel).toBeDefined();
    expect(ativNoPainel?.concluida).toBe(true);
    expect(ativNoPainel?.aproveitamento).toBe(50); // 1 acerto em 2 questões = 50%

    // === COMUNICAÇÃO COM O PORTAL DO PROFESSOR ===
    await authService.login('ana@demo.com', 'demo123');

    // 1. Mapa de calor da atividade reflete as respostas do aluno
    const mapaCalor = await professorService.mapaDeCalor(novaAtiv.id);
    expect(mapaCalor.total_alunos_responderam).toBe(1);
    expect(mapaCalor.questoes).toHaveLength(2);

    const m1 = mapaCalor.questoes.find((q) => q.questao_id === q1.id)!;
    expect(m1.total_respostas).toBe(1);
    expect(m1.porcentagem_acerto).toBe(100);

    const m2 = mapaCalor.questoes.find((q) => q.questao_id === q2.id)!;
    expect(m2.total_respostas).toBe(1);
    expect(m2.porcentagem_acerto).toBe(0);

    // 2. Ficha individual do aluno na oferta registra a atividade recém-feita
    const fichaAluno = await professorService.fichaAluno('oferta-mat-7a', 'aluno-7a-1');
    expect(fichaAluno.aluno.id).toBe('aluno-7a-1');
    const registroNaAtiv = fichaAluno.atividades.find((h) => h.atividade_id === novaAtiv.id);
    expect(registroNaAtiv).toBeDefined();
    expect(registroNaAtiv?.status_aluno).toBe('concluida');
    expect(registroNaAtiv?.aproveitamento).toBe(50);
    expect(registroNaAtiv?.questoes).toHaveLength(2);

    // 3. Relatório de desempenho da turma na oferta do professor
    const relatorioOferta = await professorService.desempenhoOferta('oferta-mat-7a', periodoAtivo.id);
    const alunoNoRelatorio = relatorioOferta.alunos.find((a) => a.aluno_id === 'aluno-7a-1');
    expect(alunoNoRelatorio).toBeDefined();
    expect(alunoNoRelatorio?.media).not.toBeNull();
    expect(alunoNoRelatorio?.atividades.length).toBeGreaterThan(0);

    // === COMUNICAÇÃO COM O PORTAL DA GESTÃO (DIRETOR) ===
    await authService.login('direcao@demo.com', 'demo123');

    // 1. Visão geral da escola calcula aproveitamento médio real e contagem de publicadas
    const visaoGeral = await relatorioService.visaoGeralEscola();
    expect(visaoGeral.total_alunos).toBeGreaterThan(0);
    expect(visaoGeral.total_atividades_publicadas).toBeGreaterThan(0);
    expect(visaoGeral.aproveitamento_medio).not.toBeNull();

    // 2. Desempenho geral por turmas
    const turmasDesempenho = await relatorioService.desempenhoTurmas(periodoAtivo.id);
    expect(turmasDesempenho.length).toBeGreaterThan(0);
    const turma7A = turmasDesempenho.find((t) => t.turma_nome.includes('7º Ano A'));
    expect(turma7A).toBeDefined();
    expect(turma7A?.aproveitamento_medio).not.toBeNull();
  });

  it('4. Fluxo Gestão -> Aluno & Professor: atualização de dados cadastrais e reset de PIN', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    // 1. Direção altera nome do aluno
    const alunoAtualizado = await gestaoService.atualizarAluno('aluno-7a-1', {
      nome_completo: 'Pedro Santos Albuquerque',
    });
    expect(alunoAtualizado.nome_completo).toBe('Pedro Santos Albuquerque');

    // 2. Direção reseta PIN do aluno
    const { pin_puro: novoPin } = await gestaoService.gerarOuResetarPin('aluno-7a-1');
    expect(novoPin).toHaveLength(4);

    // 3. Tentativa de login com PIN antigo falha
    await expect(alunoService.login('aluno-7a-1', '1420')).rejects.toThrow('PIN incorreto');

    // 4. Login com novo PIN funciona
    const novaSessao = await alunoService.login('aluno-7a-1', novoPin);
    expect(novaSessao.token).toBeTruthy();
    expect(novaSessao.aluno.nome_completo).toBe('Pedro Santos Albuquerque');

    // 5. Professor enxerga o novo nome do aluno atualizado pela direção
    await authService.login('ana@demo.com', 'demo123');
    const ficha = await professorService.fichaAluno('oferta-mat-7a', 'aluno-7a-1');
    expect(ficha.aluno.nome_completo).toBe('Pedro Santos Albuquerque');
  });

  it('5. Segregação e entrega de avisos: institucional da Gestão vs recado de turma do Professor', async () => {
    // Direção posta aviso para toda a escola
    await authService.login('direcao@demo.com', 'demo123');
    const avisoGeral = await gestaoService.criarAvisoEscola({
      titulo: 'Reunião de Pais Geral',
      mensagem: 'Reunião geral nesta sexta-feira.',
      prioridade: 'alta',
    });

    // Professora Ana posta recado exclusivo para o 7º Ano A
    await authService.login('ana@demo.com', 'demo123');
    const recado7A = await professorService.criarRecadoTurma('oferta-mat-7a', {
      titulo: 'Tragam régua e compasso',
      mensagem: 'Aula prática de geometria amanhã.',
      prioridade: 'media',
    });

    // Aluno do 7º Ano A (Lucas, aluno-7a-1)
    const sessao7A = await alunoService.login('aluno-7a-1', '1420');
    const avisosLucas = await alunoService.avisos(sessao7A.token);
    expect(avisosLucas.some((a) => a.id === avisoGeral.id)).toBe(true);
    expect(avisosLucas.some((a) => a.id === recado7A.id)).toBe(true);

    // Aluno de outra turma (ex: 6º Ano B - CIEN6B)
    const alunosTurma6 = await alunoService.listarTurma('CIEN6B');
    if (alunosTurma6.length > 0) {
      const aluno6 = alunosTurma6[0];
      // Direção reseta pin dele para testar
      await authService.login('direcao@demo.com', 'demo123');
      const { pin_puro: pin6 } = await gestaoService.gerarOuResetarPin(aluno6.id);

      const sessao6B = await alunoService.login(aluno6.id, pin6);
      const avisos6B = await alunoService.avisos(sessao6B.token);
      // Recebe o aviso da escola
      expect(avisos6B.some((a) => a.id === avisoGeral.id)).toBe(true);
      // NÃO recebe o recado exclusivo da turma do 7º A
      expect(avisos6B.some((a) => a.id === recado7A.id)).toBe(false);
    }
  });

  it('6. Modo Prova: sigilo rigoroso durante execução e liberação de gabarito para Aluno e Professor', async () => {
    // 1. Professora cria prova
    await authService.login('ana@demo.com', 'demo123');
    const periodos = await gestaoService.listarPeriodos();
    const periodoAtivo = periodos.find((p) => p.ativo) || periodos[0];

    const prova = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Prova Bimestral de Geometria',
      descricao: 'Responda sem consulta.',
      prazo: '2026-11-30',
      periodo_id: periodoAtivo.id,
      modo: 'prova',
    });

    await professorService.salvarQuestoes(prova.id, [
      {
        enunciado: 'Qual a soma dos ângulos internos de um triângulo?',
        dica: null,
        explicacao: 'A soma é sempre 180 graus',
        dificuldade: 'facil',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: '180°', correta: true, por_que_errou: null },
          { letra: 'B', texto: '360°', correta: false, por_que_errou: '360 é de quadrilátero' },
        ],
      },
      {
        enunciado: 'Um triângulo equilátero tem quantos lados iguais?',
        dica: null,
        explicacao: 'Equilátero = 3 lados congruentes',
        dificuldade: 'facil',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: '3', correta: true, por_que_errou: null },
          { letra: 'B', texto: '2', correta: false, por_que_errou: 'Isósceles tem 2' },
        ],
      },
    ]);

    await professorService.publicarAtividade(prova.id);

    // 2. Aluno inicia a prova
    const sessaoAluno = await alunoService.login('aluno-7a-1', '1420');
    const provaAberta = await alunoService.carregarAtividade(sessaoAluno.token, prova.id);

    // Responde apenas a primeira questão
    const q1 = provaAberta.questoes[0];
    const alt1 = q1.alternativas.find((a) => a.letra === 'A')!;
    const resp1 = await alunoService.responder(sessaoAluno.token, q1.id, alt1.id);

    // No modo prova, a resposta imediata devolve apenas { registrada: true, modo: 'prova' }, sem gabarito
    expect(resp1).toEqual({ modo: 'prova', registrada: true });

    // Se tentar carregar a prova ainda incompleta, questão respondida NÃO exibe gabarito nem explicação
    const provaEmAndamento = await alunoService.carregarAtividade(sessaoAluno.token, prova.id);
    const q1EmAndamento = provaEmAndamento.questoes.find((q) => q.id === q1.id)!;
    expect(q1EmAndamento.respondida).toBe(true);
    expect(q1EmAndamento.acertou).toBeUndefined();
    expect(q1EmAndamento.alternativa_correta_id).toBeUndefined();
    expect(q1EmAndamento.explicacao).toBeUndefined();

    // Se tentar obter resultado da prova enquanto incompleta, lança erro
    await expect(alunoService.resultadoProva(sessaoAluno.token, prova.id)).rejects.toThrow(
      'Termine todas as questões para ver o resultado.'
    );

    // Aluno conclui a questão 2
    const q2 = provaAberta.questoes[1];
    const alt2 = q2.alternativas.find((a) => a.letra === 'A')!;
    await alunoService.responder(sessaoAluno.token, q2.id, alt2.id);

    // Agora que concluiu todas as questões da prova, o resultado detalhado é liberado
    const resultado = await alunoService.resultadoProva(sessaoAluno.token, prova.id);
    expect(resultado.total_questoes).toBe(2);
    expect(resultado.acertos).toBe(2);
    expect(resultado.aproveitamento).toBe(100);

    // Professor acessa mapa de calor e vê a prova do aluno corrigida
    await authService.login('ana@demo.com', 'demo123');
    const mapa = await professorService.mapaDeCalor(prova.id);
    expect(mapa.total_alunos_responderam).toBe(1);
    expect(mapa.questoes).toHaveLength(2);
    expect(mapa.questoes[0].porcentagem_acerto).toBe(100);
    expect(mapa.questoes[1].porcentagem_acerto).toBe(100);
  });

  it('7. Inativação de turma ou aluno pela Direção bloqueia acesso imediato no Portal do Aluno', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    // 1. Direção inativa a turma 7A
    const turmas = await gestaoService.listarTurmas();
    const turma7A = turmas.find((t) => t.codigo_acesso === '7A-MAT')!;
    await gestaoService.atualizarTurma(turma7A.id, { ativa: false });

    // 2. Aluno da turma 7A tenta login e é impedido
    await expect(alunoService.login('aluno-7a-1', '1420')).rejects.toThrow(
      'Sua turma está inativa. Procure a secretaria da escola.'
    );

    // 3. Direção reativa a turma, mas inativa o aluno
    await gestaoService.atualizarTurma(turma7A.id, { ativa: true });
    await gestaoService.atualizarAluno('aluno-7a-1', { ativo: false });

    // 4. Aluno inativo tenta login e é impedido
    await expect(alunoService.login('aluno-7a-1', '1420')).rejects.toThrow(
      'Aluno não encontrado.'
    );
  });

  it('8. Sincronização em tempo real: assinarMudancas notifica ouvintes quando qualquer portal altera o banco', async () => {
    const { assinarMudancas } = await import('../mock/db');
    let chamadasNotificacao = 0;

    const desassinar = assinarMudancas(() => {
      chamadasNotificacao++;
    });

    // Ação no Portal da Gestão (Direção)
    await authService.login('direcao@demo.com', 'demo123');
    await gestaoService.criarAvisoEscola({
      titulo: 'Aviso Teste Sincronização',
      mensagem: 'Mensagem de teste',
      prioridade: 'baixa',
    });

    expect(chamadasNotificacao).toBeGreaterThanOrEqual(1);
    const contagemAposGestao = chamadasNotificacao;

    // Ação no Portal do Professor
    await authService.login('ana@demo.com', 'demo123');
    await professorService.criarRecadoTurma('oferta-mat-7a', {
      titulo: 'Recado Teste Sincronização',
      mensagem: 'Mensagem de teste do professor',
      prioridade: 'baixa',
    });

    expect(chamadasNotificacao).toBeGreaterThan(contagemAposGestao);

    desassinar();
  });
});

