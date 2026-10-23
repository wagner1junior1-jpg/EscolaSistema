/**
 * SaberPontual — ProfessorService Supabase (Fase 5.3 do plano do back end)
 *
 * Implementação real dos fluxos pedagógicos docentes no Supabase:
 * - Minhas ofertas de disciplinas
 * - Atividades (criação, edição, exclusão lógica, publicação, encerramento, duplicação)
 * - Questões e alternativas (salvar com upsert seguro, reordenar, exclusão lógica)
 * - Recados da turma (avisos com turma_id)
 * - Observações de alunos (gravação com nome do professor, exclusão lógica)
 *
 * Regras:
 * - escola_id, criado_por e autor vêm sempre da sessão/RLS, nunca de parâmetros da tela.
 * - Toda chamada verifica { error } do Supabase e converte em Error com mensagem em PT-BR.
 * - Exclusão lógica com deleted_at; consultas ativas sempre filtram deleted_at IS NULL.
 * - Alternativas não têm deleted_at: apagam-se junto da questão ou por questao_id.
 * - Métodos das Fases 5.4 e 5.5 lançam "ProfessorService.<nome> será feito na 5.4/5.5".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import {
  ProfessorService,
  NovaQuestaoPayload,
  ItemCorrecaoFeita,
  ItemCorrecaoPendente,
} from '../contracts';
import {
  Atividade,
  AtividadeCompleta,
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
  FichaAluno,
  AlunoComDesempenhoResumo,
  DesempenhoAlunoMateriaItem,
} from '@/lib/types';
import { calcularMapaDeCalorQuestao, pontuacaoDaResposta } from '../calculos';

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

export class SupabaseProfessorService implements ProfessorService {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  /**
   * Obtém os dados de sessão do usuário logado e valida se seu perfil está ativo.
   */
  private async obterContextoSessao(): Promise<ContextoSessao> {
    const { data: sessao, error: erroSessao } = await this.cliente.auth.getSession();
    if (erroSessao || !sessao?.session?.user) {
      throw new Error('Sessão expirada. Entre novamente.');
    }
    const userId = sessao.session.user.id;
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
  }

  /**
   * Valida acesso de leitura sobre uma oferta (professor dono, direção ou coordenação).
   */
  private async validarAcessoLeituraOferta(ofertaId: string): Promise<ContextoSessao> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor' && sessao.papel !== 'direcao' && sessao.papel !== 'coordenacao') {
      throw new Error('Você não tem permissão para esta ação.');
    }

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

    const { data: oferta, error: erroOferta } = await this.cliente
      .from('ofertas')
      .select('id, professor_id, turma_id')
      .eq('id', atividade.oferta_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroOferta) {
      throw new Error('Não foi possível verificar a oferta da atividade.');
    }
    if (!oferta) {
      throw new Error('Oferta associada à atividade não encontrada.');
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

      const { data: respostasData, error: erroRespostas } = await this.cliente
        .from('respostas')
        .select('id, aluno_id, questao_id, alternativa_id, acertou, pontuacao, texto_resposta, correcao, comentario_professor, corrigido_por, corrigido_em, respondida_em, tentativas, acertou_final, updated_at')
        .in('questao_id', questaoIds);

      if (erroRespostas) {
        throw new Error('Não foi possível carregar as respostas para o mapa de calor.');
      }

      respostas = (respostasData || []).map((r) => ({
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

    const { data: respostasData, error: erroRespostas } = await this.cliente
      .from('respostas')
      .select('id, aluno_id, questao_id, texto_resposta, respondida_em')
      .in('questao_id', questaoIds)
      .eq('correcao', 'pendente')
      .order('respondida_em', { ascending: true });

    if (erroRespostas) {
      throw new Error('Não foi possível listar as correções pendentes.');
    }

    const respostas = respostasData || [];
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

    const { data: respostasData, error: erroRespostas } = await this.cliente
      .from('respostas')
      .select('id, aluno_id, questao_id, texto_resposta, correcao, pontuacao, comentario_professor, corrigido_em, respondida_em')
      .in('questao_id', questaoIds)
      .neq('correcao', 'pendente')
      .not('correcao', 'is', null);

    if (erroRespostas) {
      throw new Error('Não foi possível listar as correções feitas.');
    }

    const respostas = (respostasData || []).filter(
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
  // 7. Métodos da Fase 5.5 (Não implementados nesta etapa)
  // ---------------------------------------------------------------------------

  async desempenhoOferta(_ofertaId: string, _periodoId: string): Promise<RelatorioDesempenhoOferta> {
    throw new Error('ProfessorService.desempenhoOferta será feito na 5.5');
  }

  async fichaAluno(_ofertaIdOuAlunoId: string, _alunoId?: string): Promise<FichaAluno> {
    throw new Error('ProfessorService.fichaAluno será feito na 5.5');
  }

  async listarAlunosPorSerie(_serie: string): Promise<AlunoComDesempenhoResumo[]> {
    throw new Error('ProfessorService.listarAlunosPorSerie será feito na 5.5');
  }

  async desempenhoAlunoPorMaterias(
    _alunoId: string,
    _periodoId?: string
  ): Promise<DesempenhoAlunoMateriaItem[]> {
    throw new Error('ProfessorService.desempenhoAlunoPorMaterias será feito na 5.5');
  }
}

export const criarSupabaseProfessorService = (
  cliente: SupabaseClient = clientePadrao
): ProfessorService => new SupabaseProfessorService(cliente);
