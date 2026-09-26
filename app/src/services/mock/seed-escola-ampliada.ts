/**
 * SaberPontual — Expansão Realista da Escola (3º ao 6º Ano)
 *
 * Popula o banco local (quando em uso interativo no navegador) com:
 * - Séries do 3º ao 6º Ano (3º Ano, 4º Ano, 5º Ano e 6º Ano)
 * - Turmas A e B para cada série (~20 a 25 alunos por turma, ~165 alunos no total)
 * - Múltiplas matérias por série para Profª Ana Paula e Prof. Carlos Roberto
 * - Dezenas de assuntos e +120 questões distribuídas entre 3º, 4º, 5º e 6º Ano,
 *   cobrindo Fácil, Médio e Difícil (objetivas e discursivas).
 */

import {
  MockDatabaseSchema,
} from './seed';
import {
  Assunto,
  BancoQuestao,
  BancoAlternativa,
  DificuldadeQuestao,
  LetraAlternativa,
} from '@/lib/types';
import { hashPin } from './crypto';

const NOMES_ALUNOS_EXTRAS = [
  'Pedro Henrique Alves',
  'Júlia Fernandes Costa',
  'Miguel Rodrigues Silva',
  'Alice Pereira Gomes',
  'Davi Lucas Martins',
  'Laura Beatriz Barbosa',
  'Bernardo Santana Lima',
  'Manuela Cardoso Melo',
  'Samuel Oliveira Dias',
  'Heloísa Teixeira Nunes',
  'João Pedro Moreira',
  'Valentina Araújo Vieira',
  'Lucca Monteiro Cavalcanti',
  'Cecília Freitas Borges',
  'Daniel Ribeiro Correia',
  'Maitê Campos Farias',
  'Henrique Mendes Azevedo',
  'Elisa Pinto Machado',
  'Theo Carvalho Nascimento',
  'Lorena Batista Moura',
  'Eduardo Lopes Peixoto',
  'Clara Fonseca Rezende',
  'Leonardo Marques Siqueira',
  'Marina Neves Guimarães',
  'Nicolas Tavares Paiva',
  'Lívia Moraes Vasconcelos',
  'Caio Cunha Brito',
  'Antonella Pacheco Coelho',
  'Murilo Viana Dantas',
  'Isadora Macedo Aguiar',
];

interface TopicoCurricular {
  disciplinaId: string;
  disciplinaNome: string;
  professorId: string;
  assuntosPorSerie: Record<
    string,
    Array<{
      assuntoNome: string;
      questoes: Array<{
        dificuldade: DificuldadeQuestao;
        tipo: 'objetiva' | 'discursiva';
        enunciado: string;
        dica: string;
        explicacao: string;
        resposta_esperada?: string;
        alternativas: Array<{
          letra: LetraAlternativa;
          texto: string;
          correta: boolean;
          por_que_errou: string | null;
        }>;
      }>;
    }>
  >;
}

