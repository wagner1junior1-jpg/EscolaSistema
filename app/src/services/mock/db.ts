/**
 * SaberPontual — Persistência do Banco Mock (localStorage)
 * 
 * Chave de armazenamento: saberpontual_mock_db (conforme docs/ESPECIFICACAO.md 7.1)
 * Suporta sincronização multi-aba via evento "storage", versionamento e fusão de dados.
 */

import { MockDatabaseSchema, criarBancoDemonstracao } from './seed';
import dadosDemo from './dados-demo.json';

export const MOCK_STORAGE_KEY = 'saberpontual_mock_db';

let memoryDb: MockDatabaseSchema | null = null;
const callbacksAssinantes = new Set<() => void>();

/**
 * Permite que componentes ou telas assinem notificações de alterações no banco mock
 * (disparadas após gravações locais ou atualizações vindas de outras abas via storage event).
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
  // Se houver localStorage, verifica se existe uma versão gravada mais recente
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDatabaseSchema;
        // Se a versao_seed for diferente (ou não existir), recria a partir do seed
        if (parsed.versao_seed !== dadosDemo.versao_seed) {
          return await resetDatabase();
        }
        if (!memoryDb || (parsed.versao && parsed.versao > (memoryDb.versao || 0))) {
          memoryDb = parsed;
          return memoryDb;
        }
      } catch (e) {
        console.error('Falha ao decodificar banco mock local:', e);
      }
    }
  }

  if (memoryDb) {
    if (memoryDb.versao_seed !== dadosDemo.versao_seed) {
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
