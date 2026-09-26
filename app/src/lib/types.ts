/**
 * SaberPontual — Tipos das Entidades do Banco de Dados
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seção 4, 5 e 6)
 * Todos os nomes de campos seguem snake_case exatamente como especificado.
 */

export type PapelUsuario = 'direcao' | 'coordenacao' | 'professor';

export type SegmentoTurma = 'fund1' | 'fund2' | 'medio';

export type StatusAtividade = 'rascunho' | 'publicada' | 'encerrada';

export type ModoAtividade = 'prova' | 'exercicio';

export type LetraAlternativa = 'A' | 'B' | 'C' | 'D' | 'E';

export type PrioridadeAviso = 'baixa' | 'media' | 'alta';

export type FaixaDesempenho = 'Ótimo' | 'Bom' | 'Atenção' | 'Sem atividades';

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
  modo: ModoAtividade; // padrão 'exercicio'
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
  banco_questao_id?: string | null;
  assunto_id?: string | null;
  tipo?: TipoQuestao;
  imagem_url?: string | null;
  resposta_esperada?: string | null;
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

export type StatusCorrecao = 'pendente' | 'certo' | 'parcial' | 'errado';

export interface ItemCorrecaoPendente {
  resposta_id: string;
  questao_id: string;
  aluno_id: string;
  aluno_nome: string;
  nome_aluno: string;
  questao_ordem: number;
  questao_enunciado: string;
  enunciado: string;
  resposta_esperada: string | null;
  texto_resposta: string | null;
  respondida_em: string;
}

// 11. respostas
export interface Resposta {
  id: string;
  created_at: string;
  aluno_id: string;
  questao_id: string;
  alternativa_id: string | null;
  acertou: boolean | null;
  respondida_em: string;
  tentativas: number; // padrão 1
  acertou_final: boolean | null;
  texto_resposta?: string | null;
  pontuacao?: number | null;
  correcao?: StatusCorrecao | null;
  comentario_professor?: string | null;
  corrigido_por?: string | null;
  corrigido_em?: string | null;
}

// 12. avisos
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

// 13. aluno_sessoes
export interface AlunoSessao {
  id: string;
  created_at: string;
  aluno_id: string;
  token_hash: string;
  expira_em: string;
  criado_em: string;
}

// 14. pin_tentativas
export interface PinTentativa {
  id: string;
  created_at: string;
  aluno_id: string;
  tentativa_em: string;
  sucesso: boolean;
}

// 15. assuntos (Fase H1 - docs/ESPECIFICACAO.md 9.2)
export interface Assunto {
  id: string;
  created_at: string;
  escola_id: string;
  disciplina_id: string;
  nome: string;
}

// 16. banco_questoes (Fase H1 - docs/ESPECIFICACAO.md 9.2)
export type DificuldadeQuestao = 'facil' | 'medio' | 'dificil';
export type TipoQuestao = 'objetiva' | 'discursiva';
export type OrigemQuestao = 'manual' | 'ia';

export interface BancoQuestao {
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
  versao?: number;
  alternativas?: BancoAlternativa[];
  autor_nome?: string;
  assunto_nome?: string;
  disciplina_nome?: string;
}

// 17. banco_alternativas (Fase H1 - docs/ESPECIFICACAO.md 9.2)
export interface BancoAlternativa {
  id: string;
  created_at: string;
  banco_questao_id: string;
  letra: LetraAlternativa;
  texto: string;
  correta: boolean;
  por_que_errou: string | null;
}

// 18. Tipos do Gerador de Questões por IA (Fase H4 - docs/ESPECIFICACAO.md 9.6, 9.7)
export interface GerarQuestoesIAParams {
  disciplina_id: string;
  assunto_id: string;
  serie: string;
  qtd_total?: number;
  qtd_objetivas: number;
  qtd_discursivas: number; // subjetivas
  dificuldade?: DificuldadeQuestao | 'misturada';
  fotos?: string[];
  texto_base?: string;
  anexar_foto?: boolean;
}

export interface QuestaoSugeridaAlternativa {
  letra: LetraAlternativa;
  texto: string;
  correta: boolean;
  por_que_errou?: string | null;
}

export interface QuestaoSugeridaIA {
  id_temp: string;
  tipo: TipoQuestao;
  dificuldade: DificuldadeQuestao;
  enunciado: string;
  dica?: string | null;
  explicacao?: string | null;
  resposta_esperada?: string | null; // gabarito para discursivas
  imagem_url?: string | null;
  alternativas?: QuestaoSugeridaAlternativa[];
}

export interface RespostaGeracaoIA {
  questoes: QuestaoSugeridaIA[];
  texto_transcrito?: string;
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

// Alternativa sem o campo 'correta' e sem 'por_que_errou' (proteção do aluno)
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
  // Feedback pedagógico (no modo prova só é exposto após concluir todas as questões)
  acertou?: boolean;
  alternativa_correta_id?: string;
  por_que_errou?: string | null;
  explicacao?: string | null;
  tentativas?: number;
  acertou_final?: boolean;
}

// Atividade entregue ao portal do aluno
export interface AtividadeParaAluno {
  id: string;
  titulo: string;
  descricao: string;
  prazo: string | null;
  modo: ModoAtividade;
  status: StatusAtividade;
  disciplina_nome: string;
  professor_nome: string;
  questoes: QuestaoParaAluno[];
}

