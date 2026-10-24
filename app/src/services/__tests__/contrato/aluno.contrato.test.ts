/**
 * SaberPontual — Testes de Contrato AlunoService: Mock x Supabase (Fase 5.8)
 *
 * Suíte compartilhada que garante que tanto MockAlunoService quanto SupabaseAlunoService
 * entregam exatamente os mesmos formatos e respeitam as mesmas regras de negócio
 * e proteções de sigilo para a UI.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlunoService } from '../../contracts';
import { MockAlunoService } from '../../mock/aluno.mock';
import { resetDatabase, getDatabase } from '../../mock/db';
import { SupabaseAlunoService } from '../../supabase/aluno.supabase';
import {
  validarAlunoResumido,
  validarAtividadeResumoAluno,
  validarAtividadeParaAluno,
  validarRespostaAlunoResultado,
  validarRespostaExercicio,
  validarResultadoProva,
  validarMeuDesempenhoAluno,
  validarAviso,
} from './formatos';

interface ContextoContrato {
  service: AlunoService;
  obterTokenAluno: () => Promise<string>;
  turmaCodigo: string;
  alunoId: string;
  pinCorreto: string;
  pinIncorreto: string;
  atividadeExercicioId: string;
  atividadeProvaId: string;
  provaEncerradaId: string;
  questaoExercicioId: string;
  altCorretaExercicioId: string;
  altIncorretaExercicioId: string;
  questaoProvaId: string;
  altProvaId: string;
  questaoDiscursivaExercicioId: string;
}

/**
 * Fixtures estritas extraídas do formato exato retornado pelas RPCs da migration 0005_portal_aluno.sql
 */
