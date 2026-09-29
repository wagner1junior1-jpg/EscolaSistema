import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { MockBancoService } from '../mock/banco.mock';
import { resetDatabase, getDatabase, saveDatabase } from '../mock/db';
import { Questao, Atividade, Resposta } from '@/lib/types';
import { mediaDoAlunoNasAtividades } from '../calculos';

describe('Discursivas — Gravação, Validações e Correção no Mock (docs/ESPECIFICACAO.md 9.2, 9.3)', () => {
  const authService = new MockAuthService();
  const professorService = new MockProfessorService();
  const alunoService = new MockAlunoService();

  let tokenAluno7A: string;
  const questaoDiscursivaExercicioId = 'q-disc-mat-01';
  const questaoDiscursivaProvaId = 'q-disc-mat-prova-01';
  const atividadeProvaId = 'ativ-mat-prova-01';

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();

    const db = await getDatabase();

    // Adiciona questão discursiva à atividade ativ-mat-01 (modo: exercicio, oferta-mat-7a, prof: Ana)
    const qDiscEx: Questao = {
      id: questaoDiscursivaExercicioId,
      created_at: new Date().toISOString(),
      atividade_id: 'ativ-mat-01',
      ordem: 5,
      enunciado: 'Explique com suas palavras o conceito de equação do 1º grau.',
      tipo: 'discursiva',
      dica: 'Pense em equilíbrio de balança.',
      explicacao: 'Uma equação do 1º grau expressa uma igualdade envolvendo incógnitas com expoente 1.',
      resposta_esperada: 'Uma igualdade entre duas expressões algébricas onde a incógnita tem expoente 1.',
    };
    db.questoes.push(qDiscEx);

    // Cria atividade no modo prova para a oferta da Ana e adiciona uma questão discursiva
    const ativProva: Atividade = {
      id: atividadeProvaId,
      created_at: new Date().toISOString(),
      oferta_id: 'oferta-mat-7a',
      periodo_id: 'per-bim-3',
      titulo: 'Avaliação de Matemática',
      descricao: 'Prova bimestral',
      prazo: '2026-10-30',
      modo: 'prova',
      status: 'publicada',
      criado_por: 'usr-prof-ana',
    };
    db.atividades.push(ativProva);

    const qDiscProva: Questao = {
      id: questaoDiscursivaProvaId,
      created_at: new Date().toISOString(),
      atividade_id: atividadeProvaId,
      ordem: 1,
      enunciado: 'Demonstre passo a passo como resolver 2x + 4 = 10.',
      tipo: 'discursiva',
      dica: null,
      explicacao: 'Subtraia 4 dos dois lados: 2x = 6. Divida por 2: x = 3.',
      resposta_esperada: '2x = 6, portanto x = 3.',
    };
    db.questoes.push(qDiscProva);

    saveDatabase(db);

    // Login do aluno Lucas Oliveira (aluno-7a-1, PIN: 1420)
    const loginRes = await alunoService.login('aluno-7a-1', '1420');
    tokenAluno7A = loginRes.token;
  });

  // 1) Resposta válida gravada como pendente
  it('1) Resposta válida gravada como pendente', async () => {
    const texto = 'Uma equação é uma igualdade onde buscamos o valor desconhecido.';
    const res = await alunoService.responderDiscursiva(tokenAluno7A, questaoDiscursivaExercicioId, texto);

    expect(res.registrada).toBe(true);

    const db = await getDatabase();
    const gravada = db.respostas.find(
      (r) => r.aluno_id === 'aluno-7a-1' && r.questao_id === questaoDiscursivaExercicioId
    );

    expect(gravada).toBeDefined();
    expect(gravada?.texto_resposta).toBe(texto);
    expect(gravada?.correcao).toBe('pendente');
    expect(gravada?.pontuacao).toBeNull();
    expect(gravada?.alternativa_id).toBeNull();
    expect(gravada?.acertou).toBeNull();
    expect(gravada?.tentativas).toBe(1);
  });

  // 2) Texto vazio recusado; texto com 2001 caracteres recusado
  it('2) Texto vazio recusado; texto com 2001 caracteres recusado', async () => {
    // Vazio
    await expect(
      alunoService.responderDiscursiva(tokenAluno7A, questaoDiscursivaExercicioId, '')
    ).rejects.toThrow('A resposta não pode ser vazia');

    // Somente espaços
    await expect(
      alunoService.responderDiscursiva(tokenAluno7A, questaoDiscursivaExercicioId, '     ')
    ).rejects.toThrow('A resposta não pode ser vazia');

    // 2001 caracteres
    const textoLongo = 'a'.repeat(2001);
    await expect(
      alunoService.responderDiscursiva(tokenAluno7A, questaoDiscursivaExercicioId, textoLongo)
    ).rejects.toThrow('A resposta deve ter no máximo 2000 caracteres');

    // 2000 caracteres aceito
    const texto2000 = 'a'.repeat(2000);
    const res = await alunoService.responderDiscursiva(tokenAluno7A, questaoDiscursivaExercicioId, texto2000);
    expect(res.registrada).toBe(true);
  });

  // 3) Segunda resposta recusada
  it('3) Segunda resposta recusada', async () => {
    await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Primeira resposta enviada com sucesso.'
    );

    await expect(
      alunoService.responderDiscursiva(
        tokenAluno7A,
        questaoDiscursivaExercicioId,
        'Tentativa de segunda resposta.'
      )
    ).rejects.toThrow('Questão já respondida');
  });

  // 4) Modo prova não devolve a explicação
  it('4) Modo prova não devolve a explicação', async () => {
    // No modo prova
    const resProva = await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaProvaId,
      '2x = 6 logo x = 3'
    );
    expect(resProva.registrada).toBe(true);
    expect(resProva.explicacao).toBeUndefined();

    // No modo exercício (devolve explicação)
    const resEx = await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Minha resposta no exercício'
    );
    expect(resEx.registrada).toBe(true);
    expect(resEx.explicacao).toBe(
      'Uma equação do 1º grau expressa uma igualdade envolvendo incógnitas com expoente 1.'
    );
  });

  // 5) resposta_esperada nunca aparece na resposta ao aluno
  it('5) resposta_esperada nunca aparece na resposta ao aluno', async () => {
    const resEx = await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Tentativa de resposta'
    );
    expect((resEx as Record<string, unknown>).resposta_esperada).toBeUndefined();

    const resProva = await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaProvaId,
      'Resposta prova'
    );
    expect((resProva as Record<string, unknown>).resposta_esperada).toBeUndefined();

    const ativCarregada = await alunoService.carregarAtividade(tokenAluno7A, 'ativ-mat-01');
    for (const q of ativCarregada.questoes) {
      expect((q as unknown as Record<string, unknown>).resposta_esperada).toBeUndefined();
    }
  });

  // 6) O Carlos não lista nem corrige respostas da Ana (permissão negada)
  it('6) O Carlos não lista nem corrige respostas da Ana (permissão negada)', async () => {
    // Aluno responde questão da Ana
    await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Resposta para a professora Ana'
    );

    const db = await getDatabase();
    const respostaAna = db.respostas.find((r) => r.questao_id === questaoDiscursivaExercicioId)!;

    // Carlos faz login
    await authService.login('carlos@demo.com', 'demo123');

    // Tentativa de listar correções da atividade da Ana
    await expect(
      professorService.listarCorrecoesPendentes('ativ-mat-01')
    ).rejects.toThrow('Você não tem permissão para esta ação');

    // Tentativa de corrigir resposta da atividade da Ana
    await expect(
      professorService.corrigirResposta(respostaAna.id, 'certo', 'Tentativa indevida')
    ).rejects.toThrow('Você não tem permissão para esta ação');
  });

  // 7) Correção "parcial" grava pontuacao: 0.5
  it('7) Correção "parcial" grava pontuacao: 0.5', async () => {
    // Aluno responde questão
    await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Resposta parcialmente correta'
    );

    const db = await getDatabase();
    const resposta = db.respostas.find((r) => r.questao_id === questaoDiscursivaExercicioId)!;

    // Login da professora Ana
    await authService.login('ana@demo.com', 'demo123');

    // Correção parcial com comentário
    await professorService.corrigirResposta(
      resposta.id,
      'parcial',
      'Bom raciocínio, porém faltou a demonstração completa.'
    );

    const dbAtualizado = await getDatabase();
    const respostaAtualizada = dbAtualizado.respostas.find((r) => r.id === resposta.id)!;

    expect(respostaAtualizada.correcao).toBe('parcial');
    expect(respostaAtualizada.pontuacao).toBe(0.5);
    expect(respostaAtualizada.comentario_professor).toBe(
      'Bom raciocínio, porém faltou a demonstração completa.'
    );
    expect(respostaAtualizada.corrigido_por).toBe('usr-prof-ana');
    expect(respostaAtualizada.corrigido_em).toBeDefined();

    // Permite re-correção (mudando para "certo")
    await professorService.corrigirResposta(resposta.id, 'certo', 'Reavaliado: resposta completa!');
    const respostaReavaliada = (await getDatabase()).respostas.find((r) => r.id === resposta.id)!;
    expect(respostaReavaliada.correcao).toBe('certo');
    expect(respostaReavaliada.pontuacao).toBe(1);
    expect(respostaReavaliada.comentario_professor).toBe('Reavaliado: resposta completa!');
  });

  // 8) Depois de corrigida, a resposta sai da lista de pendentes
  it('8) Depois de corrigida, a resposta sai da lista de pendentes', async () => {
    // Aluno responde
    await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Resposta do aluno'
    );

    // Login da Profª Ana
    await authService.login('ana@demo.com', 'demo123');

    // Antes de corrigir: aparece na fila
    const pendentesAntes = await professorService.listarCorrecoesPendentes('ativ-mat-01');
    expect(pendentesAntes).toHaveLength(1);
    expect(pendentesAntes[0].aluno_nome).toBe('Lucas Oliveira');
    expect(pendentesAntes[0].texto_resposta).toBe('Resposta do aluno');
    expect(pendentesAntes[0].resposta_esperada).toBe(
      'Uma igualdade entre duas expressões algébricas onde a incógnita tem expoente 1.'
    );

    // Corrige a resposta
    await professorService.corrigirResposta(pendentesAntes[0].resposta_id, 'certo');

    // Depois de corrigir: fila vazia
    const pendentesDepois = await professorService.listarCorrecoesPendentes('ativ-mat-01');
    expect(pendentesDepois).toHaveLength(0);
  });

  // Validações adicionais de recusa cruzada objetiva <-> discursiva
  it('deve recusar discursiva no responder objetivo e recusar objetiva no responderDiscursiva', async () => {
    // Questão objetiva existente na ativ-mat-01
    const db = await getDatabase();
    const questaoObjetiva = db.questoes.find(
      (q) => q.atividade_id === 'ativ-mat-01' && q.tipo !== 'discursiva'
    )!;

    // Tenta responder questão objetiva com responderDiscursiva
    await expect(
      alunoService.responderDiscursiva(tokenAluno7A, questaoObjetiva.id, 'Tentativa de texto')
    ).rejects.toThrow('Esta questão não é discursiva');

    // Tenta responder questão discursiva com responder objetivo
    await expect(
      alunoService.responder(tokenAluno7A, questaoDiscursivaExercicioId, 'alt-qualquer')
    ).rejects.toThrow('Esta questão é discursiva e não aceita alternativas');
  });

  // 9) listarCorrecoesFeitas retorna respostas corrigidas e omite pendentes
  it('listarCorrecoesFeitas retorna respostas corrigidas com detalhes e omite pendentes', async () => {
    // Aluno responde questão discursiva
    await alunoService.responderDiscursiva(
      tokenAluno7A,
      questaoDiscursivaExercicioId,
      'Resposta para validação de corrigidas'
    );

    // Login da Profª Ana
    await authService.login('ana@demo.com', 'demo123');

    // Inicialmente, feitas está vazio
    const feitasAntes = await professorService.listarCorrecoesFeitas('ativ-mat-01');
    expect(feitasAntes).toHaveLength(0);

    // Obtém pendente e corrige como 'parcial' com comentário
    const pendentes = await professorService.listarCorrecoesPendentes('ativ-mat-01');
    expect(pendentes).toHaveLength(1);
    await professorService.corrigirResposta(
      pendentes[0].resposta_id,
      'parcial',
      'Boa tentativa, mas incompleto.'
    );

    // Agora feitas tem 1 item com os dados corretos
    const feitasDepois = await professorService.listarCorrecoesFeitas('ativ-mat-01');
    expect(feitasDepois).toHaveLength(1);
    expect(feitasDepois[0].aluno_nome).toBe('Lucas Oliveira');
    expect(feitasDepois[0].correcao).toBe('parcial');
    expect(feitasDepois[0].pontuacao).toBe(0.5);
    expect(feitasDepois[0].comentario_professor).toBe('Boa tentativa, mas incompleto.');
    expect(feitasDepois[0].texto_resposta).toBe('Resposta para validação de corrigidas');
    expect(feitasDepois[0].resposta_esperada).toBe(
      'Uma igualdade entre duas expressões algébricas onde a incógnita tem expoente 1.'
    );
  });

  // 10) listarCorrecoesFeitas recusa acesso para professor que não é dono da oferta
  it('listarCorrecoesFeitas recusa acesso para professor que não é dono da oferta', async () => {
    // Carlos faz login (ele não é professor de ativ-mat-01)
    await authService.login('carlos@demo.com', 'demo123');

    await expect(
      professorService.listarCorrecoesFeitas('ativ-mat-01')
    ).rejects.toThrow('Você não tem permissão para esta ação');
  });
});

