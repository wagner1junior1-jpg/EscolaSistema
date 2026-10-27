// =============================================================================
// SABERPONTUAL — Edge Function `admin-usuarios` (Fase 3 do plano do back end)
//
// Gestão de usuários da equipe (professores e coordenação) com a service role, que NUNCA vai
// para o navegador. Quem chama precisa estar logado (JWT) e ser direção ou coordenação ativa.
// A escola do novo usuário é sempre a do chamador: o corpo da requisição não escolhe escola.
//
// Ações (POST, JSON):
//   { acao: 'criar',           email, nome, papel?: 'professor' | 'coordenacao', senha? }
//        direção e coordenação criam professor; só a direção cria coordenação.
//        Sem `senha`, gera uma provisória. Devolve { perfil, senha_provisoria }.
//   { acao: 'redefinir-senha', id, senha? }   (só direção) devolve { senha_provisoria }
//   { acao: 'desativar',       id }           (só direção)
//   { acao: 'reativar',        id }           (só direção)
// Toda senha definida aqui é provisória: perfis.trocar_senha = true (troca no 1º acesso).
//
// Deploy (sem CLI): painel do Supabase > Edge Functions > Deploy a new function > nome
// `admin-usuarios` > colar este arquivo. Manter "Verify JWT" ligado. As variáveis
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetadas pelo Supabase.
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Igual a SENHA_MINIMA_EQUIPE (app/src/lib/senha.ts); a função roda fora do app e não importa de lá.
const SENHA_MINIMA = 8;
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PAPEIS_CRIAVEIS = ['professor', 'coordenacao'];

