import { describe, it, expect, vi } from 'vitest';
import {
  uuidV5,
  uuidV5Com,
  idDe,
  recuperarPins,
  montarLinhas,
  LinhasPostgres,
} from '../../scripts/seed-mapa';
import { criarBancoDemonstracao } from '../mock/seed';
import { hashPin } from '../mock/crypto';

describe('Seed Supabase — Mapeamento e Lógica Pura (seed-mapa)', () => {
  describe('UUID v5 e identificadores determinísticos', () => {
    it('bate com o vetor oficial RFC 4122 (DNS python.org)', () => {
      const dnsNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const resultado = uuidV5Com(dnsNamespace, 'python.org');
      expect(resultado).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
    });

    it('gera formato UUID v5 válido (versão 5 e variante 1)', () => {
      const id = uuidV5('teste-entidade');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('garante idempotência: mesmo nome produz o mesmo UUID', () => {
      const id1 = uuidV5('escolas:esc-001');
      const id2 = uuidV5('escolas:esc-001');
      expect(id1).toBe(id2);
    });

    it('nomes diferentes geram UUIDs distintos', () => {
      const id1 = uuidV5('escolas:esc-001');
      const id2 = uuidV5('escolas:esc-002');
      expect(id1).not.toBe(id2);
    });

    it('idDe diferencia entidades de tabelas distintas com o mesmo id legível', () => {
      const idTurma = idDe('turmas', 'x');
      const idAluno = idDe('alunos', 'x');
      expect(idTurma).not.toBe(idAluno);
      expect(idTurma).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(idAluno).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('recuperarPins', () => {
    it('devolve os PINs certos para uma base com hashes conhecidos', async () => {
      const alunos = [
        { id: 'aluno-1', pin_hash: await hashPin('1420') },
        { id: 'aluno-2', pin_hash: await hashPin('3891') },
        { id: 'aluno-3', pin_hash: await hashPin('0007') },
      ];

      const pins = recuperarPins(alunos);
      expect(pins.get('aluno-1')).toBe('1420');
      expect(pins.get('aluno-2')).toBe('3891');
      expect(pins.get('aluno-3')).toBe('0007');
    });

    it('lança erro informando o id do aluno para hash desconhecido', () => {
      const alunos = [
        { id: 'aluno-invalido', pin_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      ];

      expect(() => recuperarPins(alunos)).toThrow(/aluno-invalido/);
    });

    it('recupera com sucesso os PINs de todos os alunos do mock de demonstração', async () => {
      const db = await criarBancoDemonstracao();
      const pins = recuperarPins(db.alunos);
      expect(pins.size).toBe(db.alunos.length);
      for (const aluno of db.alunos) {
        const pin = pins.get(aluno.id);
        expect(pin).toBeDefined();
        expect(pin).toMatch(/^[0-9]{4}$/);
      }
    });
  });

  describe('montarLinhas', () => {
    async function setupBase() {
      const db = await criarBancoDemonstracao();
      // Simula UUIDs do Supabase Auth para cada perfil da base
      const mapaPerfis = new Map<string, string>();
      for (const p of db.perfis) {
        mapaPerfis.set(p.id, idDe('auth_users', p.id));
      }
      return { db, mapaPerfis };
    }

    it('não repete ids dentro de cada tabela e todos são UUID válidos', async () => {
      const { db, mapaPerfis } = await setupBase();
      const linhas = montarLinhas(db, mapaPerfis);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const [tabela, registros] of Object.entries(linhas)) {
        const ids = new Set<string>();
        for (const reg of registros) {
          expect(reg.id, `ID inválido na tabela ${tabela}`).toMatch(uuidRegex);
          expect(ids.has(reg.id), `ID duplicado na tabela ${tabela}: ${reg.id}`).toBe(false);
          ids.add(reg.id);
        }
      }
    });

    it('toda chave estrangeira aponta para uma linha existente', async () => {
      const { db, mapaPerfis } = await setupBase();
      const linhas = montarLinhas(db, mapaPerfis);

      const escolasIds = new Set(linhas.escolas.map((r) => r.id));
      const perfisIds = new Set(linhas.perfis.map((r) => r.id));
      const periodosIds = new Set(linhas.periodos.map((r) => r.id));
      const disciplinasIds = new Set(linhas.disciplinas.map((r) => r.id));
      const turmasIds = new Set(linhas.turmas.map((r) => r.id));
      const ofertasIds = new Set(linhas.ofertas.map((r) => r.id));
      const alunosIds = new Set(linhas.alunos.map((r) => r.id));
      const assuntosIds = new Set(linhas.assuntos.map((r) => r.id));
      const bancoQuestoesIds = new Set(linhas.banco_questoes.map((r) => r.id));
      const atividadesIds = new Set(linhas.atividades.map((r) => r.id));
      const questoesIds = new Set(linhas.questoes.map((r) => r.id));
      const alternativasIds = new Set(linhas.alternativas.map((r) => r.id));

      // Perfis
      for (const p of linhas.perfis) {
        expect(escolasIds.has(p.escola_id)).toBe(true);
      }
      // Periodos
      for (const per of linhas.periodos) {
        expect(escolasIds.has(per.escola_id)).toBe(true);
      }
      // Disciplinas
      for (const d of linhas.disciplinas) {
        expect(escolasIds.has(d.escola_id)).toBe(true);
      }
      // Turmas
      for (const t of linhas.turmas) {
        expect(escolasIds.has(t.escola_id)).toBe(true);
      }
      // Ofertas -> turmas, disciplinas, perfis
      for (const o of linhas.ofertas) {
        expect(turmasIds.has(o.turma_id)).toBe(true);
        expect(disciplinasIds.has(o.disciplina_id)).toBe(true);
        expect(perfisIds.has(o.professor_id)).toBe(true);
      }
      // Alunos -> turmas, escolas
      for (const a of linhas.alunos) {
        expect(escolasIds.has(a.escola_id)).toBe(true);
        expect(turmasIds.has(a.turma_id)).toBe(true);
      }
      // Assuntos -> escolas, disciplinas
      for (const as of linhas.assuntos) {
        expect(escolasIds.has(as.escola_id)).toBe(true);
        expect(disciplinasIds.has(as.disciplina_id)).toBe(true);
      }
      // BancoQuestoes -> escolas, disciplinas, assuntos, perfis
      for (const bq of linhas.banco_questoes) {
        expect(escolasIds.has(bq.escola_id)).toBe(true);
        expect(disciplinasIds.has(bq.disciplina_id)).toBe(true);
        expect(assuntosIds.has(bq.assunto_id)).toBe(true);
        expect(perfisIds.has(bq.criado_por)).toBe(true);
      }
      // BancoAlternativas -> banco_questoes
      for (const ba of linhas.banco_alternativas) {
        expect(bancoQuestoesIds.has(ba.banco_questao_id)).toBe(true);
      }
      // Atividades -> ofertas, periodos, perfis
      for (const at of linhas.atividades) {
        expect(ofertasIds.has(at.oferta_id)).toBe(true);
        expect(periodosIds.has(at.periodo_id)).toBe(true);
        expect(perfisIds.has(at.criado_por)).toBe(true);
      }
      // Questoes -> atividades, banco_questoes, assuntos
      for (const q of linhas.questoes) {
        expect(atividadesIds.has(q.atividade_id)).toBe(true);
        if (q.banco_questao_id) expect(bancoQuestoesIds.has(q.banco_questao_id)).toBe(true);
        if (q.assunto_id) expect(assuntosIds.has(q.assunto_id)).toBe(true);
      }
      // Alternativas -> questoes
      for (const alt of linhas.alternativas) {
        expect(questoesIds.has(alt.questao_id)).toBe(true);
      }
      // Respostas -> alunos, questoes, alternativas, perfis
      for (const r of linhas.respostas) {
        expect(alunosIds.has(r.aluno_id)).toBe(true);
        expect(questoesIds.has(r.questao_id)).toBe(true);
        if (r.alternativa_id) expect(alternativasIds.has(r.alternativa_id)).toBe(true);
        if (r.corrigido_por) expect(perfisIds.has(r.corrigido_por)).toBe(true);
      }
      // Avisos -> escolas, perfis, turmas
      for (const av of linhas.avisos) {
        expect(escolasIds.has(av.escola_id)).toBe(true);
        expect(perfisIds.has(av.autor_id)).toBe(true);
        if (av.turma_id) expect(turmasIds.has(av.turma_id)).toBe(true);
      }
      // AlunoObservacoes -> alunos, perfis
      for (const obs of linhas.aluno_observacoes) {
        expect(alunosIds.has(obs.aluno_id)).toBe(true);
        expect(perfisIds.has(obs.professor_id)).toBe(true);
      }
    });

    it('não inclui pin_hash em alunos nem credenciais em nenhuma tabela', async () => {
      const { db, mapaPerfis } = await setupBase();
      const linhas = montarLinhas(db, mapaPerfis);

      for (const a of linhas.alunos) {
        expect(a).not.toHaveProperty('pin_hash');
      }

      for (const [tabela, registros] of Object.entries(linhas)) {
        for (const r of registros) {
          expect(r, `Tabela '${tabela}' possui campo 'credenciais'`).not.toHaveProperty('credenciais');
          expect(r, `Tabela '${tabela}' possui campo 'updated_at'`).not.toHaveProperty('updated_at');
          expect(r, `Tabela '${tabela}' possui campo 'deleted_at'`).not.toHaveProperty('deleted_at');
        }
      }
    });

    it('as contagens por tabela são iguais às da base do mock', async () => {
      const { db, mapaPerfis } = await setupBase();
      const linhas = montarLinhas(db, mapaPerfis);

      expect(linhas.escolas.length).toBe(db.escolas.length);
      expect(linhas.perfis.length).toBe(db.perfis.length);
      expect(linhas.periodos.length).toBe(db.periodos.length);
      expect(linhas.disciplinas.length).toBe(db.disciplinas.length);
      expect(linhas.turmas.length).toBe(db.turmas.length);
      expect(linhas.ofertas.length).toBe(db.ofertas.length);
      expect(linhas.alunos.length).toBe(db.alunos.length);
      expect(linhas.assuntos.length).toBe(db.assuntos.length);
      expect(linhas.banco_questoes.length).toBe(db.banco_questoes.length);
      expect(linhas.banco_alternativas.length).toBe(db.banco_alternativas.length);
      expect(linhas.atividades.length).toBe(db.atividades.length);
      expect(linhas.questoes.length).toBe(db.questoes.length);
      expect(linhas.alternativas.length).toBe(db.alternativas.length);
      expect(linhas.respostas.length).toBe(db.respostas.length);
      expect(linhas.avisos.length).toBe(db.avisos.length);
      expect(linhas.aluno_observacoes.length).toBe((db.aluno_observacoes || []).length);
    });

    it('é idempotente: rodar duas vezes gera exatamente os mesmos IDs', async () => {
      const { db, mapaPerfis } = await setupBase();
      const linhas1 = montarLinhas(db, mapaPerfis);
      const linhas2 = montarLinhas(db, mapaPerfis);

      for (const tabela of Object.keys(linhas1) as Array<keyof LinhasPostgres>) {
        const ids1 = linhas1[tabela].map((r) => r.id);
        const ids2 = linhas2[tabela].map((r) => r.id);
        expect(ids1).toEqual(ids2);
      }
    });

    it('uma base com chave estrangeira solta lança erro com o nome da tabela e da coluna', async () => {
      const { db, mapaPerfis } = await setupBase();
      // Remove uma turma que possui alunos
      const turmaComAlunos = db.turmas[0];
      db.turmas = db.turmas.filter((t) => t.id !== turmaComAlunos.id);

      expect(() => montarLinhas(db, mapaPerfis)).toThrow(/alunos.*turma_id|ofertas.*turma_id/i);
    });
  });

  // O seed real roda FORA do ambiente de teste e carrega a base AMPLIADA (a pequena é só dos
  // testes). Ela tem que respeitar as chaves estrangeiras e os únicos do banco, que o mock
  // tolerava quebrados (ex.: uma questão do banco apontava para um assunto inexistente).
  describe('base ampliada (a que o seed grava no Supabase)', () => {
    // O mock só devolve a base ampliada fora de teste: NODE_ENV diferente de 'test' E sem
    // navigator.webdriver (o happy-dom marca webdriver como true).
    const simularForaDoTeste = () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubGlobal('navigator', { webdriver: false });
    };
    const desfazerSimulacao = () => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    };

    it('gera linhas consistentes com as restrições do banco', async () => {
      simularForaDoTeste();
      try {
        const db = await criarBancoDemonstracao();
        expect(db.alunos.length).toBeGreaterThan(30); // confirma que veio a base ampliada
        const mapaPerfis = new Map(db.perfis.map((p) => [p.id, idDe('auth_users', p.id)]));
        const linhas = montarLinhas(db, mapaPerfis); // lança se houver chave estrangeira solta

        const unico = (tabela: keyof LinhasPostgres, colunas: string[]) => {
          const vistos = new Set<string>();
          for (const r of linhas[tabela]) {
            const chave = colunas.map((c) => String(r[c])).join('|');
            expect(vistos.has(chave), `${tabela}: repetido em (${colunas.join(', ')}) = ${chave}`).toBe(false);
            vistos.add(chave);
          }
        };
        unico('perfis', ['email']);
        unico('disciplinas', ['escola_id', 'nome']);
        unico('turmas', ['codigo_acesso']);
        unico('ofertas', ['turma_id', 'disciplina_id']);
        unico('assuntos', ['disciplina_id', 'nome']);
        unico('banco_alternativas', ['banco_questao_id', 'letra']);
        unico('alternativas', ['questao_id', 'letra']);
        unico('respostas', ['aluno_id', 'questao_id']);
      } finally {
        desfazerSimulacao();
      }
    });

    it('todos os alunos têm PIN recuperável', async () => {
      simularForaDoTeste();
      try {
        const db = await criarBancoDemonstracao();
        expect(recuperarPins(db.alunos).size).toBe(db.alunos.length);
      } finally {
        desfazerSimulacao();
      }
    });
  });
});

