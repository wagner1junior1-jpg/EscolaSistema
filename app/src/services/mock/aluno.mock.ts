/**
 * SaberPontual — AlunoService Mock
 * 
 * Regras estritas de segurança e privacidade (Seções 5 e 7.1):
 * - Carregar atividade: só da turma do aluno e com status 'publicada' ou 'encerrada'.
 *   Para questões já respondidas, inclui feedback (acertou, alternativa correta, por que errou, explicação).
 *   Para questões não respondidas: sigilo absoluto (sem correta, sem por que errou, sem explicação).
 * - Responder: só em atividades com status 'publicada' pertencentes à turma do aluno.
 * - Login: turma precisa estar ativa; bloqueio por 15 min após 5 erros.
 * - Boletim: retorna AlunoPublico (sem pin_hash) e considera frequências estritamente entre data_inicio e data_fim do período.
 * - Avisos: filtrados por escola_id e turma_id do aluno.
 */

import { AlunoService } from '../contracts';
import {
  AlunoResumido,
  Aluno,
  AlunoPublico,
  AtividadeParaAluno,
  AtividadeResumoAluno,
  RespostaFeedback,
  BoletimAluno,
  Aviso,
  Resposta,
  PinTentativa,
  AlunoSessao,
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { hashPin, hashToken, gerarTokenAleatorio } from './crypto';
import { gerarId } from './ids';
import {
  calcularAproveitamentoAtividade,
  calcularMediaPeriodo,
  consolidarFrequenciaAluno,
} from '../calculos';

function toAlunoPublico(aluno: Aluno): AlunoPublico {
  const { pin_hash, ...publico } = aluno;
  return publico;
}

export class MockAlunoService implements AlunoService {
  private async obterAlunoPorToken(token: string): Promise<Aluno> {
    const db = await getDatabase();
    const tokenHash = await hashToken(token);
    const agora = new Date().toISOString();

    const sessao = db.aluno_sessoes.find(
      (s) => s.token_hash === tokenHash && new Date(s.expira_em) > new Date(agora)
    );

    if (!sessao) {
      throw new Error('Sessão expirada ou inválida. Por favor, acesse novamente.');
    }

    const aluno = db.alunos.find((a) => a.id === sessao.aluno_id && a.ativo);
    if (!aluno) {
      throw new Error('Aluno não encontrado ou inativo.');
    }

    return aluno;
  }

  async listarTurma(codigo: string): Promise<AlunoResumido[]> {
    const db = await getDatabase();
    const codigoUpper = codigo.trim().toUpperCase();

    const turma = db.turmas.find(
      (t) => t.codigo_acesso.toUpperCase() === codigoUpper && t.ativa
    );

    if (!turma) {
      throw new Error(`Turma com código "${codigoUpper}" não encontrada.`);
    }

    return db.alunos
      .filter((a) => a.turma_id === turma.id && a.ativo)
      .map((a) => ({
        id: a.id,
        nome_completo: a.nome_completo,
        numero_chamada: a.numero_chamada,
      }))
      .sort((a, b) => a.numero_chamada - b.numero_chamada);
  }

  async login(
    alunoId: string,
    pin: string
  ): Promise<{ token: string; aluno: AlunoResumido }> {
    const db = await getDatabase();
    const aluno = db.alunos.find((a) => a.id === alunoId && a.ativo);
    if (!aluno) {
      throw new Error('Aluno não encontrado.');
    }

    // Validação da turma do aluno: deve estar ativa
    const turma = db.turmas.find((t) => t.id === aluno.turma_id);
    if (!turma || !turma.ativa) {
      throw new Error('Sua turma está inativa. Procure a secretaria da escola.');
    }

    const agora = new Date();
    const agoraMs = agora.getTime();
    const quinzeMinutosAtrasMs = agoraMs - 15 * 60 * 1000;

    // Encontra o índice da última tentativa com sucesso deste aluno no histórico
    let ultimoSucessoIdx = -1;
    for (let i = db.pin_tentativas.length - 1; i >= 0; i--) {
      const t = db.pin_tentativas[i];
      if (t.aluno_id === alunoId && t.sucesso) {
        ultimoSucessoIdx = i;
        break;
      }
    }

    // Só conta erros de PIN feitos APÓS o último sucesso e dentro da janela de 15 min
    const errosRecentes = db.pin_tentativas.filter((t, idx) => {
      if (t.aluno_id !== alunoId || t.sucesso) return false;
      if (idx <= ultimoSucessoIdx) return false;
      return new Date(t.tentativa_em).getTime() >= quinzeMinutosAtrasMs;
    });

    if (errosRecentes.length >= 5) {
      throw new Error(
        'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.'
      );
    }

    const pinHashInformado = await hashPin(pin);
    const pinCorreto = pinHashInformado === aluno.pin_hash;

    const novaTentativa: PinTentativa = {
      id: gerarId('tent'),
      created_at: agora.toISOString(),
      aluno_id: alunoId,
      tentativa_em: agora.toISOString(),
      sucesso: pinCorreto,
    };
    db.pin_tentativas.push(novaTentativa);

    if (!pinCorreto) {
      saveDatabase(db);
      const restantes = 5 - (errosRecentes.length + 1);
      if (restantes > 0) {
        throw new Error(`PIN incorreto. Você tem mais ${restantes} tentativa(s).`);
      } else {
        throw new Error(
          'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.'
        );
      }
    }

    // Sucesso: gera token de sessão com validade de 30 dias
    const token = gerarTokenAleatorio();
    const tokenHash = await hashToken(token);
    const expiraEm = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const sessao: AlunoSessao = {
      id: gerarId('sess'),
      created_at: agora.toISOString(),
      aluno_id: alunoId,
      token_hash: tokenHash,
      expira_em: expiraEm,
      criado_em: agora.toISOString(),
    };
    db.aluno_sessoes.push(sessao);
    saveDatabase(db);

    return {
      token,
      aluno: {
        id: aluno.id,
        nome_completo: aluno.nome_completo,
        numero_chamada: aluno.numero_chamada,
      },
    };
  }

  async atividadesPendentes(token: string): Promise<AtividadeResumoAluno[]> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const ofertasDaTurma = db.ofertas.filter((o) => o.turma_id === aluno.turma_id);
    const ofertaIds = ofertasDaTurma.map((o) => o.id);

    const atividades = db.atividades.filter(
      (a) => ofertaIds.includes(a.oferta_id) && a.status !== 'rascunho'
    );

    return atividades.map((ativ) => {
      const oferta = ofertasDaTurma.find((o) => o.id === ativ.oferta_id);
      const disciplina = db.disciplinas.find((d) => d.id === oferta?.disciplina_id);

      const questoesDaAtiv = db.questoes.filter((q) => q.atividade_id === ativ.id);
      const respostasDoAluno = db.respostas.filter(
        (r) =>
          r.aluno_id === aluno.id &&
          questoesDaAtiv.some((q) => q.id === r.questao_id)
      );

      const totalQuestoes = questoesDaAtiv.length;
      const respondidas = respostasDoAluno.length;
      const concluida = totalQuestoes > 0 && respondidas === totalQuestoes;

      let aproveitamento: number | undefined = undefined;
      if (concluida) {
        const acertos = respostasDoAluno.filter((r) => r.acertou).length;
        aproveitamento = calcularAproveitamentoAtividade(acertos, totalQuestoes);
      }

      return {
        id: ativ.id,
        titulo: ativ.titulo,
        descricao: ativ.descricao,
        prazo: ativ.prazo,
        status: ativ.status,
        disciplina_id: disciplina?.id || '',
        disciplina_nome: disciplina?.nome || 'Disciplina',
        total_questoes: totalQuestoes,
        questoes_respondidas: respondidas,
        concluida,
        aproveitamento,
      };
    });
  }

  async carregarAtividade(token: string, atividadeId: string): Promise<AtividadeParaAluno> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) {
      throw new Error('Atividade não encontrada.');
    }

    const oferta = db.ofertas.find((o) => o.id === atividade.oferta_id);
    if (!oferta) throw new Error('Oferta não encontrada.');

    // Validação 1: Apenas atividades da turma do aluno
    if (oferta.turma_id !== aluno.turma_id) {
      throw new Error('Esta atividade não pertence à sua turma.');
    }

    // Validação 2: Status deve ser 'publicada' ou 'encerrada'
    if (atividade.status !== 'publicada' && atividade.status !== 'encerrada') {
      throw new Error('Atividade indisponível.');
    }

    const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
    const professor = db.perfis.find((p) => p.id === oferta.professor_id);

    const questoes = db.questoes
      .filter((q) => q.atividade_id === atividadeId)
      .sort((a, b) => a.ordem - b.ordem);

    const questoesParaAluno = questoes.map((q) => {
      const todasAlts = db.alternativas
        .filter((alt) => alt.questao_id === q.id)
        .sort((a, b) => a.letra.localeCompare(b.letra));

      const respostaRegistrada = db.respostas.find(
        (r) => r.aluno_id === aluno.id && r.questao_id === q.id
      );

      const alternativasBase = todasAlts.map((alt) => ({
        id: alt.id,
        letra: alt.letra,
        texto: alt.texto,
      }));

      if (respostaRegistrada) {
        // Para questões JÁ respondidas, inclui feedback pedagógico
        const altCorreta = todasAlts.find((a) => a.correta);
        const altEscolhida = todasAlts.find((a) => a.id === respostaRegistrada.alternativa_id);

        return {
          id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          dica: q.dica,
          alternativas: alternativasBase,
          respondida: true,
          alternativa_respondida_id: respostaRegistrada.alternativa_id,
          acertou: respostaRegistrada.acertou,
          alternativa_correta_id: altCorreta?.id,
          por_que_errou: respostaRegistrada.acertou ? null : altEscolhida?.por_que_errou || null,
          explicacao: q.explicacao,
        };
      }

      // Para questões NÃO respondidas: sigilo absoluto
      return {
        id: q.id,
        ordem: q.ordem,
        enunciado: q.enunciado,
        dica: q.dica,
        alternativas: alternativasBase,
        respondida: false,
      };
    });

    return {
      id: atividade.id,
      titulo: atividade.titulo,
      descricao: atividade.descricao,
      prazo: atividade.prazo,
      status: atividade.status,
      disciplina_nome: disciplina?.nome || 'Disciplina',
      professor_nome: professor?.nome || 'Professor',
      questoes: questoesParaAluno,
    };
  }

  async responder(
    token: string,
    questaoId: string,
    alternativaId: string
  ): Promise<RespostaFeedback> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const questao = db.questoes.find((q) => q.id === questaoId);
    if (!questao) throw new Error('Questão não encontrada.');

    const atividade = db.atividades.find((a) => a.id === questao.atividade_id);
    if (!atividade) throw new Error('Atividade não encontrada.');

    const oferta = db.ofertas.find((o) => o.id === atividade.oferta_id);
    if (!oferta || oferta.turma_id !== aluno.turma_id) {
      throw new Error('Esta questão não pertence a uma atividade da sua turma.');
    }

    // Apenas atividades publicadas aceitam respostas
    if (atividade.status === 'encerrada') {
      throw new Error('Esta atividade já foi encerrada e não aceita mais respostas.');
    }
    if (atividade.status !== 'publicada') {
      throw new Error('Atividade indisponível para resposta.');
    }

    // Resposta definitiva: unique(aluno_id, questao_id)
    const jaRespondida = db.respostas.some(
      (r) => r.aluno_id === aluno.id && r.questao_id === questaoId
    );
    if (jaRespondida) {
      throw new Error('Esta questão já foi respondida e não pode ser alterada.');
    }

    const alternativas = db.alternativas.filter((a) => a.questao_id === questaoId);
    const alternativaEscolhida = alternativas.find((a) => a.id === alternativaId);
    if (!alternativaEscolhida) throw new Error('Alternativa selecionada inválida.');

    const alternativaCorreta = alternativas.find((a) => a.correta);
    if (!alternativaCorreta) {
      throw new Error('Inconsistência pedagógica: questão sem alternativa correta.');
    }

    const acertou = alternativaEscolhida.correta;
    const agora = new Date().toISOString();

    const novaResposta: Resposta = {
      id: gerarId('resp'),
      created_at: agora,
      aluno_id: aluno.id,
      questao_id: questaoId,
      alternativa_id: alternativaId,
      acertou,
      respondida_em: agora,
    };

    db.respostas.push(novaResposta);
    saveDatabase(db);

    return {
      acertou,
      alternativa_correta_id: alternativaCorreta.id,
      por_que_errou: acertou ? null : alternativaEscolhida.por_que_errou,
      explicacao: questao.explicacao,
    };
  }

  async boletim(token: string): Promise<BoletimAluno> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const turma = db.turmas.find((t) => t.id === aluno.turma_id);
    if (!turma) throw new Error('Turma do aluno não encontrada.');

    const periodoAtivo =
      db.periodos.find((p) => p.escola_id === turma.escola_id && p.ativo) ||
      db.periodos[0];

    const ofertas = db.ofertas.filter((o) => o.turma_id === turma.id);

    const disciplinasBoletim = ofertas.map((of) => {
      const disc = db.disciplinas.find((d) => d.id === of.disciplina_id);
      const prof = db.perfis.find((p) => p.id === of.professor_id);

      // Atividades concluídas ou encerradas do período nesta oferta
      const ativs = db.atividades.filter(
        (a) =>
          a.oferta_id === of.id &&
          a.periodo_id === periodoAtivo.id &&
          a.status !== 'rascunho'
      );

      let somaAcertos = 0;
      let somaQuestoes = 0;
      let concluidasCount = 0;

      for (const a of ativs) {
        const questoes = db.questoes.filter((q) => q.atividade_id === a.id);
        const respostas = db.respostas.filter(
          (r) =>
            r.aluno_id === aluno.id &&
            questoes.some((q) => q.id === r.questao_id)
        );

        if (questoes.length > 0 && respostas.length === questoes.length) {
          concluidasCount++;
          somaAcertos += respostas.filter((r) => r.acertou).length;
          somaQuestoes += questoes.length;
        } else if (a.status === 'encerrada') {
          somaAcertos += respostas.filter((r) => r.acertou).length;
          somaQuestoes += questoes.length;
        }
      }

      const mediaAproveitamento = calcularMediaPeriodo(somaAcertos, somaQuestoes);

      // Frequência: filtrada ESTRITAMENTE pelas datas de início e fim do período
      const freqRegistros = db.frequencias.filter(
        (f) =>
          f.oferta_id === of.id &&
          f.aluno_id === aluno.id &&
          f.data >= periodoAtivo.data_inicio &&
          f.data <= periodoAtivo.data_fim
      );
      const freqStats = consolidarFrequenciaAluno(freqRegistros);

      return {
        oferta_id: of.id,
        disciplina_nome: disc?.nome || 'Disciplina',
        professor_nome: prof?.nome || 'Professor',
        atividades_concluidas: concluidasCount,
        media_aproveitamento: mediaAproveitamento,
        frequencia_porcentagem: freqStats.porcentagem,
        total_presencas: freqStats.presencas,
        total_faltas: freqStats.faltas,
        total_justificadas: freqStats.justificadas,
      };
    });

    return {
      aluno: toAlunoPublico(aluno), // NUNCA expõe pin_hash
      turma,
      periodo_atual: periodoAtivo,
      disciplinas: disciplinasBoletim,
    };
  }

  async avisos(token: string): Promise<Aviso[]> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    // Filtra avisos da mesma escola que sejam gerais ou para a turma do aluno
    return db.avisos
      .filter(
        (a) =>
          a.escola_id === aluno.escola_id &&
          (a.turma_id === null || a.turma_id === aluno.turma_id)
      )
      .sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime());
  }
}
