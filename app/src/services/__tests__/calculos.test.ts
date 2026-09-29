import { describe, it, expect } from 'vitest';
import {
  calcularAproveitamentoAtividade,
  calcularMediaPeriodo,
  faixaDesempenho,
  questoesCriticas,
  calcularMapaDeCalorQuestao,
  mediaDoAlunoNasAtividades,
  pontuacaoDaResposta,
  calcularTaxaErro,
  calcularTaxaAcerto,
  classificarSemaforoPedagogico,
} from '../calculos';
import { Questao, Alternativa, Resposta, ItemMapaDeCalorQuestao, Atividade } from '@/lib/types';

describe('Cálculos Pedagógicos Oficiais (docs/ESPECIFICACAO.md Seção 6)', () => {
  describe('1. Aproveitamento em uma atividade', () => {
    it('deve calcular corretamente 100% para acerto total', () => {
      expect(calcularAproveitamentoAtividade(4, 4)).toBe(100);
    });

    it('deve calcular corretamente acertos parciais com arredondamento', () => {
      expect(calcularAproveitamentoAtividade(3, 4)).toBe(75);
      expect(calcularAproveitamentoAtividade(1, 3)).toBe(33.3);
    });

    it('deve retornar 0 quando o total de questões for zero', () => {
      expect(calcularAproveitamentoAtividade(0, 0)).toBe(0);
    });
  });

  describe('2. Média do período', () => {
    it('deve somar acertos e dividir pelo total de questões das atividades avaliadas', () => {
      // Exemplo: 2 atividades concluídas de 4 questões cada (total 8 questões).
      // Aluno acertou 3 na primeira e 4 na segunda (total 7 acertos).
      expect(calcularMediaPeriodo(7, 8)).toBe(87.5);
    });

    it('deve calcular a média a partir de uma lista de atividades', () => {
      expect(
        calcularMediaPeriodo([
          { acertos: 4, totalQuestoes: 5 },
          { acertos: 3, totalQuestoes: 5 },
        ])
      ).toBe(70);
    });

    it('deve retornar null se não houver questões avaliadas ou lista vazia', () => {
      expect(calcularMediaPeriodo(0, 0)).toBeNull();
      expect(calcularMediaPeriodo([])).toBeNull();
    });
  });

  describe('2.1 Média do aluno nas atividades (mediaDoAlunoNasAtividades)', () => {
    const criarQuestao = (id: string, atividadeId: string): Questao => ({
      id,
      created_at: '',
      atividade_id: atividadeId,
      ordem: 1,
      enunciado: 'Questão ' + id,
      dica: null,
      explicacao: null,
    });

    const criarResposta = (
      id: string,
      alunoId: string,
      questaoId: string,
      acertou: boolean,
      acertouFinal: boolean = acertou
    ): Resposta => ({
      id,
      created_at: '',
      aluno_id: alunoId,
      questao_id: questaoId,
      alternativa_id: 'alt-1',
      acertou,
      respondida_em: '',
      tentativas: 1,
      acertou_final: acertouFinal,
    });

    it('ignora atividades em rascunho mesmo com respostas', () => {
      const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'a1', status: 'rascunho' }];
      const questoes = [criarQuestao('q1', 'a1'), criarQuestao('q2', 'a1')];
      const respostas = [
        criarResposta('r1', 'aluno-1', 'q1', true),
        criarResposta('r2', 'aluno-1', 'q2', true),
      ];

      const res = mediaDoAlunoNasAtividades(ativs, questoes, respostas);
      expect(res.atividades_avaliadas).toBe(0);
      expect(res.media).toBeNull();
      expect(res.soma_acertos).toBe(0);
      expect(res.soma_questoes).toBe(0);
    });

    it('ignora atividade publicada que ainda está incompleta', () => {
      const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'a1', status: 'publicada' }];
      const questoes = [criarQuestao('q1', 'a1'), criarQuestao('q2', 'a1')];
      const respostas = [criarResposta('r1', 'aluno-1', 'q1', true)]; // Apenas 1 de 2 respondida

      const res = mediaDoAlunoNasAtividades(ativs, questoes, respostas);
      expect(res.atividades_avaliadas).toBe(0);
      expect(res.media).toBeNull();
    });

    it('avalia atividade publicada concluída usando estritamente a 1ª resposta', () => {
      const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'a1', status: 'publicada' }];
      const questoes = [
        criarQuestao('q1', 'a1'),
        criarQuestao('q2', 'a1'),
        criarQuestao('q3', 'a1'),
        criarQuestao('q4', 'a1'),
      ];
      const respostas = [
        criarResposta('r1', 'aluno-1', 'q1', true),
        criarResposta('r2', 'aluno-1', 'q2', true),
        criarResposta('r3', 'aluno-1', 'q3', true),
        // Na q4 errou na 1ª tentativa, mas acertou_final = true no retry:
        criarResposta('r4', 'aluno-1', 'q4', false, true),
      ];

      const res = mediaDoAlunoNasAtividades(ativs, questoes, respostas);
      expect(res.atividades_avaliadas).toBe(1);
      expect(res.soma_acertos).toBe(3); // 3 da primeira resposta
      expect(res.soma_questoes).toBe(4);
      expect(res.media).toBe(75);
    });

    it('avalia atividade encerrada incompleta contando não respondidas como erro', () => {
      const ativs: Pick<Atividade, 'id' | 'status'>[] = [{ id: 'a1', status: 'encerrada' }];
      const questoes = [
        criarQuestao('q1', 'a1'),
        criarQuestao('q2', 'a1'),
        criarQuestao('q3', 'a1'),
        criarQuestao('q4', 'a1'),
      ];
      // Aluno respondeu apenas 1 questão (correta) e deixou 3 em branco:
      const respostas = [criarResposta('r1', 'aluno-1', 'q1', true)];

      const res = mediaDoAlunoNasAtividades(ativs, questoes, respostas);
      expect(res.atividades_avaliadas).toBe(1);
      expect(res.soma_acertos).toBe(1);
      expect(res.soma_questoes).toBe(4);
      expect(res.media).toBe(25);
    });

    it('combina múltiplas atividades e suporta diferentes fontes de questões (Map e Record)', () => {
      const ativs: Pick<Atividade, 'id' | 'status'>[] = [
        { id: 'a1', status: 'publicada' },
        { id: 'a2', status: 'encerrada' },
      ];

      const qMap = new Map<string, Questao[]>([
        ['a1', [criarQuestao('q1', 'a1'), criarQuestao('q2', 'a1')]],
        ['a2', [criarQuestao('q3', 'a2'), criarQuestao('q4', 'a2'), criarQuestao('q5', 'a2')]],
      ]);

      const respostas = [
        criarResposta('r1', 'aluno-1', 'q1', true),
        criarResposta('r2', 'aluno-1', 'q2', true),
        criarResposta('r3', 'aluno-1', 'q3', true),
        criarResposta('r4', 'aluno-1', 'q4', false),
        // q5 não respondida em a2 (encerrada)
      ];

      const res = mediaDoAlunoNasAtividades(ativs, qMap, respostas);
      // a1: 2 acertos em 2 questões
      // a2: 1 acerto em 3 questões
      // Total: 3 acertos em 5 questões = 60%
      expect(res.atividades_avaliadas).toBe(2);
      expect(res.soma_acertos).toBe(3);
      expect(res.soma_questoes).toBe(5);
      expect(res.media).toBe(60);
    });
  });

  describe('3. Faixa de desempenho (Seção 6.1)', () => {
    it('deve retornar "Sem atividades" quando a média for null', () => {
      expect(faixaDesempenho(null)).toBe('Sem atividades');
    });

    it('deve classificar limites estritos conforme especificação', () => {
      // < 60: Atenção
      expect(faixaDesempenho(0)).toBe('Atenção');
      expect(faixaDesempenho(59.9)).toBe('Atenção');

      // 60 a 79.9: Bom
      expect(faixaDesempenho(60)).toBe('Bom');
      expect(faixaDesempenho(75)).toBe('Bom');
      expect(faixaDesempenho(79.9)).toBe('Bom');

      // >= 80: Ótimo
      expect(faixaDesempenho(80)).toBe('Ótimo');
      expect(faixaDesempenho(95)).toBe('Ótimo');
      expect(faixaDesempenho(100)).toBe('Ótimo');
    });
  });

  describe('4. Questões críticas (Seção 6.2)', () => {
    const criarItem = (
      id: string,
      totalRespostas: number,
      porcentagemAcerto: number
    ): ItemMapaDeCalorQuestao => ({
      questao_id: id,
      enunciado: 'Questão teste ' + id,
      ordem: 1,
      total_respostas: totalRespostas,
      total_acertos: Math.round((totalRespostas * porcentagemAcerto) / 100),
      porcentagem_acerto: porcentagemAcerto,
      distribuicao: {
        A: { alternativa_id: 'alt-a', total: 0, porcentagem: 0 },
        B: { alternativa_id: 'alt-b', total: 0, porcentagem: 0 },
        C: { alternativa_id: 'alt-c', total: 0, porcentagem: 0 },
        D: { alternativa_id: 'alt-d', total: 0, porcentagem: 0 },
        E: { alternativa_id: 'alt-e', total: 0, porcentagem: 0 },
      },
      distrator_mais_escolhido: null,
    });

    it('deve ignorar questões com menos de 5 respostas', () => {
      const itens = [
        criarItem('q-poucas-respostas', 4, 20), // 20% acerto, mas só 4 respostas (< 5)
        criarItem('q-suficiente-critica', 5, 40), // 40% acerto, 5 respostas
      ];

      const criticas = questoesCriticas(itens);
      expect(criticas).toHaveLength(1);
      expect(criticas[0].questao_id).toBe('q-suficiente-critica');
    });

    it('deve incluir questões com >= 5 respostas e acerto abaixo de 50%', () => {
      const itens = [
        criarItem('q1', 10, 49.9), // crítica
        criarItem('q2', 10, 50.0), // não crítica (>= 50%)
        criarItem('q3', 6, 25.0),  // crítica
      ];

      const criticas = questoesCriticas(itens);
      expect(criticas).toHaveLength(2);
      expect(criticas[0].questao_id).toBe('q3'); // 25% primeiro (menor acerto)
      expect(criticas[1].questao_id).toBe('q1'); // 49.9% depois
    });
  });

  describe('5. Mapa de calor por questão (baseado apenas na 1ª resposta)', () => {
    it('deve calcular porcentagem de acertos, distribuição e apontar o distrator mais escolhido', () => {
      const questao: Questao = {
        id: 'q1',
        created_at: '',
        atividade_id: 'ativ-1',
        ordem: 1,
        enunciado: 'Enunciado de teste',
        dica: 'Dica',
        explicacao: 'Explicação correta',
      };

      const alternativas: Alternativa[] = [
        {
          id: 'alt-a',
          created_at: '',
          questao_id: 'q1',
          letra: 'A',
          texto: 'Opção A (Correta)',
          correta: true,
          por_que_errou: null,
        },
        {
          id: 'alt-b',
          created_at: '',
          questao_id: 'q1',
          letra: 'B',
          texto: 'Opção B (Distrator clássico)',
          correta: false,
          por_que_errou: 'Pegadinha da letra B',
        },
        {
          id: 'alt-c',
          created_at: '',
          questao_id: 'q1',
          letra: 'C',
          texto: 'Opção C',
          correta: false,
          por_que_errou: 'Erro da C',
        },
        {
          id: 'alt-d',
          created_at: '',
          questao_id: 'q1',
          letra: 'D',
          texto: 'Opção D',
          correta: false,
          por_que_errou: 'Erro da D',
        },
      ];

      // 10 respostas:
      // 5 acertaram (A)
      // 4 marcaram o distrator (B)
      // 1 marcou (C)
      // 0 marcaram (D)
      const respostas: Resposta[] = [
        { id: '1', created_at: '', aluno_id: 'a1', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '', tentativas: 1, acertou_final: true },
        { id: '2', created_at: '', aluno_id: 'a2', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '', tentativas: 1, acertou_final: true },
        { id: '3', created_at: '', aluno_id: 'a3', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '', tentativas: 1, acertou_final: true },
        { id: '4', created_at: '', aluno_id: 'a4', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '', tentativas: 1, acertou_final: true },
        { id: '5', created_at: '', aluno_id: 'a5', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '', tentativas: 1, acertou_final: true },
        { id: '6', created_at: '', aluno_id: 'a6', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '', tentativas: 2, acertou_final: true }, // acertou_final não altera 1ª resposta
        { id: '7', created_at: '', aluno_id: 'a7', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '', tentativas: 1, acertou_final: false },
        { id: '8', created_at: '', aluno_id: 'a8', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '', tentativas: 1, acertou_final: false },
        { id: '9', created_at: '', aluno_id: 'a9', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '', tentativas: 1, acertou_final: false },
        { id: '10', created_at: '', aluno_id: 'a10', questao_id: 'q1', alternativa_id: 'alt-c', acertou: false, respondida_em: '', tentativas: 1, acertou_final: false },
      ];

      const resultado = calcularMapaDeCalorQuestao(questao, alternativas, respostas);

      expect(resultado.total_respostas).toBe(10);
      expect(resultado.total_acertos).toBe(5);
      expect(resultado.porcentagem_acerto).toBe(50);

      expect(resultado.distribuicao.A.total).toBe(5);
      expect(resultado.distribuicao.A.porcentagem).toBe(50);

      expect(resultado.distribuicao.B.total).toBe(4);
      expect(resultado.distribuicao.B.porcentagem).toBe(40);

      expect(resultado.distribuicao.C.total).toBe(1);
      expect(resultado.distribuicao.C.porcentagem).toBe(10);

      expect(resultado.distribuicao.D.total).toBe(0);
      expect(resultado.distribuicao.D.porcentagem).toBe(0);

      // Distrator mais escolhido deve ser a letra B
      expect(resultado.distrator_mais_escolhido).not.toBeNull();
      expect(resultado.distrator_mais_escolhido?.letra).toBe('B');
      expect(resultado.distrator_mais_escolhido?.total_escolhas).toBe(4);
      expect(resultado.distrator_mais_escolhido?.por_que_errou).toBe('Pegadinha da letra B');
    });
  });

  describe('6. Pontuação individual da resposta (pontuacaoDaResposta - docs/ESPECIFICACAO.md 9.2, 9.3)', () => {
    // Caso 1: objetiva acertou
    it('caso 1: objetiva acertou deve retornar 1', () => {
      const q = { tipo: 'objetiva' as const };
      const r = { acertou: true };
      expect(pontuacaoDaResposta(q, r)).toBe(1);
    });

    // Caso 2: objetiva errou
    it('caso 2: objetiva errou deve retornar 0', () => {
      const q = { tipo: 'objetiva' as const };
      const r = { acertou: false };
      expect(pontuacaoDaResposta(q, r)).toBe(0);
    });

    // Caso 3: discursiva certa
    it('caso 3: discursiva certa deve retornar 1', () => {
      const q = { tipo: 'discursiva' as const };
      const r = { correcao: 'certo' as const };
      expect(pontuacaoDaResposta(q, r)).toBe(1);
    });

    // Caso 4: discursiva parcial
    it('caso 4: discursiva parcial deve retornar 0.5', () => {
      const q = { tipo: 'discursiva' as const };
      const r = { correcao: 'parcial' as const };
      expect(pontuacaoDaResposta(q, r)).toBe(0.5);
    });

    // Caso 5: discursiva errada
    it('caso 5: discursiva errada deve retornar 0', () => {
      const q = { tipo: 'discursiva' as const };
      const r = { correcao: 'errado' as const };
      expect(pontuacaoDaResposta(q, r)).toBe(0);
    });

    // Caso 6: discursiva pendente ou sem correção
    it('caso 6: discursiva pendente ou sem correção deve retornar null', () => {
      const q = { tipo: 'discursiva' as const };
      expect(pontuacaoDaResposta(q, { correcao: 'pendente' as const })).toBeNull();
      expect(pontuacaoDaResposta(q, { correcao: null })).toBeNull();
      expect(pontuacaoDaResposta(q, {})).toBeNull();
      expect(pontuacaoDaResposta(q, null)).toBeNull();
    });
  });

  describe('7. Métricas de Desempenho Hierárquico e Semáforo Pedagógico', () => {
    it('calcularTaxaErro deve retornar 0 quando total for 0', () => {
      expect(calcularTaxaErro(0, 0)).toBe(0);
    });

    it('calcularTaxaErro deve calcular a porcentagem de erro corretamente', () => {
      // 10 respostas, 7 acertos -> 3 erros = 30%
      expect(calcularTaxaErro(7, 10)).toBe(30);
      // 3 respostas, 1 acerto -> 2 erros = 66.7%
      expect(calcularTaxaErro(1, 3)).toBe(66.7);
      // 5 respostas, 5 acertos -> 0 erros = 0%
      expect(calcularTaxaErro(5, 5)).toBe(0);
    });

    it('calcularTaxaAcerto deve calcular a porcentagem de acerto corretamente', () => {
      expect(calcularTaxaAcerto(7, 10)).toBe(70);
      expect(calcularTaxaAcerto(0, 5)).toBe(0);
      expect(calcularTaxaAcerto(0, 0)).toBe(0);
    });

    it('classificarSemaforoPedagogico deve classificar nas faixas verde, ambar e vermelho', () => {
      expect(classificarSemaforoPedagogico(null)).toBe('verde');
      expect(classificarSemaforoPedagogico(10)).toBe('verde');
      expect(classificarSemaforoPedagogico(24.9)).toBe('verde');
      expect(classificarSemaforoPedagogico(25)).toBe('ambar');
      expect(classificarSemaforoPedagogico(40)).toBe('ambar');
      expect(classificarSemaforoPedagogico(45)).toBe('ambar');
      expect(classificarSemaforoPedagogico(45.1)).toBe('vermelho');
      expect(classificarSemaforoPedagogico(70)).toBe('vermelho');
    });
  });
});

