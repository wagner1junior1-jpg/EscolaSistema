/**
 * SaberPontual — Painel do professor: regras puras (sem acesso a dados)
 *
 * O painel mostra, por oferta, as contagens de atividades, as correções pendentes, os prazos
 * próximos e os alunos em atenção. Antes essa conta era feita pela tela, chamando dezenas de
 * métodos do serviço. Agora:
 *   - Supabase: a RPC `professor_painel_dados` (0008) devolve os dados de uma vez e
 *     `calcularPainelProfessor` faz a conta;
 *   - Mock: `montarPainelPorChamadas` reproduz a conta antiga chamando os métodos do serviço.
 * Os dois caminhos têm teste de paridade (painel-professor.test.ts).
 */

import type {
  Atividade,
  OfertaDetalhada,
  PainelProfessor,
  OfertaComContagem,
  AlunoEmAtencaoDashboard,
  AtividadePrazoProximo,
  Questao,
  RelatorioDesempenhoOferta,
  DesempenhoOfertaAluno,
  DesempenhoOfertaAtividadeAluno,
  Resposta,
  StatusCorrecao,
  TipoQuestao,
  ModoAtividade,
  StatusAtividade,
} from '@/lib/types';
import {
  calcularAproveitamentoAtividade,
  discursivaPendente,
  faixaDesempenho,
  mediaDoAlunoNasAtividades,
  pontuacaoDaResposta,
} from './calculos';

// ---------------------------------------------------------------------------
// Desempenho de uma oferta (a conta de professorService.desempenhoOferta)
// ---------------------------------------------------------------------------

export interface EntradaDesempenhoOferta {
  ofertaId: string;
  turmaNome: string;
  disciplinaNome: string;
  periodoNome: string;
  /** Atividades publicadas ou encerradas da oferta no período, da mais antiga para a mais nova. */
  atividadesDoPeriodo: Array<{ id: string; titulo: string; modo: ModoAtividade; status: StatusAtividade }>;
  /** Alunos ativos da turma, por número de chamada. */
  alunosDaTurma: Array<{ id: string; nome_completo: string; numero_chamada: number }>;
  questoes: Array<{ id: string; atividade_id: string; tipo: TipoQuestao }>;
  respostas: Array<{
    id: string;
    aluno_id: string;
    questao_id: string;
    acertou: boolean | null;
    pontuacao: number | null;
    correcao: StatusCorrecao | null;
  }>;
}

