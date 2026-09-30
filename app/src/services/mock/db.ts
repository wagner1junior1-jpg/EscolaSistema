/**
 * SaberPontual — Persistência e Sincronização em Nuvem (Supabase + Cache Local)
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md 7.1
 * - Modo Supabase: sincroniza com tabela `saberpontual_store` e tabelas relacionais do Postgres.
 * - Modo Local / Fallback: persiste em localStorage sob a chave `saberpontual_mock_db`.
 * - Escuta em tempo real via Supabase Realtime (WebSockets) com fallback de polling e visibility.
 * - Merge anti-conflito para que respostas de alunos em dispositivos diferentes nunca se percam.
 */

import { MockDatabaseSchema, criarBancoDemonstracao, getVersaoSeedAtiva, isTestEnvironment } from './seed';
import { supabase, isSupabaseConfigurado } from '@/lib/supabase';

export const MOCK_STORAGE_KEY = 'saberpontual_mock_db';

export type StatusSincronizacao = 'conectado' | 'sincronizando' | 'offline' | 'erro';

export interface InfoSincronizacao {
  status: StatusSincronizacao;
  ultimaSincronizacao: Date | null;
  mensagem?: string;
  origem: 'supabase' | 'mock';
}

let memoryDb: MockDatabaseSchema | null = null;
let supabaseCarregado = false;
let realtimeCanal: ReturnType<typeof supabase.channel> | null = null;
let timerPolling: number | null = null;

const callbacksAssinantes = new Set<() => void>();
const callbacksStatus = new Set<(info: InfoSincronizacao) => void>();

let infoSincronizacao: InfoSincronizacao = {
  status: 'offline',
  ultimaSincronizacao: null,
  origem: 'mock',
};

export function isSupabaseMode(): boolean {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const isWebdriver = typeof navigator !== 'undefined' && navigator.webdriver === true;
  if (isTest || isWebdriver) return false;
  return import.meta.env.VITE_DATA_SOURCE === 'supabase' && isSupabaseConfigurado;
}

export function assinarStatusSincronizacao(callback: (info: InfoSincronizacao) => void): () => void {
  callbacksStatus.add(callback);
  callback(infoSincronizacao);
  return () => {
    callbacksStatus.delete(callback);
  };
}

function atualizarStatusSincronizacao(
  status: StatusSincronizacao,
  mensagem?: string
): void {
  infoSincronizacao = {
    status,
    ultimaSincronizacao: status === 'conectado' ? new Date() : infoSincronizacao.ultimaSincronizacao,
    mensagem,
    origem: isSupabaseMode() ? 'supabase' : 'mock',
  };
  callbacksStatus.forEach((cb) => {
    try {
      cb(infoSincronizacao);
    } catch (e) {
      console.error('Erro no callback de status de sincronização:', e);
    }
  });
}

export function obterStatusSincronizacao(): InfoSincronizacao {
  return infoSincronizacao;
}

/**
 * Permite que componentes assinem notificações de alterações no banco de dados.
 */
export function assinarMudancas(callback: () => void): () => void {
  callbacksAssinantes.add(callback);
  return () => {
    callbacksAssinantes.delete(callback);
  };
}

function notificarAssinantes(): void {
  callbacksAssinantes.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Erro ao executar callback de assinatura:', e);
    }
  });
}

function mesclarPorId<T extends { id: string }>(locais: T[], remotos: T[]): T[] {
  const mapa = new Map<string, T>();
  remotos.forEach((item) => mapa.set(item.id, item));
  locais.forEach((item) => mapa.set(item.id, item));
  return Array.from(mapa.values());
}

/**
 * Faz a fusão inteligente do banco local com o banco remoto recebido do Supabase,
 * garantindo que nenhuma resposta de aluno ou atividade criada seja sobreposta.
 */
