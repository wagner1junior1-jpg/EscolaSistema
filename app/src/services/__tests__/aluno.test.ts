import { describe, it, expect, beforeEach } from 'vitest';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase } from '../mock/db';

describe('AlunoService Mock — Segurança e Regras de Negócio (docs/ESPECIFICACAO.md Seções 5 e 7.1)', () => {
  let alunoService: MockAlunoService;

  beforeEach(async () => {
    await resetDatabase();
    alunoService = new MockAlunoService();
  });

  describe('Bloqueio de PIN após 5 tentativas incorretas em 15 minutos', () => {
    it('deve permitir login com PIN correto na primeira tentativa', async () => {
      // Lucas Oliveira (aluno-7a-1) possui PIN 1420
      const resultado = await alunoService.login('aluno-7a-1', '1420');
      expect(resultado.token).toBeDefined();
      expect(resultado.aluno.nome_completo).toBe('Lucas Oliveira');
    });

    it('deve bloquear o aluno após 5 tentativas incorretas consecutivas', async () => {
      const alunoId = 'aluno-7a-2'; // Beatriz Santos (PIN real: 3891)

      // 4 tentativas incorretas com erro decrescente
      for (let i = 1; i <= 4; i++) {
        await expect(alunoService.login(alunoId, '0000')).rejects.toThrow(
          /PIN incorreto/
        );
      }

      // 5ª tentativa incorreta atinge o limite e dispara bloqueio imediato
      await expect(alunoService.login(alunoId, '0000')).rejects.toThrow(
        /Acesso bloqueado por 15 minutos/
      );

      // 6ª tentativa mesmo com o PIN CORRETO deve ser recusada devido ao bloqueio ativo
      await expect(alunoService.login(alunoId, '3891')).rejects.toThrow(
        /Acesso bloqueado por 15 minutos/
      );
    });
  });

  describe('Proteção e sigilo pedagógico (carregarAtividade)', () => {
    it('NUNCA deve expor alternativa correta, por_que_errou ou explicação antes do aluno responder', async () => {
      // Login da aluna Mariana Souza
      const { token } = await alunoService.login('aluno-7a-4', '5012');

      // Carrega atividade de Matemática
      const atividade = await alunoService.carregarAtividade(token, 'ativ-mat-01');

      expect(atividade.questoes.length).toBeGreaterThan(0);

      for (const q of atividade.questoes) {
        // 1. Campo explicacao não deve existir no DTO retornado para o aluno
        expect((q as unknown as Record<string, unknown>).explicacao).toBeUndefined();

        // 2. Nenhuma alternativa deve conter o campo 'correta' ou 'por_que_errou'
        for (const alt of q.alternativas) {
          expect((alt as unknown as Record<string, unknown>).correta).toBeUndefined();
          expect((alt as unknown as Record<string, unknown>).por_que_errou).toBeUndefined();
          expect(alt.id).toBeDefined();
          expect(alt.letra).toBeDefined();
          expect(alt.texto).toBeDefined();
        }
      }
    });
  });

  describe('Resposta definitiva e recusa de segunda resposta', () => {
    it('deve aceitar a primeira resposta e devolver o feedback completo', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012'); // Mariana Souza

      // Responde à questão 1 de Matemática marcando a alternativa correta (A: alt-m1-a)
      const feedback = await alunoService.responder(token, 'q-mat-1', 'alt-m1-a');

      expect(feedback.acertou).toBe(true);
      expect(feedback.alternativa_correta_id).toBe('alt-m1-a');
      expect(feedback.explicacao).toContain('O valor gasto nas figurinhas é 4x');
    });

    it('deve RECUSAR com erro caso o aluno tente responder a mesma questão novamente', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012'); // Mariana Souza

      // 1ª resposta aceita
      await alunoService.responder(token, 'q-mat-1', 'alt-m1-a');

      // 2ª tentativa na mesma questão deve ser rejeitada imediatamente
      await expect(
        alunoService.responder(token, 'q-mat-1', 'alt-m1-b')
      ).rejects.toThrow('Esta questão já foi respondida e não pode ser alterada.');
    });
  });
});
