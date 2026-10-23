/**
 * SaberPontual — RelatorioService Mock
 * 
 * Regras:
 * - Apenas 'direcao' e 'coordenacao' podem acessar relatórios pedagógicos e institucionais.
 * - Relatórios focados em desempenho pedagógico e acompanhamento escolar.
 * - Os cálculos dos relatórios por período vivem em ../relatorios-escola.ts (compartilhados com o Supabase).
 */

import { RelatorioService } from '../contracts';
import {
  VisaoGeralEscola,
  DesempenhoTurmaDisciplinaItem,
  DesempenhoTurmaHierarquico,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
} from '@/lib/types';
import { getDatabase } from './db';
import { exigirUsuario } from './autorizacao';
import { pontuacaoDaResposta } from '../calculos';
import {
  calcularDesempenhoTurmas,
  calcularDesempenhoHierarquico,
  calcularAlunosEmAtencao,
  calcularQuestoesCriticasEscola,
} from '../relatorios-escola';

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
    let somaPontos = 0;
    for (const r of db.respostas) {
      const q = db.questoes.find((questao) => questao.id === r.questao_id);
      const p = pontuacaoDaResposta(q, r);
      if (p !== null) {
        somaPontos += p;
      }
    }
    const aproveitamentoMedio =
      totalRespostas > 0
        ? Math.round((somaPontos / totalRespostas) * 1000) / 10
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
    return calcularDesempenhoTurmas(await getDatabase(), periodoId);
  }

  async desempenhoHierarquicoTurmas(periodoId: string): Promise<DesempenhoTurmaHierarquico[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    return calcularDesempenhoHierarquico(await getDatabase(), periodoId);
  }

  async alunosEmAtencao(periodoId: string): Promise<AlunoEmAtencaoItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    return calcularAlunosEmAtencao(await getDatabase(), periodoId);
  }

  async questoesCriticasEscola(periodoId: string): Promise<QuestaoCriticaEscolaItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    return calcularQuestoesCriticasEscola(await getDatabase(), periodoId);
  }
}