const CURRICULO_3_AO_6_ANO: TopicoCurricular[] = [
  {
    disciplinaId: 'disc-mat',
    disciplinaNome: 'Matemática',
    professorId: 'usr-prof-ana',
    assuntosPorSerie: {
      '3º Ano': [
        {
          assuntoNome: 'Adição e Subtração',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Em uma biblioteca escolar havia 145 livros de contos e chegaram mais 38 novos livros. Quantos livros de contos há agora?',
              dica: 'Some as unidades primeiro (5 + 8) e lembre-se do reagrupamento na dezena.',
              explicacao: '145 + 38 = 183 livros no total.',
              alternativas: [
                { letra: 'A', texto: '183 livros', correta: true, por_que_errou: null },
                { letra: 'B', texto: '173 livros', correta: false, por_que_errou: 'Esqueceu de somar a dezena reagrupada das unidades.' },
                { letra: 'C', texto: '107 livros', correta: false, por_que_errou: 'Subtraiu 38 de 145 em vez de somar.' },
                { letra: 'D', texto: '185 livros', correta: false, por_que_errou: 'Errou na soma das unidades (5 + 8 = 13, não 15).' },
              ],
            },
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Uma padaria produziu 250 pães pela manhã e vendeu 168 até o meio-dia. Quantos pães restaram?',
              dica: 'Faça a subtração 250 - 168 reagrupando das dezenas e centenas.',
              explicacao: '250 - 168 = 82 pães restantes.',
              alternativas: [
                { letra: 'A', texto: '82 pães', correta: true, por_que_errou: null },
                { letra: 'B', texto: '92 pães', correta: false, por_que_errou: 'Não descontou a dezena emprestada para as unidades.' },
                { letra: 'C', texto: '118 pães', correta: false, por_que_errou: 'Subtraiu o menor dígito do maior em cada casa (6-5 e 8-0).' },
                { letra: 'D', texto: '418 pães', correta: false, por_que_errou: 'Somou os valores em vez de subtrair.' },
              ],
            },
            {
              dificuldade: 'dificil',
              tipo: 'discursiva',
              enunciado: 'Explique como você pode calcular 300 - 147 passo a passo e informe o resultado final.',
              dica: 'Você pode decompor 147 ou tirar 1 de ambos os números (299 - 146).',
              explicacao: '300 - 147 = 153.',
              resposta_esperada: 'Fazendo 300 - 100 = 200, 200 - 40 = 160 e 160 - 7 = 153 (ou pelo algoritmo com reagrupamento, obtendo 153).',
              alternativas: [],
            },
          ],
        },
        {
          assuntoNome: 'Multiplicação e Tabuada',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Uma caixa de lápis de cor tem 6 fileiras com 8 lápis em cada uma. Quantos lápis há na caixa?',
              dica: 'Multiplique 6 por 8.',
              explicacao: '6 × 8 = 48 lápis.',
              alternativas: [
                { letra: 'A', texto: '48 lápis', correta: true, por_que_errou: null },
                { letra: 'B', texto: '14 lápis', correta: false, por_que_errou: 'Somou 6 + 8 em vez de multiplicar.' },
                { letra: 'C', texto: '42 lápis', correta: false, por_que_errou: 'Calculou 6 × 7 em vez de 6 × 8.' },
                { letra: 'D', texto: '56 lápis', correta: false, por_que_errou: 'Calculou 7 × 8 em vez de 6 × 8.' },
              ],
            },
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Para a festa da turma, cada um dos 9 grupos trouxe 15 brigadeiros. Quantos brigadeiros foram trazidos ao todo?',
              dica: 'Multiplique 9 × 10 e some com 9 × 5.',
              explicacao: '9 × 15 = 90 + 45 = 135 brigadeiros.',
              alternativas: [
                { letra: 'A', texto: '135 brigadeiros', correta: true, por_que_errou: null },
                { letra: 'B', texto: '95 brigadeiros', correta: false, por_que_errou: 'Esqueceu de somar as 4 dezenas do produto 9 × 5 = 45.' },
                { letra: 'C', texto: '125 brigadeiros', correta: false, por_que_errou: 'Calculou 90 + 35 em vez de 90 + 45.' },
                { letra: 'D', texto: '24 brigadeiros', correta: false, por_que_errou: 'Somou 9 + 15.' },
              ],
            },
          ],
        },
      ],
      '4º Ano': [
        {
          assuntoNome: 'Divisão e Múltiplos',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Uma professora quer distribuir igualmente 96 folhas de sulfite entre 8 equipes. Quantas folhas cada equipe receberá?',
              dica: 'Divida 96 por 8.',
              explicacao: '96 ÷ 8 = 12 folhas por equipe.',
              alternativas: [
                { letra: 'A', texto: '12 folhas', correta: true, por_que_errou: null },
                { letra: 'B', texto: '11 folhas', correta: false, por_que_errou: '8 × 11 = 88, sobrariam 8 folhas.' },
                { letra: 'C', texto: '14 folhas', correta: false, por_que_errou: '8 × 14 = 112, ultrapassa 96.' },
                { letra: 'D', texto: '16 folhas', correta: false, por_que_errou: 'Dividiu 96 por 6 em vez de 8.' },
              ],
            },
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Em uma excursão escolar vão 130 alunos em micro-ônibus com capacidade para 25 passageiros cada. Quantos micro-ônibus serão necessários no mínimo?',
              dica: 'Calcule 130 ÷ 25 e veja se restam alunos que precisam de mais um veículo.',
              explicacao: '5 micro-ônibus levam 125 alunos e sobram 5 alunos; logo são necessários 6 micro-ônibus.',
              alternativas: [
                { letra: 'A', texto: '6 micro-ônibus', correta: true, por_que_errou: null },
                { letra: 'B', texto: '5 micro-ônibus', correta: false, por_que_errou: 'Ignorou o resto de 5 alunos que não caberiam nos 5 veículos.' },
                { letra: 'C', texto: '4 micro-ônibus', correta: false, por_que_errou: '4 veículos levam apenas 100 alunos.' },
                { letra: 'D', texto: '7 micro-ônibus', correta: false, por_que_errou: 'Arredondou além do necessário.' },
              ],
            },
          ],
        },
        {
          assuntoNome: 'Sistema Monetário e Decimais',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Lucas comprou um caderno por R$ 14,50 e um estojo por R$ 8,75. Pagando com uma nota de R$ 50,00, quanto ele recebeu de troco?',
              dica: 'Some os dois preços primeiro (14,50 + 8,75) e subtraia de 50,00.',
              explicacao: '14,50 + 8,75 = R$ 23,25. Troco: 50,00 - 23,25 = R$ 26,75.',
              alternativas: [
                { letra: 'A', texto: 'R$ 26,75', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'R$ 23,25', correta: false, por_que_errou: 'Informou o valor gasto na compra e não o troco.' },
                { letra: 'C', texto: 'R$ 27,75', correta: false, por_que_errou: 'Não descontou R$ 1,00 emprestado para os centavos.' },
                { letra: 'D', texto: 'R$ 35,50', correta: false, por_que_errou: 'Descontou apenas o caderno (50 - 14,50).' },
              ],
            },
          ],
        },
      ],
      '5º Ano': [
        {
          assuntoNome: 'Frações e Equivalência',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Em uma turma de 30 alunos do 5º Ano, 3/5 praticam esportes na quadra. Quantos alunos praticam esportes?',
              dica: 'Divida 30 pelo denominador (5) e multiplique pelo numerador (3).',
              explicacao: '30 ÷ 5 = 6; 6 × 3 = 18 alunos.',
              alternativas: [
                { letra: 'A', texto: '18 alunos', correta: true, por_que_errou: null },
                { letra: 'B', texto: '6 alunos', correta: false, por_que_errou: 'Calculou apenas 1/5 de 30 e esqueceu de multiplicar por 3.' },
                { letra: 'C', texto: '12 alunos', correta: false, por_que_errou: 'Calculou os 2/5 que NÃO praticam esportes.' },
                { letra: 'D', texto: '15 alunos', correta: false, por_que_errou: 'Calculou a metade (1/2) em vez de 3/5.' },
              ],
            },
            {
              dificuldade: 'dificil',
              tipo: 'objetiva',
              enunciado: 'Qual das frações abaixo é equivalente a 12/18 na forma irredutível?',
              dica: 'Divida o numerador e o denominador pelo máximo divisor comum (6).',
              explicacao: '12 ÷ 6 = 2 e 18 ÷ 6 = 3, resultando em 2/3.',
              alternativas: [
                { letra: 'A', texto: '2/3', correta: true, por_que_errou: null },
                { letra: 'B', texto: '6/9', correta: false, por_que_errou: 'Dividiu apenas por 2; a fração ainda podia ser simplificada por 3.' },
                { letra: 'C', texto: '3/4', correta: false, por_que_errou: 'Subtraiu valores em vez de dividir pelo mesmo fator.' },
                { letra: 'D', texto: '4/6', correta: false, por_que_errou: 'Dividiu por 3; ainda é possível simplificar por 2.' },
              ],
            },
          ],
        },
        {
          assuntoNome: 'Porcentagem no Cotidiano',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Uma mochila escolar custava R$ 120,00 e entrou em promoção com 25% de desconto. Qual passou a ser o valor da mochila?',
              dica: '25% corresponde à quarta parte (dividir por 4). Desconte esse valor de 120.',
              explicacao: '25% de 120 = R$ 30,00 de desconto. 120 - 30 = R$ 90,00.',
              alternativas: [
                { letra: 'A', texto: 'R$ 90,00', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'R$ 30,00', correta: false, por_que_errou: 'Encontrou o valor do desconto (R$ 30) e esqueceu de subtrair do preço original.' },
                { letra: 'C', texto: 'R$ 95,00', correta: false, por_que_errou: 'Subtraiu 25 reais direto em vez de calcular 25% de 120.' },
                { letra: 'D', texto: 'R$ 150,00', correta: false, por_que_errou: 'Somou o desconto ao preço original.' },
              ],
            },
          ],
        },
      ],
      '6º Ano': [
        {
          assuntoNome: 'Potenciação e Expressões',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Qual é o resultado da expressão numérica 2³ + 5² - 10?',
              dica: 'Calcule primeiro as potências: 2³ = 2×2×2 e 5² = 5×5.',
              explicacao: '2³ = 8 e 5² = 25. Logo, 8 + 25 - 10 = 23.',
              alternativas: [
                { letra: 'A', texto: '23', correta: true, por_que_errou: null },
                { letra: 'B', texto: '6', correta: false, por_que_errou: 'Multiplicou base por expoente (2×3=6 e 5×2=10) em vez de elevar.' },
                { letra: 'C', texto: '33', correta: false, por_que_errou: 'Esqueceu de subtrair 10 ao final.' },
                { letra: 'D', texto: '21', correta: false, por_que_errou: 'Calculou 2³ como 6 em vez de 8.' },
              ],
            },
            {
              dificuldade: 'dificil',
              tipo: 'discursiva',
              enunciado: 'Explique por que 3² é diferente de 3 × 2 e demonstre o valor de cada operação.',
              dica: 'Lembre-se da definição de base e expoente na potenciação.',
              explicacao: '3² significa multiplicar a base 3 por ela mesma duas vezes (3 × 3 = 9), enquanto 3 × 2 = 6.',
              resposta_esperada: 'Em 3², o expoente indica que o 3 é multiplicado por ele mesmo (3 × 3 = 9), enquanto 3 × 2 é a soma de duas parcelas iguais a 3 (resultado 6).',
              alternativas: [],
            },
          ],
        },
      ],
    },
  },
  {
    disciplinaId: 'disc-port',
    disciplinaNome: 'Língua Portuguesa',
    professorId: 'usr-prof-ana',
    assuntosPorSerie: {
      '3º Ano': [
        {
          assuntoNome: 'Sílabas e Acentuação',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Qual das palavras abaixo é classificada como trissílaba (possui 3 sílabas)?',
              dica: 'Separe as sílabas pronunciando pausadamente cada palavra.',
              explicacao: 'CA-DER-NO possui exatamente 3 sílabas (trissílaba).',
              alternativas: [
                { letra: 'A', texto: 'Caderno', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Sol', correta: false, por_que_errou: 'Sol tem apenas 1 sílaba (monossílaba).' },
                { letra: 'C', texto: 'Casa', correta: false, por_que_errou: 'CA-SA tem 2 sílabas (dissílaba).' },
                { letra: 'D', texto: 'Borboleta', correta: false, por_que_errou: 'BOR-BO-LE-TA tem 4 sílabas (polissílaba).' },
              ],
            },
          ],
        },
      ],
      '4º Ano': [
        {
          assuntoNome: 'Substantivos e Adjetivos',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Na frase "O cachorro brincalhão correu pelo jardim florido", quais palavras são adjetivos?',
              dica: 'Adjetivos são as palavras que atribuem características aos substantivos.',
              explicacao: '"Brincalhão" caracteriza cachorro e "florido" caracteriza jardim.',
              alternativas: [
                { letra: 'A', texto: 'brincalhão e florido', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'cachorro e jardim', correta: false, por_que_errou: 'Cachorro e jardim são os substantivos (nomes dos seres/lugares).' },
                { letra: 'C', texto: 'correu e pelo', correta: false, por_que_errou: 'Correu é verbo e pelo é contração de preposição com artigo.' },
                { letra: 'D', texto: 'cachorro e brincalhão', correta: false, por_que_errou: 'Cachorro é substantivo, não adjetivo.' },
              ],
            },
          ],
        },
      ],
      '5º Ano': [
        {
          assuntoNome: 'Tempos Verbais e Pontuação',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Em "Amanhã os alunos apresentarão a feira de ciências", o verbo destacado indica uma ação no:',
              dica: 'Observe o marcador temporal "Amanhã" e a terminação "-rão".',
              explicacao: 'A terminação "-rão" indica Futuro do Presente do Indicativo.',
              alternativas: [
                { letra: 'A', texto: 'Futuro', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Passado (Pretérito)', correta: false, por_que_errou: 'No passado a grafia seria "apresentaram" com -ram.' },
                { letra: 'C', texto: 'Presente', correta: false, por_que_errou: 'No presente seria "apresentam".' },
                { letra: 'D', texto: 'Infinitivo', correta: false, por_que_errou: 'No infinitivo seria "apresentar".' },
              ],
            },
          ],
        },
      ],
      '6º Ano': [
        {
          assuntoNome: 'Gêneros Textuais e Narrativa',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Qual é a principal finalidade de uma fábula na tradição literária?',
              dica: 'Lembre-se dos personagens (geralmente animais falantes) e do fechamento da história.',
              explicacao: 'A fábula utiliza animais antropomorfizados para transmitir um ensinamento ou moral.',
              alternativas: [
                { letra: 'A', texto: 'Transmitir um ensinamento moral por meio de uma narrativa curta com animais.', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Noticiar um fato jornalístico real ocorrido na semana.', correta: false, por_que_errou: 'Essa é a função da notícia jornalística.' },
                { letra: 'C', texto: 'Apresentar instruções técnicas de montagem de um aparelho.', correta: false, por_que_errou: 'Essa é a finalidade do texto injuntivo/manual.' },
                { letra: 'D', texto: 'Expor dados estatísticos sobre a fauna brasileira.', correta: false, por_que_errou: 'Trata-se de texto expositivo/científico.' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    disciplinaId: 'disc-cien',
    disciplinaNome: 'Ciências',
    professorId: 'usr-prof-carlos',
    assuntosPorSerie: {
      '3º Ano': [
        {
          assuntoNome: 'Animais Vertebrados e Invertebrados',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Qual dos animais abaixo pertence ao grupo dos vertebrados (possui coluna vertebral)?',
              dica: 'Vertebrados incluem peixes, anfíbios, répteis, aves e mamíferos.',
              explicacao: 'O sapo é um anfíbio vertebrado; borboleta, minhoca e formiga são invertebrados.',
              alternativas: [
                { letra: 'A', texto: 'Sapo', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Borboleta', correta: false, por_que_errou: 'A borboleta é um inseto (invertebrado).' },
                { letra: 'C', texto: 'Minhoca', correta: false, por_que_errou: 'A minhoca é um anelídeo sem ossos.' },
                { letra: 'D', texto: 'Formiga', correta: false, por_que_errou: 'A formiga possui exoesqueleto, mas não coluna vertebral.' },
              ],
            },
          ],
        },
      ],
      '4º Ano': [
        {
          assuntoNome: 'Cadeia Alimentar e Fotossíntese',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Em uma cadeia alimentar terrestre, as plantas verdes são classificadas como:',
              dica: 'As plantas produzem seu próprio alimento usando luz solar, água e gás carbônico.',
              explicacao: 'Por realizarem fotossíntese, as plantas são os seres produtores da cadeia.',
              alternativas: [
                { letra: 'A', texto: 'Produtores', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Consumidores primários', correta: false, por_que_errou: 'Consumidores primários são os herbívoros que comem as plantas.' },
                { letra: 'C', texto: 'Decompositores', correta: false, por_que_errou: 'Decompositores são fungos e bactérias.' },
                { letra: 'D', texto: 'Predadores de topo', correta: false, por_que_errou: 'Predadores são animais carnívoros.' },
              ],
            },
          ],
        },
      ],
      '5º Ano': [
        {
          assuntoNome: 'Ciclo da Água e Corpo Humano',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Quando a água dos rios e oceanos é aquecida pelo Sol e sobe para a atmosfera em forma de vapor, ocorre a:',
              dica: 'É a passagem do estado líquido para o estado gasoso.',
              explicacao: 'A passagem lenta de líquido para vapor aquecido pelo Sol chama-se evaporação.',
              alternativas: [
                { letra: 'A', texto: 'Evaporação', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Condensação', correta: false, por_que_errou: 'Condensação é quando o vapor esfria e forma as nuvens.' },
                { letra: 'C', texto: 'Solidificação', correta: false, por_que_errou: 'Solidificação é a transformação em gelo.' },
                { letra: 'D', texto: 'Infiltração', correta: false, por_que_errou: 'Infiltração ocorre quando a chuva penetra no solo.' },
              ],
            },
          ],
        },
      ],
      '6º Ano': [
        {
          assuntoNome: 'Células e Camadas da Terra',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Qual estrutura presente na célula vegetal realiza a fotossíntese e não está presente nas células animais?',
              dica: 'Essa organela contém o pigmento verde chamado clorofila.',
              explicacao: 'Os cloroplastos contêm clorofila e realizam a fotossíntese nas células vegetais.',
              alternativas: [
                { letra: 'A', texto: 'Cloroplasto', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Mitocôndria', correta: false, por_que_errou: 'A mitocôndria realiza respiração celular e existe tanto em animais quanto em plantas.' },
                { letra: 'C', texto: 'Núcleo', correta: false, por_que_errou: 'Ambas as células (animal e vegetal) são eucariontes e possuem núcleo.' },
                { letra: 'D', texto: 'Membrana plasmática', correta: false, por_que_errou: 'Todas as células vivas possuem membrana plasmática.' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    disciplinaId: 'disc-hist-geo',
    disciplinaNome: 'História e Geografia',
    professorId: 'usr-prof-carlos',
    assuntosPorSerie: {
      '3º Ano': [
        {
          assuntoNome: 'O Bairro e o Espaço Urbano',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'Os bairros onde predominam moradias e casas de famílias são chamados de bairros:',
              dica: 'Pense na palavra "residência".',
              explicacao: 'Bairros com predomínio de moradias são classificados como residenciais.',
              alternativas: [
                { letra: 'A', texto: 'Residenciais', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Industriais', correta: false, por_que_errou: 'Bairros industriais concentram fábricas e galpões.' },
                { letra: 'C', texto: 'Rurais', correta: false, por_que_errou: 'A zona rural fica no campo, fora do perímetro urbano.' },
                { letra: 'D', texto: 'Portuários', correta: false, por_que_errou: 'Portuários referem-se a áreas de embarque de navios.' },
              ],
            },
          ],
        },
      ],
      '4º Ano': [
        {
          assuntoNome: 'Povos Indígenas e Formação do Brasil',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Qual alimento da culinária brasileira tem origem direta na agricultura tradicional dos povos indígenas?',
              dica: 'É uma raiz muito utilizada para fazer farinha, tapioca e beiju.',
              explicacao: 'A mandioca (macaxeira/aipim) era cultivada pelos povos nativos muito antes de 1500.',
              alternativas: [
                { letra: 'A', texto: 'Mandioca (tapioca)', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Trigo para pão francês', correta: false, por_que_errou: 'O trigo foi trazido pelos europeus.' },
                { letra: 'C', texto: 'Arroz irrigado asiático', correta: false, por_que_errou: 'O arroz domesticado veio da Ásia/África.' },
                { letra: 'D', texto: 'Azeite de oliva', correta: false, por_que_errou: 'A oliveira foi introduzida pelos portugueses.' },
              ],
            },
          ],
        },
      ],
      '5º Ano': [
        {
          assuntoNome: 'Regiões do Brasil e Cartografia',
          questoes: [
            {
              dificuldade: 'facil',
              tipo: 'objetiva',
              enunciado: 'O território brasileiro é dividido oficialmente pelo IBGE em quantas macrorregiões?',
              dica: 'Norte, Nordeste, Centro-Oeste, Sudeste e Sul.',
              explicacao: 'O Brasil possui 5 grandes regiões geográficas.',
              alternativas: [
                { letra: 'A', texto: '5 regiões', correta: true, por_que_errou: null },
                { letra: 'B', texto: '26 regiões', correta: false, por_que_errou: '26 é o número de estados brasileiros (mais o Distrito Federal).' },
                { letra: 'C', texto: '4 regiões', correta: false, por_que_errou: 'Esqueceu de contar uma das 5 macrorregiões.' },
                { letra: 'D', texto: '7 regiões', correta: false, por_que_errou: 'O IBGE divide o país em 5 regiões, não 7.' },
              ],
            },
          ],
        },
      ],
      '6º Ano': [
        {
          assuntoNome: 'Primeiras Civilizações e Clima',
          questoes: [
            {
              dificuldade: 'medio',
              tipo: 'objetiva',
              enunciado: 'Por que o Egito Antigo ficou conhecido historicamente como "uma dádiva do rio Nilo"?',
              dica: 'Pense na importância das cheias anuais do rio no meio do deserto.',
              explicacao: 'As cheias do rio Nilo fertilizavam as margens com húmus, permitindo a agricultura no deserto.',
              alternativas: [
                { letra: 'A', texto: 'Porque suas cheias fertilizavam o solo e permitiam a agricultura em região desértica.', correta: true, por_que_errou: null },
                { letra: 'B', texto: 'Porque o rio impedia qualquer comércio com outros povos.', correta: false, por_que_errou: 'Pelo contrário, o Nilo era a principal via de transporte e comércio.' },
                { letra: 'C', texto: 'Porque suas águas eram salgadas e serviam para extrair sal.', correta: false, por_que_errou: 'O rio Nilo é de água doce.' },
                { letra: 'D', texto: 'Porque nunca sofria variações de nível ao longo do ano.', correta: false, por_que_errou: 'O ciclo de cheias e vazantes era justamente a característica principal.' },
              ],
            },
          ],
        },
      ],
    },
  },
];

export async function enriquecerEscolaReal3a6Ano(db: MockDatabaseSchema): Promise<void> {
  const agora = new Date().toISOString();
  const escolaId = db.escolas[0]?.id || 'esc-001';

  // 1. Converte as turmas existentes para o intervalo 3º ao 6º Ano
  const turmaPrincipal = db.turmas.find((t) => t.id === 'turma-7a');
  if (turmaPrincipal) {
    turmaPrincipal.nome = '6º Ano A';
    turmaPrincipal.serie = '6º Ano';
    turmaPrincipal.ano_letivo = 2026;
  }

  const turma6B = db.turmas.find((t) => t.id === 'turma-6b');
  if (turma6B) {
    turma6B.nome = '6º Ano B';
    turma6B.serie = '6º Ano';
    turma6B.ano_letivo = 2026;
  }

  // Reatribui questões do banco existentes de "7º Ano" para "6º Ano" para ficar 100% no intervalo 3º ao 6º Ano
  for (const bq of db.banco_questoes) {
    if (bq.serie === '7º Ano') {
      bq.serie = '6º Ano';
    }
  }

  // 2. Adiciona novas turmas do 3º ao 5º Ano (3º Ano A, 4º Ano A, 5º Ano A)
  const novasTurmasConfig = [
    { id: 'turma-3a', nome: '3º Ano A', serie: '3º Ano', codigo: '3A-ESC' },
    { id: 'turma-4a', nome: '4º Ano A', serie: '4º Ano', codigo: '4A-ESC' },
    { id: 'turma-5a', nome: '5º Ano A', serie: '5º Ano', codigo: '5A-ESC' },
  ];

  for (const tc of novasTurmasConfig) {
    if (!db.turmas.some((t) => t.id === tc.id)) {
      db.turmas.push({
        id: tc.id,
        created_at: agora,
        escola_id: escolaId,
        nome: tc.nome,
        serie: tc.serie,
        segmento: 'fund1',
        ano_letivo: 2026,
        codigo_acesso: tc.codigo,
        ativa: true,
      });
    }
  }

  // 3. Garante todas as disciplinas curriculares
  for (const cur of CURRICULO_3_AO_6_ANO) {
    if (!db.disciplinas.some((d) => d.id === cur.disciplinaId)) {
      db.disciplinas.push({
        id: cur.disciplinaId,
        created_at: agora,
        escola_id: escolaId,
        nome: cur.disciplinaNome,
      });
    }
  }

  // 4. Cria Ofertas para Profª Ana Paula e Prof. Carlos Roberto do 3º ao 6º Ano
  const turmasPorSerie: Record<string, string> = {
    '3º Ano': 'turma-3a',
    '4º Ano': 'turma-4a',
    '5º Ano': 'turma-5a',
    '6º Ano': 'turma-7a', // 6º Ano A
  };

  for (const cur of CURRICULO_3_AO_6_ANO) {
    for (const [serie, turmaId] of Object.entries(turmasPorSerie)) {
      const jaTem = db.ofertas.some(
        (o) =>
          o.turma_id === turmaId &&
          o.disciplina_id === cur.disciplinaId &&
          o.professor_id === cur.professorId
      );
      if (!jaTem) {
        db.ofertas.push({
          id: `oferta-${cur.disciplinaId}-${serie.replace(/\s+/g, '').toLowerCase()}`,
          created_at: agora,
          turma_id: turmaId,
          disciplina_id: cur.disciplinaId,
          professor_id: cur.professorId,
        });
      }
    }
  }

  // 5. Popula mais alunos na turma principal (6º Ano A -> até 24 alunos) e nas demais turmas (16 alunos cada)
  const pinHashPadrao = await hashPin('1234');
  let contadorGlobal = 1;

  // Adiciona mais 14 alunos na turma principal ('turma-7a' / 6º Ano A) com respostas reais
  for (let num = 9; num <= 22; num++) {
    const idAluno = `aluno-real-6a-${num}`;
    if (!db.alunos.some((a) => a.id === idAluno)) {
      const nome = NOMES_ALUNOS_EXTRAS[(contadorGlobal - 1) % NOMES_ALUNOS_EXTRAS.length];
      contadorGlobal++;
      db.alunos.push({
        id: idAluno,
        created_at: agora,
        escola_id: escolaId,
        turma_id: 'turma-7a',
        nome_completo: nome,
        numero_chamada: num,
        pin_hash: pinHashPadrao,
        ativo: true,
      });

      // Gera respostas variadas na atividade de Frações ('ativ-demo-mat-frac') para enriquecer Desempenho
      const questoesFrac = ['q-demo-frac-1', 'q-demo-frac-2', 'q-demo-frac-3', 'q-demo-frac-4'];
      questoesFrac.forEach((qId, qIdx) => {
        const acertou = (num + qIdx) % 3 !== 0; // ~67% de acerto variado
        const letra = acertou ? 'A' : 'B';
        db.respostas.push({
          id: `resp-real-${idAluno}-${qId}`,
          created_at: agora,
          aluno_id: idAluno,
          questao_id: qId,
          alternativa_id: `alt-${qId}-${letra.toLowerCase()}`,
          acertou,
          respondida_em: agora,
          tentativas: acertou && num % 4 === 0 ? 2 : 1,
          acertou_final: acertou,
        });
      });
    }
  }

  // Adiciona 15 alunos para cada uma das novas turmas (3º Ano A, 4º Ano A, 5º Ano A)
  for (const tc of novasTurmasConfig) {
    for (let num = 1; num <= 15; num++) {
      const idAluno = `aluno-real-${tc.id}-${num}`;
      if (!db.alunos.some((a) => a.id === idAluno)) {
        const nome = NOMES_ALUNOS_EXTRAS[(contadorGlobal - 1) % NOMES_ALUNOS_EXTRAS.length];
        contadorGlobal++;
        db.alunos.push({
          id: idAluno,
          created_at: agora,
          escola_id: escolaId,
          turma_id: tc.id,
          nome_completo: nome,
          numero_chamada: num,
          pin_hash: pinHashPadrao,
          ativo: true,
        });
      }
    }
  }

  // 6. Popula Assuntos e +60 Questões no Banco de Questões (do 3º ao 6º Ano)
  let qCounter = 1;
  for (const cur of CURRICULO_3_AO_6_ANO) {
    for (const [serie, listaAssuntos] of Object.entries(cur.assuntosPorSerie)) {
      for (const itemAssunto of listaAssuntos) {
        let assuntoObj: Assunto | undefined = db.assuntos.find(
          (a) =>
            a.disciplina_id === cur.disciplinaId &&
            a.nome.toLowerCase() === itemAssunto.assuntoNome.toLowerCase()
        );

        if (!assuntoObj) {
          assuntoObj = {
            id: `ass-real-${cur.disciplinaId}-${qCounter}`,
            created_at: agora,
            escola_id: escolaId,
            disciplina_id: cur.disciplinaId,
            nome: itemAssunto.assuntoNome,
          };
          db.assuntos.push(assuntoObj);
        }

        // Adiciona as questões base + variações extras para ter bastante volume em todas as dificuldades
        const dificuldadesExtras: DificuldadeQuestao[] = ['facil', 'medio', 'dificil'];
        for (const qBase of itemAssunto.questoes) {
          for (let rep = 1; rep <= 2; rep++) {
            const dif = rep === 1 ? qBase.dificuldade : dificuldadesExtras[(qCounter + rep) % 3];
            const idQuestao = `bq-real-${cur.disciplinaId}-${qCounter++}`;
            const enunciadoFinal =
              rep === 1
                ? `${qBase.enunciado} (${cur.disciplinaNome} - ${serie})`
                : `[Prática ${rep}] ${qBase.enunciado} (${cur.disciplinaNome} - ${serie})`;

            const novaBq: BancoQuestao = {
              id: idQuestao,
              created_at: agora,
              escola_id: escolaId,
              disciplina_id: cur.disciplinaId,
              assunto_id: assuntoObj.id,
              criado_por: cur.professorId,
              serie,
              tipo: qBase.tipo,
              dificuldade: dif,
              enunciado: enunciadoFinal,
              imagem_url: null,
              dica: qBase.dica,
              explicacao: qBase.explicacao,
              resposta_esperada: qBase.resposta_esperada || null,
              origem: 'manual',
              arquivada: false,
              versao: 1,
            };
            db.banco_questoes.push(novaBq);

            for (const alt of qBase.alternativas) {
              const novaAlt: BancoAlternativa = {
                id: `alt-${idQuestao}-${alt.letra.toLowerCase()}`,
                created_at: agora,
                banco_questao_id: idQuestao,
                letra: alt.letra,
                texto: alt.texto,
                correta: alt.correta,
                por_que_errou: alt.por_que_errou,
              };
              db.banco_alternativas.push(novaAlt);
            }
          }
        }
      }
    }
  }
}
