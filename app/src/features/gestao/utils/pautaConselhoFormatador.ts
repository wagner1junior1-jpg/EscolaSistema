import {
  DesempenhoTurmaHierarquico,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
  VisaoGeralEscola,
} from '@/lib/types';
import { agruparAlunosEmAtencao, TurmaAtencaoAgrupada } from './alunosAtencaoAgrupamento';

export interface ParametrosPautaGeral {
  periodoNome?: string;
  mediaGeralPeriodo?: number | null;
  totalAtividadesPeriodo?: number;
  totalTurmasAvaliadas?: number;
  totalTurmasCadastradas?: number;
  visaoGeral?: VisaoGeralEscola | null;
  turmasHierarquicas: DesempenhoTurmaHierarquico[];
  alunosAtencao: AlunoEmAtencaoItem[];
  questoesCriticas: QuestaoCriticaEscolaItem[];
  deliberacoes?: string;
}

export interface ParametrosPautaTurma {
  periodoNome?: string;
  turma: DesempenhoTurmaHierarquico;
  resumoAtencaoTurma?: TurmaAtencaoAgrupada | null;
  deliberacoes?: string;
}

export interface TurmaDoProfessorResumo {
  turmaNome: string;
  disciplinaNome: string;
  porcentagemAcerto: number;
  porcentagemErro: number;
  totalRespostas: number;
  conteudosCriticos: string[];
  alunosEmAtencao: string[];
}

export interface ParametrosPautaProfessor {
  periodoNome?: string;
  professorNome: string;
  turmas: TurmaDoProfessorResumo[];
  deliberacoes?: string;
}

/**
 * Formata a Pauta Geral do Conselho de Professores para a escola toda
 */