export function calcularDesempenhoOferta(e: EntradaDesempenhoOferta): RelatorioDesempenhoOferta {
  const mapaQuestoesPorAtividade = new Map<string, typeof e.questoes>();
  for (const q of e.questoes) {
    const lista = mapaQuestoesPorAtividade.get(q.atividade_id) || [];
    lista.push(q);
    mapaQuestoesPorAtividade.set(q.atividade_id, lista);
  }

  const mapaRespostasPorAluno = new Map<string, typeof e.respostas>();
  for (const r of e.respostas) {
    const lista = mapaRespostasPorAluno.get(r.aluno_id) || [];
    lista.push(r);
    mapaRespostasPorAluno.set(r.aluno_id, lista);
  }

  const alunosRelatorio: DesempenhoOfertaAluno[] = [];

  for (const aluno of e.alunosDaTurma) {
    const ativsAluno: DesempenhoOfertaAtividadeAluno[] = [];
    const respostasDoAluno = mapaRespostasPorAluno.get(aluno.id) || [];

    for (const ativ of e.atividadesDoPeriodo) {
      const qs = mapaQuestoesPorAtividade.get(ativ.id) || [];
      const totalQ = qs.length;
      const qIdsSet = new Set(qs.map((q) => q.id));
      const respsAtiv = respostasDoAluno.filter((r) => qIdsSet.has(r.questao_id));

      const concluida = totalQ > 0 && respsAtiv.length === totalQ;

      let temDiscursivaPendente = false;
      for (const q of qs) {
        const r = respsAtiv.find((resp) => resp.questao_id === q.id);
        if (discursivaPendente(q, r)) {
          temDiscursivaPendente = true;
          break;
        }
      }

      let aproveitamento: number | null = null;
      if (!temDiscursivaPendente && (concluida || ativ.status === 'encerrada')) {
        let somaPontos = 0;
        for (const q of qs) {
          const r = respsAtiv.find((resp) => resp.questao_id === q.id);
          const p = pontuacaoDaResposta(q, r);
          if (p !== null) {
            somaPontos += p;
          }
        }
        aproveitamento = calcularAproveitamentoAtividade(somaPontos, totalQ);
      }

      ativsAluno.push({
        atividade_id: ativ.id,
        titulo: ativ.titulo,
        modo: ativ.modo,
        concluida,
        aproveitamento,
        aguardando_correcao: temDiscursivaPendente,
      });
    }

    const { media } = mediaDoAlunoNasAtividades(
      e.atividadesDoPeriodo,
      e.questoes as unknown as Questao[],
      respostasDoAluno as unknown as Resposta[]
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
    oferta_id: e.ofertaId,
    turma_nome: e.turmaNome,
    disciplina_nome: e.disciplinaNome,
    periodo_nome: e.periodoNome,
    atividades: e.atividadesDoPeriodo.map((a) => ({ id: a.id, titulo: a.titulo, modo: a.modo })),
    alunos: alunosRelatorio,
  };
}

// ---------------------------------------------------------------------------
// Painel: o que a tela mostra
// ---------------------------------------------------------------------------

/** Prazo próximo: de hoje até 4 dias, só atividade publicada com prazo (igual ao painel antigo). */
function diasAtePrazo(prazo: string, hoje: Date): number | null {
  const partes = prazo.split('-');
  if (partes.length !== 3) return null;
  const dataPrazo = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  dataPrazo.setHours(0, 0, 0, 0);
  const base = new Date(hoje);
  base.setHours(0, 0, 0, 0);
  return Math.ceil((dataPrazo.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

function contagemVazia(oferta: OfertaDetalhada): OfertaComContagem {
  return {
    ...oferta,
    totalRascunhos: 0,
    totalPublicadas: 0,
    totalEncerradas: 0,
    totalGeral: 0,
    totalPendentesCorrecao: 0,
    primeiraAtividadeComPendenteId: null,
  };
}

/** Junta as peças que as duas implementações calculam e ordena como o painel sempre ordenou. */
function fecharPainel(
  ofertas: OfertaComContagem[],
  alunosEmAtencao: AlunoEmAtencaoDashboard[],
  prazos: AtividadePrazoProximo[],
  alunosIds: Set<string>
): PainelProfessor {
  // Desempates fixos: o mock calcula as ofertas em paralelo e a ordem de chegada variaria.
  return {
    ofertas,
    alunosEmAtencao: [...alunosEmAtencao].sort(
      (a, b) =>
        a.media - b.media ||
        a.nome_completo.localeCompare(b.nome_completo, 'pt-BR') ||
        a.oferta_id.localeCompare(b.oferta_id)
    ),
    atividadesPrazoProximo: [...prazos].sort(
      (a, b) => a.diasRestantes - b.diasRestantes || a.titulo.localeCompare(b.titulo, 'pt-BR') || a.id.localeCompare(b.id)
    ),
    totalAlunos: alunosIds.size,
  };
}

export interface DadosPainelProfessor {
  ofertas: OfertaDetalhada[];
  atividades: Atividade[];
  /** Alunos ativos das turmas das ofertas. */
  alunos: Array<{ id: string; turma_id: string; nome_completo: string; numero_chamada: number }>;
  /** Questões das atividades publicadas ou encerradas. */
  questoes: Array<{ id: string; atividade_id: string; tipo: TipoQuestao }>;
  respostas: EntradaDesempenhoOferta['respostas'];
}

/** Painel a partir de um snapshot (caminho do Supabase: uma RPC, nenhuma outra consulta). */
export function calcularPainelProfessor(
  dados: DadosPainelProfessor,
  periodo: { id: string; nome: string } | null,
  hoje: Date
): PainelProfessor {
  const atividadesPorOferta = new Map<string, Atividade[]>();
  for (const a of dados.atividades) {
    const lista = atividadesPorOferta.get(a.oferta_id) || [];
    lista.push(a);
    atividadesPorOferta.set(a.oferta_id, lista);
  }

  const questoesPorAtividade = new Map<string, DadosPainelProfessor['questoes']>();
  for (const q of dados.questoes) {
    const lista = questoesPorAtividade.get(q.atividade_id) || [];
    lista.push(q);
    questoesPorAtividade.set(q.atividade_id, lista);
  }

  const pendentesPorQuestao = new Map<string, number>();
  for (const r of dados.respostas) {
    if (r.correcao === 'pendente') {
      pendentesPorQuestao.set(r.questao_id, (pendentesPorQuestao.get(r.questao_id) || 0) + 1);
    }
  }

  const alunosPorTurma = new Map<string, DadosPainelProfessor['alunos']>();
  for (const al of dados.alunos) {
    const lista = alunosPorTurma.get(al.turma_id) || [];
    lista.push(al);
    alunosPorTurma.set(al.turma_id, lista);
  }

  const emAtencao: AlunoEmAtencaoDashboard[] = [];
  const prazos: AtividadePrazoProximo[] = [];
  const alunosIds = new Set<string>();

  const ofertas = dados.ofertas.map((oferta): OfertaComContagem => {
    // Mais nova primeiro, como listarAtividades.
    const atividades = [...(atividadesPorOferta.get(oferta.id) || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    let totalPendentes = 0;
    let primeiraComPendente: string | null = null;

    for (const ativ of atividades) {
      if (ativ.status !== 'publicada' && ativ.status !== 'encerrada') continue;

      let pendentesDaAtividade = 0;
      for (const q of questoesPorAtividade.get(ativ.id) || []) {
        if (q.tipo === 'discursiva') pendentesDaAtividade += pendentesPorQuestao.get(q.id) || 0;
      }
      if (pendentesDaAtividade > 0) {
        totalPendentes += pendentesDaAtividade;
        if (!primeiraComPendente) primeiraComPendente = ativ.id;
      }

      if (ativ.status === 'publicada' && ativ.prazo) {
        const dias = diasAtePrazo(ativ.prazo, hoje);
        if (dias !== null && dias >= 0 && dias <= 4) {
          prazos.push({
            id: ativ.id,
            titulo: ativ.titulo,
            prazo: ativ.prazo,
            turma_nome: oferta.turma_nome,
            disciplina_nome: oferta.disciplina_nome,
            oferta_id: oferta.id,
            modo: ativ.modo,
            diasRestantes: dias,
            serie: oferta.turma_serie,
          });
        }
      }
    }

    if (periodo) {
      const atividadesDoPeriodo = atividades
        .filter((a) => a.periodo_id === periodo.id && (a.status === 'publicada' || a.status === 'encerrada'))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const questoes = atividadesDoPeriodo.flatMap((a) => questoesPorAtividade.get(a.id) || []);
      const idsQuestoes = new Set(questoes.map((q) => q.id));
      const alunosDaTurma = [...(alunosPorTurma.get(oferta.turma_id) || [])].sort(
        (a, b) => a.numero_chamada - b.numero_chamada
      );
      const respostas = dados.respostas.filter((r) => idsQuestoes.has(r.questao_id));

      const relatorio = calcularDesempenhoOferta({
        ofertaId: oferta.id,
        turmaNome: oferta.turma_nome,
        disciplinaNome: oferta.disciplina_nome,
        periodoNome: periodo.nome,
        atividadesDoPeriodo,
        alunosDaTurma,
        questoes,
        respostas,
      });
      for (const al of relatorio.alunos) {
        alunosIds.add(al.aluno_id);
        if (al.faixa === 'Atenção' && al.media !== null) {
          emAtencao.push({
            aluno_id: al.aluno_id,
            nome_completo: al.nome_completo,
            turma_nome: oferta.turma_nome,
            turma_serie: oferta.turma_serie,
            disciplina_nome: oferta.disciplina_nome,
            oferta_id: oferta.id,
            media: al.media,
          });
        }
      }
    }

    return {
      ...oferta,
      totalRascunhos: atividades.filter((a) => a.status === 'rascunho').length,
      totalPublicadas: atividades.filter((a) => a.status === 'publicada').length,
      totalEncerradas: atividades.filter((a) => a.status === 'encerrada').length,
      totalGeral: atividades.length,
      totalPendentesCorrecao: totalPendentes,
      primeiraAtividadeComPendenteId: primeiraComPendente,
    };
  });

  return fecharPainel(ofertas, emAtencao, prazos, alunosIds);
}

// ---------------------------------------------------------------------------
// Caminho do mock: a conta antiga da tela, agora aqui, chamando os métodos do serviço
// ---------------------------------------------------------------------------

/** O que `montarPainelPorChamadas` precisa do serviço de professor (evita import circular). */
export interface FonteDoPainel {
  minhasOfertas(): Promise<OfertaDetalhada[]>;
  listarAtividades(ofertaId: string): Promise<Atividade[]>;
  listarCorrecoesPendentes(atividadeId: string): Promise<unknown[]>;
  desempenhoOferta(ofertaId: string, periodoId: string): Promise<RelatorioDesempenhoOferta>;
}

export async function montarPainelPorChamadas(
  fonte: FonteDoPainel,
  periodoId: string | null,
  hoje: Date
): Promise<PainelProfessor> {
  const listaOfertas = await fonte.minhasOfertas();
  const emAtencao: AlunoEmAtencaoDashboard[] = [];
  const prazos: AtividadePrazoProximo[] = [];
  const alunosIds = new Set<string>();

  const ofertas = await Promise.all(
    listaOfertas.map(async (oferta): Promise<OfertaComContagem> => {
      try {
        const atividades = await fonte.listarAtividades(oferta.id);
        let totalPendentes = 0;
        let primeiraComPendente: string | null = null;

        for (const ativ of atividades.filter((a) => a.status === 'publicada' || a.status === 'encerrada')) {
          try {
            const pendentes = await fonte.listarCorrecoesPendentes(ativ.id);
            if (pendentes.length > 0) {
              totalPendentes += pendentes.length;
              if (!primeiraComPendente) primeiraComPendente = ativ.id;
            }
          } catch {
            // Sem acesso ou sem pendentes: segue sem contar.
          }

          if (ativ.status === 'publicada' && ativ.prazo) {
            const dias = diasAtePrazo(ativ.prazo, hoje);
            if (dias !== null && dias >= 0 && dias <= 4) {
              prazos.push({
                id: ativ.id,
                titulo: ativ.titulo,
                prazo: ativ.prazo,
                turma_nome: oferta.turma_nome,
                disciplina_nome: oferta.disciplina_nome,
                oferta_id: oferta.id,
                modo: ativ.modo,
                diasRestantes: dias,
                serie: oferta.turma_serie,
              });
            }
          }
        }

        if (periodoId) {
          try {
            const relatorio = await fonte.desempenhoOferta(oferta.id, periodoId);
            for (const al of relatorio.alunos) {
              alunosIds.add(al.aluno_id);
              if (al.faixa === 'Atenção' && al.media !== null) {
                emAtencao.push({
                  aluno_id: al.aluno_id,
                  nome_completo: al.nome_completo,
                  turma_nome: oferta.turma_nome,
                  turma_serie: oferta.turma_serie,
                  disciplina_nome: oferta.disciplina_nome,
                  oferta_id: oferta.id,
                  media: al.media,
                });
              }
            }
          } catch {
            // Oferta sem avaliações no período.
          }
        }

        return {
          ...oferta,
          totalRascunhos: atividades.filter((a) => a.status === 'rascunho').length,
          totalPublicadas: atividades.filter((a) => a.status === 'publicada').length,
          totalEncerradas: atividades.filter((a) => a.status === 'encerrada').length,
          totalGeral: atividades.length,
          totalPendentesCorrecao: totalPendentes,
          primeiraAtividadeComPendenteId: primeiraComPendente,
        };
      } catch {
        return contagemVazia(oferta);
      }
    })
  );

  return fecharPainel(ofertas, emAtencao, prazos, alunosIds);
}
