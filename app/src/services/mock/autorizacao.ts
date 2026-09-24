/**
 * SaberPontual — Módulo de Autorização e Controle de Acesso (Mock)
 * 
 * Regra: Valida se o usuário está autenticado e possui os papéis permitidos.
 * Lança exatamente:
 * - "Você precisa entrar no sistema." (se não autenticado)
 * - "Você não tem permissão para esta ação." (se papel incompatível)
 */

import { Perfil, PapelUsuario } from '@/lib/types';
import { MockAuthService } from './auth.mock';

const authService = new MockAuthService();

export async function exigirUsuario(papeis?: PapelUsuario[]): Promise<Perfil> {
  const usuario = await authService.usuarioAtual();

  if (!usuario) {
    throw new Error('Você precisa entrar no sistema.');
  }

  if (papeis && papeis.length > 0 && !papeis.includes(usuario.papel)) {
    throw new Error('Você não tem permissão para esta ação.');
  }

  return usuario;
}
