/**
 * SaberPontual — Tipos das Entidades do Banco de Dados
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seção 4)
 * Todos os nomes de campos seguem snake_case exatamente como especificado.
 */

export type PapelUsuario = 'direcao' | 'coordenacao' | 'professor';

export type SegmentoTurma = 'fund1' | 'fund2' | 'medio';

export type StatusAtividade = 'rascunho' | 'publicada' | 'encerrada';

export type LetraAlternativa = 'A' | 'B' | 'C' | 'D' | 'E';

export type StatusFrequencia = 'P' | 'F' | 'J';

export type PrioridadeAviso = 'baixa' | 'media' | 'alta';

export type SituacaoConselho =
  | 'Destaque'
  | 'Adequado'
  | 'Reforço'
  | 'Risco por infrequência'
  | 'Sem avaliação';

// 1. escolas
export interface Escola {
  id: string;
  created_at: string;
  nome: string;
  cidade_uf: string;
  ano_letivo_atual: number;
}

// 2. perfis (id = auth.users.id)
export interface Perfil {
  id: string;
  created_at: string;
  escola_id: string;
  nome: string;
  papel: PapelUsuario;
  ativo: boolean;
  email?: string;
}

// 3. periodos
export interface Periodo {
  id: string;
  created_at: string;
  escola_id: string;
  nome: string; // Ex: "1º Bimestre"
  ano_letivo: number;
  data_inicio: string; // date YYYY-MM-DD
  data_fim: string; // date YYYY-MM-DD
  ativo: boolean;
}

// 4. disciplinas
export interface Disciplina {
  id: string;
  created_at: string;
  escola_id: string;
  nome: string;
}

// 5. turmas
export interface Turma {
  id: string;
  created_at: string;
  escola_id: string;
  nome: string; // Ex: "7º Ano A"
  serie: string; // Ex: "7º Ano"
  segmento: SegmentoTurma;
  ano_letivo: number;
  codigo_acesso: string; // Ex: "7A-K3P"
  ativa: boolean;
}

// 6. ofertas (turma + disciplina + professor)
export interface Oferta {
  id: string;
  created_at: string;
  turma_id: string;
  disciplina_id: string;
  professor_id: string;
}

// 7. alunos
export interface Aluno {
  id: string;
  created_at: string;
  escola_id: string;
  turma_id: string;
  nome_completo: string;
  numero_chamada: number;
  pin_hash: string;
  ativo: boolean;
}

// Aluno sem a exposição do hash do PIN (sigilo estrito)
export type AlunoPublico = Omit<Aluno, 'pin_hash'>;


// 8. atividades
export interface Atividade {
  id: string;
  created_at: string;
  oferta_id: string;
  periodo_id: string;
  titulo: string;
  descricao: string;
  prazo: string | null; // date YYYY-MM-DD ou null
  status: StatusAtividade;
  criado_por: string;
}

// 9. questoes
export interface Questao {
  id: string;
  created_at: string;
  atividade_id: string;
  ordem: number;
  enunciado: string;
  dica: string | null;
  explicacao: string | null;
}

// 10. alternativas
export interface Alternativa {
  id: string;
  created_at: string;
  questao_id: string;
  letra: LetraAlternativa;
  texto: string;
  correta: boolean;
  por_que_errou: string | null;
}

// 11. respostas
export interface Resposta {
  id: string;
  created_at: string;
  aluno_id: string;
  questao_id: string;
  alternativa_id: string;
  acertou: boolean;
  respondida_em: string;
}

// 12. frequencias
export interface Frequencia {
  id: string;
  created_at: string;
  oferta_id: string;
  aluno_id: string;
  data: string; // date YYYY-MM-DD
  status: StatusFrequencia;
  registrado_por: string;
}

// 13. avisos
export interface Aviso {
  id: string;
  created_at: string;
  escola_id: string;
  autor_id: string;
  turma_id: string | null; // null = escola toda
  titulo: string;
  mensagem: string;
  prioridade: PrioridadeAviso;
  publicado_em: string;
}

// 14. aluno_sessoes
export interface AlunoSessao {
  id: string;
  created_at: string;
  aluno_id: string;
  token_hash: string;
  expira_em: string;
  criado_em: string;
}

// 15. pin_tentativas
export interface PinTentativa {
  id: string;
  created_at: string;
  aluno_id: string;
  tentativa_em: string;
  sucesso: boolean;
}

