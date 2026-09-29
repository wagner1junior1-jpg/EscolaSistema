import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { MockRelatorioService } from '../mock/relatorio.mock';
import { resetDatabase } from '../mock/db';

describe('Relatório de Desempenho Hierárquico por Subitens (Diretora)', () => {
  const authService = new MockAuthService();
  const gestaoService = new MockGestaoService();
  const relatorioService = new MockRelatorioService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
  });

  it('deve exigir login de direção ou coordenação para acessar o relatório', async () => {
    await expect(relatorioService.desempenhoHierarquicoTurmas('per-2026-3b')).rejects.toThrow();

    await authService.login('ana@demo.com', 'demo123'); // Professor
    await expect(relatorioService.desempenhoHierarquicoTurmas('per-2026-3b')).rejects.toThrow();

    await authService.logout();
    await authService.login('direcao@demo.com', 'demo123'); // Direção
    const relatorio = await relatorioService.desempenhoHierarquicoTurmas('per-2026-3b');
    expect(Array.isArray(relatorio)).toBe(true);
  });

  it('deve estruturar a hierarquia completa: Turma -> Matéria (% erro) -> Conteúdo (% erro) -> Questão (% acerto)', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    const periodos = await gestaoService.listarPeriodos();
    const periodo3B = periodos.find((p) => p.nome.includes('3º Bimestre')) || periodos[0];

    const relatorio = await relatorioService.desempenhoHierarquicoTurmas(periodo3B.id);
    expect(relatorio.length).toBeGreaterThan(0);

    // Encontra a turma principal que possui atividades (7º Ano A)
    const turma7A = relatorio.find((t) => t.turma_nome.includes('7º Ano A'));
    expect(turma7A).toBeDefined();

    if (turma7A) {
      expect(turma7A.total_alunos).toBeGreaterThan(0);
      expect(typeof turma7A.porcentagem_erro_geral === 'number' || turma7A.porcentagem_erro_geral === null).toBe(true);

      // Nível 2: Matérias da turma
      expect(turma7A.materias.length).toBeGreaterThan(0);

      const materiaMat = turma7A.materias.find((m) => m.disciplina_nome === 'Matemática');
      expect(materiaMat).toBeDefined();

      if (materiaMat) {
        expect(materiaMat.professor_nome).toContain('Ana Paula');
        expect(typeof materiaMat.porcentagem_erro).toBe('number');
        expect(typeof materiaMat.porcentagem_acerto).toBe('number');
        expect(materiaMat.porcentagem_erro + materiaMat.porcentagem_acerto).toBeCloseTo(100, 0);

        // Nível 3: Conteúdos da matéria
        expect(materiaMat.conteudos.length).toBeGreaterThan(0);

        for (const conteudo of materiaMat.conteudos) {
          expect(conteudo.conteudo_nome).toBeTruthy();
          expect(typeof conteudo.porcentagem_erro).toBe('number');
          expect(typeof conteudo.porcentagem_acerto).toBe('number');
          expect(conteudo.total_questoes).toBeGreaterThan(0);

          // Nível 4: Questões do conteúdo
          expect(conteudo.questoes.length).toBe(conteudo.total_questoes);

          for (const questao of conteudo.questoes) {
            expect(questao.questao_id).toBeTruthy();
            expect(questao.ordem).toBeGreaterThan(0);
            expect(questao.enunciado).toBeTruthy();
            expect(typeof questao.porcentagem_acerto).toBe('number');
            expect(typeof questao.porcentagem_erro).toBe('number');

            // Detalhes da questão (alternativas e distrator)
            if (questao.tipo === 'objetiva' && questao.alternativas) {
              const temCorreta = questao.alternativas.some((a) => a.correta);
              expect(temCorreta).toBe(true);

              for (const alt of questao.alternativas) {
                expect(alt.letra).toMatch(/^[A-E]$/);
                expect(typeof alt.total_escolhas).toBe('number');
                expect(typeof alt.porcentagem_escolhas).toBe('number');
              }

              // Se houver respostas incorretas, distrator_mais_escolhido deve ser computado
              if (questao.total_respostas > questao.total_acertos) {
                expect(questao.distrator_mais_escolhido).toBeDefined();
              }
            }
          }
        }
      }
    }
  });

  it('deve lidar graciosamente com períodos ou turmas sem atividades registradas', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    // Período fictício ou sem atividades
    const relatorio = await relatorioService.desempenhoHierarquicoTurmas('periodo-inexistente-123');
    expect(Array.isArray(relatorio)).toBe(true);

    for (const turma of relatorio) {
      expect(turma.porcentagem_erro_geral).toBeNull();
      expect(turma.porcentagem_acerto_geral).toBeNull();
      expect(turma.total_materias_avaliadas).toBe(0);
    }
  });
});
