import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthService, traduzirErroAuth } from '../supabase/auth.supabase';
import { chamarAdminUsuarios } from '../supabase/adminUsuarios';

const PERFIL = {
  id: 'u1',
  created_at: '2026-10-20T00:00:00Z',
  escola_id: 'e1',
  nome: 'Ana',
  papel: 'professor',
  ativo: true,
  email: 'ana@escola.com',
  trocar_senha: false,
};

interface Opcoes {
  perfil?: Record<string, unknown> | null;
  erroPerfil?: { message: string } | null;
  erroLogin?: { message: string } | null;
  sessao?: boolean;
  erroTroca?: { message: string } | null;
  erroRpc?: { message: string } | null;
  conferenciaFalha?: boolean;
}

function criarCliente(op: Opcoes = {}) {
  const perfil = op.perfil === undefined ? PERFIL : op.perfil;
  const auth = {
    signInWithPassword: vi.fn(async ({ password }: { password: string }) => {
      if (op.erroLogin) return { data: { user: null }, error: op.erroLogin };
      if (op.conferenciaFalha && password === 'errada') {
        return { data: { user: null }, error: { message: 'Invalid login credentials' } };
      }
      return { data: { user: { id: 'u1' } }, error: null };
    }),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({
      data: { session: op.sessao === false ? null : { user: { id: 'u1' } } },
      error: null,
    })),
    updateUser: vi.fn(async () => ({ error: op.erroTroca ?? null })),
  };
  const consulta = {
    select: vi.fn(() => consulta),
    eq: vi.fn(() => consulta),
    maybeSingle: vi.fn(async () => ({ data: perfil, error: op.erroPerfil ?? null })),
  };
  const cliente = {
    auth,
    from: vi.fn(() => consulta),
    rpc: vi.fn(async () => ({ error: op.erroRpc ?? null })),
  };
  return { cliente: cliente as unknown as SupabaseClient, auth, rpc: cliente.rpc };
}

