import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { AlertTriangle, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { relatorioService, gestaoService } from '@/services';
import { AlunoEmAtencaoItem, Periodo } from '@/lib/types';
import { gerarCsv, baixarCsv } from '../utils/csv';

export const GestaoAlunosAtencaoSecao: React.FC = () => {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [itens, setItens] = useState<AlunoEmAtencaoItem[]>([]);
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

  // 2. Carrega lista de alunos em atenção
  useEffect(() => {
    if (!periodoSelecionadoId) return;

    let ativo = true;

    async function carregarAlunos() {
      try {
        setCarregandoDados(true);
        setErro(null);
        const dados = await relatorioService.alunosEmAtencao(periodoSelecionadoId);
        if (ativo) {
          // Ordena da menor para a maior nota
          const ordenados = [...dados].sort((a, b) => a.media - b.media);
          setItens(ordenados);
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar alunos em atenção.');
        }
      } finally {
        if (ativo) {
          setCarregandoDados(false);
        }
      }
    }

    carregarAlunos();

    return () => {
      ativo = false;
    };
  }, [periodoSelecionadoId]);

  const periodoAtual = periodos.find((p) => p.id === periodoSelecionadoId);

  const handleBaixarCsv = () => {
    if (itens.length === 0) return;

    const colunas = [
      { chave: 'nome_completo', rotulo: 'Nome do Aluno' },
      { chave: 'numero_chamada', rotulo: 'Nº Chamada' },
      { chave: 'turma_nome', rotulo: 'Turma' },
      { chave: 'disciplina_nome', rotulo: 'Disciplina' },
      { chave: 'professor_nome', rotulo: 'Professor(a)' },
      { chave: 'media', rotulo: 'Média (%)' },
      { chave: 'faixa', rotulo: 'Faixa de Desempenho' },
    ];

    const linhas = itens.map((i) => ({
      nome_completo: i.nome_completo,
      numero_chamada: i.numero_chamada,
      turma_nome: i.turma_nome,
      disciplina_nome: i.disciplina_nome,
      professor_nome: i.professor_nome,
      media: i.media,
      faixa: i.faixa,
    }));

    const csv = gerarCsv(linhas, colunas);
    const sulfixoNome = (periodoAtual?.nome || 'periodo')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
    baixarCsv(`alunos_em_atencao_${sulfixoNome}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      {/* Topo com Título e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            Alunos em Atenção Pedagógica
          </h2>
          <p className="text-sm text-slate-500">
            Estudantes com aproveitamento inferior a 60% ordenados da menor para a maior nota.
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

      {/* Tabela de Alunos em Atenção */}
      {carregandoDados ? (
        <div className="p-12 text-center text-slate-400 flex justify-center items-center gap-2 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Identificando alunos em atenção...</span>
        </div>
      ) : itens.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">
            Nenhum aluno em faixa de atenção neste período!
          </p>
          <p className="text-xs text-slate-400">
            Todos os estudantes avaliados no {periodoAtual?.nome || 'período'} atingiram rendimento satisfatório.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base text-slate-800">
              Estudantes Necessitando Apoio — {periodoAtual?.nome} ({itens.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Estudante</th>
                    <th className="px-4 py-3">Turma</th>
                    <th className="px-4 py-3">Disciplina</th>
                    <th className="px-4 py-3">Professor(a)</th>
                    <th className="px-4 py-3 text-center">Média Atual</th>
                    <th className="px-4 py-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item, idx) => (
                    <tr
                      key={`${item.aluno_id}-${item.disciplina_nome}-${idx}`}
                      className="hover:bg-amber-50/40 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                            #{item.numero_chamada}
                          </div>
                          <span className="font-bold text-slate-900">{item.nome_completo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                        {item.turma_nome}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                        {item.disciplina_nome}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                        {item.professor_nome}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-mono font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                          {item.media.toString().replace('.', ',')}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Atenção
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
