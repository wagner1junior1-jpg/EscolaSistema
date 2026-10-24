// =============================================================================
// SABERPONTUAL — Edge Function `gerar-questoes` (Fase 6.1 e 6.2 do plano do back end)
//
// Gera questões com o Gemini no SERVIDOR: a chave fica no segredo GEMINI_API_KEY e nunca vai
// para o navegador. Quem chama precisa estar logado (JWT) e ser professor, coordenação ou
// direção ativos. A escola vem do perfil do chamador; o corpo da requisição não escolhe escola,
// e os nomes da disciplina e do assunto são lidos do banco (o corpo só manda os ids).
//
// Ações (POST, JSON):
//   { acao: 'gerar', disciplina_id, assunto_id, serie, qtd_objetivas, qtd_discursivas,
//     dificuldade?, texto_base?, fotos?: string[] (data URL jpeg/png/webp) }
//        devolve { questoes, aviso, descartadas, interrompida, contexto }. As questões vêm
//        validadas (objetiva com 4 alternativas e 1 correta) mas SEM os ajustes de revisão
//        (embaralhar, avisos): isso o app faz (ia.supabase.ts + iaValidacao.ts).
//   { acao: 'transcrever', fotos: string[] }   devolve { texto }
//   { acao: 'cota' }                           devolve { uso_mes, limite_mes, ativa }
//
// Cota mensal por escola (escolas.cota_ia_mensal, contando ia_geracoes com status 'ok' no mês
// de São Paulo): SÓ vale com o segredo IA_COTA_ATIVA=true. Sem ele a IA fica sem limite
// (decisão do Wagner até a produção). Cada geração (ok ou erro) é gravada em ia_geracoes.
//
// Segredos (painel > Edge Functions > Secrets): GEMINI_API_KEY (obrigatório) e
// IA_COTA_ATIVA (opcional). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados.
//
// Deploy (sem CLI): painel do Supabase > Edge Functions > Deploy a new function > nome
// `gerar-questoes` > colar este arquivo. Manter "Verify JWT" ligado. O trecho entre
// PROMPT:INICIO e PROMPT:FIM é cópia de app/src/services/ia-prompt.ts (o teste
// ia-prompt-servidor.test.ts confere): ao mudar o prompt, mude nos dois arquivos.
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

type AreaConhecimento = 'exatas' | 'natureza' | 'humanas' | 'linguagens' | 'geral';

// PROMPT:INICIO
/**
 * Converte "6º Ano A", "6º Ano - Turma B", "Turma 8A" para "6º Ano" ou "8º Ano"
 */
export function normalizarSerieBase(serieOuTurma: string): string {
  if (!serieOuTurma) return '6º Ano';
  const s = serieOuTurma.trim();
  const matchNum = s.match(/(?:turma\s+)?(\d+)[ºo°]?\s*(?:ano)?\s*([a-z])?/i);
  if (matchNum && matchNum[1]) {
    return `${matchNum[1]}º Ano`;
  }
  return s
    .replace(/\s*[-–—]?\s*turma\s+[a-z0-9]+/i, '')
    .replace(/\s+[a-z]$/i, '')
    .trim() || '6º Ano';
}

/**
 * Classifica a disciplina na respectiva área do conhecimento segundo a BNCC.
 */
export function identificarArea(nomeDisciplina: string): AreaConhecimento {
  const norm = (nomeDisciplina || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/educacao\s+fisica/.test(norm)) return 'geral';
  if (/\b(?:matematica|fisica|quimica|algebra|geometria|aritmetica)\b/.test(norm)) return 'exatas';
  if (/ciencia|natureza|biologia/.test(norm)) return 'natureza';
  if (/historia|geografia|filosofia|sociologia/.test(norm)) return 'humanas';
  if (/portugues|literatura|redacao|ingles|espanhol|linguagens/.test(norm)) return 'linguagens';
  return 'geral';
}

/**
 * Retorna as diretrizes de linguagem e calibração por faixa etária (1º ao 9º Ano).
 */
