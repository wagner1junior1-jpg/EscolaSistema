/**
 * SaberPontual — RelatorioService Mock
 * 
 * Regras:
 * - Apenas 'direcao' e 'coordenacao' podem acessar relatórios pedagógicos e institucionais.
 * - Relatórios focados em desempenho pedagógico e acompanhamento escolar.
 */

import { RelatorioService } from '../contracts';
import {
  VisaoGeralEscola,
  DesempenhoTurmaDisciplinaItem,
  DesempenhoTurmaHierarquico,
  DesempenhoMateriaItem,
  DesempenhoConteudoItem,
  DesempenhoQuestaoItem,
  DesempenhoAlternativaItem,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
  ItemMapaDeCalorQuestao,
  TipoQuestao,
} from '@/lib/types';
import { getDatabase } from './db';
import { exigirUsuario } from './autorizacao';
import {
  calcularMapaDeCalorQuestao,
  faixaDesempenho,
  questoesCriticas,
  mediaDoAlunoNasAtividades,
  pontuacaoDaResposta,
  discursivaPendente,
} from '../calculos';

export class MockRelatorioService implements RelatorioService {
  async visaoGeralEscola(): Promise<VisaoGeralEscola> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const totalAlunos = db.alunos.filter((a) => a.ativo).length;
    const totalProfessores = db.perfis.filter(
      (p) => p.papel === 'professor' && p.ativo
    ).length;
    const totalTurmas = db.turmas.filter((t) => t.ativa).length;
    const totalAtividadesPublicadas = db.atividades.filter(
      (a) => a.status === 'publicada' || a.status === 'encerrada'
    ).length;

    // Aproveitamento médio geral calculado com a 1ª resposta de todas as respostas
    const totalRespostas = db.respostas.length;
    let somaPontos = 0;
    for (const r of db.respostas) {
      const q = db.questoes.find((questao) => questao.id === r.questao_id);
      const p = pontuacaoDaResposta(q, r);
      if (p !== null) {
        somaPontos += p;
      }
    }
    const aproveitamentoMedio =
      totalRespostas > 0
        ? Math.round((somaPontos / totalRespostas) * 1000) / 10
        : null;

