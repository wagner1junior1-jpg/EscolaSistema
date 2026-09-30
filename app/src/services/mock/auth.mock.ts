/**
 * SaberPontual — AuthService Mock
 * 
 * Gerencia a sessão do usuário mock em memória e no sessionStorage do navegador.
 */

import { AuthService } from '../contracts';
import { Perfil } from '@/lib/types';
import { getDatabase, saveDatabase } from './db';

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

  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = await this.usuarioAtual();
    if (!usuario || !usuario.email) {
      throw new Error('Usuário não autenticado.');
    }

    if (!senhaAtual) {
      throw new Error('Informe a senha atual.');
    }

    if (!novaSenha || novaSenha.trim().length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }

    if (senhaAtual === novaSenha) {
      throw new Error('A nova senha não pode ser igual à senha atual.');
    }

    const db = await getDatabase();
    const emailLimpo = usuario.email.trim().toLowerCase();
    const senhaCorreta = db.credenciais[emailLimpo];

    if (!senhaCorreta || senhaCorreta !== senhaAtual) {
      throw new Error('A senha atual informada está incorreta.');
    }

    db.credenciais[emailLimpo] = novaSenha;
    saveDatabase(db);
  }
}