export function diretrizesSerie(serie: string): string {
  const s = normalizarSerieBase(serie).toLowerCase();
  if (/1[ºo°]|2[ºo°]/.test(s)) {
    return 'Alunos em fase de alfabetização. Enunciados de no máximo 15 palavras, vocabulário do dia a dia, uma ideia por questão, situações concretas (casa, escola, animais, alimentos, brincadeiras). Nenhum termo técnico. Alternativas com poucas palavras.';
  }
  if (/3[ºo°]|4[ºo°]|5[ºo°]/.test(s)) {
    return 'Frases curtas e diretas (até 20 palavras por frase), vocabulário do dia a dia, situações concretas do cotidiano. Termos do conteúdo só os que a série já estuda, sempre com linguagem simples.';
  }
  // 6º ao 9º Ano (Fundamental II)
  return 'Enunciados contextualizados e curtos, com a situação e depois a pergunta. Os termos técnicos do assunto são esperados, e quando um termo aparece pela primeira vez ele é explicado no próprio enunciado. Exigir compreensão e aplicação, não só memorização.';
}

/**
 * Retorna as diretrizes temáticas e epistemológicas para cada área do conhecimento.
 */
export function diretrizesArea(area: AreaConhecimento): string {
  switch (area) {
    case 'exatas':
      return 'Crie problemas contextualizados com números e cálculos explícitos. Os distratores devem vir de erros reais de cálculo (sinal, ordem das operações, unidade, fração invertida). A explicação mostra o cálculo em poucos passos.';
    case 'natureza':
      return 'Cobre conceitos, classificação, características, funções dos organismos e relações com o ambiente e a saúde. Só use cálculo se o assunto for quantitativo por natureza (ex.: velocidade, densidade, circuitos elétricos). Se o assunto for conceitual (ex.: animais vertebrados, células, cadeia alimentar), nenhuma questão pode ser conta, contagem artificial ou expressão numérica. Números que fazem parte do conteúdo são permitidos (ex.: "o coração dos anfíbios tem 3 cavidades"). Os distratores são confusões conceituais comuns (ex.: confundir a respiração do girino com a do sapo adulto, ou achar que o morcego é uma ave).';
    case 'humanas':
      return 'Cobre causas e consequências, contexto histórico e espacial, comparação entre períodos e lugares, e leitura crítica de fontes descritas em texto. Datas só quando forem essenciais, sem decoreba. Os distratores são anacronismo, confusão entre causa e consequência, e generalização.';
    case 'linguagens':
      return 'Interpretação de textos curtos escritos por você (não copie trechos de obras protegidas; obras em domínio público podem ser citadas), gramática dentro do contexto e gêneros textuais. Em língua estrangeira, o texto-base pode estar na língua estudada, mas o enunciado e o feedback ficam em português. Os distratores são leituras equivocadas ou generalizações do texto.';
    default:
      return 'Cobre os conceitos e as práticas do assunto, com situações reais. Não crie cálculos, a menos que o assunto seja sobre números.';
  }
}

export function checagemArea(area: AreaConhecimento): string {
  switch (area) {
    case 'natureza':
      return 'Se o assunto for conceitual, nenhuma questão é conta.';
    case 'exatas':
      return 'Todo cálculo e toda resposta numérica estão corretos.';
    default:
      return 'Nenhuma questão virou conta.';
  }
}

export function regrasFormatacao(area: AreaConhecimento): string {
  if (area === 'exatas') {
    return 'Use LaTeX ($...$) SÓ para fórmulas, equações, frações e variáveis. Nunca em palavras, unidades simples ou pontuação. Dentro do JSON, escreva a barra invertida dobrada (ex.: \\\\frac{1}{2}).';
  }
  return 'Não use LaTeX nem o símbolo $. Escreva tudo em texto comum.';
}

export function regrasMaterial(temFotos: boolean, textoBase?: string): string {
  if (temFotos || (textoBase && textoBase.trim().length > 0)) {
    return 'Use EXCLUSIVAMENTE o conteúdo do material enviado (fotos e/ou texto). Não traga conceitos que não estão nele. A série serve só para calibrar a linguagem e a dificuldade.';
  }
  return 'Baseie-se no currículo da BNCC para essa disciplina, série e assunto. Se o assunto não for típico da série, adapte a linguagem e a profundidade à série, sem avançar conteúdo.';
}

