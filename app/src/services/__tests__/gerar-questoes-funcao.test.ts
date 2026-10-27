/**
 * Testes da Edge Function `gerar-questoes` (Fase 6.1 e 6.2).
 *
 * A função é um arquivo Deno único. Aqui ela é transpilada e executada no Node com um `Deno`
 * falso, um cliente Supabase falso e o `fetch` do Gemini simulado: testa o código real da
 * função (autorização, validação, formato das questões, cota, registro), sem rede.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { montarPromptGemini } from '../ia-prompt';

const CAMINHO_FUNCAO = resolve(process.cwd(), '../supabase/functions/gerar-questoes/index.ts');
const ESCOLA = '11111111-1111-4111-8111-111111111111';
const DISCIPLINA = '22222222-2222-4222-8222-222222222222';
const ASSUNTO = '33333333-3333-4333-8333-333333333333';

type Handler = (req: Request) => Promise<Response>;

interface Cenario {
  env?: Record<string, string>;
  perfil?: { id: string; escola_id: string; papel: string; ativo: boolean } | null;
  disciplina?: { id: string; nome: string } | null;
  assunto?: { id: string; nome: string } | null;
  usoMes?: number;
  limiteMes?: number;
  /** Gerações + transcrições da pessoa nos últimos 10 minutos (limite de ritmo). */
  chamadasRecentes?: number;
}

function carregarFuncao(cenario: Cenario = {}) {
  const fonte = readFileSync(CAMINHO_FUNCAO, 'utf8').replace(/\r\n/g, '\n').replace(
    /^import \{ createClient \} from 'npm:@supabase\/supabase-js@2';$/m,
    'const createClient = globalThis.__createClient;'
  );
  // O trecho do prompt é cópia de ia-prompt.ts e traz `export` (o Deno aceita); `new Function`
  // executa como script, então os `export` saem. O transpilador ainda deixa um `export {}` no fim.
  const js = ts
    .transpileModule(fonte, {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^export \{\};?$/m, '')
    .replace(/^export /gm, '');

  const perfil =
    cenario.perfil === undefined
      ? { id: 'prof-1', escola_id: ESCOLA, papel: 'professor', ativo: true }
      : cenario.perfil;
  const disciplina =
    cenario.disciplina === undefined ? { id: DISCIPLINA, nome: 'Ciências' } : cenario.disciplina;
  const assunto =
    cenario.assunto === undefined ? { id: ASSUNTO, nome: 'Animais vertebrados' } : cenario.assunto;
  const registros: Array<Record<string, unknown>> = [];
  const filtros: Array<[string, string, unknown]> = [];

  const tabela = (nome: string) => {
    const camposDaConsulta: string[] = [];
    const dados = () => {
      if (nome === 'perfis') return perfil;
      if (nome === 'disciplinas') return disciplina;
      if (nome === 'assuntos') return assunto;
      if (nome === 'escolas') return { cota_ia_mensal: cenario.limiteMes ?? 200 };
      return null;
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (campo: string, valor: unknown) => {
        filtros.push([nome, campo, valor]);
        camposDaConsulta.push(campo);
        return q;
      },
      or: (expressao: string) => {
        filtros.push([nome, 'or', expressao]);
        return q;
      },
      is: () => q,
      gte: () => q,
      maybeSingle: async () => ({ data: dados(), error: null }),
      insert: async (linha: Record<string, unknown>) => {
        registros.push(linha);
        return { error: null };
      },
      // `await` direto na consulta de contagem de ia_geracoes: por pessoa (ritmo) ou por escola (cota)
      then: (resolver: (v: unknown) => void) =>
        resolver({
          count: camposDaConsulta.includes('professor_id')
            ? (cenario.chamadasRecentes ?? 0)
            : (cenario.usoMes ?? 0),
          error: null,
        }),
    };
    return q;
  };

  const admin = {
    auth: {
      getUser: async (jwt: string) =>
        jwt === 'jwt-ruim'
          ? { data: { user: null }, error: new Error('x') }
          : { data: { user: { id: 'prof-1' } }, error: null },
    },
    from: tabela,
  };

  let handler: Handler | null = null;
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    GEMINI_API_KEY: 'chave-secreta-do-gemini',
    ...cenario.env,
  };
  const Deno = {
    env: { get: (nome: string) => env[nome] },
    serve: (h: Handler) => {
      handler = h;
    },
  };
  new Function('Deno', '__criar', `globalThis.__createClient = __criar;\n${js}`)(Deno, () => admin);
  if (!handler) throw new Error('A função não registrou o handler.');
  return { handler: handler as Handler, registros, filtros };
}

