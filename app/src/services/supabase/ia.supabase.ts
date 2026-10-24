/**
 * SaberPontual — ServicoIA do Supabase (Fase 6.1 e 6.2)
 *
 * A geração roda na Edge Function `gerar-questoes`: a chave do Gemini fica em segredo no servidor
 * e a cota mensal da escola também é conferida lá. Aqui só trafega o JWT do usuário logado.
 * O servidor devolve as questões já validadas (objetiva com 4 alternativas e 1 correta); o app
 * aplica os ajustes de revisão (embaralhar, avisos) com o mesmo código do mock (iaValidacao.ts).
 *
 * Sem modo demonstração aqui: se a IA falhar, o professor vê o erro. Questão de exemplo no lugar
 * de uma geração real enganaria quem está montando prova de verdade.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import { GerarQuestoesIAParams, QuestaoSugeridaIA, RespostaGeracaoIA } from '@/lib/types';
import { ServicoIA } from '../contracts';
import { identificarArea, normalizarSerieBase } from '../ia-prompt';
import { ajustarQuestoesIA } from '../mock/iaValidacao';
import { extrairMensagem } from './adminUsuarios';

// O painel do Supabase pode publicar a função com um apelido diferente do nome (ver admin-usuarios).
const FUNCAO_GERAR_QUESTOES = import.meta.env.VITE_FN_GERAR_QUESTOES?.trim() || 'gerar-questoes';

export interface QuestaoDaFuncao {
  tipo: 'objetiva' | 'discursiva';
  dificuldade: QuestaoSugeridaIA['dificuldade'];
  enunciado: string;
  dica: string;
  explicacao: string;
  resposta_esperada: string | null;
  alternativas: Array<{
    letra: 'A' | 'B' | 'C' | 'D';
    texto: string;
    correta: boolean;
    por_que_errou: string | null;
  }> | null;
}

export interface RespostaFuncaoGerar {
  questoes: QuestaoDaFuncao[];
  aviso: string | null;
  descartadas: number;
  interrompida: boolean;
  contexto: { disciplina_nome: string; assunto_nome: string };
}

const TEXTO_TRANSCRICAO = 'Texto extraído das imagens enviadas:\n';

function plural(qtd: number, singular: string, pluralTexto: string): string {
  return `${qtd} ${qtd === 1 ? singular : pluralTexto}`;
}

/** Junta o aviso do Gemini com o que o app percebeu (faltaram questões, vieram fora do formato). */
function montarAvisoDoLote(r: RespostaFuncaoGerar, pedidas: number): string | null {
  const avisos: string[] = [];
  if (r.aviso) avisos.push(r.aviso);
  if (r.questoes.length < pedidas) {
    avisos.push(
      r.interrompida
        ? `A geração foi interrompida: vieram ${r.questoes.length} de ${pedidas} questões. Gere de novo para completar.`
        : `A IA criou ${r.questoes.length} de ${pedidas} questões pedidas.`
    );
  }
  if (r.descartadas > 0) {
    avisos.push(
      `${plural(r.descartadas, 'questão veio', 'questões vieram')} fora do formato e ${
        r.descartadas === 1 ? 'foi descartada' : 'foram descartadas'
      }.`
    );
  }
  return avisos.length > 0 ? avisos.join(' ') : null;
}

/**
 * Transforma a resposta da função nas questões da tela de revisão (embaralha as alternativas,
 * limpa o enunciado e anexa os avisos para o professor). Pura: `rand` entra só para os testes.
 */
export function converterRespostaGerar(
  r: RespostaFuncaoGerar,
  serie: string,
  pedidas: number,
  rand: () => number = Math.random
): RespostaGeracaoIA {
  const serieBase = normalizarSerieBase(serie);
  const area = identificarArea(r.contexto.disciplina_nome);
  const agora = Date.now();
  const sugeridas: QuestaoSugeridaIA[] = r.questoes.map((q, idx) => ({
    id_temp: `ia-${agora}-${idx}-${crypto.randomUUID()}`,
    tipo: q.tipo,
    dificuldade: q.dificuldade,
    enunciado: q.enunciado,
    dica: q.dica,
    explicacao: q.explicacao,
    resposta_esperada: q.tipo === 'discursiva' ? q.resposta_esperada : null,
    imagem_url: null,
    alternativas: q.tipo === 'objetiva' ? (q.alternativas ?? undefined) : undefined,
  }));
  return {
    questoes: ajustarQuestoesIA(sugeridas, area, r.contexto.disciplina_nome, serieBase, rand),
    aviso: montarAvisoDoLote(r, pedidas),
  };
}

export class SupabaseIAService implements ServicoIA {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  private async chamar<T>(corpo: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.cliente.functions.invoke(FUNCAO_GERAR_QUESTOES, { body: corpo });
    if (error) throw new Error(await extrairMensagem(error));
    return data as T;
  }

  async gerarQuestoes(params: GerarQuestoesIAParams): Promise<RespostaGeracaoIA> {
    const pedidas = params.qtd_objetivas + params.qtd_discursivas;
    const r = await this.chamar<RespostaFuncaoGerar>({
      acao: 'gerar',
      disciplina_id: params.disciplina_id,
      assunto_id: params.assunto_id,
      serie: params.serie,
      qtd_objetivas: params.qtd_objetivas,
      qtd_discursivas: params.qtd_discursivas,
      dificuldade: params.dificuldade,
      texto_base: params.texto_base,
      fotos: params.fotos,
    });
    return converterRespostaGerar(r, params.serie, pedidas);
  }

  async transcreverImagem(fotos: string[]): Promise<string> {
    if (!fotos || fotos.length === 0) return '';
    const r = await this.chamar<{ texto: string }>({ acao: 'transcrever', fotos });
    return `${TEXTO_TRANSCRICAO}${r.texto}`;
  }

  async consultarCota(): Promise<{ uso_mes: number; limite_mes: number }> {
    const r = await this.chamar<{ uso_mes: number; limite_mes: number }>({ acao: 'cota' });
    return { uso_mes: r.uso_mes, limite_mes: r.limite_mes };
  }
}

export const criarSupabaseIAService = (cliente?: SupabaseClient): ServicoIA =>
  new SupabaseIAService(cliente);
