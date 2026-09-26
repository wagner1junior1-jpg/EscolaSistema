/**
 * SaberPontual — AlunoService Mock
 * 
 * Regras estritas de segurança e privacidade (Seções 5 e 7.1):
 * - Modos prova e exercício:
 *   - Exercício: feedback imediato; "tentar novamente" permitido se errou; tentativas incrementadas.
 *   - Prova: resposta sigilosa devolvendo só { registrada: true }; resultadoProva liberado apenas após concluir todas as questões.
 * - Meu Desempenho: aproveitamento por disciplina e faixa de desempenho.
 * - Login: turma precisa estar ativa; bloqueio por 15 min após 5 erros seguidos pós-sucesso.
 * - Avisos: filtrados por escola_id e turma_id do aluno.
 */

import { AlunoService } from '../contracts';
import {
  AlunoResumido,
  Aluno,
  AlunoPublico,
  AtividadeParaAluno,
  AtividadeResumoAluno,
  RespostaAlunoResultado,
  RespostaExercicio,
  ResultadoProva,
  ResultadoProvaQuestao,
  MeuDesempenhoAluno,
  DesempenhoDisciplinaItem,
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
  faixaDesempenho,
  mediaDoAlunoNasAtividades,
  pontuacaoDaResposta,
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
      let aguardandoCorrecao = false;

      // Se o aluno tem discursiva PENDENTE numa atividade, essa atividade fica "aguardando correção" para ele e NÃO entra na média.
      const temDiscursivaPendente = questoesDaAtiv.some((q) => {
        if (q.tipo !== 'discursiva') return false;
        const r = respostasDoAluno.find((resp) => resp.questao_id === q.id);
        return r && (r.correcao === 'pendente' || pontuacaoDaResposta(q, r) === null);
      });

      if (temDiscursivaPendente) {
        aguardandoCorrecao = true;
      } else if (concluida || ativ.status === 'encerrada') {
        let somaPontos = 0;
        for (const q of questoesDaAtiv) {
          const r = respostasDoAluno.find((resp) => resp.questao_id === q.id);
          const p = pontuacaoDaResposta(q, r);
          if (p !== null) {
            somaPontos += p;
          }
        }
        aproveitamento = calcularAproveitamentoAtividade(somaPontos, totalQuestoes);
      }

      return {
        id: ativ.id,
        titulo: ativ.titulo,
        descricao: ativ.descricao,
        prazo: ativ.prazo,
        modo: ativ.modo,
        status: ativ.status,
        disciplina_id: disciplina?.id || '',
        disciplina_nome: disciplina?.nome || 'Disciplina',
        total_questoes: totalQuestoes,
        questoes_respondidas: respondidas,
        concluida,
        aproveitamento,
        aguardando_correcao: aguardandoCorrecao,
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

    // Apenas atividades da turma do aluno
    if (oferta.turma_id !== aluno.turma_id) {
      throw new Error('Esta atividade não pertence à sua turma.');
    }

    // Status deve ser 'publicada' ou 'encerrada'
    if (atividade.status !== 'publicada' && atividade.status !== 'encerrada') {
      throw new Error('Atividade indisponível.');
    }

    const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
    const professor = db.perfis.find((p) => p.id === oferta.professor_id);

    const questoes = db.questoes
      .filter((q) => q.atividade_id === atividadeId)
      .sort((a, b) => a.ordem - b.ordem);

    // Na prova incompleta, nenhuma questão respondida pode revelar o feedback
    const totalQuestoes = questoes.length;
    const respondidasCount = questoes.filter((q) =>
      db.respostas.some((r) => r.aluno_id === aluno.id && r.questao_id === q.id)
    ).length;
    const provaCompleta = totalQuestoes > 0 && respondidasCount === totalQuestoes;

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

      const altCorreta = todasAlts.find((a) => a.correta);

      if (respostaRegistrada) {
        const foiCorrigida = Boolean(
          respostaRegistrada.correcao && respostaRegistrada.correcao !== 'pendente'
        );

        // Se for prova publicada e ainda não tiver concluído todas as questões: NÃO expõe o feedback pedagógico
        if (atividade.modo === 'prova' && atividade.status === 'publicada' && !provaCompleta) {
          return {
            id: q.id,
            ordem: q.ordem,
            enunciado: q.enunciado,
            dica: q.dica,
            alternativas: alternativasBase,
            respondida: true,
            alternativa_respondida_id: respostaRegistrada.alternativa_id || undefined,
            tipo: q.tipo || 'objetiva',
            imagem_url: q.imagem_url || null,
            texto_respondido: respostaRegistrada.texto_resposta ?? undefined,
            correcao: respostaRegistrada.correcao ?? undefined,
            comentario_professor: respostaRegistrada.comentario_professor ?? undefined,
            ...(foiCorrigida && q.resposta_esperada ? { resposta_esperada: q.resposta_esperada } : {}),
          };
        }

        // Se for exercício, prova concluída ou prova encerrada: inclui feedback pedagógico
        const altEscolhida = todasAlts.find((a) => a.id === respostaRegistrada.alternativa_id);

        return {
          id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          dica: q.dica,
          alternativas: alternativasBase,
          respondida: true,
          alternativa_respondida_id: respostaRegistrada.alternativa_id || undefined,
          tipo: q.tipo || 'objetiva',
          imagem_url: q.imagem_url || null,
          texto_respondido: respostaRegistrada.texto_resposta ?? undefined,
          correcao: respostaRegistrada.correcao ?? undefined,
          comentario_professor: respostaRegistrada.comentario_professor ?? undefined,
          ...(foiCorrigida && q.resposta_esperada ? { resposta_esperada: q.resposta_esperada } : {}),
          acertou: respostaRegistrada.acertou ?? undefined,
          alternativa_correta_id: altCorreta?.id,
          por_que_errou: respostaRegistrada.acertou ? null : altEscolhida?.por_que_errou || null,
          explicacao: q.explicacao,
          tentativas: respostaRegistrada.tentativas ?? 1,
          acertou_final: (respostaRegistrada.acertou_final ?? respostaRegistrada.acertou) ?? undefined,
        };
      }

      // Para questões NÃO respondidas numa prova encerrada: mostrar o feedback
      if (atividade.status === 'encerrada') {
        return {
          id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          dica: q.dica,
          alternativas: alternativasBase,
          respondida: false,
          tipo: q.tipo || 'objetiva',
          imagem_url: q.imagem_url || null,
          acertou: false,
          alternativa_correta_id: altCorreta?.id,
          explicacao: q.explicacao,
          tentativas: 0,
          acertou_final: false,
        };
      }

      // Para questões NÃO respondidas em atividade aberta/publicada: sigilo absoluto
      return {
        id: q.id,
        ordem: q.ordem,
        enunciado: q.enunciado,
        dica: q.dica,
        alternativas: alternativasBase,
        respondida: false,
        tipo: q.tipo || 'objetiva',
        imagem_url: q.imagem_url || null,
      };
    });

    return {
      id: atividade.id,
      titulo: atividade.titulo,
      descricao: atividade.descricao,
      prazo: atividade.prazo,
      modo: atividade.modo,
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
  ): Promise<RespostaAlunoResultado> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const questao = db.questoes.find((q) => q.id === questaoId);
    if (!questao) throw new Error('Questão não encontrada.');

    if (questao.tipo === 'discursiva') {
      throw new Error('Esta questão é discursiva e não aceita alternativas.');
    }

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

    // Resposta definitiva da 1ª tentativa: unique(aluno_id, questao_id)
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
      tentativas: 1,
      acertou_final: acertou,
    };

    db.respostas.push(novaResposta);
    saveDatabase(db);

    // Modo Prova: resposta definitiva sem revelar gabarito
    if (atividade.modo === 'prova') {
      return {
        modo: 'prova',
        registrada: true,
      };
    }

    // Modo Exercício: feedback completo na hora
    return {
      modo: 'exercicio',
      acertou,
      alternativa_correta_id: alternativaCorreta.id,
      por_que_errou: acertou ? null : alternativaEscolhida.por_que_errou,
      explicacao: questao.explicacao,
    };
  }

  async tentarNovamente(
    token: string,
    questaoId: string,
    alternativaId: string
  ): Promise<RespostaExercicio> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const questao = db.questoes.find((q) => q.id === questaoId);
    if (!questao) throw new Error('Questão não encontrada.');

    const atividade = db.atividades.find((a) => a.id === questao.atividade_id);
    if (!atividade) throw new Error('Atividade não encontrada.');

    // Só no modo exercício
    if (atividade.modo !== 'exercicio') {
      throw new Error('"Tentar novamente" está disponível apenas no modo exercício.');
    }

    if (atividade.status !== 'publicada') {
      throw new Error('Atividade não está aberta para respostas.');
    }

    const resposta = db.respostas.find(
      (r) => r.aluno_id === aluno.id && r.questao_id === questaoId
    );
    if (!resposta) {
      throw new Error('Esta questão ainda não foi respondida.');
    }

    // Só se a 1ª resposta foi errada e acertou_final é false
    if (resposta.acertou || resposta.acertou_final) {
      throw new Error('Você já acertou esta questão e não precisa tentar novamente.');
    }

    const alternativas = db.alternativas.filter((a) => a.questao_id === questaoId);
    const alternativaEscolhida = alternativas.find((a) => a.id === alternativaId);
    if (!alternativaEscolhida) throw new Error('Alternativa selecionada inválida.');

    const alternativaCorreta = alternativas.find((a) => a.correta);
    if (!alternativaCorreta) {
      throw new Error('Inconsistência pedagógica: questão sem alternativa correta.');
    }

    const acertouAgora = alternativaEscolhida.correta;

    // Incrementa tentativas e atualiza acertou_final
    // NUNCA altera alternativa_id nem acertou da 1ª resposta!
    resposta.tentativas += 1;
    resposta.acertou_final = acertouAgora;

    saveDatabase(db);

    return {
      modo: 'exercicio',
      acertou: acertouAgora,
      alternativa_correta_id: alternativaCorreta.id,
      por_que_errou: acertouAgora ? null : alternativaEscolhida.por_que_errou,
      explicacao: questao.explicacao,
    };
  }

  async resultadoProva(token: string, atividadeId: string): Promise<ResultadoProva> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) throw new Error('Atividade não encontrada.');

    const oferta = db.ofertas.find((o) => o.id === atividade.oferta_id);
    if (!oferta || oferta.turma_id !== aluno.turma_id) {
      throw new Error('Esta atividade não pertence à sua turma.');
    }

    if (atividade.modo !== 'prova') {
      throw new Error('O resultado detalhado de prova só se aplica a atividades no modo prova.');
    }

    if (atividade.status !== 'publicada' && atividade.status !== 'encerrada') {
      throw new Error('Atividade indisponível.');
    }

    const questoes = db.questoes
      .filter((q) => q.atividade_id === atividadeId)
      .sort((a, b) => a.ordem - b.ordem);

    const respostas = db.respostas.filter(
      (r) => r.aluno_id === aluno.id && questoes.some((q) => q.id === r.questao_id)
    );

    // Com a prova publicada e incompleta, continua bloqueado
    if (atividade.status === 'publicada') {
      if (respostas.length < questoes.length || questoes.length === 0) {
        throw new Error('Termine todas as questões para ver o resultado.');
      }
    }

    let totalPontos = 0;
    const questoesResultado: ResultadoProvaQuestao[] = questoes.map((q) => {
      const r = respostas.find((resp) => resp.questao_id === q.id);
      const alts = db.alternativas.filter((a) => a.questao_id === q.id);
      const corretaAlt = alts.find((a) => a.correta);

      if (!r) {
        return {
          questao_id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          alternativa_escolhida_id: null,
          alternativa_correta_id: corretaAlt?.id || '',
          acertou: false,
          por_que_errou: null,
          explicacao: q.explicacao,
          tipo: q.tipo || 'objetiva',
          imagem_url: q.imagem_url || null,
        };
      }

      if (q.tipo === 'discursiva') {
        const p = pontuacaoDaResposta(q, r);
        if (p !== null) {
          totalPontos += p;
        }
        const acertouDiscursiva = r.correcao === 'certo';
        const foiCorrigida = Boolean(r.correcao && r.correcao !== 'pendente');

        return {
          questao_id: q.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          alternativa_escolhida_id: null,
          alternativa_correta_id: '',
          acertou: acertouDiscursiva,
          por_que_errou: null,
          explicacao: q.explicacao,
          tipo: 'discursiva',
          imagem_url: q.imagem_url || null,
          texto_respondido: r.texto_resposta ?? undefined,
          correcao: r.correcao ?? undefined,
          comentario_professor: r.comentario_professor ?? undefined,
          ...(foiCorrigida && q.resposta_esperada ? { resposta_esperada: q.resposta_esperada } : {}),
        };
      }

      const escolhidaAlt = alts.find((a) => a.id === r.alternativa_id);
      const p = pontuacaoDaResposta(q, r);
      if (p !== null) {
        totalPontos += p;
      }

      return {
        questao_id: q.id,
        ordem: q.ordem,
        enunciado: q.enunciado,
        alternativa_escolhida_id: r.alternativa_id,
        alternativa_correta_id: corretaAlt?.id || '',
        acertou: r.acertou ?? false,
        por_que_errou: r.acertou ? null : escolhidaAlt?.por_que_errou || null,
        explicacao: q.explicacao,
        tipo: 'objetiva',
        imagem_url: q.imagem_url || null,
      };
    });

    const total = questoes.length;
    const erros = total - Math.floor(totalPontos);
    const aproveitamento = calcularAproveitamentoAtividade(totalPontos, total);

    return {
      atividade_id: atividadeId,
      titulo: atividade.titulo,
      total_questoes: total,
      acertos: totalPontos,
      erros,
      aproveitamento,
      questoes: questoesResultado,
    };
  }

  async meuDesempenho(token: string): Promise<MeuDesempenhoAluno> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    const turma = db.turmas.find((t) => t.id === aluno.turma_id);
    if (!turma) throw new Error('Turma do aluno não encontrada.');

    const periodoAtivo =
      db.periodos.find((p) => p.escola_id === turma.escola_id && p.ativo) ||
      db.periodos[0];

    const ofertas = db.ofertas.filter((o) => o.turma_id === turma.id);

    const disciplinasDesempenho: DesempenhoDisciplinaItem[] = ofertas.map((of) => {
      const disc = db.disciplinas.find((d) => d.id === of.disciplina_id);
      const prof = db.perfis.find((p) => p.id === of.professor_id);

      // Atividades do período nesta oferta
      const ativs = db.atividades.filter(
        (a) =>
          a.oferta_id === of.id &&
          a.periodo_id === periodoAtivo.id &&
          a.status !== 'rascunho'
      );

      const respostasDoAluno = db.respostas.filter((r) => r.aluno_id === aluno.id);
      const { media, atividades_avaliadas } = mediaDoAlunoNasAtividades(
        ativs,
        db.questoes,
        respostasDoAluno
      );
      const faixa = faixaDesempenho(media);

      return {
        oferta_id: of.id,
        disciplina_nome: disc?.nome || 'Disciplina',
        professor_nome: prof?.nome || 'Professor',
        atividades_concluidas: atividades_avaliadas,
        media_periodo: media,
        faixa,
      };
    });

    return {
      aluno: toAlunoPublico(aluno),
      turma,
      periodo_atual: periodoAtivo,
      disciplinas: disciplinasDesempenho,
    };
  }

  async avisos(token: string): Promise<Aviso[]> {
    const aluno = await this.obterAlunoPorToken(token);
    const db = await getDatabase();

    return db.avisos
      .filter(
        (a) =>
          a.escola_id === aluno.escola_id &&
          (a.turma_id === null || a.turma_id === aluno.turma_id)
      )
      .sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime());
  }

  async responderDiscursiva(
    token: string,
    questaoId: string,
    texto: string
  ): Promise<{ registrada: true; explicacao?: string | null }> {
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

    if (atividade.status === 'encerrada') {
      throw new Error('Esta atividade já foi encerrada e não aceita mais respostas.');
    }
    if (atividade.status !== 'publicada') {
      throw new Error('Atividade indisponível para resposta.');
    }

    if (questao.tipo !== 'discursiva') {
      throw new Error('Esta questão não é discursiva.');
    }

    const textoFormatado = (texto || '').trim();
    if (!textoFormatado) {
      throw new Error('A resposta não pode ser vazia.');
    }
    if (textoFormatado.length > 2000) {
      throw new Error('A resposta deve ter no máximo 2000 caracteres.');
    }

    const jaRespondida = db.respostas.some(
      (r) => r.aluno_id === aluno.id && r.questao_id === questaoId
    );
    if (jaRespondida) {
      throw new Error('Questão já respondida.');
    }

    const agora = new Date().toISOString();
    const novaResposta: Resposta = {
      id: gerarId('resp'),
      created_at: agora,
      aluno_id: aluno.id,
      questao_id: questaoId,
      alternativa_id: null,
      acertou: null,
      respondida_em: agora,
      tentativas: 1,
      acertou_final: null,
      texto_resposta: textoFormatado,
      correcao: 'pendente',
      pontuacao: null,
      comentario_professor: null,
      corrigido_por: null,
      corrigido_em: null,
    };

    db.respostas.push(novaResposta);
    saveDatabase(db);

    if (atividade.modo === 'exercicio') {
      return {
        registrada: true,
        explicacao: questao.explicacao || null,
      };
    }

    return {
      registrada: true,
    };
  }
}
