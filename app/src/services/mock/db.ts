/**
 * SaberPontual — Persistência do Banco Mock (localStorage)
 * 
 * Chave de armazenamento: saberpontual_mock_db (conforme docs/ESPECIFICACAO.md 7.1)
 * Suporta sincronização multi-aba via evento "storage", versionamento e fusão de dados.
 */

import { MockDatabaseSchema, criarBancoDemonstracao, getVersaoSeedAtiva } from './seed';
import { supabase } from '@/lib/supabase';

export const MOCK_STORAGE_KEY = 'saberpontual_mock_db';

let memoryDb: MockDatabaseSchema | null = null;
let supabaseLoaded = false;
const callbacksAssinantes = new Set<() => void>();

function isSupabaseMode(): boolean {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const isWebdriver = typeof navigator !== 'undefined' && navigator.webdriver === true;
  if (isTest || isWebdriver) return false;
  return import.meta.env.VITE_DATA_SOURCE === 'supabase';
}

async function sincronizarParaSupabase(db: MockDatabaseSchema): Promise<void> {
  if (!isSupabaseMode()) return;
  try {
    await supabase.from('saberpontual_store').upsert({
      id: 'global',
      versao: db.versao || 1,
      payload: db,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Silencioso caso a tabela ainda não tenha sido criada no SQL Editor
  }
}

/**
 * Permite que componentes ou telas assinem notificações de alterações no banco
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

// Escuta alterações ocorridas em outras abas do navegador
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

  // Em modo Supabase, busca estado persistido na nuvem na primeira carga
  if (isSupabaseMode() && !supabaseLoaded) {
    supabaseLoaded = true;
    try {
      const { data, error } = await supabase
        .from('saberpontual_store')
        .select('payload, versao')
        .eq('id', 'global')
        .maybeSingle();

      if (!error && data && data.payload) {
        const remoteDb = data.payload as MockDatabaseSchema;
        if (remoteDb.versao_seed === versaoSeedEsperada) {
          memoryDb = remoteDb;
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(remoteDb));
          }
          return remoteDb;
        }
      }
    } catch {
      // Continua com fallback local caso a tabela ainda não exista no Supabase
    }
  }

  // Se houver localStorage, verifica se existe uma versão gravada mais recente
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDatabaseSchema;
        // Se a versao_seed for diferente (ou não existir), recria a partir do seed
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

  // Inicializa seed padrão
  const seedData = await criarBancoDemonstracao();
  seedData.versao = 1;
  saveDatabase(seedData);
  return seedData;
}

export function saveDatabase(db: MockDatabaseSchema): void {
  // Se o localStorage tiver versão mais nova que a do db que está sendo salvo, NÃO grava
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      let storageDb: MockDatabaseSchema | null = null;
      try {
        storageDb = JSON.parse(raw) as MockDatabaseSchema;
      } catch (e) {
        console.warn('Erro ao verificar versão do localStorage antes de salvar:', e);
      }
      if (storageDb && typeof storageDb.versao === 'number' && storageDb.versao > (db.versao || 0)) {
        memoryDb = null;
        throw new Error('Os dados foram atualizados em outra aba. Tente de novo.');
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

/**
 * Simula um recarregamento da aplicação (F5),
 * descartando a referência em memória e forçando nova leitura a partir do localStorage.
 */
export function recarregarDoLocalStorage(): void {
  memoryDb = null;
}
