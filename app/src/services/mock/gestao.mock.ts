/**
 * SaberPontual — GestaoService Mock
 * 
 * Regras de autorização:
 * - Direção e Coordenação têm acesso geral de gestão.
 * - Atualizar escola, criar/editar períodos, definir período ativo e desativar professor: apenas 'direcao'.
 * - Nunca expõe 'pin_hash' em nenhum retorno (retorna AlunoPublico).
 * - IDs gerados via crypto.getRandomValues (ids.ts).
 */

import { GestaoService } from '../contracts';
import {
  Escola,
  Periodo,
  Disciplina,
  Turma,
  Oferta,
  OfertaDetalhada,
  Perfil,
  Aluno,
  AlunoPublico,
  Aviso,
  PrioridadeAviso,
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { hashPin, gerarPin4Digitos } from './crypto';
import { gerarId } from './ids';
import { exigirUsuario } from './autorizacao';

function toAlunoPublico(aluno: Aluno): AlunoPublico {
  const { pin_hash, ...publico } = aluno;
  return publico;
}

export class MockGestaoService implements GestaoService {
  async obterEscola(): Promise<Escola> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const escola = db.escolas[0];
    if (!escola) throw new Error('Escola não configurada.');
    return { ...escola };
  }

  async atualizarEscola(dados: Partial<Escola>): Promise<Escola> {
    await exigirUsuario(['direcao']); // Apenas direção
    const db = await getDatabase();
    if (!db.escolas[0]) throw new Error('Escola não encontrada.');
    db.escolas[0] = { ...db.escolas[0], ...dados };
    saveDatabase(db);
    return { ...db.escolas[0] };
  }

  async listarPeriodos(): Promise<Periodo[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    return [...db.periodos].sort((a, b) => a.ano_letivo - b.ano_letivo);
  }

  async criarPeriodo(dados: Omit<Periodo, 'id' | 'created_at'>): Promise<Periodo> {
    await exigirUsuario(['direcao']); // Apenas direção
    const db = await getDatabase();
    const novo: Periodo = {
      ...dados,
      id: gerarId('per'),
      created_at: new Date().toISOString(),
    };

    if (novo.ativo) {
      db.periodos.forEach((p) => {
        if (p.escola_id === novo.escola_id) p.ativo = false;
      });
    }

    db.periodos.push(novo);
    saveDatabase(db);
    return novo;
  }

  async atualizarPeriodo(id: string, dados: Partial<Periodo>): Promise<Periodo> {
    await exigirUsuario(['direcao']); // Apenas direção
    const db = await getDatabase();
    const index = db.periodos.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Período não encontrado.');

    if (dados.ativo) {
      const escolaId = db.periodos[index].escola_id;
      db.periodos.forEach((p) => {
        if (p.escola_id === escolaId) p.ativo = false;
      });
    }

    db.periodos[index] = { ...db.periodos[index], ...dados };
    saveDatabase(db);
    return { ...db.periodos[index] };
  }

  async definirPeriodoAtivo(id: string): Promise<void> {
    await exigirUsuario(['direcao']); // Apenas direção
    const db = await getDatabase();
    const periodo = db.periodos.find((p) => p.id === id);
    if (!periodo) throw new Error('Período não encontrado.');

    db.periodos.forEach((p) => {
      if (p.escola_id === periodo.escola_id) {
        p.ativo = p.id === id;
      }
    });
    saveDatabase(db);
  }

  async listarDisciplinas(): Promise<Disciplina[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    return [...db.disciplinas].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async criarDisciplina(nome: string): Promise<Disciplina> {
    const usuario = await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const nomeLimpo = nome.trim();
    const existe = db.disciplinas.some(
      (d) => d.nome.toLowerCase() === nomeLimpo.toLowerCase() && d.escola_id === usuario.escola_id
    );
    if (existe) throw new Error('Já existe uma disciplina cadastrada com este nome.');

    const nova: Disciplina = {
      id: gerarId('disc'),
      created_at: new Date().toISOString(),
      escola_id: usuario.escola_id,
      nome: nomeLimpo,
    };
    db.disciplinas.push(nova);
    saveDatabase(db);
    return nova;
  }

  async excluirDisciplina(id: string): Promise<void> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const emUso = db.ofertas.some((o) => o.disciplina_id === id);
    if (emUso) {
      throw new Error(
        'Não é possível excluir esta disciplina pois ela já possui ofertas associadas.'
      );
    }
    db.disciplinas = db.disciplinas.filter((d) => d.id !== id);
    saveDatabase(db);
  }

  async listarTurmas(): Promise<Turma[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    return [...db.turmas].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async criarTurma(dados: Omit<Turma, 'id' | 'created_at'>): Promise<Turma> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const codigoUpper = dados.codigo_acesso.trim().toUpperCase();

    const codigoJaExiste = db.turmas.some((t) => t.codigo_acesso === codigoUpper);
    if (codigoJaExiste) {
      throw new Error(`O código de acesso ${codigoUpper} já está sendo utilizado por outra turma.`);
    }

    const nova: Turma = {
      ...dados,
      codigo_acesso: codigoUpper,
      id: gerarId('turma'),
      created_at: new Date().toISOString(),
    };
    db.turmas.push(nova);
    saveDatabase(db);
    return nova;
  }

  async atualizarTurma(id: string, dados: Partial<Turma>): Promise<Turma> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const index = db.turmas.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Turma não encontrada.');

    if (dados.codigo_acesso) {
      const codigoUpper = dados.codigo_acesso.trim().toUpperCase();
      const duplicado = db.turmas.some(
        (t) => t.id !== id && t.codigo_acesso === codigoUpper
      );
      if (duplicado) {
        throw new Error(`O código de acesso ${codigoUpper} já está em uso.`);
      }
      dados.codigo_acesso = codigoUpper;
    }

    db.turmas[index] = { ...db.turmas[index], ...dados };
    saveDatabase(db);
    return { ...db.turmas[index] };
  }

  async listarOfertas(): Promise<OfertaDetalhada[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    return db.ofertas.map((o) => {
      const turma = db.turmas.find((t) => t.id === o.turma_id);
      const disciplina = db.disciplinas.find((d) => d.id === o.disciplina_id);
      const professor = db.perfis.find((p) => p.id === o.professor_id);

      return {
        ...o,
        turma_nome: turma?.nome || 'Turma desconhecida',
        turma_codigo: turma?.codigo_acesso || '',
        disciplina_nome: disciplina?.nome || 'Disciplina desconhecida',
        professor_nome: professor?.nome || 'Professor não atribuído',
      };
    });
  }

  async criarOferta(dados: Omit<Oferta, 'id' | 'created_at'>): Promise<Oferta> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const duplicada = db.ofertas.some(
      (o) => o.turma_id === dados.turma_id && o.disciplina_id === dados.disciplina_id
    );
    if (duplicada) {
      throw new Error('Já existe uma oferta desta disciplina cadastrada para esta turma.');
    }

    const nova: Oferta = {
      ...dados,
      id: gerarId('oferta'),
      created_at: new Date().toISOString(),
    };
    db.ofertas.push(nova);
    saveDatabase(db);
    return nova;
  }

  async excluirOferta(id: string): Promise<void> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const possuiAtividades = db.atividades.some((a) => a.oferta_id === id);
    if (possuiAtividades) {
      throw new Error(
        'Esta oferta possui atividades pedagógicas registradas e não pode ser excluída.'
      );
    }
    db.ofertas = db.ofertas.filter((o) => o.id !== id);
    saveDatabase(db);
  }

  async listarProfessores(): Promise<Perfil[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    return db.perfis
      .filter((p) => p.papel === 'professor' && p.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async convidarProfessor(email: string, nome: string): Promise<Perfil> {
    const usuario = await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const emailLimpo = email.trim().toLowerCase();

    const existe = db.perfis.some((p) => p.email?.toLowerCase() === emailLimpo);
    if (existe) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }

    const novo: Perfil = {
      id: gerarId('usr-prof'),
      created_at: new Date().toISOString(),
      escola_id: usuario.escola_id,
      nome: nome.trim(),
      papel: 'professor',
      ativo: true,
      email: emailLimpo,
    };
    db.perfis.push(novo);
    db.credenciais[emailLimpo] = 'demo123';
    saveDatabase(db);
    return novo;
  }

  async desativarProfessor(id: string): Promise<void> {
    await exigirUsuario(['direcao']); // Apenas direção
    const db = await getDatabase();
    const prof = db.perfis.find((p) => p.id === id && p.papel === 'professor');
    if (!prof) throw new Error('Professor não encontrado.');

    prof.ativo = false;
    saveDatabase(db);
  }

  async listarAlunos(turmaId?: string): Promise<AlunoPublico[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    let lista = db.alunos.filter((a) => a.ativo);
    if (turmaId) {
      lista = lista.filter((a) => a.turma_id === turmaId);
    }
    return lista
      .sort((a, b) => a.numero_chamada - b.numero_chamada)
      .map(toAlunoPublico);
  }

  async cadastrarAluno(
    dados: Omit<Aluno, 'id' | 'created_at' | 'pin_hash'>
  ): Promise<{ aluno: AlunoPublico; pin_puro: string }> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const pinPuro = gerarPin4Digitos();
    const pinHash = await hashPin(pinPuro);

    const novoAluno: Aluno = {
      ...dados,
      id: gerarId('aluno'),
      created_at: new Date().toISOString(),
      pin_hash: pinHash,
    };

    db.alunos.push(novoAluno);
    saveDatabase(db);

    return { aluno: toAlunoPublico(novoAluno), pin_puro: pinPuro };
  }

  async cadastrarAlunosEmLote(
    turmaId: string,
    nomes: string[]
  ): Promise<Array<{ aluno: AlunoPublico; pin_puro: string }>> {
    const usuario = await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const escolaId = db.turmas.find((t) => t.id === turmaId)?.escola_id || usuario.escola_id;

    const alunosDaTurma = db.alunos.filter((a) => a.turma_id === turmaId);
    let ultimoNumero = alunosDaTurma.reduce(
      (max, a) => (a.numero_chamada > max ? a.numero_chamada : max),
      0
    );

    const resultados: Array<{ aluno: AlunoPublico; pin_puro: string }> = [];

    for (const nome of nomes) {
      const nomeLimpo = nome.trim();
      if (!nomeLimpo) continue;

      ultimoNumero += 1;
      const pinPuro = gerarPin4Digitos();
      const pinHash = await hashPin(pinPuro);

      const aluno: Aluno = {
        id: gerarId('aluno'),
        created_at: new Date().toISOString(),
        escola_id: escolaId,
        turma_id: turmaId,
        nome_completo: nomeLimpo,
        numero_chamada: ultimoNumero,
        pin_hash: pinHash,
        ativo: true,
      };

      db.alunos.push(aluno);
      resultados.push({ aluno: toAlunoPublico(aluno), pin_puro: pinPuro });
    }

    saveDatabase(db);
    return resultados;
  }

  async atualizarAluno(
    id: string,
    dados: { nome_completo?: string; numero_chamada?: number; ativo?: boolean }
  ): Promise<AlunoPublico> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const aluno = db.alunos.find((a) => a.id === id);
    if (!aluno) throw new Error('Aluno não encontrado.');

    if (dados.nome_completo !== undefined) aluno.nome_completo = dados.nome_completo.trim();
    if (dados.numero_chamada !== undefined) aluno.numero_chamada = dados.numero_chamada;
    if (dados.ativo !== undefined) aluno.ativo = dados.ativo;

    saveDatabase(db);
    return toAlunoPublico(aluno);
  }

  async gerarOuResetarPin(alunoId: string): Promise<{ pin_puro: string }> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const aluno = db.alunos.find((a) => a.id === alunoId);
    if (!aluno) throw new Error('Aluno não encontrado.');

    const pinPuro = gerarPin4Digitos();
    aluno.pin_hash = await hashPin(pinPuro);

    saveDatabase(db);
    return { pin_puro: pinPuro };
  }

  async listarAvisosEscola(): Promise<Aviso[]> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    return db.avisos
      .filter((a) => a.turma_id === null)
      .sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime());
  }

  async criarAvisoEscola(dados: {
    titulo: string;
    mensagem: string;
    prioridade: PrioridadeAviso;
  }): Promise<Aviso> {
    const usuario = await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    const novo: Aviso = {
      id: gerarId('aviso'),
      created_at: new Date().toISOString(),
      escola_id: usuario.escola_id,
      autor_id: usuario.id,
      turma_id: null, // institucional da escola
      titulo: dados.titulo.trim(),
      mensagem: dados.mensagem.trim(),
      prioridade: dados.prioridade,
      publicado_em: new Date().toISOString(),
    };
    db.avisos.push(novo);
    saveDatabase(db);
    return novo;
  }

  async excluirAvisoEscola(id: string): Promise<void> {
    await exigirUsuario(['direcao', 'coordenacao']);
    const db = await getDatabase();
    db.avisos = db.avisos.filter((a) => a.id !== id);
    saveDatabase(db);
  }
}
