/**
 * SaberPontual — Interface única de sincronização
 *
 * A UI assina mudanças, acompanha o status e força a sincronização por aqui,
 * sem saber se a fonte é o mock (localStorage) ou o Supabase.
 * Hoje só o mock está ligado; o Supabase se registra com `registrarFonteSincronizacao`
 * quando os serviços reais existirem (Fase 5).
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