// Retorno imediato no modo exercício
export interface RespostaExercicio {
  modo: 'exercicio';
  acertou: boolean;
  alternativa_correta_id: string;
  por_que_errou: string | null;
  explicacao: string | null;
}

// Retorno imediato no modo prova (sem revelar gabarito antes do fim)
export interface RespostaProva {
  modo: 'prova';
  registrada: true;
}

// União discriminada de resposta do aluno
export type RespostaAlunoResultado = RespostaExercicio | RespostaProva;

// Feedback compatível para chamadas pedagógicas diretas
export interface RespostaFeedback {
  acertou: boolean;
  alternativa_correta_id: string;
  por_que_errou: string | null;
  explicacao: string | null;
}

// Item detalhado do resultado de prova
export interface ResultadoProvaQuestao {
  questao_id: string;
  ordem: number;
  enunciado: string;
  alternativa_escolhida_id: string | null;
  alternativa_correta_id: string;
  acertou: boolean;
  por_que_errou: string | null;
  explicacao: string | null;
}

// Resultado consolidado de média de aluno em atividades (seção 6)
export interface ResultadoMediaAluno {
  media: number | null;
  atividades_avaliadas: number;
  soma_acertos: number;
  soma_questoes: number;
}

// Resultado final de prova entregue ao aluno após concluir todas as questões
export interface ResultadoProva {
  atividade_id: string;
  titulo: string;
  total_questoes: number;
  acertos: number;
  erros: number;
  aproveitamento: number;
  questoes: ResultadoProvaQuestao[];
}

// Resumo de atividade para o painel do aluno
export interface AtividadeResumoAluno {
  id: string;
  titulo: string;
  descricao: string;
  prazo: string | null;
  modo: ModoAtividade;
  status: StatusAtividade;
  disciplina_id: string;
  disciplina_nome: string;
  total_questoes: number;
  questoes_respondidas: number;
  concluida: boolean;
  aproveitamento?: number;
}

// Questão com todas as alternativas (para professor/gestão)
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
  turma_serie?: string;
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

// Item de desempenho por disciplina para o aluno
export interface DesempenhoDisciplinaItem {
  oferta_id: string;
  disciplina_nome: string;
  professor_nome: string;
  atividades_concluidas: number;
  media_periodo: number | null;
  faixa: FaixaDesempenho;
}

// Meu Desempenho do Aluno (seção 6.3)
export interface MeuDesempenhoAluno {
  aluno: AlunoPublico;
  turma: Turma;
  periodo_atual: Periodo;
  disciplinas: DesempenhoDisciplinaItem[];
}

/* =========================================================================
 * Novos Relatórios do Professor (Acompanhamento)
 * ========================================================================= */

export interface DesempenhoOfertaAtividadeAluno {
  atividade_id: string;
  titulo: string;
  modo: ModoAtividade;
  concluida: boolean;
  aproveitamento: number | null;
}

export interface DesempenhoOfertaAluno {
  aluno_id: string;
  nome_completo: string;
  numero_chamada: number;
  atividades: DesempenhoOfertaAtividadeAluno[];
  media: number | null;
  faixa: FaixaDesempenho;
}

export interface RelatorioDesempenhoOferta {
  oferta_id: string;
  turma_nome: string;
  disciplina_nome: string;
  periodo_nome: string;
  atividades: Array<{ id: string; titulo: string; modo: ModoAtividade }>;
  alunos: DesempenhoOfertaAluno[];
}

export interface FichaAlunoQuestaoItem {
  questao_id: string;
  ordem: number;
  enunciado: string;
  alternativa_escolhida_id: string | null;
  alternativa_correta_id: string;
  acertou: boolean | null;
  tentativas: number;
  acertou_final: boolean | null;
}

export interface FichaAlunoAtividadeItem {
  atividade_id: string;
  titulo: string;
  modo: ModoAtividade;
  status_aluno: 'concluida' | 'em_andamento' | 'pendente';
  aproveitamento: number | null;
  questoes: FichaAlunoQuestaoItem[];
}

export interface FichaAluno {
  aluno: AlunoPublico;
  turma_nome: string;
  disciplina_nome: string;
  atividades: FichaAlunoAtividadeItem[];
  media_periodo: number | null;
  faixa: FaixaDesempenho;
}

/* =========================================================================
 * Novos Relatórios da Gestão
 * ========================================================================= */

export interface VisaoGeralEscola {
  total_alunos: number;
  total_turmas: number;
  total_professores: number;
  total_atividades_publicadas: number;
  aproveitamento_medio: number | null;
}

export interface DesempenhoTurmaDisciplinaItem {
  turma_id: string;
  turma_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
  professor_nome: string;
  total_alunos: number;
  aproveitamento_medio: number | null;
  faixas: {
    otimo: number;
    bom: number;
    atencao: number;
    sem_atividades: number;
  };
}

export interface AlunoEmAtencaoItem {
  aluno_id: string;
  nome_completo: string;
  numero_chamada: number;
  turma_nome: string;
  disciplina_nome: string;
  professor_nome: string;
  media: number;
  faixa: 'Atenção';
}

export interface QuestaoCriticaEscolaItem {
  questao_id: string;
  atividade_id: string;
  atividade_titulo: string;
  turma_nome: string;
  disciplina_nome: string;
  professor_nome: string;
  ordem: number;
  enunciado: string;
  total_respostas: number;
  porcentagem_acerto: number;
  distrator_mais_escolhido: {
    letra: LetraAlternativa | null;
    por_que_errou: string | null;
    total_escolhas: number;
  } | null;
}
