/**
 * SaberPontual — RelatorioService Mock
 * 
 * Regras:
 * - Apenas 'direcao' e 'coordenacao' podem acessar relatórios pedagógicos e institucionais.
 * - Relatórios focados em desempenho pedagógico e acompanhamento escolar.
 */

import { RelatorioService } from '../contracts';
import {
  VisaoGeralEscola,
  DesempenhoTurmaDisciplinaItem,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
  ItemMapaDeCalorQuestao,
} from '@/lib/types';
import { getDatabase } from './db';
import { exigirUsuario } from './autorizacao';
import {
  calcularMapaDeCalorQuestao,
  faixaDesempenho,
  questoesCriticas,
  mediaDoAlunoNasAtividades,
} from '../calculos';

export class MockRelatorioService implements RelatorioService {
  async visaoGeralEscola(): Promise<VisaoGeralEscola> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const totalAlunos = db.alunos.filter((a) => a.ativo).length;
    const totalProfessores = db.perfis.filter(
      (p) => p.papel === 'professor' && p.ativo
    ).length;
    const totalTurmas = db.turmas.filter((t) => t.ativa).length;
    const totalAtividadesPublicadas = db.atividades.filter(
      (a) => a.status === 'publicada' || a.status === 'encerrada'
    ).length;

    // Aproveitamento médio geral calculado com a 1ª resposta de todas as respostas
    const totalRespostas = db.respostas.length;
    const totalAcertos = db.respostas.filter((r) => r.acertou).length;
    const aproveitamentoMedio =
      totalRespostas > 0
        ? Math.round((totalAcertos / totalRespostas) * 1000) / 10
        : null;

