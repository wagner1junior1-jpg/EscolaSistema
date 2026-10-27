/**
 * SaberPontual — AuthService Supabase (Fase 3 do plano do back end)
 *
 * Login real da equipe pelo Supabase Auth. `perfis.id = auth.users.id`; o papel, a escola e o
 * estado ativo vêm da tabela `perfis` (lida sob RLS), nunca do token. Perfil inativo não enxerga
 * a própria linha (private.escola_atual() devolve null), então vira "sem sessão".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from '../contracts';
import { Perfil } from '@/lib/types';
import { supabase as clientePadrao } from '@/lib/supabase';
import { SENHA_MINIMA_EQUIPE } from '@/lib/senha';

const COLUNAS_PERFIL = 'id, created_at, escola_id, nome, papel, ativo, email, trocar_senha';

export function traduzirErroAuth(mensagem: string | undefined, padrao: string): string {
  const m = (mensagem || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (m.includes('should be different')) return 'A nova senha não pode ser igual à senha atual.';
  if (m.includes('at least') && m.includes('characters')) {
    return `A nova senha deve ter no mínimo ${SENHA_MINIMA_EQUIPE} caracteres.`;
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  }
  return padrao;
}

export class SupabaseAuthService implements AuthService {
  constructor(private readonly cliente: SupabaseClient = clientePadrao) {}

  /** Lê o perfil ativo do usuário autenticado; null se não existir ou estiver inativo. */
  private async buscarPerfil(userId: string): Promise<Perfil | null> {
    const { data, error } = await this.cliente
      .from('perfis')
      .select(COLUNAS_PERFIL)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error('Não foi possível carregar o seu perfil. Tente novamente.');
    if (!data || !data.ativo) return null;
    return data as Perfil;
  }

  async login(email: string, senha: string): Promise<Perfil> {
    const { data, error } = await this.cliente.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error || !data.user) {
      throw new Error(traduzirErroAuth(error?.message, 'Não foi possível entrar. Tente novamente.'));
    }

    let perfil: Perfil | null;
    try {
      perfil = await this.buscarPerfil(data.user.id);
    } catch (err) {
      await this.cliente.auth.signOut();
      throw err;
    }
    if (!perfil) {
      await this.cliente.auth.signOut();
      throw new Error('Usuário não encontrado ou inativo.');
    }
    return perfil;
  }

  async logout(): Promise<void> {
    const { error } = await this.cliente.auth.signOut();
    if (error) throw new Error('Não foi possível encerrar a sessão. Tente novamente.');
  }

  async usuarioAtual(): Promise<Perfil | null> {
    const { data, error } = await this.cliente.auth.getSession();
    if (error || !data.session) return null;
    const perfil = await this.buscarPerfil(data.session.user.id);
    if (!perfil) {
      // Sessão de usuário desativado ou sem perfil: encerra para não ficar presa.
      await this.cliente.auth.signOut();
      return null;
    }
    return perfil;
  }

  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = await this.usuarioAtual();
    if (!usuario || !usuario.email) throw new Error('Usuário não autenticado.');
    if (!senhaAtual) throw new Error('Informe a senha atual.');
    if (!novaSenha || novaSenha.trim().length < SENHA_MINIMA_EQUIPE) {
      throw new Error(`A nova senha deve ter no mínimo ${SENHA_MINIMA_EQUIPE} caracteres.`);
    }
    if (senhaAtual === novaSenha) {
      throw new Error('A nova senha não pode ser igual à senha atual.');
    }

    // Confere a senha atual refazendo o login (o Supabase não verifica a senha antiga no updateUser).
    const { error: erroConferencia } = await this.cliente.auth.signInWithPassword({
      email: usuario.email,
      password: senhaAtual,
    });
    if (erroConferencia) throw new Error('A senha atual informada está incorreta.');

    const { error: erroTroca } = await this.cliente.auth.updateUser({ password: novaSenha });
    if (erroTroca) {
      throw new Error(
        traduzirErroAuth(erroTroca.message, 'Não foi possível alterar a senha. Tente novamente.')
      );
    }

    const { error: erroFlag } = await this.cliente.rpc('concluir_troca_senha');
    if (erroFlag) {
      throw new Error(
        'Sua senha foi alterada, mas não foi possível concluir a atualização do cadastro. Saia e entre novamente.'
      );
    }
  }
}

export const criarSupabaseAuthService = (cliente?: SupabaseClient): AuthService =>
  new SupabaseAuthService(cliente);