export function distribuirDificuldade(
  qtd: number,
  dificuldade?: string
): { facil: number; medio: number; dificil: number } {
  if (qtd <= 0) return { facil: 0, medio: 0, dificil: 0 };
  if (dificuldade === 'facil') return { facil: qtd, medio: 0, dificil: 0 };
  if (dificuldade === 'medio') return { facil: 0, medio: qtd, dificil: 0 };
  if (dificuldade === 'dificil') return { facil: 0, medio: 0, dificil: qtd };

  const facil = Math.round(qtd * 0.3);
  const dificil = Math.round(qtd * 0.2);
  const medio = qtd - (facil + dificil);
  return { facil, medio, dificil };
}

/**
 * Remove qualquer numeração ("Questão 1:", "Questão Discursiva 2:", "1.", "[Mat · 7º Ano]")
 * e padroniza rigorosamente como: (Disciplina - SérieBase) Enunciado...
 */
export function padronizarEnunciadoQuestao(
  enunciadoBruto: string,
  nomeDisciplina: string,
  serie: string
): string {
  const serieBase = normalizarSerieBase(serie);
  let limpo = (enunciadoBruto || '').trim();

  let alterou = true;
  while (alterou) {
    const anterior = limpo;
    limpo = limpo.replace(/^\[[^\]]+\]\s*/i, '');
    limpo = limpo.replace(/^\([^)]+\)\s*/i, '');
    limpo = limpo.replace(/^quest[aã]o\s+(?:discursiva\s+|objetiva\s+)?\d+\s*[:.\-–—)\]]*\s*/i, '');
    limpo = limpo.replace(/^#?\d+\s*[:.\-–—)]\s*/i, '');
    limpo = limpo.trim();
    alterou = limpo !== anterior;
  }

  if (limpo.length > 0) {
    limpo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }

  return `(${nomeDisciplina} - ${serieBase}) ${limpo}`;
}

