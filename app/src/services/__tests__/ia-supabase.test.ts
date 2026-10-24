import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseIAService,
  converterRespostaGerar,
  RespostaFuncaoGerar,
  QuestaoDaFuncao,
} from '../supabase/ia.supabase';

const alt = (letra: 'A' | 'B' | 'C' | 'D', texto: string, correta = false) => ({
  letra,
  texto,
  correta,
  por_que_errou: correta ? null : `Você confundiu ${texto}.`,
});

const objetiva = (enunciado = 'Qual é a característica dos vertebrados?'): QuestaoDaFuncao => ({
  tipo: 'objetiva',
  dificuldade: 'medio',
  enunciado,
  dica: 'Pense no esqueleto.',
  explicacao: 'A coluna vertebral sustenta o corpo.',
  resposta_esperada: null,
  alternativas: [alt('A', 'Exoesqueleto'), alt('B', 'Coluna vertebral', true), alt('C', 'Carapaça'), alt('D', 'Tentáculos')],
});

const discursiva: QuestaoDaFuncao = {
  tipo: 'discursiva',
  dificuldade: 'facil',
  enunciado: 'Explique o que é endotermia.',
  dica: 'Pense na temperatura.',
  explicacao: 'Produzem calor.',
  resposta_esperada: 'Resposta modelo: ...\nCerto: ...\nParcial: ...\nErrado: ...',
  alternativas: null,
};

function resposta(extra: Partial<RespostaFuncaoGerar> = {}): RespostaFuncaoGerar {
  return {
    questoes: [objetiva(), discursiva],
    aviso: null,
    descartadas: 0,
    interrompida: false,
    contexto: { disciplina_nome: 'Ciências', assunto_nome: 'Animais vertebrados' },
    ...extra,
  };
}

describe('converterRespostaGerar', () => {
  it('limpa o enunciado, embaralha mantendo 1 correta e deixa as letras A-D', () => {
    const r = converterRespostaGerar(
      resposta({ questoes: [objetiva('Questão 3: Qual é a característica dos vertebrados?')] }),
      '6º Ano A',
      1,
      () => 0
    );
    const q = r.questoes[0];
    expect(q.enunciado).toBe('(Ciências - 6º Ano) Qual é a característica dos vertebrados?');
    expect(q.alternativas?.map((a) => a.letra)).toEqual(['A', 'B', 'C', 'D']);
    expect(q.alternativas?.filter((a) => a.correta)).toHaveLength(1);
    expect(q.alternativas?.find((a) => a.correta)?.texto).toBe('Coluna vertebral');
    expect(q.id_temp).toMatch(/^ia-/);
    expect(q.imagem_url).toBeNull();
  });

  it('ids temporários são únicos', () => {
    const r = converterRespostaGerar(resposta({ questoes: [objetiva(), objetiva(), discursiva] }), '6º Ano', 3);
    expect(new Set(r.questoes.map((q) => q.id_temp)).size).toBe(3);
  });

  it('discursiva não leva alternativas e mantém a resposta esperada', () => {
    const q = converterRespostaGerar(resposta({ questoes: [discursiva] }), '6º Ano', 1).questoes[0];
    expect(q.alternativas).toBeUndefined();
    expect(q.resposta_esperada).toContain('Certo:');
  });

  it('aviso do lote: sem problemas fica nulo', () => {
    expect(converterRespostaGerar(resposta(), '6º Ano', 2).aviso).toBeNull();
  });

  it('aviso do lote: vieram menos questões, descartadas e aviso da própria IA', () => {
    const r = converterRespostaGerar(
      resposta({ aviso: 'O assunto é curto.', descartadas: 2 }),
      '6º Ano',
      5
    );
    expect(r.aviso).toContain('O assunto é curto.');
    expect(r.aviso).toContain('A IA criou 2 de 5 questões pedidas.');
    expect(r.aviso).toContain('2 questões vieram fora do formato e foram descartadas.');
  });

  it('aviso do lote: geração interrompida pede para gerar de novo', () => {
    const r = converterRespostaGerar(resposta({ interrompida: true }), '6º Ano', 10);
    expect(r.aviso).toContain('interrompida');
    expect(r.aviso).toContain('2 de 10');
  });

  it('em Ciências conceitual não marca cálculo; a questão não é inventada nem trocada', () => {
    const q = objetiva('O coração dos anfíbios tem 3 cavidades. Qual a função do órgão?');
    const r = converterRespostaGerar(resposta({ questoes: [q] }), '6º Ano', 1);
    expect(r.questoes[0].avisos ?? []).not.toContain('Parece uma questão de cálculo em disciplina não exata.');
    expect(r.questoes[0].enunciado).toContain('3 cavidades');
  });
});

