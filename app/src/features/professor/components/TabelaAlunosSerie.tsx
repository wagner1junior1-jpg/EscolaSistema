import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  FileEdit,
  Eye,
  Users,
  Award,
} from 'lucide-react';
import { AlunoComDesempenhoResumo, FaixaDesempenho, DesempenhoAlunoMateriaItem } from '@/lib/types';
import { Button } from '@/components/ui';

export interface TabelaAlunosSerieProps {
  alunos: AlunoComDesempenhoResumo[];
  carregando: boolean;
  onAbrirObservacao: (aluno: AlunoComDesempenhoResumo) => void;
  onVisualizarAluno: (alunoId: string) => void;
  serieNome: string;
}

type TipoOrdenacao = 'chamada' | 'nome' | 'turma' | 'media_geral' | string;

export const TabelaAlunosSerie: React.FC<TabelaAlunosSerieProps> = ({
  alunos,
  carregando,
  onAbrirObservacao,
  onVisualizarAluno,
  serieNome,
}) => {
  const [colunaOrdenacao, setColunaOrdenacao] = useState<TipoOrdenacao>('chamada');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('asc');

  // Identifica dinamicamente todas as disciplinas presentes nos alunos desta série
  const disciplinas = useMemo(() => {
    const mapa = new Map<string, string>();
    alunos.forEach((item) => {
      item.materias.forEach((m: DesempenhoAlunoMateriaItem) => {
        if (!mapa.has(m.disciplina_id)) {
          mapa.set(m.disciplina_id, m.disciplina_nome);
        }
      });
    });
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [alunos]);

  // Função para alternar ordenação
  const handleAlternarOrdenacao = (coluna: TipoOrdenacao) => {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setColunaOrdenacao(coluna);
      setDirecaoOrdenacao('asc');
    }
  };

  // Alunos ordenados conforme a coluna selecionada
  const alunosOrdenados = useMemo(() => {
    const lista = [...alunos];

    lista.sort((a, b) => {
      let valorA: string | number = 0;
      let valorB: string | number = 0;

      if (colunaOrdenacao === 'chamada') {
        valorA = a.aluno.numero_chamada;
        valorB = b.aluno.numero_chamada;
      } else if (colunaOrdenacao === 'nome') {
        valorA = a.aluno.nome_completo.toLowerCase();
        valorB = b.aluno.nome_completo.toLowerCase();
      } else if (colunaOrdenacao === 'turma') {
        valorA = a.turma_nome.toLowerCase();
        valorB = b.turma_nome.toLowerCase();
      } else if (colunaOrdenacao === 'media_geral') {
        valorA = a.media_geral !== null ? a.media_geral : -1;
        valorB = b.media_geral !== null ? b.media_geral : -1;
      } else {
        // Ordenação por disciplina específica
        const matA = a.materias.find((m: DesempenhoAlunoMateriaItem) => m.disciplina_id === colunaOrdenacao);
        const matB = b.materias.find((m: DesempenhoAlunoMateriaItem) => m.disciplina_id === colunaOrdenacao);
        valorA = matA?.media !== null && matA?.media !== undefined ? matA.media : -1;
        valorB = matB?.media !== null && matB?.media !== undefined ? matB.media : -1;
      }

      if (valorA < valorB) return direcaoOrdenacao === 'asc' ? -1 : 1;
      if (valorA > valorB) return direcaoOrdenacao === 'asc' ? 1 : -1;
      return 0;
    });

    return lista;
  }, [alunos, colunaOrdenacao, direcaoOrdenacao]);

  // Cálculo das médias gerais da série/turma para exibição no rodapé da tabela
  const mediasRodape = useMemo(() => {
    let somaGeral = 0;
    let qtdGeral = 0;

    alunos.forEach((a) => {
      if (a.media_geral !== null) {
        somaGeral += a.media_geral;
        qtdGeral++;
      }
    });

    const mediasPorDisciplina: Record<string, number | null> = {};

    disciplinas.forEach((d) => {
      let somaDisc = 0;
      let qtdDisc = 0;
      alunos.forEach((a) => {
        const mat = a.materias.find((m: DesempenhoAlunoMateriaItem) => m.disciplina_id === d.id);
        if (mat && mat.media !== null) {
          somaDisc += mat.media;
          qtdDisc++;
        }
      });
      mediasPorDisciplina[d.id] = qtdDisc > 0 ? Math.round(somaDisc / qtdDisc) : null;
    });

    return {
      mediaGeralSerie: qtdGeral > 0 ? Math.round(somaGeral / qtdGeral) : null,
      disciplinas: mediasPorDisciplina,
    };
  }, [alunos, disciplinas]);

  // Estilização das faixas de rendimento
  const obterEstiloFaixa = (faixa: FaixaDesempenho, media: number | null) => {
    if (media === null) {
      return 'bg-slate-100 text-slate-500 border-slate-200';
    }
    switch (faixa) {
      case 'Ótimo':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Bom':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Atenção':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const renderIconeOrdenacao = (coluna: TipoOrdenacao) => {
    if (colunaOrdenacao !== coluna) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />;
    }
    return direcaoOrdenacao === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
    );
  };

  if (carregando) {
    return null; // O carregamento já é tratado pelo estado pai
  }

  if (alunos.length === 0) {
    return null; // Mensagem de vazio tratada no componente pai
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Topo Informativo da Tabela */}
      <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Users className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold">
            {alunos.length} {alunos.length === 1 ? 'estudante listado' : 'estudantes listados'} no{' '}
            <strong className="text-slate-800">{serieNome}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Ótimo (≥80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            Bom (60-79%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Atenção (&lt;60%)
          </span>
        </div>
      </div>

      {/* Tabela com Rolagem Horizontal Suave */}
      <div className="overflow-x-auto relative">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-heading font-bold text-slate-600">
              {/* Coluna 1 Fixa: Nº de Chamada */}
              <th
                onClick={() => handleAlternarOrdenacao('chamada')}
                className="py-3 px-3.5 text-center sticky left-0 bg-slate-50 z-30 shadow-xs cursor-pointer group hover:bg-slate-100 transition-colors w-[65px] min-w-[65px]"
                title="Ordenar por número de chamada"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Nº</span>
                  {renderIconeOrdenacao('chamada')}
                </div>
              </th>

              {/* Coluna 2 Fixa: Aluno */}
              <th
                onClick={() => handleAlternarOrdenacao('nome')}
                className="py-3 px-4 sticky left-[65px] bg-slate-50 z-30 shadow-xs cursor-pointer group hover:bg-slate-100 transition-colors w-[220px] min-w-[220px] max-w-[260px] border-r border-slate-200"
                title="Ordenar alfabeticamente por nome"
              >
                <div className="flex items-center gap-1.5">
                  <span>Aluno</span>
                  {renderIconeOrdenacao('nome')}
                </div>
              </th>

              {/* Coluna 3: Turma */}
              <th
                onClick={() => handleAlternarOrdenacao('turma')}
                className="py-3 px-3 text-center cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap w-[110px] min-w-[110px]"
                title="Ordenar por turma"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Turma</span>
                  {renderIconeOrdenacao('turma')}
                </div>
              </th>

              {/* Coluna 4: Média Geral */}
              <th
                onClick={() => handleAlternarOrdenacao('media_geral')}
                className="py-3 px-3 text-center cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap w-[115px] min-w-[115px]"
                title="Ordenar por média geral de aproveitamento"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Média Geral</span>
                  {renderIconeOrdenacao('media_geral')}
                </div>
              </th>

              {/* Colunas Dinâmicas: Matérias da Série */}
              {disciplinas.map((disc) => (
                <th
                  key={disc.id}
                  onClick={() => handleAlternarOrdenacao(disc.id)}
                  className="py-3 px-3 text-center cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap min-w-[130px]"
                  title={`Ordenar por aproveitamento em ${disc.nome}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="truncate max-w-[120px]">{disc.nome}</span>
                    {renderIconeOrdenacao(disc.id)}
                  </div>
                </th>
              ))}

              {/* Coluna: Observações Pedagógicas */}
              <th className="py-3 px-3 text-center whitespace-nowrap min-w-[140px]">
                <span>Observação</span>
              </th>

              {/* Coluna: Ações */}
              <th className="py-3 px-4 text-center whitespace-nowrap w-[110px] min-w-[110px]">
                <span>Ações</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {alunosOrdenados.map((item) => {
              const temObservacao = item.total_observacoes > 0 && Boolean(item.ultima_observacao);

              return (
                <tr
                  key={item.aluno.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Célula Fixa: Nº de Chamada */}
                  <td className="py-3 px-3.5 text-center sticky left-0 bg-white group-hover:bg-slate-50 z-20 shadow-xs font-mono font-bold text-xs text-slate-500 w-[65px] min-w-[65px]">
                    #{item.aluno.numero_chamada}
                  </td>

                  {/* Célula Fixa: Nome do Aluno */}
                  <td className="py-3 px-4 sticky left-[65px] bg-white group-hover:bg-slate-50 z-20 shadow-xs w-[220px] min-w-[220px] max-w-[260px] border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => onVisualizarAluno(item.aluno.id)}
                      className="text-left font-bold text-slate-900 group-hover:text-indigo-600 hover:underline cursor-pointer block truncate w-full"
                      title={`Visualizar ficha de ${item.aluno.nome_completo}`}
                    >
                      {item.aluno.nome_completo}
                    </button>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {item.turma_nome}
                    </span>
                  </td>

                  {/* Célula: Turma */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {item.turma_nome}
                    </span>
                  </td>

                  {/* Célula: Média Geral */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span
                      className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 ${obterEstiloFaixa(
                        item.faixa_geral,
                        item.media_geral
                      )}`}
                      title={`Faixa: ${item.faixa_geral}`}
                    >
                      <Award className="w-3 h-3 shrink-0" />
                      <span>{item.media_geral !== null ? `${item.media_geral}%` : '—'}</span>
                    </span>
                  </td>

                  {/* Células das Matérias */}
                  {disciplinas.map((disc) => {
                    const mat = item.materias.find((m: DesempenhoAlunoMateriaItem) => m.disciplina_id === disc.id);
                    const temNota = mat && mat.media !== null;

                    return (
                      <td
                        key={disc.id}
                        className="py-3 px-3 text-center whitespace-nowrap"
                      >
                        {mat ? (
                          <span
                            className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg border inline-block ${obterEstiloFaixa(
                              mat.faixa,
                              mat.media
                            )}`}
                            title={
                              temNota
                                ? `${mat.soma_acertos} acertos em ${mat.soma_questoes} questões (${mat.atividades_concluidas}/${mat.total_atividades} ativ.)`
                                : 'Nenhuma atividade avaliada nesta disciplina'
                            }
                          >
                            {temNota ? `${mat.media}%` : '—'}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Célula: Observação Pedagógica */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {temObservacao && item.ultima_observacao ? (
                      <button
                        type="button"
                        onClick={() => onAbrirObservacao(item)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer group/obs max-w-[150px]"
                        title={`"${item.ultima_observacao.texto}" — Por ${item.ultima_observacao.professor_nome}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="truncate">
                          {item.total_observacoes > 1
                            ? `${item.total_observacoes} obs.`
                            : '1 obs.'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAbrirObservacao(item)}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-600 text-xs font-medium px-2 py-1 rounded-md hover:bg-indigo-50/70 transition-colors cursor-pointer"
                        title="Registrar observação pedagógica deste aluno"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>Anotar</span>
                      </button>
                    )}
                  </td>

                  {/* Célula: Ações */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Eye className="w-3.5 h-3.5 text-indigo-600" />}
                      onClick={() => onVisualizarAluno(item.aluno.id)}
                      className="text-xs font-semibold hover:bg-indigo-50 text-indigo-700"
                      title={`Abrir ficha pedagógica completa de ${item.aluno.nome_completo}`}
                    >
                      Ficha
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Rodapé Consolidado da Tabela */}
          <tfoot>
            <tr className="bg-slate-50/90 border-t-2 border-slate-200 text-xs font-bold text-slate-700">
              <td
                colSpan={3}
                className="py-3 px-4 sticky left-0 bg-slate-50 z-20 shadow-xs border-r border-slate-200 text-right uppercase tracking-wider text-[11px] text-slate-500"
              >
                Média Geral da Série ({serieNome}):
              </td>

              <td className="py-3 px-3 text-center whitespace-nowrap">
                <span className="font-mono font-black text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                  {mediasRodape.mediaGeralSerie !== null
                    ? `${mediasRodape.mediaGeralSerie}%`
                    : '—'}
                </span>
              </td>

              {disciplinas.map((disc) => {
                const medDisc = mediasRodape.disciplinas[disc.id];
                return (
                  <td key={disc.id} className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                      {medDisc !== null ? `${medDisc}%` : '—'}
                    </span>
                  </td>
                );
              })}

              <td colSpan={2} className="py-3 px-3 text-center text-slate-400 text-[11px]">
                {alunos.length} {alunos.length === 1 ? 'aluno avaliado' : 'alunos avaliados'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TabelaAlunosSerie;
