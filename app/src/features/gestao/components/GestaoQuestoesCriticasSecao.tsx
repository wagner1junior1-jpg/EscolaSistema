import React, { useEffect, useState } from 'react';
import { Card, Button } from '@/components/ui';
import { HelpCircle, Download, Loader2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { relatorioService, gestaoService } from '@/services';
import { QuestaoCriticaEscolaItem, Periodo } from '@/lib/types';
import { gerarCsv, baixarCsv } from '../utils/csv';

export const GestaoQuestoesCriticasSecao: React.FC = () => {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [itens, setItens] = useState<QuestaoCriticaEscolaItem[]>([]);
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

  // 2. Carrega questões críticas do período
  useEffect(() => {
    if (!periodoSelecionadoId) return;

    let ativo = true;

    async function carregarQuestoes() {
      try {
        setCarregandoDados(true);
        setErro(null);
        const dados = await relatorioService.questoesCriticasEscola(periodoSelecionadoId);
        if (ativo) {
          setItens(dados);
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar questões críticas.');
        }
      } finally {
        if (ativo) {
          setCarregandoDados(false);
        }
      }
    }

    carregarQuestoes();

    return () => {
      ativo = false;
    };
  }, [periodoSelecionadoId]);

  const periodoAtual = periodos.find((p) => p.id === periodoSelecionadoId);

  const handleBaixarCsv = () => {
    if (itens.length === 0) return;

    const colunas = [
      { chave: 'enunciado', rotulo: 'Enunciado da Questão' },
      { chave: 'turma_nome', rotulo: 'Turma' },
      { chave: 'disciplina_nome', rotulo: 'Disciplina' },
      { chave: 'atividade_titulo', rotulo: 'Atividade de Origem' },
      { chave: 'porcentagem_acerto', rotulo: 'Acerto (%)' },
      { chave: 'total_respostas', rotulo: 'Total de Respostas' },
      { chave: 'distrator_letra', rotulo: 'Distrator Mais Escolhido' },
      { chave: 'distrator_total', rotulo: 'Total Escolhas Distrator' },
      { chave: 'distrator_por_que_errou', rotulo: 'Por Que Errou (Diagnóstico)' },
    ];

    const linhas = itens.map((i) => ({
      enunciado: i.enunciado,
      turma_nome: i.turma_nome,
      disciplina_nome: i.disciplina_nome,
      atividade_titulo: i.atividade_titulo,
      porcentagem_acerto: i.porcentagem_acerto,
      total_respostas: i.total_respostas,
      distrator_letra: i.distrator_mais_escolhido?.letra || '',
      distrator_total: i.distrator_mais_escolhido?.total_escolhas || '',
      distrator_por_que_errou: i.distrator_mais_escolhido?.por_que_errou || '',
    }));

    const csv = gerarCsv(linhas, colunas);
    const sulfixoNome = (periodoAtual?.nome || 'periodo')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
    baixarCsv(`questoes_criticas_${sulfixoNome}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Topo com Título e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-rose-600" />
            Questões Críticas da Escola
          </h2>
          <p className="text-sm text-slate-500">
            Itens com aproveitamento inferior a 50% e análise diagnóstica dos erros mais frequentes.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
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
            disabled={carregandoDados || itens.length === 0}
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

      {/* Conteúdo de Questões Críticas */}
      {carregandoDados ? (
        <div className="p-12 text-center text-slate-400 flex justify-center items-center gap-2 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Analisando questões avaliadas...</span>
        </div>
      ) : itens.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">
            Nenhuma questão crítica identificada no {periodoAtual?.nome || 'período'}!
          </p>
          <p className="text-xs text-slate-400">
            Nenhum item com pelo menos 5 respostas apresentou taxa de acerto inferior a 50%.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {itens.map((q, idx) => (
            <Card key={`${q.questao_id}-${idx}`} className="p-5 border-slate-200 hover:border-slate-300">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {q.turma_nome}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {q.disciplina_nome}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">
                      Atividade: <strong>{q.atividade_titulo}</strong> (Questão #{q.ordem})
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-2 leading-relaxed">
                    {q.enunciado}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-center">
                    <div className="text-[10px] uppercase font-bold text-rose-600">Taxa de Acerto</div>
                    <div className="font-mono font-black text-lg text-rose-700">
                      {q.porcentagem_acerto.toString().replace('.', ',')}%
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Respostas</div>
                    <div className="font-mono font-bold text-base text-slate-800">
                      {q.total_respostas}
                    </div>
                  </div>
                </div>
              </div>

              {/* Análise do Distrator mais escolhido */}
              {q.distrator_mais_escolhido && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-start gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/70">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-amber-950 flex items-center gap-2">
                      <span>Distrator mais escolhido: Alternativa {q.distrator_mais_escolhido.letra}</span>
                      <span className="text-amber-700 font-normal">
                        ({q.distrator_mais_escolhido.total_escolhas}{' '}
                        {q.distrator_mais_escolhido.total_escolhas === 1 ? 'aluno escolheu' : 'alunos escolheram'})
                      </span>
                    </div>
                    {q.distrator_mais_escolhido.por_que_errou && (
                      <p className="text-amber-900 italic">
                        "Por que errou": {q.distrator_mais_escolhido.por_que_errou}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
