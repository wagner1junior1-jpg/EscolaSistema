/**
 * SaberPontual — Contratos e Interfaces de Serviços
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seções 4, 5, 6 e 7.1)
 * Regra: Contexto, autor e escola são sempre derivados da sessão autenticada.
 */

import {
  Escola,
  Perfil,
  Periodo,
  Disciplina,
  Turma,
  Oferta,
  OfertaDetalhada,
  Aluno,
  AlunoPublico,
  AlunoResumido,
  Atividade,
  AtividadeCompleta,
  AtividadeParaAluno,
  AtividadeResumoAluno,
  ModoAtividade,
  Aviso,
  PrioridadeAviso,
  MapaDeCalorAtividade,
  RespostaAlunoResultado,
  RespostaExercicio,
  ResultadoProva,
  MeuDesempenhoAluno,
  RelatorioDesempenhoOferta,
  FichaAluno,
  VisaoGeralEscola,
  DesempenhoTurmaDisciplinaItem,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
  DesempenhoTurmaHierarquico,
  Assunto,
  BancoQuestao,
  DificuldadeQuestao,
  TipoQuestao,
  OrigemQuestao,
  GerarQuestoesIAParams,
  QuestaoSugeridaIA,
  RespostaGeracaoIA,
  ItemCorrecaoPendente,
} from '@/lib/types';

export type { GerarQuestoesIAParams, QuestaoSugeridaIA, RespostaGeracaoIA, ItemCorrecaoPendente };

export interface ItemCorrecaoFeita extends ItemCorrecaoPendente {
  correcao: 'certo' | 'parcial' | 'errado';
  pontuacao: number | null;
  comentario_professor: string | null;
  corrigido_em?: string | null;
}

// Entrada para criação/edição de questão e suas alternativas
export interface NovaQuestaoPayload {
  id?: string;
  ordem?: number;
  enunciado: string;
  dica?: string | null;
  explicacao?: string | null;
  banco_questao_id?: string | null;
  assunto_id?: string | null;
  salvar_no_banco?: boolean;
  dificuldade?: DificuldadeQuestao;
  tipo?: TipoQuestao;
  resposta_esperada?: string | null;
  imagem_url?: string | null;
  alternativas: Array<{
    id?: string;
    letra?: 'A' | 'B' | 'C' | 'D' | 'E';
    texto: string;
    correta: boolean;
    por_que_errou?: string | null;
  }>;
}

export interface SalvarBancoQuestaoPayload {
  id?: string;
  disciplina_id: string;
  assunto_id: string;
  serie: string;
  dificuldade: DificuldadeQuestao;
  enunciado: string;
  dica?: string | null;
  explicacao?: string | null;
  versao?: number;
  tipo?: TipoQuestao;
  origem?: OrigemQuestao;
  resposta_esperada?: string | null;
  imagem_url?: string | null;
  alternativas?: Array<{
    id?: string;
    letra?: 'A' | 'B' | 'C' | 'D' | 'E';
    texto: string;
    correta: boolean;
    por_que_errou?: string | null;
  }>;
}

export interface FiltrosBanco {
  disciplina_id: string;
  serie: string;
  assunto_id?: string;
  dificuldade?: DificuldadeQuestao;
  escopo?: 'minhas' | 'escola';
  tipo?: TipoQuestao;
  origem?: OrigemQuestao;
}

export interface CombinacaoProfessor {
  disciplina_id: string;
  disciplina_nome: string;
  serie: string;
  label: string;
}

// 1. AuthService
export interface AuthService {
  login(email: string, senha: string): Promise<Perfil>;
  logout(): Promise<void>;
  usuarioAtual(): Promise<Perfil | null>;
}

// 2. GestaoService (Direção e Coordenação)
export interface GestaoService {
  obterEscola(): Promise<Escola>;
  atualizarEscola(dados: Partial<Escola>): Promise<Escola>;
  listarPeriodos(): Promise<Periodo[]>;
  criarPeriodo(dados: Omit<Periodo, 'id' | 'created_at'>): Promise<Periodo>;
  atualizarPeriodo(id: string, dados: Partial<Periodo>): Promise<Periodo>;
  definirPeriodoAtivo(id: string): Promise<void>;
  listarDisciplinas(): Promise<Disciplina[]>;
  criarDisciplina(nome: string): Promise<Disciplina>;
  excluirDisciplina(id: string): Promise<void>;
  listarTurmas(): Promise<Turma[]>;
  criarTurma(dados: Omit<Turma, 'id' | 'created_at'>): Promise<Turma>;
  atualizarTurma(id: string, dados: Partial<Turma>): Promise<Turma>;
  listarOfertas(): Promise<OfertaDetalhada[]>;
  criarOferta(dados: Omit<Oferta, 'id' | 'created_at'>): Promise<Oferta>;
  excluirOferta(id: string): Promise<void>;
  listarProfessores(): Promise<Perfil[]>;
  convidarProfessor(email: string, nome: string): Promise<Perfil>;
  desativarProfessor(id: string): Promise<void>;
  listarAlunos(turmaId?: string): Promise<AlunoPublico[]>;
  cadastrarAluno(
    dados: Omit<Aluno, 'id' | 'created_at' | 'pin_hash'> & { pin?: string }
  ): Promise<{ aluno: AlunoPublico; pin_puro: string }>;
  cadastrarAlunosEmLote(turmaId: string, nomes: string[]): Promise<Array<{ aluno: AlunoPublico; pin_puro: string }>>;
  atualizarAluno(id: string, dados: { nome_completo?: string; numero_chamada?: number; ativo?: boolean }): Promise<AlunoPublico>;
  gerarOuResetarPin(alunoId: string, novoPin?: string): Promise<{ pin_puro: string }>;
  listarAvisosEscola(): Promise<Aviso[]>;
  criarAvisoEscola(dados: { titulo: string; mensagem: string; prioridade: PrioridadeAviso }): Promise<Aviso>;
  excluirAvisoEscola(id: string): Promise<void>;
}