function pedido(corpo: unknown, jwt: string | null = 'jwt-bom'): Request {
  return new Request('https://x.supabase.co/functions/v1/gerar-questoes', {
    method: 'POST',
    headers: jwt ? { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' } : {},
    body: JSON.stringify(corpo),
  });
}

const alt = (texto: string, correta = false) => ({
  letra: 'A',
  texto,
  correta,
  por_que_errou: correta ? null : `Você confundiu ${texto}.`,
});

const objetivaValida = (n = 1) => ({
  tipo: 'objetiva',
  dificuldade: 'medio',
  enunciado: `Qual característica define os vertebrados da questão ${n}?`,
  dica: 'Pense no esqueleto.',
  explicacao: 'A coluna vertebral sustenta o corpo.',
  resposta_esperada: null,
  alternativas: [alt('Exoesqueleto'), alt('Coluna vertebral', true), alt('Carapaça'), alt('Tentáculos')],
});

const discursivaValida = {
  tipo: 'discursiva',
  dificuldade: 'facil',
  enunciado: 'Explique a diferença entre ectotérmicos e endotérmicos.',
  dica: 'Pense na temperatura.',
  explicacao: 'Ectotérmicos dependem do ambiente.',
  resposta_esperada: 'Resposta modelo: ...\nCerto: ...\nParcial: ...\nErrado: ...',
  alternativas: null,
};

function respostaGemini(corpo: unknown): Response {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), {
    status: 200,
  });
}