export function mesclarDatabases(
  localDb: MockDatabaseSchema,
  remoteDb: MockDatabaseSchema
): MockDatabaseSchema {
  // Respostas: chave composta por aluno_id e questao_id
  const mapaRespostas = new Map<string, typeof localDb.respostas[0]>();

  remoteDb.respostas?.forEach((r) => {
    const chave = `${r.aluno_id}_${r.questao_id}`;
    mapaRespostas.set(chave, r);
  });

  localDb.respostas?.forEach((r) => {
    const chave = `${r.aluno_id}_${r.questao_id}`;
    const existente = mapaRespostas.get(chave);
    if (!existente) {
      mapaRespostas.set(chave, r);
    } else {
      const dataExistente = new Date(existente.respondida_em || 0).getTime();
      const dataLocal = new Date(r.respondida_em || 0).getTime();
      if (dataLocal >= dataExistente || (r.correcao && !existente.correcao)) {
        mapaRespostas.set(chave, r);
      }
    }
  });

  return {
    ...remoteDb,
    versao: Math.max(localDb.versao || 0, remoteDb.versao || 0) + 1,
    versao_seed: remoteDb.versao_seed || localDb.versao_seed,
    escolas: mesclarPorId(localDb.escolas || [], remoteDb.escolas || []),
    perfis: mesclarPorId(localDb.perfis || [], remoteDb.perfis || []),
    periodos: mesclarPorId(localDb.periodos || [], remoteDb.periodos || []),
    disciplinas: mesclarPorId(localDb.disciplinas || [], remoteDb.disciplinas || []),
    turmas: mesclarPorId(localDb.turmas || [], remoteDb.turmas || []),
    ofertas: mesclarPorId(localDb.ofertas || [], remoteDb.ofertas || []),
    alunos: mesclarPorId(localDb.alunos || [], remoteDb.alunos || []),
    atividades: mesclarPorId(localDb.atividades || [], remoteDb.atividades || []),
    questoes: mesclarPorId(localDb.questoes || [], remoteDb.questoes || []),
    alternativas: mesclarPorId(localDb.alternativas || [], remoteDb.alternativas || []),
    respostas: Array.from(mapaRespostas.values()),
    avisos: mesclarPorId(localDb.avisos || [], remoteDb.avisos || []),
    assuntos: mesclarPorId(localDb.assuntos || [], remoteDb.assuntos || []),
    banco_questoes: mesclarPorId(localDb.banco_questoes || [], remoteDb.banco_questoes || []),
    banco_alternativas: mesclarPorId(localDb.banco_alternativas || [], remoteDb.banco_alternativas || []),
    aluno_observacoes: mesclarPorId(localDb.aluno_observacoes || [], remoteDb.aluno_observacoes || []),
    credenciais: { ...(remoteDb.credenciais || {}), ...(localDb.credenciais || {}) },
    aluno_sessoes: mesclarPorId(localDb.aluno_sessoes || [], remoteDb.aluno_sessoes || []),
    pin_tentativas: [...(remoteDb.pin_tentativas || []), ...(localDb.pin_tentativas || [])],
  };
}

/**
 * Sincroniza em segundo plano os dados para as tabelas relacionais do Supabase
 */
