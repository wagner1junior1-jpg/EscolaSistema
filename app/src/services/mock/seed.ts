/**
 * SaberPontual — Dados de Demonstração (Seed) do Modo Mock
 * 
 * Fonte da verdade: docs/ESPECIFICACAO.md (Seções 4, 7.1)
 * Espelho dos dados que serão populados posteriormente no supabase/seed.sql.
 */

import {
  Escola,
  Perfil,
  Periodo,
  Disciplina,
  Turma,
  Oferta,
  Aluno,
  Atividade,
  Questao,
  Alternativa,
  Resposta,
  Frequencia,
  Aviso,
  AlunoSessao,
  PinTentativa,
} from '@/lib/types';
import { hashPin } from './crypto';

export interface MockDatabaseSchema {
  escolas: Escola[];
  perfis: Perfil[];
  credenciais: Record<string, string>; // email -> senha pura ("demo123")
  periodos: Periodo[];
  disciplinas: Disciplina[];
  turmas: Turma[];
  ofertas: Oferta[];
  alunos: Aluno[];
  atividades: Atividade[];
  questoes: Questao[];
  alternativas: Alternativa[];
  respostas: Resposta[];
  frequencias: Frequencia[];
  avisos: Aviso[];
  aluno_sessoes: AlunoSessao[];
  pin_tentativas: PinTentativa[];
}

