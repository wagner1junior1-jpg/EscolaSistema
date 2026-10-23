/**
 * SaberPontual — GestaoService Supabase (Fase 5.1 do plano do back end)
 *
 * Implementação real dos fluxos de gestão da escola, períodos, disciplinas,
 * turmas, ofertas, avisos institucionais e professores via Supabase e Edge Functions.
 *
 * Regras:
 * - escola_id e autor vêm da sessão/RLS, nunca de parâmetros da tela.
 * - Exclusão lógica com deleted_at; consultas ativas sempre filtram deleted_at IS NULL.
 * - Toda chamada verifica { error } do Supabase e converte em Error com mensagem em PT-BR.
 * - Professores: criação, redefinição de senha e desativação via Edge Function admin-usuarios.
 * - Alunos e PIN (5.2): PIN gerado no cliente e mostrado uma única vez; o hash é gravado
 *   pela RPC definir_pin_aluno (bcrypt no servidor).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as clientePadrao } from '@/lib/supabase';
import { GestaoService } from '../contracts';
import {
  Escola,
  Periodo,
  Disciplina,
  Turma,
  Oferta,
  OfertaDetalhada,
  Perfil,
  AlunoPublico,
  Aluno,
  Aviso,
  PrioridadeAviso,
} from '@/lib/types';
import { chamarAdminUsuarios, RespostaCriarUsuario } from './adminUsuarios';

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

export class SupabaseGestaoService implements GestaoService {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  /**
   * Obtém os dados de sessão do usuário logado e valida se seu perfil está ativo.
   */
  private async obterContextoSessao(): Promise<{ id: string; escola_id: string; papel: string }> {
    const { data: sessao, error: erroSessao } = await this.cliente.auth.getSession();
    if (erroSessao || !sessao?.session?.user) {
      throw new Error('Sessão expirada. Entre novamente.');
    }
    const userId = sessao.session.user.id;
    const { data: perfil, error: erroPerfil } = await this.cliente
      .from('perfis')
      .select('id, escola_id, papel, ativo')
      .eq('id', userId)
      .maybeSingle();

    if (erroPerfil) {
      throw new Error('Não foi possível verificar os dados do seu usuário.');
    }
    if (!perfil || !perfil.ativo) {
      throw new Error('Usuário não encontrado ou inativo.');
    }
    return perfil as { id: string; escola_id: string; papel: string };
  }

  // ---------------------------------------------------------------------------
  // 1. Escola
  // ---------------------------------------------------------------------------

  async obterEscola(): Promise<Escola> {
    const { data, error } = await this.cliente
      .from('escolas')
      .select('id, created_at, nome, cidade_uf, ano_letivo_atual')
      .maybeSingle();

    if (error) {
      throw new Error('Não foi possível obter os dados da escola.');
    }
    if (!data) {
      throw new Error('Escola não encontrada.');
    }
    return data as Escola;
  }

  async atualizarEscola(dados: Partial<Escola>): Promise<Escola> {
    const escolaAtual = await this.obterEscola();
    const payload: Record<string, unknown> = {};
    if (dados.nome !== undefined) payload.nome = dados.nome.trim();
    if (dados.cidade_uf !== undefined) payload.cidade_uf = dados.cidade_uf.trim();
    if (dados.ano_letivo_atual !== undefined) payload.ano_letivo_atual = dados.ano_letivo_atual;

    const { data, error } = await this.cliente
      .from('escolas')
      .update(payload)
      .eq('id', escolaAtual.id)
      .select('id, created_at, nome, cidade_uf, ano_letivo_atual')
      .single();

    if (error) {
      throw new Error('Não foi possível atualizar os dados da escola.');
    }
    return data as Escola;
  }

  // ---------------------------------------------------------------------------
  // 2. Períodos Letivos
  // ---------------------------------------------------------------------------

  async listarPeriodos(): Promise<Periodo[]> {
    const { data, error } = await this.cliente
      .from('periodos')
      .select('id, created_at, escola_id, nome, ano_letivo, data_inicio, data_fim, ativo')
      .is('deleted_at', null)
      .order('ano_letivo', { ascending: true })
      .order('data_inicio', { ascending: true });

    if (error) {
      throw new Error('Não foi possível listar os períodos letivos.');
    }
    return (data || []) as Periodo[];
  }

  async criarPeriodo(dados: Omit<Periodo, 'id' | 'created_at'>): Promise<Periodo> {
    const { escola_id } = await this.obterContextoSessao();

    if (dados.ativo) {
      const { error: erroDesativar } = await this.cliente
        .from('periodos')
        .update({ ativo: false })
        .eq('ativo', true)
        .is('deleted_at', null);

      if (erroDesativar) {
        throw new Error('Não foi possível desativar o período letivo anterior.');
      }
    }

    const { data, error } = await this.cliente
      .from('periodos')
      .insert({
        escola_id,
        nome: dados.nome.trim(),
        ano_letivo: dados.ano_letivo,
        data_inicio: dados.data_inicio,
        data_fim: dados.data_fim,
        ativo: Boolean(dados.ativo),
      })
      .select('id, created_at, escola_id, nome, ano_letivo, data_inicio, data_fim, ativo')
      .single();

    if (error) {
      throw new Error('Não foi possível criar o período letivo.');
    }
    return data as Periodo;
  }

  async atualizarPeriodo(id: string, dados: Partial<Periodo>): Promise<Periodo> {
    if (dados.ativo) {
      const { error: erroDesativar } = await this.cliente
        .from('periodos')
        .update({ ativo: false })
        .eq('ativo', true)
        .is('deleted_at', null);

      if (erroDesativar) {
        throw new Error('Não foi possível desativar o período letivo anterior.');
      }
    }

    const payload: Record<string, unknown> = {};
    if (dados.nome !== undefined) payload.nome = dados.nome.trim();
    if (dados.ano_letivo !== undefined) payload.ano_letivo = dados.ano_letivo;
    if (dados.data_inicio !== undefined) payload.data_inicio = dados.data_inicio;
    if (dados.data_fim !== undefined) payload.data_fim = dados.data_fim;
    if (dados.ativo !== undefined) payload.ativo = dados.ativo;

    const { data, error } = await this.cliente
      .from('periodos')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, created_at, escola_id, nome, ano_letivo, data_inicio, data_fim, ativo')
      .single();

    if (error) {
      throw new Error('Não foi possível atualizar o período letivo.');
    }
    return data as Periodo;
  }

  async definirPeriodoAtivo(id: string): Promise<void> {
    // 1. Ordem segura: desativa o período atualmente ativo da escola
    const { error: erroDesativar } = await this.cliente
      .from('periodos')
      .update({ ativo: false })
      .eq('ativo', true)
      .is('deleted_at', null);

    if (erroDesativar) {
      throw new Error('Não foi possível desativar o período letivo ativo anterior.');
    }

    // 2. Ativa o período selecionado
    const { error: erroAtivar } = await this.cliente
      .from('periodos')
      .update({ ativo: true })
      .eq('id', id)
      .is('deleted_at', null);

    if (erroAtivar) {
      throw new Error('Não foi possível definir o período letivo ativo.');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Disciplinas
  // ---------------------------------------------------------------------------

  async listarDisciplinas(): Promise<Disciplina[]> {
    const { data, error } = await this.cliente
      .from('disciplinas')
      .select('id, created_at, escola_id, nome')
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) {
      throw new Error('Não foi possível listar as disciplinas.');
    }
    return (data || []) as Disciplina[];
  }

  async criarDisciplina(nome: string): Promise<Disciplina> {
    const { escola_id } = await this.obterContextoSessao();
    const nomeLimpo = nome.trim();

    const { data, error } = await this.cliente
      .from('disciplinas')
      .insert({
        escola_id,
        nome: nomeLimpo,
      })
      .select('id, created_at, escola_id, nome')
      .single();

    if (error) {
      if (error.code === '23505' || /unique|duplicate/i.test(error.message)) {
        throw new Error('Já existe uma disciplina cadastrada com este nome.');
      }
      throw new Error('Não foi possível criar a disciplina.');
    }
    return data as Disciplina;
  }

  async excluirDisciplina(id: string): Promise<void> {
    // Verifica se possui ofertas ativas vinculadas
    const { data: ofertas, error: erroOfertas } = await this.cliente
      .from('ofertas')
      .select('id')
      .eq('disciplina_id', id)
      .is('deleted_at', null)
      .limit(1);

    if (erroOfertas) {
      throw new Error('Não foi possível verificar os vínculos da disciplina.');
    }
    if (ofertas && ofertas.length > 0) {
      throw new Error(
        'Não é possível excluir esta disciplina pois ela já possui ofertas associadas.'
      );
    }

    const { error } = await this.cliente
      .from('disciplinas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível excluir a disciplina.');
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Turmas
  // ---------------------------------------------------------------------------

  async listarTurmas(): Promise<Turma[]> {
    const { data, error } = await this.cliente
      .from('turmas')
      .select('id, created_at, escola_id, nome, serie, segmento, ano_letivo, codigo_acesso, ativa')
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) {
      throw new Error('Não foi possível listar as turmas.');
    }
    return (data || []) as Turma[];
  }

  async criarTurma(dados: Omit<Turma, 'id' | 'created_at'>): Promise<Turma> {
    const { escola_id } = await this.obterContextoSessao();
    const codigoUpper = dados.codigo_acesso.trim().toUpperCase();

    const { data, error } = await this.cliente
      .from('turmas')
      .insert({
        escola_id,
        nome: dados.nome.trim(),
        serie: dados.serie.trim(),
        segmento: dados.segmento,
        ano_letivo: dados.ano_letivo,
        codigo_acesso: codigoUpper,
        ativa: dados.ativa !== undefined ? dados.ativa : true,
      })
      .select('id, created_at, escola_id, nome, serie, segmento, ano_letivo, codigo_acesso, ativa')
      .single();

    if (error) {
      if (error.code === '23505' || /unique|codigo_acesso/i.test(error.message)) {
        throw new Error(
          `O código de acesso ${codigoUpper} já está sendo utilizado por outra turma.`
        );
      }
      throw new Error('Não foi possível criar a turma.');
    }
    return data as Turma;
  }

  async atualizarTurma(id: string, dados: Partial<Turma>): Promise<Turma> {
    const payload: Record<string, unknown> = {};
    if (dados.nome !== undefined) payload.nome = dados.nome.trim();
    if (dados.serie !== undefined) payload.serie = dados.serie.trim();
    if (dados.segmento !== undefined) payload.segmento = dados.segmento;
    if (dados.ano_letivo !== undefined) payload.ano_letivo = dados.ano_letivo;
    if (dados.ativa !== undefined) payload.ativa = dados.ativa;
    if (dados.codigo_acesso !== undefined) {
      payload.codigo_acesso = dados.codigo_acesso.trim().toUpperCase();
    }

    const { data, error } = await this.cliente
      .from('turmas')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, created_at, escola_id, nome, serie, segmento, ano_letivo, codigo_acesso, ativa')
      .single();

    if (error) {
      if (error.code === '23505' || /unique|codigo_acesso/i.test(error.message)) {
        throw new Error(
          `O código de acesso ${String(payload.codigo_acesso || '')} já está em uso.`
        );
      }
      throw new Error('Não foi possível atualizar a turma.');
    }
    return data as Turma;
  }

  // ---------------------------------------------------------------------------
  // 5. Ofertas
  // ---------------------------------------------------------------------------

  async listarOfertas(): Promise<OfertaDetalhada[]> {
    const { data, error } = await this.cliente
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

  async criarOferta(dados: Omit<Oferta, 'id' | 'created_at'>): Promise<Oferta> {
    const { data, error } = await this.cliente
      .from('ofertas')
      .insert({
        turma_id: dados.turma_id,
        disciplina_id: dados.disciplina_id,
        professor_id: dados.professor_id,
      })
      .select('id, created_at, turma_id, disciplina_id, professor_id')
      .single();

    if (error) {
      if (error.code === '23505' || /unique/i.test(error.message)) {
        throw new Error('Já existe uma oferta desta disciplina cadastrada para esta turma.');
      }
      throw new Error('Não foi possível criar a oferta de disciplina.');
    }
    return data as Oferta;
  }

  async excluirOferta(id: string): Promise<void> {
    const { data: atividades, error: erroAtividades } = await this.cliente
      .from('atividades')
      .select('id')
      .eq('oferta_id', id)
      .is('deleted_at', null)
      .limit(1);

    if (erroAtividades) {
      throw new Error('Não foi possível verificar as atividades vinculadas à oferta.');
    }
    if (atividades && atividades.length > 0) {
      throw new Error(
        'Esta oferta possui atividades pedagógicas registradas e não pode ser excluída.'
      );
    }

    const { error } = await this.cliente
      .from('ofertas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível excluir a oferta de disciplina.');
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Professores (via Edge Function admin-usuarios)
  // ---------------------------------------------------------------------------

  async listarProfessores(): Promise<Perfil[]> {
    const { data, error } = await this.cliente
      .from('perfis')
      .select('id, created_at, escola_id, nome, papel, ativo, email, trocar_senha')
      .eq('papel', 'professor')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      throw new Error('Não foi possível listar os professores.');
    }
    return (data || []) as Perfil[];
  }

  async convidarProfessor(
    email: string,
    nome: string,
    senha?: string
  ): Promise<Perfil & { senha_provisoria?: string }> {
    const resposta = await chamarAdminUsuarios<RespostaCriarUsuario>(
      {
        acao: 'criar',
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        papel: 'professor',
        senha: senha?.trim() || undefined,
      },
      this.cliente
    );

    return {
      ...resposta.perfil,
      senha_provisoria: resposta.senha_provisoria,
    };
  }

  async redefinirSenhaProfessor(id: string, novaSenha: string): Promise<void> {
    const senhaLimpa = novaSenha?.trim();
    if (!senhaLimpa || senhaLimpa.length < 6) {
      throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
    }

    await chamarAdminUsuarios<{ senha_provisoria?: string }>(
      {
        acao: 'redefinir-senha',
        id,
        senha: senhaLimpa,
      },
      this.cliente
    );
  }

  async desativarProfessor(id: string): Promise<void> {
    await chamarAdminUsuarios<{ ok: true }>(
      {
        acao: 'desativar',
        id,
      },
      this.cliente
    );
  }

  // ---------------------------------------------------------------------------
  // 7. Avisos da Escola (turma_id IS NULL)
  // ---------------------------------------------------------------------------

  async listarAvisosEscola(): Promise<Aviso[]> {
    const { data, error } = await this.cliente
      .from('avisos')
      .select('id, escola_id, autor_id, turma_id, titulo, mensagem, prioridade, publicado_em')
      .is('turma_id', null)
      .is('deleted_at', null)
      .order('publicado_em', { ascending: false });

    if (error) {
      throw new Error('Não foi possível listar os avisos da escola.');
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

  async criarAvisoEscola(dados: {
    titulo: string;
    mensagem: string;
    prioridade: PrioridadeAviso;
  }): Promise<Aviso> {
    const { escola_id, id: autor_id } = await this.obterContextoSessao();

    const { data, error } = await this.cliente
      .from('avisos')
      .insert({
        escola_id,
        autor_id,
        turma_id: null,
        titulo: dados.titulo.trim(),
        mensagem: dados.mensagem.trim(),
        prioridade: dados.prioridade,
      })
      .select('id, escola_id, autor_id, turma_id, titulo, mensagem, prioridade, publicado_em')
      .single();

    if (error) {
      throw new Error('Não foi possível publicar o aviso da escola.');
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

  async excluirAvisoEscola(id: string): Promise<void> {
    const { error } = await this.cliente
      .from('avisos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error('Não foi possível excluir o aviso da escola.');
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Alunos e PIN (Fase 5.2)
  // O PIN em texto puro só existe no cliente, no instante em que é gerado, e é devolvido
  // uma única vez. No banco fica apenas o hash bcrypt, gravado pela RPC definir_pin_aluno.
  // ---------------------------------------------------------------------------

  async listarAlunos(turmaId?: string): Promise<AlunoPublico[]> {
    let consulta = this.cliente
      .from('alunos')
      .select(COLUNAS_ALUNO)
      .eq('ativo', true)
      .is('deleted_at', null);
    if (turmaId) {
      consulta = consulta.eq('turma_id', turmaId);
    }
    const { data, error } = await consulta.order('numero_chamada', { ascending: true });

    if (error) {
      throw new Error('Não foi possível listar os alunos.');
    }
    return (data || []) as AlunoPublico[];
  }

  async cadastrarAluno(
    dados: Omit<Aluno, 'id' | 'created_at' | 'pin_hash'> & { pin?: string }
  ): Promise<{ aluno: AlunoPublico; pin_puro: string }> {
    const nome = dados.nome_completo?.trim();
    if (!nome) {
      throw new Error('Informe o nome do aluno.');
    }
    const pinPuro = pinInformadoOuGerado(dados.pin);
    const { escola_id } = await this.obterContextoSessao();

    const { data, error } = await this.cliente
      .from('alunos')
      .insert({
        escola_id,
        turma_id: dados.turma_id,
        nome_completo: nome,
        numero_chamada: dados.numero_chamada,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
      })
      .select(COLUNAS_ALUNO)
      .single();

    if (error) {
      throw new Error('Não foi possível cadastrar o aluno.');
    }
    const aluno = data as AlunoPublico;

    try {
      await this.definirPin(aluno.id, pinPuro);
    } catch (erroPin) {
      // Sem PIN o aluno não consegue entrar: desfaz o cadastro em vez de deixá-lo pela metade.
      await this.desfazerCadastro([aluno.id]);
      throw erroPin;
    }
    return { aluno, pin_puro: pinPuro };
  }

  async cadastrarAlunosEmLote(
    turmaId: string,
    nomes: string[]
  ): Promise<Array<{ aluno: AlunoPublico; pin_puro: string }>> {
    const nomesLimpos = nomes.map((n) => n.trim()).filter((n) => n !== '');
    if (nomesLimpos.length === 0) {
      return [];
    }
    const { escola_id } = await this.obterContextoSessao();

    const { data: ultimo, error: erroUltimo } = await this.cliente
      .from('alunos')
      .select('numero_chamada')
      .eq('turma_id', turmaId)
      .is('deleted_at', null)
      .order('numero_chamada', { ascending: false })
      .limit(1);

    if (erroUltimo) {
      throw new Error('Não foi possível verificar a numeração de chamada da turma.');
    }
    const primeiroNumero =
      ((ultimo as Array<{ numero_chamada: number }> | null)?.[0]?.numero_chamada ?? 0) + 1;

    const { data, error } = await this.cliente
      .from('alunos')
      .insert(
        nomesLimpos.map((nome, i) => ({
          escola_id,
          turma_id: turmaId,
          nome_completo: nome,
          numero_chamada: primeiroNumero + i,
          ativo: true,
        }))
      )
      .select(COLUNAS_ALUNO);

    if (error) {
      throw new Error('Não foi possível cadastrar os alunos.');
    }
    const criados = ((data || []) as AlunoPublico[]).sort(
      (a, b) => a.numero_chamada - b.numero_chamada
    );

    const resultados: Array<{ aluno: AlunoPublico; pin_puro: string }> = [];
    try {
      for (const aluno of criados) {
        const pinPuro = gerarPin();
        await this.definirPin(aluno.id, pinPuro);
        resultados.push({ aluno, pin_puro: pinPuro });
      }
    } catch (erroPin) {
      // Tudo ou nada: se algum PIN falhar, nenhum aluno do lote fica cadastrado sem o PIN ser mostrado.
      await this.desfazerCadastro(criados.map((a) => a.id));
      throw erroPin;
    }
    return resultados;
  }

  async atualizarAluno(
    id: string,
    dados: { nome_completo?: string; numero_chamada?: number; ativo?: boolean }
  ): Promise<AlunoPublico> {
    const payload: Record<string, unknown> = {};
    if (dados.nome_completo !== undefined) {
      const nome = dados.nome_completo.trim();
      if (!nome) {
        throw new Error('Informe o nome do aluno.');
      }
      payload.nome_completo = nome;
    }
    if (dados.numero_chamada !== undefined) payload.numero_chamada = dados.numero_chamada;
    if (dados.ativo !== undefined) payload.ativo = dados.ativo;

    const { data, error } = await this.cliente
      .from('alunos')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select(COLUNAS_ALUNO)
      .maybeSingle();

    if (error) {
      throw new Error('Não foi possível atualizar o aluno.');
    }
    if (!data) {
      throw new Error('Aluno não encontrado.');
    }
    return data as AlunoPublico;
  }

  async gerarOuResetarPin(alunoId: string, novoPin?: string): Promise<{ pin_puro: string }> {
    const pinPuro = pinInformadoOuGerado(novoPin);
    await this.definirPin(alunoId, pinPuro);
    return { pin_puro: pinPuro };
  }

  /** Grava o hash do PIN no servidor. A RPC valida a permissão e encerra as sessões antigas. */
  private async definirPin(alunoId: string, pin: string): Promise<void> {
    const { error } = await this.cliente.rpc('definir_pin_aluno', {
      p_aluno_id: alunoId,
      p_pin: pin,
    });
    if (error) {
      // As mensagens da RPC (RAISE EXCEPTION, código P0001) já estão em português.
      throw new Error(
        error.code === 'P0001' && error.message
          ? error.message
          : 'Não foi possível definir o PIN do aluno.'
      );
    }
  }

  /** Exclusão lógica dos alunos criados numa operação que não terminou. */
  private async desfazerCadastro(ids: string[]): Promise<void> {
    const { error } = await this.cliente
      .from('alunos')
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .in('id', ids);
    if (error) {
      throw new Error(
        'O PIN não pôde ser definido e o cadastro não pôde ser desfeito. Confira a lista de alunos da turma.'
      );
    }
  }
}

const COLUNAS_ALUNO = 'id, created_at, escola_id, turma_id, nome_completo, numero_chamada, ativo';

/** PIN de 4 dígitos (1000 a 9999, como no mock) sorteado com o gerador seguro do navegador. */
function gerarPin(): string {
  const limite = 0x100000000 - (0x100000000 % 9000); // descarta o resto para não enviesar o sorteio
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limite);
  return String(1000 + (buffer[0] % 9000));
}

function pinInformadoOuGerado(pin?: string | null): string {
  const limpo = pin?.trim();
  if (!limpo) return gerarPin();
  if (!/^\d{4}$/.test(limpo)) {
    throw new Error('O PIN deve conter exatamente 4 dígitos numéricos.');
  }
  return limpo;
}

export const criarSupabaseGestaoService = (
  cliente: SupabaseClient = clientePadrao
): GestaoService => new SupabaseGestaoService(cliente);

