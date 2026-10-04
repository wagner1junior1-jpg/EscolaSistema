import { describe, it, expect } from 'vitest';
import { criarBancoDemonstracao, dataRelativa } from '../mock/seed';
import { enriquecerEscolaReal3a6Ano } from '../mock/seed-escola-ampliada';

describe('Validação da Escola Direcionada aos 2 Professores (1 Mês de Funcionamento)', () => {
  it('deve ter todas as 7 disciplinas ativas com as turmas atribuídas a Ana Paula e Carlos Roberto', async () => {
    const db = await criarBancoDemonstracao();
    await enriquecerEscolaReal3a6Ano(db);

    const disciplinas = db.disciplinas.map((d) => d.nome);
    expect(disciplinas).toContain('Matemática');
    expect(disciplinas).toContain('Língua Portuguesa');
    expect(disciplinas).toContain('Ciências');
    expect(disciplinas).toContain('História');
    expect(disciplinas).toContain('Geografia');
    expect(disciplinas).toContain('Língua Inglesa');
    expect(disciplinas).toContain('Arte');

    // Ofertas no 6º Ano A para Profª Ana Paula
    const ofertasAna = db.ofertas.filter((o) => o.professor_id === 'usr-prof-ana' && o.turma_id === 'turma-7a');
    const discAnaIds = ofertasAna.map((o) => o.disciplina_id);
    expect(discAnaIds).toContain('disc-mat');
    expect(discAnaIds).toContain('disc-port');
    expect(discAnaIds).toContain('disc-art');

    // Ofertas no 6º Ano A para Prof. Carlos Roberto
    const ofertasCarlos = db.ofertas.filter((o) => o.professor_id === 'usr-prof-carlos' && o.turma_id === 'turma-7a');
    const discCarlosIds = ofertasCarlos.map((o) => o.disciplina_id);
    expect(discCarlosIds).toContain('disc-cien');
    expect(discCarlosIds).toContain('disc-hist');
    expect(discCarlosIds).toContain('disc-geo');
    expect(discCarlosIds).toContain('disc-ing');
  });

  it('deve ter acervo ampliado de atividades para Profª Ana Paula no 6º Ano A', async () => {
    const db = await criarBancoDemonstracao();
    await enriquecerEscolaReal3a6Ano(db);

    // Oferta de Matemática da Ana no 6º Ano A
    const ativsMatAna = db.atividades.filter((a) => a.oferta_id === 'oferta-mat-7a');
    expect(ativsMatAna.length).toBeGreaterThanOrEqual(5);

    // Deve ter pelo menos 3 atividades encerradas em Matemática para histórico denso
    const matEncerradas = ativsMatAna.filter((a) => a.status === 'encerrada');
    expect(matEncerradas.length).toBeGreaterThanOrEqual(3);

    // Deve ter uma em rascunho para demonstrar edição
    const matRascunho = ativsMatAna.find((a) => a.status === 'rascunho');
    expect(matRascunho).toBeDefined();

    // Oferta de Língua Portuguesa da Ana no 6º Ano A
    const ativsPortAna = db.atividades.filter((a) => a.oferta_id === 'oferta-port-7a');
    expect(ativsPortAna.length).toBeGreaterThanOrEqual(3);

    // Questão discursiva pendente na fila de Ana Paula
    const respPendenteAna = db.respostas.find((r) => r.questao_id === 'q-real-port-4' && r.correcao === 'pendente');
    expect(respPendenteAna).toBeDefined();

    // Atividade de Arte de Ana Paula pendente para Lucas
    const ativArte = db.atividades.find((a) => a.id === 'ativ-real-art-01');
    expect(ativArte?.criado_por).toBe('usr-prof-ana');

    // Avisos cadastrados no mural
    expect(db.avisos.length).toBeGreaterThanOrEqual(5);
  });

  describe('dataRelativa', () => {
    it('deve retornar data no formato YYYY-MM-DD calculada a partir de hoje', () => {
      const hojeStr = dataRelativa(0);
      expect(hojeStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const futuroStr = dataRelativa(5);
      expect(futuroStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const dHoje = new Date(hojeStr + 'T00:00:00');
      const dFuturo = new Date(futuroStr + 'T00:00:00');
      const diffDias = Math.round((dFuturo.getTime() - dHoje.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDias).toBe(5);
    });
  });
});