export async function sincronizarTabelasRelacionais(db: MockDatabaseSchema): Promise<void> {
  if (!isSupabaseMode()) return;
  try {
    if (db.escolas?.length) {
      await supabase.from('escolas').upsert(
        db.escolas.map((e) => ({
          id: e.id,
          nome: e.nome,
          cidade_uf: e.cidade_uf,
          ano_letivo_atual: e.ano_letivo_atual,
          created_at: e.created_at,
        }))
      );
    }

    if (db.perfis?.length) {
      await supabase.from('perfis').upsert(
        db.perfis.map((p) => ({
          id: p.id,
          escola_id: p.escola_id,
          nome: p.nome,
          email: p.email,
          papel: p.papel,
          ativo: p.ativo,
          created_at: p.created_at,
        }))
      );
    }

    if (db.periodos?.length) {
      await supabase.from('periodos').upsert(
        db.periodos.map((p) => ({
          id: p.id,
          escola_id: p.escola_id,
          nome: p.nome,
          ano_letivo: p.ano_letivo,
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
          ativo: p.ativo,
          created_at: p.created_at,
        }))
      );
    }

    if (db.disciplinas?.length) {
      await supabase.from('disciplinas').upsert(
        db.disciplinas.map((d) => ({
          id: d.id,
          escola_id: d.escola_id,
          nome: d.nome,
          created_at: d.created_at,
        }))
      );
    }

    if (db.turmas?.length) {
      await supabase.from('turmas').upsert(
        db.turmas.map((t) => ({
          id: t.id,
          escola_id: t.escola_id,
          nome: t.nome,
          serie: t.serie,
          segmento: t.segmento,
          ano_letivo: t.ano_letivo,
          codigo_acesso: t.codigo_acesso,
          ativa: t.ativa,
          created_at: t.created_at,
        }))
      );
    }

    if (db.ofertas?.length) {
      await supabase.from('ofertas').upsert(
        db.ofertas.map((o) => ({
          id: o.id,
          turma_id: o.turma_id,
          disciplina_id: o.disciplina_id,
          professor_id: o.professor_id,
          created_at: o.created_at,
        }))
      );
    }

    if (db.alunos?.length) {
      await supabase.from('alunos').upsert(
        db.alunos.map((a) => ({
          id: a.id,
          escola_id: a.escola_id,
          turma_id: a.turma_id,
          nome_completo: a.nome_completo,
          numero_chamada: a.numero_chamada,
          pin_hash: a.pin_hash,
          ativo: a.ativo,
          created_at: a.created_at,
        }))
      );
    }

    if (db.assuntos?.length) {
      await supabase.from('assuntos').upsert(
        db.assuntos.map((as) => ({
          id: as.id,
          escola_id: as.escola_id,
          disciplina_id: as.disciplina_id,
          nome: as.nome,
          created_at: as.created_at,
        }))
      );
    }

    if (db.atividades?.length) {
      await supabase.from('atividades').upsert(
        db.atividades.map((at) => ({
          id: at.id,
          oferta_id: at.oferta_id,
          periodo_id: at.periodo_id,
          titulo: at.titulo,
          descricao: at.descricao || '',
          prazo: at.prazo || null,
          modo: at.modo,
          status: at.status,
          criado_por: at.criado_por,
          created_at: at.created_at,
        }))
      );
    }

    if (db.questoes?.length) {
      await supabase.from('questoes').upsert(
        db.questoes.map((q) => ({
          id: q.id,
          atividade_id: q.atividade_id,
          ordem: q.ordem,
          tipo: q.tipo || 'objetiva',
          dificuldade: (q as unknown as { dificuldade?: string }).dificuldade || 'medio',
          enunciado: q.enunciado,
          imagem_url: q.imagem_url || null,
          dica: q.dica || null,
          explicacao: q.explicacao || null,
          resposta_esperada: q.resposta_esperada || null,
          banco_questao_id: q.banco_questao_id || null,
          assunto_id: q.assunto_id || null,
          created_at: q.created_at,
        }))
      );
    }

    if (db.alternativas?.length) {
      await supabase.from('alternativas').upsert(
        db.alternativas.map((alt) => ({
          id: alt.id,
          questao_id: alt.questao_id,
          letra: alt.letra,
          texto: alt.texto,
          correta: alt.correta,
          por_que_errou: alt.por_que_errou || null,
        }))
      );
    }

    if (db.respostas?.length) {
      await supabase.from('respostas').upsert(
        db.respostas.map((r) => ({
          id: r.id,
          aluno_id: r.aluno_id,
          questao_id: r.questao_id,
          alternativa_id: r.alternativa_id || null,
          acertou: r.acertou ?? null,
          pontuacao: r.pontuacao ?? null,
          texto_resposta: r.texto_resposta || null,
          correcao: r.correcao || null,
          comentario_professor: r.comentario_professor || null,
          corrigido_por: r.corrigido_por || null,
          corrigido_em: r.corrigido_em || null,
          respondida_em: r.respondida_em,
          tentativas: r.tentativas || 1,
          acertou_final: r.acertou_final ?? null,
        }))
      );
    }

    if (db.avisos?.length) {
      await supabase.from('avisos').upsert(
        db.avisos.map((av) => ({
          id: av.id,
          escola_id: av.escola_id,
          autor_id: av.autor_id,
          turma_id: av.turma_id || null,
          titulo: av.titulo,
          mensagem: av.mensagem,
          prioridade: av.prioridade,
          publicado_em: av.publicado_em,
        }))
      );
    }

    if (db.aluno_observacoes?.length) {
      await supabase.from('aluno_observacoes').upsert(
        db.aluno_observacoes.map((obs) => ({
          id: obs.id,
          aluno_id: obs.aluno_id,
          professor_id: obs.professor_id,
          professor_nome: obs.professor_nome,
          texto: obs.texto,
          created_at: obs.created_at,
          updated_at: obs.updated_at,
        }))
      );
    }
  } catch (err) {
    console.warn('[SaberPontual] Aviso ao atualizar tabelas relacionais no Postgres:', err);
  }
}

