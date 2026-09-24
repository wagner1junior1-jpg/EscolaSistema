/**
 * SaberPontual — Supabase Service Stubs (Fase A)
 * 
 * Lançam o erro 'Supabase ainda não configurado' até que a integração
 * seja implementada na Fase A2 / Fase B.
 */

import {
  AuthService,
  GestaoService,
  ProfessorService,
  AlunoService,
  RelatorioService,
} from '../contracts';

const ERR_MSG = 'Supabase ainda não configurado';

export class SupabaseAuthServiceStub implements AuthService {
  async login(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async logout(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async usuarioAtual(): Promise<never> {
    throw new Error(ERR_MSG);
  }
}

export class SupabaseGestaoServiceStub implements GestaoService {
  async obterEscola(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async atualizarEscola(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarPeriodos(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarPeriodo(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async atualizarPeriodo(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async definirPeriodoAtivo(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarDisciplinas(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarDisciplina(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async excluirDisciplina(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarTurmas(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarTurma(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async atualizarTurma(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarOfertas(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarOferta(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async excluirOferta(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarProfessores(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async convidarProfessor(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarAlunos(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async cadastrarAluno(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async cadastrarAlunosEmLote(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async gerarOuResetarPin(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarAvisosEscola(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarAvisoEscola(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async excluirAvisoEscola(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async desativarProfessor(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async atualizarAluno(): Promise<never> {
    throw new Error(ERR_MSG);
  }
}

export class SupabaseProfessorServiceStub implements ProfessorService {
  async minhasOfertas(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarAtividades(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async obterAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async atualizarAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async publicarAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async encerrarAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async duplicarAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async salvarQuestoes(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async reordenarQuestoes(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async excluirAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async excluirQuestao(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarFrequencia(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async salvarFrequencia(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async listarRecadosTurma(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async criarRecadoTurma(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async mapaDeCalor(): Promise<never> {
    throw new Error(ERR_MSG);
  }
}

export class SupabaseAlunoServiceStub implements AlunoService {
  async listarTurma(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async login(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async atividadesPendentes(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async carregarAtividade(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async responder(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async boletim(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async avisos(): Promise<never> {
    throw new Error(ERR_MSG);
  }
}

export class SupabaseRelatorioServiceStub implements RelatorioService {
  async conselhoDeClasse(): Promise<never> {
    throw new Error(ERR_MSG);
  }
  async visaoGeralEscola(): Promise<never> {
    throw new Error(ERR_MSG);
  }
}
