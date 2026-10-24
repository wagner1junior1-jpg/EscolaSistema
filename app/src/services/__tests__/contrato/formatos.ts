/**
 * SaberPontual — Validadores de Formato de Contrato (Fase 5.8)
 *
 * Funções puras que verificam objetos devolvidos pelos serviços contra os contratos
 * e tipos do app (app/src/services/contracts.ts e app/src/lib/types.ts).
 *
 * Devolvem uma lista de strings descrevendo problemas encontrados (vazia = OK).
 * Não utiliza nenhuma dependência externa (sem zod, joi, etc.).
 */

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehStringNaoVazia(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * Validador de AlunoResumido
 */
export function validarAlunoResumido(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['AlunoResumido deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.id)) erros.push('id deve ser string não vazia');
  if (!ehStringNaoVazia(obj.nome_completo)) erros.push('nome_completo deve ser string não vazia');
  if (typeof obj.numero_chamada !== 'number' || !Number.isInteger(obj.numero_chamada) || obj.numero_chamada < 1) {
    erros.push('numero_chamada deve ser um número inteiro >= 1');
  }

  return erros;
}

/**
 * Validador de AtividadeResumoAluno (para o painel do aluno)
 */
export function validarAtividadeResumoAluno(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['AtividadeResumoAluno deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.id)) erros.push('id deve ser string não vazia');
  if (!ehStringNaoVazia(obj.titulo)) erros.push('titulo deve ser string não vazia');
  if (typeof obj.descricao !== 'string') erros.push('descricao deve ser string');
  if (obj.prazo !== null && typeof obj.prazo !== 'string') erros.push('prazo deve ser string ou null');
  if (typeof obj.prazo_vencido !== 'boolean') erros.push('prazo_vencido deve ser booleano');
  if (obj.modo !== 'exercicio' && obj.modo !== 'prova') erros.push("modo deve ser 'exercicio' ou 'prova'");
  if (obj.status !== 'publicada' && obj.status !== 'encerrada' && obj.status !== 'rascunho') {
    erros.push("status deve ser 'publicada', 'encerrada' ou 'rascunho'");
  }
  if (typeof obj.disciplina_id !== 'string') erros.push('disciplina_id deve ser string');
  if (!ehStringNaoVazia(obj.disciplina_nome)) erros.push('disciplina_nome deve ser string não vazia');
  if (typeof obj.total_questoes !== 'number' || obj.total_questoes < 0) erros.push('total_questoes deve ser number >= 0');
  if (typeof obj.questoes_respondidas !== 'number' || obj.questoes_respondidas < 0) {
    erros.push('questoes_respondidas deve ser number >= 0');
  }
  if (typeof obj.concluida !== 'boolean') erros.push('concluida deve ser booleano');

  if (obj.aproveitamento !== undefined) {
    if (typeof obj.aproveitamento !== 'number' || obj.aproveitamento < 0 || obj.aproveitamento > 100) {
      erros.push('aproveitamento deve ser number entre 0 e 100 quando presente');
    }
  }

  if (obj.aguardando_correcao !== undefined && typeof obj.aguardando_correcao !== 'boolean') {
    erros.push('aguardando_correcao deve ser booleano quando presente');
  }

  return erros;
}

/**
 * Validador de AlternativaParaAluno
 * Regra: NUNCA deve conter 'correta' nem 'por_que_errou'.
 */
export function validarAlternativaParaAluno(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['AlternativaParaAluno deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.id)) erros.push('id deve ser string não vazia');
  if (typeof obj.letra !== 'string' || !['A', 'B', 'C', 'D', 'E'].includes(obj.letra)) {
    erros.push("letra deve ser 'A', 'B', 'C', 'D' ou 'E'");
  }
  if (typeof obj.texto !== 'string') erros.push('texto deve ser string');

  // Proteção estrita de sigilo de gabarito:
  if ('correta' in obj) {
    erros.push("Violação de sigilo: AlternativaParaAluno NUNCA deve conter o campo 'correta'");
  }
  if ('por_que_errou' in obj) {
    erros.push("Violação de sigilo: AlternativaParaAluno NUNCA deve conter o campo 'por_que_errou'");
  }

  return erros;
}

/**
 * Validador de QuestaoParaAluno
 * Regras de sigilo de gabarito e feedback pedagógico.
 */
export function validarQuestaoParaAluno(
  obj: unknown,
  atividadeModo?: 'exercicio' | 'prova',
  atividadeStatus?: 'publicada' | 'encerrada',
  provaCompleta?: boolean
): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['QuestaoParaAluno deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.id)) erros.push('id deve ser string não vazia');
  if (typeof obj.ordem !== 'number' || obj.ordem < 1) erros.push('ordem deve ser number >= 1');
  if (!ehStringNaoVazia(obj.enunciado)) erros.push('enunciado deve ser string não vazia');
  if (obj.dica !== undefined && obj.dica !== null && typeof obj.dica !== 'string') {
    erros.push('dica deve ser string, null ou undefined');
  }
  if (typeof obj.respondida !== 'boolean') erros.push('respondida deve ser booleano');

  if (obj.tipo !== undefined && obj.tipo !== 'objetiva' && obj.tipo !== 'discursiva') {
    erros.push("tipo deve ser 'objetiva' ou 'discursiva'");
  }

  if (obj.imagem_url !== undefined && obj.imagem_url !== null && typeof obj.imagem_url !== 'string') {
    erros.push('imagem_url deve ser string ou null quando presente');
  }

  if (!Array.isArray(obj.alternativas)) {
    erros.push('alternativas deve ser um array');
  } else {
    obj.alternativas.forEach((alt, idx) => {
      const errAlt = validarAlternativaParaAluno(alt);
      errAlt.forEach((e) => erros.push(`alternativas[${idx}]: ${e}`));
    });
  }

  // Regra 1: Prova publicada e incompleta NUNCA deve expor feedback pedagógico,
  // mesmo nas questões que o aluno já respondeu.
  if (atividadeModo === 'prova' && atividadeStatus === 'publicada' && !provaCompleta) {
    if (obj.acertou !== undefined) erros.push('Prova incompleta não pode expor acertou');
    if (obj.alternativa_correta_id !== undefined) erros.push('Prova incompleta não pode expor alternativa_correta_id');
    if (obj.por_que_errou !== undefined) erros.push('Prova incompleta não pode expor por_que_errou');
    if (obj.explicacao !== undefined) erros.push('Prova incompleta não pode expor explicacao');
    if (obj.tentativas !== undefined) erros.push('Prova incompleta não pode expor tentativas');
    if (obj.acertou_final !== undefined) erros.push('Prova incompleta não pode expor acertou_final');
  }

  // Regra 2: Questão não respondida em atividade publicada (não encerrada)
  // NUNCA deve expor alternativa_correta_id, por_que_errou nem explicacao.
  if (atividadeStatus !== 'encerrada' && !obj.respondida) {
    if (obj.alternativa_correta_id !== undefined) {
      erros.push('Questão não respondida não pode expor alternativa_correta_id');
    }
    if (obj.por_que_errou !== undefined) {
      erros.push('Questão não respondida não pode expor por_que_errou');
    }
    if (obj.explicacao !== undefined) {
      erros.push('Questão não respondida não pode expor explicacao');
    }
  }

  return erros;
}

/**
 * Validador de AtividadeParaAluno
 */
export function validarAtividadeParaAluno(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['AtividadeParaAluno deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.id)) erros.push('id deve ser string não vazia');
  if (!ehStringNaoVazia(obj.titulo)) erros.push('titulo deve ser string não vazia');
  if (typeof obj.descricao !== 'string') erros.push('descricao deve ser string');
  if (obj.prazo !== null && typeof obj.prazo !== 'string') erros.push('prazo deve ser string ou null');
  if (obj.modo !== 'exercicio' && obj.modo !== 'prova') erros.push("modo deve ser 'exercicio' ou 'prova'");
  if (obj.status !== 'publicada' && obj.status !== 'encerrada') erros.push("status deve ser 'publicada' ou 'encerrada'");
  if (!ehStringNaoVazia(obj.disciplina_nome)) erros.push('disciplina_nome deve ser string não vazia');
  if (!ehStringNaoVazia(obj.professor_nome)) erros.push('professor_nome deve ser string não vazia');

  if (!Array.isArray(obj.questoes)) {
    erros.push('questoes deve ser um array');
  } else {
    const modo = obj.modo as 'exercicio' | 'prova';
    const status = obj.status as 'publicada' | 'encerrada';
    const total = obj.questoes.length;
    const respondidas = obj.questoes.filter((q) => ehObjeto(q) && q.respondida === true).length;
    const completa = total > 0 && respondidas === total;

    obj.questoes.forEach((q, idx) => {
      const errQ = validarQuestaoParaAluno(q, modo, status, completa);
      errQ.forEach((e) => erros.push(`questoes[${idx}]: ${e}`));
    });
  }

  return erros;
}

/**
 * Validador de RespostaAlunoResultado (união discriminada RespostaExercicio | RespostaProva)
 */
export function validarRespostaAlunoResultado(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['RespostaAlunoResultado deve ser um objeto válido'];

  if (obj.modo === 'prova') {
    if (obj.registrada !== true) erros.push("RespostaProva deve conter registrada: true");
    // Sigilo estrito de prova ao responder:
    if ('acertou' in obj) erros.push("RespostaProva não pode expor 'acertou'");
    if ('alternativa_correta_id' in obj) erros.push("RespostaProva não pode expor 'alternativa_correta_id'");
    if ('por_que_errou' in obj) erros.push("RespostaProva não pode expor 'por_que_errou'");
    if ('explicacao' in obj) erros.push("RespostaProva não pode expor 'explicacao'");
  } else if (obj.modo === 'exercicio') {
    if (typeof obj.acertou !== 'boolean') erros.push('RespostaExercicio deve conter acertou booleano');
    if (!ehStringNaoVazia(obj.alternativa_correta_id)) {
      erros.push('RespostaExercicio deve conter alternativa_correta_id como string não vazia');
    }
    if (obj.por_que_errou !== null && typeof obj.por_que_errou !== 'string') {
      erros.push('RespostaExercicio deve conter por_que_errou como string ou null');
    }
    if (obj.explicacao !== null && typeof obj.explicacao !== 'string') {
      erros.push('RespostaExercicio deve conter explicacao como string ou null');
    }
  } else {
    erros.push("modo deve ser 'exercicio' ou 'prova'");
  }

  return erros;
}

/**
 * Validador de RespostaExercicio (retorno de tentarNovamente)
 */
export function validarRespostaExercicio(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['RespostaExercicio deve ser um objeto válido'];

  if (obj.modo !== 'exercicio') erros.push("modo deve ser 'exercicio'");
  if (typeof obj.acertou !== 'boolean') erros.push('acertou deve ser booleano');
  if (!ehStringNaoVazia(obj.alternativa_correta_id)) {
    erros.push('alternativa_correta_id deve ser string não vazia');
  }
  if (obj.por_que_errou !== null && typeof obj.por_que_errou !== 'string') {
    erros.push('por_que_errou deve ser string ou null');
  }
  if (obj.explicacao !== null && typeof obj.explicacao !== 'string') {
    erros.push('explicacao deve ser string ou null');
  }

  return erros;
}

/**
 * Validador de ResultadoProva
 */
export function validarResultadoProva(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['ResultadoProva deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.atividade_id)) erros.push('atividade_id deve ser string não vazia');
  if (!ehStringNaoVazia(obj.titulo)) erros.push('titulo deve ser string não vazia');
  if (typeof obj.total_questoes !== 'number' || obj.total_questoes < 0) erros.push('total_questoes deve ser number >= 0');
  if (typeof obj.acertos !== 'number' || obj.acertos < 0) erros.push('acertos deve ser number >= 0');
  if (typeof obj.erros !== 'number' || obj.erros < 0) erros.push('erros deve ser number >= 0');
  if (typeof obj.aproveitamento !== 'number' || obj.aproveitamento < 0 || obj.aproveitamento > 100) {
    erros.push('aproveitamento deve ser number entre 0 e 100');
  }

  if (!Array.isArray(obj.questoes)) {
    erros.push('questoes deve ser um array');
  } else {
    obj.questoes.forEach((q, idx) => {
      if (!ehObjeto(q)) {
        erros.push(`questoes[${idx}] deve ser um objeto`);
        return;
      }
      if (!ehStringNaoVazia(q.questao_id)) erros.push(`questoes[${idx}].questao_id deve ser string`);
      if (typeof q.ordem !== 'number') erros.push(`questoes[${idx}].ordem deve ser number`);
      if (typeof q.enunciado !== 'string') erros.push(`questoes[${idx}].enunciado deve ser string`);
      if (q.alternativa_escolhida_id !== null && typeof q.alternativa_escolhida_id !== 'string') {
        erros.push(`questoes[${idx}].alternativa_escolhida_id deve ser string ou null`);
      }
      if (typeof q.alternativa_correta_id !== 'string') {
        erros.push(`questoes[${idx}].alternativa_correta_id deve ser string`);
      }
      if (typeof q.acertou !== 'boolean') erros.push(`questoes[${idx}].acertou deve ser booleano`);
      if (q.por_que_errou !== null && typeof q.por_que_errou !== 'string') {
        erros.push(`questoes[${idx}].por_que_errou deve ser string ou null`);
      }
      if (q.explicacao !== null && typeof q.explicacao !== 'string') {
        erros.push(`questoes[${idx}].explicacao deve ser string ou null`);
      }
    });
  }

  return erros;
}

/**
 * Validador de MeuDesempenhoAluno
 */
export function validarMeuDesempenhoAluno(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['MeuDesempenhoAluno deve ser um objeto válido'];

  // Aluno
  if (!ehObjeto(obj.aluno)) {
    erros.push('aluno deve ser um objeto AlunoPublico');
  } else {
    if (!ehStringNaoVazia(obj.aluno.id)) erros.push('aluno.id deve ser string');
    if (!ehStringNaoVazia(obj.aluno.nome_completo)) erros.push('aluno.nome_completo deve ser string');
    if (typeof obj.aluno.numero_chamada !== 'number') erros.push('aluno.numero_chamada deve ser number');
    if (typeof obj.aluno.ativo !== 'boolean') erros.push('aluno.ativo deve ser booleano');
    if ('pin_hash' in obj.aluno) {
      erros.push("Violação de segurança: AlunoPublico NUNCA deve conter o campo 'pin_hash'");
    }
  }

  // Turma
  if (!ehObjeto(obj.turma)) {
    erros.push('turma deve ser um objeto');
  } else {
    if (!ehStringNaoVazia(obj.turma.id)) erros.push('turma.id deve ser string');
    if (!ehStringNaoVazia(obj.turma.nome)) erros.push('turma.nome deve ser string');
  }

  // Periodo atual
  if (!ehObjeto(obj.periodo_atual)) {
    erros.push('periodo_atual deve ser um objeto');
  } else {
    if (!ehStringNaoVazia(obj.periodo_atual.id)) erros.push('periodo_atual.id deve ser string');
    if (!ehStringNaoVazia(obj.periodo_atual.nome)) erros.push('periodo_atual.nome deve ser string');
  }

  // Disciplinas
  if (!Array.isArray(obj.disciplinas)) {
    erros.push('disciplinas deve ser um array');
  } else {
    obj.disciplinas.forEach((d, idx) => {
      if (!ehObjeto(d)) {
        erros.push(`disciplinas[${idx}] deve ser um objeto`);
        return;
      }
      if (!ehStringNaoVazia(d.oferta_id)) erros.push(`disciplinas[${idx}].oferta_id deve ser string`);
      if (!ehStringNaoVazia(d.disciplina_nome)) erros.push(`disciplinas[${idx}].disciplina_nome deve ser string`);
      if (!ehStringNaoVazia(d.professor_nome)) erros.push(`disciplinas[${idx}].professor_nome deve ser string`);
      if (typeof d.atividades_concluidas !== 'number') {
        erros.push(`disciplinas[${idx}].atividades_concluidas deve ser number`);
      }
      if (d.media_periodo !== null && typeof d.media_periodo !== 'number') {
        erros.push(`disciplinas[${idx}].media_periodo deve ser number ou null`);
      }
      if (!['Ótimo', 'Bom', 'Atenção', 'Sem atividades'].includes(d.faixa as string)) {
        erros.push(`disciplinas[${idx}].faixa deve ser 'Ótimo', 'Bom', 'Atenção' ou 'Sem atividades'`);
      }
    });
  }

  return erros;
}

/**
 * Validador de Aviso
 */
export function validarAviso(obj: unknown): string[] {
  const erros: string[] = [];
  if (!ehObjeto(obj)) return ['Aviso deve ser um objeto válido'];

  if (!ehStringNaoVazia(obj.id)) erros.push('id deve ser string não vazia');
  if (typeof obj.created_at !== 'string') erros.push('created_at deve ser string');
  if (!ehStringNaoVazia(obj.escola_id)) erros.push('escola_id deve ser string');
  if (!ehStringNaoVazia(obj.autor_id)) erros.push('autor_id deve ser string');
  if (obj.turma_id !== null && typeof obj.turma_id !== 'string') erros.push('turma_id deve ser string ou null');
  if (!ehStringNaoVazia(obj.titulo)) erros.push('titulo deve ser string');
  if (!ehStringNaoVazia(obj.mensagem)) erros.push('mensagem deve ser string');
  if (!['baixa', 'media', 'alta', 'urgente'].includes(obj.prioridade as string)) {
    erros.push("prioridade deve ser 'baixa', 'media', 'alta' ou 'urgente'");
  }
  if (typeof obj.publicado_em !== 'string') erros.push('publicado_em deve ser string');

  return erros;
}

