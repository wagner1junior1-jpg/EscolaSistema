/**
 * SaberPontual — Persistência do Banco Mock (localStorage)
 * 
 * Chave de armazenamento: saberpontual_mock_db (conforme docs/ESPECIFICACAO.md 7.1)
 */

import { MockDatabaseSchema, criarBancoDemonstracao } from './seed';

export const MOCK_STORAGE_KEY = 'saberpontual_mock_db';

let memoryDb: MockDatabaseSchema | null = null;

export async function getDatabase(): Promise<MockDatabaseSchema> {
  // Retorna SEMPRE a mesma instância em memória para consistência
  if (memoryDb) {
    return memoryDb;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDatabaseSchema;
        memoryDb = parsed;
        return parsed;
      } catch (e) {
        console.error('Falha ao decodificar banco mock local. Recriando seed...', e);
      }
    }
  }

  // Inicializa seed padrão
  const seedData = await criarBancoDemonstracao();
  saveDatabase(seedData);
  return seedData;
}

export function saveDatabase(db: MockDatabaseSchema): void {
  memoryDb = db;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('Não foi possível persistir no localStorage:', e);
    }
  }
}

export async function resetDatabase(): Promise<MockDatabaseSchema> {
  const seedData = await criarBancoDemonstracao();
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