export function montarPromptGemini(params: {
  nomeDisciplina: string;
  serie: string;
  nomeAssunto: string;
  obj: { total: number; facil: number; medio: number; dificil: number };
  disc: { total: number; facil: number; medio: number; dificil: number };
  temFotos: boolean;
  textoBase?: string;
  enunciadosAnteriores?: string;
}): string {
  const serieBase = normalizarSerieBase(params.serie);
  const area = identificarArea(params.nomeDisciplina);

  return `Você é um professor especialista em elaborar avaliações para a educação básica brasileira, alinhadas à BNCC.

TAREFA
Escreva questões inéditas sobre:
- Disciplina: ${params.nomeDisciplina}
- Série: ${serieBase}
- Assunto: ${params.nomeAssunto}
Quantidade exata:
- ${params.obj.total} OBJETIVAS: ${params.obj.facil} fáceis, ${params.obj.medio} médias, ${params.obj.dificil} difíceis.
- ${params.disc.total} DISCURSIVAS: ${params.disc.facil} fáceis, ${params.disc.medio} médias, ${params.disc.dificil} difíceis.

O QUE CADA NÍVEL SIGNIFICA
- fácil: reconhecer ou lembrar um conceito, fato ou definição.
- médio: aplicar, comparar ou classificar usando o conceito.
- difícil: analisar uma situação, relacionar dois ou mais conceitos ou justificar.

SÉRIE E LINGUAGEM
${diretrizesSerie(serieBase)}

CONTEÚDO
${regrasMaterial(params.temFotos, params.textoBase)}
- Varie os subtemas do assunto. Duas questões não podem cobrar a mesma ideia.
- Não faça afirmações absolutas que tenham exceções conhecidas. Exemplo: "todo mamífero nasce do ventre da mãe" (o ornitorrinco bota ovos).
${params.enunciadosAnteriores ? "Estas questões já foram criadas. Não repita as ideias delas:\n" + params.enunciadosAnteriores + "\n" : ""}
ÁREA DA DISCIPLINA
${diretrizesArea(area)}

SEM IMAGENS
Toda questão deve poder ser respondida só com o texto. Nunca escreva "observe a imagem", "de acordo com o gráfico" nem "analise a figura/tabela/mapa".

ENUNCIADO
- Escreva só o texto da questão. Não numere ("Questão 1", "1.", "#1") e não coloque a matéria ou a série no início.
- Nunca mencione letras de turmas específicas (como "Turma A", "Turma B", "6º A") no enunciado ou na contextualização.
- Evite perguntas negativas ("Qual NÃO é..."). Se usar uma (só do 6º ano em diante), escreva NÃO em maiúsculas.

OBJETIVAS
- Exatamente 4 alternativas e exatamente 1 correta.
- Cada alternativa errada representa um erro comum e plausível de alunos dessa série. Nada de alternativa absurda ou de brincadeira.
- As 4 alternativas têm tamanho e estilo parecidos. A correta não pode ser a mais longa nem a mais detalhada.
- É proibido usar "todas as anteriores", "nenhuma das anteriores", "todas estão corretas", "nenhuma está correta" ou combinações de itens ("apenas I e II").

FEEDBACK
Não existe outra correção automática depois. Tudo o que você escrever aqui é o que o aluno vai ler.
- "dica" (o aluno lê ANTES de responder): 1 frase que orienta o raciocínio sem revelar a resposta nem eliminar alternativas.
- "por_que_errou" (o aluno lê só se marcou aquela alternativa errada):
  - fale com o aluno em segunda pessoa ("Você confundiu..."), com tom acolhedor;
  - 1 ou 2 frases: diga qual foi o engano e corrija o conceito;
  - na alternativa correta, o valor é null.
- "explicacao" (o aluno lê DEPOIS de responder): 2 ou 3 frases dizendo por que a resposta correta está certa e qual conceito ela ensina.
- Nesses três campos, NUNCA cite letras ou posições ("alternativa C", "a opção acima"). As alternativas serão embaralhadas, então fale do conteúdo.
- Cada texto precisa fazer sentido sozinho, porque o aluno lê só o feedback da alternativa que marcou.

DISCURSIVAS
- "alternativas": null.
- "dica" e "explicacao" seguem as regras acima. A explicação é para o aluno e aparece depois que ele envia a resposta.
- A pergunta precisa caber numa resposta de até 5 linhas para a série.
- "resposta_esperada" é para o PROFESSOR corrigir. Use exatamente este formato:
  Resposta modelo: ...
  Certo: o que a resposta precisa conter para valer a nota inteira.
  Parcial: o que vale meia nota.
  Errado: o que vale zero.

FORMATAÇÃO
${regrasFormatacao(area)}

MATERIAL OU ASSUNTO INSUFICIENTE
Se não for possível criar a quantidade pedida sem repetir ideias ou sair do conteúdo, crie menos questões e explique o motivo em "aviso". Caso contrário, "aviso" é null.

SAÍDA
Responda só com JSON neste formato (o exemplo mostra só a estrutura; a posição da correta varia):
{
  "aviso": null,
  "questoes": [
    {
      "tipo": "objetiva",
      "dificuldade": "medio",
      "enunciado": "...",
      "dica": "...",
      "explicacao": "...",
      "resposta_esperada": null,
      "alternativas": [
        { "letra": "A", "texto": "...", "correta": false, "por_que_errou": "..." },
        { "letra": "B", "texto": "...", "correta": true, "por_que_errou": null },
        { "letra": "C", "texto": "...", "correta": false, "por_que_errou": "..." },
        { "letra": "D", "texto": "...", "correta": false, "por_que_errou": "..." }
      ]
    },
    {
      "tipo": "discursiva",
      "dificuldade": "facil",
      "enunciado": "...",
      "dica": "...",
      "explicacao": "...",
      "resposta_esperada": "Resposta modelo: ...\\nCerto: ...\\nParcial: ...\\nErrado: ...",
      "alternativas": null
    }
  ]
}

CHECAGEM FINAL (confira antes de responder)
- As quantidades e as dificuldades batem com o que foi pedido.
- Nenhum enunciado depende de imagem, tem numeração ou traz a matéria e a série.
- Nenhum feedback cita letra ou posição.
- ${checagemArea(area)}`;
}
// PROMPT:FIM

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PAPEIS_PERMITIDOS = ['professor', 'coordenacao', 'direcao'];
const MAX_QUESTOES = 20;
const MAX_FOTOS = 5;
const MAX_CHARS_FOTO = 700_000; // o app reduz cada foto para ~300 KB (cerca de 410 mil caracteres)
const MAX_CHARS_TEXTO = 20_000;
const TAMANHO_LOTE = 5;
const TIMEOUT_CHAMADA_MS = 30_000;
const PRAZO_TOTAL_MS = 120_000; // a função tem teto de tempo; passado isso devolve o que já veio
const DIFICULDADES = ['facil', 'medio', 'dificil'];
const MODELOS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOTO = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

