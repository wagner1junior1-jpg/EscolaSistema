/**
 * SaberPontual — Persistência do modo mock (localStorage)
 *
 * Fonte da verdade: docs/ESPECIFICACAO.md 7.1
 * - Persiste em localStorage sob a chave `saberpontual_mock_db`.
 * - Notifica assinantes quando qualquer portal altera o banco (inclusive outra aba).
 * - A sincronização com a nuvem foi separada (Fase 1 do plano do back end): ver
 *   services/sincronizacao.ts e services/supabase/storeLegado.ts.
 */

import { MockDatabaseSchema, criarBancoDemonstracao, getVersaoSeedAtiva, isTestEnvironment } from './seed';

export const MOCK_STORAGE_KEY = 'saberpontual_mock_db';

let memoryDb: MockDatabaseSchema | null = null;

const callbacksAssinantes = new Set<() => void>();

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
 * Faz a fusão do banco desta aba com o gravado por outra aba (ou outro dispositivo),
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

  // Se houver localStorage, verifica se existe uma versão gravada
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDatabaseSchema;
        if (parsed.versao_seed !== versaoSeedEsperada) {
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
    if (memoryDb.versao_seed !== versaoSeedEsperada) {
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
