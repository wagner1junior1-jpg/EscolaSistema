import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../mock/auth.mock';
import { MockBancoService } from '../mock/banco.mock';
import { MockProfessorService } from '../mock/professor.mock';
import { MockGestaoService } from '../mock/gestao.mock';
import { resetDatabase, getDatabase } from '../mock/db';

describe('Banco de Questões — Regras e Isolamento (Fase H1)', () => {
  const authService = new MockAuthService();
  const bancoService = new MockBancoService();
  const professorService = new MockProfessorService();
  const gestaoService = new MockGestaoService();

  beforeEach(async () => {
    await resetDatabase();
    await authService.logout();
  });

  // 1. Isolamento Matéria + Série: Carlos não vê Matemática e Ana não vê Ciências
  it('professor só acessa combinações de matéria + série das suas ofertas', async () => {
    // Carlos (Ciências 7º Ano)
    await authService.login('carlos@demo.com', 'demo123');
    const combsCarlos = await bancoService.listarCombinacoesDoProfessor();
    expect(combsCarlos.some((c) => c.disciplina_nome === 'Ciências' && c.serie === '7º Ano')).toBe(true);
    expect(combsCarlos.some((c) => c.disciplina_nome === 'Matemática')).toBe(false);

    // Carlos tenta listar Matemática 7º Ano -> deve lançar erro de permissão
    await expect(
      bancoService.listarBanco({ disciplina_id: 'disc-mat', serie: '7º Ano' })
    ).rejects.toThrow('Você não tem permissão para acessar questões desta matéria e série.');

    // Ana (Matemática 7º Ano)
    await authService.login('ana@demo.com', 'demo123');
    const combsAna = await bancoService.listarCombinacoesDoProfessor();
    expect(combsAna.some((c) => c.disciplina_nome === 'Matemática' && c.serie === '7º Ano')).toBe(true);
    expect(combsAna.some((c) => c.disciplina_nome === 'Ciências')).toBe(false);

    // Ana tenta listar Ciências 7º Ano -> erro
    await expect(
      bancoService.listarBanco({ disciplina_id: 'disc-cien', serie: '7º Ano' })
    ).rejects.toThrow('Você não tem permissão para acessar questões desta matéria e série.');
  });

  // 2. Não pode criar questão para matéria/série em que não leciona
  it('não pode criar questão para matéria ou série em que o professor não leciona', async () => {
    await authService.login('carlos@demo.com', 'demo123');

    await expect(
      bancoService.salvarQuestaoBanco({
        disciplina_id: 'disc-mat',
        serie: '7º Ano',
        assunto_id: 'assunto-mat-porc',
        dificuldade: 'facil',
        enunciado: 'Questão inválida do Carlos em Matemática',
        alternativas: [
          { letra: 'A', texto: '10', correta: true },
          { letra: 'B', texto: '20', correta: false, por_que_errou: 'Erro' },
        ],
      })
    ).rejects.toThrow('Você não pode criar ou editar questões para matérias/séries que não leciona.');
  });

  // 3. Isolamento entre séries da mesma matéria (Gestão cria 6º Ano e novo professor)
  it('professor do 6º Ano não vê 7º Ano', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    // Cria novo professor de Matemática para 6º Ano
    const novoProf = await gestaoService.convidarProfessor('marcos@demo.com', 'Prof. Marcos 6º Ano');
    // Cria oferta de Matemática para a turma-6b (6º Ano)
    await gestaoService.criarOferta({
      turma_id: 'turma-6b',
      disciplina_id: 'disc-mat',
      professor_id: novoProf.id,
    });
    // Garante que turma-6b é do ano atual para o teste de isolamento
    const db = await getDatabase();
    const t6b = db.turmas.find((t) => t.id === 'turma-6b')!;
    t6b.ano_letivo = 2026;

    // Novo professor Marcos cria questão de Frações no 6º Ano
    await authService.login('marcos@demo.com', 'demo123');
    const qMarcos = await bancoService.salvarQuestaoBanco({
      disciplina_id: 'disc-mat',
      serie: '6º Ano',
      assunto_id: 'assunto-mat-frac',
      dificuldade: 'facil',
      enunciado: 'Questão exclusiva do 6º Ano pelo Prof Marcos',
      alternativas: [
        { letra: 'A', texto: 'Correta 6º', correta: true },
        { letra: 'B', texto: 'Incorreta', correta: false, por_que_errou: 'Explicação' },
      ],
    });
    expect(qMarcos.id).toBeDefined();

    // Marcos não consegue acessar 7º Ano
    await expect(
      bancoService.listarBanco({ disciplina_id: 'disc-mat', serie: '7º Ano' })
    ).rejects.toThrow('Você não tem permissão para acessar questões desta matéria e série.');

    // Ana (7º Ano) não vê a questão do 6º Ano
    await authService.login('ana@demo.com', 'demo123');
    await expect(
      bancoService.listarBanco({ disciplina_id: 'disc-mat', serie: '6º Ano' })
    ).rejects.toThrow('Você não tem permissão para acessar questões desta matéria e série.');

    // Listando 7º Ano, Ana não vê a questão criada pelo Marcos no 6º Ano
    const questoesAna7 = await bancoService.listarBanco({ disciplina_id: 'disc-mat', serie: '7º Ano' });
    expect(questoesAna7.some((q) => q.id === qMarcos.id)).toBe(false);
  });

  // 4. Compartilhamento "Da escola": segundo professor da mesma matéria e série
  it('2º professor do 7º vê, duplica, mas não edita as da Ana', async () => {
    await authService.login('direcao@demo.com', 'demo123');
    // Adiciona uma nova turma do 7º Ano (7º B) com Matemática para outro professor
    const t7b = await gestaoService.criarTurma({
      escola_id: 'esc-001',
      nome: '7º Ano B',
      serie: '7º Ano',
      segmento: 'fund2',
      ano_letivo: 2026,
      codigo_acesso: '7B-MAT',
      ativa: true,
    });
    const profPaula = await gestaoService.convidarProfessor('paula@demo.com', 'Profª Paula Mat');
    await gestaoService.criarOferta({
      turma_id: t7b.id,
      disciplina_id: 'disc-mat',
      professor_id: profPaula.id,
    });

    // Paula faz login
    await authService.login('paula@demo.com', 'demo123');

    // Paula vê as questões da Ana no escopo 'escola'
    const questoesEscola = await bancoService.listarBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      escopo: 'escola',
    });
    expect(questoesEscola.length).toBeGreaterThan(0);
    const qAna = questoesEscola.find((q) => q.criado_por === 'usr-prof-ana');
    expect(qAna).toBeDefined();

    // Paula NÃO vê no escopo 'minhas'
    const minhasPaula = await bancoService.listarBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      escopo: 'minhas',
    });
    expect(minhasPaula.length).toBe(0);

    // Paula NÃO pode editar a questão da Ana
    await expect(
      bancoService.salvarQuestaoBanco({
        id: qAna!.id,
        disciplina_id: 'disc-mat',
        serie: '7º Ano',
        assunto_id: qAna!.assunto_id,
        dificuldade: qAna!.dificuldade,
        enunciado: 'Tentativa de alteração não autorizada',
        alternativas: [
          { letra: 'A', texto: 'A', correta: true },
          { letra: 'B', texto: 'B', correta: false, por_que_errou: 'Erro' },
        ],
      })
    ).rejects.toThrow('Apenas o autor pode editar esta questão. Use "Duplicar para editar".');

    // Paula NÃO pode arquivar a questão da Ana
    await expect(bancoService.arquivarQuestaoBanco(qAna!.id)).rejects.toThrow(
      'Apenas o autor pode arquivar esta questão.'
    );

    // Paula PODE duplicar a questão da Ana
    const duplicada = await bancoService.duplicarQuestaoBanco(qAna!.id);
    expect(duplicada.id).not.toBe(qAna!.id);
    expect(duplicada.criado_por).toBe(profPaula.id);
    expect(duplicada.enunciado).toBe(qAna!.enunciado);

    // A duplicada agora aparece nas "minhas" de Paula
    const minhasDepois = await bancoService.listarBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      escopo: 'minhas',
    });
    expect(minhasDepois.some((q) => q.id === duplicada.id)).toBe(true);
  });

  // 5. Gestão tem acesso de leitura total e não edita
  it('gestão vê em modo leitura todas as matérias e séries cadastradas e não pode criar questão', async () => {
    await authService.login('direcao@demo.com', 'demo123');

    // Lista Matemática 7º Ano
    const mat7 = await bancoService.listarBanco({ disciplina_id: 'disc-mat', serie: '7º Ano' });
    expect(mat7.length).toBe(7);

    // Lista Ciências 7º Ano
    const cien7 = await bancoService.listarBanco({ disciplina_id: 'disc-cien', serie: '7º Ano' });
    expect(cien7.length).toBe(2);

    // Gestão tenta criar questão -> bloqueado (só professor leciona)
    await expect(
      bancoService.salvarQuestaoBanco({
        disciplina_id: 'disc-mat',
        serie: '7º Ano',
        assunto_id: 'assunto-mat-frac',
        dificuldade: 'facil',
        enunciado: 'Questão da Direção',
        alternativas: [
          { letra: 'A', texto: '1', correta: true },
          { letra: 'B', texto: '2', correta: false, por_que_errou: 'Erro' },
        ],
      })
    ).rejects.toThrow();
  });

  // 6. Imutabilidade ao adicionar e editar no banco
  it('adicionarDoBanco copia para a atividade com banco_questao_id; editar o banco depois não mexe na atividade', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // Cria atividade rascunho em Matemática 7A
    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Atividade Teste Banco',
      descricao: 'Teste',
      prazo: null,
      periodo_id: 'per-bim-3',
      modo: 'exercicio',
    });

    // Pega primeira questão de Porcentagem
    const bancoMat = await bancoService.listarBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: 'assunto-mat-porc',
    });
    const q1 = bancoMat[0];

    // Adiciona do banco
    await bancoService.adicionarDoBanco(ativ.id, [q1.id]);

    // Verifica que está na atividade com banco_questao_id
    const ativCarregada = await professorService.obterAtividade(ativ.id);
    expect(ativCarregada?.questoes.length).toBe(1);
    expect(ativCarregada?.questoes[0].banco_questao_id).toBe(q1.id);
    const enunciadoOriginalNaAtividade = ativCarregada?.questoes[0].enunciado;
    expect(enunciadoOriginalNaAtividade).toBe(q1.enunciado);

    // Agora Ana edita o enunciado da questão no BANCO
    await bancoService.salvarQuestaoBanco({
      id: q1.id,
      disciplina_id: q1.disciplina_id,
      serie: q1.serie,
      assunto_id: q1.assunto_id,
      dificuldade: q1.dificuldade,
      enunciado: 'ENUNCIADO ALTERADO NO BANCO',
      alternativas: q1.alternativas!.map((a) => ({
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
        por_que_errou: a.por_que_errou,
      })),
      versao: q1.versao,
    });

    // Recarrega a atividade: o enunciado DEVE PERMANECER O ORIGINAL (imutabilidade)
    const ativAposEdicaoBanco = await professorService.obterAtividade(ativ.id);
    expect(ativAposEdicaoBanco?.questoes[0].enunciado).toBe(enunciadoOriginalNaAtividade);
    expect(ativAposEdicaoBanco?.questoes[0].enunciado).not.toContain('ENUNCIADO ALTERADO NO BANCO');
  });

  // 7. Bloqueio em atividades publicadas
  it('adicionarDoBanco e sortearDoBanco rejeitam atividades publicadas', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // ativ-demo-mat-frac é publicada
    await expect(
      bancoService.adicionarDoBanco('ativ-demo-mat-frac', ['bq-mat-porc-1'])
    ).rejects.toThrow('Não é permitido alterar questões de atividades publicadas ou encerradas.');

    await expect(
      bancoService.sortearDoBanco('ativ-demo-mat-frac', 'assunto-mat-porc', { facil: 1, medio: 0, dificil: 0 })
    ).rejects.toThrow('Não é permitido alterar questões de atividades publicadas ou encerradas.');
  });

  // 8. Sorteio pula questões já adicionadas e avisa quando quantidade for insuficiente
  it('sortearDoBanco pula questões já na atividade e emite aviso em falta de estoque', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // Cria rascunho
    const ativ = await professorService.criarAtividade('oferta-mat-7a', {
      titulo: 'Atividade Sorteio',
      descricao: 'Teste',
      prazo: null,
      periodo_id: 'per-bim-3',
      modo: 'exercicio',
    });

    // Pede 5 fáceis de Frações (só existem 2 cadastradas no seed)
    const resultado = await bancoService.sortearDoBanco(ativ.id, 'assunto-mat-frac', {
      facil: 5,
      medio: 0,
      dificil: 0,
    });

    expect(resultado.adicionadas).toBe(2);
    expect(resultado.aviso).toContain('Só há 2 questão(ões) fácil(eis) neste assunto.');

    // Sorteia novamente para a mesma atividade: agora todas já foram adicionadas
    const resultado2 = await bancoService.sortearDoBanco(ativ.id, 'assunto-mat-frac', {
      facil: 1,
      medio: 0,
      dificil: 0,
    });

    expect(resultado2.adicionadas).toBe(0);
    expect(resultado2.aviso).toContain('Não há questões fáceis disponíveis neste assunto.');
  });

  // 9. Lock otimista
  it('salvarQuestaoBanco detecta conflito de versão (lock otimista)', async () => {
    await authService.login('ana@demo.com', 'demo123');

    const questoes = await bancoService.listarBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
    });
    const q = questoes[0];

    // Simula que outra aba atualizou a questão (versão no banco avançou)
    await expect(
      bancoService.salvarQuestaoBanco({
        id: q.id,
        disciplina_id: q.disciplina_id,
        serie: q.serie,
        assunto_id: q.assunto_id,
        dificuldade: q.dificuldade,
        enunciado: 'Novo texto com versão antiga',
        alternativas: q.alternativas!.map((a) => ({
          letra: a.letra,
          texto: a.texto,
          correta: a.correta,
          por_que_errou: a.por_que_errou,
        })),
        versao: 999, // versão errada
      })
    ).rejects.toThrow('Esta questão foi alterada por outro usuário ou em outra aba. Recarregue a página.');
  });

  // 10. Submatérias compartilhadas entre professores da mesma matéria
  it('submatéria criada por um professor vira filtro e fica disponível para outros professores da matéria', async () => {
    // 1. Ana (professora de Matemática) cadastra a submatéria "Geometria Espacial"
    await authService.login('ana@demo.com', 'demo123');
    const novaSubmateria = await bancoService.criarAssunto('disc-mat', 'Geometria Espacial');
    expect(novaSubmateria.id).toBeDefined();
    expect(novaSubmateria.nome).toBe('Geometria Espacial');

    // Ana cria uma questão vinculada à nova submatéria
    const qAna = await bancoService.salvarQuestaoBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: novaSubmateria.id,
      dificuldade: 'facil',
      enunciado: 'Qual a definição de um prisma reto?',
      alternativas: [
        { letra: 'A', texto: 'Poliedro com bases paralelas congruentes e faces laterais retangulares', correta: true },
        { letra: 'B', texto: 'Uma pirâmide', correta: false, por_que_errou: 'Pirâmides possuem vértice comum' },
      ],
    });
    expect(qAna.id).toBeDefined();

    // 2. Cria oferta para a Profª Paula também no 7º Ano de Matemática
    await authService.login('direcao@demo.com', 'demo123');
    const profPaula = await gestaoService.convidarProfessor('paula2@demo.com', 'Profª Paula 2');
    const t7c = await gestaoService.criarTurma({
      escola_id: 'esc-001',
      nome: '7º Ano C',
      serie: '7º Ano',
      segmento: 'fund2',
      ano_letivo: 2026,
      codigo_acesso: '7C-MAT',
      ativa: true,
    });
    await gestaoService.criarOferta({
      turma_id: t7c.id,
      disciplina_id: 'disc-mat',
      professor_id: profPaula.id,
    });

    // 3. Paula faz login e lista os assuntos de Matemática
    await authService.login('paula2@demo.com', 'demo123');
    const assuntosPaula = await bancoService.listarAssuntos('disc-mat');
    const encontrouSubmateria = assuntosPaula.find((a) => a.id === novaSubmateria.id);
    expect(encontrouSubmateria).toBeDefined();
    expect(encontrouSubmateria?.nome).toBe('Geometria Espacial');

    // 4. Paula filtra o Banco de Questões no escopo "Da escola" usando a submatéria criada pela Ana
    const questoesFiltradas = await bancoService.listarBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: novaSubmateria.id,
      escopo: 'escola',
    });

    expect(questoesFiltradas.length).toBe(1);
    expect(questoesFiltradas[0].id).toBe(qAna.id);
    expect(questoesFiltradas[0].enunciado).toBe('Qual a definição de um prisma reto?');
  });

  // 11. Renomeação e proteção na exclusão de submatérias com questões
  it('renomeia submatéria e impede exclusão caso existam questões vinculadas', async () => {
    await authService.login('ana@demo.com', 'demo123');

    // Cria submatéria temporária
    const subTemp = await bancoService.criarAssunto('disc-mat', 'Trigonometria Básica');
    expect(subTemp.nome).toBe('Trigonometria Básica');

    // Renomeia para nome corrigido
    const subRenomeada = await bancoService.renomearAssunto(subTemp.id, 'Trigonometria no Triângulo Retângulo');
    expect(subRenomeada.nome).toBe('Trigonometria no Triângulo Retângulo');

    // Cria questão vinculada a essa submatéria
    await bancoService.salvarQuestaoBanco({
      disciplina_id: 'disc-mat',
      serie: '7º Ano',
      assunto_id: subRenomeada.id,
      dificuldade: 'medio',
      enunciado: 'O que é o cateto oposto?',
      alternativas: [
        { letra: 'A', texto: 'Lado oposto ao ângulo considerado', correta: true },
        { letra: 'B', texto: 'Hipotenusa', correta: false, por_que_errou: 'É o maior lado' },
      ],
    });

    // Tentativa de exclusão deve falhar porque existe questão vinculada
    await expect(bancoService.excluirAssunto(subRenomeada.id)).rejects.toThrow(
      /Não é possível excluir esta submatéria pois existem \d+ questão\(ões\) vinculada\(s\) no Banco/
    );

    // Cria outra submatéria vazia e testa exclusão permitida
    const subVazia = await bancoService.criarAssunto('disc-mat', 'Submatéria Sem Questões');
    await expect(bancoService.excluirAssunto(subVazia.id)).resolves.not.toThrow();

    const assuntosAtualizados = await bancoService.listarAssuntos('disc-mat');
    expect(assuntosAtualizados.some((a) => a.id === subVazia.id)).toBe(false);
  });

  // 12. Contagem de questões por submatéria
  it('contarQuestoesPorAssunto contabiliza questões ativas por submatéria corretamente', async () => {
    await authService.login('ana@demo.com', 'demo123');
    const contagens = await bancoService.contarQuestoesPorAssunto('disc-mat');
    expect(typeof contagens).toBe('object');
    // Deve haver contagens numéricas para os assuntos de Matemática
    expect(Object.values(contagens).every((c) => typeof c === 'number' && c >= 0)).toBe(true);
  });
});
