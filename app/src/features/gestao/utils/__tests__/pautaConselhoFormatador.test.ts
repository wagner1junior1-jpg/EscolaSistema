import { describe, it, expect } from 'vitest';
import {
  formatarPautaConselhoGeral,
  formatarPautaConselhoTurma,
  formatarPautaConselhoProfessor,
} from '../pautaConselhoFormatador';
import {
  DesempenhoTurmaHierarquico,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
  VisaoGeralEscola,
} from '@/lib/types';

describe('pautaConselhoFormatador', () => {
  const visaoGeralMock: VisaoGeralEscola = {
    total_alunos: 120,
    total_turmas: 4,
    total_professores: 6,
    total_atividades_publicadas: 15,
    aproveitamento_medio: 68.5,
  };

  const turmasHierarquicasMock: DesempenhoTurmaHierarquico[] = [
    {
      turma_id: 'turma-1',
      turma_nome: '6º Ano A',
      turma_serie: '6º Ano',
      total_alunos: 30,
      porcentagem_acerto_geral: 54,
      porcentagem_erro_geral: 46,
      total_materias_avaliadas: 2,
      materias: [
        {
          disciplina_id: 'disc-mat',
          disciplina_nome: 'Matemática',
          professor_nome: 'Carlos Souza',
          total_alunos: 30,
          total_respostas: 150,
          porcentagem_acerto: 52,
          porcentagem_erro: 48,
          conteudos: [
            {
              conteudo_id: 'c-fracoes',
              conteudo_nome: 'Frações e Decimais',
              total_questoes: 5,
              total_respostas: 150,
              porcentagem_acerto: 45,
              porcentagem_erro: 55,
              questoes: [],
            },
          ],
        },
        {
          disciplina_id: 'disc-hist',
          disciplina_nome: 'História',
          professor_nome: 'Mariana Lima',
          total_alunos: 30,
          total_respostas: 0,
          porcentagem_acerto: 0,
          porcentagem_erro: 0,
          conteudos: [],
        },
      ],
    },
    {
      turma_id: 'turma-2',
      turma_nome: '7º Ano B',
      turma_serie: '7º Ano',
      total_alunos: 28,
      porcentagem_acerto_geral: 78,
      porcentagem_erro_geral: 22,
      total_materias_avaliadas: 1,
      materias: [
        {
          disciplina_id: 'disc-hist',
          disciplina_nome: 'História',
          professor_nome: 'Mariana Lima',
          total_alunos: 28,
          total_respostas: 120,
          porcentagem_acerto: 78,
          porcentagem_erro: 22,
          conteudos: [],
        },
      ],
    },
    {
      turma_id: 'turma-3',
      turma_nome: '8º Ano C',
      turma_serie: '8º Ano',
      total_alunos: 25,
      porcentagem_acerto_geral: null,
      porcentagem_erro_geral: null,
      total_materias_avaliadas: 0,
      materias: [],
    },
  ];

  const alunosAtencaoMock: AlunoEmAtencaoItem[] = [
    {
      aluno_id: 'aluno-1',
      nome_completo: 'Lucas Silva',
      numero_chamada: 12,
      turma_nome: '6º Ano A',
      disciplina_nome: 'Matemática',
      professor_nome: 'Carlos Souza',
      media: 42.0,
      faixa: 'Atenção',
    },
    {
      aluno_id: 'aluno-1',
      nome_completo: 'Lucas Silva',
      numero_chamada: 12,
      turma_nome: '6º Ano A',
      disciplina_nome: 'Ciências',
      professor_nome: 'Ana Duarte',
      media: 48.0,
      faixa: 'Atenção',
    },
  ];

  const questoesCriticasMock: QuestaoCriticaEscolaItem[] = [
    {
      questao_id: 'q-1',
      atividade_id: 'ativ-1',
      atividade_titulo: 'Prova 1',
      turma_nome: '6º Ano A',
      disciplina_nome: 'Matemática',
      professor_nome: 'Carlos Souza',
      ordem: 3,
      enunciado: 'Qual fração representa 0,75?',
      total_respostas: 30,
      porcentagem_acerto: 35,
      distrator_mais_escolhido: {
        letra: 'B',
        por_que_errou: 'Confundiu numerador com denominador na simplificação',
        total_escolhas: 18,
      },
    },
  ];

  it('deve gerar a pauta geral do conselho com seções e diagnósticos completos', () => {
    const pauta = formatarPautaConselhoGeral({
      periodoNome: '1º Bimestre',
      mediaGeralPeriodo: 71.5,
      totalAtividadesPeriodo: 6,
      totalTurmasAvaliadas: 2,
      totalTurmasCadastradas: 3,
      visaoGeral: visaoGeralMock,
      turmasHierarquicas: turmasHierarquicasMock,
      alunosAtencao: alunosAtencaoMock,
      questoesCriticas: questoesCriticasMock,
      deliberacoes: 'Ficou acertado reforço às quintas-feiras.',
    });

    expect(pauta).toContain('PAUTA GERAL DO CONSELHO DE PROFESSORES');
    expect(pauta).toContain('Período: 1º Bimestre');
    expect(pauta).toContain('71,5%');
    expect(pauta).toContain('Atividades Realizadas no Período: 6');
    expect(pauta).toContain('Total de Turmas: 3 (2 avaliadas)');
    expect(pauta).toContain('6º Ano A: 54% de acerto geral');
    expect(pauta).toContain('7º Ano B: 78% de rendimento geral');
    expect(pauta).toContain('TURMAS SEM AVALIAÇÕES REGISTRADAS NO PERÍODO');
    expect(pauta).toContain('8º Ano C: Nenhuma atividade realizada');
    expect(pauta).toContain('Lucas Silva');
    expect(pauta).toContain('Qual fração representa 0,75?');
    expect(pauta).toContain('Ficou acertado reforço às quintas-feiras.');
  });

  it('deve gerar a pauta específica por turma tratando matérias sem avaliação de forma neutra', () => {
    const pautaTurma = formatarPautaConselhoTurma({
      periodoNome: '1º Bimestre',
      turma: turmasHierarquicasMock[0],
      deliberacoes: 'Reunião com pais agendada.',
    });

    expect(pautaTurma).toContain('CONSELHO DE CLASSE — TURMA 6º ANO A');
    expect(pautaTurma).toContain('MATEMÁTICA (Prof(a). Carlos Souza)');
    expect(pautaTurma).toContain('Frações e Decimais (55% erro)');
    expect(pautaTurma).toContain('⚪ HISTÓRIA (Prof(a). Mariana Lima)');
    expect(pautaTurma).toContain('Nenhuma avaliação registrada no período');
    expect(pautaTurma).toContain('Reunião com pais agendada.');
  });

  it('deve gerar a pauta do professor com rendimento e neutralidade para turmas sem respostas', () => {
    const pautaProf = formatarPautaConselhoProfessor({
      periodoNome: '1º Bimestre',
      professorNome: 'Carlos Souza',
      turmas: [
        {
          turmaNome: '6º Ano A',
          disciplinaNome: 'Matemática',
          porcentagemAcerto: 52,
          porcentagemErro: 48,
          totalRespostas: 150,
          conteudosCriticos: ['Frações e Decimais'],
          alunosEmAtencao: ['Lucas Silva'],
        },
        {
          turmaNome: '7º Ano B',
          disciplinaNome: 'Matemática',
          porcentagemAcerto: 0,
          porcentagemErro: 0,
          totalRespostas: 0,
          conteudosCriticos: [],
          alunosEmAtencao: [],
        },
      ],
      deliberacoes: 'Aplicar lista diagnóstica na próxima semana.',
    });

    expect(pautaProf).toContain('PAUTA PEDAGÓGICA INDIVIDUAL — PROF(A). CARLOS SOUZA');
    expect(pautaProf).toContain('Total de Turmas Avaliadas: 1 (de 2 vinculadas)');
    expect(pautaProf).toContain('6º Ano A — Matemática: 52% acertos');
    expect(pautaProf).toContain('⚪ 7º Ano B — Matemática: Sem avaliações registradas no período');
    expect(pautaProf).not.toContain('7º Ano B — Matemática: 0% acertos');
    expect(pautaProf).toContain('Frações e Decimais');
    expect(pautaProf).toContain('Lucas Silva');
    expect(pautaProf).toContain('Aplicar lista diagnóstica na próxima semana.');
  });
});