    return {
      total_alunos: totalAlunos,
      total_turmas: totalTurmas,
      total_professores: totalProfessores,
      total_atividades_publicadas: totalAtividadesPublicadas,
      aproveitamento_medio: aproveitamentoMedio,
    };
  }

  async desempenhoTurmas(periodoId: string): Promise<DesempenhoTurmaDisciplinaItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const turmasAtivas = db.turmas.filter((t) => t.ativa);
    const resultado: DesempenhoTurmaDisciplinaItem[] = [];

    for (const turma of turmasAtivas) {
      const ofertasDaTurma = db.ofertas.filter((o) => o.turma_id === turma.id);

      for (const oferta of ofertasDaTurma) {
        const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
        const professor = db.perfis.find((p) => p.id === oferta.professor_id);
        const alunos = db.alunos.filter((a) => a.turma_id === turma.id && a.ativo);

        const atividadesDaOferta = db.atividades.filter(
          (a) =>
            a.oferta_id === oferta.id &&
            a.periodo_id === periodoId &&
            (a.status === 'publicada' || a.status === 'encerrada')
        );

        let somaMedias = 0;
        let alunosComMedia = 0;

        const contagemFaixas = {
          otimo: 0,
          bom: 0,
          atencao: 0,
          sem_atividades: 0,
        };

        for (const aluno of alunos) {
          const { media } = mediaDoAlunoNasAtividades(
            atividadesDaOferta,
            db.questoes,
            db.respostas.filter((r) => r.aluno_id === aluno.id)
          );
          const faixa = faixaDesempenho(media);

          if (faixa === 'Ótimo') contagemFaixas.otimo++;
          else if (faixa === 'Bom') contagemFaixas.bom++;
          else if (faixa === 'Atenção') contagemFaixas.atencao++;
          else contagemFaixas.sem_atividades++;

          if (media !== null) {
            somaMedias += media;
            alunosComMedia++;
          }
        }

        const aproveitamentoMedio =
          alunosComMedia > 0 ? Math.round((somaMedias / alunosComMedia) * 10) / 10 : null;

        resultado.push({
          turma_id: turma.id,
          turma_nome: turma.nome,
          disciplina_id: disciplina?.id || '',
          disciplina_nome: disciplina?.nome || 'Disciplina',
          professor_nome: professor?.nome || 'Professor',
          total_alunos: alunos.length,
          aproveitamento_medio: aproveitamentoMedio,
          faixas: contagemFaixas,
        });
      }
    }

    return resultado;
  }

  async alunosEmAtencao(periodoId: string): Promise<AlunoEmAtencaoItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const resultado: AlunoEmAtencaoItem[] = [];
    const ofertas = db.ofertas;

    for (const oferta of ofertas) {
      const turma = db.turmas.find((t) => t.id === oferta.turma_id && t.ativa);
      if (!turma) continue;

      const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
      const professor = db.perfis.find((p) => p.id === oferta.professor_id);
      const alunos = db.alunos.filter((a) => a.turma_id === turma.id && a.ativo);

      const atividades = db.atividades.filter(
        (a) =>
          a.oferta_id === oferta.id &&
          a.periodo_id === periodoId &&
          (a.status === 'publicada' || a.status === 'encerrada')
      );

      for (const aluno of alunos) {
        const { media } = mediaDoAlunoNasAtividades(
          atividades,
          db.questoes,
          db.respostas.filter((r) => r.aluno_id === aluno.id)
        );
        const faixa = faixaDesempenho(media);

        if (faixa === 'Atenção' && media !== null) {
          resultado.push({
            aluno_id: aluno.id,
            nome_completo: aluno.nome_completo,
            numero_chamada: aluno.numero_chamada,
            turma_nome: turma.nome,
            disciplina_nome: disciplina?.nome || 'Disciplina',
            professor_nome: professor?.nome || 'Professor',
            media,
            faixa: 'Atenção',
          });
        }
      }
    }

    return resultado.sort((a, b) => a.turma_nome.localeCompare(b.turma_nome) || a.numero_chamada - b.numero_chamada);
  }

  async questoesCriticasEscola(periodoId: string): Promise<QuestaoCriticaEscolaItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const atividadesDoPeriodo = db.atividades.filter(
      (a) => a.periodo_id === periodoId && (a.status === 'publicada' || a.status === 'encerrada')
    );

    const todosItensMapa: Array<{ item: ItemMapaDeCalorQuestao; atividadeId: string }> = [];

    for (const ativ of atividadesDoPeriodo) {
      const questoes = db.questoes.filter((q) => q.atividade_id === ativ.id);
      for (const q of questoes) {
        const alts = db.alternativas.filter((a) => a.questao_id === q.id);
        const respostas = db.respostas.filter((r) => r.questao_id === q.id);
        const itemMapa = calcularMapaDeCalorQuestao(q, alts, respostas);
        todosItensMapa.push({ item: itemMapa, atividadeId: ativ.id });
      }
    }

    // Filtra questões críticas (mínimo 5 respostas e corte < 50% de acerto)
    const itensCriticos = questoesCriticas(
      todosItensMapa.map((t) => t.item),
      5,
      50
    );

    const criticosIds = new Set(itensCriticos.map((i) => i.questao_id));
    const itensFiltrados = todosItensMapa.filter((t) => criticosIds.has(t.item.questao_id));

    return itensFiltrados.map(({ item, atividadeId }) => {
      const ativ = db.atividades.find((a) => a.id === atividadeId)!;
      const oferta = db.ofertas.find((o) => o.id === ativ.oferta_id);
      const turma = db.turmas.find((t) => t.id === oferta?.turma_id);
      const disciplina = db.disciplinas.find((d) => d.id === oferta?.disciplina_id);
      const professor = db.perfis.find((p) => p.id === oferta?.professor_id);

      return {
        questao_id: item.questao_id,
        atividade_id: ativ.id,
        atividade_titulo: ativ.titulo,
        turma_nome: turma?.nome || '',
        disciplina_nome: disciplina?.nome || '',
        professor_nome: professor?.nome || '',
        ordem: item.ordem,
        enunciado: item.enunciado,
        total_respostas: item.total_respostas,
        porcentagem_acerto: item.porcentagem_acerto,
        distrator_mais_escolhido: item.distrator_mais_escolhido,
      };
    });
  }
}
