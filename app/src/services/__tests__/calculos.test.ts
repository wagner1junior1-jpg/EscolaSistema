import { describe, it, expect } from 'vitest';
import {
  calcularAproveitamentoAtividade,
  calcularMediaPeriodo,
  calcularFrequencia,
  consolidarFrequenciaAluno,
  determinarSituacaoConselho,
  calcularMapaDeCalorQuestao,
} from '../calculos';
import { Questao, Alternativa, Resposta, Frequencia } from '@/lib/types';

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

    it('deve retornar null se não houver questões avaliadas', () => {
      expect(calcularMediaPeriodo(0, 0)).toBeNull();
    });
  });

  describe('3. Frequência escolar e regra de dias sem registro', () => {
    it('deve somar presenças (P) e justificadas (J) dividindo estritamente pelos dias COM registro', () => {
      // 10 registros: 8 P, 1 J, 1 F -> (8 + 1) / 10 = 90%
      expect(calcularFrequencia(8, 1, 10)).toBe(90);
    });

    it('regra canônica: "Dia sem registro do aluno não entra no cálculo"', () => {
      // Cenário: A escola teve 20 dias de aula no mês.
      // O aluno foi matriculado recentemente e tem registros em apenas 4 dias:
      // 3 Presenças (P) e 1 Justificada (J). Os outros 16 dias NÃO possuem registro para ele.
      // O cálculo deve ser (3 + 1) / 4 = 100%, e NUNCA dividir por 20.
      const registrosAluno: Frequencia[] = [
        {
          id: 'f1',
          created_at: '',
          oferta_id: 'of-1',
          aluno_id: 'a1',
          data: '2026-09-01',
          status: 'P',
          registrado_por: 'prof',
        },
        {
          id: 'f2',
          created_at: '',
          oferta_id: 'of-1',
          aluno_id: 'a1',
          data: '2026-09-02',
          status: 'P',
          registrado_por: 'prof',
        },
        {
          id: 'f3',
          created_at: '',
          oferta_id: 'of-1',
          aluno_id: 'a1',
          data: '2026-09-03',
          status: 'P',
          registrado_por: 'prof',
        },
        {
          id: 'f4',
          created_at: '',
          oferta_id: 'of-1',
          aluno_id: 'a1',
          data: '2026-09-04',
          status: 'J',
          registrado_por: 'prof',
        },
      ];

      const resultado = consolidarFrequenciaAluno(registrosAluno);

      expect(resultado.diasComRegistro).toBe(4);
      expect(resultado.presencas).toBe(3);
      expect(resultado.justificadas).toBe(1);
      expect(resultado.faltas).toBe(0);
      expect(resultado.porcentagem).toBe(100);
    });

    it('deve retornar null se o aluno não tiver nenhum dia registrado', () => {
      expect(calcularFrequencia(0, 0, 0)).toBeNull();
      const resultadoVazio = consolidarFrequenciaAluno([]);
      expect(resultadoVazio.porcentagem).toBeNull();
    });
  });

  describe('4. Situação no Conselho de Classe', () => {
    it('deve classificar como "Sem avaliação" quando nenhuma atividade foi concluída', () => {
      expect(determinarSituacaoConselho(null, 100, false)).toBe('Sem avaliação');
      expect(determinarSituacaoConselho(80, 100, false)).toBe('Sem avaliação');
    });

    it('deve classificar como "Risco por infrequência" se frequência for menor que 75%', () => {
      expect(determinarSituacaoConselho(90, 70, true)).toBe('Risco por infrequência');
      expect(determinarSituacaoConselho(50, 60, true)).toBe('Risco por infrequência');
    });

    it('deve classificar como "Reforço" se média for menor que 60% com frequência adequada', () => {
      expect(determinarSituacaoConselho(55, 80, true)).toBe('Reforço');
    });

    it('deve classificar como "Destaque" se média >= 80% e frequência >= 85%', () => {
      expect(determinarSituacaoConselho(85, 90, true)).toBe('Destaque');
      expect(determinarSituacaoConselho(80, 85, true)).toBe('Destaque');
    });

    it('deve classificar como "Adequado" em caso padrão com nota e frequência satisfatórias', () => {
      expect(determinarSituacaoConselho(70, 80, true)).toBe('Adequado');
      expect(determinarSituacaoConselho(85, 80, true)).toBe('Adequado'); // nota alta, mas freq < 85
    });
  });

  describe('5. Mapa de calor por questão', () => {
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
        { id: '1', created_at: '', aluno_id: 'a1', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '' },
        { id: '2', created_at: '', aluno_id: 'a2', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '' },
        { id: '3', created_at: '', aluno_id: 'a3', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '' },
        { id: '4', created_at: '', aluno_id: 'a4', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '' },
        { id: '5', created_at: '', aluno_id: 'a5', questao_id: 'q1', alternativa_id: 'alt-a', acertou: true, respondida_em: '' },
        { id: '6', created_at: '', aluno_id: 'a6', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '' },
        { id: '7', created_at: '', aluno_id: 'a7', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '' },
        { id: '8', created_at: '', aluno_id: 'a8', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '' },
        { id: '9', created_at: '', aluno_id: 'a9', questao_id: 'q1', alternativa_id: 'alt-b', acertou: false, respondida_em: '' },
        { id: '10', created_at: '', aluno_id: 'a10', questao_id: 'q1', alternativa_id: 'alt-c', acertou: false, respondida_em: '' },
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
