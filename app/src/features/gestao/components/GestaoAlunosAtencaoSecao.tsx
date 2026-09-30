import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button } from '@/components/ui';
import {
  AlertTriangle,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  BookOpen,
  Users,
  Copy,
  Check,
  Search,
  Maximize2,
  Minimize2,
  Filter,
} from 'lucide-react';
import { relatorioService, gestaoService, assinarMudancas } from '@/services';
import { AlunoEmAtencaoItem, Periodo } from '@/lib/types';
import { gerarCsv, baixarCsv } from '../utils/csv';
import {
  agruparAlunosEmAtencao,
  formatarPautaMateriaTexto,
  formatarPautaTurmaTexto,
  TurmaAtencaoAgrupada,
  MateriaAtencaoAgrupada,
} from '../utils/alunosAtencaoAgrupamento';

export const GestaoAlunosAtencaoSecao: React.FC = () => {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [itens, setItens] = useState<AlunoEmAtencaoItem[]>([]);
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de controle da hierarquia e filtros
  const [turmasAbertas, setTurmasAbertas] = useState<Set<string>>(new Set());
  const [materiasAbertas, setMateriasAbertas] = useState<Set<string>>(new Set());
  const [filtroTexto, setFiltroTexto] = useState('');
  const [apenasCasosCriticos, setApenasCasosCriticos] = useState(false);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

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
          setItens(dados);
          const agrupado = agruparAlunosEmAtencao(dados);
          setTurmasAbertas(new Set(agrupado.turmas.map((t) => t.turma_nome)));
          setMateriasAbertas(
            new Set(
              agrupado.turmas.flatMap((t) =>
                t.materias.map((m) => `${t.turma_nome}-${m.disciplina_nome}`)
              )
            )
          );
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

    const desassinar = assinarMudancas(() => {
      if (ativo) {
        carregarAlunos();
      }
    });

    return () => {
      ativo = false;
      desassinar();
    };
  }, [periodoSelecionadoId]);

  const periodoAtual = periodos.find((p) => p.id === periodoSelecionadoId);

  // Processa dados brutos para a estrutura hierárquica
  const resumoGeral = useMemo(() => {
    return agruparAlunosEmAtencao(itens);
  }, [itens]);

  // Filtra as turmas com base na busca e no toggle de casos críticos
  const turmasFiltradas = useMemo(() => {
    const texto = filtroTexto.trim().toLowerCase();

    return resumoGeral.turmas
      .map((turma) => {
        // Se filtro crítico estiver ativado, considerar apenas matérias/alunos críticos
        const materiasFiltradas = turma.materias
          .map((materia) => {
            const alunosFiltrados = materia.alunos.filter((aluno) => {
              if (apenasCasosCriticos && !aluno.tem_multiplas_materias) {
                return false;
              }
              if (!texto) return true;
              return (
                aluno.nome_completo.toLowerCase().includes(texto) ||
                materia.disciplina_nome.toLowerCase().includes(texto) ||
                turma.turma_nome.toLowerCase().includes(texto)
              );
            });

            return {
              ...materia,
              alunos: alunosFiltrados,
              total_alunos: alunosFiltrados.length,
            };
          })
          .filter((materia) => materia.alunos.length > 0);

        const alunosUnicosTurma = new Set(
          materiasFiltradas.flatMap((m) => m.alunos.map((a) => a.aluno_id))
        );

        return {
          ...turma,
          materias: materiasFiltradas,
          total_alunos_unicos: alunosUnicosTurma.size,
        };
      })
      .filter((turma) => turma.materias.length > 0);
  }, [resumoGeral, filtroTexto, apenasCasosCriticos]);

  // Controles de Accordion
  const toggleTurma = (turmaNome: string) => {
    setTurmasAbertas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(turmaNome)) {
        proximo.delete(turmaNome);
      } else {
        proximo.add(turmaNome);
      }
      return proximo;
    });
  };

  const toggleMateria = (turmaNome: string, disciplinaNome: string) => {
    const chave = `${turmaNome}-${disciplinaNome}`;
    setMateriasAbertas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(chave)) {
        proximo.delete(chave);
      } else {
        proximo.add(chave);
      }
      return proximo;
    });
  };

  const expandirTudo = () => {
    const todasTurmas = new Set(turmasFiltradas.map((t) => t.turma_nome));
    const todasMaterias = new Set(
      turmasFiltradas.flatMap((t) =>
        t.materias.map((m) => `${t.turma_nome}-${m.disciplina_nome}`)
      )
    );
    setTurmasAbertas(todasTurmas);
    setMateriasAbertas(todasMaterias);
  };

  const recolherTudo = () => {
    setTurmasAbertas(new Set());
    setMateriasAbertas(new Set());
  };

  // Copiar Pautas para Reunião Pedagógica
  const copiarPautaMateria = (turmaNome: string, materia: MateriaAtencaoAgrupada) => {
    const texto = formatarPautaMateriaTexto(turmaNome, materia, periodoAtual?.nome);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          setToastMensagem(`Pauta da matéria "${materia.disciplina_nome}" copiada com sucesso!`);
          setTimeout(() => setToastMensagem(null), 3500);
        })
        .catch(() => {
          setToastMensagem('Falha ao copiar pauta para a área de transferência.');
          setTimeout(() => setToastMensagem(null), 3500);
        });
    }
  };

  const copiarPautaTurma = (turma: TurmaAtencaoAgrupada) => {
    const texto = formatarPautaTurmaTexto(turma, periodoAtual?.nome);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          setToastMensagem(`Pauta geral da turma "${turma.turma_nome}" copiada com sucesso!`);
          setTimeout(() => setToastMensagem(null), 3500);
        })
        .catch(() => {
          setToastMensagem('Falha ao copiar pauta para a área de transferência.');
          setTimeout(() => setToastMensagem(null), 3500);
        });
    }
  };

  // Exportação CSV atualizada com detalhes de múltiplas matérias e acertos
  const handleBaixarCsv = () => {
    if (itens.length === 0) return;

    const colunas = [
      { chave: 'nome_completo', rotulo: 'Nome do Aluno' },
      { chave: 'numero_chamada', rotulo: 'Nº Chamada' },
      { chave: 'turma_nome', rotulo: 'Turma' },
      { chave: 'disciplina_nome', rotulo: 'Disciplina' },
      { chave: 'professor_nome', rotulo: 'Professor(a)' },
      { chave: 'acertos', rotulo: 'Questões Acertadas' },
      { chave: 'media', rotulo: 'Média (%)' },
      { chave: 'faixa', rotulo: 'Faixa' },
      { chave: 'tem_multipla', rotulo: 'Atenção em Múltiplas Matérias?' },
      { chave: 'outras_materias', rotulo: 'Outras Matérias em Atenção' },
    ];

    // Busca contexto de matérias agrupadas
    const linhas = itens.map((item) => {
      // Localiza o aluno na hierarquia
      const turma = resumoGeral.turmas.find((t) => t.turma_nome === item.turma_nome);
      const materia = turma?.materias.find((m) => m.disciplina_nome === item.disciplina_nome);
      const alunoDetalhe = materia?.alunos.find((a) => a.aluno_id === item.aluno_id);

      const acertosStr =
        item.total_acertos !== undefined && item.total_questoes !== undefined
          ? `${item.total_acertos}/${item.total_questoes}`
          : '-';

      const outras = alunoDetalhe?.outras_materias.map((o) => o.disciplina_nome).join(', ') || 'Nenhuma';

      return {
        nome_completo: item.nome_completo,
        numero_chamada: item.numero_chamada,
        turma_nome: item.turma_nome,
        disciplina_nome: item.disciplina_nome,
        professor_nome: item.professor_nome,
        acertos: acertosStr,
        media: item.media,
        faixa: item.faixa,
        tem_multipla: alunoDetalhe?.tem_multiplas_materias ? 'Sim' : 'Não',
        outras_materias: outras,
      };
    });

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
      {/* Toast de Notificação de Cópia */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in-50 slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMensagem}</span>
        </div>
      )}

      {/* Cabeçalho Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            Alunos em Atenção Pedagógica
          </h2>
          <p className="text-sm text-slate-500">
            Acompanhamento estruturado por turma e disciplina dos estudantes com aproveitamento inferior a 60%.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          {/* Seletor de Período / Bimestre */}
          <select
            value={periodoSelecionadoId}
            onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
            disabled={carregandoPeriodos || periodos.length === 0}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
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
            className="flex items-center gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-xs"
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

      {/* Cards de Resumo Pedagógico (KPIs) */}
      {!carregandoDados && itens.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Alunos em Atenção
              </span>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {resumoGeral.total_alunos_unicos}
              </span>
              <span className="text-xs text-slate-500 font-medium">estudantes únicos</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Turmas com Casos
              </span>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {resumoGeral.total_turmas_afetadas}
              </span>
              <span className="text-xs text-slate-500 font-medium">turmas afetadas</span>
            </div>
          </div>

          <div
            className={`border rounded-xl p-4 shadow-xs transition-colors cursor-pointer ${
              apenasCasosCriticos
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
                : 'bg-white border-slate-200 hover:border-rose-200'
            }`}
            onClick={() => setApenasCasosCriticos((prev) => !prev)}
            title="Clique para filtrar apenas casos críticos com atenção em múltiplas matérias"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Múltiplas Matérias
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  apenasCasosCriticos
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {apenasCasosCriticos ? 'Filtro Ativo' : 'Clique p/ Filtrar'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-700">
                {resumoGeral.total_alunos_multipla_atencao}
              </span>
              <span className="text-xs text-rose-600 font-medium">
                alunos com atenção em 2+ matérias
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Ferramentas: Busca, Filtros e Expandir/Recolher */}
      {!carregandoDados && itens.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por aluno, turma ou matéria..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {filtroTexto && (
              <button
                onClick={() => setFiltroTexto('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setApenasCasosCriticos((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                apenasCasosCriticos
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apenas Casos Críticos</span>
            </button>

            <button
              onClick={expandirTudo}
              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Expandir todas as turmas e matérias"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={recolherTudo}
              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Recolher todas as turmas"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
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
      ) : turmasFiltradas.length === 0 ? (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-xl text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700">Nenhum aluno encontrado para os filtros atuais.</p>
          <p className="text-xs text-slate-400 mt-1">
            Tente limpar o campo de busca ou desativar o filtro de casos críticos.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {turmasFiltradas.map((turma) => {
            const turmaAberta = turmasAbertas.has(turma.turma_nome);

            return (
              <div
                key={turma.turma_nome}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Linha da Turma (Nível 1) */}
                <div
                  onClick={() => toggleTurma(turma.turma_nome)}
                  className={`p-4 sm:px-5 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                    turmaAberta ? 'bg-indigo-50/30 border-b border-slate-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg text-slate-400 transition-transform duration-200 ${
                        turmaAberta ? 'rotate-90 text-indigo-600 bg-indigo-100' : 'bg-slate-100'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                      <GraduationCap className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                          {turma.turma_nome}
                        </h3>

                        {/* Número de alunos em atenção ao lado da turma */}
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {turma.total_alunos_unicos}{' '}
                          {turma.total_alunos_unicos === 1 ? 'aluno em atenção' : 'alunos em atenção'}
                        </span>

                        {turma.turma_total_alunos > 0 && turma.porcentagem_alunos_atencao !== null && (
                          <span className="text-xs text-slate-500 font-medium hidden md:inline">
                            ({turma.total_alunos_unicos} de {turma.turma_total_alunos} •{' '}
                            {turma.porcentagem_alunos_atencao}% da sala)
                          </span>
                        )}

                        {/* Alerta de Múltiplas Matérias na Turma */}
                        {turma.total_alunos_multipla_atencao > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            {turma.total_alunos_multipla_atencao}{' '}
                            {turma.total_alunos_multipla_atencao === 1
                              ? 'com atenção múltipla'
                              : 'com atenção múltipla'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        {turma.materias.length}{' '}
                        {turma.materias.length === 1 ? 'matéria com casos' : 'matérias com casos'}
                      </p>
                    </div>
                  </div>

                  {/* Ação da Turma: Copiar Pauta Geral */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copiarPautaTurma(turma);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
                      title="Copiar pauta geral da turma para reunião de conselho"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copiar Pauta da Turma</span>
                    </button>
                  </div>
                </div>

                {/* Subitens da Turma: Matérias (Nível 2) */}
                {turmaAberta && (
                  <div className="p-3 sm:p-4 bg-slate-50/50 space-y-3">
                    {turma.materias.map((materia) => {
                      const keyMateria = `${turma.turma_nome}-${materia.disciplina_nome}`;
                      const materiaAberta = materiasAbertas.has(keyMateria);

                      return (
                        <div
                          key={materia.disciplina_nome}
                          className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
                        >
                          {/* Linha da Matéria (Nível 2) */}
                          <div
                            onClick={() => toggleMateria(turma.turma_nome, materia.disciplina_nome)}
                            className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                              materiaAberta
                                ? 'bg-indigo-50/40 border-b border-slate-200'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1 rounded-md text-slate-400 transition-transform duration-200 ${
                                  materiaAberta
                                    ? 'rotate-90 text-indigo-600 bg-indigo-100'
                                    : 'bg-slate-100'
                                }`}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>

                              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                <BookOpen className="w-4 h-4" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                                    {materia.disciplina_nome}
                                  </h4>

                                  {/* Contador de alunos por matéria */}
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    {materia.total_alunos}{' '}
                                    {materia.total_alunos === 1 ? 'aluno' : 'alunos'}
                                  </span>

                                  {materia.total_alunos_multipla_atencao > 0 && (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                                      {materia.total_alunos_multipla_atencao}{' '}
                                      {materia.total_alunos_multipla_atencao === 1
                                        ? 'caso crítico'
                                        : 'casos críticos'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">
                                  Prof(a). {materia.professor_nome}
                                </p>
                              </div>
                            </div>

                            {/* Botão Copiar Pauta da Matéria */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copiarPautaMateria(turma.turma_nome, materia);
                                }}
                                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
                                title="Copiar pauta desta matéria com a quantidade de acertos dos alunos"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Copiar Pauta</span>
                              </button>
                            </div>
                          </div>

                          {/* Subitens da Matéria: Lista de Alunos (Nível 3) */}
                          {materiaAberta && (
                            <div className="divide-y divide-slate-100 bg-white">
                              {materia.alunos.map((aluno) => {
                                const acertosTexto =
                                  aluno.total_questoes_nesta_disciplina !== undefined &&
                                  aluno.total_acertos_nesta_disciplina !== undefined
                                    ? `${aluno.total_acertos_nesta_disciplina}/${aluno.total_questoes_nesta_disciplina} acertos`
                                    : null;

                                const ehCriticoSevero = aluno.media_nesta_disciplina < 50;

                                return (
                                  <div
                                    key={aluno.aluno_id}
                                    className="p-3 sm:px-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                  >
                                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                                        #{String(aluno.numero_chamada).padStart(2, '0')}
                                      </div>

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-slate-900 text-sm">
                                            {aluno.nome_completo}
                                          </span>

                                          {/* Badge de Alerta de Múltiplas Matérias na Turma */}
                                          {aluno.tem_multiplas_materias && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                              <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                                              Atenção em {aluno.total_materias_em_atencao} matérias
                                            </span>
                                          )}
                                        </div>

                                        {/* Informação das outras matérias com atenção */}
                                        {aluno.tem_multiplas_materias && (
                                          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-xs text-rose-700">
                                            <span className="font-medium text-slate-500">
                                              Também necessita apoio em:
                                            </span>
                                            {aluno.outras_materias.map((outra) => (
                                              <span
                                                key={outra.disciplina_nome}
                                                className="px-1.5 py-0.5 rounded bg-rose-100/70 border border-rose-200 text-[11px] font-semibold"
                                              >
                                                {outra.disciplina_nome} ({outra.media.toFixed(1).replace('.', ',')}%)
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Média e Quantidade de Acertos à Direita */}
                                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                      {acertosTexto && (
                                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                          {acertosTexto}
                                        </span>
                                      )}

                                      <span
                                        className={`font-mono font-black px-2.5 py-1 rounded text-xs border ${
                                          ehCriticoSevero
                                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                                            : 'text-amber-800 bg-amber-50 border-amber-200'
                                        }`}
                                        title={
                                          ehCriticoSevero
                                            ? 'Atenção Severa (<50%)'
                                            : 'Atenção Moderada (50% a 59%)'
                                        }
                                      >
                                        {aluno.media_nesta_disciplina.toFixed(1).replace('.', ',')}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