const pedidoGerar = (extra: Record<string, unknown> = {}) => ({
  acao: 'gerar',
  disciplina_id: DISCIPLINA,
  assunto_id: ASSUNTO,
  serie: '6º Ano A',
  qtd_objetivas: 2,
  qtd_discursivas: 1,
  dificuldade: 'misturada',
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('gerar-questoes: acesso', () => {
  it('sem token → 401', async () => {
    const { handler } = carregarFuncao();
    const r = await handler(pedido(pedidoGerar(), null));
    expect(r.status).toBe(401);
  });

  it('token inválido → 401', async () => {
    const { handler } = carregarFuncao();
    expect((await handler(pedido(pedidoGerar(), 'jwt-ruim'))).status).toBe(401);
  });

  it('perfil inativo ou inexistente → 403', async () => {
    const inativo = carregarFuncao({
      perfil: { id: 'prof-1', escola_id: ESCOLA, papel: 'professor', ativo: false },
    });
    expect((await inativo.handler(pedido(pedidoGerar()))).status).toBe(403);
    const semPerfil = carregarFuncao({ perfil: null });
    expect((await semPerfil.handler(pedido(pedidoGerar()))).status).toBe(403);
  });

  it('sem GEMINI_API_KEY → 503 com mensagem clara (nunca chama o Gemini)', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    const { handler } = carregarFuncao({ env: { GEMINI_API_KEY: '' } });
    const r = await handler(pedido(pedidoGerar()));
    expect(r.status).toBe(503);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('ação desconhecida → 400', async () => {
    const { handler } = carregarFuncao();
    expect((await handler(pedido({ acao: 'apagar-tudo' }))).status).toBe(400);
  });
});

describe('gerar-questoes: validação do pedido', () => {
  it.each([
    ['matéria sem uuid', { disciplina_id: 'disc-mat' }],
    ['submatéria sem uuid', { assunto_id: 'x' }],
    ['série vazia', { serie: '' }],
    ['mais de 20 questões', { qtd_objetivas: 15, qtd_discursivas: 6 }],
    ['nenhuma questão', { qtd_objetivas: 0, qtd_discursivas: 0 }],
    ['quantidade não inteira', { qtd_objetivas: 1.5 }],
    ['mais de 5 fotos', { fotos: Array(6).fill('data:image/jpeg;base64,AAAA') }],
    ['foto que não é imagem', { fotos: ['data:text/html;base64,AAAA'] }],
    ['foto enorme', { fotos: ['data:image/jpeg;base64,' + 'A'.repeat(700_001)] }],
  ])('%s → 400, sem chamar o Gemini', async (_nome, extra) => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    const { handler } = carregarFuncao();
    const r = await handler(pedido(pedidoGerar(extra)));
    expect(r.status).toBe(400);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('matéria ou submatéria que não é da escola do chamador → 404', async () => {
    const semDisciplina = carregarFuncao({ disciplina: null });
    expect((await semDisciplina.handler(pedido(pedidoGerar()))).status).toBe(404);
    const semAssunto = carregarFuncao({ assunto: null });
    expect((await semAssunto.handler(pedido(pedidoGerar()))).status).toBe(404);
  });

  it('a busca da matéria é sempre filtrada pela escola do perfil, não pelo corpo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaGemini({ aviso: null, questoes: [] })));
    const { handler, filtros } = carregarFuncao();
    await handler(pedido(pedidoGerar({ escola_id: '99999999-9999-4999-8999-999999999999' })));
    const daDisciplina = filtros.filter(([t]) => t === 'disciplinas');
    expect(daDisciplina).toContainEqual(['disciplinas', 'escola_id', ESCOLA]);
    expect(filtros.some(([, , v]) => v === '99999999-9999-4999-8999-999999999999')).toBe(false);
  });
});

describe('gerar-questoes: geração', () => {
  it('devolve questões válidas, descarta as malformadas e grava a geração', async () => {
    const duasCorretas = {
      ...objetivaValida(9),
      alternativas: [alt('A', true), alt('B', true), alt('C'), alt('D')],
    };
    const fetchFalso = vi.fn(async () =>
      respostaGemini({
        aviso: null,
        questoes: [objetivaValida(1), duasCorretas, objetivaValida(2), discursivaValida],
      })
    );
    vi.stubGlobal('fetch', fetchFalso);
    const { handler, registros } = carregarFuncao();

    const r = await handler(pedido(pedidoGerar()));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.questoes).toHaveLength(3);
    expect(corpo.descartadas).toBe(1);
    expect(corpo.interrompida).toBe(false);
    expect(corpo.contexto).toEqual({ disciplina_nome: 'Ciências', assunto_nome: 'Animais vertebrados' });
    for (const q of corpo.questoes.filter((x: { tipo: string }) => x.tipo === 'objetiva')) {
      expect(q.alternativas).toHaveLength(4);
      expect(q.alternativas.filter((a: { correta: boolean }) => a.correta)).toHaveLength(1);
      expect(q.alternativas.map((a: { letra: string }) => a.letra)).toEqual(['A', 'B', 'C', 'D']);
    }
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      escola_id: ESCOLA,
      professor_id: 'prof-1',
      qtd_objetivas: 2,
      qtd_discursivas: 1,
      qtd_fotos: 0,
      status: 'ok',
    });
  });

  it('usa os nomes do BANCO no prompt e manda a chave no cabeçalho, nunca na URL', async () => {
    const fetchFalso = vi.fn(async (..._args: unknown[]) =>
      respostaGemini({ aviso: null, questoes: [objetivaValida(1), objetivaValida(2), discursivaValida] })
    );
    vi.stubGlobal('fetch', fetchFalso);
    const { handler } = carregarFuncao();
    await handler(pedido(pedidoGerar({ texto_base: 'Texto da aula' })));

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('chave-secreta-do-gemini');
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('chave-secreta-do-gemini');

    const enviado = JSON.parse(init.body as string);
    const prompt: string = enviado.contents[0].parts.at(-1).text;
    expect(prompt).toContain('Disciplina: Ciências');
    expect(prompt).toContain('Assunto: Animais vertebrados');
    expect(prompt).toContain('Série: 6º Ano');
    expect(prompt).toContain('EXCLUSIVAMENTE o conteúdo do material');
    // O prompt do servidor é o mesmo que o app monta (a cópia não pode se desviar).
    expect(prompt).toBe(
      montarPromptGemini({
        nomeDisciplina: 'Ciências',
        serie: '6º Ano',
        nomeAssunto: 'Animais vertebrados',
        obj: { total: 2, facil: 1, medio: 1, dificil: 0 },
        disc: { total: 1, facil: 0, medio: 1, dificil: 0 },
        temFotos: false,
        textoBase: 'Texto da aula',
      })
    );
  });

  it('nunca devolve mais questões do que o pedido, em cada tipo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respostaGemini({
          questoes: [objetivaValida(1), objetivaValida(2), objetivaValida(3), objetivaValida(4)],
        })
      )
    );
    const { handler } = carregarFuncao();
    const corpo = await (await handler(pedido(pedidoGerar({ qtd_objetivas: 2, qtd_discursivas: 0 })))).json();
    expect(corpo.questoes).toHaveLength(2);
  });

  it('divide em lotes de 5 e passa os enunciados anteriores a partir do 2º lote', async () => {
    const fetchFalso = vi.fn(async (..._args: unknown[]) =>
      respostaGemini({
        questoes: Array.from({ length: 5 }, (_, i) => objetivaValida(Math.floor(Math.random() * 1e6) + i)),
      })
    );
    vi.stubGlobal('fetch', fetchFalso);
    const { handler } = carregarFuncao();
    const corpo = await (await handler(pedido(pedidoGerar({ qtd_objetivas: 10, qtd_discursivas: 0 })))).json();
    expect(corpo.questoes).toHaveLength(10);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    const prompts = fetchFalso.mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string).contents[0].parts.at(-1).text as string
    );
    expect(prompts[0]).not.toContain('Estas questões já foram criadas');
    expect(prompts[1]).toContain('Estas questões já foram criadas');
  });

  it('repete uma vez se o JSON vier quebrado e aproveita a 2ª resposta', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respostaGemini('isto não é json {'))
      .mockResolvedValueOnce(respostaGemini({ questoes: [objetivaValida(1), objetivaValida(2), discursivaValida] }));
    vi.stubGlobal('fetch', fetchFalso);
    const { handler } = carregarFuncao();
    const r = await handler(pedido(pedidoGerar()));
    expect(r.status).toBe(200);
    expect((await r.json()).questoes).toHaveLength(3);
  });

  it('IA sem resposta aproveitável → 502 e a geração fica registrada como erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaGemini('lixo')));
    const { handler, registros } = carregarFuncao();
    const r = await handler(pedido(pedidoGerar()));
    expect(r.status).toBe(502);
    expect((await r.json()).erro).toContain('não conseguiu gerar');
    expect(registros).toHaveLength(1);
    expect(registros[0].status).toBe('erro');
  });

  it('o Gemini fora do ar cai nos modelos seguintes e depois dá erro sem vazar detalhe nem chave', async () => {
    const fetchFalso = vi.fn(async () => new Response('{"error":{"message":"quota"}}', { status: 429 }));
    vi.stubGlobal('fetch', fetchFalso);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { handler } = carregarFuncao();
    const r = await handler(pedido(pedidoGerar({ qtd_objetivas: 1, qtd_discursivas: 0 })));
    expect(r.status).toBe(502);
    const texto = await r.text();
    expect(texto).not.toContain('quota');
    expect(texto).not.toContain('chave-secreta');
    expect(fetchFalso.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('manda as fotos como inlineData', async () => {
    const fetchFalso = vi.fn(async (..._args: unknown[]) =>
      respostaGemini({ questoes: [objetivaValida(1), objetivaValida(2), discursivaValida] })
    );
    vi.stubGlobal('fetch', fetchFalso);
    const { handler, registros } = carregarFuncao();
    await handler(pedido(pedidoGerar({ fotos: ['data:image/jpeg;base64,QUJD'] })));
    const partes = JSON.parse((fetchFalso.mock.calls[0][1] as RequestInit).body as string).contents[0].parts;
    expect(partes[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    expect(registros[0].qtd_fotos).toBe(1);
  });
});

describe('gerar-questoes: cota mensal (6.2)', () => {
  it('sem IA_COTA_ATIVA a IA fica sem limite, mesmo acima da cota', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaGemini({ questoes: [objetivaValida(1), objetivaValida(2), discursivaValida] }))
    );
    const { handler } = carregarFuncao({ usoMes: 500, limiteMes: 200 });
    expect((await handler(pedido(pedidoGerar()))).status).toBe(200);
  });

  it('com IA_COTA_ATIVA=true bloqueia no limite e não chama o Gemini', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    const { handler, registros } = carregarFuncao({
      env: { IA_COTA_ATIVA: 'true' },
      usoMes: 200,
      limiteMes: 200,
    });
    const r = await handler(pedido(pedidoGerar()));
    expect(r.status).toBe(429);
    expect((await r.json()).erro).toContain('Limite de gerações');
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(registros).toHaveLength(0);
  });

  it('com IA_COTA_ATIVA=true libera abaixo do limite', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respostaGemini({ questoes: [objetivaValida(1), objetivaValida(2), discursivaValida] }))
    );
    const { handler } = carregarFuncao({ env: { IA_COTA_ATIVA: 'true' }, usoMes: 199, limiteMes: 200 });
    expect((await handler(pedido(pedidoGerar()))).status).toBe(200);
  });

  it('ação cota informa uso, limite e se a trava está ativa', async () => {
    const { handler } = carregarFuncao({ env: { IA_COTA_ATIVA: 'true' }, usoMes: 7, limiteMes: 50 });
    const r = await handler(pedido({ acao: 'cota' }));
    expect(await r.json()).toEqual({ uso_mes: 7, limite_mes: 50, ativa: true });
  });
});

