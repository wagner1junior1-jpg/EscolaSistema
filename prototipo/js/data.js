// Initial Seed Data for Sistema de Questões Escolar

window.DEFAULT_DATA = {
  seriesDisponiveis: [
    { id: "fund-1", grupo: "Fundamental I", anos: ["1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano"] },
    { id: "fund-2", grupo: "Fundamental II", anos: ["6º Ano", "7º Ano", "8º Ano", "9º Ano"] },
    { id: "medio", grupo: "Ensino Médio", anos: ["1º Ano EM", "2º Ano EM", "3º Ano EM"] }
  ],

  disciplinas: [
    "Matemática",
    "Língua Portuguesa",
    "Ciências da Natureza",
    "História",
    "Geografia",
    "Língua Inglesa",
    "Arte",
    "Educação Física"
  ],

  turmas: [
    {
      id: "turma-1",
      nome: "7º Ano A",
      serie_ano: "7º Ano",
      segmento: "Fundamental II",
      disciplina: "Matemática",
      codigo_acesso: "MAT7A",
      professor_nome: "Profª Ana Paula",
      ano_letivo: "2026",
      createdAt: "2026-09-10T08:00:00Z"
    },
    {
      id: "turma-2",
      nome: "7º Ano B",
      serie_ano: "7º Ano",
      segmento: "Fundamental II",
      disciplina: "Matemática",
      codigo_acesso: "MAT7B",
      professor_nome: "Profª Ana Paula",
      ano_letivo: "2026",
      createdAt: "2026-09-10T08:30:00Z"
    },
    {
      id: "turma-3",
      nome: "6º Ano B",
      serie_ano: "6º Ano",
      segmento: "Fundamental II",
      disciplina: "Ciências da Natureza",
      codigo_acesso: "CIEN6B",
      professor_nome: "Prof. Carlos Roberto",
      ano_letivo: "2026",
      createdAt: "2026-09-12T10:00:00Z"
    },
    {
      id: "turma-4",
      nome: "5º Ano A",
      serie_ano: "5º Ano",
      segmento: "Fundamental I",
      disciplina: "Língua Portuguesa",
      codigo_acesso: "PORT5A",
      professor_nome: "Profª Fernanda Dias",
      ano_letivo: "2026",
      createdAt: "2026-09-14T11:00:00Z"
    }
  ],

  alunos: [
    // Turma 1 - MAT7A
    { id: "aluno-101", turma_id: "turma-1", nome_completo: "Lucas Oliveira", pin_4_digitos: "1420", genero: "M" },
    { id: "aluno-102", turma_id: "turma-1", nome_completo: "Beatriz Santos", pin_4_digitos: "3891", genero: "F" },
    { id: "aluno-103", turma_id: "turma-1", nome_completo: "Gabriel Lima", pin_4_digitos: "7254", genero: "M" },
    { id: "aluno-104", turma_id: "turma-1", nome_completo: "Mariana Souza", pin_4_digitos: "5012", genero: "F" },
    { id: "aluno-105", turma_id: "turma-1", nome_completo: "Enzo Gabriel Ferreira", pin_4_digitos: "2198", genero: "M" },
    { id: "aluno-106", turma_id: "turma-1", nome_completo: "Sophia Ribeiro", pin_4_digitos: "6432", genero: "F" },
    { id: "aluno-107", turma_id: "turma-1", nome_completo: "Matheus Carvalho", pin_4_digitos: "8845", genero: "M" },
    { id: "aluno-108", turma_id: "turma-1", nome_completo: "Isabella Martins", pin_4_digitos: "4173", genero: "F" },
    { id: "aluno-109", turma_id: "turma-1", nome_completo: "Davi Lucca Alves", pin_4_digitos: "9310", genero: "M" },
    { id: "aluno-110", turma_id: "turma-1", nome_completo: "Julia Cardoso", pin_4_digitos: "1567", genero: "F" },

    // Turma 2 - MAT7B
    { id: "aluno-201", turma_id: "turma-2", nome_completo: "Cauã Mendes", pin_4_digitos: "3321", genero: "M" },
    { id: "aluno-202", turma_id: "turma-2", nome_completo: "Lorena Silva", pin_4_digitos: "8842", genero: "F" },
    { id: "aluno-203", turma_id: "turma-2", nome_completo: "Pedro Henrique Ramos", pin_4_digitos: "4509", genero: "M" },
    { id: "aluno-204", turma_id: "turma-2", nome_completo: "Camila Nogueira", pin_4_digitos: "6124", genero: "F" },

    // Turma 3 - CIEN6B
    { id: "aluno-301", turma_id: "turma-3", nome_completo: "Arthur Guimarães", pin_4_digitos: "1098", genero: "M" },
    { id: "aluno-302", turma_id: "turma-3", nome_completo: "Helena Castro", pin_4_digitos: "4376", genero: "F" },
    { id: "aluno-303", turma_id: "turma-3", nome_completo: "Thiago Pires", pin_4_digitos: "8712", genero: "M" },

    // Turma 4 - PORT5A
    { id: "aluno-401", turma_id: "turma-4", nome_completo: "Alice Viana", pin_4_digitos: "2351", genero: "F" },
    { id: "aluno-402", turma_id: "turma-4", nome_completo: "Bernardo Peixoto", pin_4_digitos: "7729", genero: "M" },
    { id: "aluno-403", turma_id: "turma-4", nome_completo: "Clara Duarte", pin_4_digitos: "5481", genero: "F" }
  ],

  atividades: [
    {
      id: "ativ-1",
      turma_id: "turma-1",
      titulo: "Equações do 1º Grau & Raciocínio Algébrico",
      descricao: "Descubra o valor da incógnita em situações práticas do dia a dia e treine as regras de isolamento.",
      prazo_entrega: "2026-10-15",
      ativa: true,
      createdAt: "2026-09-18T14:00:00Z"
    },
    {
      id: "ativ-2",
      turma_id: "turma-1",
      titulo: "Desafio de Números Inteiros & Reta Numérica",
      descricao: "Fixação rápida sobre números negativos, regras de sinais e comparações de temperatura e saldo.",
      prazo_entrega: "2026-10-22",
      ativa: true,
      createdAt: "2026-09-20T09:30:00Z"
    },
    {
      id: "ativ-3",
      turma_id: "turma-3",
      titulo: "Ecologia e Cadeias Alimentares",
      descricao: "Produtores, consumidores e a importância da preservação dos biomas.",
      prazo_entrega: "2026-10-18",
      ativa: true,
      createdAt: "2026-09-19T10:00:00Z"
    },
    {
      id: "ativ-4",
      turma_id: "turma-4",
      titulo: "Interpretação e Substantivos",
      descricao: "Exercícios curtos com foco em leitura atenta e classificação de palavras.",
      prazo_entrega: "2026-10-16",
      ativa: true,
      createdAt: "2026-09-21T08:00:00Z"
    }
  ],

  questoes: [
    // Questões para ativ-1 (Equações do 1º Grau - Turma 1)
    {
      id: "quest-101",
      atividade_id: "ativ-1",
      numero: 1,
      enunciado: "Um pacote de figurinhas custa R$ 4,00. João comprou x pacotes e pagou com uma nota de R$ 50,00, recebendo R$ 18,00 de troco. Qual equação representa corretamente essa situação para descobrir o valor de x?",
      alternativas: [
        "A) 4x + 18 = 50",
        "B) 4x - 18 = 50",
        "C) 50x + 4 = 18",
        "D) 4x = 50 + 18"
      ],
      resposta_correta_index: 0,
      dica: "Pense no equilíbrio: O valor total gasto nas figurinhas (4 vezes x) somado com o troco recebido (18) deve dar exatamente o valor da nota entregue (50).",
      por_que_errou: {
        "1": "Pegadinha comum: subtrair o troco em vez de somá-lo ao total gasto. Se João recebeu troco, o gasto mais o troco completam os R$ 50,00.",
        "2": "Atenção: o 'x' é a quantidade de pacotes de R$ 4,00, e não a quantidade de notas de 50.",
        "3": "Somar 50 com 18 faria o gasto com figurinhas ser de R$ 68,00, o que não faz sentido pois ele entregou apenas R$ 50,00."
      },
      explicacao: "O valor gasto nas figurinhas é 4x (R$ 4 por pacote). Somando com o troco de R$ 18,00 recebido, temos a nota entregue: 4x + 18 = 50. Resolvendo: 4x = 32 -> x = 8 pacotes."
    },
    {
      id: "quest-102",
      atividade_id: "ativ-1",
      numero: 2,
      enunciado: "Resolva a equação algébrica: 3x - 7 = 14. Qual é o valor real de x?",
      alternativas: [
        "A) x = 7",
        "B) x = 2,33",
        "C) x = 21",
        "D) x = 3"
      ],
      resposta_correta_index: 0,
      dica: "Lembre-se da regra da balança: ao passar o número -7 para o outro lado da igualdade, ele inverte a operação tornando-se +7.",
      por_que_errou: {
        "1": "Pegadinha clássica! Subtraiu 7 de 14 (14 - 7 = 7) em vez de somar, e depois dividiu por 3. Lembre-se: -7 passa para o outro lado somando (+7)!",
        "2": "Atenção: 21 é o valor de 3x (14 + 7 = 21). Você ainda precisa passar o 3 dividindo para encontrar x sozinho!",
        "3": "Apenas tentou chutar um valor pequeno sem aplicar a inversão das operações."
      },
      explicacao: "Passo 1: 3x = 14 + 7 -> 3x = 21. Passo 2: x = 21 / 3 -> x = 7. Portanto, o valor correto é 7."
    },
    {
      id: "quest-103",
      atividade_id: "ativ-1",
      numero: 3,
      enunciado: "O dobro da idade de Marina somado a 5 anos é igual a 29 anos. Qual é a idade atual de Marina?",
      alternativas: [
        "A) 17 anos",
        "B) 12 anos",
        "C) 14 anos",
        "D) 24 anos"
      ],
      resposta_correta_index: 1,
      dica: "Chame a idade de Marina de 'm'. O dobro da idade é 2m. Monte a equação: 2m + 5 = 29 e isole a letra 'm'.",
      por_que_errou: {
        "0": "Pegadinha: somou 5 a 29 (34) e depois dividiu por 2 (17). O +5 deve passar subtraindo!",
        "2": "Subtraiu 5 de 29 e achou 24, mas esqueceu de dividir por 2 para desfazer o 'dobro'.",
        "3": "Apenas fez 29 - 5 = 24 e parou por aí."
      },
      explicacao: "Montagem: 2m + 5 = 29. Subtraindo 5 dos dois lados: 2m = 24. Dividindo por 2: m = 12 anos."
    },
    {
      id: "quest-104",
      atividade_id: "ativ-1",
      numero: 4,
      enunciado: "Qual das afirmações a seguir sobre números na reta numérica é matematicamente CORRETA?",
      alternativas: [
        "A) O número -8 é maior que -3 porque o valor absoluto de 8 é maior que 3.",
        "B) A soma de dois números negativos sempre resulta em um número positivo.",
        "C) Na reta numérica, -3 está mais à direita que -8, portanto -3 é maior que -8.",
        "D) Multiplicar dois números negativos resulta em um número negativo."
      ],
      resposta_correta_index: 2,
      dica: "Pense em saldo ou temperatura: dever R$ 3 (-3) é uma situação melhor do que dever R$ 8 (-8). Na reta numérica, quem fica mais à direita é sempre maior.",
      por_que_errou: {
        "0": "Pegadinha de valor absoluto! Nos números negativos, quanto mais longe do zero à esquerda, MENOR é o valor. Portanto -8 é menor que -3.",
        "1": "Confundiu com regra da multiplicação! Na adição, somar dívida com dívida dá uma dívida ainda maior: (-2) + (-3) = -5.",
        "3": "Regra de sinais da multiplicação: menos vezes menos resulta em positivo (+)!"
      },
      explicacao: "Na reta numérica orientada da esquerda para a direita, qualquer número à direita de outro é maior. Como -3 está à direita de -8, -3 > -8."
    },

    // Questões para ativ-3 (Ciências - 6º Ano)
    {
      id: "quest-301",
      atividade_id: "ativ-3",
      numero: 1,
      enunciado: "Em uma cadeia alimentar simples (Capim -> Grilo -> Sapo -> Cobra), qual organismo desempenha o papel de PRODUTOR?",
      alternativas: [
        "A) O Grilo",
        "B) O Capim",
        "C) O Sapo",
        "D) A Cobra"
      ],
      resposta_correta_index: 1,
      dica: "Lembre-se: produtores são seres autotróficos, que produzem seu próprio alimento através da fotossíntese.",
      por_que_errou: {
        "0": "O grilo é um consumidor primário (herbívoro), pois alimenta-se da planta.",
        "2": "O sapo é um consumidor secundário (carnívoro), alimenta-se do grilo.",
        "3": "A cobra é um consumidor terciário no topo dessa cadeia."
      },
      explicacao: "O capim é um vegetal que realiza fotossíntese para produzir energia, sendo a base produtora da cadeia."
    }
  ],

  // Respostas já pré-cadastradas para demonstrar o Mapa de Calor em tempo real para a Diretora!
  respostas: [
    // Lucas Oliveira (aluno-101) - Acertou 4 de 4 (100%)
    { id: "resp-1", atividade_id: "ativ-1", questao_id: "quest-101", aluno_id: "aluno-101", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T09:12:00Z" },
    { id: "resp-2", atividade_id: "ativ-1", questao_id: "quest-102", aluno_id: "aluno-101", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T09:13:00Z" },
    { id: "resp-3", atividade_id: "ativ-1", questao_id: "quest-103", aluno_id: "aluno-101", alternativa_escolhida: 1, acertou: true, data_resposta: "2026-09-21T09:14:00Z" },
    { id: "resp-4", atividade_id: "ativ-1", questao_id: "quest-104", aluno_id: "aluno-101", alternativa_escolhida: 2, acertou: true, data_resposta: "2026-09-21T09:15:00Z" },

    // Beatriz Santos (aluno-102) - Acertou 3 de 4 (75%) - Caiu na pegadinha da Q2
    { id: "resp-5", atividade_id: "ativ-1", questao_id: "quest-101", aluno_id: "aluno-102", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T09:30:00Z" },
    { id: "resp-6", atividade_id: "ativ-1", questao_id: "quest-102", aluno_id: "aluno-102", alternativa_escolhida: 1, acertou: false, data_resposta: "2026-09-21T09:32:00Z" },
    { id: "resp-7", atividade_id: "ativ-1", questao_id: "quest-103", aluno_id: "aluno-102", alternativa_escolhida: 1, acertou: true, data_resposta: "2026-09-21T09:33:00Z" },
    { id: "resp-8", atividade_id: "ativ-1", questao_id: "quest-104", aluno_id: "aluno-102", alternativa_escolhida: 2, acertou: true, data_resposta: "2026-09-21T09:34:00Z" },

    // Gabriel Lima (aluno-103) - Acertou 2 de 4 (50%) - Caiu na pegadinha da Q2 e da Q4
    { id: "resp-9", atividade_id: "ativ-1", questao_id: "quest-101", aluno_id: "aluno-103", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T10:05:00Z" },
    { id: "resp-10", atividade_id: "ativ-1", questao_id: "quest-102", aluno_id: "aluno-103", alternativa_escolhida: 1, acertou: false, data_resposta: "2026-09-21T10:07:00Z" },
    { id: "resp-11", atividade_id: "ativ-1", questao_id: "quest-103", aluno_id: "aluno-103", alternativa_escolhida: 1, acertou: true, data_resposta: "2026-09-21T10:08:00Z" },
    { id: "resp-12", atividade_id: "ativ-1", questao_id: "quest-104", aluno_id: "aluno-103", alternativa_escolhida: 0, acertou: false, data_resposta: "2026-09-21T10:10:00Z" },

    // Mariana Souza (aluno-104) - Acertou 4 de 4 (100%)
    { id: "resp-13", atividade_id: "ativ-1", questao_id: "quest-101", aluno_id: "aluno-104", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T11:15:00Z" },
    { id: "resp-14", atividade_id: "ativ-1", questao_id: "quest-102", aluno_id: "aluno-104", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T11:17:00Z" },
    { id: "resp-15", atividade_id: "ativ-1", questao_id: "quest-103", aluno_id: "aluno-104", alternativa_escolhida: 1, acertou: true, data_resposta: "2026-09-21T11:18:00Z" },
    { id: "resp-16", atividade_id: "ativ-1", questao_id: "quest-104", aluno_id: "aluno-104", alternativa_escolhida: 2, acertou: true, data_resposta: "2026-09-21T11:20:00Z" },

    // Enzo Gabriel (aluno-105) - Acertou 2 de 4 (50%) - Caiu nas pegadinhas de Q1 e Q2
    { id: "resp-17", atividade_id: "ativ-1", questao_id: "quest-101", aluno_id: "aluno-105", alternativa_escolhida: 1, acertou: false, data_resposta: "2026-09-21T14:20:00Z" },
    { id: "resp-18", atividade_id: "ativ-1", questao_id: "quest-102", aluno_id: "aluno-105", alternativa_escolhida: 1, acertou: false, data_resposta: "2026-09-21T14:22:00Z" },
    { id: "resp-19", atividade_id: "ativ-1", questao_id: "quest-103", aluno_id: "aluno-105", alternativa_escolhida: 1, acertou: true, data_resposta: "2026-09-21T14:23:00Z" },
    { id: "resp-20", atividade_id: "ativ-1", questao_id: "quest-104", aluno_id: "aluno-105", alternativa_escolhida: 2, acertou: true, data_resposta: "2026-09-21T14:24:00Z" },

    // Sophia Ribeiro (aluno-106) - Acertou 3 de 4 (75%) - Caiu na pegadinha da Q4
    { id: "resp-21", atividade_id: "ativ-1", questao_id: "quest-101", aluno_id: "aluno-106", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T16:00:00Z" },
    { id: "resp-22", atividade_id: "ativ-1", questao_id: "quest-102", aluno_id: "aluno-106", alternativa_escolhida: 0, acertou: true, data_resposta: "2026-09-21T16:01:00Z" },
    { id: "resp-23", atividade_id: "ativ-1", questao_id: "quest-103", aluno_id: "aluno-106", alternativa_escolhida: 1, acertou: true, data_resposta: "2026-09-21T16:03:00Z" },
    { id: "resp-24", atividade_id: "ativ-1", questao_id: "quest-104", aluno_id: "aluno-106", alternativa_escolhida: 0, acertou: false, data_resposta: "2026-09-21T16:05:00Z" }
  ],

  // Informações Institucionais da Escola
  escola: {
    nome: "Colégio Modelo SaberPontual",
    cidade_uf: "São Paulo - SP",
    ano_letivo: "2026",
    bimestre_ativo: "3º Bimestre",
    periodos: ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"],
    diretor_nome: "Prof. Marcos Andrade",
    coordenador_nome: "Profª Helena Vasconcelos"
  },

  // Corpo Docente da Escola (Professores)
  professores: [
    { id: "prof-1", nome: "Profª Ana Paula", email: "ana.paula@saberpontual.edu.br", especialidade: "Matemática", turmas_ids: ["turma-1", "turma-2"] },
    { id: "prof-2", nome: "Prof. Carlos Roberto", email: "carlos.roberto@saberpontual.edu.br", especialidade: "Ciências da Natureza", turmas_ids: ["turma-3"] },
    { id: "prof-3", nome: "Profª Fernanda Dias", email: "fernanda.dias@saberpontual.edu.br", especialidade: "Língua Portuguesa", turmas_ids: ["turma-4"] },
    { id: "prof-4", nome: "Profª Juliana Costa", email: "juliana.costa@saberpontual.edu.br", especialidade: "História", turmas_ids: ["turma-1"] },
    { id: "prof-5", nome: "Prof. Marcos Vinícius", email: "marcos.vinicius@saberpontual.edu.br", especialidade: "Geografia", turmas_ids: ["turma-1", "turma-2"] }
  ],

  // Mural de Avisos da Escola e das Turmas
  avisos: [
    {
      id: "aviso-1",
      titulo: "Reunião de Pais e Mestres do 3º Bimestre",
      mensagem: "Convidamos todos os pais e responsáveis para a entrega das avaliações formativas nesta sexta-feira às 18h no auditório principal.",
      autor: "Coordenação Pedagógica",
      alcance: "escola",
      prioridade: "alta",
      data: "2026-09-22"
    },
    {
      id: "aviso-2",
      titulo: "Feira de Ciências 2026: Inscrições Abertas",
      mensagem: "Estão abertas as inscrições para apresentação de projetos científicos dos alunos. Procure seu professor de Ciências até dia 30/10.",
      autor: "Direção Escolar",
      alcance: "escola",
      prioridade: "media",
      data: "2026-09-20"
    },
    {
      id: "aviso-3",
      titulo: "Trazer régua e transferidor para a aula",
      mensagem: "Turma 7º Ano A: iniciaremos a unidade prática de ângulos na próxima aula. Não esqueçam de trazer o material!",
      autor: "Profª Ana Paula",
      alcance: "turma-1",
      prioridade: "alta",
      data: "2026-09-23"
    }
  ],

  // Diário de Chamada / Frequência Escolar
  frequencias: [
    {
      id: "freq-1",
      turma_id: "turma-1",
      data: "2026-09-21",
      presencas: {
        "aluno-101": "P",
        "aluno-102": "P",
        "aluno-103": "P",
        "aluno-104": "P",
        "aluno-105": "F",
        "aluno-106": "P",
        "aluno-107": "P",
        "aluno-108": "P",
        "aluno-109": "P",
        "aluno-110": "J"
      }
    },
    {
      id: "freq-2",
      turma_id: "turma-1",
      data: "2026-09-22",
      presencas: {
        "aluno-101": "P",
        "aluno-102": "P",
        "aluno-103": "F",
        "aluno-104": "P",
        "aluno-105": "P",
        "aluno-106": "P",
        "aluno-107": "P",
        "aluno-108": "P",
        "aluno-109": "P",
        "aluno-110": "P"
      }
    },
    {
      id: "freq-3",
      turma_id: "turma-1",
      data: "2026-09-23",
      presencas: {
        "aluno-101": "P",
        "aluno-102": "P",
        "aluno-103": "P",
        "aluno-104": "P",
        "aluno-105": "P",
        "aluno-106": "P",
        "aluno-107": "P",
        "aluno-108": "P",
        "aluno-109": "P",
        "aluno-110": "P"
      }
    }
  ]
};
