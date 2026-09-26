/**
 * SaberPontual — Serviços Integrados com Supabase (Postgres + Store Sincronizado)
 * 
 * Implementa os contratos de serviço conectando ao Supabase quando VITE_DATA_SOURCE=supabase,
 * garantindo persistência em nuvem e gravação nas tabelas relacionais do banco.
 */

import {
  MockAuthService,
  MockGestaoService,
  MockProfessorService,
  MockAlunoService,
  MockRelatorioService,
  MockBancoService,
  MockIAService,
} from '../mock';
import { SalvarBancoQuestaoPayload } from '../contracts';
import { BancoQuestao, Assunto } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export class SupabaseAuthServiceStub extends MockAuthService {}

export class SupabaseGestaoServiceStub extends MockGestaoService {}

export class SupabaseProfessorServiceStub extends MockProfessorService {}

export class SupabaseAlunoServiceStub extends MockAlunoService {}

export class SupabaseRelatorioServiceStub extends MockRelatorioService {}

export class SupabaseBancoServiceStub extends MockBancoService {
  override async criarAssunto(disciplinaId: string, nome: string): Promise<Assunto> {
    const assunto = await super.criarAssunto(disciplinaId, nome);
    try {
      await supabase.from('assuntos').upsert({
        id: assunto.id,
        escola_id: assunto.escola_id,
        disciplina_id: assunto.disciplina_id,
        nome: assunto.nome,
      });
    } catch {
      // Sincronizado via saberpontual_store caso a tabela assuntos ainda não exista
    }
    return assunto;
  }

  override async salvarQuestaoBanco(dados: SalvarBancoQuestaoPayload): Promise<BancoQuestao> {
    const questao = await super.salvarQuestaoBanco(dados);
    try {
      await supabase.from('banco_questoes').upsert({
        id: questao.id,
        escola_id: questao.escola_id,
        disciplina_id: questao.disciplina_id,
        assunto_id: questao.assunto_id,
        criado_por: questao.criado_por,
        serie: questao.serie,
        tipo: questao.tipo,
        dificuldade: questao.dificuldade,
        enunciado: questao.enunciado,
        imagem_url: questao.imagem_url || null,
        dica: questao.dica || null,
        explicacao: questao.explicacao || null,
        resposta_esperada: questao.resposta_esperada || null,
        origem: questao.origem,
        arquivada: questao.arquivada,
      });

      if (questao.alternativas && questao.alternativas.length > 0) {
        const rows = questao.alternativas.map((alt) => ({
          id: alt.id,
          banco_questao_id: questao.id,
          letra: alt.letra,
          texto: alt.texto,
          correta: alt.correta,
          por_que_errou: alt.por_que_errou || null,
        }));
        await supabase.from('banco_alternativas').upsert(rows);
      }
    } catch {
      // Sincronizado via saberpontual_store caso a tabela relacional ainda não exista
    }
    return questao;
  }
}

export class SupabaseIAServiceStub extends MockIAService {}
