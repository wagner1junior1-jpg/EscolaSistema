/**
 * SaberPontual — BancoService Supabase (Fase 5.6 do plano do back end)
 *
 * Implementação real do Banco de Questões da escola no Supabase:
 * - Gestão de assuntos / submatérias por disciplina
 * - Combinações ativas de matéria + série (docente e gestão)
 * - Listagem do banco com filtros e paginação segura (limite de 1000 linhas do PostgREST)
 * - Criação, edição, duplicação e arquivamento de questões e alternativas
 * - Adição e sorteio de questões do banco para atividades com controle de concorrência e rollback
 *
 * Regras:
 * - escola_id e criado_por vêm da sessão/RLS, nunca de parâmetros da tela.
 * - Toda chamada verifica { error } do Supabase e converte em Error com mensagem em PT-BR.
 * - Exclusão lógica com deleted_at; consultas ativas sempre filtram deleted_at IS NULL.
 * - arquivarQuestaoBanco usa a coluna arquivada (não deleted_at).
 * - PostgREST corta em 1000 linhas: usa paginação (.range()) em laço e lerTudoPorIds.
 * - Operações multi-tabela utilizam rollback compensatório para evitar questões órfãs sem alternativas.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import { CacheCurto } from './cacheCurto';
import {
  ServicoBanco,
  SalvarBancoQuestaoPayload,
  FiltrosBanco,
  CombinacaoProfessor,
} from '../contracts';
import {
  Assunto,
  BancoQuestao,
  BancoAlternativa,
  LetraAlternativa,
  DificuldadeQuestao,
  TipoQuestao,
  OrigemQuestao,
} from '@/lib/types';
import { lerTudoPorIds, TAMANHO_PAGINA } from './paginacao';
import { embaralhar } from '../sorteio';

const LETRAS_PADRAO: LetraAlternativa[] = ['A', 'B', 'C', 'D', 'E'];

/** Código do Postgres para violação de índice único. */
const ERRO_UNICO = '23505';

/** Quando o desfazer compensatório também falha, o usuário precisa saber que ficou lixo no banco. */
const MSG_BANCO_INCOMPLETO =
  'Não foi possível concluir a operação e o desfazer também falhou: uma questão pode ter ficado incompleta no banco. Avise a coordenação.';
const MSG_ATIVIDADE_INCOMPLETA =
  'Não foi possível concluir a operação e o desfazer também falhou: a atividade pode ter ficado com questões incompletas. Confira as questões antes de publicar.';

interface ContextoSessao {
  id: string;
  escola_id: string;
  papel: string;
  nome: string;
}

interface LinhaBancoQuestao {
  id: string;
  created_at: string;
  escola_id: string;
  disciplina_id: string;
  assunto_id: string;
  criado_por: string;
  serie: string;
  tipo: TipoQuestao;
  dificuldade: DificuldadeQuestao;
  enunciado: string;
  imagem_url: string | null;
  dica: string | null;
  explicacao: string | null;
  resposta_esperada: string | null;
  origem: OrigemQuestao;
  arquivada: boolean;
}

interface LinhaQuestaoParaAtividade {
  id: string;
  disciplina_id: string;
  serie: string;
  assunto_id: string;
  tipo: TipoQuestao;
  dificuldade: DificuldadeQuestao;
  enunciado: string;
  imagem_url: string | null;
  dica: string | null;
  explicacao: string | null;
  resposta_esperada: string | null;
  arquivada: boolean;
}

interface LinhaBancoAlternativa {
  id: string;
  updated_at: string;
  banco_questao_id: string;
  letra: LetraAlternativa;
  texto: string;
  correta: boolean;
  por_que_errou: string | null;
}

export class SupabaseBancoService implements ServicoBanco {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  // Leitura repetida a cada método (ver cacheCurto.ts). A RLS do banco continua valendo.
  private readonly cacheContexto = new CacheCurto<ContextoSessao>(30_000);

