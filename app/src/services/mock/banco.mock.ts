/**
 * SaberPontual — BancoService Mock
 * 
 * Implementação do Banco de Questões (Fase H1 - docs/ESPECIFICACAO.md Seção 9)
 * Regras:
 * - Scoped por MATÉRIA + SÉRIE (turmas.serie).
 * - O professor só acessa as combinações de ofertas que leciona.
 * - Da escola: compartilhado entre professores da mesma matéria e série.
 * - Só o autor edita e arquiva; outros usam duplicarQuestaoBanco.
 * - Gestão acessa em modo leitura todas as matérias e séries.
 * - Lock otimista com campo versao em salvarQuestaoBanco.
 * - adicionarDoBanco e sortearDoBanco copiam para questoes (com banco_questao_id).
 *   Editar o banco depois NÃO altera questões já copiadas.
 */

import {
  ServicoBanco,
  SalvarBancoQuestaoPayload,
  FiltrosBanco,
  CombinacaoProfessor,
} from '../contracts';
import {
  Assunto,
  BancoQuestao,
  BancoAlternativa,
  LetraAlternativa,
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { gerarId } from './ids';
import { exigirUsuario } from './autorizacao';

const LETRAS_PADRAO: LetraAlternativa[] = ['A', 'B', 'C', 'D', 'E'];

export class MockBancoService implements ServicoBanco {
  // 1. Assuntos
  async listarAssuntos(disciplinaId: string): Promise<Assunto[]> {
    await exigirUsuario();
    const db = await getDatabase();
    return (db.assuntos || [])
      .filter((a) => a.disciplina_id === disciplinaId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async criarAssunto(disciplinaId: string, nome: string): Promise<Assunto> {
    const usuario = await exigirUsuario();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      throw new Error('O nome do assunto não pode ficar vazio.');
    }

    const db = await getDatabase();

    // Se for professor, valida se leciona a disciplina
    if (usuario.papel === 'professor') {
      const leciona = db.ofertas.some(
        (o) => o.professor_id === usuario.id && o.disciplina_id === disciplinaId
      );
      if (!leciona) {
        throw new Error('Você não leciona esta disciplina.');
      }
    }

    if (!db.assuntos) {
      db.assuntos = [];
    }

    // Unicidade de nome por disciplina (case-insensitive)
    const jaExiste = db.assuntos.some(
      (a) =>
        a.disciplina_id === disciplinaId &&
        a.nome.toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (jaExiste) {
      throw new Error('Já existe um assunto com este nome para esta disciplina.');
    }

    const novoAssunto: Assunto = {
      id: gerarId('assunto'),
      created_at: new Date().toISOString(),
      escola_id: usuario.escola_id,
      disciplina_id: disciplinaId,
      nome: nomeLimpo,
    };

    db.assuntos.push(novoAssunto);
    saveDatabase(db);
    return novoAssunto;
  }

  async renomearAssunto(assuntoId: string, novoNome: string): Promise<Assunto> {
    const usuario = await exigirUsuario();
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) {
      throw new Error('O nome da submatéria não pode ficar vazio.');
    }

    const db = await getDatabase();
    const assunto = (db.assuntos || []).find((a) => a.id === assuntoId);
    if (!assunto) {
      throw new Error('Submatéria não encontrada.');
    }

    if (usuario.papel === 'professor') {
      const leciona = db.ofertas.some(
        (o) => o.professor_id === usuario.id && o.disciplina_id === assunto.disciplina_id
      );
      if (!leciona) {
        throw new Error('Você não tem permissão para alterar submatérias desta disciplina.');
      }
    }

    const jaExiste = (db.assuntos || []).some(
      (a) =>
        a.id !== assuntoId &&
        a.disciplina_id === assunto.disciplina_id &&
        a.nome.toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (jaExiste) {
      throw new Error('Já existe uma submatéria com este nome nesta disciplina.');
    }

    assunto.nome = nomeLimpo;
    saveDatabase(db);
    return assunto;
  }

  async excluirAssunto(assuntoId: string): Promise<void> {
    const usuario = await exigirUsuario();
    const db = await getDatabase();
    const assunto = (db.assuntos || []).find((a) => a.id === assuntoId);
    if (!assunto) {
      throw new Error('Submatéria não encontrada.');
    }

    if (usuario.papel === 'professor') {
      const leciona = db.ofertas.some(
        (o) => o.professor_id === usuario.id && o.disciplina_id === assunto.disciplina_id
      );
      if (!leciona) {
        throw new Error('Você não tem permissão para excluir submatérias desta disciplina.');
      }
    }

    // Verifica se existem questões vinculadas no banco de questões ou nas atividades
    const qtdNoBanco = (db.banco_questoes || []).filter(
      (q) => q.assunto_id === assuntoId && !q.arquivada
    ).length;

    if (qtdNoBanco > 0) {
      throw new Error(
        `Não é possível excluir esta submatéria pois existem ${qtdNoBanco} questão(ões) vinculada(s) no Banco.`
      );
    }

    const qtdEmAtividades = (db.questoes || []).filter(
      (q) => q.assunto_id === assuntoId
    ).length;

    if (qtdEmAtividades > 0) {
      throw new Error(
        `Não é possível excluir esta submatéria pois ela está vinculada a questões de atividades.`
      );
    }

    db.assuntos = (db.assuntos || []).filter((a) => a.id !== assuntoId);
    saveDatabase(db);
  }

  async contarQuestoesPorAssunto(disciplinaId: string): Promise<Record<string, number>> {
    await exigirUsuario();
    const db = await getDatabase();
    const contagem: Record<string, number> = {};

    const questoes = (db.banco_questoes || []).filter(
      (q) => q.disciplina_id === disciplinaId && !q.arquivada
    );

    for (const q of questoes) {
      if (q.assunto_id) {
        contagem[q.assunto_id] = (contagem[q.assunto_id] || 0) + 1;
      }
    }

    return contagem;
  }

  // 2. Consulta de Combinações de Matéria + Série
  async listarCombinacoesDoProfessor(): Promise<CombinacaoProfessor[]> {
    const usuario = await exigirUsuario();
    const db = await getDatabase();
    const escolaAtual = db.escolas[0];
    const anoAtual = escolaAtual?.ano_letivo_atual || 2026;

    // Gestão: devolve todas as combinações cadastradas de turmas ativas do ano atual
    if (usuario.papel === 'direcao' || usuario.papel === 'coordenacao') {
      const mapa = new Map<string, CombinacaoProfessor>();

      const turmasAtivas = db.turmas.filter(
        (t) => t.ativa && t.ano_letivo === anoAtual
      );

      for (const disc of db.disciplinas) {
        for (const turma of turmasAtivas) {
          const chave = `${disc.id}__${turma.serie}`;
          if (!mapa.has(chave)) {
            mapa.set(chave, {
              disciplina_id: disc.id,
              disciplina_nome: disc.nome,
              serie: turma.serie,
              label: `${disc.nome} · ${turma.serie}`,
            });
          }
        }
      }

      return Array.from(mapa.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
    }

    // Professor: devolve apenas os pares matéria + série das suas ofertas ativas no ano atual
    const ofertasDoProf = db.ofertas.filter((o) => o.professor_id === usuario.id);
    const mapa = new Map<string, CombinacaoProfessor>();

    for (const of of ofertasDoProf) {
      const turma = db.turmas.find(
        (t) => t.id === of.turma_id && t.ativa && t.ano_letivo === anoAtual
      );
      if (!turma) continue;

      const disciplina = db.disciplinas.find((d) => d.id === of.disciplina_id);
      if (!disciplina) continue;

      const chave = `${disciplina.id}__${turma.serie}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          disciplina_id: disciplina.id,
          disciplina_nome: disciplina.nome,
          serie: turma.serie,
          label: `${disciplina.nome} · ${turma.serie}`,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }

  // 3. Listagem do Banco
  async listarBanco(filtros: FiltrosBanco): Promise<BancoQuestao[]> {
    const usuario = await exigirUsuario();
    const db = await getDatabase();
    const escolaAtual = db.escolas[0];
    const anoAtual = escolaAtual?.ano_letivo_atual || 2026;

    // Se for professor, valida permissão sobre a combinação matéria + série
    if (usuario.papel === 'professor') {
      const leciona = db.ofertas.some((o) => {
        if (o.professor_id !== usuario.id || o.disciplina_id !== filtros.disciplina_id) {
          return false;
        }
        const t = db.turmas.find((turma) => turma.id === o.turma_id && turma.ativa && turma.ano_letivo === anoAtual);
        return t && t.serie === filtros.serie;
      });

      if (!leciona) {
        throw new Error('Você não tem permissão para acessar questões desta matéria e série.');
      }
    }

    const bancoQuestoes = db.banco_questoes || [];
    const bancoAlternativas = db.banco_alternativas || [];
    const assuntos = db.assuntos || [];

    const resultado = bancoQuestoes.filter((q) => {
      if (q.arquivada) return false;
      if (q.disciplina_id !== filtros.disciplina_id) return false;
      if (filtros.serie && q.serie !== filtros.serie) return false;
      if (filtros.assunto_id && q.assunto_id !== filtros.assunto_id) return false;
      if (filtros.dificuldade && q.dificuldade !== filtros.dificuldade) return false;
      if (filtros.escopo === 'minhas' && q.criado_por !== usuario.id) return false;
      if (filtros.tipo && q.tipo !== filtros.tipo) return false;
      if (filtros.origem && q.origem !== filtros.origem) return false;
      return true;
    });

    return resultado.map((q) => {
      const alts = bancoAlternativas
        .filter((a) => a.banco_questao_id === q.id)
        .sort((a, b) => a.letra.localeCompare(b.letra));

      const autor = db.perfis.find((p) => p.id === q.criado_por);
      const assunto = assuntos.find((a) => a.id === q.assunto_id);
      const disciplina = db.disciplinas.find((d) => d.id === q.disciplina_id);

      return {
        ...q,
        alternativas: alts,
        autor_nome: autor?.nome || 'Professor(a)',
        assunto_nome: assunto?.nome || '',
        disciplina_nome: disciplina?.nome || '',
      };
    });
  }

  // 4. Salvar Questão (Criar ou Editar)
  async salvarQuestaoBanco(dados: SalvarBancoQuestaoPayload): Promise<BancoQuestao> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();
    const agora = new Date().toISOString();
    const escolaAtual = db.escolas[0];
    const anoAtual = escolaAtual?.ano_letivo_atual || 2026;

    // Validação de lecionar a matéria e série
    const leciona = db.ofertas.some((o) => {
      if (o.professor_id !== usuario.id || o.disciplina_id !== dados.disciplina_id) {
        return false;
      }
      const t = db.turmas.find((turma) => turma.id === o.turma_id && turma.ativa && turma.ano_letivo === anoAtual);
      return t && t.serie === dados.serie;
    });

    if (!leciona) {
      throw new Error('Você não pode criar ou editar questões para matérias/séries que não leciona.');
    }

    // Validação de enunciado
    if (!dados.enunciado || !dados.enunciado.trim()) {
      throw new Error('O enunciado da questão não pode ficar vazio.');
    }

    const tipoQuestao = dados.tipo || 'objetiva';

    // Validação específica por tipo
    if (tipoQuestao === 'discursiva') {
      if (!dados.resposta_esperada || !dados.resposta_esperada.trim()) {
        throw new Error('A resposta esperada (gabarito do professor) é obrigatória para questões discursivas.');
      }
    } else {
      // Validação de alternativas para objetivas
      if (!dados.alternativas || dados.alternativas.length < 2 || dados.alternativas.length > 5) {
        throw new Error('A questão deve conter entre 2 e 5 alternativas.');
      }

      const corretas = dados.alternativas.filter((a) => a.correta);
      if (corretas.length !== 1) {
        throw new Error('A questão deve ter exatamente 1 alternativa correta marcada.');
      }

      for (let i = 0; i < dados.alternativas.length; i++) {
        const alt = dados.alternativas[i];
        if (!alt.texto || !alt.texto.trim()) {
          throw new Error(`O texto da alternativa ${LETRAS_PADRAO[i]} não pode ficar vazio.`);
        }
        if (!alt.correta && (!alt.por_que_errou || !alt.por_que_errou.trim())) {
          throw new Error(
            `A alternativa ${LETRAS_PADRAO[i]} (incorreta) deve conter a explicação do erro (por que errou).`
          );
        }
      }
    }

    if (!db.banco_questoes) db.banco_questoes = [];
    if (!db.banco_alternativas) db.banco_alternativas = [];

    // Edição
    if (dados.id) {
      const questao = db.banco_questoes.find((q) => q.id === dados.id);
      if (!questao) {
        throw new Error('Questão não encontrada no banco.');
      }
      if (questao.arquivada) {
        throw new Error('Esta questão está arquivada e não pode ser editada.');
      }
      if (questao.criado_por !== usuario.id) {
        throw new Error('Apenas o autor pode editar esta questão. Use "Duplicar para editar".');
      }

      // Lock otimista
      if (dados.versao !== undefined && questao.versao !== undefined && questao.versao !== dados.versao) {
        throw new Error(
          'Esta questão foi alterada por outro usuário ou em outra aba. Recarregue a página.'
        );
      }

      questao.enunciado = dados.enunciado.trim();
      questao.assunto_id = dados.assunto_id;
      questao.dificuldade = dados.dificuldade;
      questao.tipo = tipoQuestao;
      questao.resposta_esperada = dados.resposta_esperada ? dados.resposta_esperada.trim() : null;
      questao.imagem_url = dados.imagem_url || questao.imagem_url || null;
      questao.dica = dados.dica ? dados.dica.trim() : null;
      questao.explicacao = dados.explicacao ? dados.explicacao.trim() : null;
      questao.versao = (questao.versao || 1) + 1;

      // Substitui alternativas (apenas para objetivas)
      db.banco_alternativas = db.banco_alternativas.filter(
        (a) => a.banco_questao_id !== questao.id
      );

      const novasAlternativas: BancoAlternativa[] = [];
      if (tipoQuestao === 'objetiva' && dados.alternativas) {
        for (let i = 0; i < dados.alternativas.length; i++) {
          const alt = dados.alternativas[i];
          const novaAlt: BancoAlternativa = {
            id: alt.id || gerarId('alt'),
            created_at: agora,
            banco_questao_id: questao.id,
            letra: LETRAS_PADRAO[i],
            texto: alt.texto.trim(),
            correta: alt.correta,
            por_que_errou: alt.correta ? null : alt.por_que_errou?.trim() || null,
          };
          db.banco_alternativas.push(novaAlt);
          novasAlternativas.push(novaAlt);
        }
      }

      saveDatabase(db);

      const assunto = db.assuntos?.find((a) => a.id === questao.assunto_id);
      const disciplina = db.disciplinas.find((d) => d.id === questao.disciplina_id);

      return {
        ...questao,
        alternativas: novasAlternativas,
        autor_nome: usuario.nome,
        assunto_nome: assunto?.nome || '',
        disciplina_nome: disciplina?.nome || '',
      };
    }

    // Criação
    const novoId = gerarId('bq');
    const novaQuestao: BancoQuestao = {
      id: novoId,
      created_at: agora,
      escola_id: usuario.escola_id,
      disciplina_id: dados.disciplina_id,
      assunto_id: dados.assunto_id,
      criado_por: usuario.id,
      serie: dados.serie,
      tipo: tipoQuestao,
      dificuldade: dados.dificuldade,
      enunciado: dados.enunciado.trim(),
      imagem_url: dados.imagem_url || null,
      dica: dados.dica ? dados.dica.trim() : null,
      explicacao: dados.explicacao ? dados.explicacao.trim() : null,
      resposta_esperada: dados.resposta_esperada ? dados.resposta_esperada.trim() : null,
      origem: dados.origem || 'manual',
      arquivada: false,
      versao: 1,
    };

    db.banco_questoes.push(novaQuestao);

    const novasAlternativas: BancoAlternativa[] = [];
    if (tipoQuestao === 'objetiva' && dados.alternativas) {
      for (let i = 0; i < dados.alternativas.length; i++) {
        const alt = dados.alternativas[i];
        const novaAlt: BancoAlternativa = {
          id: gerarId('alt'),
          created_at: agora,
          banco_questao_id: novoId,
          letra: LETRAS_PADRAO[i],
          texto: alt.texto.trim(),
          correta: alt.correta,
          por_que_errou: alt.correta ? null : alt.por_que_errou?.trim() || null,
        };
        db.banco_alternativas.push(novaAlt);
        novasAlternativas.push(novaAlt);
      }
    }

    saveDatabase(db);

    const assunto = db.assuntos?.find((a) => a.id === novaQuestao.assunto_id);
    const disciplina = db.disciplinas.find((d) => d.id === novaQuestao.disciplina_id);

    return {
      ...novaQuestao,
      alternativas: novasAlternativas,
      autor_nome: usuario.nome,
      assunto_nome: assunto?.nome || '',
      disciplina_nome: disciplina?.nome || '',
    };
  }

  // 5. Duplicar Questão
  async duplicarQuestaoBanco(id: string): Promise<BancoQuestao> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();
    const agora = new Date().toISOString();
    const escolaAtual = db.escolas[0];
    const anoAtual = escolaAtual?.ano_letivo_atual || 2026;

    const questaoOrigem = db.banco_questoes?.find((q) => q.id === id);
    if (!questaoOrigem) {
      throw new Error('Questão não encontrada no banco.');
    }

    // Valida se o professor que está duplicando leciona essa matéria e série
    const leciona = db.ofertas.some((o) => {
      if (o.professor_id !== usuario.id || o.disciplina_id !== questaoOrigem.disciplina_id) {
        return false;
      }
      const t = db.turmas.find((turma) => turma.id === o.turma_id && turma.ativa && turma.ano_letivo === anoAtual);
      return t && t.serie === questaoOrigem.serie;
    });

    if (!leciona) {
      throw new Error('Você não pode duplicar questões para matérias/séries que não leciona.');
    }

    const novoId = gerarId('bq');
    const copiaQuestao: BancoQuestao = {
      ...questaoOrigem,
      id: novoId,
      created_at: agora,
      criado_por: usuario.id,
      origem: 'manual',
      arquivada: false,
      versao: 1,
    };

    if (!db.banco_questoes) db.banco_questoes = [];
    db.banco_questoes.push(copiaQuestao);

    const altsOrigem = (db.banco_alternativas || []).filter(
      (a) => a.banco_questao_id === questaoOrigem.id
    );

    const novasAlts: BancoAlternativa[] = [];
    for (const alt of altsOrigem) {
      const copiaAlt: BancoAlternativa = {
        ...alt,
        id: gerarId('alt'),
        created_at: agora,
        banco_questao_id: novoId,
      };
      db.banco_alternativas.push(copiaAlt);
      novasAlts.push(copiaAlt);
    }

    saveDatabase(db);

    const assunto = db.assuntos?.find((a) => a.id === copiaQuestao.assunto_id);
    const disciplina = db.disciplinas.find((d) => d.id === copiaQuestao.disciplina_id);

    return {
      ...copiaQuestao,
      alternativas: novasAlts,
      autor_nome: usuario.nome,
      assunto_nome: assunto?.nome || '',
      disciplina_nome: disciplina?.nome || '',
    };
  }

  // 6. Arquivar Questão
  async arquivarQuestaoBanco(id: string): Promise<void> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();

    const questao = db.banco_questoes?.find((q) => q.id === id);
    if (!questao) {
      throw new Error('Questão não encontrada no banco.');
    }

    if (questao.criado_por !== usuario.id) {
      throw new Error('Apenas o autor pode arquivar esta questão.');
    }

    questao.arquivada = true;
    questao.versao = (questao.versao || 1) + 1;
    saveDatabase(db);
  }

  // 7. Adicionar do Banco para Atividade (Copia mantendo imutabilidade)
  async adicionarDoBanco(atividadeId: string, bancoIds: string[]): Promise<void> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();
    const agora = new Date().toISOString();

    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) {
      throw new Error('Atividade não encontrada.');
    }

    if (atividade.status !== 'rascunho') {
      throw new Error('Não é permitido alterar questões de atividades publicadas ou encerradas.');
    }

    const oferta = db.ofertas.find((o) => o.id === atividade.oferta_id);
    if (!oferta) {
      throw new Error('Oferta da atividade não encontrada.');
    }

    if (oferta.professor_id !== usuario.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const turma = db.turmas.find((t) => t.id === oferta.turma_id);
    if (!turma) {
      throw new Error('Turma da atividade não encontrada.');
    }

    const questoesAtuais = db.questoes.filter((q) => q.atividade_id === atividadeId);
    let ordemAtual = questoesAtuais.length > 0 ? Math.max(...questoesAtuais.map((q) => q.ordem)) + 1 : 1;

    for (const bancoId of bancoIds) {
      const bq = db.banco_questoes?.find((b) => b.id === bancoId);
      if (!bq || bq.arquivada) continue;

      if (bq.disciplina_id !== oferta.disciplina_id || bq.serie !== turma.serie) {
        throw new Error('A questão do banco não pertence à mesma matéria e série desta atividade.');
      }

      const novaQuestaoId = gerarId('q');
      db.questoes.push({
        id: novaQuestaoId,
        created_at: agora,
        atividade_id: atividadeId,
        ordem: ordemAtual++,
        enunciado: bq.enunciado,
        dica: bq.dica,
        explicacao: bq.explicacao,
        banco_questao_id: bq.id,
        assunto_id: bq.assunto_id,
        tipo: bq.tipo || 'objetiva',
        imagem_url: bq.imagem_url ?? null,
        resposta_esperada: bq.resposta_esperada ?? null,
      });

      const altsBanco = (db.banco_alternativas || [])
        .filter((a) => a.banco_questao_id === bq.id)
        .sort((a, b) => a.letra.localeCompare(b.letra));

      for (const alt of altsBanco) {
        db.alternativas.push({
          id: `alt-${novaQuestaoId}-${alt.letra.toLowerCase()}`,
          created_at: agora,
          questao_id: novaQuestaoId,
          letra: alt.letra,
          texto: alt.texto,
          correta: alt.correta,
          por_que_errou: alt.por_que_errou,
        });
      }
    }

    saveDatabase(db);
  }

  // 8. Sortear do Banco para Atividade
  async sortearDoBanco(
    atividadeId: string,
    assuntoId: string,
    quantidades: { facil: number; medio: number; dificil: number }
  ): Promise<{ adicionadas: number; aviso?: string }> {
    const usuario = await exigirUsuario(['professor']);
    const db = await getDatabase();

    const atividade = db.atividades.find((a) => a.id === atividadeId);
    if (!atividade) {
      throw new Error('Atividade não encontrada.');
    }

    if (atividade.status !== 'rascunho') {
      throw new Error('Não é permitido alterar questões de atividades publicadas ou encerradas.');
    }

    const oferta = db.ofertas.find((o) => o.id === atividade.oferta_id);
    if (!oferta) {
      throw new Error('Oferta da atividade não encontrada.');
    }

    if (oferta.professor_id !== usuario.id) {
      throw new Error('Você não tem permissão para esta ação.');
    }

    const turma = db.turmas.find((t) => t.id === oferta.turma_id);
    if (!turma) {
      throw new Error('Turma da atividade não encontrada.');
    }

    // Pula questões que já foram adicionadas à atividade a partir do banco
    const questoesAtuaisAtividade = db.questoes.filter((q) => q.atividade_id === atividadeId);
    const bancoIdsJaUsados = new Set(
      questoesAtuaisAtividade.map((q) => q.banco_questao_id).filter(Boolean)
    );

    const questoesDoBanco = (db.banco_questoes || []).filter(
      (b) =>
        b.disciplina_id === oferta.disciplina_id &&
        b.serie === turma.serie &&
        b.assunto_id === assuntoId &&
        !b.arquivada &&
        !bancoIdsJaUsados.has(b.id)
    );

    const fáceis = questoesDoBanco.filter((q) => q.dificuldade === 'facil');
    const médias = questoesDoBanco.filter((q) => q.dificuldade === 'medio');
    const difíceis = questoesDoBanco.filter((q) => q.dificuldade === 'dificil');

    const avisos: string[] = [];

    if (quantidades.facil > 0 && fáceis.length < quantidades.facil) {
      avisos.push(
        fáceis.length === 0
          ? 'Não há questões fáceis disponíveis neste assunto.'
          : `Só há ${fáceis.length} questão(ões) fácil(eis) neste assunto.`
      );
    }

    if (quantidades.medio > 0 && médias.length < quantidades.medio) {
      avisos.push(
        médias.length === 0
          ? 'Não há questões médias disponíveis neste assunto.'
          : `Só há ${médias.length} questão(ões) média(s) neste assunto.`
      );
    }

    if (quantidades.dificil > 0 && difíceis.length < quantidades.dificil) {
      avisos.push(
        difíceis.length === 0
          ? 'Não há questões difíceis disponíveis neste assunto.'
          : `Só há ${difíceis.length} questão(ões) difícil(eis) neste assunto.`
      );
    }

    // Pega as disponíveis respeitando o limite pedido
    const selecionadas: BancoQuestao[] = [
      ...fáceis.slice(0, Math.max(0, quantidades.facil)),
      ...médias.slice(0, Math.max(0, quantidades.medio)),
      ...difíceis.slice(0, Math.max(0, quantidades.dificil)),
    ];

    if (selecionadas.length === 0) {
      return {
        adicionadas: 0,
        aviso: avisos.join(' ') || 'Nenhuma questão elegível para sorteio.',
      };
    }

    // Adiciona as selecionadas à atividade
    await this.adicionarDoBanco(
      atividadeId,
      selecionadas.map((s) => s.id)
    );

    return {
      adicionadas: selecionadas.length,
      aviso: avisos.length > 0 ? avisos.join(' ') : undefined,
    };
  }
}