export async function criarBancoDemonstracao(): Promise<MockDatabaseSchema> {
  const agora = new Date().toISOString();

  // 1. Escola
  const escolaId = 'esc-001';
  const escolas: Escola[] = [
    {
      id: escolaId,
      created_at: agora,
      nome: 'Escola Municipal SaberPontual',
      cidade_uf: 'São Paulo - SP',
      ano_letivo_atual: 2026,
    },
  ];

  // 2. Perfis e Credenciais de Acesso (Seção 7.1)
  const perfis: Perfil[] = [
    {
      id: 'usr-dir-001',
      created_at: agora,
      escola_id: escolaId,
      nome: 'Diretora Helena Ramos',
      papel: 'direcao',
      ativo: true,
      email: 'direcao@demo.com',
    },
    {
      id: 'usr-coord-001',
      created_at: agora,
      escola_id: escolaId,
      nome: 'Coord. Patrícia Silveira',
      papel: 'coordenacao',
      ativo: true,
      email: 'coordenacao@demo.com',
    },
    {
      id: 'usr-prof-ana',
      created_at: agora,
      escola_id: escolaId,
      nome: 'Profª Ana Paula',
      papel: 'professor',
      ativo: true,
      email: 'ana@demo.com',
    },
    {
      id: 'usr-prof-carlos',
      created_at: agora,
      escola_id: escolaId,
      nome: 'Prof. Carlos Roberto',
      papel: 'professor',
      ativo: true,
      email: 'carlos@demo.com',
    },
  ];

  const credenciais: Record<string, string> = {
    'direcao@demo.com': 'demo123',
    'coordenacao@demo.com': 'demo123',
    'ana@demo.com': 'demo123',
    'carlos@demo.com': 'demo123',
  };

  // 3. Períodos (3º Bimestre ativo)
  const periodos: Periodo[] = [
    {
      id: 'per-bim-1',
      created_at: agora,
      escola_id: escolaId,
      nome: '1º Bimestre',
      ano_letivo: 2026,
      data_inicio: '2026-02-05',
      data_fim: '2026-04-18',
      ativo: false,
    },
    {
      id: 'per-bim-2',
      created_at: agora,
      escola_id: escolaId,
      nome: '2º Bimestre',
      ano_letivo: 2026,
      data_inicio: '2026-04-20',
      data_fim: '2026-07-03',
      ativo: false,
    },
    {
      id: 'per-bim-3',
      created_at: agora,
      escola_id: escolaId,
      nome: '3º Bimestre',
      ano_letivo: 2026,
      data_inicio: '2026-07-27',
      data_fim: '2026-10-02',
      ativo: true, // Ativo conforme instrução
    },
    {
      id: 'per-bim-4',
      created_at: agora,
      escola_id: escolaId,
      nome: '4º Bimestre',
      ano_letivo: 2026,
      data_inicio: '2026-10-05',
      data_fim: '2026-12-18',
      ativo: false,
    },
  ];

  // 4. Disciplinas
  const disciplinas: Disciplina[] = [
    { id: 'disc-mat', created_at: agora, escola_id: escolaId, nome: 'Matemática' },
    { id: 'disc-cien', created_at: agora, escola_id: escolaId, nome: 'Ciências' },
  ];

  // 5. Turmas
  const turmas: Turma[] = [
    {
      id: 'turma-7a',
      created_at: agora,
      escola_id: escolaId,
      nome: '7º Ano A',
      serie: '7º Ano',
      segmento: 'fund2',
      ano_letivo: 2026,
      codigo_acesso: '7A-MAT',
      ativa: true,
    },
    {
      id: 'turma-6b',
      created_at: agora,
      escola_id: escolaId,
      nome: '6º Ano B',
      serie: '6º Ano',
      segmento: 'fund2',
      ano_letivo: 2026,
      codigo_acesso: 'CIEN6B',
      ativa: true,
    },
  ];

  // 6. Ofertas (Turma × Disciplina × Professor)
  const ofertas: Oferta[] = [
    {
      id: 'oferta-mat-7a',
      created_at: agora,
      turma_id: 'turma-7a',
      disciplina_id: 'disc-mat',
      professor_id: 'usr-prof-ana',
    },
    {
      id: 'oferta-cien-6b',
      created_at: agora,
      turma_id: 'turma-6b',
      disciplina_id: 'disc-cien',
      professor_id: 'usr-prof-carlos',
    },
  ];

  // 7. Alunos (~8 por turma, com PINs hash gerados via SHA-256)
  const alunosBrutosTurma7A = [
    { id: 'aluno-7a-1', nome: 'Lucas Oliveira', num: 1, pin: '1420' },
    { id: 'aluno-7a-2', nome: 'Beatriz Santos', num: 2, pin: '3891' },
    { id: 'aluno-7a-3', nome: 'Gabriel Lima', num: 3, pin: '7254' },
    { id: 'aluno-7a-4', nome: 'Mariana Souza', num: 4, pin: '5012' },
    { id: 'aluno-7a-5', nome: 'Enzo Gabriel Ferreira', num: 5, pin: '2198' },
    { id: 'aluno-7a-6', nome: 'Sophia Ribeiro', num: 6, pin: '6432' },
    { id: 'aluno-7a-7', nome: 'Matheus Carvalho', num: 7, pin: '8845' },
    { id: 'aluno-7a-8', nome: 'Isabella Martins', num: 8, pin: '4173' },
  ];

  const alunosBrutosTurma6B = [
    { id: 'aluno-6b-1', nome: 'Arthur Guimarães', num: 1, pin: '1098' },
    { id: 'aluno-6b-2', nome: 'Helena Castro', num: 2, pin: '4376' },
    { id: 'aluno-6b-3', nome: 'Thiago Pires', num: 3, pin: '8712' },
    { id: 'aluno-6b-4', nome: 'Manuela Costa', num: 4, pin: '6543' },
    { id: 'aluno-6b-5', nome: 'Felipe Rocha', num: 5, pin: '9812' },
    { id: 'aluno-6b-6', nome: 'Laura Mendes', num: 6, pin: '3124' },
    { id: 'aluno-6b-7', nome: 'Rafael Azevedo', num: 7, pin: '5431' },
    { id: 'aluno-6b-8', nome: 'Valentina Dias', num: 8, pin: '8765' },
  ];

  const alunos: Aluno[] = [];

  for (const a of alunosBrutosTurma7A) {
    alunos.push({
      id: a.id,
      created_at: agora,
      escola_id: escolaId,
      turma_id: 'turma-7a',
      nome_completo: a.nome,
      numero_chamada: a.num,
      pin_hash: await hashPin(a.pin),
      ativo: true,
    });
  }

  for (const a of alunosBrutosTurma6B) {
    alunos.push({
      id: a.id,
      created_at: agora,
      escola_id: escolaId,
      turma_id: 'turma-6b',
      nome_completo: a.nome,
      numero_chamada: a.num,
      pin_hash: await hashPin(a.pin),
      ativo: true,
    });
  }

  // 8. Atividades Publicadas (2 atividades com 4 questões cada)
  const atividades: Atividade[] = [
    {
      id: 'ativ-mat-01',
      created_at: '2026-09-18T10:00:00Z',
      oferta_id: 'oferta-mat-7a',
      periodo_id: 'per-bim-3',
      titulo: 'Equações do 1º Grau & Raciocínio Algébrico',
      descricao:
        'Descubra o valor da incógnita em situações práticas do dia a dia e treine as regras de isolamento.',
      prazo: '2026-10-15',
      status: 'publicada',
      criado_por: 'usr-prof-ana',
    },
    {
      id: 'ativ-cien-01',
      created_at: '2026-09-19T10:00:00Z',
      oferta_id: 'oferta-cien-6b',
      periodo_id: 'per-bim-3',
      titulo: 'Ecologia e Cadeias Alimentares',
      descricao: 'Produtores, consumidores e a importância da preservação dos biomas brasileiros.',
      prazo: '2026-10-18',
      status: 'publicada',
      criado_por: 'usr-prof-carlos',
    },
  ];

  // 9. Questões e Alternativas (extraídas de prototipo/js/data.js)
  const questoes: Questao[] = [
    // Matemática - Questão 1
    {
      id: 'q-mat-1',
      created_at: agora,
      atividade_id: 'ativ-mat-01',
      ordem: 1,
      enunciado:
        'Um pacote de figurinhas custa R$ 4,00. João comprou x pacotes e pagou com uma nota de R$ 50,00, recebendo R$ 18,00 de troco. Qual equação representa corretamente essa situação para descobrir o valor de x?',
      dica: 'Pense no equilíbrio: O valor total gasto nas figurinhas (4 vezes x) somado com o troco recebido (18) deve dar exatamente o valor da nota entregue (50).',
      explicacao:
        'O valor gasto nas figurinhas é 4x (R$ 4 por pacote). Somando com o troco de R$ 18,00 recebido, temos a nota entregue: 4x + 18 = 50. Resolvendo: 4x = 32 -> x = 8 pacotes.',
    },
    // Matemática - Questão 2
    {
      id: 'q-mat-2',
      created_at: agora,
      atividade_id: 'ativ-mat-01',
      ordem: 2,
      enunciado: 'Resolva a equação algébrica: 3x - 7 = 14. Qual é o valor real de x?',
      dica: 'Lembre-se da regra da balança: ao passar o número -7 para o outro lado da igualdade, ele inverte a operação tornando-se +7.',
      explicacao:
        'Passo 1: 3x = 14 + 7 -> 3x = 21. Passo 2: x = 21 / 3 -> x = 7. Portanto, o valor correto é 7.',
    },
    // Matemática - Questão 3
    {
      id: 'q-mat-3',
      created_at: agora,
      atividade_id: 'ativ-mat-01',
      ordem: 3,
      enunciado:
        'O dobro da idade de Marina somado a 5 anos é igual a 29 anos. Qual é a idade atual de Marina?',
      dica: "Chame a idade de Marina de 'm'. O dobro da idade é 2m. Monte a equação: 2m + 5 = 29 e isole a letra 'm'.",
      explicacao:
        'Montagem: 2m + 5 = 29. Subtraindo 5 dos dois lados: 2m = 24. Dividindo por 2: m = 12 anos.',
    },
    // Matemática - Questão 4
    {
      id: 'q-mat-4',
      created_at: agora,
      atividade_id: 'ativ-mat-01',
      ordem: 4,
      enunciado:
        'Qual das afirmações a seguir sobre números na reta numérica é matematicamente CORRETA?',
      dica: 'Pense em saldo ou temperatura: dever R$ 3 (-3) é uma situação melhor do que dever R$ 8 (-8). Na reta numérica, quem fica mais à direita é sempre maior.',
      explicacao:
        'Na reta numérica orientada da esquerda para a direita, qualquer número à direita de outro é maior. Como -3 está à direita de -8, -3 > -8.',
    },

    // Ciências - Questão 1
    {
      id: 'q-cien-1',
      created_at: agora,
      atividade_id: 'ativ-cien-01',
      ordem: 1,
      enunciado:
        'Em uma cadeia alimentar simples (Capim -> Grilo -> Sapo -> Cobra), qual organismo desempenha o papel de PRODUTOR?',
      dica: 'Lembre-se: produtores são seres autotróficos, que produzem seu próprio alimento através da fotossíntese.',
      explicacao:
        'O capim é um vegetal que realiza fotossíntese para produzir energia, sendo a base produtora da cadeia alimentar.',
    },
    // Ciências - Questão 2
    {
      id: 'q-cien-2',
      created_at: agora,
      atividade_id: 'ativ-cien-01',
      ordem: 2,
      enunciado:
        'Ao observar o gafanhoto alimentando-se do capim, em qual nível trófico ele se classifica?',
      dica: 'Organismos que se alimentam diretamente dos produtores ocupam o primeiro nível de consumo.',
      explicacao:
        'Por ser herbívoro e consumir diretamente os produtores vegetais, o gafanhoto é um consumidor primário.',
    },
    // Ciências - Questão 3
    {
      id: 'q-cien-3',
      created_at: agora,
      atividade_id: 'ativ-cien-01',
      ordem: 3,
      enunciado:
        'Qual grupo de organismos é responsável por reciclar a matéria orgânica morta no ecossistema, devolvendo nutrientes ao solo?',
      dica: 'Fazem parte deste grupo os fungos e a maioria das bactérias.',
      explicacao:
        'Os decompositores (fungos e bactérias) decompõem restos de animais e vegetais, fechando o ciclo biogeoquímico dos nutrientes.',
    },
    // Ciências - Questão 4
    {
      id: 'q-cien-4',
      created_at: agora,
      atividade_id: 'ativ-cien-01',
      ordem: 4,
      enunciado:
        'O que acontece tipicamente em uma cadeia alimentar caso a população de sapos sofra uma redução drástica por poluição?',
      dica: 'Analise quem era predado pelo sapo e quem predava o sapo.',
      explicacao:
        'Com menos sapos, a população de grilos (suas presas) tende a se multiplicar em desequilíbrio ecológico.',
    },
  ];

  // 10. Alternativas
  const alternativas: Alternativa[] = [
    // Matemática Q1
    {
      id: 'alt-m1-a',
      created_at: agora,
      questao_id: 'q-mat-1',
      letra: 'A',
      texto: '4x + 18 = 50',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-m1-b',
      created_at: agora,
      questao_id: 'q-mat-1',
      letra: 'B',
      texto: '4x - 18 = 50',
      correta: false,
      por_que_errou:
        'Pegadinha comum: subtrair o troco em vez de somá-lo ao total gasto. Se João recebeu troco, o gasto mais o troco completam os R$ 50,00.',
    },
    {
      id: 'alt-m1-c',
      created_at: agora,
      questao_id: 'q-mat-1',
      letra: 'C',
      texto: '50x + 4 = 18',
      correta: false,
      por_que_errou:
        "Atenção: o 'x' é a quantidade de pacotes de R$ 4,00, e não a quantidade de notas de 50.",
    },
    {
      id: 'alt-m1-d',
      created_at: agora,
      questao_id: 'q-mat-1',
      letra: 'D',
      texto: '4x = 50 + 18',
      correta: false,
      por_que_errou:
        'Somar 50 com 18 faria o gasto com figurinhas ser de R$ 68,00, o que não faz sentido pois ele entregou apenas R$ 50,00.',
    },

    // Matemática Q2
    {
      id: 'alt-m2-a',
      created_at: agora,
      questao_id: 'q-mat-2',
      letra: 'A',
      texto: 'x = 7',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-m2-b',
      created_at: agora,
      questao_id: 'q-mat-2',
      letra: 'B',
      texto: 'x = 2,33',
      correta: false,
      por_que_errou:
        'Pegadinha clássica! Subtraiu 7 de 14 (14 - 7 = 7) em vez de somar, e depois dividiu por 3. Lembre-se: -7 passa para o outro lado somando (+7)!',
    },
    {
      id: 'alt-m2-c',
      created_at: agora,
      questao_id: 'q-mat-2',
      letra: 'C',
      texto: 'x = 21',
      correta: false,
      por_que_errou:
        'Atenção: 21 é o valor de 3x (14 + 7 = 21). Você ainda precisa passar o 3 dividindo para encontrar x sozinho!',
    },
    {
      id: 'alt-m2-d',
      created_at: agora,
      questao_id: 'q-mat-2',
      letra: 'D',
      texto: 'x = 3',
      correta: false,
      por_que_errou:
        'Apenas tentou chutar um valor pequeno sem aplicar a inversão das operações algébricas.',
    },

    // Matemática Q3
    {
      id: 'alt-m3-a',
      created_at: agora,
      questao_id: 'q-mat-3',
      letra: 'A',
      texto: '17 anos',
      correta: false,
      por_que_errou:
        'Pegadinha: somou 5 a 29 (34) e depois dividiu por 2 (17). O +5 deve passar subtraindo!',
    },
    {
      id: 'alt-m3-b',
      created_at: agora,
      questao_id: 'q-mat-3',
      letra: 'B',
      texto: '12 anos',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-m3-c',
      created_at: agora,
      questao_id: 'q-mat-3',
      letra: 'C',
      texto: '14 anos',
      correta: false,
      por_que_errou:
        "Subtraiu 5 de 29 e achou 24, mas esqueceu de dividir por 2 para desfazer o 'dobro'.",
    },
    {
      id: 'alt-m3-d',
      created_at: agora,
      questao_id: 'q-mat-3',
      letra: 'D',
      texto: '24 anos',
      correta: false,
      por_que_errou: 'Apenas fez 29 - 5 = 24 e parou por aí sem isolar a incógnita.',
    },

    // Matemática Q4
    {
      id: 'alt-m4-a',
      created_at: agora,
      questao_id: 'q-mat-4',
      letra: 'A',
      texto: 'O número -8 é maior que -3 porque o valor absoluto de 8 é maior que 3.',
      correta: false,
      por_que_errou:
        'Pegadinha de valor absoluto! Nos números negativos, quanto mais longe do zero à esquerda, MENOR é o valor real.',
    },
    {
      id: 'alt-m4-b',
      created_at: agora,
      questao_id: 'q-mat-4',
      letra: 'B',
      texto: 'A soma de dois números negativos sempre resulta em um número positivo.',
      correta: false,
      por_que_errou:
        'Confundiu com regra da multiplicação! Na adição, somar dívida com dívida dá uma dívida ainda maior: (-2) + (-3) = -5.',
    },
    {
      id: 'alt-m4-c',
      created_at: agora,
      questao_id: 'q-mat-4',
      letra: 'C',
      texto: 'Na reta numérica, -3 está mais à direita que -8, portanto -3 é maior que -8.',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-m4-d',
      created_at: agora,
      questao_id: 'q-mat-4',
      letra: 'D',
      texto: 'Multiplicar dois números negativos resulta em um número negativo.',
      correta: false,
      por_que_errou:
        'Regra de sinais da multiplicação: menos vezes menos resulta em positivo (+)!',
    },

    // Ciências Q1
    {
      id: 'alt-c1-a',
      created_at: agora,
      questao_id: 'q-cien-1',
      letra: 'A',
      texto: 'O Grilo',
      correta: false,
      por_que_errou:
        'O grilo é um consumidor primário (herbívoro), pois alimenta-se da planta.',
    },
    {
      id: 'alt-c1-b',
      created_at: agora,
      questao_id: 'q-cien-1',
      letra: 'B',
      texto: 'O Capim',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-c1-c',
      created_at: agora,
      questao_id: 'q-cien-1',
      letra: 'C',
      texto: 'O Sapo',
      correta: false,
      por_que_errou:
        'O sapo é um consumidor secundário (carnívoro), alimenta-se do grilo.',
    },
    {
      id: 'alt-c1-d',
      created_at: agora,
      questao_id: 'q-cien-1',
      letra: 'D',
      texto: 'A Cobra',
      correta: false,
      por_que_errou:
        'A cobra é um consumidor terciário nesta cadeia, alimentando-se do sapo.',
    },

    // Ciências Q2
    {
      id: 'alt-c2-a',
      created_at: agora,
      questao_id: 'q-cien-2',
      letra: 'A',
      texto: 'Consumidor Primário',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-c2-b',
      created_at: agora,
      questao_id: 'q-cien-2',
      letra: 'B',
      texto: 'Produtor Autotrófico',
      correta: false,
      por_que_errou:
        'Animais não produzem seu próprio alimento; são organismos heterotróficos.',
    },
    {
      id: 'alt-c2-c',
      created_at: agora,
      questao_id: 'q-cien-2',
      letra: 'C',
      texto: 'Decompositor',
      correta: false,
      por_que_errou:
        'Decompositores são principalmente fungos e bactérias, e não insetos herbívoros.',
    },
    {
      id: 'alt-c2-d',
      created_at: agora,
      questao_id: 'q-cien-2',
      letra: 'D',
      texto: 'Consumidor Terciário',
      correta: false,
      por_que_errou:
        'Consumidores terciários são predadores de outros carnívoros no topo da cadeia.',
    },

    // Ciências Q3
    {
      id: 'alt-c3-a',
      created_at: agora,
      questao_id: 'q-cien-3',
      letra: 'A',
      texto: 'Produtores aquáticos',
      correta: false,
      por_que_errou: 'Algas e fitoplâncton realizam fotossíntese, produzindo matéria orgânica.',
    },
    {
      id: 'alt-c3-b',
      created_at: agora,
      questao_id: 'q-cien-3',
      letra: 'B',
      texto: 'Fungos e Bactérias (Decompositores)',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-c3-c',
      created_at: agora,
      questao_id: 'q-cien-3',
      letra: 'C',
      texto: 'Grandes herbívoros terrestres',
      correta: false,
      por_que_errou: 'Herbívoros consomem vegetais e não decompõem matéria orgânica.',
    },
    {
      id: 'alt-c3-d',
      created_at: agora,
      questao_id: 'q-cien-3',
      letra: 'D',
      texto: 'Parasitas intestinais',
      correta: false,
      por_que_errou: 'Parasitas sobrevivem de hospedeiros vivos e não reciclam nutrientes no solo.',
    },

    // Ciências Q4
    {
      id: 'alt-c4-a',
      created_at: agora,
      questao_id: 'q-cien-4',
      letra: 'A',
      texto: 'Aumento expressivo na população de grilos',
      correta: true,
      por_que_errou: null,
    },
    {
      id: 'alt-c4-b',
      created_at: agora,
      questao_id: 'q-cien-4',
      letra: 'B',
      texto: 'Multiplicação imediata das cobras',
      correta: false,
      por_que_errou: 'Sem sapos como alimento, a população de cobras tende a diminuir pela falta de presas.',
    },
    {
      id: 'alt-c4-c',
      created_at: agora,
      questao_id: 'q-cien-4',
      letra: 'C',
      texto: 'Extinção completa das plantas da região',
      correta: false,
      por_que_errou: 'As plantas sofrerão maior pressão de herbivoria, mas a extinção não é direta.',
    },
    {
      id: 'alt-c4-d',
      created_at: agora,
      questao_id: 'q-cien-4',
      letra: 'D',
      texto: 'Nenhuma alteração, pois a cadeia é autoimune',
      correta: false,
      por_que_errou: 'Cadeias ecológicas são sensíveis e interdependentes; qualquer corte desequilibra o todo.',
    },
  ];

  // 11. Respostas Pré-cadastradas (para demonstrar aproveitamento e mapa de calor)
  // Aluno 1: Lucas Oliveira (aluno-7a-1) - Acertou 4 de 4
  // Aluno 2: Beatriz Santos (aluno-7a-2) - Acertou 3 de 4 (errou Q1 marcando B)
  // Aluno 3: Gabriel Lima (aluno-7a-3) - Acertou 2 de 4 (errou Q1 marcando B, errou Q2 marcando B)
  const respostas: Resposta[] = [
    // Lucas
    {
      id: 'resp-lucas-1',
      created_at: '2026-09-20T09:10:00Z',
      aluno_id: 'aluno-7a-1',
      questao_id: 'q-mat-1',
      alternativa_id: 'alt-m1-a',
      acertou: true,
      respondida_em: '2026-09-20T09:10:00Z',
    },
    {
      id: 'resp-lucas-2',
      created_at: '2026-09-20T09:12:00Z',
      aluno_id: 'aluno-7a-1',
      questao_id: 'q-mat-2',
      alternativa_id: 'alt-m2-a',
      acertou: true,
      respondida_em: '2026-09-20T09:12:00Z',
    },
    {
      id: 'resp-lucas-3',
      created_at: '2026-09-20T09:14:00Z',
      aluno_id: 'aluno-7a-1',
      questao_id: 'q-mat-3',
      alternativa_id: 'alt-m3-b',
      acertou: true,
      respondida_em: '2026-09-20T09:14:00Z',
    },
    {
      id: 'resp-lucas-4',
      created_at: '2026-09-20T09:16:00Z',
      aluno_id: 'aluno-7a-1',
      questao_id: 'q-mat-4',
      alternativa_id: 'alt-m4-c',
      acertou: true,
      respondida_em: '2026-09-20T09:16:00Z',
    },

    // Beatriz
    {
      id: 'resp-bia-1',
      created_at: '2026-09-20T10:00:00Z',
      aluno_id: 'aluno-7a-2',
      questao_id: 'q-mat-1',
      alternativa_id: 'alt-m1-b', // Errou: pegadinha troco
      acertou: false,
      respondida_em: '2026-09-20T10:00:00Z',
    },
    {
      id: 'resp-bia-2',
      created_at: '2026-09-20T10:02:00Z',
      aluno_id: 'aluno-7a-2',
      questao_id: 'q-mat-2',
      alternativa_id: 'alt-m2-a',
      acertou: true,
      respondida_em: '2026-09-20T10:02:00Z',
    },
    {
      id: 'resp-bia-3',
      created_at: '2026-09-20T10:04:00Z',
      aluno_id: 'aluno-7a-2',
      questao_id: 'q-mat-3',
      alternativa_id: 'alt-m3-b',
      acertou: true,
      respondida_em: '2026-09-20T10:04:00Z',
    },
    {
      id: 'resp-bia-4',
      created_at: '2026-09-20T10:06:00Z',
      aluno_id: 'aluno-7a-2',
      questao_id: 'q-mat-4',
      alternativa_id: 'alt-m4-c',
      acertou: true,
      respondida_em: '2026-09-20T10:06:00Z',
    },

    // Gabriel
    {
      id: 'resp-gab-1',
      created_at: '2026-09-20T11:00:00Z',
      aluno_id: 'aluno-7a-3',
      questao_id: 'q-mat-1',
      alternativa_id: 'alt-m1-b', // Errou: pegadinha troco
      acertou: false,
      respondida_em: '2026-09-20T11:00:00Z',
    },
    {
      id: 'resp-gab-2',
      created_at: '2026-09-20T11:03:00Z',
      aluno_id: 'aluno-7a-3',
      questao_id: 'q-mat-2',
      alternativa_id: 'alt-m2-b', // Errou: subtraiu em vez de somar
      acertou: false,
      respondida_em: '2026-09-20T11:03:00Z',
    },
    {
      id: 'resp-gab-3',
      created_at: '2026-09-20T11:05:00Z',
      aluno_id: 'aluno-7a-3',
      questao_id: 'q-mat-3',
      alternativa_id: 'alt-m3-b',
      acertou: true,
      respondida_em: '2026-09-20T11:05:00Z',
    },
    {
      id: 'resp-gab-4',
      created_at: '2026-09-20T11:07:00Z',
      aluno_id: 'aluno-7a-3',
      questao_id: 'q-mat-4',
      alternativa_id: 'alt-m4-c',
      acertou: true,
      respondida_em: '2026-09-20T11:07:00Z',
    },
  ];

  // 12. Frequências Registradas
  const datasFrequencia = ['2026-09-21', '2026-09-22', '2026-09-23'];
  const frequencias: Frequencia[] = [];

  for (const data of datasFrequencia) {
    for (const aluno of alunosBrutosTurma7A) {
      // Pequena variação pedagógica
      let status: 'P' | 'F' | 'J' = 'P';
      if (aluno.id === 'aluno-7a-3' && data === '2026-09-22') status = 'F';
      if (aluno.id === 'aluno-7a-5' && data === '2026-09-23') status = 'J';

      frequencias.push({
        id: `freq-${aluno.id}-${data}`,
        created_at: agora,
        oferta_id: 'oferta-mat-7a',
        aluno_id: aluno.id,
        data,
        status,
        registrado_por: 'usr-prof-ana',
      });
    }
  }

  // 13. Avisos
  const avisos: Aviso[] = [
    {
      id: 'aviso-esc-1',
      created_at: agora,
      escola_id: escolaId,
      autor_id: 'usr-dir-001',
      turma_id: null, // Toda a escola
      titulo: 'Reunião de Pais e Mestres do 3º Bimestre',
      mensagem:
        'Convidamos todas as famílias para a entrega de notas e diálogo pedagógico nesta quinta-feira às 19h.',
      prioridade: 'alta',
      publicado_em: '2026-09-21T08:00:00Z',
    },
    {
      id: 'aviso-turma-7a',
      created_at: agora,
      escola_id: escolaId,
      autor_id: 'usr-prof-ana',
      turma_id: 'turma-7a',
      titulo: 'Trazer régua e calculadora simples na próxima aula',
      mensagem:
        'Turma, iniciaremos a construção gráfica das equações de reta. Tragam régua de 30 cm!',
      prioridade: 'media',
      publicado_em: '2026-09-22T14:30:00Z',
    },
  ];

  return {
    escolas,
    perfis,
    credenciais,
    periodos,
    disciplinas,
    turmas,
    ofertas,
    alunos,
    atividades,
    questoes,
    alternativas,
    respostas,
    frequencias,
    avisos,
    aluno_sessoes: [],
    pin_tentativas: [],
  };
}