describe('gerar-questoes: transcrever', () => {
  it('transcreve as fotos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaGemini('Conteúdo da página')));
    const { handler } = carregarFuncao();
    const r = await handler(pedido({ acao: 'transcrever', fotos: ['data:image/png;base64,QUJD'] }));
    expect(await r.json()).toEqual({ texto: 'Conteúdo da página' });
  });

  it('sem fotos → 400', async () => {
    const { handler } = carregarFuncao();
    expect((await handler(pedido({ acao: 'transcrever', fotos: [] }))).status).toBe(400);
  });

  it('grava a transcrição em ia_geracoes sem pedir questões (fica fora da cota)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaGemini('Texto')));
    const { handler, registros } = carregarFuncao();
    await handler(pedido({ acao: 'transcrever', fotos: ['data:image/png;base64,QUJD', 'data:image/png;base64,QUJD'] }));
    expect(registros).toEqual([
      expect.objectContaining({ professor_id: 'prof-1', escola_id: ESCOLA, qtd_fotos: 2, qtd_objetivas: 0, qtd_discursivas: 0, status: 'ok' }),
    ]);
  });

  it('transcrição que falha também fica registrada, como erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fora do ar', { status: 503 })));
    const { handler, registros } = carregarFuncao();
    const r = await handler(pedido({ acao: 'transcrever', fotos: ['data:image/png;base64,QUJD'] }));
    expect(r.status).toBe(502);
    expect(registros).toEqual([expect.objectContaining({ status: 'erro', qtd_objetivas: 0, qtd_discursivas: 0 })]);
  });
});