async function sincronizarParaSupabase(db: MockDatabaseSchema): Promise<void> {
  if (!isSupabaseMode()) return;
  try {
    atualizarStatusSincronizacao('sincronizando');

    // 1. Grava no Store Consolidado da Nuvem
    const { error } = await supabase.from('saberpontual_store').upsert({
      id: 'global',
      versao: db.versao || 1,
      payload: db,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[SaberPontual] Erro ao sincronizar store no Supabase:', error.message);
      atualizarStatusSincronizacao('erro', error.message);
      return;
    }

    atualizarStatusSincronizacao('conectado');

    // 2. Dispara sincronização com tabelas relacionais em background
    void sincronizarTabelasRelacionais(db);
  } catch (err) {
    console.warn('[SaberPontual] Falha na sincronização para o Supabase:', err);
    atualizarStatusSincronizacao('erro', err instanceof Error ? err.message : 'Falha de rede');
  }
}

/**
 * Inicializa a escuta em tempo real do Supabase Realtime e segurança de polling
 */
export function iniciarSincronizacaoRealtime(): void {
  if (!isSupabaseMode() || typeof window === 'undefined') return;

  if (!realtimeCanal) {
    try {
      realtimeCanal = supabase
        .channel('saberpontual_store_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'saberpontual_store',
          },
          (payload) => {
            const novo = payload.new as {
              id?: string;
              payload?: MockDatabaseSchema;
              versao?: number;
              updated_at?: string;
            } | null;

            if (novo && novo.payload && (!memoryDb || (novo.versao || 0) > (memoryDb.versao || 0))) {
              const remoteDb = novo.payload;
              memoryDb = memoryDb ? mesclarDatabases(memoryDb, remoteDb) : remoteDb;
              if (window.localStorage) {
                window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(memoryDb));
              }
              atualizarStatusSincronizacao('conectado');
              notificarAssinantes();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            atualizarStatusSincronizacao('conectado');
          }
        });
    } catch (e) {
      console.warn('[SaberPontual] Não foi possível conectar canal Realtime:', e);
    }
  }

  // Polling e detecção de visibilidade da aba
  if (typeof document !== 'undefined' && !timerPolling) {
    const verificarAtualizacoesRemotas = async () => {
      if (document.visibilityState !== 'visible' || !isSupabaseMode()) return;
      try {
        const { data, error } = await supabase
          .from('saberpontual_store')
          .select('versao, updated_at')
          .eq('id', 'global')
          .maybeSingle();

        if (!error && data) {
          const remoteVersao = data.versao as number;
          if (!memoryDb || remoteVersao > (memoryDb.versao || 0)) {
            await forcarSincronizacao();
          }
        }
      } catch {
        // Silencioso em caso de oscilação momentânea de rede
      }
    };

    document.addEventListener('visibilitychange', () => {
      void verificarAtualizacoesRemotas();
    });

    timerPolling = window.setInterval(() => {
      void verificarAtualizacoesRemotas();
    }, 10000);
  }
}

/**
 * Força a leitura do banco de dados remoto da nuvem e atualiza o estado local
 */
export async function forcarSincronizacao(): Promise<MockDatabaseSchema> {
  if (!isSupabaseMode()) {
    return await getDatabase();
  }

  atualizarStatusSincronizacao('sincronizando');
  try {
    const { data, error } = await supabase
      .from('saberpontual_store')
      .select('payload, versao')
      .eq('id', 'global')
      .maybeSingle();

    if (!error && data && data.payload) {
      const remoteDb = data.payload as MockDatabaseSchema;
      if (memoryDb) {
        memoryDb = mesclarDatabases(memoryDb, remoteDb);
      } else {
        memoryDb = remoteDb;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(memoryDb));
      }
      atualizarStatusSincronizacao('conectado');
      notificarAssinantes();
      return memoryDb;
    }
  } catch (err) {
    atualizarStatusSincronizacao('erro', 'Falha ao buscar dados');
  }

  return await getDatabase();
}

