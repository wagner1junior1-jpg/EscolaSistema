/**
 * SaberPontual — Lógica pura de mapeamento e preparação do Seed Supabase
 *
 * Funções determinísticas sem efeitos colaterais de rede:
 * - Geração idempotente de UUID v5 (RFC 4122) com namespace fixo
 * - Identificação determinística de entidades por idDe(tabela, idLegivel)
 * - Resolução de PINs por tabela de dispersão pré-computada (0000 a 9999)
 * - Mapeamento de entidades do mock em linhas prontas para o Postgres (com validação de FKs)
 */

import { createHash } from 'node:crypto';
import type { MockDatabaseSchema } from '../services/mock/seed';

export const NAMESPACE_SEED = '4b1a4747-920f-48d6-95a7-5ef7364868cb';

/**
 * Gera um UUID v5 (RFC 4122) a partir de um namespace e nome arbitrários via SHA-1.
 */
export function uuidV5Com(namespace: string, nome: string): string {
  const nsClean = namespace.replace(/-/g, '');
  const nsBuffer = Buffer.from(nsClean, 'hex');
  const nomeBuffer = Buffer.from(nome, 'utf8');
  const hash = createHash('sha1').update(Buffer.concat([nsBuffer, nomeBuffer])).digest();

  // RFC 4122 seção 4.3:
  // Octeto 6: bits 4-7 = 0101 (versão 5)
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Octeto 8: bits 6-7 = 10 (variante 1, RFC 4122)
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Gera um UUID v5 usando o namespace fixo do seed.
 */
export function uuidV5(nome: string): string {
  return uuidV5Com(NAMESPACE_SEED, nome);
}

/**
 * Produz um UUID determinístico para uma entidade com base em sua tabela e id legível.
 */
export function idDe(tabela: string, idLegivel: string): string {
  return uuidV5(`${tabela}:${idLegivel}`);
}

let tabelaPinsCache: Map<string, string> | null = null;

function obterTabelaPins(): Map<string, string> {
  if (tabelaPinsCache) return tabelaPinsCache;
  const mapa = new Map<string, string>();
  for (let i = 0; i <= 9999; i++) {
    const pin = i.toString().padStart(4, '0');
    const hash = createHash('sha256').update(`saberpontual_pin_${pin}`).digest('hex');
    mapa.set(hash, pin);
  }
  tabelaPinsCache = mapa;
  return mapa;
}

/**
 * Recupera os PINs em texto puro a partir dos hashes SHA-256 armazenados no mock.
 * Lança erro com o id do aluno caso algum hash não seja reconhecido.
 */
export function recuperarPins(alunos: Array<{ id: string; pin_hash?: string }>): Map<string, string> {
  const tabela = obterTabelaPins();
  const resultado = new Map<string, string>();
  for (const aluno of alunos) {
    if (!aluno.pin_hash) {
      throw new Error(`Aluno '${aluno.id}' não possui pin_hash.`);
    }
    const pin = tabela.get(aluno.pin_hash);
    if (!pin) {
      throw new Error(`Não foi possível recuperar o PIN do aluno '${aluno.id}': hash desconhecido '${aluno.pin_hash}'.`);
    }
    resultado.set(aluno.id, pin);
  }
  return resultado;
}

export interface LinhasPostgres {
  escolas: Array<Record<string, any>>;
  perfis: Array<Record<string, any>>;
  periodos: Array<Record<string, any>>;
  disciplinas: Array<Record<string, any>>;
  turmas: Array<Record<string, any>>;
  ofertas: Array<Record<string, any>>;
  alunos: Array<Record<string, any>>;
  assuntos: Array<Record<string, any>>;
  banco_questoes: Array<Record<string, any>>;
  banco_alternativas: Array<Record<string, any>>;
  atividades: Array<Record<string, any>>;
  questoes: Array<Record<string, any>>;
  alternativas: Array<Record<string, any>>;
  respostas: Array<Record<string, any>>;
  avisos: Array<Record<string, any>>;
  aluno_observacoes: Array<Record<string, any>>;
}

/**
 * Transforma uma base do mock em linhas prontas para o Supabase Postgres com UUIDs
 * e validação estrita de integridade referencial.
 */
export function montarLinhas(
  db: MockDatabaseSchema,
  mapaPerfis: Map<string, string> | Record<string, string>
): LinhasPostgres {
  const escolasSet = new Set(db.escolas.map((e) => e.id));
  const perfisSet = new Set(db.perfis.map((p) => p.id));
  const periodosSet = new Set(db.periodos.map((p) => p.id));
  const disciplinasSet = new Set(db.disciplinas.map((d) => d.id));
  const turmasSet = new Set(db.turmas.map((t) => t.id));
  const ofertasSet = new Set(db.ofertas.map((o) => o.id));
  const alunosSet = new Set(db.alunos.map((a) => a.id));
  const assuntosSet = new Set(db.assuntos.map((as) => as.id));
  const bancoQuestoesSet = new Set(db.banco_questoes.map((bq) => bq.id));
  const atividadesSet = new Set(db.atividades.map((at) => at.id));
  const questoesSet = new Set(db.questoes.map((q) => q.id));
  const alternativasSet = new Set(db.alternativas.map((alt) => alt.id));

  function verificarFK(
    tabela: string,
    coluna: string,
    id: string | null | undefined,
    conjuntoValido: Set<string>,
    tabelaDestino: string
  ) {
    if (id === null || id === undefined || id === '') return;
    if (!conjuntoValido.has(id)) {
      throw new Error(
        `Chave estrangeira inválida na tabela '${tabela}', coluna '${coluna}': id '${id}' não encontrado em '${tabelaDestino}'.`
      );
    }
  }

  function getPerfilUuid(
    perfilId: string,
    tabelaOrigem: string,
    colunaOrigem: string
  ): string {
    if (!perfisSet.has(perfilId)) {
      throw new Error(
        `Chave estrangeira inválida na tabela '${tabelaOrigem}', coluna '${colunaOrigem}': perfil '${perfilId}' não encontrado em 'perfis'.`
      );
    }
    const uuid = mapaPerfis instanceof Map ? mapaPerfis.get(perfilId) : mapaPerfis[perfilId];
    if (!uuid) {
      throw new Error(
        `Perfil '${perfilId}' referenciado em '${tabelaOrigem}.${colunaOrigem}' não encontrado no mapa de perfis do Auth.`
      );
    }
    return uuid;
  }

  // 1. escolas
  const escolas = db.escolas.map((e) => ({
    id: idDe('escolas', e.id),
    nome: e.nome,
    cidade_uf: e.cidade_uf,
    ano_letivo_atual: e.ano_letivo_atual ?? 2026,
    limite_otimo: (e as any).limite_otimo ?? 80,
    limite_bom: (e as any).limite_bom ?? 60,
    cota_ia_mensal: (e as any).cota_ia_mensal ?? 200,
    created_at: e.created_at,
  }));

  // 2. perfis
  const perfis = db.perfis.map((p) => {
    verificarFK('perfis', 'escola_id', p.escola_id, escolasSet, 'escolas');
    return {
      id: getPerfilUuid(p.id, 'perfis', 'id'),
      escola_id: idDe('escolas', p.escola_id),
      nome: p.nome,
      email: p.email,
      papel: p.papel,
      ativo: p.ativo,
      trocar_senha: false,
      created_at: p.created_at,
    };
  });

  // 3. periodos
  const periodos = db.periodos.map((per) => {
    verificarFK('periodos', 'escola_id', per.escola_id, escolasSet, 'escolas');
    return {
      id: idDe('periodos', per.id),
      escola_id: idDe('escolas', per.escola_id),
      nome: per.nome,
      ano_letivo: per.ano_letivo,
      data_inicio: per.data_inicio,
      data_fim: per.data_fim,
      ativo: per.ativo,
      created_at: per.created_at,
    };
  });

  // 4. disciplinas
  const disciplinas = db.disciplinas.map((d) => {
    verificarFK('disciplinas', 'escola_id', d.escola_id, escolasSet, 'escolas');
    return {
      id: idDe('disciplinas', d.id),
      escola_id: idDe('escolas', d.escola_id),
      nome: d.nome,
      created_at: d.created_at,
    };
  });

  // 5. turmas
  const turmas = db.turmas.map((t) => {
    verificarFK('turmas', 'escola_id', t.escola_id, escolasSet, 'escolas');
    return {
      id: idDe('turmas', t.id),
      escola_id: idDe('escolas', t.escola_id),
      nome: t.nome,
      serie: t.serie,
      segmento: t.segmento,
      ano_letivo: t.ano_letivo,
      codigo_acesso: t.codigo_acesso,
      ativa: t.ativa,
      created_at: t.created_at,
    };
  });

  // 6. ofertas
  const ofertas = db.ofertas.map((o) => {
    verificarFK('ofertas', 'turma_id', o.turma_id, turmasSet, 'turmas');
    verificarFK('ofertas', 'disciplina_id', o.disciplina_id, disciplinasSet, 'disciplinas');
    return {
      id: idDe('ofertas', o.id),
      turma_id: idDe('turmas', o.turma_id),
      disciplina_id: idDe('disciplinas', o.disciplina_id),
      professor_id: getPerfilUuid(o.professor_id, 'ofertas', 'professor_id'),
      created_at: o.created_at,
    };
  });

  // 7. alunos
  const alunos = db.alunos.map((a) => {
    verificarFK('alunos', 'escola_id', a.escola_id, escolasSet, 'escolas');
    verificarFK('alunos', 'turma_id', a.turma_id, turmasSet, 'turmas');
    return {
      id: idDe('alunos', a.id),
      escola_id: idDe('escolas', a.escola_id),
      turma_id: idDe('turmas', a.turma_id),
      nome_completo: a.nome_completo,
      numero_chamada: a.numero_chamada,
      ativo: a.ativo,
      created_at: a.created_at,
    };
  });

  // 8. assuntos
  const assuntos = db.assuntos.map((as) => {
    verificarFK('assuntos', 'escola_id', as.escola_id, escolasSet, 'escolas');
    verificarFK('assuntos', 'disciplina_id', as.disciplina_id, disciplinasSet, 'disciplinas');
    return {
      id: idDe('assuntos', as.id),
      escola_id: idDe('escolas', as.escola_id),
      disciplina_id: idDe('disciplinas', as.disciplina_id),
      nome: as.nome,
      created_at: as.created_at,
    };
  });

  // 9. banco_questoes
  const banco_questoes = db.banco_questoes.map((bq) => {
    verificarFK('banco_questoes', 'escola_id', bq.escola_id, escolasSet, 'escolas');
    verificarFK('banco_questoes', 'disciplina_id', bq.disciplina_id, disciplinasSet, 'disciplinas');
    verificarFK('banco_questoes', 'assunto_id', bq.assunto_id, assuntosSet, 'assuntos');
    return {
      id: idDe('banco_questoes', bq.id),
      escola_id: idDe('escolas', bq.escola_id),
      disciplina_id: idDe('disciplinas', bq.disciplina_id),
      assunto_id: idDe('assuntos', bq.assunto_id),
      criado_por: getPerfilUuid(bq.criado_por, 'banco_questoes', 'criado_por'),
      serie: bq.serie,
      tipo: bq.tipo || 'objetiva',
      dificuldade: bq.dificuldade || 'medio',
      enunciado: bq.enunciado,
      imagem_url: bq.imagem_url ?? null,
      dica: bq.dica ?? null,
      explicacao: bq.explicacao ?? null,
      resposta_esperada: bq.resposta_esperada ?? null,
      origem: bq.origem || 'manual',
      arquivada: bq.arquivada ?? false,
      created_at: bq.created_at,
    };
  });

  // 10. banco_alternativas
  const banco_alternativas = db.banco_alternativas.map((ba) => {
    verificarFK(
      'banco_alternativas',
      'banco_questao_id',
      ba.banco_questao_id,
      bancoQuestoesSet,
      'banco_questoes'
    );
    return {
      id: idDe('banco_alternativas', ba.id),
      banco_questao_id: idDe('banco_questoes', ba.banco_questao_id),
      letra: ba.letra,
      texto: ba.texto,
      correta: ba.correta ?? false,
      por_que_errou: ba.por_que_errou ?? null,
    };
  });

  // 11. atividades
  const atividades = db.atividades.map((at) => {
    verificarFK('atividades', 'oferta_id', at.oferta_id, ofertasSet, 'ofertas');
    verificarFK('atividades', 'periodo_id', at.periodo_id, periodosSet, 'periodos');
    return {
      id: idDe('atividades', at.id),
      oferta_id: idDe('ofertas', at.oferta_id),
      periodo_id: idDe('periodos', at.periodo_id),
      titulo: at.titulo,
      descricao: at.descricao ?? '',
      prazo: at.prazo ?? null,
      modo: at.modo || 'exercicio',
      status: at.status || 'rascunho',
      criado_por: getPerfilUuid(at.criado_por, 'atividades', 'criado_por'),
      created_at: at.created_at,
    };
  });

  // 12. questoes
  const questoes = db.questoes.map((q) => {
    verificarFK('questoes', 'atividade_id', q.atividade_id, atividadesSet, 'atividades');
    verificarFK('questoes', 'banco_questao_id', q.banco_questao_id, bancoQuestoesSet, 'banco_questoes');
    verificarFK('questoes', 'assunto_id', q.assunto_id, assuntosSet, 'assuntos');
    return {
      id: idDe('questoes', q.id),
      atividade_id: idDe('atividades', q.atividade_id),
      ordem: q.ordem,
      tipo: q.tipo || 'objetiva',
      dificuldade: q.dificuldade || 'medio',
      enunciado: q.enunciado,
      imagem_url: q.imagem_url ?? null,
      dica: q.dica ?? null,
      explicacao: q.explicacao ?? null,
      resposta_esperada: q.resposta_esperada ?? null,
      banco_questao_id: q.banco_questao_id ? idDe('banco_questoes', q.banco_questao_id) : null,
      assunto_id: q.assunto_id ? idDe('assuntos', q.assunto_id) : null,
      created_at: q.created_at,
    };
  });

  // 13. alternativas
  const alternativas = db.alternativas.map((alt) => {
    verificarFK('alternativas', 'questao_id', alt.questao_id, questoesSet, 'questoes');
    return {
      id: idDe('alternativas', alt.id),
      questao_id: idDe('questoes', alt.questao_id),
      letra: alt.letra,
      texto: alt.texto,
      correta: alt.correta ?? false,
      por_que_errou: alt.por_que_errou ?? null,
    };
  });

  // 14. respostas
  const respostas = db.respostas.map((r) => {
    verificarFK('respostas', 'aluno_id', r.aluno_id, alunosSet, 'alunos');
    verificarFK('respostas', 'questao_id', r.questao_id, questoesSet, 'questoes');
    verificarFK('respostas', 'alternativa_id', r.alternativa_id, alternativasSet, 'alternativas');
    return {
      id: idDe('respostas', r.id),
      aluno_id: idDe('alunos', r.aluno_id),
      questao_id: idDe('questoes', r.questao_id),
      alternativa_id: r.alternativa_id ? idDe('alternativas', r.alternativa_id) : null,
      acertou: r.acertou ?? null,
      pontuacao: r.pontuacao ?? null,
      texto_resposta: r.texto_resposta ?? null,
      correcao: r.correcao ?? null,
      comentario_professor: r.comentario_professor ?? null,
      corrigido_por: r.corrigido_por
        ? getPerfilUuid(r.corrigido_por, 'respostas', 'corrigido_por')
        : null,
      corrigido_em: r.corrigido_em ?? null,
      respondida_em: r.respondida_em || r.created_at || new Date().toISOString(),
      tentativas: r.tentativas ?? 1,
      acertou_final: r.acertou_final ?? null,
    };
  });

  // 15. avisos
  const avisos = db.avisos.map((av) => {
    verificarFK('avisos', 'escola_id', av.escola_id, escolasSet, 'escolas');
    verificarFK('avisos', 'turma_id', av.turma_id, turmasSet, 'turmas');
    return {
      id: idDe('avisos', av.id),
      escola_id: idDe('escolas', av.escola_id),
      autor_id: getPerfilUuid(av.autor_id, 'avisos', 'autor_id'),
      turma_id: av.turma_id ? idDe('turmas', av.turma_id) : null,
      titulo: av.titulo,
      mensagem: av.mensagem,
      prioridade: av.prioridade || 'media',
      publicado_em: av.publicado_em || av.created_at || new Date().toISOString(),
    };
  });

  // 16. aluno_observacoes
  const aluno_observacoes = (db.aluno_observacoes || []).map((obs) => {
    verificarFK('aluno_observacoes', 'aluno_id', obs.aluno_id, alunosSet, 'alunos');
    return {
      id: idDe('aluno_observacoes', obs.id),
      aluno_id: idDe('alunos', obs.aluno_id),
      professor_id: getPerfilUuid(obs.professor_id, 'aluno_observacoes', 'professor_id'),
      professor_nome: obs.professor_nome,
      texto: obs.texto,
      created_at: obs.created_at,
    };
  });

  return {
    escolas,
    perfis,
    periodos,
    disciplinas,
    turmas,
    ofertas,
    alunos,
    assuntos,
    banco_questoes,
    banco_alternativas,
    atividades,
    questoes,
    alternativas,
    respostas,
    avisos,
    aluno_observacoes,
  };
}

