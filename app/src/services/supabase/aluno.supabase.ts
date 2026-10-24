/**
 * SaberPontual — AlunoService Supabase (Fase 5.7 do plano do back end)
 *
 * Implementação real do Portal do Aluno no Supabase utilizando as RPCs SECURITY DEFINER
 * da migração 0005_portal_aluno.sql:
 * - O aluno é anônimo para o Supabase Auth (a RLS nega selects diretos nas tabelas).
 * - Toda operação passa exclusivamente por RPCs: aluno_listar_turma, aluno_login,
 *   aluno_atividades, aluno_carregar_atividade, aluno_responder, aluno_responder_discursiva,
 *   aluno_tentar_novamente, aluno_resultado_prova, aluno_meu_desempenho, aluno_avisos.
 * - Login: aluno_login retorna { ok: false, mensagem, ... } em falhas de PIN para não
 *   desfazer o contador de tentativas; o serviço traduz para Error(mensagem).
 * - Sessão e token: o token de sessão é trafegado apenas em memória e como parâmetro p_token.
 * - Gabarito protegido: carregarAtividade sanitiza alternativas descartando qualquer campo
 *   `correta` ou `por_que_errou`, e em questões não respondidas de atividades em aberto
 *   nunca expõe gabarito ou explicação.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import { AlunoService } from '../contracts';
import {
  AlunoResumido,
  AtividadeResumoAluno,
  AtividadeParaAluno,
  QuestaoParaAluno,
  RespostaAlunoResultado,
  RespostaExercicio,
  ResultadoProva,
  MeuDesempenhoAluno,
  Aviso,
} from '@/lib/types';

export class SupabaseAlunoService implements AlunoService {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  private async chamarRpc<T>(nome: string, params: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.cliente.rpc(nome, params);
    if (error) {
      throw new Error(error.message);
    }
    if (data === null || data === undefined) {
      throw new Error('Erro inesperado na chamada ao servidor.');
    }
    return data as T;
  }

  async listarTurma(codigo: string): Promise<AlunoResumido[]> {
    return this.chamarRpc<AlunoResumido[]>('aluno_listar_turma', {
      p_codigo: codigo,
    });
  }

  async login(alunoId: string, pin: string): Promise<{ token: string; aluno: AlunoResumido }> {
    const { data, error } = await this.cliente.rpc('aluno_login', {
      p_aluno_id: alunoId,
      p_pin: pin,
    });
    if (error) {
      throw new Error(error.message);
    }
    const resposta = data as {
      ok: boolean;
      mensagem?: string;
      token?: string;
      aluno?: AlunoResumido;
    } | null;

    if (!resposta) {
      throw new Error('Erro inesperado no login do aluno.');
    }

    if (!resposta.ok) {
      throw new Error(resposta.mensagem || 'Falha na autenticação do aluno.');
    }

    if (!resposta.token || !resposta.aluno) {
      throw new Error('Dados de autenticação incompletos.');
    }

    return {
      token: resposta.token,
      aluno: resposta.aluno,
    };
  }

  async atividadesPendentes(token: string): Promise<AtividadeResumoAluno[]> {
    return this.chamarRpc<AtividadeResumoAluno[]>('aluno_atividades', {
      p_token: token,
    });
  }

  async carregarAtividade(token: string, atividadeId: string): Promise<AtividadeParaAluno> {
    const dados = await this.chamarRpc<AtividadeParaAluno>('aluno_carregar_atividade', {
      p_token: token,
      p_atividade_id: atividadeId,
    });

    const todasQuestoes = dados.questoes || [];
    const provaIncompleta =
      dados.modo === 'prova' &&
      dados.status === 'publicada' &&
      todasQuestoes.some((q) => !q.respondida);

    const questoesSanitizadas: QuestaoParaAluno[] = todasQuestoes.map((q) => {
      // Regra 4: Sanitização estrita de gabarito no cliente:
      // 1. As alternativas para o aluno nunca devem conter 'correta' nem 'por_que_errou'
      const alternativasLimpas = (q.alternativas || []).map((alt) => ({
        id: alt.id,
        letra: alt.letra,
        texto: alt.texto,
      }));

      const questaoLimpa: QuestaoParaAluno = {
        ...q,
        alternativas: alternativasLimpas,
      };

      // 2. Questão ainda não respondida em atividade não-encerrada:
      // descarta campos de gabarito caso tenham sido enviados por engano pelo backend/mock
      if (dados.status !== 'encerrada' && !q.respondida) {
        delete questaoLimpa.alternativa_correta_id;
        delete questaoLimpa.por_que_errou;
        delete questaoLimpa.explicacao;
      }

      // 3. Prova publicada e incompleta: nenhum feedback, nem nas já respondidas (igual ao servidor).
      if (provaIncompleta) {
        delete questaoLimpa.alternativa_correta_id;
        delete questaoLimpa.por_que_errou;
        delete questaoLimpa.explicacao;
        delete questaoLimpa.acertou;
        delete questaoLimpa.acertou_final;
      }

      return questaoLimpa;
    });

    return {
      ...dados,
      questoes: questoesSanitizadas,
    };
  }

  async responder(
    token: string,
    questaoId: string,
    alternativaId: string
  ): Promise<RespostaAlunoResultado> {
    return this.chamarRpc<RespostaAlunoResultado>('aluno_responder', {
      p_token: token,
      p_questao_id: questaoId,
      p_alternativa_id: alternativaId,
    });
  }

  async responderDiscursiva(
    token: string,
    questaoId: string,
    texto: string
  ): Promise<{ registrada: true; explicacao?: string | null }> {
    return this.chamarRpc<{ registrada: true; explicacao?: string | null }>(
      'aluno_responder_discursiva',
      {
        p_token: token,
        p_questao_id: questaoId,
        p_texto: texto,
      }
    );
  }

  async tentarNovamente(
    token: string,
    questaoId: string,
    alternativaId: string
  ): Promise<RespostaExercicio> {
    return this.chamarRpc<RespostaExercicio>('aluno_tentar_novamente', {
      p_token: token,
      p_questao_id: questaoId,
      p_alternativa_id: alternativaId,
    });
  }

  async resultadoProva(token: string, atividadeId: string): Promise<ResultadoProva> {
    return this.chamarRpc<ResultadoProva>('aluno_resultado_prova', {
      p_token: token,
      p_atividade_id: atividadeId,
    });
  }

  async meuDesempenho(token: string): Promise<MeuDesempenhoAluno> {
    return this.chamarRpc<MeuDesempenhoAluno>('aluno_meu_desempenho', {
      p_token: token,
    });
  }

  async avisos(token: string): Promise<Aviso[]> {
    return this.chamarRpc<Aviso[]>('aluno_avisos', {
      p_token: token,
    });
  }
}

export function criarSupabaseAlunoService(cliente?: SupabaseClient): AlunoService {
  return new SupabaseAlunoService(cliente);
}

