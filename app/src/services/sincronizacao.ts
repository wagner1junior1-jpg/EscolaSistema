/**
 * SaberPontual — Interface única de sincronização
 *
 * A UI assina mudanças, acompanha o status e força a sincronização por aqui,
 * sem saber se a fonte é o mock (localStorage) ou o Supabase.
 * O mock é o padrão; com VITE_DATA_SOURCE=supabase, services/index.ts registra a fonte do
 * Supabase (`criarFonteSupabase`) com `registrarFonteSincronizacao`.
 */

import { assinarMudancas as assinarMudancasMock, getDatabase } from './mock/db';

export type StatusSincronizacao = 'conectado' | 'sincronizando' | 'offline' | 'erro';

export interface InfoSincronizacao {
  status: StatusSincronizacao;
  ultimaSincronizacao: Date | null;
  mensagem?: string;
  origem: 'supabase' | 'mock';
}

export interface FonteSincronizacao {
  assinarMudancas(callback: () => void): () => void;
  assinarStatus(callback: (info: InfoSincronizacao) => void): () => void;
  obterStatus(): InfoSincronizacao;
  forcar(): Promise<void>;
}

const INFO_MOCK: InfoSincronizacao = {
  status: 'offline',
  ultimaSincronizacao: null,
  origem: 'mock',
};

const fonteMock: FonteSincronizacao = {
  assinarMudancas: assinarMudancasMock,
  assinarStatus(callback) {
    callback(INFO_MOCK);
    return () => {};
  },
  obterStatus: () => INFO_MOCK,
  async forcar() {
    await getDatabase();
  },
};

/**
 * Fonte do Supabase: os dados já nascem na nuvem (não há cópia local para "sincronizar"), então o
 * status é sempre "conectado". O botão de atualizar (`forcar`) avisa as telas inscritas em
 * `assinarMudancas`, que recarregam seus dados do banco.
 */
export function criarFonteSupabase(agora: () => Date = () => new Date()): FonteSincronizacao {
  let info: InfoSincronizacao = { status: 'conectado', ultimaSincronizacao: null, origem: 'supabase' };
  const ouvintesMudanca = new Set<() => void>();
  const ouvintesStatus = new Set<(i: InfoSincronizacao) => void>();

  const definir = (novo: InfoSincronizacao) => {
    info = novo;
    ouvintesStatus.forEach((cb) => cb(info));
  };

  return {
    assinarMudancas(callback) {
      ouvintesMudanca.add(callback);
      return () => {
        ouvintesMudanca.delete(callback);
      };
    },
    assinarStatus(callback) {
      ouvintesStatus.add(callback);
      callback(info);
      return () => {
        ouvintesStatus.delete(callback);
      };
    },
    obterStatus: () => info,
    async forcar() {
      definir({ ...info, status: 'sincronizando' });
      try {
        ouvintesMudanca.forEach((cb) => cb());
      } finally {
        definir({ status: 'conectado', ultimaSincronizacao: agora(), origem: 'supabase' });
      }
    },
  };
}

let fonteAtiva: FonteSincronizacao = fonteMock;

/** Troca a fonte ativa (usado pelo Supabase nas fases seguintes). */
export function registrarFonteSincronizacao(fonte: FonteSincronizacao): void {
  fonteAtiva = fonte;
}

export function assinarMudancas(callback: () => void): () => void {
  return fonteAtiva.assinarMudancas(callback);
}

export function assinarStatusSincronizacao(callback: (info: InfoSincronizacao) => void): () => void {
  return fonteAtiva.assinarStatus(callback);
}

export function obterStatusSincronizacao(): InfoSincronizacao {
  return fonteAtiva.obterStatus();
}

export async function forcarSincronizacao(): Promise<void> {
  await fonteAtiva.forcar();
}
