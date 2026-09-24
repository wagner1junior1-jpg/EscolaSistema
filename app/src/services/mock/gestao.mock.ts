/**
 * SaberPontual — GestaoService Mock
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
} from '@/lib/types';
import { getDatabase, saveDatabase } from './db';
import { hashPin, gerarPin4Digitos } from './crypto';

export class MockGestaoService implements GestaoService {
  async obterEscola(): Promise<Escola> {
    const db = await getDatabase();
    const escola = db.escolas[0];
    if (!escola) throw new Error('Escola não configurada.');
    return { ...escola };
  }

  async atualizarEscola(dados: Partial<Escola>): Promise<Escola> {
    const db = await getDatabase();
    if (!db.escolas[0]) throw new Error('Escola não encontrada.');
    db.escolas[0] = { ...db.escolas[0], ...dados };
    saveDatabase(db);
    return { ...db.escolas[0] };
  }

  async listarPeriodos(): Promise<Periodo[]> {
    const db = await getDatabase();
    return [...db.periodos].sort((a, b) => a.ano_letivo - b.ano_letivo);
  }

  async criarPeriodo(dados: Omit<Periodo, 'id' | 'created_at'>): Promise<Periodo> {
    const db = await getDatabase();
    const novo: Periodo = {
      ...dados,
      id: `per-${Date.now()}`,
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
    const db = await getDatabase();
    return [...db.disciplinas].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async criarDisciplina(nome: string): Promise<Disciplina> {
    const db = await getDatabase();
    const nomeLimpo = nome.trim();
    const existe = db.disciplinas.some(
      (d) => d.nome.toLowerCase() === nomeLimpo.toLowerCase()
    );
    if (existe) throw new Error('Já existe uma disciplina cadastrada com este nome.');

    const nova: Disciplina = {
      id: `disc-${Date.now()}`,
      created_at: new Date().toISOString(),
      escola_id: db.escolas[0]?.id || 'esc-001',
      nome: nomeLimpo,
    };
    db.disciplinas.push(nova);
    saveDatabase(db);
    return nova;
  }

  async excluirDisciplina(id: string): Promise<void> {
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
    const db = await getDatabase();
    return [...db.turmas].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async criarTurma(dados: Omit<Turma, 'id' | 'created_at'>): Promise<Turma> {
    const db = await getDatabase();
    const codigoUpper = dados.codigo_acesso.trim().toUpperCase();

    const codigoJaExiste = db.turmas.some((t) => t.codigo_acesso === codigoUpper);
    if (codigoJaExiste) {
      throw new Error(`O código de acesso ${codigoUpper} já está sendo utilizado por outra turma.`);
    }

    const nova: Turma = {
      ...dados,
      codigo_acesso: codigoUpper,
      id: `turma-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    db.turmas.push(nova);
    saveDatabase(db);
    return nova;
  }

  async atualizarTurma(id: string, dados: Partial<Turma>): Promise<Turma> {
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
    const db = await getDatabase();
    const duplicada = db.ofertas.some(
      (o) => o.turma_id === dados.turma_id && o.disciplina_id === dados.disciplina_id
    );
    if (duplicada) {
      throw new Error('Já existe uma oferta desta disciplina cadastrada para esta turma.');
    }

    const nova: Oferta = {
      ...dados,
      id: `oferta-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    db.ofertas.push(nova);
    saveDatabase(db);
    return nova;
  }

  async excluirOferta(id: string): Promise<void> {
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
    const db = await getDatabase();
    return db.perfis
      .filter((p) => p.papel === 'professor' && p.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async convidarProfessor(email: string, nome: string): Promise<Perfil> {
    const db = await getDatabase();
    const emailLimpo = email.trim().toLowerCase();

    const existe = db.perfis.some((p) => p.email?.toLowerCase() === emailLimpo);
    if (existe) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }

    const novo: Perfil = {
      id: `usr-prof-${Date.now()}`,
      created_at: new Date().toISOString(),
      escola_id: db.escolas[0]?.id || 'esc-001',
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

  async listarAlunos(turmaId?: string): Promise<AlunoPublico[]> {
    const db = await getDatabase();
    let lista: Aluno[] = db.alunos.filter((a) => a.ativo);
    if (turmaId) {
      lista = lista.filter((a) => a.turma_id === turmaId);
    }
    return lista
      .sort((a, b) => a.numero_chamada - b.numero_chamada)
      .map(({ pin_hash: _ph, ...rest }) => rest);
  }

  async desativarProfessor(id: string): Promise<void> {
    const db = await getDatabase();
    const perfil = db.perfis.find((p) => p.id === id && p.papel === 'professor');
    if (!perfil) throw new Error('Professor não encontrado.');
    perfil.ativo = false;
    saveDatabase(db);
  }

  async atualizarAluno(
    id: string,
    dados: { nome_completo?: string; numero_chamada?: number; ativo?: boolean }
  ): Promise<AlunoPublico> {
    const db = await getDatabase();
    const idx = db.alunos.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Aluno não encontrado.');
    db.alunos[idx] = { ...db.alunos[idx], ...dados };
    saveDatabase(db);
    const { pin_hash: _ph, ...rest } = db.alunos[idx];
    return rest;
  }

  async cadastrarAluno(
    dados: Omit<Aluno, 'id' | 'created_at' | 'pin_hash'>
  ): Promise<{ aluno: Aluno; pin_puro: string }> {
    const db = await getDatabase();
    const pinPuro = gerarPin4Digitos();
    const pinHash = await hashPin(pinPuro);

    const novoAluno: Aluno = {
      ...dados,
      id: `aluno-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
      pin_hash: pinHash,
    };

    db.alunos.push(novoAluno);
    saveDatabase(db);

    return { aluno: novoAluno, pin_puro: pinPuro };
  }

  async cadastrarAlunosEmLote(
    turmaId: string,
    nomes: string[]
  ): Promise<Array<{ aluno: Aluno; pin_puro: string }>> {
    const db = await getDatabase();
    const escolaId = db.turmas.find((t) => t.id === turmaId)?.escola_id || 'esc-001';

    // Obtém o maior número de chamada atual da turma
    const alunosDaTurma = db.alunos.filter((a) => a.turma_id === turmaId);
    let ultimoNumero = alunosDaTurma.reduce(
      (max, a) => (a.numero_chamada > max ? a.numero_chamada : max),
      0
    );

    const resultados: Array<{ aluno: Aluno; pin_puro: string }> = [];

    for (const nome of nomes) {
      const nomeLimpo = nome.trim();
      if (!nomeLimpo) continue;

      ultimoNumero += 1;
      const pinPuro = gerarPin4Digitos();
      const pinHash = await hashPin(pinPuro);

      const aluno: Aluno = {
        id: `aluno-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        created_at: new Date().toISOString(),
        escola_id: escolaId,
        turma_id: turmaId,
        nome_completo: nomeLimpo,
        numero_chamada: ultimoNumero,
        pin_hash: pinHash,
        ativo: true,
      };

      db.alunos.push(aluno);
      resultados.push({ aluno, pin_puro: pinPuro });
    }

    saveDatabase(db);
    return resultados;
  }

  async gerarOuResetarPin(alunoId: string): Promise<{ pin_puro: string }> {
    const db = await getDatabase();
    const aluno = db.alunos.find((a) => a.id === alunoId);
    if (!aluno) throw new Error('Aluno não encontrado.');

    const pinPuro = gerarPin4Digitos();
    aluno.pin_hash = await hashPin(pinPuro);

    saveDatabase(db);
    return { pin_puro: pinPuro };
  }

  async listarAvisosEscola(): Promise<Aviso[]> {
    const db = await getDatabase();
    return db.avisos
      .filter((a) => a.turma_id === null)
      .sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime());
  }

  async criarAvisoEscola(
    dados: Omit<Aviso, 'id' | 'created_at' | 'publicado_em'>
  ): Promise<Aviso> {
    const db = await getDatabase();
    const novo: Aviso = {
      ...dados,
      turma_id: null, // institucional
      id: `aviso-${Date.now()}`,
      created_at: new Date().toISOString(),
      publicado_em: new Date().toISOString(),
    };
    db.avisos.push(novo);
    saveDatabase(db);
    return novo;
  }

  async excluirAvisoEscola(id: string): Promise<void> {
    const db = await getDatabase();
    db.avisos = db.avisos.filter((a) => a.id !== id);
    saveDatabase(db);
  }
}
