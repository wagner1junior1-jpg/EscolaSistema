/**
 * SaberPontual — RelatorioService Supabase (Fase 5.5 do plano do back end)
 *
 * Relatórios da direção e da coordenação. Os dados vêm de duas RPCs (migration 0007), que
 * devolvem UM jsonb e por isso não sofrem o corte de 1000 linhas do PostgREST nem o limite de
 * tamanho de URL de `in (...)`:
 * - relatorio_visao_geral(): os números do painel, calculados no servidor.
 * - relatorio_dados_periodo(periodo): as tabelas do período, já filtradas pela escola.
 * O cálculo dos demais relatórios usa as mesmas funções puras do mock (../relatorios-escola.ts).
 *
 * Quem pode chamar (direção/coordenação) e o filtro por escola são garantidos pelas próprias RPCs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import { RelatorioService } from '../contracts';
import {
  VisaoGeralEscola,
  DesempenhoTurmaDisciplinaItem,
  DesempenhoTurmaHierarquico,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
} from '@/lib/types';
import {
  DadosRelatorioEscola,
  calcularDesempenhoTurmas,
  calcularDesempenhoHierarquico,
  calcularAlunosEmAtencao,
  calcularQuestoesCriticasEscola,
} from '../relatorios-escola';

export class SupabaseRelatorioService implements RelatorioService {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  private async chamar<T>(funcao: string, parametros: Record<string, unknown>, falha: string): Promise<T> {
    const { data, error } = await this.cliente.rpc(funcao, parametros);
    if (error) {
      // 42501 = a RPC negou (não é direção/coordenação).
      if (error.code === '42501') throw new Error('Você não tem permissão para esta ação.');
      throw new Error(falha);
    }
    if (data === null || data === undefined) throw new Error(falha);
    return data as T;
  }

  private async dadosDoPeriodo(periodoId: string): Promise<DadosRelatorioEscola> {
    const dados = await this.chamar<Partial<DadosRelatorioEscola>>(
      'relatorio_dados_periodo',
      { p_periodo_id: periodoId },
      'Não foi possível carregar os dados do relatório.'
    );
    return {
      turmas: dados.turmas ?? [],
      ofertas: dados.ofertas ?? [],
      disciplinas: dados.disciplinas ?? [],
      perfis: dados.perfis ?? [],
      alunos: dados.alunos ?? [],
      atividades: dados.atividades ?? [],
      questoes: dados.questoes ?? [],
      alternativas: dados.alternativas ?? [],
      respostas: dados.respostas ?? [],
      assuntos: dados.assuntos ?? [],
      banco_questoes: dados.banco_questoes ?? [],
    };
  }

  async visaoGeralEscola(): Promise<VisaoGeralEscola> {
    return this.chamar<VisaoGeralEscola>(
      'relatorio_visao_geral',
      {},
      'Não foi possível carregar a visão geral da escola.'
    );
  }

  async desempenhoTurmas(periodoId: string): Promise<DesempenhoTurmaDisciplinaItem[]> {
    return calcularDesempenhoTurmas(await this.dadosDoPeriodo(periodoId), periodoId);
  }

  async desempenhoHierarquicoTurmas(periodoId: string): Promise<DesempenhoTurmaHierarquico[]> {
    return calcularDesempenhoHierarquico(await this.dadosDoPeriodo(periodoId), periodoId);
  }

  async alunosEmAtencao(periodoId: string): Promise<AlunoEmAtencaoItem[]> {
    return calcularAlunosEmAtencao(await this.dadosDoPeriodo(periodoId), periodoId);
  }

  async questoesCriticasEscola(periodoId: string): Promise<QuestaoCriticaEscolaItem[]> {
    return calcularQuestoesCriticasEscola(await this.dadosDoPeriodo(periodoId), periodoId);
  }
}

export function criarSupabaseRelatorioService(cliente?: SupabaseClient): RelatorioService {
  return new SupabaseRelatorioService(cliente);
}
