import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import {
  BarChart3,
  Download,
  Loader2,
  AlertCircle,
  FolderTree,
  Table as TableIcon,
} from 'lucide-react';
import { relatorioService, gestaoService } from '@/services';
import {
  DesempenhoTurmaDisciplinaItem,
  DesempenhoTurmaHierarquico,
  Periodo,
} from '@/lib/types';
import { gerarCsv, baixarCsv } from '../utils/csv';
import { DesempenhoArvoreSubitens } from './DesempenhoArvoreSubitens';

export const GestaoDesempenhoSecao: React.FC = () => {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [itens, setItens] = useState<DesempenhoTurmaDisciplinaItem[]>([]);
  const [turmasHierarquicas, setTurmasHierarquicas] = useState<DesempenhoTurmaHierarquico[]>([]);
  const [visao, setVisao] = useState<'arvore' | 'tabela'>('tabela');

  const [carregandoPeriodos, setCarregandoPeriodos] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // 1. Carrega bimestres e seleciona o ativo por padrão
  useEffect(() => {
    let ativo = true;

    async function carregarPeriodos() {
      try {
        setCarregandoPeriodos(true);
        const lista = await gestaoService.listarPeriodos();
        if (ativo) {
          setPeriodos(lista);
          const periodoAtivo = lista.find((p) => p.ativo) || lista[0];
          if (periodoAtivo) {
            setPeriodoSelecionadoId(periodoAtivo.id);
          }
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar bimestres.');
        }
      } finally {
        if (ativo) {
          setCarregandoPeriodos(false);
        }
      }
    }

    carregarPeriodos();

    return () => {
      ativo = false;
    };
  }, []);

  // 2. Carrega relatório quando o período muda
  useEffect(() => {
    if (!periodoSelecionadoId) return;

    let ativo = true;

    async function carregarRelatorio() {
      try {
        setCarregandoDados(true);
        setErro(null);

        const [dadosTabela, dadosArvore] = await Promise.all([
          relatorioService.desempenhoTurmas(periodoSelecionadoId),
          relatorioService.desempenhoHierarquicoTurmas(periodoSelecionadoId),
        ]);

        if (ativo) {
          setItens(dadosTabela);
          setTurmasHierarquicas(dadosArvore);
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar desempenho das turmas.');
        }
      } finally {
        if (ativo) {
          setCarregandoDados(false);
        }
      }
    }

    carregarRelatorio();

    return () => {
      ativo = false;
    };
  }, [periodoSelecionadoId]);

  const periodoAtual = periodos.find((p) => p.id === periodoSelecionadoId);

  const handleBaixarCsv = () => {
    const sulfixoNome = (periodoAtual?.nome || 'periodo')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');

    // Se estiver na visão em árvore detalhada, exporta com hierarquia completa
    if (visao === 'arvore' && turmasHierarquicas.length > 0) {
      const colunas = [
        { chave: 'turma_nome', rotulo: 'Turma' },
        { chave: 'turma_serie', rotulo: 'Série' },
        { chave: 'acerto_turma', rotulo: '% Acerto Turma' },
        { chave: 'erro_turma', rotulo: '% Erro Turma' },
        { chave: 'disciplina_nome', rotulo: 'Disciplina' },
        { chave: 'professor_nome', rotulo: 'Professor(a)' },
        { chave: 'acerto_materia', rotulo: '% Acerto Matéria' },
        { chave: 'erro_materia', rotulo: '% Erro Matéria' },
        { chave: 'conteudo_nome', rotulo: 'Conteúdo' },
        { chave: 'acerto_conteudo', rotulo: '% Acerto Conteúdo' },
        { chave: 'erro_conteudo', rotulo: '% Erro Conteúdo' },
        { chave: 'questao_ordem', rotulo: 'Questão' },
        { chave: 'questao_tipo', rotulo: 'Tipo' },
        { chave: 'acerto_questao', rotulo: '% Acerto Questão' },
        { chave: 'erro_questao', rotulo: '% Erro Questão' },
        { chave: 'respostas_questao', rotulo: 'Total Respostas' },
        { chave: 'distrator_comum', rotulo: 'Erro Mais Comum' },
        { chave: 'questao_enunciado', rotulo: 'Enunciado' },
      ];

      const linhas: Array<Record<string, unknown>> = [];
      for (const t of turmasHierarquicas) {
        for (const m of t.materias) {
          for (const c of m.conteudos) {
            for (const q of c.questoes) {
              linhas.push({
                turma_nome: t.turma_nome,
                turma_serie: t.turma_serie,
                acerto_turma: t.porcentagem_acerto_geral !== null ? `${t.porcentagem_acerto_geral}%` : '',
                erro_turma: t.porcentagem_erro_geral !== null ? `${t.porcentagem_erro_geral}%` : '',
                disciplina_nome: m.disciplina_nome,
                professor_nome: m.professor_nome,
                acerto_materia: `${m.porcentagem_acerto}%`,
                erro_materia: `${m.porcentagem_erro}%`,
                conteudo_nome: c.conteudo_nome,
                acerto_conteudo: `${c.porcentagem_acerto}%`,
                erro_conteudo: `${c.porcentagem_erro}%`,
                questao_ordem: `#${q.ordem}`,
                questao_tipo: q.tipo,
                acerto_questao: `${q.porcentagem_acerto}%`,
                erro_questao: `${q.porcentagem_erro}%`,
                respostas_questao: q.total_respostas,
                distrator_comum: q.distrator_mais_escolhido?.letra
                  ? `Alt ${q.distrator_mais_escolhido.letra} (${q.distrator_mais_escolhido.porcentagem_escolhas}%)`
                  : '',
                questao_enunciado: q.enunciado.replace(/\n+/g, ' '),
              });
            }
          }
        }
      }

      if (linhas.length > 0) {
        const csv = gerarCsv(linhas, colunas);
        baixarCsv(`desempenho_detalhado_${sulfixoNome}.csv`, csv);
        return;
      }
    }

    // Exportação em formato de tabela resumida
    if (itens.length === 0) return;

    const colunas = [
      { chave: 'turma_nome', rotulo: 'Turma' },
      { chave: 'disciplina_nome', rotulo: 'Disciplina' },
      { chave: 'professor_nome', rotulo: 'Professor(a)' },
      { chave: 'total_alunos', rotulo: 'Total de Alunos' },
      { chave: 'aproveitamento_medio_formatado', rotulo: 'Aproveitamento Médio (%)' },
      { chave: 'faixa_otimo', rotulo: 'Ótimo' },
      { chave: 'faixa_bom', rotulo: 'Bom' },
      { chave: 'faixa_atencao', rotulo: 'Atenção' },
      { chave: 'faixa_sem_atividades', rotulo: 'Sem Atividades' },
    ];

    const linhas = itens.map((i) => ({
      turma_nome: i.turma_nome,
      disciplina_nome: i.disciplina_nome,
      professor_nome: i.professor_nome,
      total_alunos: i.total_alunos,
      aproveitamento_medio_formatado:
        i.aproveitamento_medio !== null ? i.aproveitamento_medio : (i.aguardando_correcao ? 'aguardando correção' : ''),
      faixa_otimo: i.faixas.otimo,
      faixa_bom: i.faixas.bom,
      faixa_atencao: i.faixas.atencao,
      faixa_sem_atividades: i.faixas.sem_atividades,
    }));

    const csv = gerarCsv(linhas, colunas);
    baixarCsv(`desempenho_turmas_${sulfixoNome}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Topo com Título, Seletor de Período e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Desempenho Pedagógico
          </h2>
          <p className="text-sm text-slate-500">
            Acompanhe o rendimento por turmas, matérias, conteúdos e questões detalhadas.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          {/* Alternador de Visão: Árvore vs Tabela */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setVisao('arvore')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                visao === 'arvore'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visualização hierárquica por subitens (Turma > Matéria > Conteúdo > Questões)"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Subitens</span>
            </button>
            <button
              onClick={() => setVisao('tabela')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                visao === 'tabela'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tabela consolidada resumo"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
          </div>

          {/* Seletor de Bimestre */}
          <select
            value={periodoSelecionadoId}
            onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
            disabled={carregandoPeriodos || periodos.length === 0}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} {p.ativo ? '(Atual)' : ''}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBaixarCsv}
            disabled={carregandoDados || (itens.length === 0 && turmasHierarquicas.length === 0)}
            className="flex items-center gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar CSV
          </Button>
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Conteúdo Principal */}
      {carregandoDados ? (
        <div className="p-12 text-center text-slate-400 flex justify-center items-center gap-2 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Carregando dados pedagógicos...</span>
        </div>
      ) : turmasHierarquicas.length === 0 && itens.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Nenhum dado encontrado para este período.</p>
          <p className="text-xs text-slate-400">
            Não há atividades publicadas ou turmas avaliadas no {periodoAtual?.nome || 'período selecionado'}.
          </p>
        </Card>
      ) : visao === 'arvore' ? (
        /* 1. VISÃO EM ÁRVORE DE SUBITENS (PADRÃO PRINCIPAL DA DIRETORA) */
        <DesempenhoArvoreSubitens
          turmas={turmasHierarquicas}
          nomePeriodo={periodoAtual?.nome || 'Período'}
        />
      ) : (
        /* 2. VISÃO EM TABELA RESUMIDA CONSOLIDADA */
        <Card className="overflow-hidden">
          <CardHeader className="py-4 border-b border-slate-100">
            <CardTitle className="text-base text-slate-800">
              Turmas Avaliadas — {periodoAtual?.nome} ({itens.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Turma</th>
                    <th className="px-4 py-3">Disciplina</th>
                    <th className="px-4 py-3">Professor(a)</th>
                    <th className="px-4 py-3 text-center">Alunos</th>
                    <th className="px-4 py-3 text-center">Média</th>
                    <th className="px-4 py-3 min-w-[240px]">Distribuição por Faixas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item, idx) => {
                    const totalFaixas =
                      item.faixas.otimo +
                      item.faixas.bom +
                      item.faixas.atencao +
                      item.faixas.sem_atividades;

                    return (
                      <tr key={`${item.turma_id}-${item.disciplina_id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {item.turma_nome}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                          {item.disciplina_nome}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                          {item.professor_nome}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-slate-700 text-xs">
                          {item.total_alunos}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {item.aproveitamento_medio !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                item.aproveitamento_medio >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.aproveitamento_medio >= 60
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.aproveitamento_medio.toString().replace('.', ',')}%
                            </span>
                          ) : item.aguardando_correcao ? (
                            <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                              aguardando correção
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            {/* Barra empilhada CSS */}
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                              {totalFaixas > 0 ? (
                                <>
                                  {item.faixas.otimo > 0 && (
                                    <div
                                      style={{
                                        width: `${(item.faixas.otimo / totalFaixas) * 100}%`,
                                      }}
                                      className="bg-emerald-500 h-full transition-all"
                                      title={`Ótimo: ${item.faixas.otimo}`}
                                    />
                                  )}
                                  {item.faixas.bom > 0 && (
                                    <div
                                      style={{
                                        width: `${(item.faixas.bom / totalFaixas) * 100}%`,
                                      }}
                                      className="bg-sky-500 h-full transition-all"
                                      title={`Bom: ${item.faixas.bom}`}
                                    />
                                  )}
                                  {item.faixas.atencao > 0 && (
                                    <div
                                      style={{
                                        width: `${(item.faixas.atencao / totalFaixas) * 100}%`,
                                      }}
                                      className="bg-amber-500 h-full transition-all"
                                      title={`Atenção: ${item.faixas.atencao}`}
                                    />
                                  )}
                                  {item.faixas.sem_atividades > 0 && (
                                    <div
                                      style={{
                                        width: `${(item.faixas.sem_atividades / totalFaixas) * 100}%`,
                                      }}
                                      className="bg-slate-300 h-full transition-all"
                                      title={`Sem atividades: ${item.faixas.sem_atividades}`}
                                    />
                                  )}
                                </>
                              ) : (
                                <div className="w-full bg-slate-200 h-full" />
                              )}
                            </div>

                            {/* Contagem por faixas */}
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span>Ótimo: <strong>{item.faixas.otimo}</strong></span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                                <span>Bom: <strong>{item.faixas.bom}</strong></span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span>Atenção: <strong>{item.faixas.atencao}</strong></span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                <span>Sem ativ.: <strong>{item.faixas.sem_atividades}</strong></span>
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