class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function gerarSenhaProvisoria(tamanho = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

function validarSenha(senha: unknown): string {
  if (senha === undefined || senha === null || senha === '') return gerarSenhaProvisoria();
  if (typeof senha !== 'string' || senha.trim().length < SENHA_MINIMA) {
    throw new ErroHttp(400, `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`);
  }
  return senha.trim();
}

function texto(valor: unknown, campo: string, min: number, max: number): string {
  if (typeof valor !== 'string') throw new ErroHttp(400, `Informe ${campo}.`);
  const limpo = valor.trim();
  if (limpo.length < min || limpo.length > max) throw new ErroHttp(400, `Informe ${campo}.`);
  return limpo;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !chaveServico) throw new ErroHttp(500, 'Função sem configuração do servidor.');
    const admin = createClient(url, chaveServico, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Quem está chamando? (o JWT é validado pelo servidor de autenticação)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) throw new ErroHttp(401, 'Sessão ausente. Entre novamente.');
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(jwt);
    if (erroSessao || !sessao.user) throw new ErroHttp(401, 'Sessão inválida. Entre novamente.');

    const { data: chamador, error: erroChamador } = await admin
      .from('perfis')
      .select('id, escola_id, papel, ativo')
      .eq('id', sessao.user.id)
      .maybeSingle();
    if (erroChamador) throw new ErroHttp(500, 'Não foi possível verificar o seu perfil.');
    if (!chamador || !chamador.ativo || !['direcao', 'coordenacao'].includes(chamador.papel)) {
      throw new ErroHttp(403, 'Você não tem permissão para esta ação.');
    }
    const ehDirecao = chamador.papel === 'direcao';

    let corpo: Record<string, unknown>;
    try {
      corpo = await req.json();
    } catch {
      throw new ErroHttp(400, 'Requisição inválida.');
    }

    // Alvo de redefinir/desativar/reativar: mesma escola, nunca a direção, nunca o próprio chamador.
    const buscarAlvo = async () => {
      const id = texto(corpo.id, 'o usuário', 1, 64);
      const { data: alvo, error } = await admin
        .from('perfis')
        .select('id, escola_id, papel, ativo')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new ErroHttp(500, 'Não foi possível localizar o usuário.');
      if (!alvo || alvo.escola_id !== chamador.escola_id) {
        throw new ErroHttp(404, 'Usuário não encontrado.');
      }
      if (alvo.papel === 'direcao' || alvo.id === chamador.id) {
        throw new ErroHttp(403, 'Esta ação não é permitida para este usuário.');
      }
      return alvo;
    };

    switch (corpo.acao) {
      case 'criar': {
        const nome = texto(corpo.nome, 'o nome', 2, 120);
        const email = texto(corpo.email, 'o e-mail', 5, 160).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroHttp(400, 'E-mail inválido.');
        const papel = corpo.papel === undefined ? 'professor' : corpo.papel;
        if (typeof papel !== 'string' || !PAPEIS_CRIAVEIS.includes(papel)) {
          throw new ErroHttp(400, 'Papel inválido.');
        }
        if (papel === 'coordenacao' && !ehDirecao) {
          throw new ErroHttp(403, 'Só a direção cadastra coordenação.');
        }
        const senha = validarSenha(corpo.senha);

        const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
        });
        if (erroCriar || !criado.user) {
          const jaExiste = /already|registered|exists/i.test(erroCriar?.message || '');
          throw new ErroHttp(
            jaExiste ? 409 : 500,
            jaExiste
              ? 'Já existe um usuário cadastrado com este e-mail.'
              : 'Não foi possível criar o usuário.'
          );
        }

        const { data: perfil, error: erroPerfil } = await admin
          .from('perfis')
          .insert({
            id: criado.user.id,
            escola_id: chamador.escola_id,
            nome,
            email,
            papel,
            trocar_senha: true,
          })
          .select('id, created_at, escola_id, nome, papel, ativo, email, trocar_senha')
          .single();
        if (erroPerfil) {
          // Desfaz o usuário do Auth para não deixar conta sem perfil.
          await admin.auth.admin.deleteUser(criado.user.id);
          throw new ErroHttp(500, 'Não foi possível concluir o cadastro.');
        }
        return resposta({ perfil, senha_provisoria: senha }, 201);
      }

      case 'redefinir-senha': {
        if (!ehDirecao) throw new ErroHttp(403, 'Só a direção redefine senhas.');
        const alvo = await buscarAlvo();
        const senha = validarSenha(corpo.senha);
        const { error: erroSenha } = await admin.auth.admin.updateUserById(alvo.id, {
          password: senha,
        });
        if (erroSenha) throw new ErroHttp(500, 'Não foi possível redefinir a senha.');
        const { error: erroFlag } = await admin
          .from('perfis')
          .update({ trocar_senha: true })
          .eq('id', alvo.id);
        if (erroFlag) throw new ErroHttp(500, 'A senha mudou, mas o cadastro não foi atualizado.');
        return resposta({ senha_provisoria: senha });
      }

      case 'desativar':
      case 'reativar': {
        if (!ehDirecao) throw new ErroHttp(403, 'Só a direção altera o acesso de usuários.');
        const alvo = await buscarAlvo();
        const ativar = corpo.acao === 'reativar';
        // Bloqueia no Auth (nenhum token novo) e marca inativo (a RLS corta o token atual).
        const { error: erroBan } = await admin.auth.admin.updateUserById(alvo.id, {
          ban_duration: ativar ? 'none' : '876000h',
        });
        if (erroBan) throw new ErroHttp(500, 'Não foi possível alterar o acesso.');
        const { error: erroAtivo } = await admin
          .from('perfis')
          .update({ ativo: ativar })
          .eq('id', alvo.id);
        if (erroAtivo) throw new ErroHttp(500, 'Não foi possível atualizar o cadastro.');
        return resposta({ ok: true });
      }

      default:
        throw new ErroHttp(400, 'Ação desconhecida.');
    }
  } catch (err) {
    if (err instanceof ErroHttp) return resposta({ erro: err.message }, err.status);
    console.error('admin-usuarios:', err);
    return resposta({ erro: 'Erro interno. Tente novamente.' }, 500);
  }
});
