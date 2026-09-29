/**
 * SaberPontual — Expansão Realista da Escola (1 Mês de Funcionamento Pleno)
 *
 * Foco Central na Profª Ana Paula no 6º Ano:
 * - Matemática 6ºA: 5 atividades ativas (Inteiros, Álgebra, Geometria, Simulado, Frações) + 1 Rascunho
 * - Língua Portuguesa 6ºA: 4 atividades ativas (Gêneros Textuais, Interpretação, Ortografia, Produção c/ Discursiva Pendente)
 * - Arte 6ºA: 2 atividades ativas (Arte Rupestre e Teoria das Cores pendente para Lucas)
 * - Turma 6ºB: atividades concluídas em Matemática e Português com rendimento comparativo (~67%)
 * - Prof. Carlos Roberto: Ciências, História, Geografia e Língua Inglesa com discursiva pendente em História
 * - Calibração precisa de percentuais reais da escola brasileira de Ensino Fundamental
 */

import { MockDatabaseSchema } from './seed';
import {
  DificuldadeQuestao,
  LetraAlternativa,
  Atividade,
  Aviso,
  Perfil,
  TipoQuestao,
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

export async function enriquecerEscolaReal3a6Ano(db: MockDatabaseSchema): Promise<void> {
  const escolaId = db.escolas[0]?.id || 'esc-001';

  // ============================================================================
  // 1. CORPO DOCENTE: ANA PAULA E CARLOS ROBERTO
  // ============================================================================
  const profAna = db.perfis.find((p) => p.id === 'usr-prof-ana');
  if (profAna) {
    profAna.ativo = true;
    profAna.nome = 'Profª Ana Paula';
    profAna.email = 'ana@demo.com';
    db.credenciais['ana@demo.com'] = 'demo123';
  }

  const profCarlos = db.perfis.find((p) => p.id === 'usr-prof-carlos');
  if (profCarlos) {
    profCarlos.ativo = true;
    profCarlos.nome = 'Prof. Carlos Roberto';
    profCarlos.email = 'carlos@demo.com';
    db.credenciais['carlos@demo.com'] = 'demo123';
  }

  const outrosProfessoresInstitucionais: Perfil[] = [
    {
      id: 'usr-prof-mariana',
      created_at: '2026-08-01T08:00:00Z',
      escola_id: escolaId,
      nome: 'Profª Mariana Albuquerque',
      papel: 'professor',
      ativo: true,
      email: 'mariana@demo.com',
    },
    {
      id: 'usr-prof-fernando',
      created_at: '2026-08-01T08:00:00Z',
      escola_id: escolaId,
      nome: 'Prof. Fernando Rocha',
      papel: 'professor',
      ativo: true,
      email: 'fernando@demo.com',
    },
  ];

  for (const prof of outrosProfessoresInstitucionais) {
    if (!db.perfis.some((p) => p.id === prof.id)) {
      db.perfis.push(prof);
    }
    if (prof.email) {
      db.credenciais[prof.email] = 'demo123';
    }
  }

  // ============================================================================
  // 2. DISCIPLINAS DO CURRÍCULO COMPLETO (7 MATÉRIAS)
  // ============================================================================
  const disciplinasNecessarias: Array<{ id: string; nome: string }> = [
    { id: 'disc-mat', nome: 'Matemática' },
    { id: 'disc-port', nome: 'Língua Portuguesa' },
    { id: 'disc-cien', nome: 'Ciências' },
    { id: 'disc-hist', nome: 'História' },
    { id: 'disc-geo', nome: 'Geografia' },
    { id: 'disc-ing', nome: 'Língua Inglesa' },
    { id: 'disc-art', nome: 'Arte' },
  ];

  for (const disc of disciplinasNecessarias) {
    const jaExiste = db.disciplinas.find((d) => d.id === disc.id);
    if (!jaExiste) {
      db.disciplinas.push({
        id: disc.id,
        created_at: '2026-08-01T08:00:00Z',
        escola_id: escolaId,
        nome: disc.nome,
      });
    }
  }

  // ============================================================================
  // 3. TURMAS (DO 3º AO 6º ANO)
  // ============================================================================
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

  const outrasTurmas = [
    { id: 'turma-3a', nome: '3º Ano A', serie: '3º Ano', codigo: '3A-ESC' },
    { id: 'turma-4a', nome: '4º Ano A', serie: '4º Ano', codigo: '4A-ESC' },
    { id: 'turma-5a', nome: '5º Ano A', serie: '5º Ano', codigo: '5A-ESC' },
  ];

  for (const tc of outrasTurmas) {
    if (!db.turmas.some((t) => t.id === tc.id)) {
      db.turmas.push({
        id: tc.id,
        created_at: '2026-08-01T08:00:00Z',
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

  // ============================================================================
  // 4. OFERTAS: FOCO NA PROFª ANA PAULA NO 6º ANO (E CARLOS ROBERTO)
  // ============================================================================
  const ofertasConfig: Array<{ id: string; turmaId: string; disciplinaId: string; professorId: string }> = [
    // 6º Ano A (turma-7a) — Profª Ana Paula com Matemática, Português e Arte
    { id: 'oferta-mat-7a', turmaId: 'turma-7a', disciplinaId: 'disc-mat', professorId: 'usr-prof-ana' },
    { id: 'oferta-port-7a', turmaId: 'turma-7a', disciplinaId: 'disc-port', professorId: 'usr-prof-ana' },
    { id: 'oferta-art-7a', turmaId: 'turma-7a', disciplinaId: 'disc-art', professorId: 'usr-prof-ana' },

    // 6º Ano A — Prof. Carlos Roberto com Ciências, História, Geografia e Inglês
    { id: 'oferta-cien-7a', turmaId: 'turma-7a', disciplinaId: 'disc-cien', professorId: 'usr-prof-carlos' },
    { id: 'oferta-hist-7a', turmaId: 'turma-7a', disciplinaId: 'disc-hist', professorId: 'usr-prof-carlos' },
    { id: 'oferta-geo-7a', turmaId: 'turma-7a', disciplinaId: 'disc-geo', professorId: 'usr-prof-carlos' },
    { id: 'oferta-ing-7a', turmaId: 'turma-7a', disciplinaId: 'disc-ing', professorId: 'usr-prof-carlos' },

    // 6º Ano B (turma-6b) — Profª Ana Paula com Matemática e Português
    { id: 'oferta-mat-6b', turmaId: 'turma-6b', disciplinaId: 'disc-mat', professorId: 'usr-prof-ana' },
    { id: 'oferta-port-6b', turmaId: 'turma-6b', disciplinaId: 'disc-port', professorId: 'usr-prof-ana' },
    { id: 'oferta-cien-6b', turmaId: 'turma-6b', disciplinaId: 'disc-cien', professorId: 'usr-prof-carlos' },
    { id: 'oferta-hist-6b', turmaId: 'turma-6b', disciplinaId: 'disc-hist', professorId: 'usr-prof-carlos' },
    { id: 'oferta-geo-6b', turmaId: 'turma-6b', disciplinaId: 'disc-geo', professorId: 'usr-prof-carlos' },

    // 5º Ano A (turma-5a)
    { id: 'oferta-mat-5a', turmaId: 'turma-5a', disciplinaId: 'disc-mat', professorId: 'usr-prof-ana' },
    { id: 'oferta-port-5a', turmaId: 'turma-5a', disciplinaId: 'disc-port', professorId: 'usr-prof-ana' },
    { id: 'oferta-cien-5a', turmaId: 'turma-5a', disciplinaId: 'disc-cien', professorId: 'usr-prof-carlos' },

    // 4º Ano A (turma-4a)
    { id: 'oferta-mat-4a', turmaId: 'turma-4a', disciplinaId: 'disc-mat', professorId: 'usr-prof-ana' },
    { id: 'oferta-port-4a', turmaId: 'turma-4a', disciplinaId: 'disc-port', professorId: 'usr-prof-ana' },

    // 3º Ano A (turma-3a)
    { id: 'oferta-mat-3a', turmaId: 'turma-3a', disciplinaId: 'disc-mat', professorId: 'usr-prof-ana' },
    { id: 'oferta-port-3a', turmaId: 'turma-3a', disciplinaId: 'disc-port', professorId: 'usr-prof-ana' },
  ];

  for (const ofc of ofertasConfig) {
    const existente = db.ofertas.find((o) => o.id === ofc.id);
    if (existente) {
      existente.professor_id = ofc.professorId;
      existente.disciplina_id = ofc.disciplinaId;
      existente.turma_id = ofc.turmaId;
    } else {
      db.ofertas.push({
        id: ofc.id,
        created_at: '2026-08-01T08:00:00Z',
        turma_id: ofc.turmaId,
        disciplina_id: ofc.disciplinaId,
        professor_id: ofc.professorId,
      });
    }
  }

  // ============================================================================
  // 5. POPULAR ALUNOS NAS TURMAS
  // ============================================================================
  const pinHashPadrao = await hashPin('1234');
  let contadorGlobal = 1;

  for (let num = 9; num <= 22; num++) {
    const idAluno = `aluno-real-6a-${num}`;
    if (!db.alunos.some((a) => a.id === idAluno)) {
      const nome = NOMES_ALUNOS_EXTRAS[(contadorGlobal - 1) % NOMES_ALUNOS_EXTRAS.length];
      contadorGlobal++;
      db.alunos.push({
        id: idAluno,
        created_at: '2026-08-01T08:00:00Z',
        escola_id: escolaId,
        turma_id: 'turma-7a',
        nome_completo: nome,
        numero_chamada: num,
        pin_hash: pinHashPadrao,
        ativo: true,
      });
    }
  }

  for (const tc of [...outrasTurmas, { id: 'turma-6b', nome: '6º Ano B' }]) {
    for (let num = 1; num <= 12; num++) {
      const idAluno = `aluno-real-${tc.id}-${num}`;
      if (!db.alunos.some((a) => a.id === idAluno)) {
        const nome = NOMES_ALUNOS_EXTRAS[(contadorGlobal - 1) % NOMES_ALUNOS_EXTRAS.length];
        contadorGlobal++;
        db.alunos.push({
          id: idAluno,
          created_at: '2026-08-01T08:00:00Z',
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

  // ============================================================================
  // 6. LINHA DO TEMPO AMPLIADA DA PROFª ANA PAULA NO 6º ANO
  // ============================================================================
  // Atualiza atividades legadas
  const ativMat1 = db.atividades.find((a) => a.id === 'ativ-mat-01');
  if (ativMat1) {
    ativMat1.oferta_id = 'oferta-mat-7a';
    ativMat1.criado_por = 'usr-prof-ana';
    ativMat1.status = 'encerrada';
    ativMat1.prazo = '2026-09-18';
  }

  const ativMatFrac = db.atividades.find((a) => a.id === 'ativ-demo-mat-frac');
  if (ativMatFrac) {
    ativMatFrac.oferta_id = 'oferta-mat-7a';
    ativMatFrac.criado_por = 'usr-prof-ana';
    ativMatFrac.status = 'publicada';
    ativMatFrac.prazo = '2026-10-02';
  }

  const ativCien1 = db.atividades.find((a) => a.id === 'ativ-cien-01');
  if (ativCien1) {
    ativCien1.oferta_id = 'oferta-cien-7a';
    ativCien1.criado_por = 'usr-prof-carlos';
    ativCien1.status = 'encerrada';
    ativCien1.prazo = '2026-09-15';
  }

  const ativCienProva = db.atividades.find((a) => a.id === 'ativ-demo-cien-prova');
  if (ativCienProva) {
    ativCienProva.oferta_id = 'oferta-cien-7a';
    ativCienProva.criado_por = 'usr-prof-carlos';
    ativCienProva.status = 'encerrada';
    ativCienProva.prazo = '2026-09-22';
  }

  const pacoteAtividades: Array<{
    atividade: Atividade;
    questoes: Array<{
      id: string;
      ordem: number;
      enunciado: string;
      dica: string;
      explicacao: string;
      tipo: TipoQuestao;
      resposta_esperada?: string;
      alternativas: Array<{
        letra: LetraAlternativa;
        texto: string;
        correta: boolean;
        por_que_errou: string | null;
      }>;
    }>;
  }> = [
    // --------------------------------------------------------------------------
    // MATEMÁTICA 6ºA: 1. Números Inteiros & Reta Numérica (Encerrada - Semana 1)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-mat-inteiros',
        created_at: '2026-08-26T08:30:00Z',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Números Inteiros, Reta Numérica e Operações',
        descricao:
          'Compreensão do conjunto dos números inteiros (Z), representação na reta numérica, saldos negativos e comparação de valores.',
        prazo: '2026-09-06',
        modo: 'exercicio',
        status: 'encerrada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-mat-int-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'Qual número inteiro representa um saldo bancário devedor de R$ 150,00?',
          dica: 'Dívidas e valores abaixo de zero são representados por sinal negativo (-).',
          explicacao: 'Um saldo devedor significa que o cliente deve dinheiro ao banco, expresso por -150.',
          alternativas: [
            { letra: 'A', texto: '-150', correta: true, por_que_errou: null },
            { letra: 'B', texto: '+150', correta: false, por_que_errou: '+150 indicaria saldo positivo (crédito), não devedor.' },
            { letra: 'C', texto: '0', correta: false, por_que_errou: 'Zero seria uma conta sem saldo nem dívida.' },
            { letra: 'D', texto: '-15', correta: false, por_que_errou: 'O valor da dívida é 150, não 15.' },
          ],
        },
        {
          id: 'q-mat-int-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Na reta numérica orientada da esquerda para a direita, qual número está exatamente 5 unidades à esquerda do número 2?',
          dica: 'Andar para a esquerda na reta numérica equivale a subtrair: 2 - 5.',
          explicacao: 'Partindo do ponto 2 e deslocando 5 casas para a esquerda: 2 - 5 = -3.',
          alternativas: [
            { letra: 'A', texto: '-3', correta: true, por_que_errou: null },
            { letra: 'B', texto: '3', correta: false, por_que_errou: 'Esqueceu o sinal negativo ao passar do zero para a esquerda.' },
            { letra: 'C', texto: '-7', correta: false, por_que_errou: '-7 seria 5 unidades à esquerda de -2, não de +2.' },
            { letra: 'D', texto: '7', correta: false, por_que_errou: '7 seria 5 unidades para a direita (2 + 5).' },
          ],
        },
        {
          id: 'q-mat-int-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'A temperatura em uma cidade serrana era de -2°C às 6h da manhã e subiu 9°C até o meio-dia. Qual temperatura marcou o termômetro ao meio-dia?',
          dica: 'Some a variação positiva à temperatura inicial: (-2) + 9.',
          explicacao: '(-2) + 9 = +7°C.',
          alternativas: [
            { letra: 'A', texto: '+7°C', correta: true, por_que_errou: null },
            { letra: 'B', texto: '-7°C', correta: false, por_que_errou: 'A temperatura subiu, logo deve ficar no lado positivo.' },
            { letra: 'C', texto: '+11°C', correta: false, por_que_errou: 'Somou 2 com 9 sem considerar o sinal negativo de -2.' },
            { letra: 'D', texto: '-11°C', correta: false, por_que_errou: 'Subtraiu 9 em vez de somar o aumento de temperatura.' },
          ],
        },
        {
          id: 'q-mat-int-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'Resolva a expressão numérica: (-5) + (-8). Qual é o resultado?',
          dica: 'Somar duas dívidas resulta em uma dívida maior acumulada.',
          explicacao: 'Soma de dois negativos: mantém o sinal e soma os valores absolutos: -(5 + 8) = -13.',
          alternativas: [
            { letra: 'A', texto: '-13', correta: true, por_que_errou: null },
            { letra: 'B', texto: '+13', correta: false, por_que_errou: 'Confundiu com regra de multiplicação: menos com menos na soma continua negativo.' },
            { letra: 'C', texto: '-3', correta: false, por_que_errou: 'Subtraiu 5 de 8 em vez de somar as duas dívidas.' },
            { letra: 'D', texto: '+3', correta: false, por_que_errou: 'Errou o sinal e fez subtração.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // MATEMÁTICA 6ºA: 2. Geometria Plana: Polígonos e Perímetros (Encerrada - Semana 2)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-mat-geom',
        created_at: '2026-09-03T09:00:00Z',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Geometria Plana: Polígonos, Ângulos e Perímetros',
        descricao:
          'Identificação e classificação de triângulos e quadriláteros, cálculo de perímetro em situações reais e soma dos ângulos internos.',
        prazo: '2026-09-14',
        modo: 'exercicio',
        status: 'encerrada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-mat-geo-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'Um triângulo que possui todos os três lados com medidas rigorosamente iguais é classificado como:',
          dica: 'O prefixo "equi" significa igualdade.',
          explicacao: 'Triângulo equilátero possui os 3 lados congruentes e os 3 ângulos internos de 60°.',
          alternativas: [
            { letra: 'A', texto: 'Equilátero.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Isósceles.', correta: false, por_que_errou: 'Isósceles tem apenas 2 lados iguais.' },
            { letra: 'C', texto: 'Escaleno.', correta: false, por_que_errou: 'Escaleno possui os 3 lados com medidas diferentes.' },
            { letra: 'D', texto: 'Retângulo.', correta: false, por_que_errou: 'Retângulo é a classificação quanto ao ângulo reto (90°).' },
          ],
        },
        {
          id: 'q-mat-geo-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Uma horta escolar de formato retangular possui 18 metros de comprimento por 7 metros de largura. Para cercá-la completamente com tela de arame, quantos metros de tela serão necessários?',
          dica: 'O perímetro é a soma de todos os 4 lados do retângulo: 2 × comprimento + 2 × largura.',
          explicacao: 'Perímetro = 18 + 7 + 18 + 7 = 50 metros.',
          alternativas: [
            { letra: 'A', texto: '50 metros.', correta: true, por_que_errou: null },
            { letra: 'B', texto: '25 metros.', correta: false, por_que_errou: 'Somou apenas um comprimento e uma largura (semiperímetro).' },
            { letra: 'C', texto: '126 metros.', correta: false, por_que_errou: 'Calculou a área (18 × 7 = 126 m²), mas a pergunta pede o perímetro da cerca.' },
            { letra: 'D', texto: '43 metros.', correta: false, por_que_errou: 'Errou na soma das medidas dos lados.' },
          ],
        },
        {
          id: 'q-mat-geo-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'Dois ângulos são chamados de suplementares quando a soma de suas medidas é igual a:',
          dica: 'Lembre-se: complementares somam 90° e suplementares somam o ângulo de meia-volta.',
          explicacao: 'Ângulos suplementares somam exatamente 180°.',
          alternativas: [
            { letra: 'A', texto: '180°', correta: true, por_que_errou: null },
            { letra: 'B', texto: '90°', correta: false, por_que_errou: '90° é a soma de ângulos complementares.' },
            { letra: 'C', texto: '360°', correta: false, por_que_errou: '360° é a soma de uma volta inteira (replementares).' },
            { letra: 'D', texto: '45°', correta: false, por_que_errou: '45° é a metade de um ângulo reto.' },
          ],
        },
        {
          id: 'q-mat-geo-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'Em qualquer triângulo no plano, a soma das medidas de seus três ângulos internos é sempre igual a:',
          dica: 'Pense no teorema angular fundamental dos triângulos.',
          explicacao: 'A soma dos ângulos internos de qualquer triângulo é sempre constante e igual a 180°.',
          alternativas: [
            { letra: 'A', texto: '180°', correta: true, por_que_errou: null },
            { letra: 'B', texto: '360°', correta: false, por_que_errou: '360° é a soma dos ângulos internos de quadriláteros.' },
            { letra: 'C', texto: '90°', correta: false, por_que_errou: '90° seria apenas um ângulo reto.' },
            { letra: 'D', texto: '270°', correta: false, por_que_errou: '270° equivale a três quartos de volta.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // MATEMÁTICA 6ºA: 3. Simulado Diagnóstico Bimestral (Encerrada / Prova - Semana 3)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-mat-simulado',
        created_at: '2026-09-11T10:00:00Z',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Simulado Diagnóstico Bimestral de Matemática',
        descricao:
          'Avaliação diagnóstica com questões integradas de álgebra, geometria, inteiros e raciocínio lógico.',
        prazo: '2026-09-20',
        modo: 'prova',
        status: 'encerrada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-mat-sim-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'Um retângulo tem comprimento igual a 3x e largura igual a 2x. Se o perímetro vale 50 cm, qual é o valor numérico de x?',
          dica: 'O perímetro é a soma de todos os lados: 3x + 2x + 3x + 2x = 50.',
          explicacao: '10x = 50 -> x = 5 cm.',
          alternativas: [
            { letra: 'A', texto: 'x = 5 cm', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'x = 10 cm', correta: false, por_que_errou: 'Somou apenas dois lados (5x = 50 -> x = 10).' },
            { letra: 'C', texto: 'x = 2,5 cm', correta: false, por_que_errou: 'Dividiu 50 por 20 por engano.' },
            { letra: 'D', texto: 'x = 15 cm', correta: false, por_que_errou: 'Calculou o valor do comprimento 3x (3×5=15) em vez do valor de x.' },
          ],
        },
        {
          id: 'q-mat-sim-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Qual das alternativas apresenta os números inteiros em ordem estritamente CRESCENTE?',
          dica: 'Lembre-se: números mais negativos ficam mais à esquerda na reta numérica.',
          explicacao: 'Ordem crescente (do menor para o maior): -9 < -4 < -1 < 0 < +3.',
          alternativas: [
            { letra: 'A', texto: '-9, -4, -1, 0, +3', correta: true, por_que_errou: null },
            { letra: 'B', texto: '-1, -4, -9, 0, +3', correta: false, por_que_errou: 'Inverteu a ordem dos negativos (-1 é maior que -9).' },
            { letra: 'C', texto: '+3, 0, -1, -4, -9', correta: false, por_que_errou: 'Colocou em ordem decrescente (do maior para o menor).' },
            { letra: 'D', texto: '-4, -9, -1, +3, 0', correta: false, por_que_errou: 'Ordem desordenada de valores absolutos.' },
          ],
        },
        {
          id: 'q-mat-sim-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'Qual fração é equivalente a 0,75?',
          dica: 'Pense em 75 centésimos e simplifique por 25.',
          explicacao: '0,75 = 75/100. Dividindo numerador e denominador por 25, temos 3/4.',
          alternativas: [
            { letra: 'A', texto: '3/4', correta: true, por_que_errou: null },
            { letra: 'B', texto: '7/5', correta: false, por_que_errou: 'Juntou os dígitos 7 e 5 sem respeitar as casas decimais.' },
            { letra: 'C', texto: '1/4', correta: false, por_que_errou: '1/4 é 0,25, não 0,75.' },
            { letra: 'D', texto: '75/10', correta: false, por_que_errou: '75/10 é 7,5.' },
          ],
        },
        {
          id: 'q-mat-sim-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'Um produto que custava R$ 120,00 teve um acréscimo de 15%. Qual é o novo preço do produto?',
          dica: 'Calcule 10% (12) + 5% (6) = 18 de acréscimo, e some ao valor inicial.',
          explicacao: '15% de 120 = 18. Novo preço = 120 + 18 = R$ 138,00.',
          alternativas: [
            { letra: 'A', texto: 'R$ 138,00', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'R$ 135,00', correta: false, por_que_errou: 'Somou apenas o número 15 diretamente ao valor.' },
            { letra: 'C', texto: 'R$ 102,00', correta: false, por_que_errou: 'Subtraiu o desconto em vez de somar o acréscimo.' },
            { letra: 'D', texto: 'R$ 144,00', correta: false, por_que_errou: 'Calculou 20% de acréscimo.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // MATEMÁTICA 6ºA: 4. Rascunho de Recuperação Paralela (Atividade em Edição)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-mat-rascunho',
        created_at: '2026-09-26T15:00:00Z',
        oferta_id: 'oferta-mat-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Recuperação Paralela: Operações com Números Decimais e Frações',
        descricao:
          'Atividade de reforço e nivelamento para alunos que precisam consolidar operações decimais.',
        prazo: '2026-10-10',
        modo: 'exercicio',
        status: 'rascunho',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-mat-rasc-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'Calcule o resultado da soma de números decimais: 4,75 + 3,8. Qual é o valor correto?',
          dica: 'Alinhe as vírgulas antes de somar as casas decimais.',
          explicacao: '4,75 + 3,80 = 8,55.',
          alternativas: [
            { letra: 'A', texto: '8,55', correta: true, por_que_errou: null },
            { letra: 'B', texto: '7,83', correta: false, por_que_errou: 'Não alinhou as vírgulas e somou 5 com 8.' },
            { letra: 'C', texto: '8,13', correta: false, por_que_errou: 'Esqueceu o transporte de casa decimal.' },
            { letra: 'D', texto: '85,5', correta: false, por_que_errou: 'Errou a posição da vírgula decimal.' },
          ],
        },
        {
          id: 'q-mat-rasc-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Se você comprar 3 cadernos por R$ 8,50 cada, quanto gastará no total?',
          dica: 'Multiplique 3 por 8,50.',
          explicacao: '3 × 8,50 = R$ 25,50.',
          alternativas: [
            { letra: 'A', texto: 'R$ 25,50', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'R$ 24,50', correta: false, por_que_errou: 'Errou na multiplicação das casas decimais.' },
            { letra: 'C', texto: 'R$ 26,00', correta: false, por_que_errou: 'Arredondou para cima indevidamente.' },
            { letra: 'D', texto: 'R$ 11,50', correta: false, por_que_errou: 'Somou 3 com 8,50 em vez de multiplicar.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // LÍNGUA PORTUGUESA 6ºA: 1. Gêneros Textuais: Crônica e Notícia (Encerrada - Semana 1)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-port-generos',
        created_at: '2026-08-28T10:00:00Z',
        oferta_id: 'oferta-port-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Gêneros Textuais: A Crônica do Cotidiano e a Notícia',
        descricao:
          'Identificação das características centrais da crônica jornalística, estrutura de notícias e o uso de recursos expressivos.',
        prazo: '2026-09-07',
        modo: 'exercicio',
        status: 'encerrada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-port-gen-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'A crônica jornalística é um gênero textual que se caracteriza essencialmente por:',
          dica: 'Pense em textos que partem de pequenos acontecimentos do dia a dia com humor ou reflexão.',
          explicacao: 'A crônica parte de fatos simples do cotidiano para propor reflexões poéticas, críticas ou bem-humoradas.',
          alternativas: [
            { letra: 'A', texto: 'Abordar fatos rotineiros e simples do cotidiano com olhar subjetivo, reflexivo ou humorístico.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Apresentar dados científicos estritamente técnicos sem qualquer toque de subjetividade.', correta: false, por_que_errou: 'Esse seria um artigo científico ou verbete enciclopédico.' },
            { letra: 'C', texto: 'Ditar regras de comportamento em formato de leis formais obrigatórias.', correta: false, por_que_errou: 'Textos prescritivos/jurídicos não são crônicas.' },
            { letra: 'D', texto: 'Expor argumentos matemáticos comprovados por equações.', correta: false, por_que_errou: 'Crônica é gênero literário-jornalístico.' },
          ],
        },
        {
          id: 'q-port-gen-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: "Em uma notícia de jornal, o primeiro parágrafo que responde rapidamente às perguntas essenciais (O quê? Quem? Onde? Quando?) chama-se:",
          dica: 'É um termo de origem inglesa amplamente adotado no jornalismo brasileiro.',
          explicacao: 'O "Lide" (ou lead) é a abertura clássica da notícia com os dados fundamentais do fato.',
          alternativas: [
            { letra: 'A', texto: 'Lide (Lead).', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Epílogo.', correta: false, por_que_errou: 'Epílogo é a conclusão final de uma narrativa literária.' },
            { letra: 'C', texto: 'Manchete.', correta: false, por_que_errou: 'Manchete é o título principal em letras grandes na capa.' },
            { letra: 'D', texto: 'Legenda.', correta: false, por_que_errou: 'Legenda é o texto curto explicativo abaixo de uma foto.' },
          ],
        },
        {
          id: 'q-port-gen-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'Qual é o papel da linguagem informal e intimista que frequentemente encontramos nas crônicas de autores como Rubem Braga e Clarice Lispector?',
          dica: 'Observe como o autor parece conversar diretamente com o leitor.',
          explicacao: 'A linguagem coloquial e leve cria proximidade e empatia entre cronista e leitor.',
          alternativas: [
            { letra: 'A', texto: 'Criar aproximação e cumplicidade afetiva entre o narrador e o leitor.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Dificultar a leitura para testar o vocabulário de quem lê.', correta: false, por_que_errou: 'A crônica busca clareza e acolhimento, não inacessibilidade.' },
            { letra: 'C', texto: 'Cumprir os requisitos de um boletim oficial de Estado.', correta: false, por_que_errou: 'Documentos de Estado utilizam norma padrão impessoal estrita.' },
            { letra: 'D', texto: 'Substituir a poesia sem ritmo nem sensibilidade.', correta: false, por_que_errou: 'A crônica tem forte carga lírica e poética.' },
          ],
        },
        {
          id: 'q-port-gen-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'Qual elemento diferencia fundamentalmente um conto fictício de uma notícia verídica?',
          dica: 'Pense no compromisso com a veracidade real dos acontecimentos relatados.',
          explicacao: 'A notícia tem compromisso com a realidade factual comprovada, enquanto o conto nasce da imaginação ficcional do autor.',
          alternativas: [
            { letra: 'A', texto: 'O compromisso com fatos reais e checados, presente na notícia e ausente na ficção do conto.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'O conto só pode ser lido em voz alta e a notícia apenas em silêncio.', correta: false, por_que_errou: 'A modalidade de leitura não define a essência do gênero.' },
            { letra: 'C', texto: 'A notícia é sempre rimada em versos heptassílabos.', correta: false, por_que_errou: 'Notícia é escrita em prosa jornalística.' },
            { letra: 'D', texto: 'Não há diferença alguma entre notícia e conto.', correta: false, por_que_errou: 'São gêneros com intenções comunicativas completamente distintas.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // LÍNGUA PORTUGUESA 6ºA: 2. Ortografia e Classes de Palavras (Encerrada - Semana 3)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-port-ortografia',
        created_at: '2026-09-09T14:00:00Z',
        oferta_id: 'oferta-port-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Ortografia, Acentuação e Classes de Palavras',
        descricao:
          'Regras fundamentais de acentuação (oxítonas, paroxítonas e proparoxítonas) e diferenciação entre substantivos e adjetivos.',
        prazo: '2026-09-19',
        modo: 'exercicio',
        status: 'encerrada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-port-ort-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'De acordo com as regras de acentuação gráfica da língua portuguesa, TODAS as palavras proparoxítonas:',
          dica: 'Lembre-se da regra mais simples e sem exceções da língua portuguesa.',
          explicacao: 'Todas as palavras proparoxítonas (com a antepenúltima sílaba tônica) são acentuadas na escrita.',
          alternativas: [
            { letra: 'A', texto: 'São obrigatoriamente acentuadas graficamente.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Só recebem acento se terminarem em vogal nasal.', correta: false, por_que_errou: 'Não há condição terminativa para proparoxítonas: todas têm acento.' },
            { letra: 'C', texto: 'Nunca recebem acento gráfico.', correta: false, por_que_errou: 'Todas as proparoxítonas recebem acento (ex.: lâmpada, pássaro, médico).' },
            { letra: 'D', texto: 'São acentuadas apenas quando usadas no plural.', correta: false, por_que_errou: 'O plural não altera a regra de proparoxítonas.' },
          ],
        },
        {
          id: 'q-port-ort-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: "Na frase 'O velho casarão guardava segredos misteriosos', os termos 'velho' e 'misteriosos' funcionam morfologicamente como:",
          dica: 'Eles qualificam e atribuem características aos substantivos "casarão" e "segredos".',
          explicacao: 'Adjetivos são palavras que caracterizam, qualificam ou modificam substantivos.',
          alternativas: [
            { letra: 'A', texto: 'Adjetivos.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Verbos no particípio.', correta: false, por_que_errou: '"Velho" e "misteriosos" são adjetivos puros de qualificação.' },
            { letra: 'C', texto: 'Advérbios de modo.', correta: false, por_que_errou: 'Advérbios modificam verbos ou outros advérbios, não substantivos.' },
            { letra: 'D', texto: 'Conjunções subordinativas.', correta: false, por_que_errou: 'Conjunções conectam orações.' },
          ],
        },
        {
          id: 'q-port-ort-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'Qual das opções abaixo apresenta o uso CORRETO do termo destacado na pergunta: "_____ você não compareceu à reunião de ontem?"',
          dica: 'Em perguntas diretas no início de frases, usa-se a forma separada e sem acento.',
          explicacao: 'Usa-se "Por que" (separado e sem acento) em início de interrogações diretas.',
          alternativas: [
            { letra: 'A', texto: 'Por que', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Porque', correta: false, por_que_errou: '"Porque" junto é usado em respostas e explicações justificativas.' },
            { letra: 'C', texto: 'Por quê', correta: false, por_que_errou: '"Por quê" com acento é usado apenas no final de frases interrogativas.' },
            { letra: 'D', texto: 'Porquê', correta: false, por_que_errou: '"Porquê" substantivado vem precedido de artigo (ex.: o porquê).' },
          ],
        },
        {
          id: 'q-port-ort-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'Identifique o grupo em que TODAS as palavras são paroxítonas terminadas em ditongo:',
          dica: 'A penúltima sílaba é a mais forte e a última termina com encontro de duas vogais na mesma sílaba.',
          explicacao: 'História, família e série têm sílaba tônica na penúltima e terminam em ditongo crescente.',
          alternativas: [
            { letra: 'A', texto: 'História, família, série.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Café, cipó, maracujá.', correta: false, por_que_errou: 'Essas são oxítonas terminadas em vogal.' },
            { letra: 'C', texto: 'Lâmpada, médico, câmera.', correta: false, por_que_errou: 'Essas são proparoxítonas.' },
            { letra: 'D', texto: 'Cajá, computador, barril.', correta: false, por_que_errou: 'São oxítonas com terminação consonantal ou aberta.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // ARTE 6ºA: 1. História da Arte: Das Cavernas às Cidades (Encerrada - Semana 2)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-art-historia',
        created_at: '2026-09-04T11:00:00Z',
        oferta_id: 'oferta-art-7a',
        periodo_id: 'per-bim-3',
        titulo: 'História da Arte: Das Cavernas às Primeiras Cidades',
        descricao:
          'Estudo sobre a pintura rupestre pré-histórica, materiais pigmentares naturais e a arte egípcia e mesopotâmica.',
        prazo: '2026-09-16',
        modo: 'exercicio',
        status: 'encerrada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-art-hist-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'As pinturas e gravuras produzidas por grupos humanos pré-históricos em paredes e tetos de abrigos rochosos são conhecidas como:',
          dica: 'O nome deriva do latim "rupes" (rocha).',
          explicacao: 'A arte rupestre é o registro visual feito sobre suportes rochosos no Paleolítico e Neolítico.',
          alternativas: [
            { letra: 'A', texto: 'Arte rupestre.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Arte renascentista.', correta: false, por_que_errou: 'O Renascimento ocorreu na Europa nos séculos XV e XVI.' },
            { letra: 'C', texto: 'Arte cubista.', correta: false, por_que_errou: 'O Cubismo foi criado no início do século XX por Picasso e Braque.' },
            { letra: 'D', texto: 'Grafite contemporâneo.', correta: false, por_que_errou: 'Grafite é arte urbana moderna em muros de cidades.' },
          ],
        },
        {
          id: 'q-art-hist-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Quais substâncias naturais os artistas da pré-história utilizavam para preparar as tintas de suas pinturas nas cavernas?',
          dica: 'Pense em materiais da própria natureza e terra ao alcance das mãos.',
          explicacao: 'Utilizavam pigmentos minerais de argila, óxido de ferro, carvão vegetal triturado e gordura animal.',
          alternativas: [
            { letra: 'A', texto: 'Carvão vegetal, pós de minérios de argila, sangue e gordura animal.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Tintas acrílicas à base de solvente petroquímico.', correta: false, por_que_errou: 'Tintas acrílicas sintéticas foram inventadas no século XX.' },
            { letra: 'C', texto: 'Esmalte sintético à base de água.', correta: false, por_que_errou: 'Produtos industrializados modernos.' },
            { letra: 'D', texto: 'Canetas hidrográficas de feltro.', correta: false, por_que_errou: 'Ferramenta industrial moderna.' },
          ],
        },
        {
          id: 'q-art-hist-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'No Brasil, qual parque nacional é reconhecido como Patrimônio Cultural da Humanidade por abrigar centenas de sítios arqueológicos com riquíssimas pinturas rupestres?',
          dica: 'Fica localizado no interior do estado do Piauí.',
          explicacao: 'O Parque Nacional Serra da Capivara (PI) guarda a maior e mais antiga concentração de pinturas rupestres do continente americano.',
          alternativas: [
            { letra: 'A', texto: 'Parque Nacional Serra da Capivara (Piauí).', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Parque Nacional da Tijuca (Rio de Janeiro).', correta: false, por_que_errou: 'A Tijuca é uma floresta urbana carioca de preservação ambiental.' },
            { letra: 'C', texto: 'Parque Nacional do Iguaçu (Paraná).', correta: false, por_que_errou: 'O Iguaçu é célebre por suas monumentais cataratas hídricas.' },
            { letra: 'D', texto: 'Parque Nacional de Jericoacoara (Ceará).', correta: false, por_que_errou: 'Jericoacoara é conhecido por dunas e litoral marinho.' },
          ],
        },
        {
          id: 'q-art-hist-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'Na pintura e nos relevos do Antigo Egito, a "lei da frontalidade" determinava que a figura humana fosse representada com:',
          dica: 'O tronco ficava de frente, enquanto a cabeça e os membros apareciam de perfil.',
          explicacao: 'A lei da frontalidade exigia que o olho e o tronco fossem vistos de frente, e o rosto, braços e pernas de perfil.',
          alternativas: [
            { letra: 'A', texto: 'Tronco e olhos voltados para a frente, com cabeça e pernas desenhados de perfil.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'O corpo inteiro sempre em perspectiva tridimensional com sombras realistas.', correta: false, por_que_errou: 'Os egípcios não utilizavam ponto de fuga ou perspectiva com sombras.' },
            { letra: 'C', texto: 'Apenas os pés desenhados e o restante do corpo oculto por tecidos.', correta: false, por_que_errou: 'A anatomia do corpo era desenhada completa e com rigor geométrico.' },
            { letra: 'D', texto: 'Rostos abstratos com formas circulares livres.', correta: false, por_que_errou: 'A arte egípcia seguia cânones estritos e figurativos de veneração.' },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // LÍNGUA PORTUGUESA 6ºA: 3. Produção e Coesão: Conectivos (Publicada / Discursiva Pendente)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-port-producao',
        created_at: '2026-09-20T10:00:00Z',
        oferta_id: 'oferta-port-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Produção e Coesão: Conectivos e Parágrafos',
        descricao:
          'Aplicação de elementos de coesão referencial e sequencial, estruturação de parágrafos argumentativos e questão discursiva com correção docente.',
        prazo: '2026-10-06',
        modo: 'exercicio',
        status: 'publicada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-port-prod-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'Qual dos conectivos abaixo expressa ideia de OPOSIÇÃO ou CONTRASTE entre duas orações?',
          dica: 'Pense em palavras que introduzem uma ressalva ou ideia contrária.',
          explicacao: '"Contudo", "entretanto", "mas" e "porém" são conjunções adversativas de oposição.',
          alternativas: [
            { letra: 'A', texto: 'Entretanto.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Portanto.', correta: false, por_que_errou: '"Portanto" é um conectivo conclusivo.' },
            { letra: 'C', texto: 'Além disso.', correta: false, por_que_errou: '"Além disso" indica adição cumulativa de argumentos.' },
            { letra: 'D', texto: 'Porque.', correta: false, por_que_errou: '"Porque" indica causalidade ou explicação.' },
          ],
        },
        {
          id: 'q-port-prod-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Em uma redação escolar, a transição para a conclusão deve amarrar as ideias apresentadas. O operador discursivo que cumpre esse papel é:',
          dica: 'Indica o fechamento do raciocínio defendido.',
          explicacao: '"Dessa forma", "em suma" e "portanto" são operadores típicos de conclusão textual.',
          alternativas: [
            { letra: 'A', texto: 'Dessa forma, conclui-se que...', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Por outro lado, embora...', correta: false, por_que_errou: 'Expressão concessiva de oposição.' },
            { letra: 'C', texto: 'Em primeiro lugar...', correta: false, por_que_errou: 'Expressão introdutória de início de exposição.' },
            { letra: 'D', texto: 'De repente...', correta: false, por_que_errou: 'Marcador de imprevisibilidade típico de narrativa ficcional.' },
          ],
        },
        {
          id: 'q-port-prod-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'A repetição cansativa de uma mesma palavra empobrece o texto. O recurso que substitui um termo já citado por um pronome ou sinônimo chama-se:',
          dica: 'Mecanismo que retoma termos anteriores para manter a fluidez da leitura.',
          explicacao: 'A anáfora e a coesão referencial substituem termos já mencionados para manter o fluxo sem repetições.',
          alternativas: [
            { letra: 'A', texto: 'Coesão referencial por anáfora ou sinonímia.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Pleonasmo vicioso.', correta: false, por_que_errou: 'Pleonasmo vicioso é a repetição desnecessária de ideia (ex.: subir para cima).' },
            { letra: 'C', texto: 'Aliteração poética.', correta: false, por_que_errou: 'Aliteração é a repetição de sons consonantais em poesia.' },
            { letra: 'D', texto: 'Cacofonia sonora.', correta: false, por_que_errou: 'Cacofonia é encontro sonoro desagradável entre palavras.' },
          ],
        },
        {
          id: 'q-real-port-4',
          ordem: 4,
          tipo: 'discursiva',
          enunciado: 'Explique com suas palavras a importância do uso de conectivos (como "portanto", "entretanto", "além disso") para a clareza e a coesão de um parágrafo.',
          dica: 'Pense em como as frases se conectam para guiar o leitor pelo raciocínio.',
          explicacao: 'Conectivos orientam o leitor sobre a lógica do texto (adição, oposição, conclusão), garantindo progressão fluida.',
          resposta_esperada: 'O aluno deve indicar que conectivos estabelecem pontes lógicas entre orações e parágrafos, conferindo sentido e clareza ao texto.',
          alternativas: [],
        },
      ],
    },

    // --------------------------------------------------------------------------
    // ARTE 6ºA: 2. Teoria das Cores e Formas (Publicada / Pendente p/ Lucas)
    // --------------------------------------------------------------------------
    {
      atividade: {
        id: 'ativ-real-art-01',
        created_at: '2026-09-22T14:00:00Z',
        oferta_id: 'oferta-art-7a',
        periodo_id: 'per-bim-3',
        titulo: 'Cores, Formas e Patrimônio Visual',
        descricao:
          'Estudo prático sobre o círculo cromático, cores primárias, secundárias, quentes, frias e expressões visuais brasileiras.',
        prazo: '2026-10-08',
        modo: 'exercicio',
        status: 'publicada',
        criado_por: 'usr-prof-ana',
      },
      questoes: [
        {
          id: 'q-art-cor-1',
          ordem: 1,
          tipo: 'objetiva',
          enunciado: 'Quais são as três cores primárias na teoria das cores tradicional (pigmento)?',
          dica: 'São as cores puras que não podem ser obtidas pela mistura de outras cores.',
          explicacao: 'Vermelho, amarelo e azul são as cores primárias tradicionais.',
          alternativas: [
            { letra: 'A', texto: 'Vermelho, amarelo e azul.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Verde, laranja e roxo.', correta: false, por_que_errou: 'Essas são cores secundárias.' },
            { letra: 'C', texto: 'Preto, branco e cinza.', correta: false, por_que_errou: 'Essas são cores neutras/acromáticas.' },
            { letra: 'D', texto: 'Azul, verde e amarelo.', correta: false, por_que_errou: 'Verde é secundária (azul + amarelo).' },
          ],
        },
        {
          id: 'q-art-cor-2',
          ordem: 2,
          tipo: 'objetiva',
          enunciado: 'Ao misturar partes iguais de tinta amarela e azul, obtemos qual cor secundária?',
          dica: 'É a cor frequentemente associada à vegetação e à natureza.',
          explicacao: 'Amarelo + Azul = Verde.',
          alternativas: [
            { letra: 'A', texto: 'Verde.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Laranja.', correta: false, por_que_errou: 'Laranja resulta da mistura de vermelho com amarelo.' },
            { letra: 'C', texto: 'Roxo.', correta: false, por_que_errou: 'Roxo resulta da mistura de vermelho com azul.' },
            { letra: 'D', texto: 'Marrom.', correta: false, por_que_errou: 'Marrom é uma cor terciária resultante da mistura das três primárias.' },
          ],
        },
        {
          id: 'q-art-cor-3',
          ordem: 3,
          tipo: 'objetiva',
          enunciado: 'As chamadas "cores quentes" (vermelho, amarelo e laranja) transmitem psicologicamente sensação de:',
          dica: 'Lembre-se do sol, fogo e energia.',
          explicacao: 'Cores quentes transmitem energia, calor, vivacidade e proximidade visual.',
          alternativas: [
            { letra: 'A', texto: 'Calor, luminosidade, energia e aproximação.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Frio extremo, tranquilidade e distanciamento.', correta: false, por_que_errou: 'Sensação típica de cores frias (azul, verde, violeta).' },
            { letra: 'C', texto: 'Completa ausência de luz.', correta: false, por_que_errou: 'Ausência de luz caracteriza a escuridão/preto.' },
            { letra: 'D', texto: 'Sonolência profunda e apatia.', correta: false, por_que_errou: 'Cores quentes são estimulantes, não soníferas.' },
          ],
        },
        {
          id: 'q-art-cor-4',
          ordem: 4,
          tipo: 'objetiva',
          enunciado: 'No círculo cromático, cores complementares são aquelas situadas em posições diametralmente opostas. Qual é o par complementar correto?',
          dica: 'Quando colocadas lado a lado, produzem o maior contraste visual.',
          explicacao: 'Azul e laranja estão opostos no círculo cromático, formando um contraste complementar clássico.',
          alternativas: [
            { letra: 'A', texto: 'Azul e laranja.', correta: true, por_que_errou: null },
            { letra: 'B', texto: 'Azul e verde.', correta: false, por_que_errou: 'Azul e verde são cores análogas (vizinhas no círculo).' },
            { letra: 'C', texto: 'Vermelho e rosa.', correta: false, por_que_errou: 'Rosa é uma variação de matiz com branco do vermelho.' },
            { letra: 'D', texto: 'Amarelo e branco.', correta: false, por_que_errou: 'Branco é cor neutra, não entra no círculo cromático.' },
          ],
        },
      ],
    },
  ];

  for (const item of pacoteAtividades) {
    const ativExistente = db.atividades.find((a) => a.id === item.atividade.id);
    if (ativExistente) {
      ativExistente.criado_por = item.atividade.criado_por;
      ativExistente.oferta_id = item.atividade.oferta_id;
      ativExistente.status = item.atividade.status;
      ativExistente.prazo = item.atividade.prazo;
    } else {
      db.atividades.push(item.atividade);
    }

    for (const q of item.questoes) {
      if (!db.questoes.some((quest) => quest.id === q.id)) {
        db.questoes.push({
          id: q.id,
          created_at: item.atividade.created_at,
          atividade_id: item.atividade.id,
          ordem: q.ordem,
          enunciado: q.enunciado,
          dica: q.dica,
          explicacao: q.explicacao,
          tipo: q.tipo,
          resposta_esperada: q.resposta_esperada || null,
        });

        for (const alt of q.alternativas) {
          db.alternativas.push({
            id: `alt-${q.id}-${alt.letra.toLowerCase()}`,
            created_at: item.atividade.created_at,
            questao_id: q.id,
            letra: alt.letra,
            texto: alt.texto,
            correta: alt.correta,
            por_que_errou: alt.por_que_errou,
          });
        }
      }
    }
  }

  // ============================================================================
  // 7. GERAÇÃO DE RESPOSTAS REALISTAS NO 6º ANO A (22 ALUNOS)
  // ============================================================================
  const alunosTurma6A = db.alunos.filter((a) => a.turma_id === 'turma-7a' && a.ativo);

  // Helper para registrar resposta com controle de acerto e tentativas
  const registrarResposta = (
    alunoId: string,
    questaoId: string,
    acertou: boolean,
    dataResp: string,
    tentativas = 1
  ) => {
    const respId = `resp-${alunoId}-${questaoId}`;
    if (!db.respostas.some((r) => r.id === respId)) {
      const q = db.questoes.find((item) => item.id === questaoId);
      if (q && q.tipo !== 'discursiva') {
        const alts = db.alternativas.filter((alt) => alt.questao_id === questaoId);
        const altEscolhida = acertou
          ? alts.find((a) => a.correta)
          : alts.find((a) => !a.correta);
        const altId = altEscolhida ? altEscolhida.id : `alt-${questaoId}-b`;

        db.respostas.push({
          id: respId,
          created_at: dataResp,
          aluno_id: alunoId,
          questao_id: questaoId,
          alternativa_id: altId,
          acertou,
          respondida_em: dataResp,
          tentativas,
          acertou_final: acertou,
        });
      }
    }
  };

  // Popula respostas de cada aluno nas novas atividades
  for (const aluno of alunosTurma6A) {
    const isLucas = aluno.id === 'aluno-7a-1';
    const isBia = aluno.id === 'aluno-7a-2';
    const isGabriel = aluno.id === 'aluno-7a-3';
    const isMariana = aluno.id === 'aluno-7a-4';
    const isEnzo = aluno.id === 'aluno-7a-5';

    // 1. Matemática Inteiros (~72% de média)
    const questoesInt = ['q-mat-int-1', 'q-mat-int-2', 'q-mat-int-3', 'q-mat-int-4'];
    questoesInt.forEach((qId, idx) => {
      const acertou = isLucas || isBia || (isEnzo ? idx === 0 : (aluno.numero_chamada + idx) % 4 !== 0);
      registrarResposta(aluno.id, qId, acertou, '2026-09-02T08:45:00Z');
    });

    // 2. Matemática Geometria (~76% de média)
    const questoesGeom = ['q-mat-geo-1', 'q-mat-geo-2', 'q-mat-geo-3', 'q-mat-geo-4'];
    questoesGeom.forEach((qId, idx) => {
      const acertou = isLucas || (!isGabriel && !isEnzo && (aluno.numero_chamada + idx) % 5 !== 0);
      registrarResposta(aluno.id, qId, acertou, '2026-09-10T09:15:00Z');
    });

    // 3. Matemática Simulado Diagnóstico (~69% de média)
    const questoesSim = ['q-mat-sim-1', 'q-mat-sim-2', 'q-mat-sim-3', 'q-mat-sim-4'];
    questoesSim.forEach((qId, idx) => {
      const acertou = isLucas ? idx !== 2 : isBia || (aluno.numero_chamada + idx) % 3 !== 0;
      registrarResposta(aluno.id, qId, acertou, '2026-09-18T10:30:00Z');
    });

    // 4. Língua Portuguesa Gêneros Textuais (~78% de média)
    const questoesGen = ['q-port-gen-1', 'q-port-gen-2', 'q-port-gen-3', 'q-port-gen-4'];
    questoesGen.forEach((qId, idx) => {
      const acertou = isLucas || (!isEnzo && (aluno.numero_chamada + idx) % 5 !== 0);
      registrarResposta(aluno.id, qId, acertou, '2026-09-03T10:15:00Z');
    });

    // 5. Língua Portuguesa Ortografia (~75% de média)
    const questoesOrt = ['q-port-ort-1', 'q-port-ort-2', 'q-port-ort-3', 'q-port-ort-4'];
    questoesOrt.forEach((qId, idx) => {
      const acertou = isLucas || isBia || (!isGabriel && (aluno.numero_chamada + idx) % 4 !== 0);
      registrarResposta(aluno.id, qId, acertou, '2026-09-15T14:20:00Z');
    });

    // 6. Arte História da Arte (~85% de média)
    const questoesArtHist = ['q-art-hist-1', 'q-art-hist-2', 'q-art-hist-3', 'q-art-hist-4'];
    questoesArtHist.forEach((qId, idx) => {
      const acertou = isLucas || (aluno.numero_chamada + idx) % 6 !== 0;
      registrarResposta(aluno.id, qId, acertou, '2026-09-12T11:45:00Z');
    });

    // 7. Língua Portuguesa Produção e Coesão (Publicada - Mariana c/ discursiva pendente)
    if (!isLucas) {
      // Lucas ainda não respondeu (pendente para ele testar no portal)
      const questoesProdObj = ['q-port-prod-1', 'q-port-prod-2', 'q-port-prod-3'];
      questoesProdObj.forEach((qId, idx) => {
        const acertou = isBia || (aluno.numero_chamada + idx) % 3 !== 0;
        registrarResposta(aluno.id, qId, acertou, '2026-09-23T10:15:00Z');
      });
    }

    // Discursiva de Mariana Souza (pendente na fila de correção da Profª Ana Paula)
    if (isMariana) {
      const respMarianaDiscursivaId = 'resp-aluno-7a-4-q-real-port-4';
      if (!db.respostas.some((r) => r.id === respMarianaDiscursivaId)) {
        db.respostas.push({
          id: respMarianaDiscursivaId,
          created_at: '2026-09-23T10:30:00Z',
          aluno_id: 'aluno-7a-4',
          questao_id: 'q-real-port-4',
          alternativa_id: null,
          acertou: null,
          respondida_em: '2026-09-23T10:30:00Z',
          tentativas: 1,
          acertou_final: null,
          texto_resposta:
            'Os conectivos funcionam como pontes lógicas entre orações e parágrafos. Termos como "além disso" ou "entretanto" guiam o leitor se estamos somando argumentos ou apresentando uma ressalva, deixando a redação clara e coerente.',
          pontuacao: null,
          correcao: 'pendente',
        });
      }
    }

    // Discursiva de Beatriz Rocha (já corrigida pela Ana Paula como exemplo)
    if (isBia) {
      const respBiaDiscursivaId = 'resp-aluno-7a-2-q-real-port-4';
      if (!db.respostas.some((r) => r.id === respBiaDiscursivaId)) {
        db.respostas.push({
          id: respBiaDiscursivaId,
          created_at: '2026-09-23T10:28:00Z',
          aluno_id: 'aluno-7a-2',
          questao_id: 'q-real-port-4',
          alternativa_id: null,
          acertou: true,
          respondida_em: '2026-09-23T10:28:00Z',
          tentativas: 1,
          acertou_final: true,
          texto_resposta:
            'Eles estabelecem relações de causa, consequência, oposição e conclusão. Sem conectivos, as ideias ficam soltas e truncadas, tornando o parágrafo difícil de compreender.',
          pontuacao: 1,
          correcao: 'certo',
          comentario_professor: 'Excelente articulação, Bia! Domínio perfeito dos conectivos.',
          corrigido_por: 'usr-prof-ana',
          corrigido_em: '2026-09-24T15:30:00Z',
        });
      }
    }

    // 8. Arte: Cores, Formas e Patrimônio Visual (Pendente para Lucas, respondida por alguns colegas)
    if (!isLucas && aluno.numero_chamada % 2 === 0) {
      const questoesCor = ['q-art-cor-1', 'q-art-cor-2', 'q-art-cor-3', 'q-art-cor-4'];
      questoesCor.forEach((qId, idx) => {
        const acertou = (aluno.numero_chamada + idx) % 4 !== 0;
        registrarResposta(aluno.id, qId, acertou, '2026-09-24T14:10:00Z');
      });
    }
  }

  // ============================================================================
  // 8. RESPOSTAS NA TURMA 6º ANO B (CONTRASTE PEDAGÓGICO: MÉDIA ~67%)
  // ============================================================================
  const alunosTurma6B = db.alunos.filter((a) => a.turma_id === 'turma-6b' && a.ativo);
  for (const aluno of alunosTurma6B) {
    // Matemática no 6ºB: aproveitamento ligeiramente menor
    ['q-mat-int-1', 'q-mat-int-2', 'q-mat-int-3'].forEach((qId, idx) => {
      const acertou = (aluno.numero_chamada + idx) % 3 !== 0;
      registrarResposta(aluno.id, qId, acertou, '2026-09-04T08:50:00Z');
    });

    // Português no 6ºB: aproveitamento com dúvidas em conectivos
    ['q-port-gen-1', 'q-port-gen-2', 'q-port-gen-3'].forEach((qId, idx) => {
      const acertou = (aluno.numero_chamada + idx) % 3 !== 0;
      registrarResposta(aluno.id, qId, acertou, '2026-09-05T10:30:00Z');
    });
  }

  // ============================================================================
  // 9. RECADOS INDIVIDUALIZADOS NO MURAL DA PROFª ANA PAULA
  // ============================================================================
  const avisosNovosAna: Aviso[] = [
    {
      id: 'aviso-ana-6a-geom',
      created_at: '2026-09-15T16:00:00Z',
      escola_id: escolaId,
      autor_id: 'usr-prof-ana',
      turma_id: 'turma-7a', // 6º Ano A
      titulo: 'Parabéns pelos resultados na lista de Geometria Plana!',
      mensagem:
        'Querida turma do 6º Ano A: parabéns pelo excelente aproveitamento na lista de perímetros e polígonos. As resoluções comentadas já estão disponíveis no portal.',
      prioridade: 'media',
      publicado_em: '2026-09-15T16:00:00Z',
    },
    {
      id: 'aviso-ana-6b-reforco',
      created_at: '2026-09-16T16:00:00Z',
      escola_id: escolaId,
      autor_id: 'usr-prof-ana',
      turma_id: 'turma-6b', // 6º Ano B
      titulo: 'Plantão de Reforço: Números Negativos e Regras de Sinais',
      mensagem:
        'Atenção turma do 6º Ano B: nesta quinta-feira às 14h teremos plantão focado em reta numérica e soma de inteiros para tirarmos todas as dúvidas.',
      prioridade: 'alta',
      publicado_em: '2026-09-16T16:00:00Z',
    },
  ];

  for (const av of avisosNovosAna) {
    if (!db.avisos.some((a) => a.id === av.id)) {
      db.avisos.push(av);
    }
  }

  // ============================================================================
  // 10. QUESTÕES NO BANCO DA PROFª ANA PAULA (BNCC: MATEMÁTICA E PORTUGUÊS)
  // ============================================================================
  const questoesBnccAna = [
    {
      id: 'bq-ana-bncc-mat-1',
      disciplinaId: 'disc-mat',
      assuntoId: 'assunto-mat-int',
      criadoPor: 'usr-prof-ana',
      serie: '6º Ano',
      dificuldade: 'medio' as DificuldadeQuestao,
      enunciado: '(EF06MA03) Em um jogo educativo de tabuleiro, cada acerto vale +4 pontos e cada erro desconta -3 pontos. Se um jogador acertou 5 vezes e errou 4 vezes, qual é a sua pontuação final?',
      dica: 'Multiplique os acertos por 4 e subtraia os erros multiplicados por 3.',
      explicacao: '(5 × 4) + (4 × (-3)) = 20 - 12 = +8 pontos.',
      alternativas: [
        { letra: 'A' as LetraAlternativa, texto: '+8 pontos', correta: true, por_que_errou: null },
        { letra: 'B' as LetraAlternativa, texto: '+12 pontos', correta: false, por_que_errou: 'Esqueceu de descontar os pontos dos erros.' },
        { letra: 'C' as LetraAlternativa, texto: '-1 ponto', correta: false, por_que_errou: 'Subtraiu 5 de 4 sem multiplicar pelos valores dos pontos.' },
        { letra: 'D' as LetraAlternativa, texto: '+20 pontos', correta: false, por_que_errou: 'Calculou apenas a pontuação positiva.' },
      ],
    },
    {
      id: 'bq-ana-bncc-port-1',
      disciplinaId: 'disc-port',
      assuntoId: 'ass-port-figuras',
      criadoPor: 'usr-prof-ana',
      serie: '6º Ano',
      dificuldade: 'facil' as DificuldadeQuestao,
      enunciado: "(EF06LP01) Na frase poética 'A lua prateada vigiava o sono tranquilo da cidade', o termo em destaque personifica a lua atribuindo-lhe a ação de:",
      dica: 'Vigiar é uma ação humana de zelo e atenção.',
      explicacao: 'Vigiar é ação consciente de seres humanos, constituindo prosopopeia ou personificação.',
      alternativas: [
        { letra: 'A' as LetraAlternativa, texto: 'Vigiar atentamente como um guardião humano.', correta: true, por_que_errou: null },
        { letra: 'B' as LetraAlternativa, texto: 'Girar em torno de sua órbita física.', correta: false, por_que_errou: 'Sentido astronômico literal, não figurado.' },
        { letra: 'C' as LetraAlternativa, texto: 'Refletir a luminosidade solar.', correta: false, por_que_errou: 'Sentido físico-químico.' },
        { letra: 'D' as LetraAlternativa, texto: 'Causar o fenômeno das marés altas.', correta: false, por_que_errou: 'Efeito gravitacional geográfico.' },
      ],
    },
  ];

  for (const bq of questoesBnccAna) {
    if (!db.banco_questoes.some((item) => item.id === bq.id)) {
      db.banco_questoes.push({
        id: bq.id,
        created_at: '2026-08-20T10:00:00Z',
        escola_id: escolaId,
        disciplina_id: bq.disciplinaId,
        assunto_id: bq.assuntoId,
        criado_por: bq.criadoPor,
        serie: bq.serie,
        tipo: 'objetiva',
        dificuldade: bq.dificuldade,
        enunciado: bq.enunciado,
        imagem_url: null,
        dica: bq.dica,
        explicacao: bq.explicacao,
        resposta_esperada: null,
        origem: 'manual',
        arquivada: false,
        versao: 1,
      });

      for (const alt of bq.alternativas) {
        db.banco_alternativas.push({
          id: `alt-${bq.id}-${alt.letra.toLowerCase()}`,
          created_at: '2026-08-20T10:00:00Z',
          banco_questao_id: bq.id,
          letra: alt.letra,
          texto: alt.texto,
          correta: alt.correta,
          por_que_errou: alt.por_que_errou,
        });
      }
    }
  }
}