export function formatarPautaConselhoGeral(params: ParametrosPautaGeral): string {
  const {
    periodoNome = 'Bimestre Atual',
    mediaGeralPeriodo,
    totalAtividadesPeriodo,
    totalTurmasAvaliadas,
    totalTurmasCadastradas,
    visaoGeral,
    turmasHierarquicas,
    alunosAtencao,
    questoesCriticas,
    deliberacoes,
  } = params;

  const agrupamentoAtencao = agruparAlunosEmAtencao(alunosAtencao);

  const mediaExibicao =
    mediaGeralPeriodo !== undefined && mediaGeralPeriodo !== null
      ? mediaGeralPeriodo
      : visaoGeral?.aproveitamento_medio ?? null;

  const totalAtivExibicao =
    totalAtividadesPeriodo !== undefined
      ? totalAtividadesPeriodo
      : visaoGeral?.total_atividades_publicadas ?? 0;

  const totalTurmas = totalTurmasCadastradas ?? visaoGeral?.total_turmas ?? turmasHierarquicas.length;
  const turmasAvaliadasCount =
    totalTurmasAvaliadas ?? turmasHierarquicas.filter((t) => t.porcentagem_acerto_geral !== null).length;
  const totalAlunos = visaoGeral?.total_alunos ?? 0;

  let texto = `📋 PAUTA GERAL DO CONSELHO DE PROFESSORES\n`;
  texto += `Período: ${periodoNome}\n`;
  texto += `Escola: Gestão e Equipe Pedagógica\n`;
  texto += `------------------------------------------------------------\n\n`;

  // 1. PANORAMA GERAL DO BIMESTRE
  texto += `1. PANORAMA GERAL DA ESCOLA\n`;
  if (mediaExibicao !== null) {
    texto += `• Média Geral de Rendimento no Período: ${mediaExibicao.toFixed(1).replace('.', ',')}%\n`;
  } else {
    texto += `• Média Geral de Rendimento no Período: Sem avaliações registradas\n`;
  }
  texto += `• Total de Turmas: ${totalTurmas} (${turmasAvaliadasCount} avaliadas) | Total de Estudantes: ${totalAlunos}\n`;
  texto += `• Atividades Realizadas no Período: ${totalAtivExibicao}\n`;
  texto += `• Total de Estudantes em Atenção: ${agrupamentoAtencao.total_alunos_unicos}\n`;
  if (agrupamentoAtencao.total_alunos_multipla_atencao > 0) {
    texto += `• Casos Críticos (Atenção em 2 ou mais matérias): ${agrupamentoAtencao.total_alunos_multipla_atencao} estudantes\n`;
  }
  texto += `\n`;

  // 2. DIAGNÓSTICO POR TURMA (O QUE CONVERSAR COM OS PROFESSORES)
  texto += `2. DIAGNÓSTICO DAS TURMAS (O QUE CONVERSAR NA REUNIÃO)\n`;
  if (turmasHierarquicas.length === 0) {
    texto += `• Nenhuma turma avaliada no período.\n`;
  } else {
    // Turmas prioritárias (rendimento < 60%)
    const criticas = turmasHierarquicas.filter(
      (t) => t.porcentagem_acerto_geral !== null && t.porcentagem_acerto_geral < 60
    );
    // Turmas dentro da meta (>= 60%)
    const regularesOuBoas = turmasHierarquicas.filter(
      (t) => t.porcentagem_acerto_geral !== null && t.porcentagem_acerto_geral >= 60
    );
    // Turmas sem avaliações
    const semAvaliacoes = turmasHierarquicas.filter(
      (t) => t.porcentagem_acerto_geral === null
    );

    if (criticas.length > 0) {
      texto += `⚠️ TURMAS QUE EXIGEM ATENÇÃO PRIORITÁRIA (< 60% DE RENDIMENTO):\n`;
      criticas.forEach((t) => {
        texto += `  • ${t.turma_nome}: ${t.porcentagem_acerto_geral ?? 0}% de acerto geral\n`;
        // Disciplinas mais baixas na turma que tiveram respostas
        const disciplinasBaixas = t.materias.filter((m) => m.total_respostas > 0 && m.porcentagem_acerto < 60);
        if (disciplinasBaixas.length > 0) {
          const mats = disciplinasBaixas
            .map((m) => `${m.disciplina_nome} (${m.porcentagem_acerto}%)`)
            .join(', ');
          texto += `    ↳ Disciplinas abaixo da meta: ${mats}\n`;
        }
      });
      texto += `\n`;
    }

    if (regularesOuBoas.length > 0) {
      texto += `✅ TURMAS COM RENDIMENTO DENTRO DA META (>= 60%):\n`;
      regularesOuBoas.forEach((t) => {
        texto += `  • ${t.turma_nome}: ${t.porcentagem_acerto_geral}% de rendimento geral\n`;
      });
      texto += `\n`;
    }

    if (semAvaliacoes.length > 0) {
      texto += `⚪ TURMAS SEM AVALIAÇÕES REGISTRADAS NO PERÍODO:\n`;
      semAvaliacoes.forEach((t) => {
        texto += `  • ${t.turma_nome}: Nenhuma atividade realizada\n`;
      });
      texto += `\n`;
    }
  }

  // 3. ESTUDANTES COM DIFICULDADE EM MÚLTIPLAS MATÉRIAS
  const alunosCriticos = agrupamentoAtencao.turmas.flatMap((turma) =>
    turma.materias.flatMap((materia) =>
      materia.alunos.filter((a) => a.tem_multiplas_materias)
    )
  );

  // De-duplica por aluno_id
  const mapaUnicos = new Map<string, typeof alunosCriticos[0]>();
  alunosCriticos.forEach((a) => {
    if (!mapaUnicos.has(a.aluno_id)) {
      mapaUnicos.set(a.aluno_id, a);
    }
  });

  texto += `3. ESTUDANTES PRIORITÁRIOS (INTERVENÇÃO MULTIDISCIPLINAR)\n`;
  if (mapaUnicos.size === 0) {
    texto += `• Nenhum aluno com acúmulo de atenção em múltiplas matérias.\n`;
  } else {
    texto += `Estudantes em atenção em 2 ou mais matérias — alinhar ação conjunta dos professores:\n`;
    mapaUnicos.forEach((a) => {
      const materias = a.todas_materias.map((m) => `${m.disciplina_nome} (${m.media.toFixed(1).replace('.', ',')}%)`).join(', ');
      texto += `  • #${String(a.numero_chamada).padStart(2, '0')} ${a.nome_completo} (${a.turma_nome}): Atenção em ${a.total_materias_em_atencao} disciplinas [${materias}]\n`;
    });
  }
  texto += `\n`;

  // 4. DEFASAGENS COLETIVAS (CONTEÚDOS E QUESTÕES COM MAIOR ÍNDICE DE ERRO)
  texto += `4. DEFASAGENS COLETIVAS E CONTEÚDOS CRÍTICOS\n`;
  if (questoesCriticas.length === 0) {
    texto += `• Não foram detectadas questões com alto índice de erro coletivo.\n`;
  } else {
    texto += `Tópicos pedagógicos onde os alunos apresentaram maior dificuldade nas provas/exercícios:\n`;
    const topCriticas = questoesCriticas.slice(0, 5);
    topCriticas.forEach((q, idx) => {
      texto += `  ${idx + 1}. [${q.disciplina_nome} - ${q.turma_nome}] Questão ${q.ordem}: ${q.porcentagem_acerto}% de acertos (${100 - q.porcentagem_acerto}% de erros)\n`;
      texto += `     Enunciado: "${q.enunciado.substring(0, 90)}${q.enunciado.length > 90 ? '...' : ''}"\n`;
      if (q.distrator_mais_escolhido?.por_que_errou) {
        texto += `     Diagnóstico do erro: ${q.distrator_mais_escolhido.por_que_errou}\n`;
      }
    });
  }
  texto += `\n`;

  // 5. ENCAMINHAMENTOS E DELIBERAÇÕES
  texto += `5. ENCAMINHAMENTOS & DELIBERAÇÕES DO CONSELHO\n`;
  if (deliberacoes && deliberacoes.trim().length > 0) {
    texto += `${deliberacoes.trim()}\n`;
  } else {
    texto += `• Definir datas e formatos de recuperação paralela para as matérias críticas.\n`;
    texto += `• Convocar responsáveis pelos estudantes com múltiplas notas baixas para alinhamento.\n`;
    texto += `• Planejar reforço focado nas principais defasagens de aprendizagem identificadas.\n`;
  }

  return texto;
}

