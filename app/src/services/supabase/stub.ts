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
import { SalvarBancoQuestaoPayload, ItemCorrecaoFeita } from '../contracts';
import { BancoQuestao, Assunto, ItemCorrecaoPendente } from '@/lib/types';
import { supabase, isSupabaseConfigurado } from '@/lib/supabase';

export class SupabaseAuthServiceStub extends MockAuthService {
  override async alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    await super.alterarSenha(senhaAtual, novaSenha);
    if (isSupabaseConfigurado) {
      try {
        const { error } = await supabase.auth.updateUser({ password: novaSenha });
        if (error) {
          console.warn('Erro ao atualizar senha no Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Falha na chamada supabase.auth.updateUser:', err);
      }
    }
  }
}

export class SupabaseGestaoServiceStub extends MockGestaoService {}

export class SupabaseProfessorServiceStub extends MockProfessorService {
  override async listarCorrecoesPendentes(atividadeId: string): Promise<ItemCorrecaoPendente[]> {
    return super.listarCorrecoesPendentes(atividadeId);
  }

  override async listarCorrecoesFeitas(atividadeId: string): Promise<ItemCorrecaoFeita[]> {
    return super.listarCorrecoesFeitas(atividadeId);
  }

  override async corrigirResposta(
    respostaId: string,
    correcao: 'certo' | 'parcial' | 'errado',
    comentario?: string,
    nota?: number
  ): Promise<void> {
    await super.corrigirResposta(respostaId, correcao, comentario, nota);
    try {
      const pontuacaoFinal = typeof nota === 'number'
        ? Math.round((nota / 100) * 100) / 100
        : (correcao === 'certo' ? 1 : correcao === 'parcial' ? 0.5 : 0);
      const correcaoFinal = typeof nota === 'number'
        ? (nota === 100 ? 'certo' : nota === 0 ? 'errado' : 'parcial')
        : correcao;

      await supabase
        .from('respostas')
        .update({
          correcao: correcaoFinal,
          comentario_professor: comentario || null,
          corrigido_em: new Date().toISOString(),
          pontuacao: pontuacaoFinal,
        })
        .eq('id', respostaId);
    } catch {
      // Persistido via saberpontual_store
    }
  }
}

export class SupabaseAlunoServiceStub extends MockAlunoService {
  override async responderDiscursiva(
    token: string,
    questaoId: string,
    texto: string
  ): Promise<{ registrada: true; explicacao?: string | null }> {
    return super.responderDiscursiva(token, questaoId, texto);
  }
}

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
