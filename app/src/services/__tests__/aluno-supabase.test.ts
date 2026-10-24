import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseAlunoService,
  criarSupabaseAlunoService,
} from '../supabase/aluno.supabase';

type RespostaRpc = { data: unknown; error: { message: string; code?: string } | null };

function clienteComRpc(respostaPadrao?: RespostaRpc | ((nome: string, params: Record<string, unknown>) => RespostaRpc)) {
  const rpc = vi.fn(async (nome: string, params: Record<string, unknown>) => {
    if (typeof respostaPadrao === 'function') {
      return respostaPadrao(nome, params);
    }
    return respostaPadrao ?? { data: null, error: null };
  });
  return { cliente: { rpc } as unknown as SupabaseClient, rpc };
}

describe('AlunoService Supabase (Fase 5.7, chamando RPCs da Fase 4)', () => {
  it('criarSupabaseAlunoService instancia a classe corretamente', () => {
    const { cliente } = clienteComRpc({ data: {}, error: null });
    expect(criarSupabaseAlunoService(cliente)).toBeInstanceOf(SupabaseAlunoService);
  });

  describe('login', () => {
    it('sucesso: autentica e devolve token e dados resumidos do aluno', async () => {
      const retornoRpc = {
        ok: true,
        token: 'token-sessao-aluno-123',
        aluno: {
          id: 'aluno-uuid-1',
          nome_completo: 'Lucas Oliveira',
          numero_chamada: 12,
        },
      };
      const { cliente, rpc } = clienteComRpc({ data: retornoRpc, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.login('aluno-uuid-1', '1420');

      expect(rpc).toHaveBeenCalledWith('aluno_login', {
        p_aluno_id: 'aluno-uuid-1',
        p_pin: '1420',
      });
      expect(resultado).toEqual({
        token: 'token-sessao-aluno-123',
        aluno: {
          id: 'aluno-uuid-1',
          nome_completo: 'Lucas Oliveira',
          numero_chamada: 12,
        },
      });
    });

    it('PIN incorreto: RPC devolve ok: false e service transforma em Error com a mensagem amigável', async () => {
      const retornoRpc = {
        ok: false,
        tentativas_restantes: 4,
        mensagem: 'PIN incorreto. Você tem mais 4 tentativa(s).',
      };
      const { cliente, rpc } = clienteComRpc({ data: retornoRpc, error: null });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.login('aluno-uuid-1', '0000')).rejects.toThrow(
        'PIN incorreto. Você tem mais 4 tentativa(s).'
      );
      expect(rpc).toHaveBeenCalledWith('aluno_login', {
        p_aluno_id: 'aluno-uuid-1',
        p_pin: '0000',
      });
    });

    it('bloqueado por tentativas: RPC devolve ok: false com mensagem de bloqueio', async () => {
      const retornoRpc = {
        ok: false,
        bloqueado: true,
        mensagem: 'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.',
      };
      const { cliente } = clienteComRpc({ data: retornoRpc, error: null });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.login('aluno-uuid-1', '9999')).rejects.toThrow(
        'Acesso bloqueado por 15 minutos devido a 5 tentativas incorretas de PIN.'
      );
    });

    it('sem PIN cadastrado: RPC devolve ok: false com instrução para procurar professora', async () => {
      const retornoRpc = {
        ok: false,
        sem_pin: true,
        mensagem: 'PIN ainda não cadastrado. Procure a sua professora.',
      };
      const { cliente } = clienteComRpc({ data: retornoRpc, error: null });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.login('aluno-uuid-1', '1234')).rejects.toThrow(
        'PIN ainda não cadastrado. Procure a sua professora.'
      );
    });

    it('erro lançado pelo banco (aluno inexistente / turma inativa) repassa error.message', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'Sua turma está inativa. Procure a secretaria da escola.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.login('aluno-uuid-inativo', '1234')).rejects.toThrow(
        'Sua turma está inativa. Procure a secretaria da escola.'
      );
    });

    it('resposta de sucesso com dados ausentes lança erro', async () => {
      const { cliente } = clienteComRpc({
        data: { ok: true },
        error: null,
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.login('aluno-uuid-1', '1234')).rejects.toThrow(
        'Dados de autenticação incompletos.'
      );
    });
  });

  describe('listarTurma', () => {
    it('chama aluno_listar_turma com p_codigo e devolve a lista de alunos', async () => {
      const listaAlunos = [
        { id: 'aluno-1', nome_completo: 'Ana Silva', numero_chamada: 1 },
        { id: 'aluno-2', nome_completo: 'Bruno Souza', numero_chamada: 2 },
      ];
      const { cliente, rpc } = clienteComRpc({ data: listaAlunos, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.listarTurma('7A-MAT');

      expect(rpc).toHaveBeenCalledWith('aluno_listar_turma', {
        p_codigo: '7A-MAT',
      });
      expect(resultado).toEqual(listaAlunos);
    });

    it('erro de turma não encontrada repassa a mensagem da RPC', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'Turma com código "CODIGO-INEXISTENTE" não encontrada.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.listarTurma('CODIGO-INEXISTENTE')).rejects.toThrow(
        'Turma com código "CODIGO-INEXISTENTE" não encontrada.'
      );
    });
  });

  describe('atividadesPendentes', () => {
    it('chama aluno_atividades com p_token e devolve a lista de resumos', async () => {
      const listaAtividades = [
        {
          id: 'ativ-1',
          titulo: 'Exercício 1',
          descricao: 'Fração e decimal',
          prazo: '2026-10-30',
          prazo_vencido: false,
          modo: 'exercicio',
          status: 'publicada',
          disciplina_id: 'disc-1',
          disciplina_nome: 'Matemática',
          total_questoes: 4,
          questoes_respondidas: 2,
          concluida: false,
          aguardando_correcao: false,
        },
      ];
      const { cliente, rpc } = clienteComRpc({ data: listaAtividades, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.atividadesPendentes('token-aluno');

      expect(rpc).toHaveBeenCalledWith('aluno_atividades', {
        p_token: 'token-aluno',
      });
      expect(resultado).toEqual(listaAtividades);
    });

    it('sessão expirada repassa mensagem da RPC', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'Sessão expirada ou inválida. Por favor, acesse novamente.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.atividadesPendentes('token-invalido')).rejects.toThrow(
        'Sessão expirada ou inválida. Por favor, acesse novamente.'
      );
    });
  });

  describe('carregarAtividade e proteção de gabarito', () => {
    it('chama aluno_carregar_atividade com p_token e p_atividade_id', async () => {
      const payloadAtividade = {
        id: 'ativ-1',
        titulo: 'Atividade de Ciências',
        descricao: 'Células',
        prazo: '2026-10-31',
        modo: 'exercicio',
        status: 'publicada',
        disciplina_nome: 'Ciências',
        professor_nome: 'Prof. Carlos',
        questoes: [
          {
            id: 'q-1',
            ordem: 1,
            enunciado: 'O que é mitocôndria?',
            dica: 'Respiração celular',
            alternativas: [
              { id: 'alt-a', letra: 'A', texto: 'Opção A' },
              { id: 'alt-b', letra: 'B', texto: 'Opção B' },
            ],
            respondida: false,
            tipo: 'objetiva',
            imagem_url: null,
          },
        ],
      };
      const { cliente, rpc } = clienteComRpc({ data: payloadAtividade, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.carregarAtividade('token-123', 'ativ-1');

      expect(rpc).toHaveBeenCalledWith('aluno_carregar_atividade', {
        p_token: 'token-123',
        p_atividade_id: 'ativ-1',
      });
      expect(resultado.id).toBe('ativ-1');
      expect(resultado.questoes).toHaveLength(1);
    });

    it('sanitização: remove "correta" e "por_que_errou" das alternativas mesmo se vierem por engano do backend/mock', async () => {
      const payloadVazado = {
        id: 'ativ-1',
        titulo: 'Teste',
        descricao: '',
        prazo: null,
        modo: 'exercicio',
        status: 'publicada',
        disciplina_nome: 'Matemática',
        professor_nome: 'Ana',
        questoes: [
          {
            id: 'q-1',
            ordem: 1,
            enunciado: 'Enunciado',
            dica: null,
            alternativas: [
              { id: 'alt-a', letra: 'A', texto: 'A', correta: true, por_que_errou: 'distrator' },
              { id: 'alt-b', letra: 'B', texto: 'B', correta: false, por_que_errou: 'outro distrator' },
            ],
            respondida: false,
          },
        ],
      };
      const { cliente } = clienteComRpc({ data: payloadVazado, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.carregarAtividade('token-123', 'ativ-1');
      const alts = resultado.questoes[0].alternativas as unknown as Array<Record<string, unknown>>;

      expect(alts[0]).toEqual({ id: 'alt-a', letra: 'A', texto: 'A' });
      expect(alts[0].correta).toBeUndefined();
      expect(alts[0].por_que_errou).toBeUndefined();
      expect(alts[1]).toEqual({ id: 'alt-b', letra: 'B', texto: 'B' });
      expect(alts[1].correta).toBeUndefined();
      expect(alts[1].por_que_errou).toBeUndefined();
    });

    it('sanitização: remove campos de gabarito de questão NÃO respondida em atividade publicada', async () => {
      const payloadVazado = {
        id: 'ativ-1',
        titulo: 'Prova em aberto',
        descricao: '',
        prazo: '2026-11-01',
        modo: 'prova',
        status: 'publicada',
        disciplina_nome: 'História',
        professor_nome: 'Professora',
        questoes: [
          {
            id: 'q-1',
            ordem: 1,
            enunciado: 'Questão ainda não respondida',
            dica: null,
            alternativas: [{ id: 'alt-a', letra: 'A', texto: 'A' }],
            respondida: false,
            // Campos de gabarito vazados por engano:
            alternativa_correta_id: 'alt-a',
            por_que_errou: 'não deveria estar aqui',
            explicacao: 'explicação vazada',
          },
        ],
      };
      const { cliente } = clienteComRpc({ data: payloadVazado, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.carregarAtividade('token-123', 'ativ-1');
      const q = resultado.questoes[0];

      expect(q.alternativa_correta_id).toBeUndefined();
      expect(q.por_que_errou).toBeUndefined();
      expect(q.explicacao).toBeUndefined();
    });

    it('preserva feedback em questão JÁ respondida de exercício publicado', async () => {
      const payloadRespondido = {
        id: 'ativ-1',
        titulo: 'Exercício',
        descricao: '',
        prazo: null,
        modo: 'exercicio',
        status: 'publicada',
        disciplina_nome: 'Matemática',
        professor_nome: 'Ana',
        questoes: [
          {
            id: 'q-1',
            ordem: 1,
            enunciado: 'Já respondida',
            dica: null,
            alternativas: [{ id: 'alt-a', letra: 'A', texto: 'A' }],
            respondida: true,
            alternativa_respondida_id: 'alt-a',
            acertou: true,
            alternativa_correta_id: 'alt-a',
            por_que_errou: null,
            explicacao: 'Explicação detalhada pedagógica',
          },
        ],
      };
      const { cliente } = clienteComRpc({ data: payloadRespondido, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.carregarAtividade('token-123', 'ativ-1');
      const q = resultado.questoes[0];

      expect(q.respondida).toBe(true);
      expect(q.alternativa_correta_id).toBe('alt-a');
      expect(q.explicacao).toBe('Explicação detalhada pedagógica');
    });

    it('preserva feedback em atividade ENCERRADA mesmo em questão não respondida', async () => {
      const payloadEncerrada = {
        id: 'ativ-1',
        titulo: 'Prova Encerrada',
        descricao: '',
        prazo: '2026-10-01',
        modo: 'prova',
        status: 'encerrada',
        disciplina_nome: 'Português',
        professor_nome: 'Prof.',
        questoes: [
          {
            id: 'q-1',
            ordem: 1,
            enunciado: 'Questão de prova encerrada',
            dica: null,
            alternativas: [{ id: 'alt-a', letra: 'A', texto: 'A' }],
            respondida: false,
            acertou: false,
            alternativa_correta_id: 'alt-a',
            explicacao: 'Gabarito oficial pós-encerramento',
          },
        ],
      };
      const { cliente } = clienteComRpc({ data: payloadEncerrada, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.carregarAtividade('token-123', 'ativ-1');
      const q = resultado.questoes[0];

      expect(q.alternativa_correta_id).toBe('alt-a');
      expect(q.explicacao).toBe('Gabarito oficial pós-encerramento');
    });

    it('prova publicada e incompleta: remove o gabarito até das questões já respondidas', async () => {
      const payload = {
        id: 'ativ-1',
        titulo: 'Prova em andamento',
        descricao: '',
        prazo: null,
        modo: 'prova',
        status: 'publicada',
        disciplina_nome: 'Português',
        professor_nome: 'Prof.',
        questoes: [
          {
            id: 'q-1',
            ordem: 1,
            enunciado: 'Já respondida',
            dica: null,
            alternativas: [{ id: 'alt-a', letra: 'A', texto: 'A' }],
            respondida: true,
            acertou: true,
            acertou_final: true,
            alternativa_correta_id: 'alt-a',
            por_que_errou: 'x',
            explicacao: 'vazou',
          },
          {
            id: 'q-2',
            ordem: 2,
            enunciado: 'Ainda não respondida',
            dica: null,
            alternativas: [{ id: 'alt-b', letra: 'A', texto: 'B' }],
            respondida: false,
          },
        ],
      };
      const { cliente } = clienteComRpc({ data: payload, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.carregarAtividade('token-123', 'ativ-1');
      const q = resultado.questoes[0];

      expect(q.respondida).toBe(true);
      expect(q.alternativa_correta_id).toBeUndefined();
      expect(q.explicacao).toBeUndefined();
      expect(q.por_que_errou).toBeUndefined();
      expect(q.acertou).toBeUndefined();
      expect(q.acertou_final).toBeUndefined();
    });
  });

  describe('responder', () => {
    it('chama aluno_responder com p_token, p_questao_id e p_alternativa_id (modo exercício)', async () => {
      const respostaExercicio = {
        modo: 'exercicio' as const,
        acertou: true,
        alternativa_correta_id: 'alt-1',
        por_que_errou: null,
        explicacao: 'Correto!',
      };
      const { cliente, rpc } = clienteComRpc({ data: respostaExercicio, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.responder('token-1', 'q-1', 'alt-1');

      expect(rpc).toHaveBeenCalledWith('aluno_responder', {
        p_token: 'token-1',
        p_questao_id: 'q-1',
        p_alternativa_id: 'alt-1',
      });
      expect(resultado).toEqual(respostaExercicio);
    });

    it('chama aluno_responder no modo prova retornando apenas registrada: true', async () => {
      const respostaProva = {
        modo: 'prova' as const,
        registrada: true as const,
      };
      const { cliente } = clienteComRpc({ data: respostaProva, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.responder('token-1', 'q-2', 'alt-2');
      expect(resultado).toEqual(respostaProva);
    });

    it('tentativa duplicada lança erro da RPC', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'Esta questão já foi respondida e não pode ser alterada.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.responder('token-1', 'q-1', 'alt-1')).rejects.toThrow(
        'Esta questão já foi respondida e não pode ser alterada.'
      );
    });
  });

  describe('responderDiscursiva', () => {
    it('chama aluno_responder_discursiva com p_token, p_questao_id e p_texto', async () => {
      const retorno = {
        registrada: true as const,
        explicacao: 'Esperava-se menção ao ciclo do carbono.',
      };
      const { cliente, rpc } = clienteComRpc({ data: retorno, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.responderDiscursiva('token-1', 'q-disc-1', 'Minha resposta.');

      expect(rpc).toHaveBeenCalledWith('aluno_responder_discursiva', {
        p_token: 'token-1',
        p_questao_id: 'q-disc-1',
        p_texto: 'Minha resposta.',
      });
      expect(resultado).toEqual(retorno);
    });

    it('prazo vencido ou resposta vazia lança erro da RPC', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'A resposta não pode ser vazia.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.responderDiscursiva('token-1', 'q-disc-1', '')).rejects.toThrow(
        'A resposta não pode ser vazia.'
      );
    });
  });

  describe('tentarNovamente', () => {
    it('chama aluno_tentar_novamente com p_token, p_questao_id e p_alternativa_id', async () => {
      const retorno = {
        modo: 'exercicio' as const,
        acertou: true,
        alternativa_correta_id: 'alt-correta',
        por_que_errou: null,
        explicacao: 'Muito bem!',
      };
      const { cliente, rpc } = clienteComRpc({ data: retorno, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.tentarNovamente('token-1', 'q-1', 'alt-correta');

      expect(rpc).toHaveBeenCalledWith('aluno_tentar_novamente', {
        p_token: 'token-1',
        p_questao_id: 'q-1',
        p_alternativa_id: 'alt-correta',
      });
      expect(resultado).toEqual(retorno);
    });

    it('tentar novamente em questão já acertada lança erro da RPC', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'Você já acertou esta questão e não precisa tentar novamente.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.tentarNovamente('token-1', 'q-1', 'alt-x')).rejects.toThrow(
        'Você já acertou esta questão e não precisa tentar novamente.'
      );
    });
  });

  describe('resultadoProva', () => {
    it('chama aluno_resultado_prova com p_token e p_atividade_id', async () => {
      const resultadoProvaMock = {
        atividade_id: 'ativ-p1',
        titulo: 'Prova 1',
        total_questoes: 2,
        acertos: 2,
        erros: 0,
        pendentes: 0,
        aguardando_correcao: 0,
        aproveitamento: 100,
        questoes: [],
      };
      const { cliente, rpc } = clienteComRpc({ data: resultadoProvaMock, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.resultadoProva('token-1', 'ativ-p1');

      expect(rpc).toHaveBeenCalledWith('aluno_resultado_prova', {
        p_token: 'token-1',
        p_atividade_id: 'ativ-p1',
      });
      expect(resultado).toEqual(resultadoProvaMock);
    });

    it('prova ainda incompleta bloqueia e lança erro da RPC', async () => {
      const { cliente } = clienteComRpc({
        data: null,
        error: { message: 'Termine todas as questões para ver o resultado.' },
      });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.resultadoProva('token-1', 'ativ-incompleta')).rejects.toThrow(
        'Termine todas as questões para ver o resultado.'
      );
    });
  });

  describe('meuDesempenho', () => {
    it('chama aluno_meu_desempenho com p_token e devolve ficha do aluno', async () => {
      const fichaMock = {
        aluno: { id: 'a1', nome_completo: 'Lucas', numero_chamada: 12 },
        turma: { id: 't1', nome: '7º Ano A' },
        periodo_atual: { id: 'p1', nome: '1º Bimestre' },
        disciplinas: [
          {
            oferta_id: 'of1',
            disciplina_nome: 'Matemática',
            professor_nome: 'Ana',
            atividades_concluidas: 5,
            media_periodo: 85.0,
            faixa: 'Ótimo',
          },
        ],
      };
      const { cliente, rpc } = clienteComRpc({ data: fichaMock, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.meuDesempenho('token-1');

      expect(rpc).toHaveBeenCalledWith('aluno_meu_desempenho', {
        p_token: 'token-1',
      });
      expect(resultado).toEqual(fichaMock);
    });
  });

  describe('avisos', () => {
    it('chama aluno_avisos com p_token e devolve a lista de recados', async () => {
      const avisosMock = [
        {
          id: 'aviso-1',
          titulo: 'Reunião',
          mensagem: 'Amanhã não haverá aula.',
          prioridade: 'alta',
          publicado_em: '2026-10-24T08:00:00Z',
        },
      ];
      const { cliente, rpc } = clienteComRpc({ data: avisosMock, error: null });
      const service = new SupabaseAlunoService(cliente);

      const resultado = await service.avisos('token-1');

      expect(rpc).toHaveBeenCalledWith('aluno_avisos', {
        p_token: 'token-1',
      });
      expect(resultado).toEqual(avisosMock);
    });
  });

  describe('tratamento geral de retorno', () => {
    it('falha inesperada com data nula lança Erro sem quebrar silenciosamente', async () => {
      const { cliente } = clienteComRpc({ data: null, error: null });
      const service = new SupabaseAlunoService(cliente);

      await expect(service.listarTurma('7A')).rejects.toThrow(
        'Erro inesperado na chamada ao servidor.'
      );
    });
  });
});