  /**
   * Obtém a sessão autenticada e o perfil ativo.
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

  /**
   * Roda um passo de desfazer (compensação) e diz se funcionou. Nunca lança: quem chama decide a mensagem.
   */
  private async desfazer(operacao: PromiseLike<{ error: unknown }>): Promise<boolean> {
    try {
      const { error } = await operacao;
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Obtém o ano letivo atual da escola (padrão 2026).
   */
  private async obterAnoLetivoAtual(escolaId: string): Promise<number> {
    const { data: escolaData, error } = await this.cliente
      .from('escolas')
      .select('ano_letivo_atual')
      .eq('id', escolaId)
      .maybeSingle();

    if (error || !escolaData) {
      return 2026;
    }
    return escolaData.ano_letivo_atual || 2026;
  }

  /**
   * Valida se um professor leciona a disciplina informada.
   */
  private async professorLecionaDisciplina(
    professorId: string,
    disciplinaId: string
  ): Promise<boolean> {
    const { data: ofertas, error } = await this.cliente
      .from('ofertas')
      .select('id')
      .eq('professor_id', professorId)
      .eq('disciplina_id', disciplinaId)
      .is('deleted_at', null)
      .limit(1);

    if (error || !ofertas || ofertas.length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Valida se o professor leciona a matéria e série específicas no ano letivo atual.
   */
  private async professorLecionaMateriaESerie(
    professorId: string,
    disciplinaId: string,
    serie: string,
    anoAtual: number
  ): Promise<boolean> {
    const { data: ofertas, error: erroOfertas } = await this.cliente
      .from('ofertas')
      .select('id, turma_id')
      .eq('professor_id', professorId)
      .eq('disciplina_id', disciplinaId)
      .is('deleted_at', null);

    if (erroOfertas || !ofertas || ofertas.length === 0) {
      return false;
    }

    const turmaIds = ofertas.map((o) => o.turma_id);
    const { data: turmas, error: erroTurmas } = await this.cliente
      .from('turmas')
      .select('id, serie, ativa, ano_letivo')
      .in('id', turmaIds)
      .eq('ativa', true)
      .eq('ano_letivo', anoAtual)
      .is('deleted_at', null);

    if (erroTurmas || !turmas || turmas.length === 0) {
      return false;
    }

    return turmas.some((t) => t.serie === serie);
  }

  // ---------------------------------------------------------------------------
  // 1. Assuntos
  // ---------------------------------------------------------------------------

  async listarAssuntos(disciplinaId: string): Promise<Assunto[]> {
    const sessao = await this.obterContextoSessao();

    const { data, error } = await this.cliente
      .from('assuntos')
      .select('id, created_at, escola_id, disciplina_id, nome')
      .eq('escola_id', sessao.escola_id)
      .eq('disciplina_id', disciplinaId)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) {
      throw new Error('Não foi possível listar os assuntos.');
    }

    return (data || []) as Assunto[];
  }

  async criarAssunto(disciplinaId: string, nome: string): Promise<Assunto> {
    const sessao = await this.obterContextoSessao();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      throw new Error('O nome do assunto não pode ficar vazio.');
    }

    if (sessao.papel === 'professor') {
      const leciona = await this.professorLecionaDisciplina(sessao.id, disciplinaId);
      if (!leciona) {
        throw new Error('Você não leciona esta disciplina.');
      }
    }

    // Unicidade de nome por disciplina (case-insensitive)
    const { data: existentes, error: erroExistentes } = await this.cliente
      .from('assuntos')
      .select('id, nome')
      .eq('escola_id', sessao.escola_id)
      .eq('disciplina_id', disciplinaId)
      .is('deleted_at', null);

    if (erroExistentes) {
      throw new Error('Não foi possível verificar a unicidade do assunto.');
    }

    const listaExistentes = Array.isArray(existentes) ? existentes : [];
    const jaExiste = listaExistentes.some(
      (a) => a.nome.toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (jaExiste) {
      throw new Error('Já existe um assunto com este nome para esta disciplina.');
    }

    const { data, error } = await this.cliente
      .from('assuntos')
      .insert({
        escola_id: sessao.escola_id,
        disciplina_id: disciplinaId,
        nome: nomeLimpo,
      })
      .select('id, created_at, escola_id, disciplina_id, nome')
      .single();

    if (error) {
      if (error.code === ERRO_UNICO) {
        // O índice único (disciplina_id, nome) também vale para assuntos excluídos: reativa o antigo.
        return this.reativarAssuntoExcluido(sessao.escola_id, disciplinaId, nomeLimpo);
      }
      throw new Error('Não foi possível criar o assunto.');
    }

    return data as Assunto;
  }

  /** Reativa um assunto excluído com o mesmo nome (a exclusão é lógica e o nome continua reservado). */
  private async reativarAssuntoExcluido(
    escolaId: string,
    disciplinaId: string,
    nome: string
  ): Promise<Assunto> {
    const { data, error } = await this.cliente
      .from('assuntos')
      .update({ deleted_at: null })
      .eq('escola_id', escolaId)
      .eq('disciplina_id', disciplinaId)
      .eq('nome', nome)
      .not('deleted_at', 'is', null)
      .select('id, created_at, escola_id, disciplina_id, nome');

    if (error || !data || data.length === 0) {
      throw new Error('Já existe um assunto com este nome para esta disciplina.');
    }
    return data[0] as Assunto;
  }

  async renomearAssunto(assuntoId: string, novoNome: string): Promise<Assunto> {
    const sessao = await this.obterContextoSessao();
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) {
      throw new Error('O nome da submatéria não pode ficar vazio.');
    }

    const { data: assunto, error: erroAssunto } = await this.cliente
      .from('assuntos')
      .select('id, disciplina_id, escola_id')
      .eq('id', assuntoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAssunto) {
      throw new Error('Não foi possível verificar a submatéria.');
    }
    if (!assunto) {
      throw new Error('Submatéria não encontrada.');
    }

    if (sessao.papel === 'professor') {
      const leciona = await this.professorLecionaDisciplina(sessao.id, assunto.disciplina_id);
      if (!leciona) {
        throw new Error('Você não tem permissão para alterar submatérias desta disciplina.');
      }
    }

    // Unicidade case-insensitive
    const { data: existentes, error: erroExistentes } = await this.cliente
      .from('assuntos')
      .select('id, nome')
      .eq('escola_id', sessao.escola_id)
      .eq('disciplina_id', assunto.disciplina_id)
      .neq('id', assuntoId)
      .is('deleted_at', null);

    if (erroExistentes) {
      throw new Error('Não foi possível verificar a unicidade da submatéria.');
    }

    const listaExistentes = Array.isArray(existentes) ? existentes : [];
    const jaExiste = listaExistentes.some(
      (a) => a.nome.toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (jaExiste) {
      throw new Error('Já existe uma submatéria com este nome nesta disciplina.');
    }

    const { data, error } = await this.cliente
      .from('assuntos')
      .update({ nome: nomeLimpo })
      .eq('id', assuntoId)
      .select('id, created_at, escola_id, disciplina_id, nome')
      .single();

    if (error) {
      if (error.code === ERRO_UNICO) {
        throw new Error('Já existe uma submatéria com este nome nesta disciplina (ou ela foi excluída com esse nome).');
      }
      throw new Error('Não foi possível renomear a submatéria.');
    }

    return data as Assunto;
  }

  async excluirAssunto(assuntoId: string): Promise<void> {
    const sessao = await this.obterContextoSessao();

    const { data: assunto, error: erroAssunto } = await this.cliente
      .from('assuntos')
      .select('id, disciplina_id')
      .eq('id', assuntoId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAssunto) {
      throw new Error('Não foi possível verificar a submatéria.');
    }
    if (!assunto) {
      throw new Error('Submatéria não encontrada.');
    }

    if (sessao.papel === 'professor') {
      const leciona = await this.professorLecionaDisciplina(sessao.id, assunto.disciplina_id);
      if (!leciona) {
        throw new Error('Você não tem permissão para excluir submatérias desta disciplina.');
      }
    }

    // Verifica se existem questões vinculadas no banco de questões
    const { count: qtdNoBanco, error: erroBanco } = await this.cliente
      .from('banco_questoes')
      .select('id', { count: 'exact', head: true })
      .eq('assunto_id', assuntoId)
      .eq('arquivada', false)
      .is('deleted_at', null);

    if (erroBanco) {
      throw new Error('Não foi possível verificar vínculos no banco de questões.');
    }
    if (qtdNoBanco && qtdNoBanco > 0) {
      throw new Error(
        `Não é possível excluir esta submatéria pois existem ${qtdNoBanco} questão(ões) vinculada(s) no Banco.`
      );
    }

    // Verifica se existem questões vinculadas nas atividades
    const { count: qtdEmAtividades, error: erroAtiv } = await this.cliente
      .from('questoes')
      .select('id', { count: 'exact', head: true })
      .eq('assunto_id', assuntoId)
      .is('deleted_at', null);

    if (erroAtiv) {
      throw new Error('Não foi possível verificar vínculos em atividades.');
    }
    if (qtdEmAtividades && qtdEmAtividades > 0) {
      throw new Error(
        'Não é possível excluir esta submatéria pois ela está vinculada a questões de atividades.'
      );
    }

    const { error: erroDelete } = await this.cliente
      .from('assuntos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', assuntoId);

    if (erroDelete) {
      throw new Error('Não foi possível excluir a submatéria.');
    }
  }

  async contarQuestoesPorAssunto(disciplinaId: string): Promise<Record<string, number>> {
    const sessao = await this.obterContextoSessao();
    const contagem: Record<string, number> = {};

    // PostgREST corta em 1000 linhas: paginação em laço para ler todas as questões
    const questoes: Array<{ id: string; assunto_id: string }> = [];
    for (let de = 0; ; de += TAMANHO_PAGINA) {
      const { data, error } = await this.cliente
        .from('banco_questoes')
        .select('id, assunto_id')
        .eq('escola_id', sessao.escola_id)
        .eq('disciplina_id', disciplinaId)
        .eq('arquivada', false)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(de, de + TAMANHO_PAGINA - 1);

      if (error) {
        throw new Error('Não foi possível contar as questões por assunto.');
      }
      const linhas = (data ?? []) as Array<{ id: string; assunto_id: string }>;
      questoes.push(...linhas);
      if (linhas.length < TAMANHO_PAGINA) {
        break;
      }
    }

    for (const q of questoes) {
      if (q.assunto_id) {
        contagem[q.assunto_id] = (contagem[q.assunto_id] || 0) + 1;
      }
    }

    return contagem;
  }

  // ---------------------------------------------------------------------------
  // 2. Consulta de Combinações de Matéria + Série
  // ---------------------------------------------------------------------------

  async listarCombinacoesDoProfessor(): Promise<CombinacaoProfessor[]> {
    const sessao = await this.obterContextoSessao();
    const anoAtual = await this.obterAnoLetivoAtual(sessao.escola_id);

    // Gestão: todas as combinações cadastradas de turmas ativas do ano atual
    if (sessao.papel === 'direcao' || sessao.papel === 'coordenacao') {
      const { data: turmasData, error: erroTurmas } = await this.cliente
        .from('turmas')
        .select('id, serie, ativa, ano_letivo')
        .eq('escola_id', sessao.escola_id)
        .eq('ativa', true)
        .eq('ano_letivo', anoAtual)
        .is('deleted_at', null);

      if (erroTurmas) {
        throw new Error('Não foi possível carregar as turmas.');
      }

      const { data: discData, error: erroDisc } = await this.cliente
        .from('disciplinas')
        .select('id, nome')
        .eq('escola_id', sessao.escola_id)
        .is('deleted_at', null);

      if (erroDisc) {
        throw new Error('Não foi possível carregar as disciplinas.');
      }

      const turmas = turmasData || [];
      const disciplinas = discData || [];
      const mapa = new Map<string, CombinacaoProfessor>();

      for (const disc of disciplinas) {
        for (const turma of turmas) {
          const chave = `${disc.id}__${turma.serie}`;
          if (!mapa.has(chave)) {
            mapa.set(chave, {
              disciplina_id: disc.id,
              disciplina_nome: disc.nome,
              serie: turma.serie,
              label: `${disc.nome} · ${turma.serie}`,
            });
          }
        }
      }

      return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    // Professor: apenas as combinações das suas ofertas ativas no ano atual
    const { data: ofertasData, error: erroOfertas } = await this.cliente
      .from('ofertas')
      .select('id, turma_id, disciplina_id')
      .eq('professor_id', sessao.id)
      .is('deleted_at', null);

    if (erroOfertas) {
      throw new Error('Não foi possível carregar as ofertas do professor.');
    }

    const ofertas = ofertasData || [];
    if (ofertas.length === 0) {
      return [];
    }

    const turmaIds = [...new Set(ofertas.map((o) => o.turma_id))];
    const discIds = [...new Set(ofertas.map((o) => o.disciplina_id))];

    const { data: turmasData, error: erroTurmas } = await this.cliente
      .from('turmas')
      .select('id, serie, ativa, ano_letivo')
      .in('id', turmaIds)
      .eq('ativa', true)
      .eq('ano_letivo', anoAtual)
      .is('deleted_at', null);

    if (erroTurmas) {
      throw new Error('Não foi possível carregar as turmas.');
    }

    const { data: discData, error: erroDisc } = await this.cliente
      .from('disciplinas')
      .select('id, nome')
      .in('id', discIds)
      .is('deleted_at', null);

    if (erroDisc) {
      throw new Error('Não foi possível carregar as disciplinas.');
    }

    const mapaTurmas = new Map((turmasData || []).map((t) => [t.id, t.serie]));
    const mapaDisciplinas = new Map((discData || []).map((d) => [d.id, d.nome]));
    const mapaCombinacoes = new Map<string, CombinacaoProfessor>();

    for (const ofItem of ofertas) {
      const serie = mapaTurmas.get(ofItem.turma_id);
      const disciplinaNome = mapaDisciplinas.get(ofItem.disciplina_id);
      if (!serie || !disciplinaNome) continue;

      const chave = `${ofItem.disciplina_id}__${serie}`;
      if (!mapaCombinacoes.has(chave)) {
        mapaCombinacoes.set(chave, {
          disciplina_id: ofItem.disciplina_id,
          disciplina_nome: disciplinaNome,
          serie,
          label: `${disciplinaNome} · ${serie}`,
        });
      }
    }

    return Array.from(mapaCombinacoes.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  // ---------------------------------------------------------------------------
  // 3. Listagem do Banco
  // ---------------------------------------------------------------------------

  async listarBanco(filtros: FiltrosBanco): Promise<BancoQuestao[]> {
    const sessao = await this.obterContextoSessao();
    const anoAtual = await this.obterAnoLetivoAtual(sessao.escola_id);

    if (sessao.papel === 'professor') {
      const leciona = await this.professorLecionaMateriaESerie(
        sessao.id,
        filtros.disciplina_id,
        filtros.serie,
        anoAtual
      );
      if (!leciona) {
        throw new Error('Você não tem permissão para acessar questões desta matéria e série.');
      }
    }

    // Leitura paginada com .range() para ultrapassar com segurança o teto de 1000 linhas
    const questoesLinhas: LinhaBancoQuestao[] = [];
    for (let de = 0; ; de += TAMANHO_PAGINA) {
      let query = this.cliente
        .from('banco_questoes')
        .select('id, created_at, escola_id, disciplina_id, assunto_id, criado_por, serie, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, origem, arquivada')
        .eq('escola_id', sessao.escola_id)
        .eq('disciplina_id', filtros.disciplina_id)
        .eq('arquivada', false)
        .is('deleted_at', null);

      if (filtros.serie) {
        query = query.eq('serie', filtros.serie);
      }
      if (filtros.assunto_id) {
        query = query.eq('assunto_id', filtros.assunto_id);
      }
      if (filtros.dificuldade) {
        query = query.eq('dificuldade', filtros.dificuldade);
      }
      if (filtros.escopo === 'minhas') {
        query = query.eq('criado_por', sessao.id);
      }
      if (filtros.tipo) {
        query = query.eq('tipo', filtros.tipo);
      }
      if (filtros.origem) {
        query = query.eq('origem', filtros.origem);
      }

      const { data, error } = await query
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(de, de + TAMANHO_PAGINA - 1);

      if (error) {
        throw new Error('Não foi possível listar as questões do banco.');
      }

      const linhas = (data ?? []) as LinhaBancoQuestao[];
      questoesLinhas.push(...linhas);
      if (linhas.length < TAMANHO_PAGINA) {
        break;
      }
    }

    if (questoesLinhas.length === 0) {
      return [];
    }

    const qIds = questoesLinhas.map((q) => q.id);

    // Carrega alternativas em blocos estáveis usando lerTudoPorIds (chunks de 100 com paginação)
    const alternativas = await lerTudoPorIds<LinhaBancoAlternativa>(
      qIds,
      (bloco) =>
        this.cliente
          .from('banco_alternativas')
          .select('id, updated_at, banco_questao_id, letra, texto, correta, por_que_errou')
          .in('banco_questao_id', bloco),
      'Não foi possível carregar as alternativas das questões do banco.'
    );

    const altsPorQuestao = new Map<string, BancoAlternativa[]>();
    for (const alt of alternativas) {
      const lista = altsPorQuestao.get(alt.banco_questao_id) || [];
      lista.push({
        id: alt.id,
        created_at: alt.updated_at,
        banco_questao_id: alt.banco_questao_id,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        por_que_errou: alt.por_que_errou,
      });
      altsPorQuestao.set(alt.banco_questao_id, lista);
    }

    // Assuntos, disciplina e autores
    const assuntoIds = [...new Set(questoesLinhas.map((q) => q.assunto_id).filter(Boolean))];
    const criadoPorIds = [...new Set(questoesLinhas.map((q) => q.criado_por).filter(Boolean))];

    const mapaAssuntos = new Map<string, string>();
    if (assuntoIds.length > 0) {
      const assuntos = await lerTudoPorIds<{ id: string; nome: string }>(
        assuntoIds,
        (bloco) =>
          this.cliente
            .from('assuntos')
            .select('id, nome')
            .in('id', bloco),
        'Não foi possível carregar os nomes dos assuntos.'
      );
      for (const a of assuntos) {
        mapaAssuntos.set(a.id, a.nome);
      }
    }

    const { data: discData, error: erroDisc } = await this.cliente
      .from('disciplinas')
      .select('id, nome')
      .eq('id', filtros.disciplina_id)
      .maybeSingle();

    if (erroDisc) {
      throw new Error('Não foi possível carregar os dados da disciplina.');
    }
    const disciplinaNome = discData?.nome || '';

    const mapaAutores = new Map<string, string>();
    if (criadoPorIds.length > 0) {
      const perfis = await lerTudoPorIds<{ id: string; nome: string }>(
        criadoPorIds,
        (bloco) =>
          this.cliente
            .from('perfis')
            .select('id, nome')
            .in('id', bloco),
        'Não foi possível carregar os nomes dos autores.'
      );
      for (const p of perfis) {
        mapaAutores.set(p.id, p.nome);
      }
    }

    return questoesLinhas.map((q) => {
      const alts = (altsPorQuestao.get(q.id) || []).sort((a, b) => a.letra.localeCompare(b.letra));
      return {
        id: q.id,
        created_at: q.created_at,
        escola_id: q.escola_id,
        disciplina_id: q.disciplina_id,
        assunto_id: q.assunto_id,
        criado_por: q.criado_por,
        serie: q.serie,
        tipo: q.tipo,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        imagem_url: q.imagem_url,
        dica: q.dica,
        explicacao: q.explicacao,
        resposta_esperada: q.resposta_esperada,
        origem: q.origem,
        arquivada: q.arquivada,
        alternativas: alts,
        autor_nome: mapaAutores.get(q.criado_por) || 'Professor(a)',
        assunto_nome: mapaAssuntos.get(q.assunto_id) || '',
        disciplina_nome: disciplinaNome,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Salvar Questão (Criar ou Editar)
  // ---------------------------------------------------------------------------

  async salvarQuestaoBanco(dados: SalvarBancoQuestaoPayload): Promise<BancoQuestao> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não pode criar ou editar questões para matérias/séries que não leciona.');
    }

    const anoAtual = await this.obterAnoLetivoAtual(sessao.escola_id);

    const leciona = await this.professorLecionaMateriaESerie(
      sessao.id,
      dados.disciplina_id,
      dados.serie,
      anoAtual
    );
    if (!leciona) {
      throw new Error('Você não pode criar ou editar questões para matérias/séries que não leciona.');
    }

    if (!dados.enunciado || !dados.enunciado.trim()) {
      throw new Error('O enunciado da questão não pode ficar vazio.');
    }

    const tipoQuestao = dados.tipo || 'objetiva';

    if (tipoQuestao === 'discursiva') {
      if (!dados.resposta_esperada || !dados.resposta_esperada.trim()) {
        throw new Error('A resposta esperada (gabarito do professor) é obrigatória para questões discursivas.');
      }
    } else {
      if (!dados.alternativas || dados.alternativas.length < 2 || dados.alternativas.length > 5) {
        throw new Error('A questão deve conter entre 2 e 5 alternativas.');
      }

      const corretas = dados.alternativas.filter((a) => a.correta);
      if (corretas.length !== 1) {
        throw new Error('A questão deve ter exatamente 1 alternativa correta marcada.');
      }

      for (let i = 0; i < dados.alternativas.length; i++) {
        const alt = dados.alternativas[i];
        if (!alt.texto || !alt.texto.trim()) {
          throw new Error(`O texto da alternativa ${LETRAS_PADRAO[i]} não pode ficar vazio.`);
        }
        if (!alt.correta && (!alt.por_que_errou || !alt.por_que_errou.trim())) {
          throw new Error(
            `A alternativa ${LETRAS_PADRAO[i]} (incorreta) deve conter a explicação do erro (por que errou).`
          );
        }
      }
    }

    // Edição
    if (dados.id) {
      const { data: questaoExistente, error: erroConsulta } = await this.cliente
        .from('banco_questoes')
        .select('id, criado_por, arquivada, imagem_url')
        .eq('id', dados.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (erroConsulta) {
        throw new Error('Não foi possível carregar a questão do banco.');
      }
      if (!questaoExistente) {
        throw new Error('Questão não encontrada no banco.');
      }
      if (questaoExistente.arquivada) {
        throw new Error('Esta questão está arquivada e não pode ser editada.');
      }
      if (questaoExistente.criado_por !== sessao.id) {
        throw new Error('Apenas o autor pode editar esta questão. Use "Duplicar para editar".');
      }

      // Salva alternativas antigas para possibilitar reversão caso a inserção das novas falhe
      const { data: altsAntigas, error: erroAltsAntigas } = await this.cliente
        .from('banco_alternativas')
        .select('letra, texto, correta, por_que_errou')
        .eq('banco_questao_id', dados.id);

      if (erroAltsAntigas) {
        throw new Error('Não foi possível carregar as alternativas atuais da questão.');
      }

      // Atualiza os dados da questão
      const payloadUpdate = {
        enunciado: dados.enunciado.trim(),
        assunto_id: dados.assunto_id,
        dificuldade: dados.dificuldade,
        tipo: tipoQuestao,
        resposta_esperada: dados.resposta_esperada ? dados.resposta_esperada.trim() : null,
        imagem_url: dados.imagem_url || questaoExistente.imagem_url || null,
        dica: dados.dica ? dados.dica.trim() : null,
        explicacao: dados.explicacao ? dados.explicacao.trim() : null,
      };

      const { data: questaoAtualizada, error: erroUpdateQ } = await this.cliente
        .from('banco_questoes')
        .update(payloadUpdate)
        .eq('id', dados.id)
        .select('id, created_at, escola_id, disciplina_id, assunto_id, criado_por, serie, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, origem, arquivada')
        .single();

      if (erroUpdateQ) {
        throw new Error('Não foi possível atualizar a questão no banco.');
      }

      // Deleta alternativas antigas e recria
      const { error: erroDelAlts } = await this.cliente
        .from('banco_alternativas')
        .delete()
        .eq('banco_questao_id', dados.id);

      if (erroDelAlts) {
        throw new Error('Não foi possível atualizar as alternativas da questão.');
      }

      const novasAlternativas: BancoAlternativa[] = [];
      if (tipoQuestao === 'objetiva' && dados.alternativas) {
        const payloadAlts = dados.alternativas.map((alt, i) => ({
          banco_questao_id: dados.id!,
          letra: LETRAS_PADRAO[i],
          texto: alt.texto.trim(),
          correta: alt.correta,
          por_que_errou: alt.correta ? null : alt.por_que_errou?.trim() || null,
        }));

        const { data: altsCriadas, error: erroInsAlts } = await this.cliente
          .from('banco_alternativas')
          .insert(payloadAlts)
          .select('id, updated_at, banco_questao_id, letra, texto, correta, por_que_errou');

        if (erroInsAlts) {
          // Reversão compensatória: tenta restaurar as alternativas antigas
          // (o enunciado e demais campos já foram atualizados; só as alternativas voltam).
          let restauradas = true;
          if (altsAntigas && altsAntigas.length > 0) {
            restauradas = await this.desfazer(
              this.cliente
                .from('banco_alternativas')
                .insert(altsAntigas.map((a) => ({ ...a, banco_questao_id: dados.id! })))
            );
          }
          throw new Error(
            restauradas ? 'Não foi possível salvar as novas alternativas da questão.' : MSG_BANCO_INCOMPLETO
          );
        }

        novasAlternativas.push(
          ...(altsCriadas || []).map((a) => ({
            id: a.id,
            created_at: a.updated_at,
            banco_questao_id: a.banco_questao_id,
            letra: a.letra as LetraAlternativa,
            texto: a.texto,
            correta: a.correta,
            por_que_errou: a.por_que_errou,
          }))
        );
      }

      const { data: assuntoData } = await this.cliente
        .from('assuntos')
        .select('nome')
        .eq('id', questaoAtualizada.assunto_id)
        .maybeSingle();

      const { data: discData } = await this.cliente
        .from('disciplinas')
        .select('nome')
        .eq('id', questaoAtualizada.disciplina_id)
        .maybeSingle();

      return {
        ...questaoAtualizada,
        alternativas: novasAlternativas,
        autor_nome: sessao.nome,
        assunto_nome: assuntoData?.nome || '',
        disciplina_nome: discData?.nome || '',
      };
    }

    // Criação de nova questão
    const payloadInsert = {
      escola_id: sessao.escola_id,
      disciplina_id: dados.disciplina_id,
      assunto_id: dados.assunto_id,
      criado_por: sessao.id,
      serie: dados.serie,
      tipo: tipoQuestao,
      dificuldade: dados.dificuldade,
      enunciado: dados.enunciado.trim(),
      imagem_url: dados.imagem_url || null,
      dica: dados.dica ? dados.dica.trim() : null,
      explicacao: dados.explicacao ? dados.explicacao.trim() : null,
      resposta_esperada: dados.resposta_esperada ? dados.resposta_esperada.trim() : null,
      origem: dados.origem || 'manual',
      arquivada: false,
    };

    const { data: novaQuestao, error: erroInsertQ } = await this.cliente
      .from('banco_questoes')
      .insert(payloadInsert)
      .select('id, created_at, escola_id, disciplina_id, assunto_id, criado_por, serie, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, origem, arquivada')
      .single();

    if (erroInsertQ || !novaQuestao) {
      throw new Error('Não foi possível criar a questão no banco.');
    }

    const novasAlternativas: BancoAlternativa[] = [];
    if (tipoQuestao === 'objetiva' && dados.alternativas) {
      const payloadAlts = dados.alternativas.map((alt, i) => ({
        banco_questao_id: novaQuestao.id,
        letra: LETRAS_PADRAO[i],
        texto: alt.texto.trim(),
        correta: alt.correta,
        por_que_errou: alt.correta ? null : alt.por_que_errou?.trim() || null,
      }));

      const { data: altsCriadas, error: erroInsertAlts } = await this.cliente
        .from('banco_alternativas')
        .insert(payloadAlts)
        .select('id, updated_at, banco_questao_id, letra, texto, correta, por_que_errou');

      if (erroInsertAlts) {
        // Rollback compensatório: remove a questão criada para não deixar questão sem alternativas
        const desfeito = await this.desfazer(
          this.cliente.from('banco_questoes').delete().eq('id', novaQuestao.id)
        );
        throw new Error(desfeito ? 'Não foi possível salvar as alternativas da questão.' : MSG_BANCO_INCOMPLETO);
      }

      novasAlternativas.push(
        ...(altsCriadas || []).map((a) => ({
          id: a.id,
          created_at: a.updated_at,
          banco_questao_id: a.banco_questao_id,
          letra: a.letra as LetraAlternativa,
          texto: a.texto,
          correta: a.correta,
          por_que_errou: a.por_que_errou,
        }))
      );
    }

    const { data: assuntoData } = await this.cliente
      .from('assuntos')
      .select('nome')
      .eq('id', novaQuestao.assunto_id)
      .maybeSingle();

    const { data: discData } = await this.cliente
      .from('disciplinas')
      .select('nome')
      .eq('id', novaQuestao.disciplina_id)
      .maybeSingle();

    return {
      ...novaQuestao,
      alternativas: novasAlternativas,
      autor_nome: sessao.nome,
      assunto_nome: assuntoData?.nome || '',
      disciplina_nome: discData?.nome || '',
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Duplicar Questão
  // ---------------------------------------------------------------------------

  async duplicarQuestaoBanco(id: string): Promise<BancoQuestao> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não pode duplicar questões para matérias/séries que não leciona.');
    }

    const anoAtual = await this.obterAnoLetivoAtual(sessao.escola_id);

    const { data: questaoOrigem, error: erroOrigem } = await this.cliente
      .from('banco_questoes')
      .select('id, disciplina_id, assunto_id, serie, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroOrigem) {
      throw new Error('Não foi possível verificar a questão de origem.');
    }
    if (!questaoOrigem) {
      throw new Error('Questão não encontrada no banco.');
    }

    const leciona = await this.professorLecionaMateriaESerie(
      sessao.id,
      questaoOrigem.disciplina_id,
      questaoOrigem.serie,
      anoAtual
    );
    if (!leciona) {
      throw new Error('Você não pode duplicar questões para matérias/séries que não leciona.');
    }

    const { data: altsOrigem, error: erroAlts } = await this.cliente
      .from('banco_alternativas')
      .select('letra, texto, correta, por_que_errou')
      .eq('banco_questao_id', id)
      .order('letra', { ascending: true });

    if (erroAlts) {
      throw new Error('Não foi possível carregar as alternativas da questão.');
    }

    const payloadInsert = {
      escola_id: sessao.escola_id,
      disciplina_id: questaoOrigem.disciplina_id,
      assunto_id: questaoOrigem.assunto_id,
      criado_por: sessao.id,
      serie: questaoOrigem.serie,
      tipo: questaoOrigem.tipo,
      dificuldade: questaoOrigem.dificuldade,
      enunciado: questaoOrigem.enunciado,
      imagem_url: questaoOrigem.imagem_url,
      dica: questaoOrigem.dica,
      explicacao: questaoOrigem.explicacao,
      resposta_esperada: questaoOrigem.resposta_esperada,
      origem: 'manual',
      arquivada: false,
    };

    const { data: copiaQuestao, error: erroInsert } = await this.cliente
      .from('banco_questoes')
      .insert(payloadInsert)
      .select('id, created_at, escola_id, disciplina_id, assunto_id, criado_por, serie, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, origem, arquivada')
      .single();

    if (erroInsert || !copiaQuestao) {
      throw new Error('Não foi possível duplicar a questão.');
    }

    const novasAlternativas: BancoAlternativa[] = [];
    if (altsOrigem && altsOrigem.length > 0) {
      const payloadAlts = altsOrigem.map((alt) => ({
        banco_questao_id: copiaQuestao.id,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        por_que_errou: alt.por_que_errou,
      }));

      const { data: altsCriadas, error: erroInsertAlts } = await this.cliente
        .from('banco_alternativas')
        .insert(payloadAlts)
        .select('id, updated_at, banco_questao_id, letra, texto, correta, por_que_errou');

      if (erroInsertAlts) {
        // Rollback compensatório
        const desfeito = await this.desfazer(
          this.cliente.from('banco_questoes').delete().eq('id', copiaQuestao.id)
        );
        throw new Error(
          desfeito ? 'Não foi possível copiar as alternativas da questão duplicada.' : MSG_BANCO_INCOMPLETO
        );
      }

      novasAlternativas.push(
        ...(altsCriadas || []).map((a) => ({
          id: a.id,
          created_at: a.updated_at,
          banco_questao_id: a.banco_questao_id,
          letra: a.letra as LetraAlternativa,
          texto: a.texto,
          correta: a.correta,
          por_que_errou: a.por_que_errou,
        }))
      );
    }

    const { data: assuntoData } = await this.cliente
      .from('assuntos')
      .select('nome')
      .eq('id', copiaQuestao.assunto_id)
      .maybeSingle();

    const { data: discData } = await this.cliente
      .from('disciplinas')
      .select('nome')
      .eq('id', copiaQuestao.disciplina_id)
      .maybeSingle();

    return {
      ...copiaQuestao,
      alternativas: novasAlternativas,
      autor_nome: sessao.nome,
      assunto_nome: assuntoData?.nome || '',
      disciplina_nome: discData?.nome || '',
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Arquivar Questão
  // ---------------------------------------------------------------------------

  async arquivarQuestaoBanco(id: string): Promise<void> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: questao, error: erroQuestao } = await this.cliente
      .from('banco_questoes')
      .select('id, criado_por')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroQuestao) {
      throw new Error('Não foi possível verificar a questão.');
    }
    if (!questao) {
      throw new Error('Questão não encontrada no banco.');
    }
    if (questao.criado_por !== sessao.id) {
      throw new Error('Apenas o autor pode arquivar esta questão.');
    }

    // Regra: arquivarQuestaoBanco usa a coluna arquivada, NÃO deleted_at
    const { error } = await this.cliente
      .from('banco_questoes')
      .update({ arquivada: true })
      .eq('id', id);

    if (error) {
      throw new Error('Não foi possível arquivar a questão.');
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Adicionar do Banco para Atividade (Cópia mantendo imutabilidade)
  // ---------------------------------------------------------------------------

  async adicionarDoBanco(atividadeId: string, bancoIds: string[]): Promise<void> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: atividade, error: erroAtiv } = await this.cliente
      .from('atividades')
      .select('id, status, oferta_id')
      .eq('id', atividadeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAtiv) {
      throw new Error('Não foi possível verificar a atividade.');
    }
    if (!atividade) {
      throw new Error('Atividade não encontrada.');
    }
    if (atividade.status !== 'rascunho') {
      throw new Error('Não é permitido alterar questões de atividades publicadas ou encerradas.');
    }

    const { data: oferta, error: erroOferta } = await this.cliente
      .from('ofertas')
      .select('id, professor_id, turma_id, disciplina_id')
      .eq('id', atividade.oferta_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroOferta) {
      throw new Error('Não foi possível verificar a oferta da atividade.');
    }
    if (!oferta) {
      throw new Error('Oferta da atividade não encontrada.');
    }
    if (oferta.professor_id !== sessao.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: turma, error: erroTurma } = await this.cliente
      .from('turmas')
      .select('id, serie')
      .eq('id', oferta.turma_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroTurma) {
      throw new Error('Não foi possível verificar a turma da atividade.');
    }
    if (!turma) {
      throw new Error('Turma da atividade não encontrada.');
    }

    // Ordem atual mais alta
    const { data: questoesAtuais, error: erroQuestoesAtuais } = await this.cliente
      .from('questoes')
      .select('ordem')
      .eq('atividade_id', atividadeId)
      .is('deleted_at', null)
      .order('ordem', { ascending: false })
      .limit(1);

    if (erroQuestoesAtuais) {
      throw new Error('Não foi possível verificar a ordem das questões.');
    }

    let ordemAtual = (questoesAtuais && questoesAtuais.length > 0) ? questoesAtuais[0].ordem + 1 : 1;

    // Busca questões do banco selecionadas
    const questoesBancoLidas = await lerTudoPorIds<LinhaQuestaoParaAtividade>(
      bancoIds,
      (bloco) =>
        this.cliente
          .from('banco_questoes')
          .select('id, disciplina_id, serie, assunto_id, tipo, dificuldade, enunciado, imagem_url, dica, explicacao, resposta_esperada, arquivada')
          .in('id', bloco)
          .eq('arquivada', false)
          .is('deleted_at', null),
      'Não foi possível carregar as questões do banco.'
    );
    // Mantém a ordem pedida (a leitura em blocos ordena por id).
    const posicao = new Map(bancoIds.map((id, i) => [id, i]));
    const questoesBanco = questoesBancoLidas.sort(
      (a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0)
    );

    // Valida compatibilidade de matéria e série
    for (const bq of questoesBanco) {
      if (bq.disciplina_id !== oferta.disciplina_id || bq.serie !== turma.serie) {
        throw new Error('A questão do banco não pertence à mesma matéria e série desta atividade.');
      }
    }

    // Busca alternativas das questões do banco
    const qBancoIds = questoesBanco.map((q) => q.id);
    let alternativasBanco: LinhaBancoAlternativa[] = [];
    if (qBancoIds.length > 0) {
      alternativasBanco = await lerTudoPorIds<LinhaBancoAlternativa>(
        qBancoIds,
        (bloco) =>
          this.cliente
            .from('banco_alternativas')
            .select('id, updated_at, banco_questao_id, letra, texto, correta, por_que_errou')
            .in('banco_questao_id', bloco),
        'Não foi possível carregar as alternativas das questões do banco.'
      );
    }

    // Rastreia questões criadas nesta operação para viabilizar rollback se alguma etapa falhar
    const questoesCriadasIds: string[] = [];

    try {
      for (const bq of questoesBanco) {
        const payloadQuestao = {
          atividade_id: atividadeId,
          ordem: ordemAtual++,
          enunciado: bq.enunciado,
          dica: bq.dica,
          explicacao: bq.explicacao,
          banco_questao_id: bq.id,
          assunto_id: bq.assunto_id,
          tipo: bq.tipo || 'objetiva',
          dificuldade: bq.dificuldade,
          imagem_url: bq.imagem_url,
          resposta_esperada: bq.resposta_esperada,
        };

        const { data: novaQuestao, error: erroInsQ } = await this.cliente
          .from('questoes')
          .insert(payloadQuestao)
          .select('id')
          .single();

        if (erroInsQ || !novaQuestao) {
          throw new Error('Não foi possível adicionar a questão à atividade.');
        }

        questoesCriadasIds.push(novaQuestao.id);

        const altsDaQuestao = alternativasBanco
          .filter((a) => a.banco_questao_id === bq.id)
          .sort((a, b) => a.letra.localeCompare(b.letra));

        if (altsDaQuestao.length > 0) {
          const payloadAlts = altsDaQuestao.map((alt) => ({
            questao_id: novaQuestao.id,
            letra: alt.letra,
            texto: alt.texto,
            correta: alt.correta,
            por_que_errou: alt.por_que_errou,
          }));

          const { error: erroInsAlts } = await this.cliente
            .from('alternativas')
            .insert(payloadAlts);

          if (erroInsAlts) {
            throw new Error('Não foi possível adicionar as alternativas da questão.');
          }
        }
      }
    } catch (erro) {
      // Rollback compensatório das questões já inseridas (as alternativas saem junto, por cascata)
      if (questoesCriadasIds.length > 0) {
        const desfeito = await this.desfazer(
          this.cliente.from('questoes').delete().in('id', questoesCriadasIds)
        );
        if (!desfeito) throw new Error(MSG_ATIVIDADE_INCOMPLETA);
      }
      throw erro;
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Sortear do Banco para Atividade
  // ---------------------------------------------------------------------------

  async sortearDoBanco(
    atividadeId: string,
    assuntoId: string,
    quantidades: { facil: number; medio: number; dificil: number }
  ): Promise<{ adicionadas: number; aviso?: string }> {
    const sessao = await this.obterContextoSessao();
    if (sessao.papel !== 'professor') {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: atividade, error: erroAtiv } = await this.cliente
      .from('atividades')
      .select('id, status, oferta_id')
      .eq('id', atividadeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroAtiv) {
      throw new Error('Não foi possível verificar a atividade.');
    }
    if (!atividade) {
      throw new Error('Atividade não encontrada.');
    }
    if (atividade.status !== 'rascunho') {
      throw new Error('Não é permitido alterar questões de atividades publicadas ou encerradas.');
    }

    const { data: oferta, error: erroOferta } = await this.cliente
      .from('ofertas')
      .select('id, professor_id, turma_id, disciplina_id')
      .eq('id', atividade.oferta_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroOferta) {
      throw new Error('Não foi possível verificar a oferta da atividade.');
    }
    if (!oferta) {
      throw new Error('Oferta da atividade não encontrada.');
    }
    if (oferta.professor_id !== sessao.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const { data: turma, error: erroTurma } = await this.cliente
      .from('turmas')
      .select('id, serie')
      .eq('id', oferta.turma_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (erroTurma) {
      throw new Error('Não foi possível verificar a turma da atividade.');
    }
    if (!turma) {
      throw new Error('Turma da atividade não encontrada.');
    }

    // Pula questões que já foram adicionadas à atividade a partir do banco
    const { data: questoesAtuais, error: erroQuestoesAtuais } = await this.cliente
      .from('questoes')
      .select('banco_questao_id')
      .eq('atividade_id', atividadeId)
      .is('deleted_at', null);

    if (erroQuestoesAtuais) {
      throw new Error('Não foi possível verificar as questões atuais da atividade.');
    }

    const bancoIdsJaUsados = new Set(
      (questoesAtuais || []).map((q) => q.banco_questao_id).filter(Boolean)
    );

    // Lê todas as questões candidatas respeitando a paginação de 1000 linhas
    const questoesDoBanco: Array<{ id: string; dificuldade: DificuldadeQuestao }> = [];
    for (let de = 0; ; de += TAMANHO_PAGINA) {
      const { data, error } = await this.cliente
        .from('banco_questoes')
        .select('id, dificuldade')
        .eq('escola_id', sessao.escola_id)
        .eq('disciplina_id', oferta.disciplina_id)
        .eq('serie', turma.serie)
        .eq('assunto_id', assuntoId)
        .eq('arquivada', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(de, de + TAMANHO_PAGINA - 1);

      if (error) {
        throw new Error('Não foi possível buscar as questões do banco para o sorteio.');
      }

      const linhas = (data ?? []) as Array<{ id: string; dificuldade: DificuldadeQuestao }>;
      for (const item of linhas) {
        if (!bancoIdsJaUsados.has(item.id)) {
          questoesDoBanco.push(item);
        }
      }

      if (linhas.length < TAMANHO_PAGINA) {
        break;
      }
    }

    const faceis = questoesDoBanco.filter((q) => q.dificuldade === 'facil');
    const medias = questoesDoBanco.filter((q) => q.dificuldade === 'medio');
    const dificeis = questoesDoBanco.filter((q) => q.dificuldade === 'dificil');

    const avisos: string[] = [];

    if (quantidades.facil > 0 && faceis.length < quantidades.facil) {
      avisos.push(
        faceis.length === 0
          ? 'Não há questões fáceis disponíveis neste assunto.'
          : `Só há ${faceis.length} questão(ões) fácil(eis) neste assunto.`
      );
    }

    if (quantidades.medio > 0 && medias.length < quantidades.medio) {
      avisos.push(
        medias.length === 0
          ? 'Não há questões médias disponíveis neste assunto.'
          : `Só há ${medias.length} questão(ões) média(s) neste assunto.`
      );
    }

    if (quantidades.dificil > 0 && dificeis.length < quantidades.dificil) {
      avisos.push(
        dificeis.length === 0
          ? 'Não há questões difíceis disponíveis neste assunto.'
          : `Só há ${dificeis.length} questão(ões) difícil(eis) neste assunto.`
      );
    }

    // Sorteio aleatório entre as elegíveis de cada dificuldade
    const selecionadas = [
      ...embaralhar(faceis).slice(0, Math.max(0, quantidades.facil)),
      ...embaralhar(medias).slice(0, Math.max(0, quantidades.medio)),
      ...embaralhar(dificeis).slice(0, Math.max(0, quantidades.dificil)),
    ];

    if (selecionadas.length === 0) {
      return {
        adicionadas: 0,
        aviso: avisos.join(' ') || 'Nenhuma questão elegível para sorteio.',
      };
    }

    await this.adicionarDoBanco(
      atividadeId,
      selecionadas.map((s) => s.id)
    );

    return {
      adicionadas: selecionadas.length,
      aviso: avisos.length > 0 ? avisos.join(' ') : undefined,
    };
  }
}

export const criarSupabaseBancoService = (
  cliente: SupabaseClient = clientePadrao
): ServicoBanco => new SupabaseBancoService(cliente);