    return {
      total_alunos: totalAlunos,
      total_turmas: totalTurmas,
      total_professores: totalProfessores,
      total_atividades_publicadas: totalAtividadesPublicadas,
      aproveitamento_medio: aproveitamentoMedio,
    };
  }

  async desempenhoTurmas(periodoId: string): Promise<DesempenhoTurmaDisciplinaItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const turmasAtivas = db.turmas.filter((t) => t.ativa);
    const resultado: DesempenhoTurmaDisciplinaItem[] = [];

    for (const turma of turmasAtivas) {
      const ofertasDaTurma = db.ofertas.filter((o) => o.turma_id === turma.id);

      for (const oferta of ofertasDaTurma) {
        const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
        const professor = db.perfis.find((p) => p.id === oferta.professor_id);
        const alunos = db.alunos.filter((a) => a.turma_id === turma.id && a.ativo);

        const atividadesDaOferta = db.atividades.filter(
          (a) =>
            a.oferta_id === oferta.id &&
            a.periodo_id === periodoId &&
            (a.status === 'publicada' || a.status === 'encerrada')
        );

        let somaMedias = 0;
        let alunosComMedia = 0;

        const contagemFaixas = {
          otimo: 0,
          bom: 0,
          atencao: 0,
          sem_atividades: 0,
        };

        for (const aluno of alunos) {
          const { media } = mediaDoAlunoNasAtividades(
            atividadesDaOferta,
            db.questoes,
            db.respostas.filter((r) => r.aluno_id === aluno.id)
          );
          const faixa = faixaDesempenho(media);

          if (faixa === 'Ótimo') contagemFaixas.otimo++;
          else if (faixa === 'Bom') contagemFaixas.bom++;
          else if (faixa === 'Atenção') contagemFaixas.atencao++;
          else contagemFaixas.sem_atividades++;

          if (media !== null) {
            somaMedias += media;
            alunosComMedia++;
          }
        }

        const aproveitamentoMedio =
          alunosComMedia > 0 ? Math.round((somaMedias / alunosComMedia) * 10) / 10 : null;

        let temDiscursivaPendenteTurma = false;
        if (aproveitamentoMedio === null && atividadesDaOferta.length > 0) {
          for (const ativ of atividadesDaOferta) {
            const qs = db.questoes.filter((q) => q.atividade_id === ativ.id && q.tipo === 'discursiva');
            for (const q of qs) {
              const respostas = db.respostas.filter((r) => r.questao_id === q.id && alunos.some((a) => a.id === r.aluno_id));
              if (respostas.some((r) => discursivaPendente(q, r))) {
                temDiscursivaPendenteTurma = true;
                break;
              }
            }
            if (temDiscursivaPendenteTurma) break;
          }
        }

        resultado.push({
          turma_id: turma.id,
          turma_nome: turma.nome,
          disciplina_id: disciplina?.id || '',
          disciplina_nome: disciplina?.nome || 'Disciplina',
          professor_nome: professor?.nome || 'Professor',
          total_alunos: alunos.length,
          aproveitamento_medio: aproveitamentoMedio,
          faixas: contagemFaixas,
          aguardando_correcao: temDiscursivaPendenteTurma,
        });
      }
    }

    return resultado;
  }

  async desempenhoHierarquicoTurmas(periodoId: string): Promise<DesempenhoTurmaHierarquico[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const turmasAtivas = db.turmas.filter((t) => t.ativa);
    const resultado: DesempenhoTurmaHierarquico[] = [];

    for (const turma of turmasAtivas) {
      const ofertasDaTurma = db.ofertas.filter((o) => o.turma_id === turma.id);
      const alunosDaTurma = db.alunos.filter((a) => a.turma_id === turma.id && a.ativo);
      const alunosIdsSet = new Set(alunosDaTurma.map((a) => a.id));

      const materias: DesempenhoMateriaItem[] = [];
      let somaPontosTurma = 0;
      let totalRespostasTurma = 0;
      let materiasComAtividades = 0;

      for (const oferta of ofertasDaTurma) {
        const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
        const professor = db.perfis.find((p) => p.id === oferta.professor_id);

        const atividadesDaOferta = db.atividades.filter(
          (a) =>
            a.oferta_id === oferta.id &&
            a.periodo_id === periodoId &&
            (a.status === 'publicada' || a.status === 'encerrada')
        );

        if (atividadesDaOferta.length === 0) {
          materias.push({
            disciplina_id: disciplina?.id || oferta.disciplina_id,
            disciplina_nome: disciplina?.nome || 'Disciplina',
            professor_nome: professor?.nome || 'Professor',
            total_alunos: alunosDaTurma.length,
            total_respostas: 0,
            porcentagem_erro: 0,
            porcentagem_acerto: 0,
            conteudos: [],
            aguardando_correcao: false,
          });
          continue;
        }

        materiasComAtividades++;

        // Coleta todas as questões das atividades da matéria
        const questoesDaOferta = db.questoes
          .filter((q) => atividadesDaOferta.some((a) => a.id === q.atividade_id))
          .sort((a, b) => a.ordem - b.ordem);

        // Agrupa questões por conteúdo (assunto)
        const mapaConteudos = new Map<
          string,
          {
            id: string;
            nome: string;
            questoes: typeof questoesDaOferta;
          }
        >();

        for (const questao of questoesDaOferta) {
          let assunto = db.assuntos?.find((ass) => ass.id === questao.assunto_id);

          if (!assunto && questao.banco_questao_id) {
            const bq = db.banco_questoes?.find((b) => b.id === questao.banco_questao_id);
            if (bq?.assunto_id) {
              assunto = db.assuntos?.find((ass) => ass.id === bq.assunto_id);
            }
          }

          if (!assunto) {
            const ativ = atividadesDaOferta.find((a) => a.id === questao.atividade_id);
            const matchingAssunto = db.assuntos?.find(
              (ass) =>
                ass.disciplina_id === disciplina?.id &&
                (ativ?.titulo.toLowerCase().includes(ass.nome.toLowerCase()) ||
                  questao.enunciado.toLowerCase().includes(ass.nome.toLowerCase()))
            );
            if (matchingAssunto) {
              assunto = matchingAssunto;
            }
          }

          const ativ = atividadesDaOferta.find((a) => a.id === questao.atividade_id);
          const conteudoId = assunto?.id || ativ?.id || 'conteudo-geral';
          const conteudoNome = assunto?.nome || ativ?.titulo || 'Conteúdo Geral';

          if (!mapaConteudos.has(conteudoId)) {
            mapaConteudos.set(conteudoId, {
              id: conteudoId,
              nome: conteudoNome,
              questoes: [],
            });
          }
          mapaConteudos.get(conteudoId)!.questoes.push(questao);
        }

        const conteudosFormatados: DesempenhoConteudoItem[] = [];
        let somaPontosMateria = 0;
        let totalRespostasMateria = 0;
        let temDiscursivaPendenteMateria = false;

        for (const [, grupo] of mapaConteudos.entries()) {
          const questoesFormatadas: DesempenhoQuestaoItem[] = [];
          let somaPontosConteudo = 0;
          let totalRespostasConteudo = 0;

          for (const questao of grupo.questoes) {
            const ativ = atividadesDaOferta.find((a) => a.id === questao.atividade_id);
            const respostasDaTurma = db.respostas.filter(
              (r) => r.questao_id === questao.id && alunosIdsSet.has(r.aluno_id)
            );

            const totalRespostasQ = respostasDaTurma.length;
            let pontosQ = 0;
            let totalAcertosQ = 0;

            const distDiscursiva = {
              certo: 0,
              parcial: 0,
              errado: 0,
              pendente: 0,
            };

            for (const resp of respostasDaTurma) {
              const p = pontuacaoDaResposta(questao, resp);
              if (p !== null) {
                pontosQ += p;
                if (p >= 1) totalAcertosQ++;
              } else if (questao.tipo === 'discursiva') {
                temDiscursivaPendenteMateria = true;
                distDiscursiva.pendente++;
              }

              if (questao.tipo === 'discursiva') {
                if (resp.correcao === 'certo') distDiscursiva.certo++;
                else if (resp.correcao === 'parcial') distDiscursiva.parcial++;
                else if (resp.correcao === 'errado') distDiscursiva.errado++;
              }
            }

            const pctAcertoQ =
              totalRespostasQ > 0 ? Math.round((pontosQ / totalRespostasQ) * 1000) / 10 : 0;
            const pctErroQ =
              totalRespostasQ > 0 ? Math.round(((totalRespostasQ - pontosQ) / totalRespostasQ) * 1000) / 10 : 0;

            // Alternativas (se questão objetiva)
            const altsOriginais = db.alternativas.filter((a) => a.questao_id === questao.id);
            const altsFormatadas: DesempenhoAlternativaItem[] = [];
            let maxDistratorEscolhas = 0;
            let distratorMaisEscolhido: DesempenhoQuestaoItem['distrator_mais_escolhido'] = null;

            for (const alt of altsOriginais) {
              const escolhas = respostasDaTurma.filter((r) => r.alternativa_id === alt.id).length;
              const pctEscolhas =
                totalRespostasQ > 0 ? Math.round((escolhas / totalRespostasQ) * 1000) / 10 : 0;

              altsFormatadas.push({
                id: alt.id,
                letra: alt.letra,
                texto: alt.texto,
                correta: alt.correta,
                por_que_errou: alt.por_que_errou || null,
                total_escolhas: escolhas,
                porcentagem_escolhas: pctEscolhas,
              });

              if (!alt.correta && escolhas > maxDistratorEscolhas) {
                maxDistratorEscolhas = escolhas;
                distratorMaisEscolhido = {
                  letra: alt.letra,
                  por_que_errou: alt.por_que_errou || null,
                  total_escolhas: escolhas,
                  porcentagem_escolhas: pctEscolhas,
                };
              }
            }

            somaPontosConteudo += pontosQ;
            totalRespostasConteudo += totalRespostasQ;

            questoesFormatadas.push({
              questao_id: questao.id,
              ordem: questao.ordem,
              enunciado: questao.enunciado,
              tipo: (questao.tipo as TipoQuestao) || 'objetiva',
              imagem_url: questao.imagem_url || null,
              dica: questao.dica || null,
              explicacao: questao.explicacao || null,
              resposta_esperada: questao.resposta_esperada || null,
              total_respostas: totalRespostasQ,
              total_acertos: totalAcertosQ,
              porcentagem_acerto: pctAcertoQ,
              porcentagem_erro: pctErroQ,
              alternativas: altsFormatadas.length > 0 ? altsFormatadas : undefined,
              distrator_mais_escolhido: distratorMaisEscolhido,
              distribuicao_discursiva:
                questao.tipo === 'discursiva' ? distDiscursiva : undefined,
              atividade_titulo: ativ?.titulo,
              modo_atividade: ativ?.modo,
            });
          }

          const pctErroConteudo =
            totalRespostasConteudo > 0
              ? Math.round(((totalRespostasConteudo - somaPontosConteudo) / totalRespostasConteudo) * 1000) / 10
              : 0;
          const pctAcertoConteudo =
            totalRespostasConteudo > 0
              ? Math.round((somaPontosConteudo / totalRespostasConteudo) * 1000) / 10
              : 0;

          somaPontosMateria += somaPontosConteudo;
          totalRespostasMateria += totalRespostasConteudo;

          conteudosFormatados.push({
            conteudo_id: grupo.id,
            conteudo_nome: grupo.nome,
            total_questoes: questoesFormatadas.length,
            total_respostas: totalRespostasConteudo,
            porcentagem_erro: pctErroConteudo,
            porcentagem_acerto: pctAcertoConteudo,
            questoes: questoesFormatadas,
          });
        }

        const pctErroMateria =
          totalRespostasMateria > 0
            ? Math.round(((totalRespostasMateria - somaPontosMateria) / totalRespostasMateria) * 1000) / 10
            : 0;
        const pctAcertoMateria =
          totalRespostasMateria > 0
            ? Math.round((somaPontosMateria / totalRespostasMateria) * 1000) / 10
            : 0;

        somaPontosTurma += somaPontosMateria;
        totalRespostasTurma += totalRespostasMateria;

        materias.push({
          disciplina_id: disciplina?.id || oferta.disciplina_id,
          disciplina_nome: disciplina?.nome || 'Disciplina',
          professor_nome: professor?.nome || 'Professor',
          total_alunos: alunosDaTurma.length,
          total_respostas: totalRespostasMateria,
          porcentagem_erro: pctErroMateria,
          porcentagem_acerto: pctAcertoMateria,
          conteudos: conteudosFormatados,
          aguardando_correcao: temDiscursivaPendenteMateria,
        });
      }

      const pctErroGeralTurma =
        totalRespostasTurma > 0
          ? Math.round(((totalRespostasTurma - somaPontosTurma) / totalRespostasTurma) * 1000) / 10
          : null;
      const pctAcertoGeralTurma =
        totalRespostasTurma > 0
          ? Math.round((somaPontosTurma / totalRespostasTurma) * 1000) / 10
          : null;

      resultado.push({
        turma_id: turma.id,
        turma_nome: turma.nome,
        turma_serie: turma.serie,
        total_alunos: alunosDaTurma.length,
        porcentagem_erro_geral: pctErroGeralTurma,
        porcentagem_acerto_geral: pctAcertoGeralTurma,
        total_materias_avaliadas: materiasComAtividades,
        materias,
      });
    }

    return resultado;
  }

  async alunosEmAtencao(periodoId: string): Promise<AlunoEmAtencaoItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const resultado: AlunoEmAtencaoItem[] = [];
    const ofertas = db.ofertas;

    for (const oferta of ofertas) {
      const turma = db.turmas.find((t) => t.id === oferta.turma_id && t.ativa);
      if (!turma) continue;

      const disciplina = db.disciplinas.find((d) => d.id === oferta.disciplina_id);
      const professor = db.perfis.find((p) => p.id === oferta.professor_id);
      const alunos = db.alunos.filter((a) => a.turma_id === turma.id && a.ativo);

      const atividades = db.atividades.filter(
        (a) =>
          a.oferta_id === oferta.id &&
          a.periodo_id === periodoId &&
          (a.status === 'publicada' || a.status === 'encerrada')
      );

      for (const aluno of alunos) {
        const { media, soma_acertos, soma_questoes } = mediaDoAlunoNasAtividades(
          atividades,
          db.questoes,
          db.respostas.filter((r) => r.aluno_id === aluno.id)
        );
        const faixa = faixaDesempenho(media);

        if (faixa === 'Atenção' && media !== null) {
          resultado.push({
            aluno_id: aluno.id,
            turma_id: turma.id,
            disciplina_id: disciplina?.id,
            nome_completo: aluno.nome_completo,
            numero_chamada: aluno.numero_chamada,
            turma_nome: turma.nome,
            disciplina_nome: disciplina?.nome || 'Disciplina',
            professor_nome: professor?.nome || 'Professor',
            media,
            faixa: 'Atenção',
            total_acertos: soma_acertos,
            total_questoes: soma_questoes,
            turma_total_alunos: alunos.length,
          });
        }
      }
    }

    return resultado.sort((a, b) => a.turma_nome.localeCompare(b.turma_nome) || a.numero_chamada - b.numero_chamada);
  }

  async questoesCriticasEscola(periodoId: string): Promise<QuestaoCriticaEscolaItem[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();

    const atividadesDoPeriodo = db.atividades.filter(
      (a) => a.periodo_id === periodoId && (a.status === 'publicada' || a.status === 'encerrada')
    );

    const todosItensMapa: Array<{ item: ItemMapaDeCalorQuestao; atividadeId: string }> = [];

    for (const ativ of atividadesDoPeriodo) {
      const questoes = db.questoes.filter((q) => q.atividade_id === ativ.id);
      for (const q of questoes) {
        const alts = db.alternativas.filter((a) => a.questao_id === q.id);
        const respostas = db.respostas.filter((r) => r.questao_id === q.id);
        const itemMapa = calcularMapaDeCalorQuestao(q, alts, respostas);
        todosItensMapa.push({ item: itemMapa, atividadeId: ativ.id });
      }
    }

    // Filtra questões críticas (mínimo 5 respostas e corte < 50% de acerto)
    const itensCriticos = questoesCriticas(
      todosItensMapa.map((t) => t.item),
      5,
      50
    );

    const criticosIds = new Set(itensCriticos.map((i) => i.questao_id));
    const itensFiltrados = todosItensMapa.filter((t) => criticosIds.has(t.item.questao_id));

    return itensFiltrados.map(({ item, atividadeId }) => {
      const ativ = db.atividades.find((a) => a.id === atividadeId)!;
      const oferta = db.ofertas.find((o) => o.id === ativ.oferta_id);
      const turma = db.turmas.find((t) => t.id === oferta?.turma_id);
      const disciplina = db.disciplinas.find((d) => d.id === oferta?.disciplina_id);
      const professor = db.perfis.find((p) => p.id === oferta?.professor_id);

      return {
        questao_id: item.questao_id,
        atividade_id: ativ.id,
        atividade_titulo: ativ.titulo,
        turma_nome: turma?.nome || '',
        disciplina_nome: disciplina?.nome || '',
        professor_nome: professor?.nome || '',
        ordem: item.ordem,
        enunciado: item.enunciado,
        total_respostas: item.total_respostas,
        porcentagem_acerto: item.porcentagem_acerto,
        distrator_mais_escolhido: item.distrator_mais_escolhido,
      };
    });
  }
}