interface Chamador {
  id: string;
  escola_id: string;
}

type Cliente = ReturnType<typeof createClient>;
type PartesGemini = Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;

interface QuestaoBruta {
  tipo: 'objetiva' | 'discursiva';
  dificuldade: string;
  enunciado: string;
  dica: string;
  explicacao: string;
  resposta_esperada: string | null;
  alternativas: Array<{
    letra: string;
    texto: string;
    correta: boolean;
    por_que_errou: string | null;
  }> | null;
}

// ---------------------------------------------------------------------------
// Validação do pedido
// ---------------------------------------------------------------------------

function inteiro(valor: unknown, campo: string, min: number, max: number): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < min || valor > max) {
    throw new ErroHttp(400, `Valor inválido em ${campo}.`);
  }
  return valor;
}

function textoOpcional(valor: unknown, campo: string, max: number): string {
  if (valor === undefined || valor === null || valor === '') return '';
  if (typeof valor !== 'string' || valor.length > max) {
    throw new ErroHttp(400, `Texto inválido em ${campo}.`);
  }
  return valor.trim();
}

function validarFotos(valor: unknown): Array<{ mimeType: string; data: string }> {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor) || valor.length > MAX_FOTOS) {
    throw new ErroHttp(400, `Envie no máximo ${MAX_FOTOS} fotos.`);
  }
  return valor.map((foto) => {
    if (typeof foto !== 'string' || foto.length > MAX_CHARS_FOTO) {
      throw new ErroHttp(400, 'Uma das fotos é grande demais. Tente uma foto menor.');
    }
    const m = FOTO.exec(foto);
    if (!m) throw new ErroHttp(400, 'Use fotos JPG, PNG ou WEBP.');
    return { mimeType: m[1], data: m[2] };
  });
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function chamarGemini(
  chave: string,
  parts: PartesGemini,
  json: boolean,
  prazoFinal: number
): Promise<string> {
  let ultimoErro = 'sem resposta';
  for (const modelo of MODELOS) {
    const restante = prazoFinal - Date.now();
    if (restante < 5_000) break;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(TIMEOUT_CHAMADA_MS, restante));
    try {
      const generationConfig: Record<string, unknown> = { temperature: 0.4, maxOutputTokens: 8192 };
      if (json) generationConfig.responseMimeType = 'application/json';
      if (modelo.startsWith('gemini-3') || modelo.includes('flash-lite')) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      // A chave vai no cabeçalho (nunca na URL, que aparece em logs).
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
          body: JSON.stringify({ contents: [{ parts }], generationConfig }),
          signal: controller.signal,
        }
      );
      if (!resp.ok) {
        ultimoErro = `${modelo}: HTTP ${resp.status}`;
        console.error('gerar-questoes: Gemini respondeu', ultimoErro);
        continue;
      }
      const dados = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      };
      const partes = dados.candidates?.[0]?.content?.parts ?? [];
      const texto = partes
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n')
        .trim();
      if (texto) return texto;
      ultimoErro = `${modelo}: resposta vazia`;
    } catch (e) {
      ultimoErro = `${modelo}: ${e instanceof Error ? e.name : 'erro'}`;
      console.error('gerar-questoes: falha ao chamar o Gemini', ultimoErro);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error(ultimoErro);
}

function extrairJson(bruto: string): unknown {
  const limpo = bruto
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  return JSON.parse(ini !== -1 && fim > ini ? limpo.slice(ini, fim + 1) : limpo);
}

