import { describe, it, expect, beforeEach } from 'vitest';
import { MockIAService } from '../mock/ia.mock';
import { MockBancoService } from '../mock/banco.mock';
import { MockAuthService } from '../mock/auth.mock';
import { resetDatabase } from '../mock/db';

describe('Serviço de IA — Geração de Questões e Cota (Fase H4)', () => {
  let iaService: MockIAService;
  let bancoService: MockBancoService;
  let authService: MockAuthService;

  beforeEach(async () => {
    await resetDatabase();
    iaService = new MockIAService();
    bancoService = new MockBancoService();
    authService = new MockAuthService();

    // Loga como Profª Ana Paula
    await authService.login('ana@demo.com', 'demo123');
  });

  it('IA1: Deve gerar exatamente 20 questões por padrão com a distribuição de subjetivas solicitada', async () => {
    const resposta = await iaService.gerarQuestoes({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-frac',
      qtd_total: 20,
      qtd_objetivas: 15,
      qtd_discursivas: 5,
      dificuldade: 'misturada',
    });

    expect(resposta.questoes).toHaveLength(20);

    const objetivas = resposta.questoes.filter((q) => q.tipo === 'objetiva');
    const discursivas = resposta.questoes.filter((q) => q.tipo === 'discursiva');

    expect(objetivas).toHaveLength(15);
    expect(discursivas).toHaveLength(5);
  });

  it('IA2: Questões objetivas devem ter 4 alternativas, 1 correta e justificativas por_que_errou', async () => {
    const resposta = await iaService.gerarQuestoes({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-frac',
      qtd_total: 10,
      qtd_objetivas: 10,
      qtd_discursivas: 0,
      dificuldade: 'facil',
    });

    for (const q of resposta.questoes) {
      expect(q.tipo).toBe('objetiva');
      expect(q.alternativas).toBeDefined();
      expect(q.alternativas).toHaveLength(4);

      const corretas = q.alternativas!.filter((a) => a.correta);
      expect(corretas).toHaveLength(1);

      const incorretas = q.alternativas!.filter((a) => !a.correta);
      expect(incorretas).toHaveLength(3);
      for (const inc of incorretas) {
        expect(inc.por_que_errou).toBeTruthy();
      }
    }
  });

  it('IA3: Questões discursivas (subjetivas) devem ter resposta_esperada e não possuir alternativas', async () => {
    const resposta = await iaService.gerarQuestoes({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-frac',
      qtd_total: 6,
      qtd_objetivas: 0,
      qtd_discursivas: 6,
      dificuldade: 'medio',
    });

    expect(resposta.questoes).toHaveLength(6);
    for (const q of resposta.questoes) {
      expect(q.tipo).toBe('discursiva');
      expect(q.resposta_esperada).toBeTruthy();
      expect(q.alternativas).toBeUndefined();
    }
  });

  it('IA4: Deve simular transcrição de texto a partir de fotos', async () => {
    const texto = await iaService.transcreverImagem(['data:image/png;base64,demo']);
    expect(texto).toContain('Texto extraído');
  });

  it('IA5: Consulta de cota mensal deve retornar uso e limite da escola', async () => {
    const cota = await iaService.consultarCota();
    expect(cota.limite_mes).toBeGreaterThanOrEqual(100);
    expect(cota.uso_mes).toBeGreaterThanOrEqual(0);
  });

  it('IA6: Salvar questão gerada no banco grava origem "ia" com sucesso', async () => {
    const resposta = await iaService.gerarQuestoes({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-frac',
      qtd_total: 2,
      qtd_objetivas: 1,
      qtd_discursivas: 1,
    });

    const questaoDiscursiva = resposta.questoes.find((q) => q.tipo === 'discursiva')!;
    const salva = await bancoService.salvarQuestaoBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-frac',
      tipo: 'discursiva',
      dificuldade: questaoDiscursiva.dificuldade,
      enunciado: questaoDiscursiva.enunciado,
      dica: questaoDiscursiva.dica,
      explicacao: questaoDiscursiva.explicacao,
      resposta_esperada: questaoDiscursiva.resposta_esperada,
      origem: 'ia',
      alternativas: [],
    });

    expect(salva.id).toBeTruthy();
    expect(salva.tipo).toBe('discursiva');
    expect(salva.origem).toBe('ia');
    expect(salva.resposta_esperada).toBe(questaoDiscursiva.resposta_esperada);
  });

  it('IA7: Questões de Matemática têm prefixo (Matemática - 7º Ano), sem "Questão 1", e possuem cálculos reais', async () => {
    const resposta = await iaService.gerarQuestoes({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-frac',
      qtd_total: 5,
      qtd_objetivas: 4,
      qtd_discursivas: 1,
      dificuldade: 'facil',
    });

    for (const q of resposta.questoes) {
      expect(q.enunciado.startsWith('(Matemática - 7º Ano) ')).toBe(true);
      expect(q.enunciado).not.toMatch(/Quest[aã]o\s+\d+/i);
      expect(q.enunciado).not.toContain('Afirmação correta sobre');
      expect(q.enunciado).toMatch(/\\frac|\d+/);
    }
  });
});
