import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { resetDatabase } from '../mock/db';

describe('AuthService — Alteração de Senha', () => {
  const authService = new MockAuthService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
  });

  it('deve rejeitar alteração de senha se nenhum usuário estiver autenticado', async () => {
    await expect(authService.alterarSenha('demo123', 'novaSenha456')).rejects.toThrow(
      'Usuário não autenticado.'
    );
  });

  it('deve rejeitar se a senha atual informada estiver vazia', async () => {
    await authService.login('ana@demo.com', 'demo123');
    await expect(authService.alterarSenha('', 'novaSenha456')).rejects.toThrow(
      'Informe a senha atual.'
    );
  });

  it('deve rejeitar se a senha atual estiver incorreta', async () => {
    await authService.login('ana@demo.com', 'demo123');
    await expect(authService.alterarSenha('senhaErrada1', 'novaSenha456')).rejects.toThrow(
      'A senha atual informada está incorreta.'
    );
  });

  it('deve rejeitar se a nova senha tiver menos de 6 caracteres', async () => {
    await authService.login('ana@demo.com', 'demo123');
    await expect(authService.alterarSenha('demo123', '12345')).rejects.toThrow(
      'A nova senha deve ter no mínimo 6 caracteres.'
    );
  });

  it('deve rejeitar se a nova senha for idêntica à senha atual', async () => {
    await authService.login('ana@demo.com', 'demo123');
    await expect(authService.alterarSenha('demo123', 'demo123')).rejects.toThrow(
      'A nova senha não pode ser igual à senha atual.'
    );
  });

  it('deve alterar a senha da professora com sucesso e permitir login somente com a nova senha', async () => {
    // 1. Login inicial com a senha padrão
    const perfilInicial = await authService.login('ana@demo.com', 'demo123');
    expect(perfilInicial.email).toBe('ana@demo.com');
    expect(perfilInicial.papel).toBe('professor');

    // 2. Professora altera sua senha
    await authService.alterarSenha('demo123', 'professora2026');

    // 3. Logout
    await authService.logout();
    const usuarioDeslogado = await authService.usuarioAtual();
    expect(usuarioDeslogado).toBeNull();

    // 4. Tentativa de login com a senha antiga deve falhar
    await expect(authService.login('ana@demo.com', 'demo123')).rejects.toThrow(
      'E-mail ou senha incorretos.'
    );

    // 5. Login com a nova senha deve funcionar perfeitamente
    const perfilNovo = await authService.login('ana@demo.com', 'professora2026');
    expect(perfilNovo.id).toBe(perfilInicial.id);
    expect(perfilNovo.nome).toBe(perfilInicial.nome);
    expect(perfilNovo.email).toBe('ana@demo.com');
  });

  it('deve permitir que o professor Carlos também altere sua senha independentemente', async () => {
    await authService.login('carlos@demo.com', 'demo123');
    await authService.alterarSenha('demo123', 'ciencias@2026');
    await authService.logout();

    // Senha antiga do Carlos não funciona mais
    await expect(authService.login('carlos@demo.com', 'demo123')).rejects.toThrow(
      'E-mail ou senha incorretos.'
    );

    // Nova senha funciona
    const perfilCarlos = await authService.login('carlos@demo.com', 'ciencias@2026');
    expect(perfilCarlos.email).toBe('carlos@demo.com');

    // A senha da professora Ana permanece intacta
    const perfilAna = await authService.login('ana@demo.com', 'demo123');
    expect(perfilAna.email).toBe('ana@demo.com');
  });
});
