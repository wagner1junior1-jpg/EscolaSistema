import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockIAService,
  identificarArea,
  normalizarSerieBase,
  diretrizesSerie,
  diretrizesArea,
  regrasFormatacao,
  distribuirDificuldade,
  montarPromptGemini,
} from '../mock/ia.mock';
import { ajustarQuestoesIA, embaralharArray } from '../mock/iaValidacao';
import { MockBancoService } from '../mock/banco.mock';
import { MockAuthService } from '../mock/auth.mock';
import { resetDatabase } from '../mock/db';
import { QuestaoSugeridaIA } from '@/lib/types';

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

  /* =========================================================================
   * NOVOS TESTES: Calibração Pedagógica, Funções Puras, Ciências e Validação
   * ========================================================================= */

  it('IA8: Funções puras classificam áreas e normalizam séries corretamente', () => {
    expect(identificarArea('Ciências')).toBe('natureza');
    expect(identificarArea('Ciências da Natureza')).toBe('natureza');
    expect(identificarArea('Biologia')).toBe('natureza');
    expect(identificarArea('Matemática')).toBe('exatas');
    expect(identificarArea('Física')).toBe('exatas');
    expect(identificarArea('História')).toBe('humanas');
    expect(identificarArea('Geografia')).toBe('humanas');
    expect(identificarArea('Língua Portuguesa')).toBe('linguagens');
    expect(identificarArea('Educação Física')).toBe('geral');

    expect(normalizarSerieBase('6º Ano A')).toBe('6º Ano');
    expect(normalizarSerieBase('6º Ano B')).toBe('6º Ano');
    expect(normalizarSerieBase('7º Ano - Turma B')).toBe('7º Ano');
    expect(normalizarSerieBase('Turma 8A')).toBe('8º Ano');

    expect(diretrizesSerie('2º Ano')).toContain('alfabetização');
    expect(diretrizesSerie('4º Ano')).toContain('20 palavras');
    expect(diretrizesSerie('6º Ano')).toContain('contextualizados');

    expect(diretrizesArea('natureza')).toContain('Cobre conceitos, classificação');
    expect(diretrizesArea('exatas')).toContain('cálculos explícitos');
    expect(regrasFormatacao('exatas')).toContain('LaTeX');
    expect(regrasFormatacao('natureza')).toContain('Não use LaTeX');

    const embaralhado = embaralharArray([1, 2, 3, 4], () => 0.5);
    expect(embaralhado).toHaveLength(4);

    const distMisturada = distribuirDificuldade(10, 'misturada');
    expect(distMisturada.facil + distMisturada.medio + distMisturada.dificil).toBe(10);
    expect(distribuirDificuldade(4, 'facil')).toEqual({ facil: 4, medio: 0, dificil: 0 });
    expect(distribuirDificuldade(5, 'dificil')).toEqual({ facil: 0, medio: 0, dificil: 5 });
  });

  it('IA9: Prompt de Ciências veta cálculos e LaTeX; Prompt de Matemática inclui cálculos e LaTeX', () => {
    const promptCiencias = montarPromptGemini({
      nomeDisciplina: 'Ciências',
      serie: '6º Ano B',
      nomeAssunto: 'Animais vertebrados',
      obj: { total: 4, facil: 1, medio: 2, dificil: 1 },
      disc: { total: 1, facil: 0, medio: 1, dificil: 0 },
      temFotos: false,
    });

    expect(promptCiencias).toContain('- Disciplina: Ciências');
    expect(promptCiencias).toContain('- Série: 6º Ano'); // Série higienizada sem "B"
    expect(promptCiencias).toContain('Cobre conceitos, classificação, características');
    expect(promptCiencias).toContain('nenhuma questão pode ser conta, contagem artificial ou expressão numérica');
    expect(promptCiencias).toContain('Não use LaTeX nem o símbolo $');
    expect(promptCiencias).not.toContain('CRIE PROBLEMAS REAIS COM NÚMEROS, CONTAS E CÁLCULOS MATEMÁTICOS EXPLÍCITOS');

    const promptMatematica = montarPromptGemini({
      nomeDisciplina: 'Matemática',
      serie: '7º Ano',
      nomeAssunto: 'Frações',
      obj: { total: 5, facil: 2, medio: 2, dificil: 1 },
      disc: { total: 0, facil: 0, medio: 0, dificil: 0 },
      temFotos: false,
      enunciadosAnteriores: '1. Questão anterior sobre frações...',
    });

    expect(promptMatematica).toContain('Use LaTeX ($...$) SÓ para fórmulas');
    expect(promptMatematica).toContain('erros reais de cálculo');
    expect(promptMatematica).toContain('Estas questões já foram criadas. Não repita as ideias delas:');
    expect(promptMatematica).toContain('Questão anterior sobre frações');
  });

  it('IA10: Geração de Ciências (Animais Vertebrados) produz questões biológicas sem cálculos e sem menção a turmas', async () => {
    const resposta = await iaService.gerarQuestoes({
      disciplina_id: 'disc-cien',
      serie: '6º Ano B',
      assunto_id: 'assunto-cien-vert',
      qtd_total: 5,
      qtd_objetivas: 4,
      qtd_discursivas: 1,
      dificuldade: 'misturada',
    });

    expect(resposta.questoes).toHaveLength(5);

    for (const q of resposta.questoes) {
      // Prefixo canônico sem letra de turma B
      expect(q.enunciado.startsWith('(Ciências - 6º Ano) ')).toBe(true);
      expect(q.enunciado).not.toContain('6º Ano B');
      expect(q.enunciado).not.toContain('Turma B');

      // Sem fórmulas matemáticas nem cálculos
      expect(q.enunciado).not.toContain('\\frac');
      expect(q.enunciado).not.toContain('$');

      // Conteúdo biológico de vertebrados
      expect(q.dica).not.toContain('cálculo');
      expect(q.explicacao).not.toContain('cálculo');
    }

    const discursiva = resposta.questoes.find((q) => q.tipo === 'discursiva');
    expect(discursiva).toBeDefined();
    expect(discursiva?.resposta_esperada).toMatch(/Certo:|Resposta modelo:/i);
  });

  it('IA11: Módulo iaValidacao realiza embaralhamento Fisher-Yates e gera alertas pedagógicos', () => {
    const questaoMock: QuestaoSugeridaIA = {
      id_temp: 'q1',
      tipo: 'objetiva',
      dificuldade: 'medio',
      enunciado: 'Questão 1: Observe a imagem e calcule $2 + 2 = 4$ sobre animais vertebrados.',
      dica: 'Veja a alternativa A.',
      explicacao: 'A opção B é a correta.',
      resposta_esperada: null,
      alternativas: [
        { letra: 'A', texto: 'Todas as anteriores estão corretas.', correta: false, por_que_errou: '' },
        {
          letra: 'B',
          texto: 'Esta resposta correta é propositalmente muito mais longa e detalhada do que todas as outras opções juntas.',
          correta: true,
          por_que_errou: null,
        },
        { letra: 'C', texto: 'Opção curta 1.', correta: false, por_que_errou: 'Erro 1' },
        { letra: 'D', texto: 'Opção curta 2.', correta: false, por_que_errou: 'Erro 2' },
      ],
    };

    // rand determinístico para testar embaralhamento
    let seed = 0.5;
    const fakeRand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const [ajustada] = ajustarQuestoesIA([questaoMock], 'natureza', 'Ciências', '6º Ano', fakeRand);

    // Enunciado foi higienizado
    expect(ajustada.enunciado.startsWith('(Ciências - 6º Ano) ')).toBe(true);
    expect(ajustada.enunciado).not.toContain('Questão 1:');

    // Alternativas continuam tendo exatamente 4 e exatamente 1 correta
    expect(ajustada.alternativas).toHaveLength(4);
    const corretas = ajustada.alternativas!.filter((a) => a.correta);
    expect(corretas).toHaveLength(1);
    expect(ajustada.alternativas!.map((a) => a.letra)).toEqual(['A', 'B', 'C', 'D']);

    // Avisos gerados para o professor revisar
    expect(ajustada.avisos).toBeDefined();
    expect(ajustada.avisos!.some((a) => a.includes('imagem externa'))).toBe(true);
    expect(ajustada.avisos!.some((a) => a.includes('cálculo em disciplina não exata'))).toBe(true);
    expect(ajustada.avisos!.some((a) => a.includes('termo genérico'))).toBe(true);
    expect(ajustada.avisos!.some((a) => a.includes('bem mais longa'))).toBe(true);
    expect(ajustada.avisos!.some((a) => a.includes('cita uma letra'))).toBe(true);
  });
});