describe('SupabaseIAService', () => {
  function criar(retorno: { data?: unknown; error?: unknown }) {
    const invoke = vi.fn(async () => ({ data: retorno.data ?? null, error: retorno.error ?? null }));
    const cliente = { functions: { invoke } } as unknown as SupabaseClient;
    return { invoke, servico: new SupabaseIAService(cliente) };
  }

  it('gerarQuestoes manda só ids e quantidades (sem nomes nem escola) e converte a resposta', async () => {
    const { invoke, servico } = criar({ data: resposta() });
    const r = await servico.gerarQuestoes({
      disciplina_id: 'd1',
      assunto_id: 'a1',
      serie: '6º Ano A',
      qtd_total: 2,
      qtd_objetivas: 1,
      qtd_discursivas: 1,
      dificuldade: 'misturada',
      texto_base: 'texto',
      fotos: ['data:image/jpeg;base64,QUJD'],
      anexar_foto: false,
    });
    expect(r.questoes).toHaveLength(2);
    const [nome, opcoes] = invoke.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(nome).toBe(import.meta.env.VITE_FN_GERAR_QUESTOES?.trim() || 'gerar-questoes');
    expect(opcoes.body).toEqual({
      acao: 'gerar',
      disciplina_id: 'd1',
      assunto_id: 'a1',
      serie: '6º Ano A',
      qtd_objetivas: 1,
      qtd_discursivas: 1,
      dificuldade: 'misturada',
      texto_base: 'texto',
      fotos: ['data:image/jpeg;base64,QUJD'],
    });
  });

  it('usa a mensagem de erro devolvida pela função (cota, IA fora do ar...)', async () => {
    const contexto = new Response(JSON.stringify({ erro: 'Limite de gerações do mês atingido. Fale com a direção.' }), {
      status: 429,
    });
    const { servico } = criar({ error: { context: contexto } });
    await expect(
      servico.gerarQuestoes({ disciplina_id: 'd', assunto_id: 'a', serie: '6º Ano', qtd_objetivas: 1, qtd_discursivas: 0 })
    ).rejects.toThrow('Limite de gerações do mês atingido');
  });

  it('falha de rede vira mensagem padrão, nunca questão de exemplo', async () => {
    const { servico } = criar({ error: new Error('FunctionsFetchError') });
    await expect(
      servico.gerarQuestoes({ disciplina_id: 'd', assunto_id: 'a', serie: '6º Ano', qtd_objetivas: 1, qtd_discursivas: 0 })
    ).rejects.toThrow('Não foi possível concluir a operação');
  });

  it('transcreverImagem prefixa o texto e não chama a função sem fotos', async () => {
    const { invoke, servico } = criar({ data: { texto: 'Conteúdo' } });
    expect(await servico.transcreverImagem([])).toBe('');
    expect(invoke).not.toHaveBeenCalled();
    expect(await servico.transcreverImagem(['data:image/png;base64,QUJD'])).toBe(
      'Texto extraído das imagens enviadas:\nConteúdo'
    );
  });

  it('consultarCota devolve só uso e limite', async () => {
    const { servico } = criar({ data: { uso_mes: 3, limite_mes: 200, ativa: false } });
    expect(await servico.consultarCota()).toEqual({ uso_mes: 3, limite_mes: 200 });
  });
});