describe('SupabaseAuthService (Fase 3)', () => {
  it('login devolve o perfil ativo', async () => {
    const { cliente, auth } = criarCliente();
    const perfil = await new SupabaseAuthService(cliente).login(' ANA@escola.com ', 'segredo');
    expect(perfil.papel).toBe('professor');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@escola.com',
      password: 'segredo',
    });
  });

  it('senha errada: mensagem amigável e sem vazar se o e-mail existe', async () => {
    const { cliente } = criarCliente({ erroLogin: { message: 'Invalid login credentials' } });
    await expect(new SupabaseAuthService(cliente).login('a@b.com', 'x')).rejects.toThrow(
      'E-mail ou senha incorretos.'
    );
  });

  it('usuário desativado (perfil invisível pela RLS) não entra e a sessão é encerrada', async () => {
    const { cliente, auth } = criarCliente({ perfil: null });
    await expect(new SupabaseAuthService(cliente).login('a@b.com', 'x')).rejects.toThrow(
      'Usuário não encontrado ou inativo.'
    );
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('perfil marcado como inativo também não entra', async () => {
    const { cliente } = criarCliente({ perfil: { ...PERFIL, ativo: false } });
    await expect(new SupabaseAuthService(cliente).login('a@b.com', 'x')).rejects.toThrow(
      'inativo'
    );
  });

  it('erro ao ler o perfil não é engolido: falha e encerra a sessão', async () => {
    const { cliente, auth } = criarCliente({ erroPerfil: { message: 'boom' } });
    await expect(new SupabaseAuthService(cliente).login('a@b.com', 'x')).rejects.toThrow(
      'Não foi possível carregar o seu perfil'
    );
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('usuarioAtual: sem sessão devolve null; com sessão devolve o perfil', async () => {
    expect(await new SupabaseAuthService(criarCliente({ sessao: false }).cliente).usuarioAtual()).toBeNull();
    const perfil = await new SupabaseAuthService(criarCliente().cliente).usuarioAtual();
    expect(perfil?.id).toBe('u1');
  });

  it('usuarioAtual: sessão de usuário desativado é encerrada e vira null', async () => {
    const { cliente, auth } = criarCliente({ perfil: null });
    expect(await new SupabaseAuthService(cliente).usuarioAtual()).toBeNull();
    expect(auth.signOut).toHaveBeenCalled();
  });

  describe('alterarSenha', () => {
    it('valida antes de chamar o servidor', async () => {
      const { cliente, auth } = criarCliente();
      const s = new SupabaseAuthService(cliente);
      await expect(s.alterarSenha('', 'novasenha')).rejects.toThrow('Informe a senha atual.');
      await expect(s.alterarSenha('atual1', '123')).rejects.toThrow('no mínimo 8');
      await expect(s.alterarSenha('mesma123', 'mesma123')).rejects.toThrow('igual à senha atual');
      expect(auth.updateUser).not.toHaveBeenCalled();
    });

    it('senha atual errada não altera nada', async () => {
      const { cliente, auth } = criarCliente({ conferenciaFalha: true });
      await expect(new SupabaseAuthService(cliente).alterarSenha('errada', 'novasenha')).rejects.toThrow(
        'A senha atual informada está incorreta.'
      );
      expect(auth.updateUser).not.toHaveBeenCalled();
    });

    it('troca a senha e encerra a troca obrigatória pela RPC', async () => {
      const { cliente, auth, rpc } = criarCliente();
      await new SupabaseAuthService(cliente).alterarSenha('provisoria1', 'novasenha');
      expect(auth.updateUser).toHaveBeenCalledWith({ password: 'novasenha' });
      expect(rpc).toHaveBeenCalledWith('concluir_troca_senha');
    });

    it('erro do Supabase ao trocar vira mensagem em português', async () => {
      const { cliente } = criarCliente({
        erroTroca: { message: 'New password should be different from the old password.' },
      });
      await expect(new SupabaseAuthService(cliente).alterarSenha('antiga1', 'novasenha')).rejects.toThrow(
        'igual à senha atual'
      );
    });

    it('falha na RPC é reportada (não fica silenciosa)', async () => {
      const { cliente } = criarCliente({ erroRpc: { message: 'x' } });
      await expect(new SupabaseAuthService(cliente).alterarSenha('antiga1', 'novasenha')).rejects.toThrow(
        'Saia e entre novamente'
      );
    });
  });

  it('traduzirErroAuth cobre os casos comuns e usa o padrão no resto', () => {
    expect(traduzirErroAuth('Email rate limit exceeded', 'p')).toContain('Muitas tentativas');
    expect(traduzirErroAuth('Failed to fetch', 'p')).toContain('Sem conexão');
    expect(traduzirErroAuth('algo estranho', 'padrão')).toBe('padrão');
    expect(traduzirErroAuth(undefined, 'padrão')).toBe('padrão');
  });
});

describe('chamarAdminUsuarios (Edge Function admin-usuarios)', () => {
  it('repassa o pedido e devolve os dados', async () => {
    const invoke = vi.fn(async () => ({ data: { senha_provisoria: 'abc123' }, error: null }));
    const cliente = { functions: { invoke } } as unknown as SupabaseClient;
    const r = await chamarAdminUsuarios<{ senha_provisoria: string }>(
      { acao: 'redefinir-senha', id: 'u2' },
      cliente
    );
    expect(r.senha_provisoria).toBe('abc123');
    const esperada = import.meta.env.VITE_FN_ADMIN_USUARIOS?.trim() || 'admin-usuarios';
    expect(invoke).toHaveBeenCalledWith(esperada, {
      body: { acao: 'redefinir-senha', id: 'u2' },
    });
  });

  it('usa a mensagem de erro devolvida pela função', async () => {
    const contexto = new Response(JSON.stringify({ erro: 'Só a direção redefine senhas.' }), {
      status: 403,
    });
    const invoke = vi.fn(async () => ({ data: null, error: { context: contexto } }));
    const cliente = { functions: { invoke } } as unknown as SupabaseClient;
    await expect(chamarAdminUsuarios({ acao: 'desativar', id: 'u2' }, cliente)).rejects.toThrow(
      'Só a direção redefine senhas.'
    );
  });

  it('erro sem corpo legível cai na mensagem padrão', async () => {
    const invoke = vi.fn(async () => ({ data: null, error: new Error('FunctionsFetchError') }));
    const cliente = { functions: { invoke } } as unknown as SupabaseClient;
    await expect(chamarAdminUsuarios({ acao: 'desativar', id: 'u2' }, cliente)).rejects.toThrow(
      'Não foi possível concluir a operação'
    );
  });
});
