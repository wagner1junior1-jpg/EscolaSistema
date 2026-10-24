/**
 * SaberPontual — Seed do Supabase de TESTE (Fase 7.1 e 7.2)
 *
 * Carrega a base de demonstração ampliada do mock no Supabase Postgres de forma idempotente.
 * Usa a service role, que só roda na máquina do administrador: nunca coloque a chave em
 * variável VITE_* nem no front.
 *
 * Como rodar (PowerShell, na pasta app/):
 *   $env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "cole a service_role aqui"
 *   $env:VITE_SUPABASE_ANON_KEY = "a anon key (a mesma do app/.env)"
 *   npx vite-node src/scripts/seed-supabase.ts -- --confirmo-teste
 *
 * Para zerar a escola demo antes de recarregar:
 *   npx vite-node src/scripts/seed-supabase.ts -- --confirmo-teste --zerar
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { criarBancoDemonstracao } from '../services/mock/seed';
import { idDe, recuperarPins, montarLinhas, type LinhasPostgres } from './seed-mapa';

function falhar(mensagem: string): never {
  console.error(`\n✖ ${mensagem}`);
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!url) falhar('Variável de ambiente SUPABASE_URL não definida.');
if (!serviceRoleKey) falhar('Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não definida.');
if (!anonKey) falhar('Variável de ambiente VITE_SUPABASE_ANON_KEY não definida.');

const temConfirmoTeste = process.argv.includes('--confirmo-teste');
const temZerar = process.argv.includes('--zerar');

if (!temConfirmoTeste) {
  console.log(`Projeto: ${url}`);
  console.log(
    'Este script grava dados fictícios e, com --zerar, apaga a escola de demonstração. Rode de novo com --confirmo-teste se este é o projeto de TESTE.'
  );
  process.exit(1);
}

// Garante que o mock gere a base completa (não base mínima de teste)
if (process.env.NODE_ENV === 'test') {
  delete process.env.NODE_ENV;
}
if (process.env.VITEST) {
  delete process.env.VITEST;
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let clientDirecao: SupabaseClient | null = null;
let clientAna: SupabaseClient | null = null;

async function executarSeed() {
  console.log('=====================================================');
  console.log('🚀 SaberPontual — Seed do Supabase de TESTE');
  console.log(`🌐 URL: ${url}`);
  console.log(`⚙️  Modo: ${temZerar ? 'Zerar e recarregar (--zerar)' : 'Carga idempotente'}`);
  console.log('=====================================================');

  // 1. Gerar a base do mock ampliada
  console.log('\n📦 Gerando base de dados de demonstração...');
  const db = await criarBancoDemonstracao();
  console.log('✔ Base gerada:');
  console.log(`  • Turmas: ${db.turmas.length}`);
  console.log(`  • Alunos: ${db.alunos.length}`);
  console.log(`  • Atividades: ${db.atividades.length}`);
  console.log(`  • Questões: ${db.questoes.length}`);
  console.log(`  • Respostas: ${db.respostas.length}`);

  const escolaDemoId = idDe('escolas', 'esc-001');

  // 2. Se --zerar: apagar escola demo (cascade) e usuários @demo.com
  if (temZerar) {
    console.log('\n🧹 Zerando escola de demonstração e usuários demo...');
    const { data: perfisDemo, error: errPerfis } = await admin
      .from('perfis')
      .select('id, email')
      .eq('escola_id', escolaDemoId);
    if (errPerfis) {
      falhar(`Erro ao buscar perfis da escola demo: ${errPerfis.message}`);
    }

    const userIdsParaApagar = new Set<string>();
    if (perfisDemo) {
      for (const p of perfisDemo) {
        if (p.id) userIdsParaApagar.add(p.id);
      }
    }

    // Apaga a escola no Postgres; as tabelas filhas caem por ON DELETE CASCADE
    const { error: errDelEscola } = await admin.from('escolas').delete().eq('id', escolaDemoId);
    if (errDelEscola) {
      falhar(`Erro ao apagar escola demo: ${errDelEscola.message}`);
    }
    console.log('✔ Escola demo e tabelas filhas apagadas (cascade).');

    // Lista usuários do Auth em páginas de 1000 e identifica os que terminam em @demo.com
    let pageAuthZerar = 1;
    while (true) {
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
        page: pageAuthZerar,
        perPage: 1000,
      });
      if (listErr) {
        falhar(`Erro ao listar usuários do Auth: ${listErr.message}`);
      }
      const users = listData?.users ?? [];
      for (const u of users) {
        if (u.email && u.email.toLowerCase().endsWith('@demo.com')) {
          userIdsParaApagar.add(u.id);
        }
      }
      if (users.length < 1000) break;
      pageAuthZerar++;
    }

    let totalApagados = 0;
    for (const uid of userIdsParaApagar) {
      const { error: errDelUser } = await admin.auth.admin.deleteUser(uid);
      if (errDelUser) {
        falhar(`Erro ao remover usuário do Auth (${uid}): ${errDelUser.message}`);
      }
      totalApagados++;
    }
    console.log(`✔ Usuários demo removidos do Auth: ${totalApagados}`);
  }

  // 3. Usuários do Auth para cada perfil da base
  console.log('\n👤 Sincronizando usuários do Auth...');
  const mapaPerfis = new Map<string, string>(); // idLegivel -> uuid Auth

  // Mapeia usuários existentes no Auth
  const authUsersPorEmail = new Map<string, string>();
  let pageAuth = 1;
  while (true) {
    const { data: authData, error: authListErr } = await admin.auth.admin.listUsers({
      page: pageAuth,
      perPage: 1000,
    });
    if (authListErr) {
      falhar(`Erro ao listar usuários do Auth: ${authListErr.message}`);
    }
    const users = authData?.users ?? [];
    for (const u of users) {
      if (u.email) {
        authUsersPorEmail.set(u.email.toLowerCase(), u.id);
      }
    }
    if (users.length < 1000) break;
    pageAuth++;
  }

  for (const p of db.perfis) {
    const emailLower = p.email?.toLowerCase();
    if (!emailLower) {
      falhar(`Perfil '${p.id}' não possui e-mail cadastrado no mock.`);
    }

    let authUuid: string | undefined;

    // 1. Tenta buscar pelo email na tabela perfis
    const { data: perfilExistente, error: errBuscaPerfil } = await admin
      .from('perfis')
      .select('id, email')
      .eq('email', emailLower)
      .maybeSingle();

    if (errBuscaPerfil) {
      falhar(`Erro ao consultar perfil '${emailLower}': ${errBuscaPerfil.message}`);
    }

    if (perfilExistente?.id) {
      authUuid = perfilExistente.id;
    } else if (authUsersPorEmail.has(emailLower)) {
      authUuid = authUsersPorEmail.get(emailLower);
    } else {
      const senha = (p.email && db.credenciais[p.email]) || 'demo123';
      const { data: novoUser, error: errCreate } = await admin.auth.admin.createUser({
        email: p.email,
        password: senha,
        email_confirm: true,
      });
      if (errCreate || !novoUser?.user?.id) {
        falhar(`Erro ao criar usuário do Auth para '${p.email}': ${errCreate?.message}`);
      }
      authUuid = novoUser.user.id;
      authUsersPorEmail.set(emailLower, authUuid);
    }

    if (!authUuid) {
      falhar(`UUID do Auth não encontrado para o perfil '${p.id}' (${p.email}).`);
    }

    mapaPerfis.set(p.id, authUuid);
  }
  console.log(`✔ ${mapaPerfis.size} perfis mapeados com sucesso.`);

  // 4. Gravar dados nas tabelas relacionais em lotes de até 500
  console.log('\n🗄️  Gravando dados nas tabelas relacionais do Postgres...');
  const linhas = montarLinhas(db, mapaPerfis);

  const tabelasNaOrdem: Array<keyof LinhasPostgres> = [
    'escolas',
    'perfis',
    'periodos',
    'disciplinas',
    'turmas',
    'ofertas',
    'alunos',
    'assuntos',
    'banco_questoes',
    'banco_alternativas',
    'atividades',
    'questoes',
    'alternativas',
    'respostas',
    'avisos',
    'aluno_observacoes',
  ];

  for (const tabela of tabelasNaOrdem) {
    const registros = linhas[tabela];
    for (let i = 0; i < registros.length; i += 500) {
      const lote = registros.slice(i, i + 500);
      const { error: errUpsert } = await admin
        .from(tabela)
        .upsert(lote as any, { onConflict: 'id' });
      if (errUpsert) {
        falhar(`Erro ao gravar na tabela '${tabela}' (lote ${Math.floor(i / 500) + 1}): ${errUpsert.message}`);
      }
    }
    console.log(`✔ ${tabela}: ${registros.length} linhas`);
  }

  // 5. PINs dos alunos via RPC definir_pin_aluno autenticado como direcao@demo.com
  console.log('\n🔐 Cadastrando PINs dos alunos via RPC definir_pin_aluno...');
  clientDirecao = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const senhaDirecao = db.credenciais['direcao@demo.com'] || 'demo123';
  const { data: authDir, error: errAuthDir } = await clientDirecao.auth.signInWithPassword({
    email: 'direcao@demo.com',
    password: senhaDirecao,
  });
  if (errAuthDir || !authDir?.session) {
    falhar(`Erro ao autenticar como direcao@demo.com: ${errAuthDir?.message}`);
  }

  const mapaPins = recuperarPins(db.alunos);
  const CHUNK_SIZE = 10;
  for (let i = 0; i < db.alunos.length; i += CHUNK_SIZE) {
    const chunk = db.alunos.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (aluno) => {
        const pin = mapaPins.get(aluno.id);
        if (!pin) falhar(`PIN não encontrado para aluno '${aluno.id}'.`);
        const alunoUuid = idDe('alunos', aluno.id);
        const { error: errPinRpc } = await clientDirecao!.rpc('definir_pin_aluno', {
          p_aluno_id: alunoUuid,
          p_pin: pin,
        });
        if (errPinRpc) {
          falhar(`Erro ao definir PIN para aluno ${aluno.id} (${alunoUuid}): ${errPinRpc.message}`);
        }
      })
    );
  }
  console.log(`✔ PINs cadastrados para ${db.alunos.length} alunos.`);

  // 6. Verificação final
  console.log('\n🔍 Verificação final do banco de dados...');
  let falhas = 0;

  // 6.1 Contagem por tabela
  const tabelasComEscolaId = new Set([
    'perfis',
    'periodos',
    'disciplinas',
    'turmas',
    'alunos',
    'assuntos',
    'banco_questoes',
    'avisos',
  ]);

  const contadaPorInteiro = (tabela: string) => tabela !== 'escolas' && !tabelasComEscolaId.has(tabela);

  for (const tabela of tabelasNaOrdem) {
    const esperado = linhas[tabela].length;
    let q = admin.from(tabela).select('id', { count: 'exact', head: true });
    if (tabela === 'escolas') {
      q = q.eq('id', escolaDemoId);
    } else if (tabelasComEscolaId.has(tabela)) {
      q = q.eq('escola_id', escolaDemoId);
    }
    const { count, error: errCount } = await q;
    if (errCount) {
      falhas++;
      console.error(`✖ Contagem na tabela '${tabela}': erro ${errCount.message}`);
    } else if (
      // Tabelas sem escola_id (ofertas, atividades, questões...) são contadas por inteiro: se outra
      // escola tiver dados nelas, o total passa do esperado e isso NÃO é falha do seed.
      contadaPorInteiro(tabela) ? (count ?? 0) < esperado : count !== esperado
    ) {
      falhas++;
      console.error(`✖ Contagem na tabela '${tabela}': esperado ${esperado}, obtido ${count}`);
    } else {
      console.log(`✔ Contagem na tabela '${tabela}': ${count} = ${esperado}`);
    }
  }

  // 6.2 RPC aluno_listar_turma('7A-MAT')
  const clientAnon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const turma7A = db.turmas.find((t) => t.codigo_acesso === '7A-MAT');
  const codigoTurma = turma7A ? turma7A.codigo_acesso : '7A-MAT';

  const { data: listaAlunos, error: errListaTurma } = await clientAnon.rpc('aluno_listar_turma', {
    p_codigo: codigoTurma,
  });

  if (errListaTurma || !Array.isArray(listaAlunos) || listaAlunos.length === 0) {
    falhas++;
    console.error(`✖ RPC aluno_listar_turma('${codigoTurma}'): ${errListaTurma?.message || 'lista vazia'}`);
  } else {
    console.log(`✔ RPC aluno_listar_turma('${codigoTurma}'): devolveu ${listaAlunos.length} alunos`);
  }

  // 6.3 RPC aluno_login
  const alunoLucas = db.alunos.find((a) => a.id === 'aluno-7a-1') || db.alunos[0];
  const lucasUuid = idDe('alunos', alunoLucas.id);

  const { data: loginOk, error: errLoginOk } = await clientAnon.rpc('aluno_login', {
    p_aluno_id: lucasUuid,
    p_pin: '1420',
  });

  const { data: loginErr, error: errLoginErr } = await clientAnon.rpc('aluno_login', {
    p_aluno_id: lucasUuid,
    p_pin: '0000',
  });

  // Login correto de novo para zerar o contador de tentativas
  const { data: loginReset, error: errLoginReset } = await clientAnon.rpc('aluno_login', {
    p_aluno_id: lucasUuid,
    p_pin: '1420',
  });

  const okSucceeded = !errLoginOk && loginOk && (loginOk as any).ok === true;
  const failSucceeded = !errLoginErr && loginErr && (loginErr as any).ok === false;
  const resetSucceeded = !errLoginReset && loginReset && (loginReset as any).ok === true;

  if (!okSucceeded || !failSucceeded || !resetSucceeded) {
    falhas++;
    console.error(`✖ RPC aluno_login: validação de PIN falhou`);
  } else {
    console.log(`✔ RPC aluno_login: PIN 1420 ok=true, PIN 0000 ok=false, contador zerado`);
  }

  // 6.4 RLS turmas (Ana vs anon)
  clientAna = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const senhaAna = db.credenciais['ana@demo.com'] || 'demo123';
  const { error: errAuthAna } = await clientAna.auth.signInWithPassword({
    email: 'ana@demo.com',
    password: senhaAna,
  });

  if (errAuthAna) {
    falhas++;
    console.error(`✖ Autenticação da prof. Ana falhou: ${errAuthAna.message}`);
  } else {
    const { data: turmasAna, error: errTurmasAna } = await clientAna.from('turmas').select('id');
    const { data: turmasAnon, error: errTurmasAnon } = await clientAnon.from('turmas').select('id');

    const anaOk = !errTurmasAna && (turmasAna?.length ?? 0) >= 1;
    // O anônimo não tem nem o privilégio de ler `turmas` (REVOKE ALL da migration 0003): o
    // esperado é erro de permissão. Lista vazia também é aceitável; qualquer linha NÃO é.
    const anonOk = errTurmasAnon
      ? errTurmasAnon.code === '42501' || /permission denied/i.test(errTurmasAnon.message)
      : (turmasAnon?.length ?? 0) === 0;

    if (!anaOk || !anonOk) {
      falhas++;
      console.error(
        `✖ RLS turmas: Ana vê ${turmasAna?.length ?? 0} turma(s) (esperado >= 1); anônimo: ${
          errTurmasAnon ? `erro inesperado (${errTurmasAnon.message})` : `${turmasAnon?.length ?? 0} turma(s) (esperado 0)`
        }`
      );
    } else {
      console.log(`✔ RLS turmas: Ana autenticada vê ${turmasAna?.length} turma(s), anônimo sem acesso`);
    }
  }

  if (falhas > 0) {
    console.error(`\n✖ SEED COM FALHAS (${falhas} verificação(ões) com falha)`);
    process.exit(1);
  } else {
    console.log('\n✔ SEED OK');
  }
}

// Execução com garantia de encerramento das sessões
executarSeed()
  .catch((err) => {
    falhar(`Erro inesperado durante a execução do seed: ${err?.message || err}`);
  })
  .finally(async () => {
    if (clientDirecao) {
      await clientDirecao.auth.signOut().catch(() => {});
    }
    if (clientAna) {
      await clientAna.auth.signOut().catch(() => {});
    }
  });
