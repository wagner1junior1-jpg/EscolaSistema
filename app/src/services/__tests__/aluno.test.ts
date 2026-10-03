import { describe, it, expect, beforeEach } from 'vitest';
import { MockAlunoService } from '../mock/aluno.mock';
import { resetDatabase } from '../mock/db';

describe('AlunoService Mock — Segurança e Regras de Negócio (docs/ESPECIFICACAO.md Seções 5 e 7.1)', () => {
  let alunoService: MockAlunoService;

  beforeEach(async () => {
    await resetDatabase();
    alunoService = new MockAlunoService();
  });

  describe('Bloqueio de PIN após 5 tentativas incorretas em 15 minutos', () => {
    it('deve permitir login com PIN correto na primeira tentativa', async () => {
      // Lucas Oliveira (aluno-7a-1) possui PIN 1420
      const resultado = await alunoService.login('aluno-7a-1', '1420');
      expect(resultado.token).toBeDefined();
      expect(resultado.aluno.nome_completo).toBe('Lucas Oliveira');
    });

    it('deve bloquear o aluno após 5 tentativas incorretas consecutivas', async () => {
      const alunoId = 'aluno-7a-2'; // Beatriz Santos (PIN real: 3891)

      // 4 tentativas incorretas com erro decrescente
      for (let i = 1; i <= 4; i++) {
        await expect(alunoService.login(alunoId, '0000')).rejects.toThrow(
          /PIN incorreto/
        );
      }

      // 5ª tentativa incorreta atinge o limite e dispara bloqueio imediato
      await expect(alunoService.login(alunoId, '0000')).rejects.toThrow(
        /Acesso bloqueado por 15 minutos/
      );

      // 6ª tentativa mesmo com o PIN CORRETO deve ser recusada devido ao bloqueio ativo
      await expect(alunoService.login(alunoId, '3891')).rejects.toThrow(
        /Acesso bloqueado por 15 minutos/
      );
    });
  });

  describe('Proteção e sigilo pedagógico (carregarAtividade)', () => {
    it('NUNCA deve expor alternativa correta, por_que_errou ou explicação antes do aluno responder', async () => {
      // Login da aluna Mariana Souza
      const { token } = await alunoService.login('aluno-7a-4', '5012');

      // Carrega atividade de Matemática
      const atividade = await alunoService.carregarAtividade(token, 'ativ-mat-01');

      expect(atividade.questoes.length).toBeGreaterThan(0);

      for (const q of atividade.questoes) {
        // 1. Campo explicacao não deve existir no DTO retornado para o aluno
        expect((q as unknown as Record<string, unknown>).explicacao).toBeUndefined();

        // 2. Nenhuma alternativa deve conter o campo 'correta' ou 'por_que_errou'
        for (const alt of q.alternativas) {
          expect((alt as unknown as Record<string, unknown>).correta).toBeUndefined();
          expect((alt as unknown as Record<string, unknown>).por_que_errou).toBeUndefined();
          expect(alt.id).toBeDefined();
          expect(alt.letra).toBeDefined();
          expect(alt.texto).toBeDefined();
        }
      }
    });
  });

  describe('Resposta definitiva e recusa de segunda resposta direta', () => {
    it('deve aceitar a primeira resposta e devolver o feedback completo em modo exercício', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012'); // Mariana Souza

      // Responde à questão 1 de Matemática marcando a alternativa correta (A: alt-m1-a)
      const feedback = await alunoService.responder(token, 'q-mat-1', 'alt-m1-a');

      expect('acertou' in feedback).toBe(true);
      if ('acertou' in feedback) {
        expect(feedback.acertou).toBe(true);
        expect(feedback.alternativa_correta_id).toBe('alt-m1-a');
        expect(feedback.explicacao).toContain('O valor gasto nas figurinhas é 4x');
      }
    });

    it('deve RECUSAR com erro caso o aluno tente responder a mesma questão novamente via responder()', async () => {
      const { token } = await alunoService.login('aluno-7a-4', '5012'); // Mariana Souza

      // 1ª resposta aceita
      await alunoService.responder(token, 'q-mat-1', 'alt-m1-a');

      // 2ª tentativa na mesma questão via responder() deve ser rejeitada imediatamente
      await expect(
        alunoService.responder(token, 'q-mat-1', 'alt-m1-b')
      ).rejects.toThrow('Esta questão já foi respondida e não pode ser alterada.');
    });
  });

  describe('Meu Desempenho (antigo boletim)', () => {
    it('deve retornar desempenho consolidado por disciplina com faixas corretas', async () => {
      const { token } = await alunoService.login('aluno-7a-1', '1420'); // Lucas Oliveira
      const desempenho = await alunoService.meuDesempenho(token);

      expect(desempenho.aluno.nome_completo).toBe('Lucas Oliveira');
      expect(desempenho.disciplinas.length).toBeGreaterThan(0);

      const discMat = desempenho.disciplinas.find((d) => d.disciplina_nome === 'Matemática');
      expect(discMat).toBeDefined();
      expect(discMat?.atividades_concluidas).toBe(2);
      expect(discMat?.media_periodo).toBe(71.4);
      expect(discMat?.faixa).toBe('Bom');
    });
  });

  describe('Tentativas e persistência após F5 (carregarAtividade)', () => {
    it('deve devolver tentativas 2 e acertou_final true para Gabriel em ativ-demo-mat-frac (q-demo-frac-2)', async () => {
      const { token } = await alunoService.login('aluno-7a-3', '7254'); // Gabriel Lima
      const atividade = await alunoService.carregarAtividade(token, 'ativ-demo-mat-frac');
      const q2 = atividade.questoes.find((q) => q.id === 'q-demo-frac-2');

      expect(q2).toBeDefined();
      expect(q2?.tentativas).toBe(2);
      expect(q2?.acertou_final).toBe(true);
    });

    it('NÃO deve expor tentativas e acertou_final na Prova de Ciências incompleta do Lucas', async () => {
      const { token } = await alunoService.login('aluno-7a-1', '1420'); // Lucas Oliveira
      const atividade = await alunoService.carregarAtividade(token, 'ativ-demo-cien-prova');

      for (const q of atividade.questoes) {
        expect(q.tentativas).toBeUndefined();
        expect(q.acertou_final).toBeUndefined();
      }
    });
  });

  describe('Resultado com discursiva aguardando correção (resultadoProva)', () => {
    it('4 questões, 1 pendente => acertos 2, erros 1, pendentes 1, aproveitamento 67%', async () => {
      const db = await (await import('../mock/db')).getDatabase();
      const { token } = await alunoService.login('aluno-7a-1', '1420');

      const provaId = 'ativ-teste-discursiva-pendente';
      db.atividades.push({
        id: provaId,
        titulo: 'Prova Teste Pendente',
        descricao: '',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-3bim',
        criado_por: 'usr-prof-ana',
        modo: 'prova',
        status: 'encerrada',
        prazo: null,
        created_at: new Date().toISOString(),
      });

      db.questoes.push(
        { id: 'q-p-1', atividade_id: provaId, ordem: 1, enunciado: 'Q1', tipo: 'objetiva', dica: null, explicacao: null, created_at: '' },
        { id: 'q-p-2', atividade_id: provaId, ordem: 2, enunciado: 'Q2', tipo: 'objetiva', dica: null, explicacao: null, created_at: '' },
        { id: 'q-p-3', atividade_id: provaId, ordem: 3, enunciado: 'Q3', tipo: 'objetiva', dica: null, explicacao: null, created_at: '' },
        { id: 'q-p-4', atividade_id: provaId, ordem: 4, enunciado: 'Q4', tipo: 'discursiva', dica: null, explicacao: null, created_at: '' },
      );

      db.alternativas.push(
        { id: 'alt-p-1a', questao_id: 'q-p-1', letra: 'A', texto: 'A', correta: true, por_que_errou: null, created_at: '' },
        { id: 'alt-p-2a', questao_id: 'q-p-2', letra: 'A', texto: 'A', correta: true, por_que_errou: null, created_at: '' },
        { id: 'alt-p-2b', questao_id: 'q-p-2', letra: 'B', texto: 'B', correta: false, por_que_errou: 'Erro', created_at: '' },
        { id: 'alt-p-3a', questao_id: 'q-p-3', letra: 'A', texto: 'A', correta: true, por_que_errou: null, created_at: '' },
      );

      db.respostas.push(
        { id: 'r-p-1', aluno_id: 'aluno-7a-1', questao_id: 'q-p-1', alternativa_id: 'alt-p-1a', acertou: true, acertou_final: true, tentativas: 1, respondida_em: '', created_at: '' },
        { id: 'r-p-2', aluno_id: 'aluno-7a-1', questao_id: 'q-p-2', alternativa_id: 'alt-p-2b', acertou: false, acertou_final: false, tentativas: 1, respondida_em: '', created_at: '' },
        { id: 'r-p-3', aluno_id: 'aluno-7a-1', questao_id: 'q-p-3', alternativa_id: 'alt-p-3a', acertou: true, acertou_final: true, tentativas: 1, respondida_em: '', created_at: '' },
        { id: 'r-p-4', aluno_id: 'aluno-7a-1', questao_id: 'q-p-4', alternativa_id: null, acertou: null, acertou_final: null, tentativas: 1, texto_resposta: 'Texto aluno', correcao: 'pendente', pontuacao: null, respondida_em: '', created_at: '' },
      );

      const resultado = (await alunoService.resultadoProva(token, provaId)) as any;

      expect(resultado.total_questoes).toBe(4);
      expect(resultado.acertos).toBe(2);
      expect(resultado.erros).toBe(1);
      expect(resultado.pendentes).toBe(1);
      expect(resultado.aproveitamento).toBe(67);
    });
  });

  describe('Prazo vencido no portal do aluno', () => {
    it('deve recusar resposta quando o prazo estiver vencido e a atividade não foi concluída', async () => {
      const db = await (await import('../mock/db')).getDatabase();
      const { token } = await alunoService.login('aluno-7a-1', '1420');

      const ativId = 'ativ-teste-prazo-vencido-incompleta';
      db.atividades.push({
        id: ativId,
        titulo: 'Exercício com Prazo Vencido',
        descricao: 'Teste de prazo expirado',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-3bim',
        criado_por: 'usr-prof-ana',
        modo: 'exercicio',
        status: 'publicada',
        prazo: '2020-01-01',
        created_at: new Date().toISOString(),
      });

      db.questoes.push(
        {
          id: 'q-venc-1',
          atividade_id: ativId,
          ordem: 1,
          enunciado: 'Questão com prazo vencido',
          tipo: 'objetiva',
          dica: null,
          explicacao: null,
          created_at: '',
        },
        {
          id: 'q-venc-disc',
          atividade_id: ativId,
          ordem: 2,
          enunciado: 'Questão discursiva prazo vencido',
          tipo: 'discursiva',
          dica: null,
          explicacao: null,
          created_at: '',
        }
      );

      db.alternativas.push({
        id: 'alt-venc-1',
        questao_id: 'q-venc-1',
        letra: 'A',
        texto: 'Opção A',
        correta: true,
        por_que_errou: null,
        created_at: '',
      });

      // Tentativa de responder objetiva deve ser rejeitada
      await expect(
        alunoService.responder(token, 'q-venc-1', 'alt-venc-1')
      ).rejects.toThrow('O prazo desta atividade terminou.');

      // Tentativa de responder discursiva deve ser rejeitada
      await expect(
        alunoService.responderDiscursiva(token, 'q-venc-disc', 'Minha resposta atrasada')
      ).rejects.toThrow('O prazo desta atividade terminou.');
    });

    it('atividade concluída com prazo vencido continua em Concluídas normalmente', async () => {
      const db = await (await import('../mock/db')).getDatabase();
      const { token } = await alunoService.login('aluno-7a-1', '1420');

      const ativId = 'ativ-teste-prazo-vencido-concluida';
      db.atividades.push({
        id: ativId,
        titulo: 'Atividade Concluída com Prazo Vencido',
        descricao: 'Feita antes de vencer',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-3bim',
        criado_por: 'usr-prof-ana',
        modo: 'exercicio',
        status: 'publicada',
        prazo: '2020-01-01',
        created_at: new Date().toISOString(),
      });

      db.questoes.push({
        id: 'q-venc-conc-1',
        atividade_id: ativId,
        ordem: 1,
        enunciado: 'Questão já concluída',
        tipo: 'objetiva',
        dica: null,
        explicacao: null,
        created_at: '',
      });

      db.alternativas.push({
        id: 'alt-venc-conc-1',
        questao_id: 'q-venc-conc-1',
        letra: 'A',
        texto: 'Opção Correta',
        correta: true,
        por_que_errou: null,
        created_at: '',
      });

      db.respostas.push({
        id: 'r-venc-conc-1',
        aluno_id: 'aluno-7a-1',
        questao_id: 'q-venc-conc-1',
        alternativa_id: 'alt-venc-conc-1',
        acertou: true,
        acertou_final: true,
        tentativas: 1,
        respondida_em: '2019-12-31T20:00:00Z',
        created_at: '2019-12-31T20:00:00Z',
      });

      const lista = await alunoService.atividadesPendentes(token);
      const ativ = lista.find((a) => a.id === ativId);

      expect(ativ).toBeDefined();
      expect(ativ?.concluida).toBe(true);
      expect(ativ?.prazo_vencido).toBe(true);

      // Regra do painel: para_fazer = !concluida && status !== 'encerrada' && !prazo_vencido
      // concluidas = concluida || status === 'encerrada' || prazo_vencido
      const paraFazer = !ativ!.concluida && ativ!.status !== 'encerrada' && !ativ!.prazo_vencido;
      const concluida = ativ!.concluida || ativ!.status === 'encerrada' || ativ!.prazo_vencido;

      expect(paraFazer).toBe(false);
      expect(concluida).toBe(true);
    });
  });
});