/* =========================================================================
 * Tipos Auxiliares e Views Projetadas (Segurança do Aluno e Visualização)
 * ========================================================================= */

// Aluno resumido (retornado na listagem pública da turma)
export interface AlunoResumido {
  id: string;
  nome_completo: string;
  numero_chamada: number;
}

// Alternativa sem o campo 'correta' e sem 'por_que_errou' (proteção absoluta do aluno)
export interface AlternativaParaAluno {
  id: string;
  letra: LetraAlternativa;
  texto: string;
}

// Questão para o aluno (com feedback opcional apenas após resposta)
export interface QuestaoParaAluno {
  id: string;
  ordem: number;
  enunciado: string;
  dica: string | null;
  alternativas: AlternativaParaAluno[];
  respondida: boolean;
  alternativa_respondida_id?: string;
  // Feedback pedagógico exibido exclusivamente após o aluno responder
  acertou?: boolean;
  alternativa_correta_id?: string;
  por_que_errou?: string | null;
  explicacao?: string | null;
}

// Atividade entregue ao portal do aluno
export interface AtividadeParaAluno {
  id: string;
  titulo: string;
  descricao: string;
  prazo: string | null;
  status: StatusAtividade;
  disciplina_nome: string;
  professor_nome: string;
  questoes: QuestaoParaAluno[];
}

// Feedback imediato devolvido após a submissão de uma resposta
export interface RespostaFeedback {
  acertou: boolean;
  alternativa_correta_id: string;
  por_que_errou: string | null;
  explicacao: string | null;
}

// Resumo de atividade para o painel do aluno
export interface AtividadeResumoAluno {
  id: string;
  titulo: string;
  descricao: string;
  prazo: string | null;
  status: StatusAtividade;
  disciplina_id: string;
  disciplina_nome: string;
  total_questoes: number;
  questoes_respondidas: number;
  concluida: boolean;
  aproveitamento?: number;
}

// Questão com todas as alternativas (para visão do professor/gestão)
export interface QuestaoComAlternativas extends Questao {
  alternativas: Alternativa[];
}

// Atividade completa com questões e alternativas (para professor)
export interface AtividadeCompleta extends Atividade {
  questoes: QuestaoComAlternativas[];
}

// Oferta com nomes descritivos associados
export interface OfertaDetalhada extends Oferta {
  turma_nome: string;
  turma_codigo: string;
  disciplina_nome: string;
  professor_nome: string;
}

// Item do mapa de calor de uma questão
export interface ItemMapaDeCalorQuestao {
  questao_id: string;
  ordem: number;
  enunciado: string;
  total_respostas: number;
  total_acertos: number;
  porcentagem_acerto: number;
  distribuicao: Record<LetraAlternativa, { total: number; porcentagem: number; alternativa_id: string }>;
  distrator_mais_escolhido: {
    letra: LetraAlternativa | null;
    por_que_errou: string | null;
    total_escolhas: number;
  } | null;
}

export interface MapaDeCalorAtividade {
  atividade_id: string;
  titulo: string;
  total_alunos_responderam: number;
  questoes: ItemMapaDeCalorQuestao[];
}

// Boletim individual do aluno
export interface BoletimOfertaItem {
  oferta_id: string;
  disciplina_nome: string;
  professor_nome: string;
  atividades_concluidas: number;
  media_aproveitamento: number | null;
  frequencia_porcentagem: number | null;
  total_presencas: number;
  total_faltas: number;
  total_justificadas: number;
}

export interface BoletimAluno {
  aluno: AlunoPublico;
  turma: Turma;
  periodo_atual: Periodo;
  disciplinas: BoletimOfertaItem[];
}

// Item individual da ata de conselho de classe
export interface ItemConselhoAluno {
  aluno_id: string;
  numero_chamada: number;
  nome_completo: string;
  media_geral: number | null;
  frequencia_geral: number | null;
  situacao: SituacaoConselho;
}

export interface RelatorioConselho {
  turma: Turma;
  periodo: Periodo;
  alunos: ItemConselhoAluno[];
}

// Indicadores macro para a direção
export interface VisaoGeralEscola {
  total_alunos: number;
  total_professores: number;
  total_turmas: number;
  aproveitamento_medio_global: number | null;
  turmas_por_segmento: Record<SegmentoTurma, number>;
}
