/**
 * SaberPontual — ProfessorService Supabase (Fases 5.3 e 5.5 do plano do back end)
 *
 * Implementação real dos fluxos pedagógicos docentes no Supabase:
 * - Minhas ofertas de disciplinas
 * - Atividades (criação, edição, exclusão lógica, publicação, encerramento, duplicação)
 * - Questões e alternativas (salvar com upsert seguro, reordenar, exclusão lógica)
 * - Recados da turma (avisos com turma_id)
 * - Observações de alunos (gravação com nome do professor, exclusão lógica)
 * - Correção de discursivas e mapa de calor (Fase 5.4)
 * - Relatórios pedagógicos do professor (desempenho da oferta, ficha do aluno, alunos por série, desempenho por matérias - Fase 5.5)
 *
 * Regras:
 * - escola_id, criado_por e autor vêm sempre da sessão/RLS, nunca de parâmetros da tela.
 * - Toda chamada verifica { error } do Supabase e converte em Error com mensagem em PT-BR.
 * - Exclusão lógica com deleted_at; consultas ativas sempre filtram deleted_at IS NULL.
 * - Alternativas não têm deleted_at: apagam-se junto da questão ou por questao_id.
 * - Evita consultas N+1: busca registros em lote e agrupa em memória.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import { CacheCurto } from './cacheCurto';
import { lerTudoPorIds } from './paginacao';
import {
  calcularDesempenhoOferta,
  calcularPainelProfessor,
  type DadosPainelProfessor,
} from '../painel-professor';

// Linha crua devolvida pelo PostgREST nas leituras paginadas (quem usa trata os campos).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LinhaBanco = Record<string, any>;
import {
  ProfessorService,
  NovaQuestaoPayload,
  ItemCorrecaoFeita,
  ItemCorrecaoPendente,
} from '../contracts';
import {
  Atividade,
  AtividadeCompleta,
  AtividadeComContagem,
  OfertaDetalhada,
  ModoAtividade,
  Aviso,
  PrioridadeAviso,
  AlunoObservacao,
  Alternativa,
  Questao,
  Resposta,
  MapaDeCalorAtividade,
  RelatorioDesempenhoOferta,
  PainelProfessor,
  FichaAluno,
  FichaAlunoAtividadeItem,
  FichaAlunoQuestaoItem,
  AlunoComDesempenhoResumo,
  DesempenhoAlunoMateriaItem,
  AlunoPublico,
  TipoQuestao,
} from '@/lib/types';
import {
  calcularAproveitamentoAtividade,
  calcularMediaPeriodo,
  calcularMapaDeCalorQuestao,
  faixaDesempenho,
  mediaDoAlunoNasAtividades,
  pontuacaoDaResposta,
} from '../calculos';

interface LinhaOfertaBanco {
  id: string;
  created_at: string;
  turma_id: string;
  disciplina_id: string;
  professor_id: string;
  turmas:
    | {
        nome: string;
        codigo_acesso: string;
        serie?: string;
      }
    | {
        nome: string;
        codigo_acesso: string;
        serie?: string;
      }[]
    | null;
  disciplinas:
    | {
        nome: string;
      }
    | {
        nome: string;
      }[]
    | null;
  perfis:
    | {
        nome: string;
      }
    | {
        nome: string;
      }[]
    | null;
}

interface LinhaAvisoBanco {
  id: string;
  escola_id: string;
  autor_id: string;
  turma_id: string | null;
  titulo: string;
  mensagem: string;
  prioridade: PrioridadeAviso;
  publicado_em: string;
}

interface ContextoSessao {
  id: string;
  escola_id: string;
  papel: string;
  nome: string;
}

const LETRAS_VALIDAS: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];

interface OfertaBasica {
  id: string;
  professor_id: string;
  turma_id: string;
}

export class SupabaseProfessorService implements ProfessorService {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  // Leituras repetidas pelo painel (ver cacheCurto.ts). A RLS do banco continua valendo.
  private readonly cacheContexto = new CacheCurto<ContextoSessao>(30_000);
  private readonly cacheOfertas = new CacheCurto<OfertaBasica>(15_000);

  /**
   * Obtém os dados de sessão do usuário logado e valida se seu perfil está ativo.
   */
  private async obterContextoSessao(): Promise<ContextoSessao> {
    const { data: sessao, error: erroSessao } = await this.cliente.auth.getSession();
    if (erroSessao || !sessao?.session?.user) {
      throw new Error('Sessão expirada. Entre novamente.');
    }
    const userId = sessao.session.user.id;
    // A chave é o id do usuário: quem entra depois com outra conta não reaproveita o contexto.
    return this.cacheContexto.obter(userId, async () => {
      const { data: perfil, error: erroPerfil } = await this.cliente
        .from('perfis')
        .select('id, escola_id, papel, nome, ativo')
        .eq('id', userId)
        .maybeSingle();

      if (erroPerfil) {
        throw new Error('Não foi possível verificar os dados do seu usuário.');
      }
      if (!perfil || !perfil.ativo) {
        throw new Error('Usuário não encontrado ou inativo.');
      }
      return perfil as ContextoSessao;
    });
  }

  /** Lê a oferta (id, professor, turma). Oferta inexistente é erro e não fica no cache. */
  private obterOfertaBasica(ofertaId: string): Promise<OfertaBasica> {
    return this.cacheOfertas.obter(ofertaId, async () => {
      const { data: oferta, error } = await this.cliente
        .from('ofertas')
        .select('id, professor_id, turma_id')
        .eq('id', ofertaId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw new Error('Não foi possível verificar a oferta.');
      }
      if (!oferta) {
        throw new Error('Oferta não encontrada.');
      }
      return oferta as OfertaBasica;
    });
  }

  /**
   * Valida acesso de leitura sobre uma oferta (professor dono, direção ou coordenação).
   */
  private async validarAcessoLeituraOferta(ofertaId: string): Promise<ContextoSessao> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const oferta = await this.obterOfertaBasica(ofertaId);

    if (sessao.papel === 'professor' && oferta.professor_id !== sessao.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    return sessao;
  }

  /**
   * Valida acesso de escrita sobre uma oferta (exclusivo do professor dono da oferta).
   */
  private async validarAcessoEscritaOferta(
    ofertaId: string
  ): Promise<{ sessao: ContextoSessao; oferta: { id: string; professor_id: string; turma_id: string } }> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const oferta = await this.obterOfertaBasica(ofertaId);

    if (oferta.professor_id !== sessao.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    return { sessao, oferta };
  }

  /**
   * Obtém os dados de uma atividade e de sua oferta associada.
   */
  private async obterOfertaDaAtividade(atividadeId: string): Promise<{
    atividade: Atividade;
    oferta: { id: string; professor_id: string; turma_id: string };
  }> {
    const { data: atividade, error: erroAtiv } = await this.cliente
      .from('atividades')
      .select('id, created_at, oferta_id, periodo_id, titulo, descricao, prazo, modo, status, criado_por')
      .eq('id', atividadeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAtiv) {
      throw new Error('Não foi possível obter a atividade.');
    }
    if (!atividade) {
      throw new Error('Atividade não encontrada.');
    }

    let oferta: OfertaBasica;
    try {
      oferta = await this.obterOfertaBasica(atividade.oferta_id);
    } catch {
      throw new Error('Não foi possível verificar a oferta da atividade.');
    }

    return { atividade: atividade as Atividade, oferta };
  }

  // ---------------------------------------------------------------------------
  // 1. Minhas Ofertas
  // ---------------------------------------------------------------------------

  async minhasOfertas(): Promise<OfertaDetalhada[]> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    let query = this.cliente
      .from('ofertas')
      .select(`
        id,
        created_at,
        turma_id,
        disciplina_id,
        professor_id,
        turmas!turma_id (
          nome,
          codigo_acesso,
          serie
        ),
        disciplinas!disciplina_id (
          nome
        ),
        perfis!professor_id (
          nome
        )
      `)
      .is('deleted_at', null);

    if (sessao.papel === 'professor') {
      query = query.eq('professor_id', sessao.id);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error('Não foi possível listar as ofertas de disciplinas.');
    }

    return ((data || []) as LinhaOfertaBanco[]).map((linha): OfertaDetalhada => {
      const turma = Array.isArray(linha.turmas) ? linha.turmas[0] : linha.turmas;
      const disciplina = Array.isArray(linha.disciplinas) ? linha.disciplinas[0] : linha.disciplinas;
      const professor = Array.isArray(linha.perfis) ? linha.perfis[0] : linha.perfis;

      return {
        id: linha.id,
        created_at: linha.created_at,
        turma_id: linha.turma_id,
        disciplina_id: linha.disciplina_id,
        professor_id: linha.professor_id,
        turma_nome: turma?.nome || 'Turma desconhecida',
        turma_codigo: turma?.codigo_acesso || '',
        disciplina_nome: disciplina?.nome || 'Disciplina desconhecida',
        professor_nome: professor?.nome || 'Professor não atribuído',
        turma_serie: turma?.serie,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Atividades
  // ---------------------------------------------------------------------------

  async listarAtividades(ofertaId: string): Promise<Atividade[]> {
    await this.validarAcessoLeituraOferta(ofertaId);

    const { data, error } = await this.cliente
      .from('atividades')
      .select('id, created_at, oferta_id, periodo_id, titulo, descricao, prazo, modo, status, criado_por')
      .eq('oferta_id', ofertaId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Não foi possível listar as atividades.');
    }

    return (data || []) as Atividade[];
  }

  /**
   * Página da turma: 3 leituras no total (atividades, questões, respostas pendentes) em vez de
   * carregar cada atividade completa. Mesmas regras de obterAtividade (questão não excluída) e de
   * listarCorrecoesPendentes (discursiva com correcao = 'pendente', só para o professor dono).
   */
  async listarAtividadesComContagem(ofertaId: string): Promise<AtividadeComContagem[]> {
    const atividades = await this.listarAtividades(ofertaId);
    if (atividades.length === 0) {
      return [];
    }

    const questoes = await lerTudoPorIds<LinhaBanco>(
      atividades.map((a) => a.id),
      (bloco) =>
        this.cliente
          .from('questoes')
          .select('id, atividade_id, tipo')
          .in('atividade_id', bloco)
          .is('deleted_at', null),
      'Não foi possível contar as questões das atividades.'
    );

    const sessao = await this.obterContextoSessao();
    const oferta = await this.obterOfertaBasica(ofertaId);
    const podeCorrigir = sessao.papel === 'professor' && oferta.professor_id === sessao.id;

    const atividadePorQuestao = new Map<string, string>();
    if (podeCorrigir) {
      const naoRascunho = new Set(atividades.filter((a) => a.status !== 'rascunho').map((a) => a.id));
      for (const q of questoes) {
        if (q.tipo === 'discursiva' && naoRascunho.has(q.atividade_id)) {
          atividadePorQuestao.set(q.id, q.atividade_id);
        }
      }
    }

    const pendentes = await lerTudoPorIds<LinhaBanco>(
      [...atividadePorQuestao.keys()],
      (bloco) =>
        this.cliente
          .from('respostas')
          .select('id, questao_id')
          .in('questao_id', bloco)
          .eq('correcao', 'pendente'),
      'Não foi possível contar as correções pendentes.'
    );

    const totalQuestoes = new Map<string, number>();
    for (const q of questoes) {
      totalQuestoes.set(q.atividade_id, (totalQuestoes.get(q.atividade_id) ?? 0) + 1);
    }
    const totalPendentes = new Map<string, number>();
    for (const r of pendentes) {
      const atividadeId = atividadePorQuestao.get(r.questao_id);
      if (atividadeId) {
        totalPendentes.set(atividadeId, (totalPendentes.get(atividadeId) ?? 0) + 1);
      }
    }

    return atividades.map((ativ) => ({
      ...ativ,
      total_questoes: totalQuestoes.get(ativ.id) ?? 0,
      pendentes_correcao: totalPendentes.get(ativ.id) ?? 0,
    }));
  }

  async obterAtividade(atividadeId: string): Promise<AtividadeCompleta | null> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoLeituraOferta(oferta.id);

    const { data: questoesData, error: erroQuestoes } = await this.cliente
      .from('questoes')
      .select('id, created_at, atividade_id, ordem, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, banco_questao_id, assunto_id')
      .eq('atividade_id', atividadeId)
      .is('deleted_at', null)
      .order('ordem', { ascending: true });

    if (erroQuestoes) {
      throw new Error('Não foi possível carregar as questões da atividade.');
    }

    const questoes = questoesData || [];
    const questaoIds = questoes.map((q) => q.id);

    let alternativas: Array<Alternativa> = [];
    if (questaoIds.length > 0) {
      const { data: altsData, error: erroAlts } = await this.cliente
        .from('alternativas')
        .select('id, updated_at, questao_id, letra, texto, correta, por_que_errou')
        .in('questao_id', questaoIds)
        .order('letra', { ascending: true });

      if (erroAlts) {
        throw new Error('Não foi possível carregar as alternativas das questões.');
      }

      alternativas = (altsData || []).map((alt) => ({
        id: alt.id,
        created_at: alt.updated_at,
        questao_id: alt.questao_id,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        por_que_errou: alt.por_que_errou,
      }));
    }

    const questoesCompletas = questoes.map((q) => {
      const altsDaQuestao = alternativas
        .filter((alt) => alt.questao_id === q.id)
        .sort((a, b) => a.letra.localeCompare(b.letra));

      return {
        ...q,
        alternativas: altsDaQuestao,
      };
    });

    return {
      ...atividade,
      questoes: questoesCompletas,
    };
  }

  async criarAtividade(
    ofertaId: string,
    dados: { titulo: string; descricao: string; prazo: string | null; periodo_id: string; modo?: ModoAtividade }
  ): Promise<Atividade> {
    const { sessao } = await this.validarAcessoEscritaOferta(ofertaId);

    const { data, error } = await this.cliente
      .from('atividades')
      .insert({
        oferta_id: ofertaId,
        periodo_id: dados.periodo_id,
        titulo: dados.titulo.trim(),
        descricao: (dados.descricao || '').trim(),
        prazo: dados.prazo || null,
        modo: dados.modo ?? 'exercicio',
        status: 'rascunho',
        criado_por: sessao.id,
      })
      .select('id, created_at, oferta_id, periodo_id, titulo, descricao, prazo, modo, status, criado_por')
      .single();

    if (error) {
      throw new Error('Não foi possível criar a atividade.');
    }

    return data as Atividade;
  }

  async atualizarAtividade(
    id: string,
    dados: { titulo?: string; descricao?: string; prazo?: string | null; periodo_id?: string; modo?: ModoAtividade }
  ): Promise<Atividade> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (dados.modo !== undefined && atividade.status !== 'rascunho') {
      throw new Error('O modo da atividade só pode ser alterado enquanto estiver em rascunho.');
    }

    const payload: Record<string, unknown> = {};
    if (dados.titulo !== undefined) payload.titulo = dados.titulo.trim();
    if (dados.descricao !== undefined) payload.descricao = dados.descricao.trim();
    if (dados.prazo !== undefined) payload.prazo = dados.prazo;
    if (dados.periodo_id !== undefined) payload.periodo_id = dados.periodo_id;
    if (dados.modo !== undefined) payload.modo = dados.modo;

    const { data, error } = await this.cliente
      .from('atividades')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, created_at, oferta_id, periodo_id, titulo, descricao, prazo, modo, status, criado_por')
      .single();

    if (error) {
      throw new Error('Não foi possível atualizar a atividade.');
    }

    return data as Atividade;
  }

  async excluirAtividade(id: string): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'rascunho') {
      throw new Error('Apenas atividades em rascunho e sem respostas podem ser excluídas.');
    }

    const { data: questoes, error: erroQ } = await this.cliente
      .from('questoes')
      .select('id')
      .eq('atividade_id', id)
      .is('deleted_at', null);

    if (erroQ) {
      throw new Error('Não foi possível verificar as questões da atividade.');
    }

    const questaoIds = (questoes || []).map((q) => q.id);
    if (questaoIds.length > 0) {
      const { count, error: erroResp } = await this.cliente
        .from('respostas')
        .select('id', { count: 'exact', head: true })
        .in('questao_id', questaoIds);

      if (erroResp) {
        throw new Error('Não foi possível verificar respostas da atividade.');
      }

      if (count && count > 0) {
        throw new Error('Apenas atividades em rascunho e sem respostas podem ser excluídas.');
      }
    }

    const agora = new Date().toISOString();

    const { error: erroExcluirAtiv } = await this.cliente
      .from('atividades')
      .update({ deleted_at: agora })
      .eq('id', id)
      .is('deleted_at', null);

    if (erroExcluirAtiv) {
      throw new Error('Não foi possível excluir a atividade.');
    }

    if (questaoIds.length > 0) {
      const { error: erroExcluirQuestoes } = await this.cliente
        .from('questoes')
        .update({ deleted_at: agora })
        .eq('atividade_id', id)
        .is('deleted_at', null);

      if (erroExcluirQuestoes) {
        throw new Error('A atividade foi excluída, mas não foi possível excluir suas questões.');
      }
    }
  }

  async publicarAtividade(id: string): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'rascunho') {
      throw new Error('Apenas atividades em rascunho podem ser publicadas.');
    }

    const { data: questoes, error: erroQ } = await this.cliente
      .from('questoes')
      .select('id, ordem, tipo, resposta_esperada')
      .eq('atividade_id', id)
      .is('deleted_at', null)
      .order('ordem', { ascending: true });

    if (erroQ) {
      throw new Error('Não foi possível carregar as questões da atividade.');
    }

    if (!questoes || questoes.length === 0) {
      throw new Error('A atividade precisa ter pelo menos 1 questão para ser publicada.');
    }

    for (const q of questoes) {
      if (q.tipo === 'discursiva') {
        if (!q.resposta_esperada || !q.resposta_esperada.trim()) {
          throw new Error(`A questão ${q.ordem} (discursiva) deve conter uma resposta esperada.`);
        }
        continue;
      }

      const { data: alts, error: erroAlts } = await this.cliente
        .from('alternativas')
        .select('id, correta')
        .eq('questao_id', q.id);

      if (erroAlts) {
        throw new Error(`Não foi possível verificar as alternativas da questão ${q.ordem}.`);
      }

      const listaAlts = alts || [];
      if (listaAlts.length < 2 || listaAlts.length > 5) {
        throw new Error(`A questão ${q.ordem} possui número inválido de alternativas (deve ter entre 2 e 5).`);
      }

      const corretas = listaAlts.filter((a) => a.correta).length;
      if (corretas !== 1) {
        throw new Error(`A questão ${q.ordem} deve conter exatamente 1 alternativa correta.`);
      }
    }

    const { error } = await this.cliente
      .from('atividades')
      .update({ status: 'publicada' })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível publicar a atividade.');
    }
  }

  async encerrarAtividade(id: string): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'publicada') {
      throw new Error('Apenas atividades publicadas podem ser encerradas.');
    }

    const { error } = await this.cliente
      .from('atividades')
      .update({ status: 'encerrada' })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível encerrar a atividade.');
    }
  }

  async duplicarAtividade(atividadeId: string, paraOfertaId: string): Promise<Atividade> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { atividade: original, oferta: ofertaOrigem } = await this.obterOfertaDaAtividade(atividadeId);

    if (ofertaOrigem.professor_id !== sessao.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: ofertaDestino, error: erroDestino } = await this.cliente
      .from('ofertas')
      .select('id, professor_id')
      .eq('id', paraOfertaId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroDestino) {
      throw new Error('Não foi possível verificar a oferta de destino.');
    }
    if (!ofertaDestino || ofertaDestino.professor_id !== sessao.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: novaAtividade, error: erroCriar } = await this.cliente
      .from('atividades')
      .insert({
        oferta_id: paraOfertaId,
        periodo_id: original.periodo_id,
        titulo: `${original.titulo} (Cópia)`,
        descricao: original.descricao,
        prazo: original.prazo,
        modo: original.modo,
        status: 'rascunho',
        criado_por: sessao.id,
      })
      .select('id, created_at, oferta_id, periodo_id, titulo, descricao, prazo, modo, status, criado_por')
      .single();

    if (erroCriar || !novaAtividade) {
      throw new Error('Não foi possível duplicar a atividade.');
    }

    const { data: questoesOriginais, error: erroQ } = await this.cliente
      .from('questoes')
      .select('*')
      .eq('atividade_id', atividadeId)
      .is('deleted_at', null)
      .order('ordem', { ascending: true });

    if (erroQ) {
      throw new Error('Não foi possível carregar as questões originais para duplicação.');
    }

    for (const q of questoesOriginais || []) {
      const { data: novaQuestao, error: erroNQ } = await this.cliente
        .from('questoes')
        .insert({
          atividade_id: novaAtividade.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          dica: q.dica,
          explicacao: q.explicacao,
          banco_questao_id: q.banco_questao_id || null,
          assunto_id: q.assunto_id || null,
          tipo: q.tipo || 'objetiva',
          dificuldade: q.dificuldade || 'medio',
          resposta_esperada: q.resposta_esperada || null,
          imagem_url: q.imagem_url || null,
        })
        .select('id')
        .single();

      if (erroNQ || !novaQuestao) {
        throw new Error('Não foi possível duplicar questão da atividade.');
      }

      if (q.tipo !== 'discursiva') {
        const { data: altsOriginais, error: erroAlts } = await this.cliente
          .from('alternativas')
          .select('*')
          .eq('questao_id', q.id)
          .order('letra', { ascending: true });

        if (erroAlts) {
          throw new Error('Não foi possível carregar as alternativas originais.');
        }

        if (altsOriginais && altsOriginais.length > 0) {
          const altsParaInserir = altsOriginais.map((alt) => ({
            questao_id: novaQuestao.id,
            letra: alt.letra,
            texto: alt.texto,
            correta: alt.correta,
            por_que_errou: alt.por_que_errou,
          }));

          const { error: erroInsertAlts } = await this.cliente
            .from('alternativas')
            .insert(altsParaInserir);

          if (erroInsertAlts) {
            throw new Error('Não foi possível duplicar as alternativas da questão.');
          }
        }
      }
    }

    return novaAtividade as Atividade;
  }

  // ---------------------------------------------------------------------------
  // 3. Questões e Alternativas
  // ---------------------------------------------------------------------------

  async salvarQuestoes(atividadeId: string, questoes: NovaQuestaoPayload[]): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoEscritaOferta(oferta.id);

    // 1. Validações de texto e integridade
    for (let i = 0; i < questoes.length; i++) {
      const qPayload = questoes[i];
      const ordemCalculada = qPayload.ordem ?? i + 1;

      if (!qPayload.enunciado || !qPayload.enunciado.trim()) {
        throw new Error(`O enunciado da questão ${ordemCalculada} não pode ficar vazio.`);
      }

      if (qPayload.tipo === 'discursiva') {
        if (!qPayload.resposta_esperada || !qPayload.resposta_esperada.trim()) {
          throw new Error(`A questão ${ordemCalculada} (discursiva) deve conter uma resposta esperada.`);
        }
      } else {
        if (!qPayload.alternativas || qPayload.alternativas.length < 2 || qPayload.alternativas.length > 5) {
          throw new Error(
            `A questão ${ordemCalculada} deve conter entre 2 e 5 alternativas (possui ${qPayload.alternativas?.length || 0}).`
          );
        }

        const totalCorretas = qPayload.alternativas.filter((a) => a.correta).length;
        if (totalCorretas !== 1) {
          throw new Error(`A questão ${ordemCalculada} deve ter exatamente 1 alternativa correta marcada.`);
        }

        for (let altIdx = 0; altIdx < qPayload.alternativas.length; altIdx++) {
          const alt = qPayload.alternativas[altIdx];
          if (!alt.texto || !alt.texto.trim()) {
            throw new Error(
              `O texto da alternativa ${LETRAS_VALIDAS[altIdx] || altIdx + 1} da questão ${ordemCalculada} não pode ficar vazio.`
            );
          }
        }
      }
    }

    // 2. Buscar questões atuais da atividade
    const { data: questoesAtuaisData, error: erroQAtuais } = await this.cliente
      .from('questoes')
      .select('id, ordem, tipo, resposta_esperada')
      .eq('atividade_id', atividadeId)
      .is('deleted_at', null)
      .order('ordem', { ascending: true });

    if (erroQAtuais) {
      throw new Error('Não foi possível verificar as questões atuais da atividade.');
    }

    const questoesAtuais = questoesAtuaisData || [];

    // Validar se ids informados pertencem a esta atividade
    for (const qPayload of questoes) {
      if (qPayload.id) {
        const existe = questoesAtuais.some((q) => q.id === qPayload.id);
        if (!existe) {
          throw new Error('Questão ou alternativa inválida para esta atividade.');
        }
      }
    }

    // 3. Regra de edição por status da atividade
    if (atividade.status !== 'rascunho') {
      if (questoes.length !== questoesAtuais.length) {
        throw new Error('Atividade publicada: só é possível corrigir textos.');
      }

      for (let i = 0; i < questoes.length; i++) {
        const qPayload = questoes[i];
        if (!qPayload.id) {
          throw new Error('Atividade publicada: só é possível corrigir textos.');
        }

        const qAtual = questoesAtuais.find((q) => q.id === qPayload.id);
        if (!qAtual) {
          throw new Error('Atividade publicada: só é possível corrigir textos.');
        }

        if (qAtual.tipo === 'discursiva') {
          continue;
        }

        const { data: altsAtuais, error: erroAlts } = await this.cliente
          .from('alternativas')
          .select('id, letra, correta')
          .eq('questao_id', qAtual.id)
          .order('letra', { ascending: true });

        if (erroAlts) {
          throw new Error('Não foi possível verificar as alternativas da atividade.');
        }

        const listaAlts = altsAtuais || [];
        if ((qPayload.alternativas || []).length !== listaAlts.length) {
          throw new Error('Atividade publicada: só é possível corrigir textos.');
        }

        for (let altIdx = 0; altIdx < listaAlts.length; altIdx++) {
          const payloadAlt = qPayload.alternativas[altIdx];
          const existAlt = listaAlts[altIdx];
          if (payloadAlt.correta !== existAlt.correta) {
            throw new Error('Atividade publicada: só é possível corrigir textos.');
          }
        }
      }

      // Aplica atualização estritamente textual
      for (const qPayload of questoes) {
        const qAtual = questoesAtuais.find((q) => q.id === qPayload.id)!;
        const updatePayload: Record<string, unknown> = {
          enunciado: qPayload.enunciado.trim(),
          dica: qPayload.dica ? qPayload.dica.trim() : null,
          explicacao: qPayload.explicacao ? qPayload.explicacao.trim() : null,
        };

        if (qAtual.tipo === 'discursiva') {
          if (qPayload.resposta_esperada !== undefined) {
            updatePayload.resposta_esperada = qPayload.resposta_esperada
              ? qPayload.resposta_esperada.trim()
              : null;
          }
        }

        const { error: erroUpdQ } = await this.cliente
          .from('questoes')
          .update(updatePayload)
          .eq('id', qAtual.id)
          .is('deleted_at', null);

        if (erroUpdQ) {
          throw new Error('Não foi possível salvar o texto da questão.');
        }

        if (qAtual.tipo !== 'discursiva' && qPayload.alternativas) {
          const { data: altsAtuais } = await this.cliente
            .from('alternativas')
            .select('id, letra')
            .eq('questao_id', qAtual.id)
            .order('letra', { ascending: true });

          const listaAlts = altsAtuais || [];
          for (let altIdx = 0; altIdx < listaAlts.length; altIdx++) {
            const payloadAlt = qPayload.alternativas[altIdx];
            const existAlt = listaAlts[altIdx];
            const { error: erroUpdAlt } = await this.cliente
              .from('alternativas')
              .update({
                texto: payloadAlt.texto.trim(),
                por_que_errou: payloadAlt.por_que_errou ? payloadAlt.por_que_errou.trim() : null,
              })
              .eq('id', existAlt.id);

            if (erroUpdAlt) {
              throw new Error('Não foi possível atualizar o texto da alternativa.');
            }
          }
        }
      }

      return;
    }

    // 4. Status 'rascunho': upsert de questões e alternativas sem apagar antes
    const idsSalvos: string[] = [];

    for (let i = 0; i < questoes.length; i++) {
      const qPayload = questoes[i];
      const ordemCalculada = qPayload.ordem ?? i + 1;
      let questaoId: string;

      if (qPayload.id && questoesAtuais.some((q) => q.id === qPayload.id)) {
        questaoId = qPayload.id;
        const { error: erroUpd } = await this.cliente
          .from('questoes')
          .update({
            ordem: ordemCalculada,
            enunciado: qPayload.enunciado.trim(),
            dica: qPayload.dica ? qPayload.dica.trim() : null,
            explicacao: qPayload.explicacao ? qPayload.explicacao.trim() : null,
            banco_questao_id: qPayload.banco_questao_id || null,
            assunto_id: qPayload.assunto_id || null,
            tipo: qPayload.tipo || 'objetiva',
            dificuldade: qPayload.dificuldade || 'medio',
            resposta_esperada: qPayload.resposta_esperada ? qPayload.resposta_esperada.trim() : null,
            imagem_url: qPayload.imagem_url || null,
          })
          .eq('id', questaoId)
          .is('deleted_at', null);

        if (erroUpd) {
          throw new Error('Não foi possível salvar a questão da atividade.');
        }
      } else {
        const { data: novaQ, error: erroIns } = await this.cliente
          .from('questoes')
          .insert({
            atividade_id: atividadeId,
            ordem: ordemCalculada,
            enunciado: qPayload.enunciado.trim(),
            dica: qPayload.dica ? qPayload.dica.trim() : null,
            explicacao: qPayload.explicacao ? qPayload.explicacao.trim() : null,
            banco_questao_id: qPayload.banco_questao_id || null,
            assunto_id: qPayload.assunto_id || null,
            tipo: qPayload.tipo || 'objetiva',
            dificuldade: qPayload.dificuldade || 'medio',
            resposta_esperada: qPayload.resposta_esperada ? qPayload.resposta_esperada.trim() : null,
            imagem_url: qPayload.imagem_url || null,
          })
          .select('id')
          .single();

        if (erroIns || !novaQ) {
          throw new Error('Não foi possível salvar a questão da atividade.');
        }
        questaoId = novaQ.id;
      }

      idsSalvos.push(questaoId);

      // Alternativas: upsert por (questao_id, letra) e só depois remove as letras que sobraram,
      // para uma falha no meio nunca deixar a questão sem alternativas.
      if (qPayload.tipo !== 'discursiva' && qPayload.alternativas) {
        const altsParaGravar = qPayload.alternativas.map((alt, altIdx) => ({
          questao_id: questaoId,
          letra: LETRAS_VALIDAS[altIdx],
          texto: alt.texto.trim(),
          correta: Boolean(alt.correta),
          por_que_errou: alt.por_que_errou ? alt.por_que_errou.trim() : null,
        }));

        const { error: erroGravarAlts } = await this.cliente
          .from('alternativas')
          .upsert(altsParaGravar, { onConflict: 'questao_id,letra' });

        if (erroGravarAlts) {
          throw new Error('Não foi possível salvar as alternativas da questão.');
        }

        const letrasSobrando = LETRAS_VALIDAS.slice(altsParaGravar.length);
        if (letrasSobrando.length > 0) {
          const { error: erroLimpar } = await this.cliente
            .from('alternativas')
            .delete()
            .eq('questao_id', questaoId)
            .in('letra', letrasSobrando);

          if (erroLimpar) {
            throw new Error('Não foi possível atualizar as alternativas da questão.');
          }
        }
      }
    }

    // Questões que saíram da lista recebem deleted_at por último
    const idsParaRemover = questoesAtuais.map((q) => q.id).filter((id) => !idsSalvos.includes(id));
    if (idsParaRemover.length > 0) {
      const { error: erroRemover } = await this.cliente
        .from('questoes')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', idsParaRemover);

      if (erroRemover) {
        throw new Error('Não foi possível remover as questões descartadas.');
      }
    }
  }

  async reordenarQuestoes(atividadeId: string, ordemIds: string[]): Promise<void> {
    const { oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoEscritaOferta(oferta.id);

    for (let i = 0; i < ordemIds.length; i++) {
      const { error } = await this.cliente
        .from('questoes')
        .update({ ordem: i + 1 })
        .eq('id', ordemIds[i])
        .eq('atividade_id', atividadeId)
        .is('deleted_at', null);

      if (error) {
        throw new Error('Não foi possível reordenar as questões.');
      }
    }
  }

  async excluirQuestao(id: string): Promise<void> {
    const { data: questao, error: erroQ } = await this.cliente
      .from('questoes')
      .select('id, atividade_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroQ) {
      throw new Error('Não foi possível verificar a questão.');
    }
    if (!questao) {
      throw new Error('Questão não encontrada.');
    }

    const { atividade, oferta } = await this.obterOfertaDaAtividade(questao.atividade_id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'rascunho') {
      throw new Error('Atividade publicada: só é possível corrigir textos.');
    }

    const { count, error: erroResp } = await this.cliente
      .from('respostas')
      .select('id', { count: 'exact', head: true })
      .eq('questao_id', id);

    if (erroResp) {
      throw new Error('Não foi possível verificar respostas da questão.');
    }
    if (count && count > 0) {
      throw new Error('Não é possível excluir uma questão que já possui respostas.');
    }

    const { error } = await this.cliente
      .from('questoes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível excluir a questão.');
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Recados da Turma (Avisos)
  // ---------------------------------------------------------------------------

  async listarRecadosTurma(turmaId: string): Promise<Aviso[]> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    if (sessao.papel === 'professor') {
      const { data: oferta, error: erroOferta } = await this.cliente
        .from('ofertas')
        .select('id')
        .eq('turma_id', turmaId)
        .eq('professor_id', sessao.id)
        .is('deleted_at', null)
        .limit(1);

      if (erroOferta) {
        throw new Error('Não foi possível verificar a permissão para a turma.');
      }
      if (!oferta || oferta.length === 0) {
        throw new Error('Você não tem permissão para esta ação.');
      }
    }

    const { data, error } = await this.cliente
      .from('avisos')
      .select('id, escola_id, autor_id, turma_id, titulo, mensagem, prioridade, publicado_em')
      .eq('turma_id', turmaId)
      .is('deleted_at', null)
      .order('publicado_em', { ascending: false });

    if (error) {
      throw new Error('Não foi possível listar os recados da turma.');
    }

    return ((data || []) as LinhaAvisoBanco[]).map((linha): Aviso => ({
      id: linha.id,
      created_at: linha.publicado_em,
      escola_id: linha.escola_id,
      autor_id: linha.autor_id,
      turma_id: linha.turma_id,
      titulo: linha.titulo,
      mensagem: linha.mensagem,
      prioridade: linha.prioridade,
      publicado_em: linha.publicado_em,
    }));
  }

  async criarRecadoTurma(
    ofertaId: string,
    dados: { titulo: string; mensagem: string; prioridade: PrioridadeAviso }
  ): Promise<Aviso> {
    const { sessao } = await this.validarAcessoEscritaOferta(ofertaId);

    const { data: oferta, error: erroOferta } = await this.cliente
      .from('ofertas')
      .select('id, turma_id')
      .eq('id', ofertaId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroOferta || !oferta) {
      throw new Error('Oferta não encontrada.');
    }

    const { data, error } = await this.cliente
      .from('avisos')
      .insert({
        escola_id: sessao.escola_id,
        autor_id: sessao.id,
        turma_id: oferta.turma_id,
        titulo: dados.titulo.trim(),
        mensagem: dados.mensagem.trim(),
        prioridade: dados.prioridade,
      })
      .select('id, escola_id, autor_id, turma_id, titulo, mensagem, prioridade, publicado_em')
      .single();

    if (error) {
      throw new Error('Não foi possível publicar o recado para a turma.');
    }

    const linha = data as LinhaAvisoBanco;
    return {
      id: linha.id,
      created_at: linha.publicado_em,
      escola_id: linha.escola_id,
      autor_id: linha.autor_id,
      turma_id: linha.turma_id,
      titulo: linha.titulo,
      mensagem: linha.mensagem,
      prioridade: linha.prioridade,
      publicado_em: linha.publicado_em,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Observações do Aluno
  // ---------------------------------------------------------------------------

  async listarObservacoesAluno(alunoId: string): Promise<AlunoObservacao[]> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: aluno, error: erroAluno } = await this.cliente
      .from('alunos')
      .select('id, turma_id')
      .eq('id', alunoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAluno) {
      throw new Error('Não foi possível verificar os dados do aluno.');
    }
    if (!aluno) {
      throw new Error('Aluno não encontrado.');
    }

    if (sessao.papel === 'professor') {
      const { data: oferta, error: erroOferta } = await this.cliente
        .from('ofertas')
        .select('id')
        .eq('turma_id', aluno.turma_id)
        .eq('professor_id', sessao.id)
        .is('deleted_at', null)
        .limit(1);

      if (erroOferta) {
        throw new Error('Não foi possível verificar a permissão sobre o aluno.');
      }
      if (!oferta || oferta.length === 0) {
        throw new Error('Você não tem permissão para esta ação.');
      }
    }

    const { data, error } = await this.cliente
      .from('aluno_observacoes')
      .select('id, aluno_id, professor_id, professor_nome, texto, created_at, updated_at')
      .eq('aluno_id', alunoId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error('Não foi possível listar as observações do aluno.');
    }

    return (data || []) as AlunoObservacao[];
  }

  async salvarObservacaoAluno(alunoId: string, texto: string): Promise<AlunoObservacao> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: aluno, error: erroAluno } = await this.cliente
      .from('alunos')
      .select('id, turma_id')
      .eq('id', alunoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAluno) {
      throw new Error('Não foi possível verificar os dados do aluno.');
    }
    if (!aluno) {
      throw new Error('Aluno não encontrado.');
    }

    if (sessao.papel === 'professor') {
      const { data: oferta, error: erroOferta } = await this.cliente
        .from('ofertas')
        .select('id')
        .eq('turma_id', aluno.turma_id)
        .eq('professor_id', sessao.id)
        .is('deleted_at', null)
        .limit(1);

      if (erroOferta) {
        throw new Error('Não foi possível verificar a permissão sobre o aluno.');
      }
      if (!oferta || oferta.length === 0) {
        throw new Error('Você não tem permissão para esta ação.');
      }
    }

    if (!texto || !texto.trim()) {
      throw new Error('A observação não pode ser vazia.');
    }

    const { data: existente, error: erroExistente } = await this.cliente
      .from('aluno_observacoes')
      .select('id')
      .eq('aluno_id', alunoId)
      .eq('professor_id', sessao.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroExistente) {
      throw new Error('Não foi possível verificar observação existente.');
    }

    if (existente) {
      const { data, error } = await this.cliente
        .from('aluno_observacoes')
        .update({
          texto: texto.trim(),
          professor_nome: sessao.nome,
        })
        .eq('id', existente.id)
        .select('id, aluno_id, professor_id, professor_nome, texto, created_at, updated_at')
        .single();

      if (error) {
        throw new Error('Não foi possível salvar a observação do aluno.');
      }
      return data as AlunoObservacao;
    }

    const { data, error } = await this.cliente
      .from('aluno_observacoes')
      .insert({
        aluno_id: alunoId,
        professor_id: sessao.id,
        professor_nome: sessao.nome,
        texto: texto.trim(),
      })
      .select('id, aluno_id, professor_id, professor_nome, texto, created_at, updated_at')
      .single();

    if (error) {
      throw new Error('Não foi possível salvar a observação do aluno.');
    }
    return data as AlunoObservacao;
  }

  async excluirObservacaoAluno(observacaoId: string): Promise<void> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: obs, error: erroObs } = await this.cliente
      .from('aluno_observacoes')
      .select('id, aluno_id, professor_id')
      .eq('id', observacaoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroObs) {
      throw new Error('Não foi possível verificar a observação.');
    }
    if (!obs) {
      throw new Error('Observação não encontrada.');
    }

    if (sessao.papel === 'professor') {
      if (obs.professor_id !== sessao.id) {
        throw new Error('Você só pode excluir suas próprias observações.');
      }

      const { data: aluno, error: erroAluno } = await this.cliente
        .from('alunos')
        .select('turma_id')
        .eq('id', obs.aluno_id)
        .maybeSingle();

      if (erroAluno || !aluno) {
        throw new Error('Não foi possível verificar a turma do aluno.');
      }

      const { data: oferta, error: erroOferta } = await this.cliente
        .from('ofertas')
        .select('id')
        .eq('turma_id', aluno.turma_id)
        .eq('professor_id', sessao.id)
        .is('deleted_at', null)
        .limit(1);

      if (erroOferta) {
        throw new Error('Não foi possível verificar a permissão para excluir a observação.');
      }
      if (!oferta || oferta.length === 0) {
        throw new Error('Você não tem permissão para esta ação.');
      }
    }

    const { error } = await this.cliente
      .from('aluno_observacoes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', observacaoId)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível excluir a observação.');
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Mapa de Calor e Correção de Discursivas (Fase 5.4)
  // ---------------------------------------------------------------------------

  async mapaDeCalor(atividadeId: string): Promise<MapaDeCalorAtividade> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoLeituraOferta(oferta.id);

    const { data: questoesData, error: erroQuestoes } = await this.cliente
      .from('questoes')
      .select('id, created_at, atividade_id, ordem, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, banco_questao_id, assunto_id')
      .eq('atividade_id', atividadeId)
      .is('deleted_at', null)
      .order('ordem', { ascending: true });

    if (erroQuestoes) {
      throw new Error('Não foi possível carregar as questões para o mapa de calor.');
    }

    const questoes = (questoesData || []) as Questao[];
    const questaoIds = questoes.map((q) => q.id);

    let alternativas: Alternativa[] = [];
    let respostas: Resposta[] = [];

    if (questaoIds.length > 0) {
      const { data: altsData, error: erroAlts } = await this.cliente
        .from('alternativas')
        .select('id, updated_at, questao_id, letra, texto, correta, por_que_errou')
        .in('questao_id', questaoIds)
        .order('letra', { ascending: true });

      if (erroAlts) {
        throw new Error('Não foi possível carregar as alternativas para o mapa de calor.');
      }

      alternativas = (altsData || []).map((alt) => ({
        id: alt.id,
        created_at: alt.updated_at,
        questao_id: alt.questao_id,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        por_que_errou: alt.por_que_errou,
      }));

      const respostasData = await lerTudoPorIds<LinhaBanco>(
        questaoIds,
        (bloco) =>
          this.cliente
            .from('respostas')
            .select('id, aluno_id, questao_id, alternativa_id, acertou, pontuacao, texto_resposta, correcao, comentario_professor, corrigido_por, corrigido_em, respondida_em, tentativas, acertou_final, updated_at')
            .in('questao_id', bloco),
        'Não foi possível carregar as respostas para o mapa de calor.'
      );

      respostas = respostasData.map((r) => ({
        id: r.id,
        created_at: r.respondida_em,
        aluno_id: r.aluno_id,
        questao_id: r.questao_id,
        alternativa_id: r.alternativa_id,
        acertou: r.acertou,
        tentativas: r.tentativas,
        acertou_final: r.acertou_final,
        texto_resposta: r.texto_resposta,
        correcao: r.correcao,
        pontuacao: r.pontuacao !== null && r.pontuacao !== undefined ? Number(r.pontuacao) : null,
        comentario_professor: r.comentario_professor,
        corrigido_por: r.corrigido_por,
        corrigido_em: r.corrigido_em,
        respondida_em: r.respondida_em,
      }));
    }

    const questoesMapa = questoes.map((q) => {
      const altsDaQuestao = alternativas.filter((alt) => alt.questao_id === q.id);
      const respostasDaQuestao = respostas.filter((r) => r.questao_id === q.id);
      return calcularMapaDeCalorQuestao(q, altsDaQuestao, respostasDaQuestao);
    });

    const alunoIds = new Set(respostas.map((r) => r.aluno_id));

    return {
      atividade_id: atividadeId,
      titulo: atividade.titulo,
      total_alunos_responderam: alunoIds.size,
      questoes: questoesMapa,
    };
  }

  async listarCorrecoesPendentes(atividadeId: string): Promise<ItemCorrecaoPendente[]> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoEscritaOferta(oferta.id);

    const { data: questoesData, error: erroQuestoes } = await this.cliente
      .from('questoes')
      .select('id, ordem, enunciado, resposta_esperada, tipo')
      .eq('atividade_id', atividadeId)
      .eq('tipo', 'discursiva')
      .is('deleted_at', null);

    if (erroQuestoes) {
      throw new Error('Não foi possível verificar as questões da atividade.');
    }

    const questoes = questoesData || [];
    if (questoes.length === 0) {
      return [];
    }

    const questaoIds = questoes.map((q) => q.id);
    const questoesMap = new Map(questoes.map((q) => [q.id, q]));

    const respostas = (
      await lerTudoPorIds<LinhaBanco>(
        questaoIds,
        (bloco) =>
          this.cliente
            .from('respostas')
            .select('id, aluno_id, questao_id, texto_resposta, respondida_em')
            .in('questao_id', bloco)
            .eq('correcao', 'pendente'),
        'Não foi possível listar as correções pendentes.'
      )
    ).sort((a, b) => new Date(a.respondida_em).getTime() - new Date(b.respondida_em).getTime());
    if (respostas.length === 0) {
      return [];
    }

    const alunoIds = [...new Set(respostas.map((r) => r.aluno_id))];
    const { data: alunosData, error: erroAlunos } = await this.cliente
      .from('alunos')
      .select('id, nome_completo')
      .in('id', alunoIds);

    if (erroAlunos) {
      throw new Error('Não foi possível verificar os alunos das respostas pendentes.');
    }

    const alunosMap = new Map((alunosData || []).map((a) => [a.id, a.nome_completo]));

    return respostas.map((r) => {
      const questao = questoesMap.get(r.questao_id)!;
      const nomeAluno = alunosMap.get(r.aluno_id) || 'Aluno';

      return {
        resposta_id: r.id,
        atividade_id: atividade.id,
        questao_id: questao.id,
        aluno_id: r.aluno_id,
        aluno_nome: nomeAluno,
        nome_aluno: nomeAluno,
        questao_ordem: questao.ordem,
        questao_enunciado: questao.enunciado,
        enunciado: questao.enunciado,
        resposta_esperada: questao.resposta_esperada ?? null,
        texto_resposta: r.texto_resposta ?? null,
        respondida_em: r.respondida_em,
      };
    });
  }

  async listarCorrecoesFeitas(atividadeId: string): Promise<ItemCorrecaoFeita[]> {
    const { oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoEscritaOferta(oferta.id);

    const { data: questoesData, error: erroQuestoes } = await this.cliente
      .from('questoes')
      .select('id, ordem, enunciado, resposta_esperada, tipo')
      .eq('atividade_id', atividadeId)
      .eq('tipo', 'discursiva')
      .is('deleted_at', null);

    if (erroQuestoes) {
      throw new Error('Não foi possível verificar as questões da atividade.');
    }

    const questoes = questoesData || [];
    if (questoes.length === 0) {
      return [];
    }

    const questaoIds = questoes.map((q) => q.id);
    const questoesMap = new Map(questoes.map((q) => [q.id, q]));

    const respostasData = await lerTudoPorIds<LinhaBanco>(
      questaoIds,
      (bloco) =>
        this.cliente
          .from('respostas')
          .select('id, aluno_id, questao_id, texto_resposta, correcao, pontuacao, comentario_professor, corrigido_em, respondida_em')
          .in('questao_id', bloco)
          .neq('correcao', 'pendente')
          .not('correcao', 'is', null),
      'Não foi possível listar as correções feitas.'
    );

    const respostas = respostasData.filter(
      (r) => r.correcao && r.correcao !== 'pendente'
    );

    if (respostas.length === 0) {
      return [];
    }

    respostas.sort(
      (a, b) =>
        new Date(b.corrigido_em || b.respondida_em).getTime() -
        new Date(a.corrigido_em || a.respondida_em).getTime()
    );

    const alunoIds = [...new Set(respostas.map((r) => r.aluno_id))];
    const { data: alunosData, error: erroAlunos } = await this.cliente
      .from('alunos')
      .select('id, nome_completo')
      .in('id', alunoIds);

    if (erroAlunos) {
      throw new Error('Não foi possível verificar os alunos das correções feitas.');
    }

    const alunosMap = new Map((alunosData || []).map((a) => [a.id, a.nome_completo]));

    return respostas.map((r) => {
      const questao = questoesMap.get(r.questao_id)!;
      const nomeAluno = alunosMap.get(r.aluno_id) || 'Aluno';
      const pontuacaoNum =
        r.pontuacao !== null && r.pontuacao !== undefined ? Number(r.pontuacao) : null;

      const nota =
        pontuacaoNum !== null
          ? pontuacaoNum <= 1
            ? Math.round(pontuacaoNum * 100)
            : Math.round(pontuacaoNum)
          : r.correcao === 'certo'
            ? 100
            : r.correcao === 'parcial'
              ? 50
              : r.correcao === 'errado'
                ? 0
                : null;

      return {
        resposta_id: r.id,
        questao_id: questao.id,
        aluno_id: r.aluno_id,
        aluno_nome: nomeAluno,
        nome_aluno: nomeAluno,
        questao_ordem: questao.ordem,
        questao_enunciado: questao.enunciado,
        enunciado: questao.enunciado,
        resposta_esperada: questao.resposta_esperada ?? null,
        texto_resposta: r.texto_resposta ?? null,
        respondida_em: r.respondida_em,
        correcao: r.correcao as 'certo' | 'parcial' | 'errado',
        pontuacao: pontuacaoNum,
        nota,
        comentario_professor: r.comentario_professor ?? null,
        corrigido_em: r.corrigido_em ?? null,
      };
    });
  }

  async corrigirResposta(
    respostaId: string,
    correcao: 'certo' | 'parcial' | 'errado',
    comentario?: string,
    nota?: number
  ): Promise<void> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: resposta, error: erroResposta } = await this.cliente
      .from('respostas')
      .select('id, questao_id')
      .eq('id', respostaId)
      .maybeSingle();

    if (erroResposta) {
      throw new Error('Não foi possível verificar a resposta.');
    }
    if (!resposta) {
      throw new Error('Resposta não encontrada.');
    }

    const { data: questao, error: erroQuestao } = await this.cliente
      .from('questoes')
      .select('id, atividade_id, tipo')
      .eq('id', resposta.questao_id)
      .maybeSingle();

    if (erroQuestao) {
      throw new Error('Não foi possível verificar a questão da resposta.');
    }
    if (!questao) {
      throw new Error('Questão não encontrada.');
    }
    if (questao.tipo !== 'discursiva') {
      throw new Error('Esta questão não é discursiva.');
    }

    const { oferta } = await this.obterOfertaDaAtividade(questao.atividade_id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (comentario && comentario.length > 500) {
      throw new Error('O comentário do professor deve ter no máximo 500 caracteres.');
    }

    if (nota !== undefined && nota !== null) {
      if (typeof nota !== 'number' || isNaN(nota) || nota < 0 || nota > 100) {
        throw new Error('A nota deve estar entre 0 e 100.');
      }
    }

    let pontuacaoFinal: number | null;
    let correcaoFinal = correcao;

    if (typeof nota === 'number') {
      pontuacaoFinal = Math.round((nota / 100) * 100) / 100;
      if (nota === 100) {
        correcaoFinal = 'certo';
      } else if (nota === 0) {
        correcaoFinal = 'errado';
      } else {
        correcaoFinal = 'parcial';
      }
    } else {
      pontuacaoFinal = pontuacaoDaResposta(questao, { correcao });
    }

    const agora = new Date().toISOString();

    // Privilégio por coluna da migration 0006: NUNCA enviar chaves além destas 5
    const payload = {
      correcao: correcaoFinal,
      pontuacao: pontuacaoFinal,
      comentario_professor: comentario ? comentario.trim() : null,
      corrigido_por: sessao.id,
      corrigido_em: agora,
    };

    const { data: atualizadas, error: erroUpdate } = await this.cliente
      .from('respostas')
      .update(payload)
      .eq('id', respostaId)
      .select('id');

    if (erroUpdate) {
      throw new Error('Não foi possível salvar a correção da resposta.');
    }
    // A RLS filtra em silêncio: sem linha devolvida, a correção não foi gravada.
    if (Array.isArray(atualizadas) && atualizadas.length === 0) {
      throw new Error('A correção não foi salva: você não tem permissão sobre esta resposta.');
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Relatórios Pedagógicos do Professor (Fase 5.5)
  // ---------------------------------------------------------------------------

  /**
   * Painel inicial do professor: uma única RPC (0008) em vez de dezenas de leituras por oferta.
   * A conta é a mesma do mock (painel-professor.ts); a RPC só traz os dados já filtrados.
   */
  async painelProfessor(periodoId: string | null): Promise<PainelProfessor> {
    await this.obterContextoSessao();

    const { data, error } = await this.cliente.rpc('professor_painel_dados');
    if (error) {
      throw new Error('Não foi possível carregar o painel do professor.');
    }
    const dados = data as DadosPainelProfessor | null;
    if (!dados || !Array.isArray(dados.ofertas)) {
      throw new Error('Não foi possível carregar o painel do professor.');
    }

    let periodo: { id: string; nome: string } | null = null;
    if (periodoId) {
      const { data: p, error: erroPeriodo } = await this.cliente
        .from('periodos')
        .select('id, nome')
        .eq('id', periodoId)
        .maybeSingle();
      if (erroPeriodo) {
        throw new Error('Não foi possível carregar os dados do período.');
      }
      periodo = p ? { id: p.id as string, nome: p.nome as string } : null;
    }

    return calcularPainelProfessor(dados, periodo, new Date());
  }

  async desempenhoOferta(ofertaId: string, periodoId: string): Promise<RelatorioDesempenhoOferta> {
    await this.validarAcessoLeituraOferta(ofertaId);

    const { data: oferta, error: erroOferta } = await this.cliente
      .from('ofertas')
      .select('id, turma_id, disciplina_id, professor_id')
      .eq('id', ofertaId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroOferta) {
      throw new Error('Não foi possível verificar a oferta.');
    }
    if (!oferta) {
      throw new Error('Oferta não encontrada.');
    }

    const { data: turma, error: erroTurma } = await this.cliente
      .from('turmas')
      .select('id, nome')
      .eq('id', oferta.turma_id)
      .maybeSingle();

    if (erroTurma) {
      throw new Error('Não foi possível carregar os dados da turma.');
    }

    const { data: disciplina, error: erroDisciplina } = await this.cliente
      .from('disciplinas')
      .select('id, nome')
      .eq('id', oferta.disciplina_id)
      .maybeSingle();

    if (erroDisciplina) {
      throw new Error('Não foi possível carregar os dados da disciplina.');
    }

    const { data: periodo, error: erroPeriodo } = await this.cliente
      .from('periodos')
      .select('id, nome')
      .eq('id', periodoId)
      .maybeSingle();

    if (erroPeriodo) {
      throw new Error('Não foi possível carregar os dados do período.');
    }

    // Atividades publicadas ou encerradas da oferta no período
    const { data: ativData, error: erroAtiv } = await this.cliente
      .from('atividades')
      .select('id, created_at, titulo, modo, status')
      .eq('oferta_id', ofertaId)
      .eq('periodo_id', periodoId)
      .in('status', ['publicada', 'encerrada'])
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (erroAtiv) {
      throw new Error('Não foi possível carregar as atividades da oferta.');
    }

    const atividadesDoPeriodo = ativData || [];
    const ativIds = atividadesDoPeriodo.map((a) => a.id);

    // Alunos ativos da turma
    const { data: alunosData, error: erroAlunos } = await this.cliente
      .from('alunos')
      .select('id, nome_completo, numero_chamada, ativo')
      .eq('turma_id', oferta.turma_id)
      .eq('ativo', true)
      .is('deleted_at', null)
      .order('numero_chamada', { ascending: true });

    if (erroAlunos) {
      throw new Error('Não foi possível carregar os alunos da turma.');
    }

    const alunosDaTurma = alunosData || [];

    // Questões e respostas das atividades
    let questoes: Array<{ id: string; atividade_id: string; tipo: TipoQuestao }> = [];
    let respostas: Array<{ id: string; aluno_id: string; questao_id: string; acertou: boolean | null; pontuacao: number | null; correcao: any }> = [];

    if (ativIds.length > 0) {
      questoes = await lerTudoPorIds<(typeof questoes)[number]>(
        ativIds,
        (bloco) =>
          this.cliente.from('questoes').select('id, atividade_id, tipo').in('atividade_id', bloco).is('deleted_at', null),
        'Não foi possível carregar as questões das atividades.'
      );

      const qIds = questoes.map((q) => q.id);
      respostas = await lerTudoPorIds<(typeof respostas)[number]>(
        qIds,
        (bloco) =>
          this.cliente.from('respostas').select('id, aluno_id, questao_id, acertou, pontuacao, correcao').in('questao_id', bloco),
        'Não foi possível carregar as respostas das atividades.'
      );
    }

    return calcularDesempenhoOferta({
      ofertaId,
      turmaNome: turma?.nome || 'Turma',
      disciplinaNome: disciplina?.nome || 'Disciplina',
      periodoNome: periodo?.nome || 'Período',
      atividadesDoPeriodo,
      alunosDaTurma,
      questoes,
      respostas,
    });
  }

  async fichaAluno(ofertaIdOuAlunoId: string, alunoId?: string): Promise<FichaAluno> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    let realOfertaId = alunoId ? ofertaIdOuAlunoId : '';
    const realAlunoId = alunoId ? alunoId : ofertaIdOuAlunoId;

    const { data: aluno, error: erroAluno } = await this.cliente
      .from('alunos')
      .select('id, escola_id, turma_id, nome_completo, numero_chamada, ativo, created_at')
      .eq('id', realAlunoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAluno) {
      throw new Error('Não foi possível verificar os dados do aluno.');
    }
    if (!aluno) {
      throw new Error('Aluno não encontrado.');
    }

    if (!realOfertaId) {
      const { data: ofertasTurma, error: erroOfertas } = await this.cliente
        .from('ofertas')
        .select('id, professor_id, turma_id, disciplina_id')
        .eq('turma_id', aluno.turma_id)
        .is('deleted_at', null);

      if (erroOfertas) {
        throw new Error('Não foi possível verificar as ofertas do aluno.');
      }

      const ofertas = ofertasTurma || [];
      const ofertaDoProf = ofertas.find(
        (o) => sessao.papel !== 'professor' || o.professor_id === sessao.id
      );
      const qualquerOferta = ofertas[0];
      realOfertaId = ofertaDoProf ? ofertaDoProf.id : qualquerOferta ? qualquerOferta.id : '';
    }

    let oferta: { id: string; turma_id: string; disciplina_id: string } | null = null;
    if (realOfertaId) {
      await this.validarAcessoLeituraOferta(realOfertaId);
      const { data: ofData, error: erroOf } = await this.cliente
        .from('ofertas')
        .select('id, turma_id, disciplina_id')
        .eq('id', realOfertaId)
        .is('deleted_at', null)
        .maybeSingle();

      if (erroOf) {
        throw new Error('Não foi possível verificar a oferta.');
      }
      oferta = ofData;
    }

    if (oferta && aluno.turma_id !== oferta.turma_id) {
      throw new Error('O aluno não pertence à turma desta oferta.');
    }

    const { data: turma, error: erroTurma } = await this.cliente
      .from('turmas')
      .select('id, nome')
      .eq('id', aluno.turma_id)
      .maybeSingle();

    if (erroTurma) {
      throw new Error('Não foi possível carregar os dados da turma.');
    }

    let disciplinaNome = 'Todas as matérias';
    if (oferta) {
      const { data: discData, error: erroDisc } = await this.cliente
        .from('disciplinas')
        .select('id, nome')
        .eq('id', oferta.disciplina_id)
        .maybeSingle();

      if (erroDisc) {
        throw new Error('Não foi possível carregar os dados da disciplina.');
      }
      if (discData?.nome) {
        disciplinaNome = discData.nome;
      }
    }

    let atividades: Array<{ id: string; created_at: string; titulo: string; modo: any; status: string }> = [];
    if (oferta) {
      const { data: ativData, error: erroAtiv } = await this.cliente
        .from('atividades')
        .select('id, created_at, titulo, modo, status')
        .eq('oferta_id', oferta.id)
        .in('status', ['publicada', 'encerrada'])
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (erroAtiv) {
        throw new Error('Não foi possível carregar as atividades da ficha.');
      }
      atividades = ativData || [];
    }

    const ativIds = atividades.map((a) => a.id);
    let questoes: Array<{ id: string; atividade_id: string; ordem: number; enunciado: string; tipo: TipoQuestao }> = [];
    let alternativas: Array<{ id: string; questao_id: string; correta: boolean }> = [];
    let respostas: Array<{
      id: string;
      questao_id: string;
      alternativa_id: string | null;
      acertou: boolean | null;
      tentativas: number;
      acertou_final: boolean | null;
      texto_resposta: string | null;
      correcao: any;
      pontuacao: number | null;
      comentario_professor: string | null;
    }> = [];

    if (ativIds.length > 0) {
      const { data: questData, error: erroQuest } = await this.cliente
        .from('questoes')
        .select('id, atividade_id, ordem, enunciado, tipo')
        .in('atividade_id', ativIds)
        .is('deleted_at', null)
        .order('ordem', { ascending: true });

      if (erroQuest) {
        throw new Error('Não foi possível carregar as questões.');
      }
      questoes = (questData || []) as typeof questoes;

      const qIds = questoes.map((q) => q.id);
      if (qIds.length > 0) {
        const { data: altsData, error: erroAlts } = await this.cliente
          .from('alternativas')
          .select('id, questao_id, correta')
          .in('questao_id', qIds);

        if (erroAlts) {
          throw new Error('Não foi possível carregar as alternativas.');
        }
        alternativas = altsData || [];

        respostas = await lerTudoPorIds<(typeof respostas)[number]>(
          qIds,
          (bloco) =>
            this.cliente
              .from('respostas')
              .select('id, questao_id, alternativa_id, acertou, tentativas, acertou_final, texto_resposta, correcao, pontuacao, comentario_professor')
              .eq('aluno_id', aluno.id)
              .in('questao_id', bloco),
          'Não foi possível carregar as respostas.'
        );
      }
    }

    let somaAcertosMedia = 0;
    let somaQuestoesMedia = 0;
    const atividadesFicha: FichaAlunoAtividadeItem[] = [];

    for (const ativ of atividades) {
      const qs = questoes.filter((q) => q.atividade_id === ativ.id).sort((a, b) => a.ordem - b.ordem);
      const questoesFicha: FichaAlunoQuestaoItem[] = [];
      let totalPontos = 0;
      let totalRespondidas = 0;
      let temDiscursivaPendente = false;

      for (const q of qs) {
        const r = respostas.find((resp) => resp.questao_id === q.id);
        const corretaAlt = alternativas.find((alt) => alt.questao_id === q.id && alt.correta);

        if (r) {
          totalRespondidas++;
          const p = pontuacaoDaResposta(q, r);
          if (p !== null) {
            totalPontos += p;
          } else if (q.tipo === 'discursiva') {
            temDiscursivaPendente = true;
          }
        }

        questoesFicha.push({
          questao_id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          alternativa_escolhida_id: r ? r.alternativa_id : null,
          alternativa_correta_id: corretaAlt?.id || '',
          acertou: r ? r.acertou : null,
          tentativas: r ? r.tentativas : 0,
          acertou_final: r ? r.acertou_final : null,
          tipo: q.tipo ?? 'objetiva',
          texto_resposta: r ? r.texto_resposta : null,
          correcao: r ? r.correcao : null,
          pontuacao_discursiva: r ? (r.pontuacao ?? null) : null,
          comentario_professor: r ? r.comentario_professor : null,
        });
      }

      const totalQ = qs.length;
      const concluida = totalQ > 0 && totalRespondidas === totalQ;

      let statusAluno: 'concluida' | 'em_andamento' | 'pendente' = 'pendente';
      if (temDiscursivaPendente) {
        statusAluno = 'em_andamento';
      } else if (concluida) {
        statusAluno = 'concluida';
      } else if (totalRespondidas > 0) {
        statusAluno = 'em_andamento';
      }

      let aproveitamento: number | null = null;
      if (!temDiscursivaPendente && (concluida || ativ.status === 'encerrada')) {
        aproveitamento = calcularAproveitamentoAtividade(totalPontos, totalQ);
        somaAcertosMedia += totalPontos;
        somaQuestoesMedia += totalQ;
      }

      atividadesFicha.push({
        atividade_id: ativ.id,
        titulo: ativ.titulo,
        modo: ativ.modo,
        status_aluno: statusAluno,
        aproveitamento,
        questoes: questoesFicha,
      });
    }

    const mediaPeriodo = calcularMediaPeriodo(somaAcertosMedia, somaQuestoesMedia);
    const faixa = faixaDesempenho(mediaPeriodo);

    const alunoPublico: AlunoPublico = {
      id: aluno.id,
      escola_id: aluno.escola_id,
      turma_id: aluno.turma_id,
      nome_completo: aluno.nome_completo,
      numero_chamada: aluno.numero_chamada,
      ativo: aluno.ativo,
      created_at: aluno.created_at,
    };

    const desempenhoMaterias = await this.desempenhoAlunoPorMaterias(aluno.id);
    const observacoes = await this.listarObservacoesAluno(aluno.id);

    return {
      aluno: alunoPublico,
      turma_nome: turma?.nome || 'Turma',
      disciplina_nome: disciplinaNome,
      atividades: atividadesFicha,
      media_periodo: mediaPeriodo,
      faixa,
      desempenho_materias: desempenhoMaterias,
      observacoes,
    };
  }

  async listarAlunosPorSerie(serie: string): Promise<AlunoComDesempenhoResumo[]> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    let turmaIdsValidas = new Set<string>();
    if (sessao.papel === 'professor') {
      const { data: ofertasProf, error: erroOfertasProf } = await this.cliente
        .from('ofertas')
        .select('id, turma_id')
        .eq('professor_id', sessao.id)
        .is('deleted_at', null);

      if (erroOfertasProf) {
        throw new Error('Não foi possível verificar suas ofertas.');
      }
      turmaIdsValidas = new Set((ofertasProf || []).map((o) => o.turma_id));
    }

    // Turmas ativas da escola
    const { data: turmasData, error: erroTurmas } = await this.cliente
      .from('turmas')
      .select('id, nome, serie, escola_id, ativa')
      .eq('escola_id', sessao.escola_id)
      .eq('ativa', true)
      .is('deleted_at', null);

    if (erroTurmas) {
      throw new Error('Não foi possível carregar as turmas.');
    }

    const turmasDaSerie = (turmasData || []).filter((t) => {
      const serieMatch = (t.serie || 'Outras turmas') === serie;
      return serieMatch && (sessao.papel !== 'professor' || turmaIdsValidas.has(t.id));
    });

    if (turmasDaSerie.length === 0) {
      return [];
    }

    const mapaTurmas = new Map(turmasDaSerie.map((t) => [t.id, t]));
    const turmaIdsSerie = turmasDaSerie.map((t) => t.id);

    // Alunos ativos da série
    const { data: alunosData, error: erroAlunos } = await this.cliente
      .from('alunos')
      .select('id, turma_id, nome_completo, numero_chamada, escola_id, ativo, created_at')
      .in('turma_id', turmaIdsSerie)
      .eq('ativo', true)
      .is('deleted_at', null);

    if (erroAlunos) {
      throw new Error('Não foi possível carregar os alunos da série.');
    }

    const alunosDaSerie = alunosData || [];
    alunosDaSerie.sort((a, b) => {
      const turmaA = mapaTurmas.get(a.turma_id)?.nome || '';
      const turmaB = mapaTurmas.get(b.turma_id)?.nome || '';
      const cmp = turmaA.localeCompare(turmaB, 'pt-BR');
      if (cmp !== 0) return cmp;
      return a.numero_chamada - b.numero_chamada;
    });

    if (alunosDaSerie.length === 0) {
      return [];
    }

    const alunoIds = alunosDaSerie.map((a) => a.id);

    // Batch fetch de ofertas para as turmas da série
    const { data: ofertasData, error: erroOfertas } = await this.cliente
      .from('ofertas')
      .select('id, turma_id, disciplina_id, professor_id')
      .in('turma_id', turmaIdsSerie)
      .is('deleted_at', null);

    if (erroOfertas) {
      throw new Error('Não foi possível carregar as ofertas da série.');
    }
    const ofertas = ofertasData || [];
    const ofIds = ofertas.map((o) => o.id);
    const discIds = [...new Set(ofertas.map((o) => o.disciplina_id))];
    const profIds = [...new Set(ofertas.map((o) => o.professor_id))];

    // Disciplinas e Perfis
    const { data: discData, error: erroDisc } = await this.cliente
      .from('disciplinas')
      .select('id, nome')
      .in('id', discIds)
      .is('deleted_at', null);

    if (erroDisc) {
      throw new Error('Não foi possível carregar as disciplinas.');
    }
    const mapaDisciplinas = new Map((discData || []).map((d) => [d.id, d.nome]));

    const { data: profData, error: erroProf } = await this.cliente
      .from('perfis')
      .select('id, nome')
      .in('id', profIds);

    if (erroProf) {
      throw new Error('Não foi possível carregar os perfis.');
    }
    const mapaProfessores = new Map((profData || []).map((p) => [p.id, p.nome]));

    // Período ativo da escola
    const { data: periodosData, error: erroPeriodo } = await this.cliente
      .from('periodos')
      .select('id, ativo')
      .eq('escola_id', sessao.escola_id)
      .eq('ativo', true)
      .is('deleted_at', null)
      .limit(1);

    if (erroPeriodo) {
      throw new Error('Não foi possível verificar o período ativo.');
    }
    const periodoFinalId = periodosData && periodosData.length > 0 ? periodosData[0].id : '';

    // Atividades das ofertas
    let queryAtiv = this.cliente
      .from('atividades')
      .select('id, oferta_id, periodo_id, status')
      .in('oferta_id', ofIds)
      .in('status', ['publicada', 'encerrada'])
      .is('deleted_at', null);

    if (periodoFinalId) {
      queryAtiv = queryAtiv.eq('periodo_id', periodoFinalId);
    }

    const { data: ativData, error: erroAtiv } = await queryAtiv;
    if (erroAtiv) {
      throw new Error('Não foi possível carregar as atividades.');
    }
    const atividades = ativData || [];
    const ativIds = atividades.map((a) => a.id);

    // Questões
    let questoes: Array<{ id: string; atividade_id: string; tipo: TipoQuestao }> = [];
    if (ativIds.length > 0) {
      questoes = await lerTudoPorIds<(typeof questoes)[number]>(
        ativIds,
        (bloco) =>
          this.cliente.from('questoes').select('id, atividade_id, tipo').in('atividade_id', bloco).is('deleted_at', null),
        'Não foi possível carregar as questões.'
      );
    }
    const qIds = questoes.map((q) => q.id);

    // Respostas de todos os alunos da série. As questões são só das turmas da série; o filtro por
    // aluno é feito aqui para não mandar centenas de ids de aluno na URL.
    const idsAlunosDaSerie = new Set(alunoIds);
    const respostas = (
      await lerTudoPorIds<{ id: string; aluno_id: string; questao_id: string; acertou: boolean | null; pontuacao: number | null; correcao: any }>(
        qIds,
        (bloco) =>
          this.cliente.from('respostas').select('id, aluno_id, questao_id, acertou, pontuacao, correcao').in('questao_id', bloco),
        'Não foi possível carregar as respostas.'
      )
    ).filter((r) => idsAlunosDaSerie.has(r.aluno_id));

    // Observações de todos os alunos da série
    const observacoes = (
      await lerTudoPorIds<AlunoObservacao>(
        alunoIds,
        (bloco) =>
          this.cliente
            .from('aluno_observacoes')
            .select('id, aluno_id, professor_id, professor_nome, texto, created_at, updated_at')
            .in('aluno_id', bloco)
            .is('deleted_at', null),
        'Não foi possível carregar as observações dos alunos.'
      )
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const mapaObservacoesPorAluno = new Map<string, AlunoObservacao[]>();
    for (const obs of observacoes) {
      const lista = mapaObservacoesPorAluno.get(obs.aluno_id) || [];
      lista.push(obs);
      mapaObservacoesPorAluno.set(obs.aluno_id, lista);
    }

    const mapaRespostasPorAluno = new Map<string, typeof respostas>();
    for (const r of respostas) {
      const lista = mapaRespostasPorAluno.get(r.aluno_id) || [];
      lista.push(r);
      mapaRespostasPorAluno.set(r.aluno_id, lista);
    }

    const mapaOfertasPorTurma = new Map<string, typeof ofertas>();
    for (const ofItem of ofertas) {
      const lista = mapaOfertasPorTurma.get(ofItem.turma_id) || [];
      lista.push(ofItem);
      mapaOfertasPorTurma.set(ofItem.turma_id, lista);
    }

    const resultado: AlunoComDesempenhoResumo[] = [];

    for (const aluno of alunosDaSerie) {
      const turma = mapaTurmas.get(aluno.turma_id);
      const ofertasTurma = mapaOfertasPorTurma.get(aluno.turma_id) || [];
      const respostasDoAluno = mapaRespostasPorAluno.get(aluno.id) || [];
      const obsDoAluno = mapaObservacoesPorAluno.get(aluno.id) || [];

      const materias: DesempenhoAlunoMateriaItem[] = [];
      let somaAcertos = 0;
      let somaQuestoes = 0;

      for (const ofItem of ofertasTurma) {
        const discNome = mapaDisciplinas.get(ofItem.disciplina_id) || 'Disciplina';
        const profNome = mapaProfessores.get(ofItem.professor_id) || 'Professor(a)';
        const ativsOferta = atividades.filter((a) => a.oferta_id === ofItem.id);

        const { media, atividades_avaliadas, soma_acertos: acertosOf, soma_questoes: questOf } = mediaDoAlunoNasAtividades(
          ativsOferta,
          questoes as unknown as Questao[],
          respostasDoAluno as unknown as Resposta[]
        );
        const faixa = faixaDesempenho(media);

        somaAcertos += acertosOf;
        somaQuestoes += questOf;

        materias.push({
          disciplina_id: ofItem.disciplina_id,
          disciplina_nome: discNome,
          professor_nome: profNome,
          oferta_id: ofItem.id,
          media,
          faixa,
          total_atividades: ativsOferta.length,
          atividades_concluidas: atividades_avaliadas,
          soma_acertos: acertosOf,
          soma_questoes: questOf,
        });
      }

      const mediaGeral = calcularMediaPeriodo(somaAcertos, somaQuestoes);
      const faixaGeral = faixaDesempenho(mediaGeral);

      const alunoPublico: AlunoPublico = {
        id: aluno.id,
        escola_id: aluno.escola_id,
        turma_id: aluno.turma_id,
        nome_completo: aluno.nome_completo,
        numero_chamada: aluno.numero_chamada,
        ativo: aluno.ativo,
        created_at: aluno.created_at,
      };

      resultado.push({
        aluno: alunoPublico,
        turma_id: aluno.turma_id,
        turma_nome: turma?.nome || 'Turma',
        turma_serie: turma?.serie || serie,
        materias,
        media_geral: mediaGeral,
        faixa_geral: faixaGeral,
        ultima_observacao: obsDoAluno[0] || null,
        total_observacoes: obsDoAluno.length,
      });
    }

    return resultado;
  }

  async desempenhoAlunoPorMaterias(
    alunoId: string,
    periodoId?: string
  ): Promise<DesempenhoAlunoMateriaItem[]> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: aluno, error: erroAluno } = await this.cliente
      .from('alunos')
      .select('id, turma_id, escola_id')
      .eq('id', alunoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAluno) {
      throw new Error('Não foi possível verificar os dados do aluno.');
    }
    if (!aluno) {
      throw new Error('Aluno não encontrado.');
    }

    const { data: turma, error: erroTurma } = await this.cliente
      .from('turmas')
      .select('id, escola_id, nome')
      .eq('id', aluno.turma_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroTurma) {
      throw new Error('Não foi possível carregar os dados da turma.');
    }
    if (!turma) {
      throw new Error('Turma não encontrada.');
    }

    let periodoFinalId = periodoId || '';
    if (!periodoFinalId) {
      const { data: periodosData, error: erroPeriodo } = await this.cliente
        .from('periodos')
        .select('id, ativo')
        .eq('escola_id', turma.escola_id)
        .eq('ativo', true)
        .is('deleted_at', null)
        .limit(1);

      if (erroPeriodo) {
        throw new Error('Não foi possível verificar o período ativo.');
      }
      if (periodosData && periodosData.length > 0) {
        periodoFinalId = periodosData[0].id;
      }
    }

    const { data: ofertasData, error: erroOfertas } = await this.cliente
      .from('ofertas')
      .select('id, turma_id, disciplina_id, professor_id')
      .eq('turma_id', turma.id)
      .is('deleted_at', null);

    if (erroOfertas) {
      throw new Error('Não foi possível carregar as ofertas da turma.');
    }

    const ofertasTurma = Array.isArray(ofertasData)
      ? ofertasData
      : ofertasData
      ? [ofertasData]
      : [];
    if (ofertasTurma.length === 0) {
      return [];
    }

    const discIds = [...new Set(ofertasTurma.map((o) => o.disciplina_id))];
    const profIds = [...new Set(ofertasTurma.map((o) => o.professor_id))];
    const ofIds = ofertasTurma.map((o) => o.id);

    const { data: discData, error: erroDisc } = await this.cliente
      .from('disciplinas')
      .select('id, nome')
      .in('id', discIds)
      .is('deleted_at', null);

    if (erroDisc) {
      throw new Error('Não foi possível carregar as disciplinas.');
    }
    const mapaDisciplinas = new Map((discData || []).map((d) => [d.id, d.nome]));

    const { data: profData, error: erroProf } = await this.cliente
      .from('perfis')
      .select('id, nome')
      .in('id', profIds);

    if (erroProf) {
      throw new Error('Não foi possível carregar os perfis dos professores.');
    }
    const mapaProfessores = new Map((profData || []).map((p) => [p.id, p.nome]));

    let queryAtiv = this.cliente
      .from('atividades')
      .select('id, oferta_id, periodo_id, status')
      .in('oferta_id', ofIds)
      .in('status', ['publicada', 'encerrada'])
      .is('deleted_at', null);

    if (periodoFinalId) {
      queryAtiv = queryAtiv.eq('periodo_id', periodoFinalId);
    }

    const { data: ativData, error: erroAtiv } = await queryAtiv;
    if (erroAtiv) {
      throw new Error('Não foi possível carregar as atividades.');
    }
    const ativs = ativData || [];
    const ativIds = ativs.map((a) => a.id);

    let questoes: Array<{ id: string; atividade_id: string; tipo: TipoQuestao }> = [];
    let respostasDoAluno: Array<{ id: string; aluno_id: string; questao_id: string; acertou: boolean | null; pontuacao: number | null; correcao: any }> = [];

    if (ativIds.length > 0) {
      questoes = await lerTudoPorIds<(typeof questoes)[number]>(
        ativIds,
        (bloco) =>
          this.cliente.from('questoes').select('id, atividade_id, tipo').in('atividade_id', bloco).is('deleted_at', null),
        'Não foi possível carregar as questões.'
      );

      const qIds = questoes.map((q) => q.id);
      respostasDoAluno = await lerTudoPorIds<(typeof respostasDoAluno)[number]>(
        qIds,
        (bloco) =>
          this.cliente
            .from('respostas')
            .select('id, aluno_id, questao_id, acertou, pontuacao, correcao')
            .eq('aluno_id', alunoId)
            .in('questao_id', bloco),
        'Não foi possível carregar as respostas.'
      );
    }

    const resultado: DesempenhoAlunoMateriaItem[] = [];

    for (const ofItem of ofertasTurma) {
      const discNome = mapaDisciplinas.get(ofItem.disciplina_id) || 'Disciplina';
      const profNome = mapaProfessores.get(ofItem.professor_id) || 'Professor(a)';
      const ativsDaOferta = ativs.filter((a) => a.oferta_id === ofItem.id);

      const { media, atividades_avaliadas, soma_acertos, soma_questoes } = mediaDoAlunoNasAtividades(
        ativsDaOferta,
        questoes as unknown as Questao[],
        respostasDoAluno as unknown as Resposta[]
      );
      const faixa = faixaDesempenho(media);

      resultado.push({
        disciplina_id: ofItem.disciplina_id,
        disciplina_nome: discNome,
        professor_nome: profNome,
        oferta_id: ofItem.id,
        media,
        faixa,
        total_atividades: ativsDaOferta.length,
        atividades_concluidas: atividades_avaliadas,
        soma_acertos,
        soma_questoes,
      });
    }

    return resultado;
  }
}

export const criarSupabaseProfessorService = (
  cliente: SupabaseClient = clientePadrao
): ProfessorService => new SupabaseProfessorService(cliente);