function texto(valor: unknown, max: number): string {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

/** Devolve a questão no formato esperado ou null (formato inválido: a questão é descartada). */
function normalizarQuestao(q: unknown): QuestaoBruta | null {
  if (!q || typeof q !== 'object') return null;
  const o = q as Record<string, unknown>;
  const tipo = o.tipo === 'objetiva' || o.tipo === 'discursiva' ? o.tipo : null;
  const enunciado = texto(o.enunciado, 3000);
  if (!tipo || enunciado.length < 10) return null;
  const dificuldade =
    typeof o.dificuldade === 'string' && DIFICULDADES.includes(o.dificuldade) ? o.dificuldade : 'medio';
  const base = {
    tipo,
    dificuldade,
    enunciado,
    dica: texto(o.dica, 1500),
    explicacao: texto(o.explicacao, 1500),
  };

  if (tipo === 'discursiva') {
    const resposta = texto(o.resposta_esperada, 3000);
    if (!resposta) return null;
    return { ...base, tipo, resposta_esperada: resposta, alternativas: null };
  }

  if (!Array.isArray(o.alternativas) || o.alternativas.length !== 4) return null;
  const letras = ['A', 'B', 'C', 'D'];
  const alternativas = [];
  for (let i = 0; i < 4; i++) {
    const a = o.alternativas[i] as Record<string, unknown> | null;
    const textoAlt = texto(a?.texto, 600);
    if (!a || !textoAlt) return null;
    const correta = a.correta === true;
    alternativas.push({
      letra: letras[i],
      texto: textoAlt,
      correta,
      por_que_errou: correta ? null : texto(a.por_que_errou, 1000) || null,
    });
  }
  if (alternativas.filter((a) => a.correta).length !== 1) return null;
  return { ...base, tipo, resposta_esperada: null, alternativas };
}

// ---------------------------------------------------------------------------
// Cota e registro
// ---------------------------------------------------------------------------

/** 1º dia do mês corrente em São Paulo (UTC-3, sem horário de verão), como instante UTC. */
function inicioDoMes(): string {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return new Date(Date.UTC(sp.getFullYear(), sp.getMonth(), 1, 3, 0, 0)).toISOString();
}

async function consultarCota(admin: Cliente, escolaId: string) {
  const { data: escola, error: erroEscola } = await admin
    .from('escolas')
    .select('cota_ia_mensal')
    .eq('id', escolaId)
    .maybeSingle();
  if (erroEscola || !escola) throw new ErroHttp(500, 'Não foi possível consultar a cota de IA.');
  const { count, error: erroConta } = await admin
    .from('ia_geracoes')
    .select('id', { count: 'exact', head: true })
    .eq('escola_id', escolaId)
    .eq('status', 'ok')
    .gte('criado_em', inicioDoMes());
  if (erroConta) throw new ErroHttp(500, 'Não foi possível consultar a cota de IA.');
  return {
    uso_mes: count ?? 0,
    limite_mes: escola.cota_ia_mensal as number,
    ativa: Deno.env.get('IA_COTA_ATIVA') === 'true',
  };
}

async function registrarGeracao(
  admin: Cliente,
  chamador: Chamador,
  dados: { fotos: number; objetivas: number; discursivas: number; erro?: string }
) {
  const { error } = await admin.from('ia_geracoes').insert({
    escola_id: chamador.escola_id,
    professor_id: chamador.id,
    qtd_fotos: dados.fotos,
    qtd_objetivas: dados.objetivas,
    qtd_discursivas: dados.discursivas,
    status: dados.erro ? 'erro' : 'ok',
    erro_msg: dados.erro ? dados.erro.slice(0, 300) : null,
  });
  // O registro não pode derrubar a resposta, mas a falha precisa aparecer no log.
  if (error) console.error('gerar-questoes: não gravou ia_geracoes', error.message);
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

async function acaoGerar(
  admin: Cliente,
  chamador: Chamador,
  corpo: Record<string, unknown>,
  chave: string
) {
  const disciplinaId = corpo.disciplina_id;
  const assuntoId = corpo.assunto_id;
  if (typeof disciplinaId !== 'string' || !UUID.test(disciplinaId)) {
    throw new ErroHttp(400, 'Escolha a matéria.');
  }
  if (typeof assuntoId !== 'string' || !UUID.test(assuntoId)) {
    throw new ErroHttp(400, 'Escolha a submatéria.');
  }
  const serie = textoOpcional(corpo.serie, 'a série', 40);
  if (!serie) throw new ErroHttp(400, 'Escolha a série.');
  const qtdObj = inteiro(corpo.qtd_objetivas, 'objetivas', 0, MAX_QUESTOES);
  const qtdDisc = inteiro(corpo.qtd_discursivas, 'discursivas', 0, MAX_QUESTOES);
  if (qtdObj + qtdDisc < 1 || qtdObj + qtdDisc > MAX_QUESTOES) {
    throw new ErroHttp(400, `Peça de 1 a ${MAX_QUESTOES} questões por vez.`);
  }
  const dificuldade =
    typeof corpo.dificuldade === 'string' &&
    (corpo.dificuldade === 'misturada' || DIFICULDADES.includes(corpo.dificuldade))
      ? corpo.dificuldade
      : 'misturada';
  const textoBase = textoOpcional(corpo.texto_base, 'o texto de apoio', MAX_CHARS_TEXTO);
  const fotos = validarFotos(corpo.fotos);

  // Os nomes vêm do banco, sempre da escola do chamador.
  const { data: disciplina, error: erroDisc } = await admin
    .from('disciplinas')
    .select('id, nome')
    .eq('id', disciplinaId)
    .eq('escola_id', chamador.escola_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (erroDisc) throw new ErroHttp(500, 'Não foi possível ler a matéria.');
  if (!disciplina) throw new ErroHttp(404, 'Matéria não encontrada.');
  const { data: assunto, error: erroAssunto } = await admin
    .from('assuntos')
    .select('id, nome')
    .eq('id', assuntoId)
    .eq('disciplina_id', disciplina.id)
    .eq('escola_id', chamador.escola_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (erroAssunto) throw new ErroHttp(500, 'Não foi possível ler a submatéria.');
  if (!assunto) throw new ErroHttp(404, 'Submatéria não encontrada.');

  const cota = await consultarCota(admin, chamador.escola_id);
  if (cota.ativa && cota.uso_mes >= cota.limite_mes) {
    throw new ErroHttp(429, 'Limite de gerações do mês atingido. Fale com a direção.');
  }

  const serieBase = normalizarSerieBase(serie);
  const prazoFinal = Date.now() + PRAZO_TOTAL_MS;
  const partesFotos: PartesGemini = fotos.map((f) => ({ inlineData: f }));

  // Lotes de até 5 questões (objetivas primeiro), como no app antes da Fase 6.
  const lotes: Array<{ obj: number; disc: number }> = [];
  let objResto = qtdObj;
  let discResto = qtdDisc;
  while (objResto > 0 || discResto > 0) {
    const obj = Math.min(objResto, TAMANHO_LOTE);
    objResto -= obj;
    const disc = Math.min(discResto, TAMANHO_LOTE - obj);
    discResto -= disc;
    lotes.push({ obj, disc });
  }

  const questoes: QuestaoBruta[] = [];
  let descartadas = 0;
  let avisoGemini: string | null = null;
  let interrompida = false;
  let ultimoErro = '';

  for (const lote of lotes) {
    const anteriores = questoes
      .map((q, i) => `${i + 1}. ${q.enunciado.slice(0, 100).trim()}...`)
      .join('\n');
    const prompt = montarPromptGemini({
      nomeDisciplina: disciplina.nome,
      serie: serieBase,
      nomeAssunto: assunto.nome,
      obj: { total: lote.obj, ...distribuirDificuldade(lote.obj, dificuldade) },
      disc: { total: lote.disc, ...distribuirDificuldade(lote.disc, dificuldade) },
      temFotos: fotos.length > 0,
      textoBase: textoBase || undefined,
      enunciadosAnteriores: anteriores || undefined,
    });

    // Uma nova tentativa se o JSON vier quebrado.
    let analisado: { aviso?: unknown; questoes?: unknown } | null = null;
    for (let tentativa = 0; tentativa < 2 && !analisado; tentativa++) {
      if (prazoFinal - Date.now() < 5_000) break;
      try {
        const bruto = await chamarGemini(chave, [...partesFotos, { text: prompt }], true, prazoFinal);
        analisado = extrairJson(bruto) as { aviso?: unknown; questoes?: unknown };
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : String(e);
        analisado = null;
      }
    }
    if (!analisado) {
      interrompida = true;
      break;
    }
    if (!avisoGemini && typeof analisado.aviso === 'string' && analisado.aviso.trim()) {
      avisoGemini = analisado.aviso.trim().slice(0, 500);
    }
    for (const q of Array.isArray(analisado.questoes) ? analisado.questoes : []) {
      const norm = normalizarQuestao(q);
      if (norm) questoes.push(norm);
      else descartadas++;
    }
  }

  // Nunca devolve mais do que o pedido, em cada tipo.
  const objetivas = questoes.filter((q) => q.tipo === 'objetiva').slice(0, qtdObj);
  const discursivas = questoes.filter((q) => q.tipo === 'discursiva').slice(0, qtdDisc);
  const finais = [...objetivas, ...discursivas];

  await registrarGeracao(admin, chamador, {
    fotos: fotos.length,
    objetivas: qtdObj,
    discursivas: qtdDisc,
    erro: finais.length === 0 ? ultimoErro || 'nenhuma questão válida' : undefined,
  });

  if (finais.length === 0) {
    throw new ErroHttp(502, 'A IA não conseguiu gerar as questões agora. Tente novamente em instantes.');
  }

  return {
    questoes: finais,
    aviso: avisoGemini,
    descartadas,
    interrompida,
    contexto: { disciplina_nome: disciplina.nome, assunto_nome: assunto.nome },
  };
}

async function acaoTranscrever(corpo: Record<string, unknown>, chave: string) {
  const fotos = validarFotos(corpo.fotos);
  if (fotos.length === 0) throw new ErroHttp(400, 'Envie pelo menos uma foto.');
  try {
    const texto = await chamarGemini(
      chave,
      [
        ...fotos.map((f) => ({ inlineData: f })),
        {
          text: 'Transcreva fielmente todo o texto pedagógico, enunciados e exercícios contidos nas imagens enviadas, em português do Brasil.',
        },
      ],
      false,
      Date.now() + PRAZO_TOTAL_MS
    );
    return { texto: texto.trim() };
  } catch {
    throw new ErroHttp(502, 'Não foi possível ler o texto da imagem agora. Tente novamente.');
  }
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !chaveServico) throw new ErroHttp(500, 'Função sem configuração do servidor.');
    const admin = createClient(url, chaveServico, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Quem está chamando? (o JWT é validado pelo servidor de autenticação)
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) throw new ErroHttp(401, 'Sessão ausente. Entre novamente.');
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(jwt);
    if (erroSessao || !sessao.user) throw new ErroHttp(401, 'Sessão inválida. Entre novamente.');

    const { data: perfil, error: erroPerfil } = await admin
      .from('perfis')
      .select('id, escola_id, papel, ativo')
      .eq('id', sessao.user.id)
      .maybeSingle();
    if (erroPerfil) throw new ErroHttp(500, 'Não foi possível verificar o seu perfil.');
    if (!perfil || !perfil.ativo || !PAPEIS_PERMITIDOS.includes(perfil.papel)) {
      throw new ErroHttp(403, 'Você não tem permissão para esta ação.');
    }
    const chamador: Chamador = { id: perfil.id, escola_id: perfil.escola_id };

    let corpo: Record<string, unknown>;
    try {
      corpo = await req.json();
    } catch {
      throw new ErroHttp(400, 'Requisição inválida.');
    }

    if (corpo.acao === 'cota') {
      return resposta(await consultarCota(admin, chamador.escola_id));
    }

    const chaveGemini = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (corpo.acao === 'gerar' || corpo.acao === 'transcrever') {
      if (!chaveGemini) throw new ErroHttp(503, 'A IA ainda não foi configurada neste ambiente.');
      return resposta(
        corpo.acao === 'gerar'
          ? await acaoGerar(admin, chamador, corpo, chaveGemini)
          : await acaoTranscrever(corpo, chaveGemini)
      );
    }
    throw new ErroHttp(400, 'Ação desconhecida.');
  } catch (err) {
    if (err instanceof ErroHttp) return resposta({ erro: err.message }, err.status);
    console.error('gerar-questoes:', err);
    return resposta({ erro: 'Erro interno. Tente novamente.' }, 500);
  }
});
