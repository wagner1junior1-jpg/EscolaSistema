import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase, getDatabase, saveDatabase } from '../mock/db';
import { Questao, Atividade } from '@/lib/types';

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
});