/**
 * Formata a Pauta do Conselho de Classe específica para uma Turma
 */
export function formatarPautaConselhoTurma(params: ParametrosPautaTurma): string {
  const { periodoNome = 'Bimestre Atual', turma, resumoAtencaoTurma, deliberacoes } = params;

  let texto = `📋 CONSELHO DE CLASSE — TURMA ${turma.turma_nome.toUpperCase()}\n`;
  texto += `Período: ${periodoNome}\n`;
  texto += `Total de Alunos: ${turma.total_alunos}\n`;
  const pctAcerto = turma.porcentagem_acerto_geral !== null ? `${turma.porcentagem_acerto_geral}%` : 'Não calculada';
  texto += `Média Geral da Turma: ${pctAcerto} de acerto\n`;
  texto += `------------------------------------------------------------\n\n`;

  // 1. DESEMPENHO POR DISCIPLINA NA TURMA
  texto += `1. RENDIMENTO POR DISCIPLINA & DOCENTES\n`;
  if (turma.materias.length === 0) {
    texto += `• Nenhuma disciplina avaliada nesta turma.\n`;
  } else {
    turma.materias.forEach((m) => {
      if (m.total_respostas === 0) {
        texto += `• ⚪ ${m.disciplina_nome.toUpperCase()} (Prof(a). ${m.professor_nome})\n`;
        texto += `  Rendimento: Nenhuma avaliação registrada no período\n`;
        return;
      }
      const statusIcon = m.porcentagem_acerto >= 70 ? '🟢' : m.porcentagem_acerto >= 60 ? '🟡' : '🔴';
      texto += `• ${statusIcon} ${m.disciplina_nome.toUpperCase()} (Prof(a). ${m.professor_nome})\n`;
      texto += `  Rendimento: ${m.porcentagem_acerto}% acertos | ${m.porcentagem_erro}% erros (${m.total_respostas} respostas avaliadas)\n`;
      
      // Conteúdos com maior erro
      const conteudosComDificuldade = m.conteudos.filter((c) => c.porcentagem_erro > 35);
      if (conteudosComDificuldade.length > 0) {
        const nomes = conteudosComDificuldade.map((c) => `${c.conteudo_nome} (${c.porcentagem_erro}% erro)`).join(', ');
        texto += `  Conteúdos com dificuldade: ${nomes}\n`;
      }
    });
  }
  texto += `\n`;

  // 2. ESTUDANTES QUE NECESSITAM DE APOIO NA TURMA
  texto += `2. ESTUDANTES EM ATENÇÃO NESTA TURMA\n`;
  if (!resumoAtencaoTurma || resumoAtencaoTurma.total_alunos_unicos === 0) {
    texto += `• Nenhum aluno em situação de atenção nesta turma no período.\n`;
  } else {
    texto += `Total de estudantes em atenção: ${resumoAtencaoTurma.total_alunos_unicos} de ${turma.total_alunos} (${resumoAtencaoTurma.porcentagem_alunos_atencao ?? 0}% da sala)\n\n`;

    resumoAtencaoTurma.materias.forEach((mat) => {
      texto += `▶ ${mat.disciplina_nome} — ${mat.total_alunos} ${mat.total_alunos === 1 ? 'aluno' : 'alunos'}:\n`;
      mat.alunos.forEach((aluno) => {
        let linha = `  • #${String(aluno.numero_chamada).padStart(2, '0')} ${aluno.nome_completo}: ${aluno.media_nesta_disciplina.toFixed(1).replace('.', ',')}%`;
        if (aluno.tem_multiplas_materias) {
          const outras = aluno.outras_materias.map((o) => o.disciplina_nome).join(', ');
          linha += ` ⚠️ [Também em atenção em: ${outras}]`;
        }
        texto += `${linha}\n`;
      });
    });
  }
  texto += `\n`;

  // 3. DIRETRIZES E ENCAMINHAMENTOS
  texto += `3. ENCAMINHAMENTOS DECIDIDOS PARA A TURMA\n`;
  if (deliberacoes && deliberacoes.trim().length > 0) {
    texto += `${deliberacoes.trim()}\n`;
  } else {
    texto += `• Estratégias de recuperação paralela acordadas com os professores.\n`;
    texto += `• Acompanhamento individual dos alunos em atenção multidisciplinar.\n`;
    texto += `• Comunicação aos responsáveis dos casos prioritários.\n`;
  }

  return texto;
}

