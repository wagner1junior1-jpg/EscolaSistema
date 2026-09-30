import { describe, it, expect } from 'vitest';
import { sanitizarSupabaseUrl } from '@/lib/supabase';
import { mesclarDatabases } from '../mock/db';
import { MockDatabaseSchema, criarBancoDemonstracao } from '../mock/seed';

describe('Sincronização e Conexão Supabase', () => {
  describe('sanitizarSupabaseUrl', () => {
    it('deve remover /rest/v1/ do final da URL', () => {
      const url = 'https://viitcmtcgcukhqhjhcpq.supabase.co/rest/v1/';
      expect(sanitizarSupabaseUrl(url)).toBe('https://viitcmtcgcukhqhjhcpq.supabase.co');
    });

    it('deve remover /rest/v1 sem barra do final da URL', () => {
      const url = 'https://viitcmtcgcukhqhjhcpq.supabase.co/rest/v1';
      expect(sanitizarSupabaseUrl(url)).toBe('https://viitcmtcgcukhqhjhcpq.supabase.co');
    });

    it('deve manter URLs limpas e remover barras finais', () => {
      const url = 'https://viitcmtcgcukhqhjhcpq.supabase.co///';
      expect(sanitizarSupabaseUrl(url)).toBe('https://viitcmtcgcukhqhjhcpq.supabase.co');
    });

    it('deve lidar com valores vazios graciosamente', () => {
      expect(sanitizarSupabaseUrl('')).toBe('');
      expect(sanitizarSupabaseUrl(undefined)).toBe('');
    });
  });

  describe('mesclarDatabases (Merge Anti-Conflito)', () => {
    it('deve unir respostas de alunos diferentes sem sobrescrever nem perder dados', async () => {
      const dbBase = await criarBancoDemonstracao();

      // Dispositivo 1: Aluno A responde uma questão
      const dbLocal: MockDatabaseSchema = {
        ...dbBase,
        versao: 5,
        respostas: [
          ...dbBase.respostas,
          {
            id: 'resp-novo-aluno-a',
            created_at: '2026-09-29T20:00:00Z',
            aluno_id: 'aluno-novo-1',
            questao_id: 'q-mat-1',
            alternativa_id: 'alt-mat-1-a',
            acertou: true,
            acertou_final: true,
            pontuacao: 1,
            respondida_em: '2026-09-29T20:00:00Z',
            tentativas: 1,
          },
        ],
      };

      // Dispositivo 2: Aluno B responde outra questão na nuvem
      const dbRemoto: MockDatabaseSchema = {
        ...dbBase,
        versao: 6,
        respostas: [
          ...dbBase.respostas,
          {
            id: 'resp-novo-aluno-b',
            created_at: '2026-09-29T20:01:00Z',
            aluno_id: 'aluno-novo-2',
            questao_id: 'q-mat-2',
            alternativa_id: 'alt-mat-2-b',
            acertou: false,
            acertou_final: false,
            pontuacao: 0,
            respondida_em: '2026-09-29T20:01:00Z',
            tentativas: 1,
          },
        ],
      };

      const resultado = mesclarDatabases(dbLocal, dbRemoto);

      // Deve conter as duas respostas novas
      const temAlunoA = resultado.respostas.some((r) => r.aluno_id === 'aluno-novo-1');
      const temAlunoB = resultado.respostas.some((r) => r.aluno_id === 'aluno-novo-2');

      expect(temAlunoA).toBe(true);
      expect(temAlunoB).toBe(true);
      expect(resultado.versao).toBeGreaterThanOrEqual(7);
    });

    it('deve priorizar a versão mais recente em caso de mesma questão do mesmo aluno', async () => {
      const dbBase = await criarBancoDemonstracao();

      const dbLocal: MockDatabaseSchema = {
        ...dbBase,
        versao: 1,
        respostas: [
          {
            id: 'resp-1',
            created_at: '2026-09-29T10:00:00Z',
            aluno_id: 'aluno-1',
            questao_id: 'q-1',
            alternativa_id: 'alt-1',
            acertou: false,
            acertou_final: false,
            respondida_em: '2026-09-29T10:00:00Z',
            tentativas: 1,
            pontuacao: 0,
            texto_resposta: null,
            correcao: null,
            comentario_professor: null,
            corrigido_por: null,
            corrigido_em: null,
          },
        ],
      };

      const dbAtualizado: MockDatabaseSchema = {
        ...dbBase,
        versao: 2,
        respostas: [
          {
            id: 'resp-1',
            created_at: '2026-09-29T10:05:00Z',
            aluno_id: 'aluno-1',
            questao_id: 'q-1',
            alternativa_id: 'alt-2',
            acertou: true,
            acertou_final: true,
            respondida_em: '2026-09-29T10:05:00Z',
            tentativas: 2,
            pontuacao: 1,
            texto_resposta: null,
            correcao: null,
            comentario_professor: null,
            corrigido_por: null,
            corrigido_em: null,
          },
        ],
      };

      const resultado = mesclarDatabases(dbAtualizado, dbLocal);
      const resp = resultado.respostas.find((r) => r.aluno_id === 'aluno-1' && r.questao_id === 'q-1');

      expect(resp?.tentativas).toBe(2);
      expect(resp?.acertou_final).toBe(true);
    });
  });
});
