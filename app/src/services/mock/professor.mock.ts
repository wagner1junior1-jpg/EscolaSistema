/**
 * SaberPontual — ProfessorService Mock
 */

import { ProfessorService, NovaQuestaoPayload } from '../contracts';
import {
  OfertaDetalhada,
  Atividade,
  AtividadeCompleta,
  Questao,
  Alternativa,
  Frequencia,
  StatusFrequencia,
  Aviso,
  MapaDeCalorAtividade,
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { MockAuthService } from './auth.mock';
import { calcularMapaDeCalorQuestao } from '../calculos';

export class MockProfessorService implements ProfessorService {
  private authService = new MockAuthService();

  async minhasOfertas(professorId?: string): Promise<OfertaDetalhada[]> {
    const db = await getDatabase();
    let profId = professorId;

    if (!profId) {
      const user = await this.authService.usuarioAtual();
      profId = user?.papel === 'professor' ? user.id : 'usr-prof-ana'; // fallback padrão de demonstração
    }

    const ofertasDoProf = db.ofertas.filter((o) => o.professor_id === profId);

    return ofertasDoProf.map((o) => {
      const turma = db.turmas.find((t) => t.id === o.turma_id);
      const disciplina = db.disciplinas.find((d) => d.id === o.disciplina_id);
      const professor = db.perfis.find((p) => p.id === o.professor_id);

      return {
        ...o,
        turma_nome: turma?.nome || 'Turma',
        turma_codigo: turma?.codigo_acesso || '',
        disciplina_nome: disciplina?.nome || 'Disciplina',
        professor_nome: professor?.nome || 'Professor',
      };
    });
  }

  async listarAtividades(ofertaId: string): Promise<Atividade[]> {
    const db = await getDatabase();
    return db.atividades
      .filter((a) => a.oferta_id === ofertaId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async obterAtividade(atividadeId: string): Promise<AtividadeCompleta | null> {
    const db = await getDatabase();
    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) return null;

    const questoesDaAtividade = db.questoes
      .filter((q) => q.atividade_id === atividadeId)
      .sort((a, b) => a.ordem - b.ordem);

    const questoesCompletas = questoesDaAtividade.map((q) => {
      const alternativas = db.alternativas
        .filter((alt) => alt.questao_id === q.id)
        .sort((a, b) => a.letra.localeCompare(b.letra));

      return {
        ...q,
        alternativas,
      };
    });

    return {
      ...atividade,
      questoes: questoesCompletas,
    };
  }

  async criarAtividade(
    ofertaId: string,
    dados: { titulo: string; descricao: string; prazo: string | null; periodo_id: string }
  ): Promise<Atividade> {
    const db = await getDatabase();
    const nova: Atividade = {
      id: `ativ-${Date.now()}`,
      created_at: new Date().toISOString(),
      oferta_id: ofertaId,
      periodo_id: dados.periodo_id,
      titulo: dados.titulo,
      descricao: dados.descricao,
      prazo: dados.prazo,
      status: 'rascunho',
      criado_por: 'usr-prof-ana', // fallback mock
    };
    db.atividades.push(nova);
    saveDatabase(db);
    return nova;
  }

  async atualizarAtividade(id: string, dados: Partial<Atividade>): Promise<Atividade> {
    const db = await getDatabase();
    const idx = db.atividades.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Atividade não encontrada.');

    db.atividades[idx] = { ...db.atividades[idx], ...dados };
    saveDatabase(db);
    return { ...db.atividades[idx] };
  }

  async publicarAtividade(id: string): Promise<void> {
    await this.atualizarAtividade(id, { status: 'publicada' });
  }

  async encerrarAtividade(id: string): Promise<void> {
    await this.atualizarAtividade(id, { status: 'encerrada' });
  }

  async duplicarAtividade(atividadeId: string, paraOfertaId: string): Promise<Atividade> {
    const db = await getDatabase();
    const original = await this.obterAtividade(atividadeId);
    if (!original) throw new Error('Atividade original não encontrada.');

    const agora = new Date().toISOString();
    const novaAtivId = `ativ-dup-${Date.now()}`;

    const novaAtividade: Atividade = {
      id: novaAtivId,
      created_at: agora,
      oferta_id: paraOfertaId,
      periodo_id: original.periodo_id,
      titulo: `${original.titulo} (Cópia)`,
      descricao: original.descricao,
      prazo: original.prazo,
      status: 'rascunho',
      criado_por: original.criado_por,
    };

    db.atividades.push(novaAtividade);

    // Duplica questões e alternativas
    for (const q of original.questoes) {
      const novaQuestaoId = `q-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const novaQuestao: Questao = {
        id: novaQuestaoId,
        created_at: agora,
        atividade_id: novaAtivId,
        ordem: q.ordem,
        enunciado: q.enunciado,
        dica: q.dica,
        explicacao: q.explicacao,
      };
      db.questoes.push(novaQuestao);

      for (const alt of q.alternativas) {
        const novaAlt: Alternativa = {
          id: `alt-dup-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          created_at: agora,
          questao_id: novaQuestaoId,
          letra: alt.letra,
          texto: alt.texto,
          correta: alt.correta,
          por_que_errou: alt.por_que_errou,
        };
        db.alternativas.push(novaAlt);
      }
    }

    saveDatabase(db);
    return novaAtividade;
  }

  async salvarQuestoes(atividadeId: string, questoes: NovaQuestaoPayload[]): Promise<void> {
    const db = await getDatabase();
    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error('Atividade não encontrada.');

    const agora = new Date().toISOString();

    for (const qPayload of questoes) {
      // Validação: Mínimo 2, máximo 5 alternativas
      if (qPayload.alternativas.length < 2 || qPayload.alternativas.length > 5) {
        throw new Error(
          `A questão ${qPayload.ordem} deve conter entre 2 e 5 alternativas (possui ${qPayload.alternativas.length}).`
        );
      }

      // Validação: Exatamente 1 correta
      const totalCorretas = qPayload.alternativas.filter((a) => a.correta).length;
      if (totalCorretas !== 1) {
        throw new Error(
          `A questão ${qPayload.ordem} deve ter exatamente 1 alternativa correta marcada (possui ${totalCorretas}).`
        );
      }

      const questaoId = qPayload.id || `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const jaTemRespostas = db.respostas.some((r) => r.questao_id === questaoId);

      // Se já possui resposta de aluno, regra da Seção 7 (Fase C):
      // "Uma questão já respondida por algum aluno só pode ter o texto editado, não a alternativa correta."
      if (jaTemRespostas && qPayload.id) {
        const questaoExistente = db.questoes.find((q) => q.id === questaoId);
        if (questaoExistente) {
          questaoExistente.enunciado = qPayload.enunciado;
          questaoExistente.dica = qPayload.dica;
          questaoExistente.explicacao = qPayload.explicacao;
        }

        // Permite editar texto, mas NÃO a marcação da alternativa correta
        for (const altPayload of qPayload.alternativas) {
          if (altPayload.id) {
            const altExistente = db.alternativas.find((a) => a.id === altPayload.id);
            if (altExistente) {
              altExistente.texto = altPayload.texto;
              altExistente.por_que_errou = altPayload.por_que_errou;
            }
          }
        }
        continue;
      }

      // Se é nova ou ainda não possui respostas: cria/sobrescreve normalmente
      let questao = db.questoes.find((q) => q.id === questaoId);
      if (!questao) {
        const novaQuestao = {
          id: questaoId,
          created_at: agora,
          atividade_id: atividadeId,
          ordem: qPayload.ordem ?? (db.questoes.length + 1),
          enunciado: qPayload.enunciado,
          dica: qPayload.dica,
          explicacao: qPayload.explicacao,
        };
        db.questoes.push(novaQuestao);
        questao = novaQuestao;
      } else {
        questao.ordem = qPayload.ordem ?? questao.ordem;
        questao.enunciado = qPayload.enunciado;
        questao.dica = qPayload.dica;
        questao.explicacao = qPayload.explicacao;
      }

      // Atualiza alternativas
      db.alternativas = db.alternativas.filter((a) => a.questao_id !== questaoId);
      const letras: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
      for (let i = 0; i < qPayload.alternativas.length; i++) {
        const altPayload = qPayload.alternativas[i];
        const altId = altPayload.id || `alt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        db.alternativas.push({
          id: altId,
          created_at: agora,
          questao_id: questaoId,
          letra: altPayload.letra ?? letras[i],
          texto: altPayload.texto,
          correta: altPayload.correta,
          por_que_errou: altPayload.por_que_errou,
        });
      }
    }

    saveDatabase(db);
  }

  async reordenarQuestoes(atividadeId: string, ordemIds: string[]): Promise<void> {
    const db = await getDatabase();
    ordemIds.forEach((id, index) => {
      const q = db.questoes.find((item) => item.id === id && item.atividade_id === atividadeId);
      if (q) q.ordem = index + 1;
    });
    saveDatabase(db);
  }

  async listarFrequencia(ofertaId: string, data: string): Promise<Frequencia[]> {
    const db = await getDatabase();
    return db.frequencias.filter((f) => f.oferta_id === ofertaId && f.data === data);
  }

  async salvarFrequencia(
    ofertaId: string,
    data: string,
    registros: Array<{ aluno_id: string; status: StatusFrequencia }>,
    registradoPorId?: string
  ): Promise<void> {
    const db = await getDatabase();
    const profId = registradoPorId || 'usr-prof-ana';
    const agora = new Date().toISOString();

    for (const reg of registros) {
      const idx = db.frequencias.findIndex(
        (f) => f.oferta_id === ofertaId && f.aluno_id === reg.aluno_id && f.data === data
      );

      if (idx >= 0) {
        db.frequencias[idx].status = reg.status;
        db.frequencias[idx].registrado_por = profId;
      } else {
        db.frequencias.push({
          id: `freq-${reg.aluno_id}-${data}-${Date.now()}`,
          created_at: agora,
          oferta_id: ofertaId,
          aluno_id: reg.aluno_id,
          data,
          status: reg.status,
          registrado_por: profId,
        });
      }
    }

    saveDatabase(db);
  }

  async listarRecadosTurma(turmaId: string): Promise<Aviso[]> {
    const db = await getDatabase();
    return db.avisos
      .filter((a) => a.turma_id === turmaId)
      .sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime());
  }

  async criarRecadoTurma(
    ofertaId: string,
    dados: { titulo: string; mensagem: string; prioridade: import('@/lib/types').PrioridadeAviso }
  ): Promise<Aviso> {
    const db = await getDatabase();
    // Deriva turma_id a partir da oferta
    const oferta = db.ofertas.find((o) => o.id === ofertaId);
    const escola = db.escolas[0];
    const novo: Aviso = {
      id: `aviso-${Date.now()}`,
      created_at: new Date().toISOString(),
      publicado_em: new Date().toISOString(),
      escola_id: escola?.id || 'esc-001',
      autor_id: 'usr-prof-ana',
      turma_id: oferta?.turma_id || null,
      titulo: dados.titulo,
      mensagem: dados.mensagem,
      prioridade: dados.prioridade,
    };
    db.avisos.push(novo);
    saveDatabase(db);
    return novo;
  }

  async excluirAtividade(id: string): Promise<void> {
    const db = await getDatabase();
    db.atividades = db.atividades.filter((a) => a.id !== id);
    saveDatabase(db);
  }

  async excluirQuestao(id: string): Promise<void> {
    const db = await getDatabase();
    db.questoes = db.questoes.filter((q) => q.id !== id);
    db.alternativas = db.alternativas.filter((a) => a.questao_id !== id);
    saveDatabase(db);
  }

  async mapaDeCalor(atividadeId: string): Promise<MapaDeCalorAtividade> {
    const db = await getDatabase();
    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error('Atividade não encontrada.');

    const questoes = db.questoes
      .filter((q) => q.atividade_id === atividadeId)
      .sort((a, b) => a.ordem - b.ordem);

    const questoesMapa = questoes.map((q) => {
      const alternativas = db.alternativas.filter((alt) => alt.questao_id === q.id);
      const respostas = db.respostas.filter((r) => r.questao_id === q.id);
      return calcularMapaDeCalorQuestao(q, alternativas, respostas);
    });

    const alunoIds = new Set(
      db.respostas
        .filter((r) => questoes.some((q) => q.id === r.questao_id))
        .map((r) => r.aluno_id)
    );

    return {
      atividade_id: atividadeId,
      titulo: atividade.titulo,
      total_alunos_responderam: alunoIds.size,
      questoes: questoesMapa,
    };
  }
}