describe('Discursivas — Cálculo de Média e Aproveitamento', () => {
  const criarResp = (
    id: string,
    questaoId: string,
    acertou: boolean | null,
    correcao?: 'certo' | 'parcial' | 'errado' | 'pendente',
    pontuacao?: number | null
  ): Resposta => ({
    id,
    aluno_id: 'aluno-1',
    questao_id: questaoId,
    acertou,
    acertou_final: acertou,
    alternativa_id: acertou !== null ? 'alt-1' : null,
    respondida_em: '',
    tentativas: 1,
    created_at: '',
    correcao: correcao || null,
    pontuacao: pontuacao !== undefined ? pontuacao : null,
  });

  const criarQuestoes = (): Questao[] => [
    {
      id: 'q1',
      atividade_id: 'ativ-1',
      ordem: 1,
      enunciado: 'Questão 1',
      tipo: 'objetiva',
      dica: null,
      explicacao: null,
      created_at: '',
    },
    {
      id: 'q2',
      atividade_id: 'ativ-1',
      ordem: 2,
      enunciado: 'Questão 2',
      tipo: 'objetiva',
      dica: null,
      explicacao: null,
      created_at: '',
    },
    {
      id: 'q3',
      atividade_id: 'ativ-1',
      ordem: 3,
      enunciado: 'Questão 3',
      tipo: 'discursiva',
      dica: null,
      explicacao: null,
      created_at: '',
    },
  ];

  it('2 objetivas certas + 1 discursiva parcial = 2,5/3 = 83,3%', () => {
    const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'ativ-1', status: 'publicada' }];
    const questoes = criarQuestoes();

    const respostas: Resposta[] = [
      criarResp('r1', 'q1', true),
      criarResp('r2', 'q2', true),
      criarResp('r3', 'q3', null, 'parcial', 0.5),
    ];

    const res = mediaDoAlunoNasAtividades(ativs, questoes, respostas);
    expect(res.atividades_avaliadas).toBe(1);
    expect(res.soma_acertos).toBe(2.5);
    expect(res.soma_questoes).toBe(3);
    expect(res.media).toBe(83.3);
  });

  it('com a discursiva pendente, a atividade fica fora da média', () => {
    const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'ativ-1', status: 'publicada' }];
    const questoes = criarQuestoes();

    const respostasComPendente: Resposta[] = [
      criarResp('r1', 'q1', true),
      criarResp('r2', 'q2', true),
      criarResp('r3', 'q3', null, 'pendente', null),
    ];

    const res = mediaDoAlunoNasAtividades(ativs, questoes, respostasComPendente);
    // Atividade fica fora da média
    expect(res.atividades_avaliadas).toBe(0);
    expect(res.soma_acertos).toBe(0);
    expect(res.soma_questoes).toBe(0);
    expect(res.media).toBeNull();
  });

  it('depois de corrigida, entra na média', () => {
    const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'ativ-1', status: 'publicada' }];
    const questoes = criarQuestoes();

    const respostasPendente: Resposta[] = [
      criarResp('r1', 'q1', true),
      criarResp('r2', 'q2', true),
      criarResp('r3', 'q3', null, 'pendente', null),
    ];

    // Antes da correção: fora da média
    const resAntes = mediaDoAlunoNasAtividades(ativs, questoes, respostasPendente);
    expect(resAntes.atividades_avaliadas).toBe(0);
    expect(resAntes.media).toBeNull();

    // Depois da correção: entra na média
    const respostasCorrigidas: Resposta[] = [
      criarResp('r1', 'q1', true),
      criarResp('r2', 'q2', true),
      criarResp('r3', 'q3', null, 'parcial', 0.5),
    ];

    const resDepois = mediaDoAlunoNasAtividades(ativs, questoes, respostasCorrigidas);
    expect(resDepois.atividades_avaliadas).toBe(1);
    expect(resDepois.soma_acertos).toBe(2.5);
    expect(resDepois.soma_questoes).toBe(3);
    expect(resDepois.media).toBe(83.3);
  });
});

