import { describe, it, expect } from 'vitest';
import {
  calcularProgressoGeral,
  calcularXpAcumulado,
  calcularNaoEntregues,
} from '../gamificacao';

describe('Gamificação e Progresso do Aluno (AlunoPainelPage)', () => {
  describe('calcularProgressoGeral', () => {
    it('deve retornar 0 quando não houver atividades cadastradas', () => {
      expect(calcularProgressoGeral(0, 0)).toBe(0);
    });

    it('as vencidas não feitas ficam no total Y, porque contam como pendência perdida', () => {
      // 4 atividades no total: 2 feitas e 2 vencidas não feitas
      // Concluídas/feitas = 2, Total = 4 => 50%
      const totalFeitas = 2;
      const totalGeral = 4;
      expect(calcularProgressoGeral(totalFeitas, totalGeral)).toBe(50);
    });

    it('quando o aluno conclui todas as atividades, atinge 100%', () => {
      expect(calcularProgressoGeral(5, 5)).toBe(100);
    });

    it('arredonda o percentual com Math.round', () => {
      // 1 de 3 = 33.33% => 33%
      expect(calcularProgressoGeral(1, 3)).toBe(33);
      // 2 de 3 = 66.66% => 67%
      expect(calcularProgressoGeral(2, 3)).toBe(67);
    });
  });

  describe('calcularXpAcumulado', () => {
    it('atividades vencidas não feitas não geram XP (apenas as feitas entram no cálculo)', () => {
      // Aluno tem:
      // - 1 atividade feita (aproveitamento 80)
      // - 1 atividade vencida não feita (não entra em atividadesFeitas)
      // - 0 dias de streak
      const atividadesFeitas = [{ aproveitamento: 80 }];
      const xp = calcularXpAcumulado(atividadesFeitas, 0);

      // 50 XP (conclusão) + 40 XP (80 * 0.5) = 90 XP
      expect(xp).toBe(90);
    });

    it('soma 50 XP por atividade feita mais bônus proporcional de aproveitamento', () => {
      const atividadesFeitas = [
        { aproveitamento: 100 }, // 50 + 50 = 100
        { aproveitamento: 75 },  // 50 + 38 = 88
      ];
      const xp = calcularXpAcumulado(atividadesFeitas, 0);
      expect(xp).toBe(188);
    });

    it('soma 15 XP por dia de sequência (streak)', () => {
      const atividadesFeitas = [{ aproveitamento: 0 }]; // 50 + 0 = 50
      const streak = 3; // 3 * 15 = 45
      const xp = calcularXpAcumulado(atividadesFeitas, streak);
      expect(xp).toBe(95);
    });

    it('ignora aproveitamento nulo ou indefinido sem lançar erro', () => {
      const atividadesFeitas = [
        { aproveitamento: null },
        { aproveitamento: undefined },
      ];
      // 2 atividades * 50 = 100 XP
      expect(calcularXpAcumulado(atividadesFeitas, 0)).toBe(100);
    });
  });

  describe('calcularNaoEntregues', () => {
    it('calcula 2 não entregues para 9 concluídas, 3 para fazer e 14 no total', () => {
      // Caso real do Lucas: 14 total - 9 concluídas - 3 para fazer = 2 não entregues
      expect(calcularNaoEntregues(14, 9, 3)).toBe(2);
    });

    it('retorna 0 quando nenhuma atividade for não entregue', () => {
      // 10 total - 7 concluídas - 3 para fazer = 0
      expect(calcularNaoEntregues(10, 7, 3)).toBe(0);
      expect(calcularNaoEntregues(0, 0, 0)).toBe(0);
    });

    it('entrada inconsistente nunca retorna negativo', () => {
      // Total menor que a soma de concluídas e para fazer
      expect(calcularNaoEntregues(5, 5, 2)).toBe(0);
      expect(calcularNaoEntregues(2, 4, 1)).toBe(0);
    });
  });
});
