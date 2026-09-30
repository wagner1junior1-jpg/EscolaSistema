import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase, assinarMudancas } from '../mock/db';

describe('Sincronização Ponta a Ponta: Dados dos Alunos -> Professores', () => {
  const authService = new MockAuthService();
  const professorService = new MockProfessorService();
  const alunoService = new MockAlunoService();

  let tokenAlunoLucas: string;
  const ofertaMat7A = 'oferta-mat-7a';
  const alunoIdLucas = 'aluno-7a-1';

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();

    // Login do aluno Lucas do 7º Ano A (PIN: 1420)
    const loginAluno = await alunoService.login(alunoIdLucas, '1420');
    tokenAlunoLucas = loginAluno.token;
  });

  it('1. Respostas objetivas do aluno chegam instantaneamente ao Mapa de Calor e Desempenho do Professor', async () => {
    // Professora Ana Paula cria uma atividade com 2 questões objetivas
    await authService.login('ana@demo.com', 'demo123');
    const atividade = await professorService.criarAtividade(ofertaMat7A, {
      titulo: 'Atividade de Sincronização Objetiva',
      descricao: 'Teste de sincronização em tempo real',
      prazo: '2026-11-20',
      periodo_id: 'per-bim-3',
      modo: 'exercicio',
    });

    await professorService.salvarQuestoes(atividade.id, [
      {
        enunciado: 'Questão 1: Quanto é 5 x 5?',
        tipo: 'objetiva',
        dificuldade: 'facil',
        alternativas: [
          { letra: 'A', texto: '25', correta: true, por_que_errou: null },
          { letra: 'B', texto: '20', correta: false, por_que_errou: 'Erro de tabuada' },
        ],
      },
      {
        enunciado: 'Questão 2: Quanto é 10 / 2?',
        tipo: 'objetiva',
        dificuldade: 'facil',
        alternativas: [
          { letra: 'A', texto: '5', correta: true, por_que_errou: null },
          { letra: 'B', texto: '2', correta: false, por_que_errou: 'Subtraiu em vez de dividir' },
        ],
      },
    ]);

    await professorService.publicarAtividade(atividade.id);

    // O Aluno carrega e responde as 2 questões
    const ativCarregada = await alunoService.carregarAtividade(tokenAlunoLucas, atividade.id);
    const q1 = ativCarregada.questoes[0];
    const q2 = ativCarregada.questoes[1];

    const alt1A = q1.alternativas.find((a) => a.letra === 'A')!;
    const alt2B = q2.alternativas.find((a) => a.letra === 'B')!;

    // Aluno acerta Q1 e erra Q2
    await alunoService.responder(tokenAlunoLucas, q1.id, alt1A.id);
    await alunoService.responder(tokenAlunoLucas, q2.id, alt2B.id);

    // === VERIFICAÇÃO NA VISÃO DO PROFESSOR ===
    await authService.login('ana@demo.com', 'demo123');

    // 1. Mapa de Calor da atividade
    const mapa = await professorService.mapaDeCalor(atividade.id);
    expect(mapa.total_alunos_responderam).toBe(1);
    expect(mapa.questoes).toHaveLength(2);

    const q1Mapa = mapa.questoes.find((q) => q.questao_id === q1.id);
    expect(q1Mapa?.total_respostas).toBe(1);
    expect(q1Mapa?.porcentagem_acerto).toBe(100);

    const q2Mapa = mapa.questoes.find((q) => q.questao_id === q2.id);
    expect(q2Mapa?.total_respostas).toBe(1);
    expect(q2Mapa?.porcentagem_acerto).toBe(0);
    expect(q2Mapa?.distrator_mais_escolhido?.letra).toBe('B');

    // 2. Ficha pedagógica individual do aluno
    const ficha = await professorService.fichaAluno(ofertaMat7A, alunoIdLucas);
    const ativFicha = ficha.atividades.find((a) => a.atividade_id === atividade.id);
    expect(ativFicha).toBeDefined();
    expect(ativFicha?.status_aluno).toBe('concluida');
    expect(ativFicha?.aproveitamento).toBe(50); // 1 acerto de 2 = 50%
  });

  it('2. Respostas discursivas chegam imediatamente para a fila de correção pendente do professor', async () => {
    await authService.login('ana@demo.com', 'demo123');
    const atividade = await professorService.criarAtividade(ofertaMat7A, {
      titulo: 'Atividade de Sincronização Discursiva',
      descricao: 'Teste discursiva',
      prazo: '2026-11-20',
      periodo_id: 'per-bim-3',
      modo: 'exercicio',
    });

    await professorService.salvarQuestoes(atividade.id, [
      {
        enunciado: 'Explique por que todo quadrado é também um retângulo.',
        tipo: 'discursiva',
        resposta_esperada: 'Porque possui quatro ângulos retos.',
        alternativas: [],
      },
    ]);

    await professorService.publicarAtividade(atividade.id);

    const ativAluno = await alunoService.carregarAtividade(tokenAlunoLucas, atividade.id);
    const qDisc = ativAluno.questoes[0];

    // Aluno envia resposta discursiva
    await alunoService.responderDiscursiva(
      tokenAlunoLucas,
      qDisc.id,
      'Porque ambos têm 4 ângulos de 90 graus.'
    );

    // === PROFESSOR ENXERGA NA FILA DE CORREÇÕES PENDENTES ===
    await authService.login('ana@demo.com', 'demo123');
    const pendentes = await professorService.listarCorrecoesPendentes(atividade.id);
    expect(pendentes.length).toBeGreaterThanOrEqual(1);

    const itemPendente = pendentes.find((p) => p.questao_id === qDisc.id && p.aluno_id === alunoIdLucas);
    expect(itemPendente).toBeDefined();
    expect(itemPendente?.texto_resposta).toBe('Porque ambos têm 4 ângulos de 90 graus.');
    expect(itemPendente?.aluno_nome).toContain('Lucas');

    // Professora avalia e envia nota
    const respostaId = (await getDatabase()).respostas.find(
      (r) => r.questao_id === qDisc.id && r.aluno_id === alunoIdLucas
    )!.id;

    await professorService.corrigirResposta(respostaId, 'certo', 'Excelente raciocínio geométrico!', 100);

    // Verifica que saiu da fila de pendentes e entrou na de corrigidas
    const pendentesApos = await professorService.listarCorrecoesPendentes(atividade.id);
    expect(pendentesApos.some((p) => p.resposta_id === respostaId)).toBe(false);

    const feitas = await professorService.listarCorrecoesFeitas(atividade.id);
    const itemFeito = feitas.find((f) => f.resposta_id === respostaId);
    expect(itemFeito).toBeDefined();
    expect(itemFeito?.nota).toBe(100);
    expect(itemFeito?.correcao).toBe('certo');
  });

  it('3. Eventos em tempo real notificam ouvintes do professor quando o aluno responde', async () => {
    // Professora cria uma nova atividade
    await authService.login('ana@demo.com', 'demo123');
    const ativRealtime = await professorService.criarAtividade(ofertaMat7A, {
      titulo: 'Atividade Teste Realtime',
      descricao: 'Teste',
      prazo: '2026-11-20',
      periodo_id: 'per-bim-3',
      modo: 'exercicio',
    });

    await professorService.salvarQuestoes(ativRealtime.id, [
      {
        enunciado: 'Quanto é 3 x 3?',
        tipo: 'objetiva',
        alternativas: [
          { letra: 'A', texto: '9', correta: true, por_que_errou: null },
          { letra: 'B', texto: '6', correta: false, por_que_errou: 'Somou' },
        ],
      },
    ]);

    await professorService.publicarAtividade(ativRealtime.id);

    const db = await getDatabase();
    const qNova = db.questoes.find((q) => q.atividade_id === ativRealtime.id)!;
    const altNova = db.alternativas.find((a) => a.questao_id === qNova.id && a.correta)!;

    let eventoDisparado = false;

    // Simula a tela do professor ouvindo atualizações
    const desassinar = assinarMudancas(() => {
      eventoDisparado = true;
    });

    // Aluno responde a nova questão
    await alunoService.responder(tokenAlunoLucas, qNova.id, altNova.id);

    expect(eventoDisparado).toBe(true);

    desassinar();
  });
});
