import { AlunoEmAtencaoItem } from '@/lib/types';

export interface AlunoDisciplinaAtencao {
  disciplina_id?: string;
  disciplina_nome: string;
  professor_nome: string;
  media: number;
  total_acertos?: number;
  total_questoes?: number;
}

export interface AlunoAtencaoDetalhado {
  aluno_id: string;
  nome_completo: string;
  numero_chamada: number;
  turma_nome: string;
  turma_id?: string;
  media_nesta_disciplina: number;
  total_acertos_nesta_disciplina?: number;
  total_questoes_nesta_disciplina?: number;
  total_materias_em_atencao: number;
  tem_multiplas_materias: boolean;
  outras_materias: AlunoDisciplinaAtencao[];
  todas_materias: AlunoDisciplinaAtencao[];
}

export interface MateriaAtencaoAgrupada {
  disciplina_nome: string;
  disciplina_id?: string;
  professor_nome: string;
  total_alunos: number;
  alunos: AlunoAtencaoDetalhado[];
  total_alunos_multipla_atencao: number;
}

export interface TurmaAtencaoAgrupada {
  turma_nome: string;
  turma_id?: string;
  turma_total_alunos: number;
  total_alunos_unicos: number;
  porcentagem_alunos_atencao: number | null;
  total_alunos_multipla_atencao: number;
  materias: MateriaAtencaoAgrupada[];
}

export interface ResumoAtencaoGeral {
  total_alunos_unicos: number;
  total_turmas_afetadas: number;
  total_alunos_multipla_atencao: number;
  turmas: TurmaAtencaoAgrupada[];
}

/**
 * Agrupa os itens de alunos em atenção por Turma -> Disciplina -> Alunos,
 * identificando estudantes que possuem atenção em múltiplas matérias na mesma turma
 * e calculando totais de acertos e proporções da turma.
 */