function criarClienteSupabaseFake(): SupabaseClient {
  const rpc = vi.fn(async (nome: string, params: Record<string, unknown>) => {
    switch (nome) {
      case 'aluno_listar_turma': {
        const codigo = String(params.p_codigo || '').trim().toUpperCase();
        if (codigo !== '7A-MAT') {
          return {
            data: null,
            error: { message: `Turma com código "${codigo}" não encontrada.` },
          };
        }
        // Retorno exato de public.aluno_listar_turma (linhas 111-115 da 0005)
        return {
          data: [
            { id: 'aluno-7a-1', nome_completo: 'Lucas Oliveira', numero_chamada: 1 },
            { id: 'aluno-7a-2', nome_completo: 'Beatriz Santos', numero_chamada: 2 },
            { id: 'aluno-7a-3', nome_completo: 'Gabriel Lima', numero_chamada: 3 },
            { id: 'aluno-7a-4', nome_completo: 'Mariana Souza', numero_chamada: 4 },
          ],
          error: null,
        };
      }

      case 'aluno_login': {
        const alunoId = params.p_aluno_id;
        const pin = params.p_pin;
        if (alunoId === 'aluno-sem-turma') {
          return { data: null, error: { message: 'Sua turma está inativa. Procure a secretaria da escola.' } };
        }
        if (alunoId !== 'aluno-7a-1' && alunoId !== 'aluno-7a-4') {
          return { data: null, error: { message: 'Aluno não encontrado.' } };
        }
        if (pin === '1420' || pin === '5012') {
          // Sucesso (linhas 168-170 da 0005)
          return {
            data: {
              ok: true,
              token: 'token-supabase-sessao-valida-30dias',
              aluno: {
                id: alunoId,
                nome_completo: alunoId === 'aluno-7a-1' ? 'Lucas Oliveira' : 'Mariana Souza',
                numero_chamada: alunoId === 'aluno-7a-1' ? 1 : 4,
              },
            },
            error: null,
          };
        }
        // Erro de PIN (linhas 182-184 da 0005)
        return {
          data: {
            ok: false,
            tentativas_restantes: 4,
            mensagem: 'PIN incorreto. Você tem mais 4 tentativa(s).',
          },
          error: null,
        };
      }

      case 'aluno_atividades': {
        // Retorno exato de public.aluno_atividades (linhas 206-224 da 0005)
        return {
          data: [
            {
              id: 'ativ-mat-01',
              titulo: 'Equações do 1º Grau',
              descricao: 'Lista de exercícios básicos',
              prazo: '2026-11-30',
              prazo_vencido: false,
              modo: 'exercicio',
              status: 'publicada',
              disciplina_id: 'disc-mat',
              disciplina_nome: 'Matemática',
              total_questoes: 4,
              questoes_respondidas: 1,
              concluida: false,
              aguardando_correcao: false,
            },
            {
              id: 'ativ-demo-cien-prova',
              titulo: 'Prova: Ecologia e Meio Ambiente',
              descricao: 'Avaliação bimestral',
              prazo: '2026-11-05',
              prazo_vencido: false,
              modo: 'prova',
              status: 'publicada',
              disciplina_id: 'disc-cien',
              disciplina_nome: 'Ciências',
              total_questoes: 4,
              questoes_respondidas: 2,
              concluida: false,
              aguardando_correcao: false,
            },
            {
              id: 'ativ-demo-mat-inteiros-enc',
              titulo: 'Prova: Números Inteiros',
              descricao: 'Prova encerrada',
              prazo: '2026-09-15',
              prazo_vencido: true,
              modo: 'prova',
              status: 'encerrada',
              disciplina_id: 'disc-mat',
              disciplina_nome: 'Matemática',
              total_questoes: 3,
              questoes_respondidas: 3,
              concluida: true,
              aguardando_correcao: false,
              aproveitamento: 33,
            },
          ],
          error: null,
        };
      }

      case 'aluno_carregar_atividade': {
        const ativId = params.p_atividade_id;
        if (ativId === 'ativ-mat-01') {
          // Exercício publicado com 1 questão não respondida (linhas 275-285 da 0005)
          return {
            data: {
              id: 'ativ-mat-01',
              titulo: 'Equações do 1º Grau',
              descricao: 'Lista de exercícios básicos',
              prazo: '2026-11-30',
              modo: 'exercicio',
              status: 'publicada',
              disciplina_nome: 'Matemática',
              professor_nome: 'Professora Ana',
              questoes: [
                {
                  id: 'q-mat-1',
                  ordem: 1,
                  enunciado: 'Resolva a equação 2x + 4 = 10',
                  dica: 'Isole a variável',
                  tipo: 'objetiva',
                  imagem_url: null,
                  respondida: false,
                  alternativas: [
                    { id: 'alt-m1-a', letra: 'A', texto: 'x = 3' },
                    { id: 'alt-m1-b', letra: 'B', texto: 'x = 2' },
                  ],
                },
              ],
            },
            error: null,
          };
        }
        if (ativId === 'ativ-demo-cien-prova') {
          // Prova publicada e incompleta: mesmo as respondidas não trazem feedback pedagógico (linhas 306-325 da 0005)
          return {
            data: {
              id: 'ativ-demo-cien-prova',
              titulo: 'Prova: Ecologia e Meio Ambiente',
              descricao: 'Avaliação bimestral',
              prazo: '2026-11-05',
              modo: 'prova',
              status: 'publicada',
              disciplina_nome: 'Ciências',
              professor_nome: 'Professor Carlos',
              questoes: [
                {
                  id: 'q-cien-1',
                  ordem: 1,
                  enunciado: 'O que são organismos produtores?',
                  dica: null,
                  tipo: 'objetiva',
                  imagem_url: null,
                  respondida: true,
                  alternativa_respondida_id: 'alt-c1-a',
                  alternativas: [
                    { id: 'alt-c1-a', letra: 'A', texto: 'Autótrofos' },
                    { id: 'alt-c1-b', letra: 'B', texto: 'Heterótrofos' },
                  ],
                },
                {
                  id: 'q-cien-2',
                  ordem: 2,
                  enunciado: 'Qual o papel dos decompositores?',
                  dica: null,
                  tipo: 'objetiva',
                  imagem_url: null,
                  respondida: false,
                  alternativas: [
                    { id: 'alt-c2-a', letra: 'A', texto: 'Reciclagem de matéria' },
                    { id: 'alt-c2-b', letra: 'B', texto: 'Produção primária' },
                  ],
                },
              ],
            },
            error: null,
          };
        }
        if (ativId === 'ativ-demo-mat-inteiros-enc') {
          // Prova encerrada: feedback liberado mesmo nas não respondidas (linhas 328-336 da 0005)
          return {
            data: {
              id: 'ativ-demo-mat-inteiros-enc',
              titulo: 'Prova: Números Inteiros',
              descricao: 'Prova encerrada',
              prazo: '2026-09-15',
              modo: 'prova',
              status: 'encerrada',
              disciplina_nome: 'Matemática',
              professor_nome: 'Professora Ana',
              questoes: [
                {
                  id: 'q-int-1',
                  ordem: 1,
                  enunciado: 'Quanto é (-5) + (+3)?',
                  dica: null,
                  tipo: 'objetiva',
                  imagem_url: null,
                  respondida: true,
                  alternativa_respondida_id: 'alt-int-1a',
                  acertou: true,
                  alternativa_correta_id: 'alt-int-1a',
                  explicacao: 'Sinais diferentes subtrai e conserva o sinal do maior.',
                  tentativas: 1,
                  acertou_final: true,
                  alternativas: [
                    { id: 'alt-int-1a', letra: 'A', texto: '-2' },
                    { id: 'alt-int-1b', letra: 'B', texto: '+2' },
                  ],
                },
              ],
            },
            error: null,
          };
        }
        return { data: null, error: { message: 'Atividade não encontrada.' } };
      }

      case 'aluno_responder': {
        const questaoId = params.p_questao_id;
        const altId = params.p_alternativa_id;
        if (questaoId === 'q-mat-1') {
          const acertou = altId === 'alt-m1-a';
          // Resposta em exercício: feedback imediato (linhas 424-428 da 0005)
          return {
            data: {
              modo: 'exercicio',
              acertou,
              alternativa_correta_id: 'alt-m1-a',
              por_que_errou: acertou ? null : 'Subtraia 4 de ambos os lados.',
              explicacao: 'Isole o 2x: 2x = 6 => x = 3.',
            },
            error: null,
          };
        }
        if (questaoId === 'q-demo-dig-1' || questaoId === 'q-cien-2') {
          // Resposta em prova: resposta sigilosa (linhas 421-423 da 0005)
          return {
            data: {
              modo: 'prova',
              registrada: true,
            },
            error: null,
          };
        }
        return { data: null, error: { message: 'Questão não encontrada.' } };
      }

      case 'aluno_responder_discursiva': {
        // Resposta discursiva em exercício (linhas 450-452 da 0005)
        return {
          data: {
            registrada: true,
            explicacao: 'Esperava-se menção ao isolamento da incógnita.',
          },
          error: null,
        };
      }

      case 'aluno_tentar_novamente': {
        // Tentar novamente em exercício (linhas 498-502 da 0005)
        return {
          data: {
            modo: 'exercicio',
            acertou: true,
            alternativa_correta_id: 'alt-m1-a',
            por_que_errou: null,
            explicacao: 'Isole o 2x: 2x = 6 => x = 3.',
          },
          error: null,
        };
      }

      case 'aluno_resultado_prova': {
        // Retorno exato de public.aluno_resultado_prova (linhas 599-604 da 0005)
        return {
          data: {
            atividade_id: 'ativ-demo-mat-inteiros-enc',
            titulo: 'Prova: Números Inteiros',
            total_questoes: 3,
            acertos: 1,
            erros: 2,
            pendentes: 0,
            aguardando_correcao: 0,
            aproveitamento: 33,
            questoes: [
              {
                questao_id: 'q-int-1',
                ordem: 1,
                enunciado: 'Quanto é (-5) + (+3)?',
                alternativa_escolhida_id: 'alt-int-1a',
                alternativa_correta_id: 'alt-int-1a',
                acertou: true,
                por_que_errou: null,
                explicacao: 'Sinais diferentes subtrai e conserva o sinal do maior.',
                tipo: 'objetiva',
                imagem_url: null,
              },
            ],
          },
          error: null,
        };
      }

      case 'aluno_meu_desempenho': {
        // Retorno exato de public.aluno_meu_desempenho (linhas 656-670 da 0005)
        return {
          data: {
            aluno: {
              id: 'aluno-7a-1',
              created_at: '2026-02-01T00:00:00Z',
              escola_id: 'esc-1',
              turma_id: 'turma-7a',
              nome_completo: 'Lucas Oliveira',
              numero_chamada: 1,
              ativo: true,
            },
            turma: {
              id: 'turma-7a',
              created_at: '2026-02-01T00:00:00Z',
              escola_id: 'esc-1',
              nome: '7º Ano A',
              serie: '7º Ano',
              segmento: 'Fundamental 2',
              ano_letivo: 2026,
              codigo_acesso: '7A-MAT',
              ativa: true,
            },
            periodo_atual: {
              id: 'per-1',
              created_at: '2026-02-01T00:00:00Z',
              escola_id: 'esc-1',
              nome: '1º Bimestre',
              ano_letivo: 2026,
              data_inicio: '2026-02-01',
              data_fim: '2026-04-30',
              ativo: true,
            },
            disciplinas: [
              {
                oferta_id: 'of-mat-7a',
                disciplina_nome: 'Matemática',
                professor_nome: 'Professora Ana',
                atividades_concluidas: 2,
                media_periodo: 71.4,
                faixa: 'Bom',
              },
            ],
          },
          error: null,
        };
      }

      case 'aluno_avisos': {
        // Retorno exato de public.aluno_avisos (linhas 680-689 da 0005)
        return {
          data: [
            {
              id: 'aviso-1',
              created_at: '2026-10-20T10:00:00Z',
              escola_id: 'esc-1',
              autor_id: 'prof-ana',
              turma_id: 'turma-7a',
              titulo: 'Aviso sobre a lista de exercícios',
              mensagem: 'Lembrem-se de resolver a lista até sexta-feira.',
              prioridade: 'media',
              publicado_em: '2026-10-20T10:00:00Z',
            },
          ],
          error: null,
        };
      }

      default:
        return { data: null, error: { message: `RPC "${nome}" não encontrada no mock fake.` } };
    }
  });

  return { rpc } as unknown as SupabaseClient;
}