// 3. ProfessorService (Área Docente)
export interface ProfessorService {
  minhasOfertas(): Promise<OfertaDetalhada[]>;
  listarAtividades(ofertaId: string): Promise<Atividade[]>;
  obterAtividade(atividadeId: string): Promise<AtividadeCompleta | null>;
  criarAtividade(
    ofertaId: string,
    dados: { titulo: string; descricao: string; prazo: string | null; periodo_id: string; modo?: ModoAtividade }
  ): Promise<Atividade>;
  atualizarAtividade(
    id: string,
    dados: { titulo?: string; descricao?: string; prazo?: string | null; periodo_id?: string; modo?: ModoAtividade }
  ): Promise<Atividade>;
  excluirAtividade(id: string): Promise<void>;
  publicarAtividade(id: string): Promise<void>;
  encerrarAtividade(id: string): Promise<void>;
  duplicarAtividade(atividadeId: string, paraOfertaId: string): Promise<Atividade>;
  salvarQuestoes(atividadeId: string, questoes: NovaQuestaoPayload[]): Promise<void>;
  reordenarQuestoes(atividadeId: string, ordemIds: string[]): Promise<void>;
  excluirQuestao(id: string): Promise<void>;
  listarRecadosTurma(turmaId: string): Promise<Aviso[]>;
  criarRecadoTurma(
    ofertaId: string,
    dados: { titulo: string; mensagem: string; prioridade: PrioridadeAviso }
  ): Promise<Aviso>;
  mapaDeCalor(atividadeId: string): Promise<MapaDeCalorAtividade>;
  desempenhoOferta(ofertaId: string, periodoId: string): Promise<RelatorioDesempenhoOferta>;
  fichaAluno(ofertaId: string, alunoId: string): Promise<FichaAluno>;
  listarCorrecoesPendentes(atividadeId: string): Promise<ItemCorrecaoPendente[]>;
  listarCorrecoesFeitas(atividadeId: string): Promise<ItemCorrecaoFeita[]>;
  corrigirResposta(
    respostaId: string,
    correcao: 'certo' | 'parcial' | 'errado',
    comentario?: string
  ): Promise<void>;
}

// 4. AlunoService (Portal do Aluno)
export interface AlunoService {
  listarTurma(codigo: string): Promise<AlunoResumido[]>;
  login(alunoId: string, pin: string): Promise<{ token: string; aluno: AlunoResumido }>;
  atividadesPendentes(token: string): Promise<AtividadeResumoAluno[]>;
  carregarAtividade(token: string, atividadeId: string): Promise<AtividadeParaAluno>;
  responder(token: string, questaoId: string, alternativaId: string): Promise<RespostaAlunoResultado>;
  responderDiscursiva(
    token: string,
    questaoId: string,
    texto: string
  ): Promise<{ registrada: true; explicacao?: string | null }>;
  tentarNovamente(token: string, questaoId: string, alternativaId: string): Promise<RespostaExercicio>;
  resultadoProva(token: string, atividadeId: string): Promise<ResultadoProva>;
  meuDesempenho(token: string): Promise<MeuDesempenhoAluno>;
  avisos(token: string): Promise<Aviso[]>;
}

// 5. RelatorioService (Coordenação e Direção)
export interface RelatorioService {
  visaoGeralEscola(): Promise<VisaoGeralEscola>;
  desempenhoTurmas(periodoId: string): Promise<DesempenhoTurmaDisciplinaItem[]>;
  desempenhoHierarquicoTurmas(periodoId: string): Promise<DesempenhoTurmaHierarquico[]>;
  alunosEmAtencao(periodoId: string): Promise<AlunoEmAtencaoItem[]>;
  questoesCriticasEscola(periodoId: string): Promise<QuestaoCriticaEscolaItem[]>;
}

// 6. ServicoBanco / BancoService (docs/ESPECIFICACAO.md 9.2, 9.5)
export interface ServicoBanco {
  listarAssuntos(disciplinaId: string): Promise<Assunto[]>;
  criarAssunto(disciplinaId: string, nome: string): Promise<Assunto>;
  renomearAssunto(assuntoId: string, novoNome: string): Promise<Assunto>;
  excluirAssunto(assuntoId: string): Promise<void>;
  contarQuestoesPorAssunto(disciplinaId: string): Promise<Record<string, number>>;
  listarCombinacoesDoProfessor(): Promise<CombinacaoProfessor[]>;
  listarBanco(filtros: FiltrosBanco): Promise<BancoQuestao[]>;
  salvarQuestaoBanco(dados: SalvarBancoQuestaoPayload): Promise<BancoQuestao>;
  duplicarQuestaoBanco(id: string): Promise<BancoQuestao>;
  arquivarQuestaoBanco(id: string): Promise<void>;
  adicionarDoBanco(atividadeId: string, bancoIds: string[]): Promise<void>;
  sortearDoBanco(
    atividadeId: string,
    assuntoId: string,
    quantidades: { facil: number; medio: number; dificil: number }
  ): Promise<{ adicionadas: number; aviso?: string }>;
}

export type BancoService = ServicoBanco;

// 7. ServicoIA / IAService (docs/ESPECIFICACAO.md 9.6, 9.7)
export interface ServicoIA {
  gerarQuestoes(params: GerarQuestoesIAParams): Promise<RespostaGeracaoIA>;
  transcreverImagem(fotos: string[]): Promise<string>;
  consultarCota(): Promise<{ uso_mes: number; limite_mes: number }>;
}

export type IAService = ServicoIA;