export function agruparAlunosEmAtencao(itens: AlunoEmAtencaoItem[]): ResumoAtencaoGeral {
  if (!itens || itens.length === 0) {
    return {
      total_alunos_unicos: 0,
      total_turmas_afetadas: 0,
      total_alunos_multipla_atencao: 0,
      turmas: [],
    };
  }

  // 1. Mapeamento inicial por Turma -> Aluno -> Matérias
  interface AlunoTurmaCache {
    aluno_id: string;
    nome_completo: string;
    numero_chamada: number;
    turma_nome: string;
    turma_id?: string;
    disciplinas: AlunoDisciplinaAtencao[];
  }

  const mapaTurmas = new Map<
    string,
    {
      turma_nome: string;
      turma_id?: string;
      turma_total_alunos: number;
      alunosMap: Map<string, AlunoTurmaCache>;
      itensOriginais: AlunoEmAtencaoItem[];
    }
  >();

  for (const item of itens) {
    const chaveTurma = item.turma_nome;
    let entradaTurma = mapaTurmas.get(chaveTurma);

    if (!entradaTurma) {
      entradaTurma = {
        turma_nome: item.turma_nome,
        turma_id: item.turma_id,
        turma_total_alunos: item.turma_total_alunos || 0,
        alunosMap: new Map(),
        itensOriginais: [],
      };
      mapaTurmas.set(chaveTurma, entradaTurma);
    }

    if (item.turma_total_alunos && item.turma_total_alunos > entradaTurma.turma_total_alunos) {
      entradaTurma.turma_total_alunos = item.turma_total_alunos;
    }
    if (!entradaTurma.turma_id && item.turma_id) {
      entradaTurma.turma_id = item.turma_id;
    }

    entradaTurma.itensOriginais.push(item);

    let alunoEntry = entradaTurma.alunosMap.get(item.aluno_id);
    if (!alunoEntry) {
      alunoEntry = {
        aluno_id: item.aluno_id,
        nome_completo: item.nome_completo,
        numero_chamada: item.numero_chamada,
        turma_nome: item.turma_nome,
        turma_id: item.turma_id,
        disciplinas: [],
      };
      entradaTurma.alunosMap.set(item.aluno_id, alunoEntry);
    }

    alunoEntry.disciplinas.push({
      disciplina_id: item.disciplina_id,
      disciplina_nome: item.disciplina_nome,
      professor_nome: item.professor_nome,
      media: item.media,
      total_acertos: item.total_acertos,
      total_questoes: item.total_questoes,
    });
  }

  // 2. Construir a hierarquia final por turma
  const turmasResultado: TurmaAtencaoAgrupada[] = [];
  const conjuntoAlunosUnicosGeral = new Set<string>();
  let totalAlunosMultiplaGeral = 0;

  for (const [, dadosTurma] of mapaTurmas) {
    const totalAlunosUnicos = dadosTurma.alunosMap.size;
    let totalAlunosMultiplaNaTurma = 0;

    for (const [, alunoInfo] of dadosTurma.alunosMap) {
      conjuntoAlunosUnicosGeral.add(alunoInfo.aluno_id);
      if (alunoInfo.disciplinas.length > 1) {
        totalAlunosMultiplaNaTurma++;
        totalAlunosMultiplaGeral++;
      }
    }

    // Agrupa por Matéria
    const mapaMaterias = new Map<
      string,
      {
        disciplina_nome: string;
        disciplina_id?: string;
        professor_nome: string;
        alunos: AlunoAtencaoDetalhado[];
      }
    >();

    for (const item of dadosTurma.itensOriginais) {
      let entradaMateria = mapaMaterias.get(item.disciplina_nome);
      if (!entradaMateria) {
        entradaMateria = {
          disciplina_nome: item.disciplina_nome,
          disciplina_id: item.disciplina_id,
          professor_nome: item.professor_nome,
          alunos: [],
        };
        mapaMaterias.set(item.disciplina_nome, entradaMateria);
      }

      const alunoCache = dadosTurma.alunosMap.get(item.aluno_id)!;
      const outrasMaterias = alunoCache.disciplinas.filter(
        (d) => d.disciplina_nome !== item.disciplina_nome
      );

      entradaMateria.alunos.push({
        aluno_id: item.aluno_id,
        nome_completo: item.nome_completo,
        numero_chamada: item.numero_chamada,
        turma_nome: item.turma_nome,
        turma_id: item.turma_id,
        media_nesta_disciplina: item.media,
        total_acertos_nesta_disciplina: item.total_acertos,
        total_questoes_nesta_disciplina: item.total_questoes,
        total_materias_em_atencao: alunoCache.disciplinas.length,
        tem_multiplas_materias: alunoCache.disciplinas.length > 1,
        outras_materias: outrasMaterias,
        todas_materias: alunoCache.disciplinas,
      });
    }

    // Ordena alunos dentro de cada matéria da menor para a maior nota
    const materiasProcessadas: MateriaAtencaoAgrupada[] = [];
    for (const [, mat] of mapaMaterias) {
      mat.alunos.sort((a, b) => a.media_nesta_disciplina - b.media_nesta_disciplina || a.numero_chamada - b.numero_chamada);
      const totalMultipla = mat.alunos.filter((a) => a.tem_multiplas_materias).length;

      materiasProcessadas.push({
        disciplina_nome: mat.disciplina_nome,
        disciplina_id: mat.disciplina_id,
        professor_nome: mat.professor_nome,
        total_alunos: mat.alunos.length,
        alunos: mat.alunos,
        total_alunos_multipla_atencao: totalMultipla,
      });
    }

    // Ordena matérias com mais alunos em atenção no topo
    materiasProcessadas.sort((a, b) => b.total_alunos - a.total_alunos || a.disciplina_nome.localeCompare(b.disciplina_nome));

    const pctTurma =
      dadosTurma.turma_total_alunos > 0
        ? Math.round((totalAlunosUnicos / dadosTurma.turma_total_alunos) * 100)
        : null;

    turmasResultado.push({
      turma_nome: dadosTurma.turma_nome,
      turma_id: dadosTurma.turma_id,
      turma_total_alunos: dadosTurma.turma_total_alunos,
      total_alunos_unicos: totalAlunosUnicos,
      porcentagem_alunos_atencao: pctTurma,
      total_alunos_multipla_atencao: totalAlunosMultiplaNaTurma,
      materias: materiasProcessadas,
    });
  }

  // Ordena turmas em ordem alfabética
  turmasResultado.sort((a, b) => a.turma_nome.localeCompare(b.turma_nome));

  return {
    total_alunos_unicos: conjuntoAlunosUnicosGeral.size,
    total_turmas_afetadas: turmasResultado.length,
    total_alunos_multipla_atencao: totalAlunosMultiplaGeral,
    turmas: turmasResultado,
  };
}

