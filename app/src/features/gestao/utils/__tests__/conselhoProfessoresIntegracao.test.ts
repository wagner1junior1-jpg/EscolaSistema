import { describe, it, expect } from 'vitest';
import { MockRelatorioService } from '@/services/mock/relatorio.mock';
import { MockGestaoService } from '@/services/mock/gestao.mock';
import { MockAuthService } from '@/services/mock/auth.mock';
import { getDatabase, saveDatabase } from '@/services/mock/db';
import { enriquecerEscolaReal3a6Ano } from '@/services/mock/seed-escola-ampliada';
import {
  formatarPautaConselhoGeral,
  formatarPautaConselhoTurma,
  formatarPautaConselhoProfessor,
} from '../pautaConselhoFormatador';

describe('Auditoria e Verificação Rigorosa — Conselho de Professores', () => {
  const authService = new MockAuthService();
  const relatorioService = new MockRelatorioService();
  const gestaoService = new MockGestaoService();

  it('deve autenticar como diretora e carregar dados reais e consistentes do 1º Bimestre', async () => {
    // 0. Preparar banco com dados ampliados (como em produção/navegador)
    const db = await getDatabase();
    await enriquecerEscolaReal3a6Ano(db);
    saveDatabase(db);

    // 1. Login como diretora
    await authService.login('direcao@demo.com', 'demo123');

    // 2. Obter períodos e identificar o período ativo (3º Bimestre padrão do conselho)
    const periodos = await gestaoService.listarPeriodos();
    const periodoAtivo = periodos.find((p) => p.ativo) || periodos[0];
    expect(periodoAtivo).toBeDefined();
    const periodoId = periodoAtivo!.id;

    // 3. Obter desempenho hierárquico das turmas no período
    const turmasHierarquicas = await relatorioService.desempenhoHierarquicoTurmas(periodoId);
    expect(turmasHierarquicas.length).toBeGreaterThan(0);

    // 4. Verificar turma 6º Ano A (turma que possui avaliações no seed)
    const turma6A = turmasHierarquicas.find((t) => t.turma_nome.includes('6º Ano A'));
    expect(turma6A).toBeDefined();
    expect(turma6A!.total_alunos).toBeGreaterThanOrEqual(20);
    expect(turma6A!.porcentagem_acerto_geral).not.toBeNull();
    // A média geral deve ser saudável (> 65% e < 85%)
    expect(turma6A!.porcentagem_acerto_geral!).toBeGreaterThan(65);
    expect(turma6A!.porcentagem_acerto_geral!).toBeLessThan(85);

    // Verificar matérias do 6º Ano A
    const materiaMatematica = turma6A!.materias.find((m) => m.disciplina_nome === 'Matemática');
    const materiaCiencias = turma6A!.materias.find((m) => m.disciplina_nome === 'Ciências');

    expect(materiaMatematica).toBeDefined();
    expect(materiaMatematica!.total_respostas).toBeGreaterThan(0);
    expect(materiaMatematica!.porcentagem_acerto).toBeGreaterThan(60);

    // CIÊNCIAS: O bug anterior atribuía 0% para 20 alunos devido a ativ-demo-cien-prova encerrada sem respostas.
    expect(materiaCiencias).toBeDefined();
    expect(materiaCiencias!.total_respostas).toBeGreaterThan(0);
    expect(materiaCiencias!.porcentagem_acerto).toBeGreaterThan(65);
    expect(materiaCiencias!.porcentagem_acerto).toBeLessThan(85);

    // 5. Verificar turmas sem avaliações (ex: 3º Ano A, 4º Ano A, 5º Ano A)
    const turmasSemAvaliacao = turmasHierarquicas.filter((t) => !t.turma_nome.includes('6º'));
    expect(turmasSemAvaliacao.length).toBeGreaterThan(0);
    for (const turmaSemDados of turmasSemAvaliacao) {
      expect(turmaSemDados.porcentagem_acerto_geral).toBeNull();
      expect(turmaSemDados.total_materias_avaliadas).toBe(0);
      for (const m of turmaSemDados.materias) {
        expect(m.total_respostas).toBe(0);
        expect(m.porcentagem_acerto).toBe(0);
      }
    }

    // 6. Verificar Alunos em Atenção — Apenas casos reais, sem falsos positivos
    const alunosAtencao = await relatorioService.alunosEmAtencao(periodoId);
    const alunosCiencias6A = alunosAtencao.filter(
      (a) => a.turma_nome.includes('6º Ano A') && a.disciplina_nome === 'Ciências'
    );
    // Antes eram 20 alunos falsamente com 0%; agora devem ser apenas os casos com dificuldade real (< 60%)
    expect(alunosCiencias6A.length).toBeLessThanOrEqual(3);
    for (const a of alunosCiencias6A) {
      expect(a.media).toBeGreaterThan(0); // Nenhum aluno deve ter nota fantasma de 0.0%
    }

    // 7. Cálculo Reativo da Média do Período no Conselho
    let somaPontos = 0;
    let totalRespostas = 0;
    turmasHierarquicas.forEach((turma) => {
      turma.materias.forEach((materia) => {
        if (materia.total_respostas > 0) {
          somaPontos += materia.porcentagem_acerto * materia.total_respostas;
          totalRespostas += materia.total_respostas;
        }
      });
    });
    const mediaGeralPeriodo = totalRespostas > 0 ? Math.round((somaPontos / totalRespostas) * 10) / 10 : null;
    expect(mediaGeralPeriodo).not.toBeNull();
    expect(mediaGeralPeriodo!).toBeGreaterThan(65);

    // 8. Teste de formatação da Pauta Geral
    const pautaGeral = formatarPautaConselhoGeral({
      periodoNome: periodoAtivo.nome,
      mediaGeralPeriodo,
      totalAtividadesPeriodo: 5,
      totalTurmasAvaliadas: 1,
      totalTurmasCadastradas: turmasHierarquicas.length,
      turmasHierarquicas,
      alunosAtencao,
      questoesCriticas: [],
      deliberacoes: 'Foco na recuperação de frações e cadeias alimentares.',
    });

    expect(pautaGeral).toContain('📋 PAUTA GERAL DO CONSELHO DE PROFESSORES');
    expect(pautaGeral).toContain(`${mediaGeralPeriodo!.toFixed(1).replace('.', ',')}%`);
    expect(pautaGeral).toContain('(1 avaliadas)');
    expect(pautaGeral).toContain('TURMAS SEM AVALIAÇÕES REGISTRADAS NO PERÍODO');
    expect(pautaGeral).toContain('Foco na recuperação de frações e cadeias alimentares.');

    // 9. Teste de formatação da Pauta por Turma (Sem avaliações)
    const turmaSemDados = turmasSemAvaliacao[0];
    const pautaTurmaSemDados = formatarPautaConselhoTurma({
      periodoNome: periodoAtivo.nome,
      turma: turmaSemDados,
      resumoAtencaoTurma: null,
      deliberacoes: '',
    });
    expect(pautaTurmaSemDados).toContain('Nenhuma avaliação registrada no período');

    // 10. Teste de formatação da Pauta por Professor
    const pautaProfessor = formatarPautaConselhoProfessor({
      periodoNome: periodoAtivo.nome,
      professorNome: 'Carlos Roberto',
      turmas: [
        {
          turmaNome: '6º Ano A',
          disciplinaNome: 'Ciências',
          porcentagemAcerto: materiaCiencias!.porcentagem_acerto,
          porcentagemErro: materiaCiencias!.porcentagem_erro,
          totalRespostas: materiaCiencias!.total_respostas,
          conteudosCriticos: [],
          alunosEmAtencao: [],
        },
      ],
      deliberacoes: 'Planejar aulas práticas de laboratório.',
    });
    expect(pautaProfessor).toContain('CARLOS ROBERTO');
    expect(pautaProfessor).toContain('6º Ano A — Ciências');
    expect(pautaProfessor).toContain(`${materiaCiencias!.porcentagem_acerto}% acertos`);
  });

  it('deve se comportar com segurança e elegância quando selecionado período sem avaliações (1º Bimestre)', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    const periodos = await gestaoService.listarPeriodos();
    const periodo1 = periodos.find((p) => p.nome.includes('1º') || p.id === 'per-bim-1');
    expect(periodo1).toBeDefined();

    const turmasHierarquicas = await relatorioService.desempenhoHierarquicoTurmas(periodo1!.id);
    expect(turmasHierarquicas.length).toBeGreaterThan(0);

    // Todas as turmas devem ter porcentagem_acerto_geral null
    for (const t of turmasHierarquicas) {
      expect(t.porcentagem_acerto_geral).toBeNull();
      expect(t.total_materias_avaliadas).toBe(0);
    }

    // Cálculo reativo da média do período deve ser null
    let somaPontos = 0;
    let totalRespostas = 0;
    turmasHierarquicas.forEach((turma) => {
      turma.materias.forEach((materia) => {
        if (materia.total_respostas > 0) {
          somaPontos += (materia.porcentagem_acerto / 100) * materia.total_respostas;
          totalRespostas += materia.total_respostas;
        }
      });
    });
    const mediaGeralPeriodo = totalRespostas > 0 ? Math.round((somaPontos / totalRespostas) * 10) / 10 : null;
    expect(mediaGeralPeriodo).toBeNull();

    const totalTurmasAvaliadas = turmasHierarquicas.filter((t) => t.porcentagem_acerto_geral !== null).length;
    expect(totalTurmasAvaliadas).toBe(0);

    // Formatação da pauta geral deve agrupar TODAS as turmas como sem avaliações
    const pautaGeral = formatarPautaConselhoGeral({
      periodoNome: periodo1!.nome,
      mediaGeralPeriodo,
      totalAtividadesPeriodo: 0,
      totalTurmasAvaliadas,
      totalTurmasCadastradas: turmasHierarquicas.length,
      turmasHierarquicas,
      alunosAtencao: [],
      questoesCriticas: [],
      deliberacoes: '',
    });

    expect(pautaGeral).toContain('⚪ TURMAS SEM AVALIAÇÕES REGISTRADAS NO PERÍODO:');
    expect(pautaGeral).not.toContain('✅ TURMAS COM RENDIMENTO DENTRO DA META');
    expect(pautaGeral).not.toContain('⚠️ TURMAS COM RENDIMENTO ABAIXO DA META');
  });
});
