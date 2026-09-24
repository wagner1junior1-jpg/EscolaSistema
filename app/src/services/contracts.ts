/**
 * SaberPontual — Contratos e Interfaces de Serviços
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seção 7.1)
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
  Frequencia,
  StatusFrequencia,
  Aviso,
  PrioridadeAviso,
  RespostaFeedback,
  MapaDeCalorAtividade,
  BoletimAluno,
  RelatorioConselho,
  VisaoGeralEscola,
} from '@/lib/types';

// Entrada para criação/edição de questão e suas alternativas
export interface NovaQuestaoPayload {
  id?: string;
  ordem?: number;
  enunciado: string;
  dica: string | null;
  explicacao: string | null;
  alternativas: Array<{
    id?: string;
    letra?: 'A' | 'B' | 'C' | 'D' | 'E';
    texto: string;
    correta: boolean;
    por_que_errou: string | null;
  }>;
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
  cadastrarAluno(dados: Omit<Aluno, 'id' | 'created_at' | 'pin_hash'>): Promise<{ aluno: AlunoPublico; pin_puro: string }>;
  cadastrarAlunosEmLote(turmaId: string, nomes: string[]): Promise<Array<{ aluno: AlunoPublico; pin_puro: string }>>;
  atualizarAluno(id: string, dados: { nome_completo?: string; numero_chamada?: number; ativo?: boolean }): Promise<AlunoPublico>;
  gerarOuResetarPin(alunoId: string): Promise<{ pin_puro: string }>;
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
    dados: { titulo: string; descricao: string; prazo: string | null; periodo_id: string }
  ): Promise<Atividade>;
  atualizarAtividade(
    id: string,
    dados: { titulo?: string; descricao?: string; prazo?: string | null; periodo_id?: string }
  ): Promise<Atividade>;
  excluirAtividade(id: string): Promise<void>;
  publicarAtividade(id: string): Promise<void>;
  encerrarAtividade(id: string): Promise<void>;
  duplicarAtividade(atividadeId: string, paraOfertaId: string): Promise<Atividade>;
  salvarQuestoes(atividadeId: string, questoes: NovaQuestaoPayload[]): Promise<void>;
  reordenarQuestoes(atividadeId: string, ordemIds: string[]): Promise<void>;
  excluirQuestao(id: string): Promise<void>;
  listarFrequencia(ofertaId: string, data: string): Promise<Frequencia[]>;
  salvarFrequencia(
    ofertaId: string,
    data: string,
    registros: Array<{ aluno_id: string; status: StatusFrequencia }>
  ): Promise<void>;
  listarRecadosTurma(turmaId: string): Promise<Aviso[]>;
  criarRecadoTurma(
    ofertaId: string,
    dados: { titulo: string; mensagem: string; prioridade: PrioridadeAviso }
  ): Promise<Aviso>;
  mapaDeCalor(atividadeId: string): Promise<MapaDeCalorAtividade>;
}

// 4. AlunoService (Portal do Aluno e Espaço dos Pais)
export interface AlunoService {
  listarTurma(codigo: string): Promise<AlunoResumido[]>;
  login(alunoId: string, pin: string): Promise<{ token: string; aluno: AlunoResumido }>;
  atividadesPendentes(token: string): Promise<AtividadeResumoAluno[]>;
  carregarAtividade(token: string, atividadeId: string): Promise<AtividadeParaAluno>;
  responder(token: string, questaoId: string, alternativaId: string): Promise<RespostaFeedback>;
  boletim(token: string): Promise<BoletimAluno>;
  avisos(token: string): Promise<Aviso[]>;
}

// 5. RelatorioService (Coordenação e Direção)
export interface RelatorioService {
  conselhoDeClasse(turmaId: string, periodoId: string): Promise<RelatorioConselho>;
  visaoGeralEscola(): Promise<VisaoGeralEscola>;
}