/**
 * Formata texto amigável para copiar e colar na pauta da reunião pedagógica por Matéria
 */
export function formatarPautaMateriaTexto(
  turmaNome: string,
  materia: MateriaAtencaoAgrupada,
  nomePeriodo?: string
): string {
  let texto = `📋 PAUTA PEDAGÓGICA — ALUNOS EM ATENÇÃO\n`;
  if (nomePeriodo) texto += `Período: ${nomePeriodo}\n`;
  texto += `Turma: ${turmaNome}\n`;
  texto += `Disciplina: ${materia.disciplina_nome} — Prof(a): ${materia.professor_nome}\n`;
  texto += `Total de alunos em atenção: ${materia.total_alunos}\n\n`;

  texto += `ESTUDANTES QUE NECESSITAM DE APOIO:\n`;
  materia.alunos.forEach((aluno) => {
    const acertosTexto =
      aluno.total_questoes_nesta_disciplina !== undefined && aluno.total_acertos_nesta_disciplina !== undefined
        ? `${aluno.total_acertos_nesta_disciplina}/${aluno.total_questoes_nesta_disciplina} acertos (${aluno.media_nesta_disciplina.toFixed(1).replace('.', ',')}%)`
        : `${aluno.media_nesta_disciplina.toFixed(1).replace('.', ',')}%`;

    let linha = `• #${String(aluno.numero_chamada).padStart(2, '0')} ${aluno.nome_completo}: ${acertosTexto}`;

    if (aluno.tem_multiplas_materias) {
      const outras = aluno.outras_materias.map((o) => o.disciplina_nome).join(', ');
      linha += ` — ⚠️ [Atenção em ${aluno.total_materias_em_atencao} matérias: também em ${outras}]`;
    }

    texto += `${linha}\n`;
  });

  return texto;
}

/**
 * Formata texto amigável para copiar e colar na pauta da reunião pedagógica para a Turma Inteira
 */
export function formatarPautaTurmaTexto(
  turma: TurmaAtencaoAgrupada,
  nomePeriodo?: string
): string {
  let texto = `📋 PAUTA PEDAGÓGICA DA TURMA — ALUNOS EM ATENÇÃO\n`;
  if (nomePeriodo) texto += `Período: ${nomePeriodo}\n`;
  texto += `Turma: ${turma.turma_nome}`;
  if (turma.turma_total_alunos > 0) {
    texto += ` (${turma.total_alunos_unicos} de ${turma.turma_total_alunos} alunos • ${turma.porcentagem_alunos_atencao}% da sala)\n`;
  } else {
    texto += ` (${turma.total_alunos_unicos} alunos em atenção)\n`;
  }

  if (turma.total_alunos_multipla_atencao > 0) {
    texto += `⚠️ Alunos em atenção em mais de uma matéria: ${turma.total_alunos_multipla_atencao}\n`;
  }
  texto += `\n`;

  turma.materias.forEach((materia) => {
    texto += `▶ ${materia.disciplina_nome.toUpperCase()} (Prof(a). ${materia.professor_nome}) — ${materia.total_alunos} ${materia.total_alunos === 1 ? 'aluno' : 'alunos'}:\n`;
    materia.alunos.forEach((aluno) => {
      const acertosTexto =
        aluno.total_questoes_nesta_disciplina !== undefined && aluno.total_acertos_nesta_disciplina !== undefined
          ? `${aluno.total_acertos_nesta_disciplina}/${aluno.total_questoes_nesta_disciplina} acertos (${aluno.media_nesta_disciplina.toFixed(1).replace('.', ',')}%)`
          : `${aluno.media_nesta_disciplina.toFixed(1).replace('.', ',')}%`;

      let linha = `  • #${String(aluno.numero_chamada).padStart(2, '0')} ${aluno.nome_completo}: ${acertosTexto}`;

      if (aluno.tem_multiplas_materias) {
        const outras = aluno.outras_materias.map((o) => o.disciplina_nome).join(', ');
        linha += ` — ⚠️ [Também em: ${outras}]`;
      }
      texto += `${linha}\n`;
    });
    texto += `\n`;
  });

  return texto;
}
