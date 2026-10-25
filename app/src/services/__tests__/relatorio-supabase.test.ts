import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseRelatorioService,
  criarSupabaseRelatorioService,
} from '../supabase/relatorio.supabase';
import { criarBancoDemonstracao } from '../mock/seed';
import {
  calcularDesempenhoTurmas,
  calcularDesempenhoHierarquico,
  calcularAlunosEmAtencao,
  calcularQuestoesCriticasEscola,
} from '../relatorios-escola';

type RespostaRpc = { data: unknown; error: { message: string; code?: string } | null };

function clienteComRpc(resposta: RespostaRpc | (() => RespostaRpc)) {
  const rpc = vi.fn(async () => (typeof resposta === 'function' ? resposta() : resposta));
  return { cliente: { rpc } as unknown as SupabaseClient, rpc };
}

describe('RelatorioService Supabase (Fase 5.5, via RPC)', () => {
  it('criarSupabaseRelatorioService instancia a classe', () => {
    const { cliente } = clienteComRpc({ data: {}, error: null });
    expect(criarSupabaseRelatorioService(cliente)).toBeInstanceOf(SupabaseRelatorioService);
  });

  describe('visaoGeralEscola', () => {
    it('chama relatorio_visao_geral sem parâmetros e devolve o jsonb', async () => {
      const visao = {
        total_alunos: 10,
        total_turmas: 2,
        total_professores: 3,
        total_atividades_publicadas: 4,
        aproveitamento_medio: 72.5,
      };
      const { cliente, rpc } = clienteComRpc({ data: visao, error: null });
      const resultado = await new SupabaseRelatorioService(cliente).visaoGeralEscola();
      expect(rpc).toHaveBeenCalledWith('relatorio_visao_geral', {});
      expect(resultado).toEqual(visao);
    });

    it('mantém aproveitamento nulo quando não há respostas', async () => {
      const visao = {
        total_alunos: 0,
        total_turmas: 0,
        total_professores: 0,
        total_atividades_publicadas: 0,
        aproveitamento_medio: null,
      };
      const { cliente } = clienteComRpc({ data: visao, error: null });
      const resultado = await new SupabaseRelatorioService(cliente).visaoGeralEscola();
      expect(resultado.aproveitamento_medio).toBeNull();
    });

    it('papel sem permissão (42501) vira mensagem de permissão', async () => {
      const { cliente } = clienteComRpc({ data: null, error: { message: 'x', code: '42501' } });
      await expect(new SupabaseRelatorioService(cliente).visaoGeralEscola()).rejects.toThrow(
        'Você não tem permissão para esta ação.'
      );
    });

    it('erro do Supabase vira mensagem em português, sem vazar o texto técnico', async () => {
      const { cliente } = clienteComRpc({ data: null, error: { message: 'relation "x" does not exist' } });
      await expect(new SupabaseRelatorioService(cliente).visaoGeralEscola()).rejects.toThrow(
        'Não foi possível carregar a visão geral da escola.'
      );
    });

    it('resposta vazia da RPC não passa como sucesso', async () => {
      const { cliente } = clienteComRpc({ data: null, error: null });
      await expect(new SupabaseRelatorioService(cliente).visaoGeralEscola()).rejects.toThrow();
    });
  });

  describe('relatórios por período', () => {
    it('manda o período à RPC e tolera tabelas ausentes no snapshot', async () => {
      const { cliente, rpc } = clienteComRpc({ data: {}, error: null });
      const service = new SupabaseRelatorioService(cliente);
      expect(await service.desempenhoTurmas('per-1')).toEqual([]);
      expect(await service.desempenhoHierarquicoTurmas('per-1')).toEqual([]);
      expect(await service.alunosEmAtencao('per-1')).toEqual([]);
      expect(await service.questoesCriticasEscola('per-1')).toEqual([]);
      expect(rpc).toHaveBeenCalledWith('relatorio_dados_periodo', { p_periodo_id: 'per-1' });
    });

    it('erro da RPC é propagado em português', async () => {
      const { cliente } = clienteComRpc({ data: null, error: { message: 'boom' } });
      await expect(new SupabaseRelatorioService(cliente).alunosEmAtencao('per-1')).rejects.toThrow(
        'Não foi possível carregar os dados do relatório.'
      );
    });

    it('papel sem permissão (42501) é recusado', async () => {
      const { cliente } = clienteComRpc({ data: null, error: { message: 'x', code: '42501' } });
      await expect(new SupabaseRelatorioService(cliente).desempenhoTurmas('per-1')).rejects.toThrow(
        'Você não tem permissão para esta ação.'
      );
    });

    it('com o snapshot da base de demonstração, dá o mesmo resultado do cálculo direto (paridade com o mock)', async () => {
      const banco = await criarBancoDemonstracao();
      const periodoId = banco.periodos.find((p) => p.ativo)?.id ?? banco.periodos[0].id;
      // Simula o transporte: o jsonb passa por serialização.
      const snapshot = JSON.parse(JSON.stringify(banco));
      const { cliente } = clienteComRpc({ data: snapshot, error: null });
      const service = new SupabaseRelatorioService(cliente);

      expect(await service.desempenhoTurmas(periodoId)).toEqual(calcularDesempenhoTurmas(banco, periodoId));
      expect(await service.desempenhoHierarquicoTurmas(periodoId)).toEqual(
        calcularDesempenhoHierarquico(banco, periodoId)
      );
      expect(await service.alunosEmAtencao(periodoId)).toEqual(calcularAlunosEmAtencao(banco, periodoId));
      expect(await service.questoesCriticasEscola(periodoId)).toEqual(
        calcularQuestoesCriticasEscola(banco, periodoId)
      );
    });

    it('relatórios pedidos juntos (Conselho) leem o snapshot UMA vez e dão o mesmo resultado; o pedido seguinte lê de novo', async () => {
      const banco = await criarBancoDemonstracao();
      const periodoId = banco.periodos.find((p) => p.ativo)?.id ?? banco.periodos[0].id;
      const snapshot = JSON.parse(JSON.stringify(banco));
      const { cliente, rpc } = clienteComRpc({ data: snapshot, error: null });
      const service = new SupabaseRelatorioService(cliente);

      const [th, aa, qc] = await Promise.all([
        service.desempenhoHierarquicoTurmas(periodoId),
        service.alunosEmAtencao(periodoId),
        service.questoesCriticasEscola(periodoId),
      ]);
      expect(rpc).toHaveBeenCalledTimes(1);
      // Os cálculos dividem o mesmo objeto: nenhum pode estragar o dos outros.
      expect(th).toEqual(calcularDesempenhoHierarquico(banco, periodoId));
      expect(aa).toEqual(calcularAlunosEmAtencao(banco, periodoId));
      expect(qc).toEqual(calcularQuestoesCriticasEscola(banco, periodoId));
      expect(snapshot).toEqual(JSON.parse(JSON.stringify(banco)));

      await service.desempenhoTurmas(periodoId);
      expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('períodos diferentes pedidos juntos não se misturam', async () => {
      const { cliente, rpc } = clienteComRpc({ data: {}, error: null });
      const service = new SupabaseRelatorioService(cliente);
      await Promise.all([service.desempenhoTurmas('per-1'), service.desempenhoTurmas('per-2')]);
      expect(rpc).toHaveBeenCalledWith('relatorio_dados_periodo', { p_periodo_id: 'per-1' });
      expect(rpc).toHaveBeenCalledWith('relatorio_dados_periodo', { p_periodo_id: 'per-2' });
      expect(rpc).toHaveBeenCalledTimes(2);
    });
  });
});
