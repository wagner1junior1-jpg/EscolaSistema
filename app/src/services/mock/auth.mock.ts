/**
 * SaberPontual — AuthService Mock
 * 
 * Gerencia a sessão do usuário mock em memória e no sessionStorage do navegador.
 */

import { AuthService } from '../contracts';
import { Perfil } from '@/lib/types';
import { getDatabase } from './db';

const MOCK_AUTH_USER_KEY = 'saberpontual_mock_current_user_id';
let memoryCurrentUserId: string | null = null;

export class MockAuthService implements AuthService {
  async login(email: string, senha: string): Promise<Perfil> {
    const db = await getDatabase();
    const emailLimpo = email.trim().toLowerCase();

    const senhaCorreta = db.credenciais[emailLimpo];
    if (!senhaCorreta || senhaCorreta !== senha) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const perfil = db.perfis.find(
      (p) => p.email?.toLowerCase() === emailLimpo && p.ativo
    );

    if (!perfil) {
      throw new Error('Usuário não encontrado ou inativo.');
    }

    memoryCurrentUserId = perfil.id;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(MOCK_AUTH_USER_KEY, perfil.id);
      } catch {
        // Ignora erro de cota
      }
    }

    return perfil;
  }

  async logout(): Promise<void> {
    memoryCurrentUserId = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(MOCK_AUTH_USER_KEY);
      } catch {
        // Ignora erro de ambiente
      }
    }
  }

  async usuarioAtual(): Promise<Perfil | null> {
    let userId = memoryCurrentUserId;

    if (!userId && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        userId = window.sessionStorage.getItem(MOCK_AUTH_USER_KEY);
      } catch {
        userId = null;
      }
    }

    if (!userId) return null;

    const db = await getDatabase();
    return db.perfis.find((p) => p.id === userId && p.ativo) || null;
  }
}