/**
 * Executa os mesmos cenários de contrato tanto para MockAlunoService quanto para SupabaseAlunoService
 */
function executarSuiteContratoAluno(nome: string, criarContexto: () => Promise<ContextoContrato>) {
  describe(`Contrato AlunoService — ${nome}`, () => {
    let ctx: ContextoContrato;

    beforeEach(async () => {
      ctx = await criarContexto();
    });

    it('1. listarTurma: retorna AlunoResumido[] ordenado e sem falhas de formato', async () => {
      const lista = await ctx.service.listarTurma(ctx.turmaCodigo);

      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      // Validação de formato contra o contrato
      for (const aluno of lista) {
        const erros = validarAlunoResumido(aluno);
        expect(erros, `Erros em AlunoResumido: ${erros.join(', ')}`).toEqual([]);
      }

      // Validação de regra: ordenado pelo número de chamada
      for (let i = 1; i < lista.length; i++) {
        expect(lista[i].numero_chamada).toBeGreaterThanOrEqual(lista[i - 1].numero_chamada);
      }
    });

    it('2. login: sucesso devolve token e AlunoResumido válido; PIN incorreto lança Error', async () => {
      // Sucesso
      const resultadoOk = await ctx.service.login(ctx.alunoId, ctx.pinCorreto);
      expect(typeof resultadoOk.token).toBe('string');
      expect(resultadoOk.token.length).toBeGreaterThan(0);
      expect(validarAlunoResumido(resultadoOk.aluno)).toEqual([]);

      // PIN Incorreto
      await expect(ctx.service.login(ctx.alunoId, ctx.pinIncorreto)).rejects.toThrow(
        /PIN incorreto/
      );
    });

    it('3. atividadesPendentes: retorna AtividadeResumoAluno[] no formato do contrato', async () => {
      const token = await ctx.obterTokenAluno();
      const lista = await ctx.service.atividadesPendentes(token);

      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const ativ of lista) {
        const erros = validarAtividadeResumoAluno(ativ);
        expect(erros, `Erros em AtividadeResumoAluno: ${erros.join(', ')}`).toEqual([]);
      }
    });

    it('4. carregarAtividade (exercício e prova): valida formato e sigilo estrito de gabarito', async () => {
      const token = await ctx.obterTokenAluno();

      // Cenário A: Exercício publicado
      const ativEx = await ctx.service.carregarAtividade(token, ctx.atividadeExercicioId);
      const errosEx = validarAtividadeParaAluno(ativEx);
      expect(errosEx, `Erros em carregarAtividade (exercício): ${errosEx.join(', ')}`).toEqual([]);

      // Cenário B: Prova publicada e incompleta
      const ativProva = await ctx.service.carregarAtividade(token, ctx.atividadeProvaId);
      const errosProva = validarAtividadeParaAluno(ativProva);
      expect(errosProva, `Erros em carregarAtividade (prova incompleta): ${errosProva.join(', ')}`).toEqual([]);

      // Regra: Na prova incompleta, nenhuma questão expõe feedback
      for (const q of ativProva.questoes) {
        expect(q.acertou).toBeUndefined();
        expect(q.alternativa_correta_id).toBeUndefined();
        expect(q.por_que_errou).toBeUndefined();
        expect(q.explicacao).toBeUndefined();
      }
    });

    it('5. responder: modo exercício devolve feedback; modo prova devolve { modo: "prova", registrada: true }', async () => {
      const token = await ctx.obterTokenAluno();

      // Responder Exercício
      const respEx = await ctx.service.responder(token, ctx.questaoExercicioId, ctx.altCorretaExercicioId);
      const errosRespEx = validarRespostaAlunoResultado(respEx);
      expect(errosRespEx, `Erros em responder (exercício): ${errosRespEx.join(', ')}`).toEqual([]);
      expect(respEx.modo).toBe('exercicio');
      if (respEx.modo === 'exercicio') {
        expect(respEx.acertou).toBe(true);
        expect(typeof respEx.alternativa_correta_id).toBe('string');
      }

      // Responder Prova
      const respProva = await ctx.service.responder(token, ctx.questaoProvaId, ctx.altProvaId);
      const errosRespProva = validarRespostaAlunoResultado(respProva);
      expect(errosRespProva, `Erros em responder (prova): ${errosRespProva.join(', ')}`).toEqual([]);
      expect(respProva).toEqual({ modo: 'prova', registrada: true });
    });

    it('6. responderDiscursiva: devolve { registrada: true, explicacao? }', async () => {
      const token = await ctx.obterTokenAluno();
      const resultado = await ctx.service.responderDiscursiva(
        token,
        ctx.questaoDiscursivaExercicioId,
        'Minha resposta explicativa sobre o tema.'
      );

      expect(resultado.registrada).toBe(true);
      if (resultado.explicacao !== undefined) {
        expect(typeof resultado.explicacao === 'string' || resultado.explicacao === null).toBe(true);
      }
    });

    it('7. tentarNovamente: devolve RespostaExercicio válida', async () => {
      const token = await ctx.obterTokenAluno();
      // Registra resposta inicial incorreta para habilitar tentarNovamente
      await ctx.service.responder(token, ctx.questaoExercicioId, ctx.altIncorretaExercicioId);

      const resultado = await ctx.service.tentarNovamente(
        token,
        ctx.questaoExercicioId,
        ctx.altCorretaExercicioId
      );

      const erros = validarRespostaExercicio(resultado);
      expect(erros, `Erros em tentarNovamente: ${erros.join(', ')}`).toEqual([]);
      expect(resultado.modo).toBe('exercicio');
    });

    it('8. resultadoProva: devolve ResultadoProva estruturado em prova finalizada', async () => {
      const token = await ctx.obterTokenAluno();
      const resultado = await ctx.service.resultadoProva(token, ctx.provaEncerradaId);

      const erros = validarResultadoProva(resultado);
      expect(erros, `Erros em resultadoProva: ${erros.join(', ')}`).toEqual([]);
      expect(resultado.atividade_id).toBe(ctx.provaEncerradaId);
    });

    it('9. meuDesempenho: devolve ficha completa com aluno (sem pin_hash), turma, período e disciplinas', async () => {
      const token = await ctx.obterTokenAluno();
      const ficha = await ctx.service.meuDesempenho(token);

      const erros = validarMeuDesempenhoAluno(ficha);
      expect(erros, `Erros em meuDesempenho: ${erros.join(', ')}`).toEqual([]);
      expect(ficha.disciplinas.length).toBeGreaterThan(0);
      expect(ficha.aluno.nome_completo).toBeDefined();
      expect((ficha.aluno as unknown as Record<string, unknown>).pin_hash).toBeUndefined();
    });

    it('10. avisos: devolve lista de Aviso[] com campos obrigatórios', async () => {
      const token = await ctx.obterTokenAluno();
      const lista = await ctx.service.avisos(token);

      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const aviso of lista) {
        const erros = validarAviso(aviso);
        expect(erros, `Erros em Aviso: ${erros.join(', ')}`).toEqual([]);
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Execução da Suíte Compartilhada nas Duas Implementações:
// -----------------------------------------------------------------------------

// 1. MockAlunoService
executarSuiteContratoAluno('MockAlunoService', async () => {
  await resetDatabase();
  const db = await getDatabase();

  // Adiciona uma questão discursiva no mock para ativ-mat-01 para garantir o teste de responderDiscursiva
  const qDiscId = 'q-contrato-disc-01';
  if (!db.questoes.some((q) => q.id === qDiscId)) {
    db.questoes.push({
      id: qDiscId,
      created_at: new Date().toISOString(),
      atividade_id: 'ativ-mat-01',
      ordem: 10,
      enunciado: 'Explique a equação do 1º grau.',
      tipo: 'discursiva',
      dica: null,
      explicacao: 'Explicação pedagógica da equação.',
      resposta_esperada: 'Igualdade com expoente 1.',
    });
  }

  const service = new MockAlunoService();
  return {
    service,
    obterTokenAluno: async () => {
      // Mariana Souza (aluno-7a-4, PIN 5012)
      const login = await service.login('aluno-7a-4', '5012');
      return login.token;
    },
    turmaCodigo: '7A-MAT',
    alunoId: 'aluno-7a-4',
    pinCorreto: '5012',
    pinIncorreto: '0000',
    atividadeExercicioId: 'ativ-mat-01',
    atividadeProvaId: 'ativ-demo-cien-prova',
    provaEncerradaId: 'ativ-demo-mat-inteiros-enc',
    questaoExercicioId: 'q-mat-1',
    altCorretaExercicioId: 'alt-m1-a',
    altIncorretaExercicioId: 'alt-m1-b',
    questaoProvaId: 'q-demo-dig-1',
    altProvaId: 'alt-q-demo-dig-1-b',
    questaoDiscursivaExercicioId: qDiscId,
  };
});

// 2. SupabaseAlunoService (com cliente RPC mockado com as fixtures da migration 0005)
executarSuiteContratoAluno('SupabaseAlunoService', async () => {
  const clienteFake = criarClienteSupabaseFake();
  const service = new SupabaseAlunoService(clienteFake);

  return {
    service,
    obterTokenAluno: async () => {
      const login = await service.login('aluno-7a-1', '1420');
      return login.token;
    },
    turmaCodigo: '7A-MAT',
    alunoId: 'aluno-7a-1',
    pinCorreto: '1420',
    pinIncorreto: '0000',
    atividadeExercicioId: 'ativ-mat-01',
    atividadeProvaId: 'ativ-demo-cien-prova',
    provaEncerradaId: 'ativ-demo-mat-inteiros-enc',
    questaoExercicioId: 'q-mat-1',
    altCorretaExercicioId: 'alt-m1-a',
    altIncorretaExercicioId: 'alt-m1-b',
    questaoProvaId: 'q-cien-2',
    altProvaId: 'alt-c2-a',
    questaoDiscursivaExercicioId: 'q-mat-disc-01',
  };
});

// -----------------------------------------------------------------------------
// Divergências Intencionais (Fase 4): Documentadas e testadas separadamente
// -----------------------------------------------------------------------------
describe('Divergências Intencionais Mock x Supabase (Fase 4)', () => {
  // Atenção: este teste cobre só o que é igual nos dois lados (login barrado com turma inativa).
  // A parte que diverge (sessão já aberta com turma inativada depois) só existe no SQL
  // e é coberta por supabase/tests/aluno_rpc_teste.sql, não por este arquivo.
  it('Divergência 1 (Turma Inativa na Sessão): login com turma inativa é barrado; a regra da sessão só vale no SQL', async () => {
    // No Supabase (migration 0005, private.aluno_da_sessao):
    // JOIN public.turmas t ON t.id = a.turma_id AND t.ativa AND t.deleted_at IS NULL
    // Se a turma estiver inativa, a RPC lança 'Sessão expirada ou inválida. Por favor, acesse novamente.'
    // No Mock (aluno.mock.ts, obterAlunoPorToken):
    // db.alunos.find((a) => a.id === sessao.aluno_id && a.ativo) -> não confere turma.ativa na sessão, só no login.
    const clienteFake = criarClienteSupabaseFake();
    const serviceSupabase = new SupabaseAlunoService(clienteFake);

    // O login de aluno com turma inativa é barrado em ambos
    await expect(serviceSupabase.login('aluno-sem-turma', '1234')).rejects.toThrow(
      'Sua turma está inativa. Procure a secretaria da escola.'
    );
  });

  it('Divergência 2 (Mensagem de Aluno sem PIN): Supabase retorna sem_pin específico; Mock trata como erro de PIN', async () => {
    // Supabase (aluno_login linha 157 da 0005):
    // IF v_hash IS NULL THEN RETURN { ok: false, sem_pin: true, mensagem: 'PIN ainda não cadastrado. Procure a sua professora.' }
    // Mock: não tem tratamento separado para sem_pin no login (compara hash e diz 'PIN incorreto').
    const clienteFake = {
      rpc: vi.fn(async () => ({
        data: {
          ok: false,
          sem_pin: true,
          mensagem: 'PIN ainda não cadastrado. Procure a sua professora.',
        },
        error: null,
      })),
    } as unknown as SupabaseClient;

    const service = new SupabaseAlunoService(clienteFake);
    await expect(service.login('aluno-sem-pin', '1234')).rejects.toThrow(
      'PIN ainda não cadastrado. Procure a sua professora.'
    );
  });
});