describe('Discursivas — Fluxo do Professor e Banco de Questões (Fases P1, P2 e P3)', () => {
  const authService = new MockAuthService();
  const professorService = new MockProfessorService();
  const bancoService = new MockBancoService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
    await authService.login('ana@demo.com', 'demo123'); // Ana leciona Matemática 7º Ano
  });

  // T1: adicionarDoBanco preserva tipo, imagem_url e resposta_esperada
  it('T1: adicionarDoBanco preserva tipo, imagem_url e resposta_esperada na questão da atividade', async () => {
    const questaoBanco = await bancoService.salvarQuestaoBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-eq1',
      tipo: 'discursiva',
      dificuldade: 'medio',
      enunciado: 'Explique o princípio aditivo das equações.',
      imagem_url: 'https://exemplo.com/balanca.png',
      resposta_esperada: 'Ao somar ou subtrair o mesmo número de ambos os lados, a igualdade se mantém.',
      alternativas: [],
    });

    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      periodo_id: 'per-bim-3',
      titulo: 'Atividade Rascunho Discursiva',
      descricao: 'Instruções da atividade',
      modo: 'exercicio',
      prazo: '2026-11-01',
    });

    await bancoService.adicionarDoBanco(ativ.id, [questaoBanco.id]);

    const ativAtualizada = await professorService.obterAtividade(ativ.id);
    expect(ativAtualizada).toBeDefined();
    const questaoCriada = ativAtualizada!.questoes[0];

    expect(questaoCriada).toBeDefined();
    expect(questaoCriada.tipo).toBe('discursiva');
    expect(questaoCriada.resposta_esperada).toBe(
      'Ao somar ou subtrair o mesmo número de ambos os lados, a igualdade se mantém.'
    );
    expect(questaoCriada.imagem_url).toBe('https://exemplo.com/balanca.png');
    expect(questaoCriada.banco_questao_id).toBe(questaoBanco.id);
  });

  // T2: salvarQuestoes aceita discursiva sem alternativas e persiste dados
  it('T2: salvarQuestoes aceita discursiva sem alternativas e persiste resposta_esperada e tipo', async () => {
    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      periodo_id: 'per-bim-3',
      titulo: 'Atividade Mista',
      descricao: 'Instruções da atividade',
      modo: 'exercicio',
      prazo: '2026-11-01',
    });

    await professorService.salvarQuestoes(ativ.id, [
      {
        enunciado: 'Qual o valor de x em 2x = 8?',
        tipo: 'discursiva',
        resposta_esperada: 'x = 4',
        alternativas: [],
      },
    ]);

    const ativAtualizada = await professorService.obterAtividade(ativ.id);
    expect(ativAtualizada).toBeDefined();
    expect(ativAtualizada!.questoes).toHaveLength(1);
    expect(ativAtualizada!.questoes[0].tipo).toBe('discursiva');
    expect(ativAtualizada!.questoes[0].resposta_esperada).toBe('x = 4');

    const db = await getDatabase();
    const qDb = db.questoes.find((q) => q.id === ativAtualizada!.questoes[0].id);
    expect(qDb?.tipo).toBe('discursiva');
    expect(qDb?.resposta_esperada).toBe('x = 4');
  });

  // T3: salvarQuestoes e publicarAtividade recusam questão discursiva sem resposta esperada
  it('T3: salvarQuestoes e publicarAtividade recusam discursiva sem resposta esperada', async () => {
    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      periodo_id: 'per-bim-3',
      titulo: 'Atividade Incompleta',
      descricao: 'Instruções da atividade',
      modo: 'exercicio',
      prazo: '2026-11-01',
    });

    // 1. salvarQuestoes rejeita discursiva sem resposta esperada
    await expect(
      professorService.salvarQuestoes(ativ.id, [
        {
          enunciado: 'Discorra sobre o teorema de Pitágoras.',
          tipo: 'discursiva',
          resposta_esperada: '   ',
          alternativas: [],
        },
      ])
    ).rejects.toThrow(/resposta esperada/i);

    // 2. publicarAtividade também valida e rejeita questão discursiva sem resposta esperada
    const db = await getDatabase();
    db.questoes.push({
      id: 'q-legada-sem-resp',
      created_at: new Date().toISOString(),
      atividade_id: ativ.id,
      ordem: 1,
      enunciado: 'Questão legada sem gabarito',
      tipo: 'discursiva',
      resposta_esperada: null,
      dica: null,
      explicacao: null,
    });

    await expect(professorService.publicarAtividade(ativ.id)).rejects.toThrow(
      /resposta esperada/i
    );
  });

  // T4: fichaAluno traz campos tipo, texto_resposta, correcao e pontuacao_discursiva
  it('T4: fichaAluno traz campos tipo, texto_resposta, correcao e pontuacao_discursiva', async () => {
    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      periodo_id: 'per-bim-3',
      titulo: 'Atividade Avaliada',
      descricao: 'Instruções da atividade',
      modo: 'exercicio',
      prazo: '2026-11-01',
    });

    await professorService.salvarQuestoes(ativ.id, [
      {
        enunciado: 'O que é uma fração equivalente?',
        tipo: 'discursiva',
        resposta_esperada: 'Frações que representam a mesma quantidade.',
        alternativas: [],
      },
    ]);

    const ativAtualizada = await professorService.obterAtividade(ativ.id);
    expect(ativAtualizada).toBeDefined();
    const qSalva = ativAtualizada!.questoes[0];

    await professorService.publicarAtividade(ativ.id);

    // Aluno responde a discursiva
    const alunoService = new MockAlunoService();
    const loginAluno = await alunoService.login('aluno-7a-1', '1420');
    await alunoService.responderDiscursiva(loginAluno.token, qSalva.id, 'Frações com o mesmo valor.');

    // Professor consulta ficha do aluno
    const ficha = await professorService.fichaAluno('oferta-mat-7a', 'aluno-7a-1');
    expect(ficha).toBeDefined();

    const ativItem = ficha.atividades.find((a) => a.atividade_id === ativ.id);
    expect(ativItem).toBeDefined();

    const qDisc = ativItem?.questoes.find((q) => q.questao_id === qSalva.id);
    expect(qDisc).toBeDefined();
    expect(qDisc?.tipo).toBe('discursiva');
    expect(qDisc?.texto_resposta).toBe('Frações com o mesmo valor.');
    expect(qDisc?.correcao).toBe('pendente');
    expect(qDisc?.pontuacao_discursiva).toBeNull();
  });

  // T5: duplicarAtividade preserva tipo e resposta_esperada
  it('T5: duplicarAtividade preserva tipo e resposta_esperada das questões discursivas', async () => {
    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      periodo_id: 'per-bim-3',
      titulo: 'Atividade Original',
      descricao: 'Instruções da atividade',
      modo: 'exercicio',
      prazo: '2026-11-01',
    });

    await professorService.salvarQuestoes(ativ.id, [
      {
        enunciado: 'Explique o método da substituição.',
        tipo: 'discursiva',
        resposta_esperada: 'Isola uma incógnita e substitui na outra equação.',
        alternativas: [],
      },
    ]);

    const duplicada = await professorService.duplicarAtividade(ativ.id, 'oferta-mat-7a');
    expect(duplicada.id).not.toBe(ativ.id);

    const detalheDuplicada = await professorService.obterAtividade(duplicada.id);
    expect(detalheDuplicada).toBeDefined();
    expect(detalheDuplicada!.questoes).toHaveLength(1);
    expect(detalheDuplicada!.questoes[0].tipo).toBe('discursiva');
    expect(detalheDuplicada!.questoes[0].resposta_esperada).toBe(
      'Isola uma incógnita e substitui na outra equação.'
    );
  });
});