describe('gerar-questoes: limite de ritmo (8.1)', () => {
  it.each(['gerar', 'transcrever'])('%s: 20 pedidos em 10 minutos → 429, sem chamar o Gemini', async (acao) => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    const { handler, registros, filtros } = carregarFuncao({ chamadasRecentes: 20 });
    const corpo = acao === 'gerar' ? pedidoGerar() : { acao, fotos: ['data:image/png;base64,QUJD'] };
    const r = await handler(pedido(corpo));
    expect(r.status).toBe(429);
    expect((await r.json()).erro).toContain('Muitos pedidos');
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(registros).toHaveLength(0);
    // conta por pessoa (o id vem do perfil do chamador, não do corpo)
    expect(filtros).toContainEqual(['ia_geracoes', 'professor_id', 'prof-1']);
  });

  it('abaixo do limite segue normal, mesmo com a cota da escola alta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaGemini('Texto')));
    const { handler } = carregarFuncao({ chamadasRecentes: 19, usoMes: 500 });
    expect((await handler(pedido({ acao: 'transcrever', fotos: ['data:image/png;base64,QUJD'] }))).status).toBe(200);
  });

  it('a cota mensal ignora as transcrições (só conta pedidos com questões)', async () => {
    const { handler, filtros } = carregarFuncao({ env: { IA_COTA_ATIVA: 'true' }, usoMes: 3 });
    await handler(pedido({ acao: 'cota' }));
    expect(filtros).toContainEqual(['ia_geracoes', 'or', 'qtd_objetivas.gt.0,qtd_discursivas.gt.0']);
  });

  it('a ação cota não passa pelo limite de ritmo', async () => {
    const { handler } = carregarFuncao({ chamadasRecentes: 99 });
    expect((await handler(pedido({ acao: 'cota' }))).status).toBe(200);
  });
});
