/**
 * SaberPontual — ProfessorService Mock
 * 
 * Regras estritas de autorização (Seções 4, 7.1):
 * - Métodos de ESCRITA: exclusivos do professor dono da oferta (cadeia questão -> atividade -> oferta -> professor_id).
 * - Métodos de LEITURA: liberados para o professor dono da oferta, além de 'direcao' e 'coordenacao'.
 * - Sem nenhum fallback de usuário padrão.
 * - Validações de status: publicar só de 'rascunho' com >= 1 questão válida; encerrar só de 'publicada'.
 * - Modo prova e exercício: aceito em rascunho, bloqueado após publicação.
 * - Relatórios de desempenho e ficha do aluno: leitura pelo professor da oferta, coordenação e direção.
 */

import { ProfessorService, NovaQuestaoPayload } from '../contracts';
import {
  OfertaDetalhada,
  Atividade,
  AtividadeCompleta,
  Questao,
  Alternativa,
  ModoAtividade,
  Aviso,
  PrioridadeAviso,
  MapaDeCalorAtividade,
  Perfil,
  RelatorioDesempenhoOferta,
  DesempenhoOfertaAluno,
  DesempenhoOfertaAtividadeAluno,
  FichaAluno,
  FichaAlunoAtividadeItem,
  FichaAlunoQuestaoItem,
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { gerarId } from './ids';
import { exigirUsuario } from './autorizacao';
import {
  calcularMapaDeCalorQuestao,
  calcularAproveitamentoAtividade,
  calcularMediaPeriodo,
  faixaDesempenho,
  mediaDoAlunoNasAtividades,
} from '../calculos';

export class MockProfessorService implements ProfessorService {
  /**
   * Helper para verificar se o usuário autenticado tem permissão de leitura sobre uma oferta
   */
  private async validarAcessoLeituraOferta(ofertaId: string): Promise<Perfil> {
    const usuario = await exigirUsuario(['professor', 'direcao', 'coordenacao']);
    if (usuario.papel === 'direcao' || usuario.papel === 'coordenacao') {
      return usuario;
    }

    const db = await getDatabase();
    const oferta = db.ofertas.find((o) => o.id === ofertaId);
    if (!oferta) throw new Error('Oferta não encontrada.');

    if (oferta.professor_id !== usuario.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    return usuario;
  }

  /**
   * Helper para verificar se o usuário autenticado é o professor dono da oferta (escrita)
   */
  private async validarAcessoEscritaOferta(ofertaId: string): Promise<Perfil> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();
    const oferta = db.ofertas.find((o) => o.id === ofertaId);
    if (!oferta) throw new Error('Oferta não encontrada.');

    if (oferta.professor_id !== usuario.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    return usuario;
  }

  /**
   * Helper para obter oferta de uma atividade
   */
  private async obterOfertaDaAtividade(atividadeId: string) {
    const db = await getDatabase();
    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error('Atividade não encontrada.');
    const oferta = db.ofertas.find((o) => o.id === atividade.oferta_id);
    if (!oferta) throw new Error('Oferta associada à atividade não encontrada.');
    return { atividade, oferta };
  }

  async minhasOfertas(): Promise<OfertaDetalhada[]> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();

    const ofertasDoProf = db.ofertas.filter((o) => o.professor_id === usuario.id);

    return ofertasDoProf.map((o) => {
      const turma = db.turmas.find((t) => t.id === o.turma_id);
      const disciplina = db.disciplinas.find((d) => d.id === o.disciplina_id);

      return {
        ...o,
        turma_nome: turma?.nome || 'Turma',
        turma_codigo: turma?.codigo_acesso || '',
        disciplina_nome: disciplina?.nome || 'Disciplina',
        professor_nome: usuario.nome,
      };
    });
  }

  async listarAtividades(ofertaId: string): Promise<Atividade[]> {
    await this.validarAcessoLeituraOferta(ofertaId);
    const db = await getDatabase();
    return db.atividades
      .filter((a) => a.oferta_id === ofertaId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async obterAtividade(atividadeId: string): Promise<AtividadeCompleta | null> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoLeituraOferta(oferta.id);

    const db = await getDatabase();
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
    dados: { titulo: string; descricao: string; prazo: string | null; periodo_id: string; modo?: ModoAtividade }
  ): Promise<Atividade> {
    const usuario = await this.validarAcessoEscritaOferta(ofertaId);
    const db = await getDatabase();

    const nova: Atividade = {
      id: gerarId('ativ'),
      created_at: new Date().toISOString(),
      oferta_id: ofertaId,
      periodo_id: dados.periodo_id,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      prazo: dados.prazo,
      modo: dados.modo ?? 'exercicio', // Padrão exercício conforme docs
      status: 'rascunho', // Sempre rascunho na criação
      criado_por: usuario.id,
    };

    db.atividades.push(nova);
    saveDatabase(db);
    return nova;
  }

  async atualizarAtividade(
    id: string,
    dados: { titulo?: string; descricao?: string; prazo?: string | null; periodo_id?: string; modo?: ModoAtividade }
  ): Promise<Atividade> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    const db = await getDatabase();
    const ativInDb = db.atividades.find((a) => a.id === id);
    if (!ativInDb) throw new Error('Atividade não encontrada.');

    // O modo só pode ser alterado enquanto a atividade estiver em rascunho
    if (dados.modo !== undefined) {
      if (atividade.status !== 'rascunho') {
        throw new Error('O modo da atividade só pode ser alterado enquanto estiver em rascunho.');
      }
      ativInDb.modo = dados.modo;
    }

    if (dados.titulo !== undefined) ativInDb.titulo = dados.titulo.trim();
    if (dados.descricao !== undefined) ativInDb.descricao = dados.descricao.trim();
    if (dados.prazo !== undefined) ativInDb.prazo = dados.prazo;
    if (dados.periodo_id !== undefined) ativInDb.periodo_id = dados.periodo_id;

    saveDatabase(db);
    return ativInDb;
  }

  async excluirAtividade(id: string): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'rascunho') {
      throw new Error('Apenas atividades em rascunho e sem respostas podem ser excluídas.');
    }

    const db = await getDatabase();
    const questoes = db.questoes.filter((q) => q.atividade_id === id);
    const questaoIds = questoes.map((q) => q.id);

    const temRespostas = db.respostas.some((r) => questaoIds.includes(r.questao_id));
    if (temRespostas) {
      throw new Error('Apenas atividades em rascunho e sem respostas podem ser excluídas.');
    }

    // Exclui alternativas, questões e a atividade
    db.alternativas = db.alternativas.filter((alt) => !questaoIds.includes(alt.questao_id));
    db.questoes = db.questoes.filter((q) => q.atividade_id !== id);
    db.atividades = db.atividades.filter((a) => a.id !== id);

    saveDatabase(db);
  }

  async publicarAtividade(id: string): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'rascunho') {
      throw new Error('Apenas atividades em rascunho podem ser publicadas.');
    }

    const db = await getDatabase();
    const questoes = db.questoes.filter((q) => q.atividade_id === id);
    if (questoes.length === 0) {
      throw new Error('A atividade precisa ter pelo menos 1 questão para ser publicada.');
    }

    for (const q of questoes) {
      const alts = db.alternativas.filter((a) => a.questao_id === q.id);
      if (alts.length < 2 || alts.length > 5) {
        throw new Error(
          `A questão ${q.ordem} possui número inválido de alternativas (deve ter entre 2 e 5).`
        );
      }
      const corretas = alts.filter((a) => a.correta).length;
      if (corretas !== 1) {
        throw new Error(`A questão ${q.ordem} deve conter exatamente 1 alternativa correta.`);
      }
    }

    const ativInDb = db.atividades.find((a) => a.id === id);
    if (ativInDb) {
      ativInDb.status = 'publicada';
    }
    saveDatabase(db);
  }

  async encerrarAtividade(id: string): Promise<void> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'publicada') {
      throw new Error('Apenas atividades publicadas podem ser encerradas.');
    }

    const db = await getDatabase();
    const ativInDb = db.atividades.find((a) => a.id === id);
    if (ativInDb) {
      ativInDb.status = 'encerrada';
    }
    saveDatabase(db);
  }

  async duplicarAtividade(atividadeId: string, paraOfertaId: string): Promise<Atividade> {
    const usuario = await exigirUsuario(['professor']);
    const { atividade: original, oferta: ofertaOrigem } =
      await this.obterOfertaDaAtividade(atividadeId);

    // O professor deve ser dono da oferta de origem e da oferta de destino
    if (ofertaOrigem.professor_id !== usuario.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const db = await getDatabase();
    const ofertaDestino = db.ofertas.find((o) => o.id === paraOfertaId);
    if (!ofertaDestino || ofertaDestino.professor_id !== usuario.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const agora = new Date().toISOString();
    const novaAtivId = gerarId('ativ');

    const novaAtividade: Atividade = {
      id: novaAtivId,
      created_at: agora,
      oferta_id: paraOfertaId,
      periodo_id: original.periodo_id,
      titulo: `${original.titulo} (Cópia)`,
      descricao: original.descricao,
      prazo: original.prazo,
      modo: original.modo, // Copia o modo (prova ou exercicio)
      status: 'rascunho',
      criado_por: usuario.id,
    };

    db.atividades.push(novaAtividade);

    const questoesOriginais = db.questoes
      .filter((q) => q.atividade_id === atividadeId)
      .sort((a, b) => a.ordem - b.ordem);

    for (const q of questoesOriginais) {
      const novaQuestaoId = gerarId('q');
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

      const altsOriginais = db.alternativas
        .filter((alt) => alt.questao_id === q.id)
        .sort((a, b) => a.letra.localeCompare(b.letra));

      for (const alt of altsOriginais) {
        const novaAlt: Alternativa = {
          id: gerarId('alt'),
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
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoEscritaOferta(oferta.id);

    const db = await getDatabase();
    const agora = new Date().toISOString();
    const letrasValidas: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];

    // 1. Validação de textos e integridade de IDs de todas as questões e alternativas
    for (let i = 0; i < questoes.length; i++) {
      const qPayload = questoes[i];
      const ordemCalculada = qPayload.ordem ?? i + 1;

      // Validação de texto do enunciado
      if (!qPayload.enunciado || !qPayload.enunciado.trim()) {
        throw new Error(`O enunciado da questão ${ordemCalculada} não pode ficar vazio.`);
      }

      // Validação de quantidade de alternativas (entre 2 e 5)
      if (!qPayload.alternativas || qPayload.alternativas.length < 2 || qPayload.alternativas.length > 5) {
        throw new Error(
          `A questão ${ordemCalculada} deve conter entre 2 e 5 alternativas (possui ${qPayload.alternativas?.length || 0}).`
        );
      }

      // Validação de exatamente 1 correta
      const totalCorretas = qPayload.alternativas.filter((a) => a.correta).length;
      if (totalCorretas !== 1) {
        throw new Error(
          `A questão ${ordemCalculada} deve ter exatamente 1 alternativa correta marcada.`
        );
      }

      // Validação de texto das alternativas
      for (let altIdx = 0; altIdx < qPayload.alternativas.length; altIdx++) {
        const alt = qPayload.alternativas[altIdx];
        if (!alt.texto || !alt.texto.trim()) {
          throw new Error(
            `O texto da alternativa ${letrasValidas[altIdx] || altIdx + 1} da questão ${ordemCalculada} não pode ficar vazio.`
          );
        }
      }

      // Validação de integridade de IDs:
      // Se trouxer id de questão, ela deve pertencer à atividadeId informada
      if (qPayload.id) {
        const qExistente = db.questoes.find((q) => q.id === qPayload.id);
        if (!qExistente || qExistente.atividade_id !== atividadeId) {
          throw new Error('Questão ou alternativa inválida para esta atividade.');
        }
      }

      // Se trouxer id de alternativa, ela deve pertencer àquela questão
      for (const altPayload of qPayload.alternativas) {
        if (altPayload.id) {
          const altExistente = db.alternativas.find((a) => a.id === altPayload.id);
          if (!altExistente || !qPayload.id || altExistente.questao_id !== qPayload.id) {
            throw new Error('Questão ou alternativa inválida para esta atividade.');
          }
        }
      }
    }

    // 2. Regra de edição por status da atividade:
    // Alterações estruturais só em 'rascunho'. Em 'publicada' ou 'encerrada', só é permitido corrigir textos.
    if (atividade.status !== 'rascunho') {
      const questoesAtuais = db.questoes
        .filter((q) => q.atividade_id === atividadeId)
        .sort((a, b) => a.ordem - b.ordem);

      // Não pode adicionar nem remover questões
      if (questoes.length !== questoesAtuais.length) {
        throw new Error('Atividade publicada: só é possível corrigir textos.');
      }

      for (let i = 0; i < questoes.length; i++) {
        const qPayload = questoes[i];
        if (!qPayload.id) {
          throw new Error('Atividade publicada: só é possível corrigir textos.');
        }

        const qAtual = questoesAtuais.find((q) => q.id === qPayload.id);
        if (!qAtual) {
          throw new Error('Atividade publicada: só é possível corrigir textos.');
        }

        const altsAtuais = db.alternativas
          .filter((a) => a.questao_id === qAtual.id)
          .sort((a, b) => a.letra.localeCompare(b.letra));

        // Não pode mudar quantidade de alternativas
        if (qPayload.alternativas.length !== altsAtuais.length) {
          throw new Error('Atividade publicada: só é possível corrigir textos.');
        }

        // Não pode trocar qual é a alternativa correta
        for (let altIdx = 0; altIdx < altsAtuais.length; altIdx++) {
          const payloadAlt = qPayload.alternativas[altIdx];
          const existAlt = altsAtuais[altIdx];
          if (payloadAlt.correta !== existAlt.correta) {
            throw new Error('Atividade publicada: só é possível corrigir textos.');
          }
        }
      }

      // Aplica atualização estritamente textual
      for (const qPayload of questoes) {
        const qAtual = questoesAtuais.find((q) => q.id === qPayload.id)!;
        qAtual.enunciado = qPayload.enunciado.trim();
        qAtual.dica = qPayload.dica ? qPayload.dica.trim() : null;
        qAtual.explicacao = qPayload.explicacao ? qPayload.explicacao.trim() : null;

        const altsAtuais = db.alternativas
          .filter((a) => a.questao_id === qAtual.id)
          .sort((a, b) => a.letra.localeCompare(b.letra));

        for (let altIdx = 0; altIdx < altsAtuais.length; altIdx++) {
          const payloadAlt = qPayload.alternativas[altIdx];
          const existAlt = altsAtuais[altIdx];
          existAlt.texto = payloadAlt.texto.trim();
          existAlt.por_que_errou = payloadAlt.por_que_errou ? payloadAlt.por_que_errou.trim() : null;
        }
      }

      saveDatabase(db);
      return;
    }

    // 3. Status 'rascunho': permite criação e edição estrutural completa
    for (let i = 0; i < questoes.length; i++) {
      const qPayload = questoes[i];
      const ordemCalculada = qPayload.ordem ?? i + 1;
      const questaoId = qPayload.id;

      const idFinal = questaoId || gerarId('q');
      let questao = db.questoes.find((q) => q.id === idFinal);

      if (!questao) {
        questao = {
          id: idFinal,
          created_at: agora,
          atividade_id: atividadeId,
          ordem: ordemCalculada,
          enunciado: qPayload.enunciado.trim(),
          dica: qPayload.dica ? qPayload.dica.trim() : null,
          explicacao: qPayload.explicacao ? qPayload.explicacao.trim() : null,
        };
        db.questoes.push(questao);
      } else {
        questao.ordem = ordemCalculada;
        questao.enunciado = qPayload.enunciado.trim();
        questao.dica = qPayload.dica ? qPayload.dica.trim() : null;
        questao.explicacao = qPayload.explicacao ? qPayload.explicacao.trim() : null;
      }

      // Reatribuição das alternativas da questão
      db.alternativas = db.alternativas.filter((a) => a.questao_id !== idFinal);
      for (let altIdx = 0; altIdx < qPayload.alternativas.length; altIdx++) {
        const altPayload = qPayload.alternativas[altIdx];
        const letraAtribuida = letrasValidas[altIdx];

        db.alternativas.push({
          id: altPayload.id || gerarId('alt'),
          created_at: agora,
          questao_id: idFinal,
          letra: letraAtribuida,
          texto: altPayload.texto.trim(),
          correta: altPayload.correta,
          por_que_errou: altPayload.por_que_errou ? altPayload.por_que_errou.trim() : null,
        });
      }
    }

    saveDatabase(db);
  }

  async reordenarQuestoes(atividadeId: string, ordemIds: string[]): Promise<void> {
    const { oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoEscritaOferta(oferta.id);

    const db = await getDatabase();
    ordemIds.forEach((id, index) => {
      const q = db.questoes.find((item) => item.id === id && item.atividade_id === atividadeId);
      if (q) q.ordem = index + 1;
    });
    saveDatabase(db);
  }

  async excluirQuestao(id: string): Promise<void> {
    const db = await getDatabase();
    const questao = db.questoes.find((q) => q.id === id);
    if (!questao) throw new Error('Questão não encontrada.');

    const { atividade, oferta } = await this.obterOfertaDaAtividade(questao.atividade_id);
    await this.validarAcessoEscritaOferta(oferta.id);

    if (atividade.status !== 'rascunho') {
      throw new Error('Atividade publicada: só é possível corrigir textos.');
    }

    const jaTemRespostas = db.respostas.some((r) => r.questao_id === id);
    if (jaTemRespostas) {
      throw new Error('Não é possível excluir uma questão que já possui respostas.');
    }

    db.alternativas = db.alternativas.filter((a) => a.questao_id !== id);
    db.questoes = db.questoes.filter((q) => q.id !== id);
    saveDatabase(db);
  }

  async listarRecadosTurma(turmaId: string): Promise<Aviso[]> {
    const usuario = await exigirUsuario(['professor', 'direcao', 'coordenacao']);
    const db = await getDatabase();

    if (usuario.papel === 'professor') {
      const temOferta = db.ofertas.some(
        (o) => o.turma_id === turmaId && o.professor_id === usuario.id
      );
      if (!temOferta) {
        throw new Error('Você não tem permissão para esta ação.');
      }
    }

    return db.avisos
      .filter((a) => a.turma_id === turmaId)
      .sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime());
  }

  async criarRecadoTurma(
    ofertaId: string,
    dados: { titulo: string; mensagem: string; prioridade: PrioridadeAviso }
  ): Promise<Aviso> {
    const usuario = await this.validarAcessoEscritaOferta(ofertaId);
    const db = await getDatabase();
    const oferta = db.ofertas.find((o) => o.id === ofertaId)!;
    const turma = db.turmas.find((t) => t.id === oferta.turma_id)!;

    const novo: Aviso = {
      id: gerarId('aviso'),
      created_at: new Date().toISOString(),
      escola_id: turma.escola_id,
      autor_id: usuario.id,
      turma_id: turma.id,
      titulo: dados.titulo.trim(),
      mensagem: dados.mensagem.trim(),
      prioridade: dados.prioridade,
      publicado_em: new Date().toISOString(),
    };

    db.avisos.push(novo);
    saveDatabase(db);
    return novo;
  }

  async mapaDeCalor(atividadeId: string): Promise<MapaDeCalorAtividade> {
    const { atividade, oferta } = await this.obterOfertaDaAtividade(atividadeId);
    await this.validarAcessoLeituraOferta(oferta.id);

    const db = await getDatabase();
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

  async desempenhoOferta(ofertaId: string, periodoId: string): Promise<RelatorioDesempenhoOferta> {
    await this.validarAcessoLeituraOferta(ofertaId);
    const db = await getDatabase();
    const oferta = db.ofertas.find((o) => o.id === ofertaId);
    if (!oferta) throw new Error('Oferta não encontrada.');

    const turma = db.turmas.find((t) => t.id === oferta.turma_id);
    const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
    const periodo = db.periodos.find((p) => p.id === periodoId);

    // Atividades publicadas ou encerradas da oferta no período
    const atividadesDoPeriodo = db.atividades
      .filter(
        (a) =>
          a.oferta_id === ofertaId &&
          a.periodo_id === periodoId &&
          (a.status === 'publicada' || a.status === 'encerrada')
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const alunosDaTurma = db.alunos
      .filter((a) => a.turma_id === oferta.turma_id && a.ativo)
      .sort((a, b) => a.numero_chamada - b.numero_chamada);

    const alunosRelatorio: DesempenhoOfertaAluno[] = [];

    for (const aluno of alunosDaTurma) {
      const ativsAluno: DesempenhoOfertaAtividadeAluno[] = [];

      for (const ativ of atividadesDoPeriodo) {
        const questoes = db.questoes.filter((q) => q.atividade_id === ativ.id);
        const totalQ = questoes.length;
        const respostas = db.respostas.filter(
          (r) => r.aluno_id === aluno.id && questoes.some((q) => q.id === r.questao_id)
        );

        // Sempre a primeira tentativa para notas e médias (campo r.acertou)
        const acertos = respostas.filter((r) => r.acertou).length;
        const concluida = totalQ > 0 && respostas.length === totalQ;

        let aproveitamento: number | null = null;
        if (concluida || ativ.status === 'encerrada') {
          aproveitamento = calcularAproveitamentoAtividade(acertos, totalQ);
        }

        ativsAluno.push({
          atividade_id: ativ.id,
          titulo: ativ.titulo,
          modo: ativ.modo,
          concluida,
          aproveitamento,
        });
      }

      const respostasDoAluno = db.respostas.filter((r) => r.aluno_id === aluno.id);
      const { media } = mediaDoAlunoNasAtividades(
        atividadesDoPeriodo,
        db.questoes,
        respostasDoAluno
      );
      const faixa = faixaDesempenho(media);

      alunosRelatorio.push({
        aluno_id: aluno.id,
        nome_completo: aluno.nome_completo,
        numero_chamada: aluno.numero_chamada,
        atividades: ativsAluno,
        media,
        faixa,
      });
    }

    return {
      oferta_id: ofertaId,
      turma_nome: turma?.nome || 'Turma',
      disciplina_nome: disciplina?.nome || 'Disciplina',
      periodo_nome: periodo?.nome || 'Período',
      atividades: atividadesDoPeriodo.map((a) => ({ id: a.id, titulo: a.titulo, modo: a.modo })),
      alunos: alunosRelatorio,
    };
  }

  async fichaAluno(ofertaId: string, alunoId: string): Promise<FichaAluno> {
    await this.validarAcessoLeituraOferta(ofertaId);
    const db = await getDatabase();
    const oferta = db.ofertas.find((o) => o.id === ofertaId);
    if (!oferta) throw new Error('Oferta não encontrada.');

    const turma = db.turmas.find((t) => t.id === oferta.turma_id);
    const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
    const aluno = db.alunos.find((a) => a.id === alunoId);
    if (!aluno) throw new Error('Aluno não encontrado.');

    if (aluno.turma_id !== oferta.turma_id) {
      throw new Error('O aluno não pertence à turma desta oferta.');
    }

    // Atividades publicadas ou encerradas da oferta
    const atividades = db.atividades
      .filter((a) => a.oferta_id === ofertaId && (a.status === 'publicada' || a.status === 'encerrada'))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let somaAcertosMedia = 0;
    let somaQuestoesMedia = 0;
    const atividadesFicha: FichaAlunoAtividadeItem[] = [];

    for (const ativ of atividades) {
      const questoes = db.questoes
        .filter((q) => q.atividade_id === ativ.id)
        .sort((a, b) => a.ordem - b.ordem);

      const questoesFicha: FichaAlunoQuestaoItem[] = [];
      let totalAcertos = 0;
      let totalRespondidas = 0;

      for (const q of questoes) {
        const r = db.respostas.find(
          (resp) => resp.aluno_id === alunoId && resp.questao_id === q.id
        );
        const corretaAlt = db.alternativas.find((alt) => alt.questao_id === q.id && alt.correta);

        if (r) {
          totalRespondidas++;
          if (r.acertou) totalAcertos++;
        }

        questoesFicha.push({
          questao_id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          alternativa_escolhida_id: r ? r.alternativa_id : null,
          alternativa_correta_id: corretaAlt?.id || '',
          acertou: r ? r.acertou : null,
          tentativas: r ? r.tentativas : 0,
          acertou_final: r ? r.acertou_final : null,
        });
      }

      const totalQ = questoes.length;
      const concluida = totalQ > 0 && totalRespondidas === totalQ;

      let statusAluno: 'concluida' | 'em_andamento' | 'pendente' = 'pendente';
      if (concluida) {
        statusAluno = 'concluida';
      } else if (totalRespondidas > 0) {
        statusAluno = 'em_andamento';
      }

      let aproveitamento: number | null = null;
      if (concluida) {
        aproveitamento = calcularAproveitamentoAtividade(totalAcertos, totalQ);
        somaAcertosMedia += totalAcertos;
        somaQuestoesMedia += totalQ;
      } else if (ativ.status === 'encerrada') {
        aproveitamento = calcularAproveitamentoAtividade(totalAcertos, totalQ);
        somaAcertosMedia += totalAcertos;
        somaQuestoesMedia += totalQ;
      }

      atividadesFicha.push({
        atividade_id: ativ.id,
        titulo: ativ.titulo,
        modo: ativ.modo,
        status_aluno: statusAluno,
        aproveitamento,
        questoes: questoesFicha,
      });
    }

    const mediaPeriodo = calcularMediaPeriodo(somaAcertosMedia, somaQuestoesMedia);
    const faixa = faixaDesempenho(mediaPeriodo);
    const { pin_hash, ...alunoPublico } = aluno;

    return {
      aluno: alunoPublico,
      turma_nome: turma?.nome || 'Turma',
      disciplina_nome: disciplina?.nome || 'Disciplina',
      atividades: atividadesFicha,
      media_periodo: mediaPeriodo,
      faixa,
    };
  }
}
