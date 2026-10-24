/**
 * SaberPontual — Cliente da Edge Function `admin-usuarios` (Fase 3)
 *
 * O GestaoService do Supabase (Fase 5.1) usa isto para cadastrar professor, redefinir senha e
 * desativar/reativar. A service role fica só no servidor; aqui só trafega o JWT do usuário logado.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Perfil } from '@/lib/types';
import { supabase as clientePadrao } from '@/lib/supabase';

export type AcaoAdminUsuarios =
  | { acao: 'criar'; email: string; nome: string; papel?: 'professor' | 'coordenacao'; senha?: string }
  | { acao: 'redefinir-senha'; id: string; senha?: string }
  | { acao: 'desativar'; id: string }
  | { acao: 'reativar'; id: string };

export interface RespostaCriarUsuario {
  perfil: Perfil;
  senha_provisoria: string;
}

// O painel do Supabase pode publicar a função com um apelido diferente do nome (ex.: swift-processor).
const FUNCAO_ADMIN_USUARIOS = import.meta.env.VITE_FN_ADMIN_USUARIOS?.trim() || 'admin-usuarios';

const ERRO_PADRAO = 'Não foi possível concluir a operação. Tente novamente.';

/** Lê `{ erro }` do corpo da resposta de uma Edge Function (usada também por ia.supabase.ts). */
export async function extrairMensagem(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown } | null)?.context;
  if (contexto instanceof Response) {
    try {
      const corpo = (await contexto.json()) as { erro?: unknown };
      if (typeof corpo.erro === 'string' && corpo.erro) return corpo.erro;
    } catch {
      // corpo sem JSON: cai na mensagem padrão
    }
  }
  return ERRO_PADRAO;
}

export async function chamarAdminUsuarios<T = unknown>(
  pedido: AcaoAdminUsuarios,
  cliente: SupabaseClient = clientePadrao
): Promise<T> {
  const { data, error } = await cliente.functions.invoke(FUNCAO_ADMIN_USUARIOS, { body: pedido });
  if (error) throw new Error(await extrairMensagem(error));
  return data as T;
}
