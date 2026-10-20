/**
 * SaberPontual — Sincronização LEGADA com a tabela `saberpontual_store`
 *
 * @deprecated Código extraído de mock/db.ts na Fase 1 do plano do back end
 * (docs/claude/plano-backend.md). NÃO está ligado a nenhum serviço: o mock agora
 * é só localStorage e os serviços Supabase serão reescritos nas Fases 2 a 5.
 * A tabela `saberpontual_store` e este arquivo saem na tarefa 2.4.
 * Não use em código novo.
 */

import type { MockDatabaseSchema } from '../mock/seed';
import { supabase, isSupabaseConfigurado } from '@/lib/supabase';

const ID_STORE = 'global';

/** Grava o banco inteiro no store consolidado da nuvem. Devolve a mensagem de erro, se houver. */
export async function gravarStoreNuvem(db: MockDatabaseSchema): Promise<string | null> {
  if (!isSupabaseConfigurado) return null;
  const { error } = await supabase.from('saberpontual_store').upsert({
    id: ID_STORE,
    versao: db.versao || 1,
    payload: db,
    updated_at: new Date().toISOString(),
  });
  if (error) return error.message;
  void sincronizarTabelasRelacionais(db);
  return null;
}

/** Lê o banco inteiro do store consolidado. `null` se estiver vazio ou der erro. */
export async function carregarStoreNuvem(): Promise<MockDatabaseSchema | null> {
  if (!isSupabaseConfigurado) return null;
  const { data, error } = await supabase
    .from('saberpontual_store')
    .select('payload, versao')
    .eq('id', ID_STORE)
    .maybeSingle();
  if (error || !data || !data.payload) return null;
  return data.payload as MockDatabaseSchema;
}

/** Lê só a versão remota (barato, usado no polling). */
export async function versaoRemotaStore(): Promise<number | null> {
  if (!isSupabaseConfigurado) return null;
  const { data, error } = await supabase
    .from('saberpontual_store')
    .select('versao')
    .eq('id', ID_STORE)
    .maybeSingle();
  if (error || !data) return null;
  return data.versao as number;
}

/** Escuta mudanças do store em tempo real. Devolve a função que cancela a escuta. */
export function assinarStoreNuvem(
  aoReceber: (db: MockDatabaseSchema, versao: number) => void,
  aoConectar: () => void
): () => void {
  const canal = supabase
    .channel('saberpontual_store_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'saberpontual_store' }, (payload) => {
      const novo = payload.new as { payload?: MockDatabaseSchema; versao?: number } | null;
      if (novo && novo.payload) aoReceber(novo.payload, novo.versao || 0);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') aoConectar();
    });
  return () => {
    void supabase.removeChannel(canal);
  };
}

/**
 * Sincroniza em segundo plano os dados para as tabelas relacionais do Supabase
 */
export async function sincronizarTabelasRelacionais(db: MockDatabaseSchema): Promise<void> {
  if (!isSupabaseConfigurado) return;
  try {
    if (db.escolas?.length) {
      await supabase.from('escolas').upsert(
        db.escolas.map((e) => ({
          id: e.id,
          nome: e.nome,
          cidade_uf: e.cidade_uf,
          ano_letivo_atual: e.ano_letivo_atual,
          created_at: e.created_at,
        }))
      );
    }

    if (db.perfis?.length) {
      await supabase.from('perfis').upsert(
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
    }

    if (db.periodos?.length) {
      await supabase.from('periodos').upsert(
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
    }

    if (db.disciplinas?.length) {
      await supabase.from('disciplinas').upsert(
        db.disciplinas.map((d) => ({
          id: d.id,
          escola_id: d.escola_id,
          nome: d.nome,
          created_at: d.created_at,
        }))
      );
    }

    if (db.turmas?.length) {
      await supabase.from('turmas').upsert(
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
    }

    if (db.ofertas?.length) {
      await supabase.from('ofertas').upsert(
        db.ofertas.map((o) => ({
          id: o.id,
          turma_id: o.turma_id,
          disciplina_id: o.disciplina_id,
          professor_id: o.professor_id,
          created_at: o.created_at,
        }))
      );
    }

    if (db.alunos?.length) {
      await supabase.from('alunos').upsert(
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
    }

    if (db.assuntos?.length) {
      await supabase.from('assuntos').upsert(
        db.assuntos.map((as) => ({
          id: as.id,
          escola_id: as.escola_id,
          disciplina_id: as.disciplina_id,
          nome: as.nome,
          created_at: as.created_at,
        }))
      );
    }

    if (db.atividades?.length) {
      await supabase.from('atividades').upsert(
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
    }

    if (db.questoes?.length) {
      await supabase.from('questoes').upsert(
        db.questoes.map((q) => ({
          id: q.id,
          atividade_id: q.atividade_id,
          ordem: q.ordem,
          tipo: q.tipo || 'objetiva',
          dificuldade: (q as unknown as { dificuldade?: string }).dificuldade || 'medio',
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
    }

    if (db.alternativas?.length) {
      await supabase.from('alternativas').upsert(
        db.alternativas.map((alt) => ({
          id: alt.id,
          questao_id: alt.questao_id,
          letra: alt.letra,
          texto: alt.texto,
          correta: alt.correta,
          por_que_errou: alt.por_que_errou || null,
        }))
      );
    }

    if (db.respostas?.length) {
      await supabase.from('respostas').upsert(
        db.respostas.map((r) => ({
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
    }

    if (db.avisos?.length) {
      await supabase.from('avisos').upsert(
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
    }

    if (db.aluno_observacoes?.length) {
      await supabase.from('aluno_observacoes').upsert(
        db.aluno_observacoes.map((obs) => ({
          id: obs.id,
          aluno_id: obs.aluno_id,
          professor_id: obs.professor_id,
          professor_nome: obs.professor_nome,
          texto: obs.texto,
          created_at: obs.created_at,
          updated_at: obs.updated_at,
        }))
      );
    }
  } catch (err) {
    console.warn('[SaberPontual] Aviso ao atualizar tabelas relacionais no Postgres:', err);
  }
}