/**
 * Formata a Pauta Pedagógica para conversa individual com um Professor
 */
export function formatarPautaConselhoProfessor(params: ParametrosPautaProfessor): string {
  const { periodoNome = 'Bimestre Atual', professorNome, turmas, deliberacoes } = params;

  const turmasAvaliadasCount = turmas.filter((t) => t.totalRespostas > 0).length;

  let texto = `📋 PAUTA PEDAGÓGICA INDIVIDUAL — PROF(A). ${professorNome.toUpperCase()}\n`;
  texto += `Período: ${periodoNome}\n`;
  texto += `Total de Turmas Avaliadas: ${turmasAvaliadasCount} (de ${turmas.length} vinculadas)\n`;
  texto += `------------------------------------------------------------\n\n`;

  texto += `1. QUADRO DE RENDIMENTO POR TURMA\n`;
  if (turmas.length === 0) {
    texto += `• Nenhuma atividade com respostas registradas no período para este(a) docente.\n`;
  } else {
    turmas.forEach((t) => {
      if (t.totalRespostas === 0) {
        texto += `• ⚪ ${t.turmaNome} — ${t.disciplinaNome}: Sem avaliações registradas no período\n`;
        return;
      }
      const statusIcon = t.porcentagemAcerto >= 70 ? '🟢' : t.porcentagemAcerto >= 60 ? '🟡' : '🔴';
      texto += `• ${statusIcon} ${t.turmaNome} — ${t.disciplinaNome}: ${t.porcentagemAcerto}% acertos (${t.porcentagemErro}% erros)\n`;
      
      if (t.conteudosCriticos.length > 0) {
        texto += `  Conteúdos com maior defasagem: ${t.conteudosCriticos.join(', ')}\n`;
      }

      if (t.alunosEmAtencao.length > 0) {
        texto += `  Alunos em atenção nesta turma (${t.alunosEmAtencao.length}): ${t.alunosEmAtencao.join(', ')}\n`;
      } else {
        texto += `  Nenhum aluno em atenção nesta turma.\n`;
      }
    });
  }
  texto += `\n`;

  texto += `2. ENCAMINHAMENTOS & COMBINADOS COM O DOCENTE\n`;
  if (deliberacoes && deliberacoes.trim().length > 0) {
    texto += `${deliberacoes.trim()}\n`;
  } else {
    texto += `• Alinhamento do plano de recuperação paralela para os conteúdos com maior índice de erro.\n`;
    texto += `• Estratégias pedagógicas para apoio aos estudantes que necessitam de intervenção.\n`;
    texto += `• Aplicação de novas atividades diagnósticas ou exercícios no banco.\n`;
  }

  return texto;
}
