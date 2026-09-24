import { describe, it, expect } from 'vitest';
import {
  calcularAproveitamentoAtividade,
  calcularMediaPeriodo,
  faixaDesempenho,
  questoesCriticas,
  calcularMapaDeCalorQuestao,
} from '../calculos';
import { Questao, Alternativa, Resposta, ItemMapaDeCalorQuestao } from '@/lib/types';

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
});
