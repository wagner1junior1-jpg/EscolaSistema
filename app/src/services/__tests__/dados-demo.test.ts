import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MockAuthService } from '../mock/auth.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase } from '../mock/db';
import dadosDemo from '../mock/dados-demo.json';

describe('Pacote de Demonstração (dados-demo.json)', () => {
  const authService = new MockAuthService();
  const professorService = new MockProfessorService();
  const alunoService = new MockAlunoService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
  });

  // 1. dados-demo.json byte-a-byte idêntico a docs/seed-demo-questoes.json
  it('dados-demo.json é byte-a-byte idêntico a docs/seed-demo-questoes.json', () => {
    const caminhoDemo = path.resolve(__dirname, '../mock/dados-demo.json');
    const caminhoDocs = path.resolve(__dirname, '../../../../docs/seed-demo-questoes.json');
    const bufDemo = fs.readFileSync(caminhoDemo);
    const bufDocs = fs.readFileSync(caminhoDocs);
    expect(bufDemo.equals(bufDocs)).toBe(true);
  });

  // 2. cada questão do pacote tem 2 a 5 alternativas, exatamente 1 correta, e todas as incorretas têm por_que_errou
  it('cada questão do pacote tem 2 a 5 alternativas, exatamente 1 correta, e todas as incorretas têm por_que_errou', () => {
    expect(dadosDemo.atividades.length).toBeGreaterThan(0);
    for (const ativ of dadosDemo.atividades) {
      expect(ativ.questoes.length).toBeGreaterThan(0);
      for (const q of ativ.questoes) {
        expect(q.alternativas.length).toBeGreaterThanOrEqual(2);
        expect(q.alternativas.length).toBeLessThanOrEqual(5);

        const corretas = q.alternativas.filter((a) => a.correta);
        expect(corretas.length).toBe(1);

        const incorretas = q.alternativas.filter((a) => !a.correta);
        for (const inc of incorretas) {
          expect(inc.por_que_errou).toBeDefined();
          expect(typeof inc.por_que_errou).toBe('string');
          expect(inc.por_que_errou!.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  // 3. Lucas: atividadesPendentes NÃO contém 'ativ-demo-mat-rascunho' e contém as outras 4 da demo
  it('Lucas: atividadesPendentes NÃO contém ativ-demo-mat-rascunho e contém as outras 4 da demo', async () => {
    const { token } = await alunoService.login('aluno-7a-1', '1420');
    const pendentes = await alunoService.atividadesPendentes(token);
    const ids = pendentes.map((a) => a.id);

    expect(ids).not.toContain('ativ-demo-mat-rascunho');
    expect(ids).toContain('ativ-demo-mat-frac');
    expect(ids).toContain('ativ-demo-cien-prova');
    expect(ids).toContain('ativ-demo-port-leitura');
    expect(ids).toContain('ativ-demo-mat-inteiros-enc');
  });

  // 4. Lucas: resultadoProva('ativ-demo-mat-inteiros-enc') liberado com 3 questões e 1 acerto
  it('Lucas: resultadoProva(ativ-demo-mat-inteiros-enc) liberado com 3 questões e 1 acerto', async () => {
    const { token } = await alunoService.login('aluno-7a-1', '1420');
    const resultado = await alunoService.resultadoProva(token, 'ativ-demo-mat-inteiros-enc');

    expect(resultado.total_questoes).toBe(3);
    expect(resultado.acertos).toBe(1);
    expect(resultado.questoes.length).toBe(3);
  });

  // 5. Lucas: carregarAtividade('ativ-demo-cien-prova') não vaza correta, por_que_errou ou explicacao
  it('Lucas: carregarAtividade(ativ-demo-cien-prova) não vaza correta, por_que_errou ou explicacao', async () => {
    const { token } = await alunoService.login('aluno-7a-1', '1420');
    const atividade = await alunoService.carregarAtividade(token, 'ativ-demo-cien-prova');

    expect(atividade.questoes.length).toBeGreaterThan(0);
    for (const q of atividade.questoes) {
      expect((q as unknown as Record<string, unknown>).explicacao).toBeUndefined();
      for (const alt of q.alternativas) {
        expect((alt as unknown as Record<string, unknown>).correta).toBeUndefined();
        expect((alt as unknown as Record<string, unknown>).por_que_errou).toBeUndefined();
      }
    }
  });

  // 6. Professora Ana: mapaDeCalor('ativ-demo-mat-frac') questão q-demo-frac-2 tem 2 acertos em 7 e distrator mais marcado B
  it('Professora Ana: mapaDeCalor(ativ-demo-mat-frac) questão q-demo-frac-2 tem 2 acertos em 7 e distrator mais marcado B', async () => {
    await authService.login('ana@demo.com', 'demo123');
    const mapa = await professorService.mapaDeCalor('ativ-demo-mat-frac');

    const q2 = mapa.questoes.find((q) => q.questao_id === 'q-demo-frac-2');
    expect(q2).toBeDefined();
    expect(q2?.total_respostas).toBe(7);
    expect(q2?.total_acertos).toBe(2);
    expect(q2?.distrator_mais_escolhido?.letra).toBe('B');
  });

  // 7. Refazer não altera média: Gabriel em Frações tem média calculada só pela 1ª resposta
  it('Refazer não altera média: Gabriel em Frações tem média calculada só pela 1ª resposta', async () => {
    // Aluno Gabriel Lima (aluno-7a-3, PIN 7254)
    const { token: tokenGabriel } = await alunoService.login('aluno-7a-3', '7254');
    const ativs = await alunoService.atividadesPendentes(tokenGabriel);
    const frac = ativs.find((a) => a.id === 'ativ-demo-mat-frac');
    // Gabriel acertou 3 de 5 questões na 1ª tentativa -> aproveitamento 60%
    expect(frac?.aproveitamento).toBe(60);

    // Professora Ana consulta o relatório de desempenho da oferta
    await authService.login('ana@demo.com', 'demo123');
    const relatorio = await professorService.desempenhoOferta('oferta-mat-7a', 'per-bim-3');
    const gabriel = relatorio.alunos.find((a) => a.aluno_id === 'aluno-7a-3');
    const fracGabriel = gabriel?.atividades.find((a) => a.atividade_id === 'ativ-demo-mat-frac');
    expect(fracGabriel?.aproveitamento).toBe(60);
  });
});
