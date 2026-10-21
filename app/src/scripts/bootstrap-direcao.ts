/**
 * SaberPontual — Bootstrap da primeira direção (Fase 3.4)
 *
 * Cria a escola e o primeiro usuário da direção, que depois cadastra os demais pela tela de
 * Gestão (Edge Function admin-usuarios). Usa a service role, que só existe NESTE script rodando
 * na sua máquina: nunca coloque a chave em variável VITE_* nem no front.
 *
 * Como rodar (PowerShell, na pasta app/):
 *   $env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "chave service_role (Settings > API)"
 *   npx vite-node src/scripts/bootstrap-direcao.ts -- --escola "Colégio X" --cidade "Goiânia/GO" --nome "Maria Silva" --email maria@escola.com
 *
 * Opcional: --senha "..." (mínimo 6). Sem ela, gera uma provisória e mostra UMA vez no final.
 * O usuário troca a senha no primeiro acesso. Não roda se o e-mail já existir (não duplica).
 */

import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1]?.trim() : undefined;
}

function falhar(mensagem: string): never {
  console.error(`✖ ${mensagem}`);
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const chaveServico = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const escola = arg('escola');
const cidade = arg('cidade');
const nome = arg('nome');
const email = arg('email')?.toLowerCase();
const senhaInformada = arg('senha');

if (!url || !chaveServico) falhar('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ver o topo do script).');
if (!escola || !cidade || !nome || !email) {
  falhar('Informe --escola, --cidade, --nome e --email.');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falhar('E-mail inválido.');
if (senhaInformada !== undefined && senhaInformada.length < 6) falhar('A senha deve ter pelo menos 6 caracteres.');

const senha =
  senhaInformada || Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

const admin = createClient(url, chaveServico, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function executar() {
  const { data: existente, error: erroBusca } = await admin
    .from('perfis')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (erroBusca) falhar(`Não foi possível consultar perfis: ${erroBusca.message}`);
  if (existente) falhar(`Já existe um perfil com o e-mail ${email}. Nada foi alterado.`);

  const { data: novaEscola, error: erroEscola } = await admin
    .from('escolas')
    .insert({ nome: escola, cidade_uf: cidade })
    .select('id')
    .single();
  if (erroEscola || !novaEscola) falhar(`Não foi possível criar a escola: ${erroEscola?.message}`);

  const { data: usuario, error: erroUsuario } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (erroUsuario || !usuario.user) {
    await admin.from('escolas').delete().eq('id', novaEscola.id);
    falhar(`Não foi possível criar o usuário no Auth: ${erroUsuario?.message}`);
  }

  const { error: erroPerfil } = await admin.from('perfis').insert({
    id: usuario.user.id,
    escola_id: novaEscola.id,
    nome,
    email,
    papel: 'direcao',
    trocar_senha: true,
  });
  if (erroPerfil) {
    await admin.auth.admin.deleteUser(usuario.user.id);
    await admin.from('escolas').delete().eq('id', novaEscola.id);
    falhar(`Não foi possível criar o perfil (nada ficou gravado): ${erroPerfil.message}`);
  }

  console.log('✔ Escola e direção criadas.');
  console.log(`  Escola: ${escola} (${novaEscola.id})`);
  console.log(`  Direção: ${nome} <${email}>`);
  if (!senhaInformada) {
    console.log(`  Senha provisória: ${senha}   (anote agora: não será mostrada de novo)`);
  }
  console.log('  No primeiro acesso o sistema pede a troca da senha.');
}

executar().catch((err) => falhar(err instanceof Error ? err.message : String(err)));
