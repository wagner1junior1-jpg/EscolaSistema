/**
 * SaberPontual — RelatorioService Mock
 */

import { RelatorioService } from '../contracts';
import {
  RelatorioConselho,
  VisaoGeralEscola,
  ItemConselhoAluno,
  SegmentoTurma,
} from '@/lib/types';
import { getDatabase } from './db';
import {
  calcularMediaPeriodo,
  consolidarFrequenciaAluno,
  determinarSituacaoConselho,
} from '../calculos';

export class MockRelatorioService implements RelatorioService {
  async conselhoDeClasse(
    turmaId: string,
    periodoId: string
  ): Promise<RelatorioConselho> {
    const db = await getDatabase();

    const turma = db.turmas.find((t) => t.id === turmaId);
    if (!turma) throw new Error('Turma não encontrada.');

    const periodo = db.periodos.find((p) => p.id === periodoId);
    if (!periodo) throw new Error('Período não encontrado.');

    const alunos = db.alunos
      .filter((a) => a.turma_id === turmaId && a.ativo)
      .sort((a, b) => a.numero_chamada - b.numero_chamada);

    const ofertasDaTurma = db.ofertas.filter((o) => o.turma_id === turmaId);
    const ofertaIds = ofertasDaTurma.map((o) => o.id);

    // Atividades do período desta turma (concluídas ou encerradas)
    const atividadesDoPeriodo = db.atividades.filter(
      (a) =>
        ofertaIds.includes(a.oferta_id) &&
        a.periodo_id === periodoId &&
        a.status !== 'rascunho'
    );

    const itensConselho: ItemConselhoAluno[] = [];

    for (const aluno of alunos) {
      let somaAcertos = 0;
      let somaQuestoes = 0;
      let avaliouPeloMenosUma = false;

      for (const ativ of atividadesDoPeriodo) {
        const questoes = db.questoes.filter((q) => q.atividade_id === ativ.id);
        const respostas = db.respostas.filter(
          (r) =>
            r.aluno_id === aluno.id &&
            questoes.some((q) => q.id === r.questao_id)
        );

        if (questoes.length > 0 && respostas.length === questoes.length) {
          avaliouPeloMenosUma = true;
          somaAcertos += respostas.filter((r) => r.acertou).length;
          somaQuestoes += questoes.length;
        } else if (ativ.status === 'encerrada') {
          avaliouPeloMenosUma = true;
          somaAcertos += respostas.filter((r) => r.acertou).length;
          somaQuestoes += questoes.length;
        }
      }

      const mediaGeral = calcularMediaPeriodo(somaAcertos, somaQuestoes);

      // Frequência consolidada de todas as ofertas da turma
      const registrosFreq = db.frequencias.filter(
        (f) => ofertaIds.includes(f.oferta_id) && f.aluno_id === aluno.id
      );
      const freqStats = consolidarFrequenciaAluno(registrosFreq);

      const situacao = determinarSituacaoConselho(
        mediaGeral,
        freqStats.porcentagem,
        avaliouPeloMenosUma
      );

      itensConselho.push({
        aluno_id: aluno.id,
        numero_chamada: aluno.numero_chamada,
        nome_completo: aluno.nome_completo,
        media_geral: mediaGeral,
        frequencia_geral: freqStats.porcentagem,
        situacao,
      });
    }

    return {
      turma,
      periodo,
      alunos: itensConselho,
    };
  }

  async visaoGeralEscola(): Promise<VisaoGeralEscola> {
    const db = await getDatabase();

    const totalAlunos = db.alunos.filter((a) => a.ativo).length;
    const totalProfessores = db.perfis.filter(
      (p) => p.papel === 'professor' && p.ativo
    ).length;
    const turmasAtivas = db.turmas.filter((t) => t.ativa);
    const totalTurmas = turmasAtivas.length;

    const turmasPorSegmento: Record<SegmentoTurma, number> = {
      fund1: 0,
      fund2: 0,
      medio: 0,
    };

    for (const t of turmasAtivas) {
      turmasPorSegmento[t.segmento] = (turmasPorSegmento[t.segmento] || 0) + 1;
    }

    // Aproveitamento médio global baseado em todas as respostas
    const totalRespostas = db.respostas.length;
    const totalAcertos = db.respostas.filter((r) => r.acertou).length;

    const aproveitamentoGlobal =
      totalRespostas > 0
        ? Math.round((totalAcertos / totalRespostas) * 1000) / 10
        : null;

    return {
      total_alunos: totalAlunos,
      total_professores: totalProfessores,
      total_turmas: totalTurmas,
      aproveitamento_medio_global: aproveitamentoGlobal,
      turmas_por_segmento: turmasPorSegmento,
    };
  }
}
