/**
 * SaberPontual — Script de Seed e Sincronização Direta com Supabase Postgres
 * 
 * Executa a carga inicial do banco de dados na nuvem com a estrutura pedagógica completa:
 * - Escola, Perfis e Credenciais
 * - Períodos, Turmas e Disciplinas
 * - Alunos, Ofertas e PINs
 * - Atividades, Questões e Alternativas
 * - Respostas de Alunos e Histórico de Desempenho
 * - Banco de Questões e Assuntos
 * - Store consolidado (saberpontual_store)
 */

import { createClient } from '@supabase/supabase-js';
import { criarBancoDemonstracao } from '../services/mock/seed';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env antes de rodar o seed.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executarSeed() {
  console.log('=====================================================');
  console.log('🚀 SaberPontual — Iniciando Sincronização com Supabase');
  console.log(`🌐 URL: ${supabaseUrl}`);
  console.log('=====================================================');

  console.log('📦 Gerando base de dados pedagógica completa...');
  const db = await criarBancoDemonstracao();
  db.versao = 1;

  console.log(`✔ Base gerada:`);
  console.log(`  • ${db.turmas.length} turmas`);
  console.log(`  • ${db.alunos.length} alunos`);
  console.log(`  • ${db.disciplinas.length} disciplinas`);
  console.log(`  • ${db.atividades.length} atividades`);
  console.log(`  • ${db.questoes.length} questões`);
  console.log(`  • ${db.respostas.length} respostas registradas`);

  // 1. Grava no Store Consolidado
  console.log('\n💾 1. Gravando estado consolidado em `saberpontual_store`...');
  const { error: storeError } = await supabase.from('saberpontual_store').upsert({
    id: 'global',
    versao: 1,
    payload: db,
    updated_at: new Date().toISOString(),
  });

  if (storeError) {
    console.error('❌ Erro ao gravar saberpontual_store:', storeError.message);
  } else {
    console.log('✅ `saberpontual_store` sincronizado com sucesso.');
  }

  // 2. Grava nas Tabelas Relacionais do Postgres
  console.log('\n🗄️  2. Gravando nas tabelas relacionais do Postgres...');

  // Escolas
  const { error: errEsc } = await supabase.from('escolas').upsert(
    db.escolas.map((e) => ({
      id: e.id,
      nome: e.nome,
      cidade_uf: e.cidade_uf,
      ano_letivo_atual: e.ano_letivo_atual,
      created_at: e.created_at,
    }))
  );
  console.log(`  • escolas: ${errEsc ? '❌ ' + errEsc.message : '✅ ' + db.escolas.length + ' linhas'}`);

  // Perfis
  const { error: errPerf } = await supabase.from('perfis').upsert(
    db.perfis.map((p) => ({
      id: p.id,
      escola_id: p.escola_id,
      nome: p.nome,
      email: p.email,
      papel: p.papel,
      ativo: p.ativo,
      created_at: p.created_at,
    }))
  );
  console.log(`  • perfis: ${errPerf ? '❌ ' + errPerf.message : '✅ ' + db.perfis.length + ' linhas'}`);

  // Periodos
  const { error: errPer } = await supabase.from('periodos').upsert(
    db.periodos.map((p) => ({
      id: p.id,
      escola_id: p.escola_id,
      nome: p.nome,
      ano_letivo: p.ano_letivo,
      data_inicio: p.data_inicio,
      data_fim: p.data_fim,
      ativo: p.ativo,
      created_at: p.created_at,
    }))
  );
  console.log(`  • periodos: ${errPer ? '❌ ' + errPer.message : '✅ ' + db.periodos.length + ' linhas'}`);

  // Disciplinas
  const { error: errDisc } = await supabase.from('disciplinas').upsert(
    db.disciplinas.map((d) => ({
      id: d.id,
      escola_id: d.escola_id,
      nome: d.nome,
      created_at: d.created_at,
    }))
  );
  console.log(`  • disciplinas: ${errDisc ? '❌ ' + errDisc.message : '✅ ' + db.disciplinas.length + ' linhas'}`);

  // Turmas
  const { error: errTurmas } = await supabase.from('turmas').upsert(
    db.turmas.map((t) => ({
      id: t.id,
      escola_id: t.escola_id,
      nome: t.nome,
      serie: t.serie,
      segmento: t.segmento,
      ano_letivo: t.ano_letivo,
      codigo_acesso: t.codigo_acesso,
      ativa: t.ativa,
      created_at: t.created_at,
    }))
  );
  console.log(`  • turmas: ${errTurmas ? '❌ ' + errTurmas.message : '✅ ' + db.turmas.length + ' linhas'}`);

  // Ofertas
  const { error: errOfertas } = await supabase.from('ofertas').upsert(
    db.ofertas.map((o) => ({
      id: o.id,
      turma_id: o.turma_id,
      disciplina_id: o.disciplina_id,
      professor_id: o.professor_id,
      created_at: o.created_at,
    }))
  );
  console.log(`  • ofertas: ${errOfertas ? '❌ ' + errOfertas.message : '✅ ' + db.ofertas.length + ' linhas'}`);

  // Alunos
  const { error: errAlunos } = await supabase.from('alunos').upsert(
    db.alunos.map((a) => ({
      id: a.id,
      escola_id: a.escola_id,
      turma_id: a.turma_id,
      nome_completo: a.nome_completo,
      numero_chamada: a.numero_chamada,
      pin_hash: a.pin_hash,
      ativo: a.ativo,
      created_at: a.created_at,
    }))
  );
  console.log(`  • alunos: ${errAlunos ? '❌ ' + errAlunos.message : '✅ ' + db.alunos.length + ' linhas'}`);

  // Assuntos
  if (db.assuntos?.length) {
    const { error: errAss } = await supabase.from('assuntos').upsert(
      db.assuntos.map((as) => ({
        id: as.id,
        escola_id: as.escola_id,
        disciplina_id: as.disciplina_id,
        nome: as.nome,
        created_at: as.created_at,
      }))
    );
    console.log(`  • assuntos: ${errAss ? '❌ ' + errAss.message : '✅ ' + db.assuntos.length + ' linhas'}`);
  }

  // Atividades
  const { error: errAtiv } = await supabase.from('atividades').upsert(
    db.atividades.map((at) => ({
      id: at.id,
      oferta_id: at.oferta_id,
      periodo_id: at.periodo_id,
      titulo: at.titulo,
      descricao: at.descricao || '',
      prazo: at.prazo || null,
      modo: at.modo,
      status: at.status,
      criado_por: at.criado_por,
      created_at: at.created_at,
    }))
  );
  console.log(`  • atividades: ${errAtiv ? '❌ ' + errAtiv.message : '✅ ' + db.atividades.length + ' linhas'}`);

  // Questoes (em lotes de 100 para evitar timeout)
  for (let i = 0; i < db.questoes.length; i += 100) {
    const lote = db.questoes.slice(i, i + 100);
    const { error: errQ } = await supabase.from('questoes').upsert(
      lote.map((q) => ({
        id: q.id,
        atividade_id: q.atividade_id,
        ordem: q.ordem,
        tipo: q.tipo || 'objetiva',
        dificuldade: (q as any).dificuldade || 'medio',
        enunciado: q.enunciado,
        imagem_url: q.imagem_url || null,
        dica: q.dica || null,
        explicacao: q.explicacao || null,
        resposta_esperada: q.resposta_esperada || null,
        banco_questao_id: q.banco_questao_id || null,
        assunto_id: q.assunto_id || null,
        created_at: q.created_at,
      }))
    );
    if (errQ) {
      console.error(`  • questoes (lote ${i}): ❌ ${errQ.message}`);
    }
  }
  console.log(`  • questoes: ✅ ${db.questoes.length} linhas processadas`);

  // Alternativas (em lotes de 100)
  for (let i = 0; i < db.alternativas.length; i += 100) {
    const lote = db.alternativas.slice(i, i + 100);
    const { error: errAlt } = await supabase.from('alternativas').upsert(
      lote.map((alt) => ({
        id: alt.id,
        questao_id: alt.questao_id,
        letra: alt.letra,
        texto: alt.texto,
        correta: alt.correta,
        por_que_errou: alt.por_que_errou || null,
      }))
    );
    if (errAlt) {
      console.error(`  • alternativas (lote ${i}): ❌ ${errAlt.message}`);
    }
  }
  console.log(`  • alternativas: ✅ ${db.alternativas.length} linhas processadas`);

  // Respostas (em lotes de 100)
  for (let i = 0; i < db.respostas.length; i += 100) {
    const lote = db.respostas.slice(i, i + 100);
    const { error: errR } = await supabase.from('respostas').upsert(
      lote.map((r) => ({
        id: r.id,
        aluno_id: r.aluno_id,
        questao_id: r.questao_id,
        alternativa_id: r.alternativa_id || null,
        acertou: r.acertou ?? null,
        pontuacao: r.pontuacao ?? null,
        texto_resposta: r.texto_resposta || null,
        correcao: r.correcao || null,
        comentario_professor: r.comentario_professor || null,
        corrigido_por: r.corrigido_por || null,
        corrigido_em: r.corrigido_em || null,
        respondida_em: r.respondida_em,
        tentativas: r.tentativas || 1,
        acertou_final: r.acertou_final ?? null,
      }))
    );
    if (errR) {
      console.error(`  • respostas (lote ${i}): ❌ ${errR.message}`);
    }
  }
  console.log(`  • respostas: ✅ ${db.respostas.length} linhas processadas`);

  // Avisos
  if (db.avisos?.length) {
    const { error: errAv } = await supabase.from('avisos').upsert(
      db.avisos.map((av) => ({
        id: av.id,
        escola_id: av.escola_id,
        autor_id: av.autor_id,
        turma_id: av.turma_id || null,
        titulo: av.titulo,
        mensagem: av.mensagem,
        prioridade: av.prioridade,
        publicado_em: av.publicado_em,
      }))
    );
    console.log(`  • avisos: ${errAv ? '❌ ' + errAv.message : '✅ ' + db.avisos.length + ' linhas'}`);
  }

  console.log('\n=====================================================');
  console.log('🎉 Sincronização com o Supabase concluída com sucesso!');
  console.log('=====================================================');
}

void executarSeed();