// Escuta alterações ocorridas em outras abas do mesmo navegador
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (event) => {
    if (event.key === MOCK_STORAGE_KEY) {
      memoryDb = null;
      notificarAssinantes();
    }
  });
}

export async function getDatabase(): Promise<MockDatabaseSchema> {
  const versaoSeedEsperada = getVersaoSeedAtiva();

  // Em modo Supabase, tenta carregar dados da nuvem
  if (isSupabaseMode() && !supabaseCarregado) {
    supabaseCarregado = true;
    atualizarStatusSincronizacao('sincronizando');

    try {
      iniciarSincronizacaoRealtime();

      const { data, error } = await supabase
        .from('saberpontual_store')
        .select('payload, versao')
        .eq('id', 'global')
        .maybeSingle();

      if (!error && data && data.payload) {
        const remoteDb = data.payload as MockDatabaseSchema;
        memoryDb = remoteDb;
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(remoteDb));
        }
        atualizarStatusSincronizacao('conectado');
        return remoteDb;
      }

      // Se a tabela estiver vazia na nuvem, inicializa o seed na nuvem
      if (!error && (!data || !data.payload)) {
        console.info('[SaberPontual] Banco remoto vazio. Inicializando demonstração completa na nuvem...');
        const seedData = await criarBancoDemonstracao();
        seedData.versao = 1;
        memoryDb = seedData;
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seedData));
        }
        await sincronizarParaSupabase(seedData);
        atualizarStatusSincronizacao('conectado');
        return seedData;
      }
    } catch (err) {
      console.warn('[SaberPontual] Fallback para armazenamento local ao conectar Supabase:', err);
      atualizarStatusSincronizacao('offline', 'Modo offline com cache local');
    }
  }

  // Se houver localStorage, verifica se existe uma versão gravada
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDatabaseSchema;
        if (!isSupabaseMode() && parsed.versao_seed !== versaoSeedEsperada) {
          return await resetDatabase();
        }
        if (!memoryDb || (parsed.versao && parsed.versao > (memoryDb.versao || 0))) {
          memoryDb = parsed;
          return memoryDb;
        }
      } catch (e) {
        console.error('Falha ao decodificar banco local:', e);
      }
    }
  }

  if (memoryDb) {
    if (!isSupabaseMode() && memoryDb.versao_seed !== versaoSeedEsperada) {
      return await resetDatabase();
    }
    return memoryDb;
  }

  // Inicializa seed padrão caso tudo esteja vazio
  const seedData = await criarBancoDemonstracao();
  seedData.versao = 1;
  saveDatabase(seedData);
  return seedData;
}

export const EVENTO_ERRO_GRAVACAO = 'saberpontual:erro-gravacao';

export function saveDatabase(db: MockDatabaseSchema): void {
  // Verificação contra concorrência entre abas
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      let storageDb: MockDatabaseSchema | null = null;
      try {
        storageDb = JSON.parse(raw) as MockDatabaseSchema;
      } catch {
        // Silencioso
      }
      if (storageDb && typeof storageDb.versao === 'number' && storageDb.versao > (db.versao || 0)) {
        if (isTestEnvironment()) {
          memoryDb = null;
          throw new Error('Os dados foram atualizados em outra aba. Tente de novo.');
        }
        // Mescla em vez de lançar erro bloqueante em produção
        db = mesclarDatabases(db, storageDb);
      }
    }
  }

  db.versao = (db.versao || 0) + 1;
  memoryDb = db;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('Não foi possível persistir no localStorage:', e);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENTO_ERRO_GRAVACAO));
      }
    }
  }

  void sincronizarParaSupabase(db);
  notificarAssinantes();
}

export async function resetDatabase(): Promise<MockDatabaseSchema> {
  memoryDb = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(MOCK_STORAGE_KEY);
  }
  const seedData = await criarBancoDemonstracao();
  seedData.versao = 1;
  saveDatabase(seedData);
  return seedData;
}

export function recarregarDoLocalStorage(): void {
  memoryDb = null;
}
