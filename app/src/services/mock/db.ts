/**
 * SaberPontual — Persistência do Banco Mock (localStorage)
 * 
 * Chave de armazenamento: saberpontual_mock_db (conforme docs/ESPECIFICACAO.md 7.1)
 * Suporta sincronização multi-aba via evento "storage", versionamento e fusão de dados.
 */

import { MockDatabaseSchema, criarBancoDemonstracao } from './seed';

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

/**
 * Mescla entidades gravadas em outra aba que ainda não estão presentes na instância atual
 */
function mesclarBancos(local: MockDatabaseSchema, remoto: MockDatabaseSchema): void {
  const chavesComId: Array<keyof MockDatabaseSchema> = [
    'escolas',
    'perfis',
    'periodos',
    'disciplinas',
    'turmas',
    'ofertas',
    'alunos',
    'atividades',
    'questoes',
    'alternativas',
    'respostas',
    'avisos',
    'aluno_sessoes',
    'pin_tentativas',
  ];

  for (const chave of chavesComId) {
    const listaLocal = local[chave] as Array<{ id: string }>;
    const listaRemota = remoto[chave] as Array<{ id: string }>;
    if (Array.isArray(listaLocal) && Array.isArray(listaRemota)) {
      const idsLocais = new Set(listaLocal.map((item) => item.id));
      for (const itemRemoto of listaRemota) {
        if (!idsLocais.has(itemRemoto.id)) {
          listaLocal.push(itemRemoto);
          idsLocais.add(itemRemoto.id);
        }
      }
    }
  }

  if (remoto.credenciais) {
    local.credenciais = { ...remoto.credenciais, ...local.credenciais };
  }
}

export async function getDatabase(): Promise<MockDatabaseSchema> {
  // Se houver localStorage, verifica se existe uma versão gravada mais recente
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDatabaseSchema;
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
    return memoryDb;
  }

  // Inicializa seed padrão
  const seedData = await criarBancoDemonstracao();
  seedData.versao = 1;
  saveDatabase(seedData);
  return seedData;
}

export function saveDatabase(db: MockDatabaseSchema): void {
  // Se o localStorage tiver versão mais nova que a da memória atual, recarrega e mescla antes de salvar
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const storageDb = JSON.parse(raw) as MockDatabaseSchema;
        if (storageDb && typeof storageDb.versao === 'number' && storageDb.versao > (db.versao || 0)) {
          mesclarBancos(db, storageDb);
          db.versao = storageDb.versao;
        }
      } catch (e) {
        console.warn('Erro ao verificar versão do localStorage antes de salvar:', e);
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
