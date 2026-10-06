import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, Button, Input, Select, useToast } from '@/components/ui';
import {
  professorService,
  bancoService,
  iaService,
  gestaoService,
  OfertaDetalhada,
  AlunoComDesempenhoResumo,
  Periodo,
  CombinacaoProfessor,
  Assunto,
  assinarMudancas,
} from '@/services';
import { IA_SEM_LIMITE } from '@/services/mock/ia.mock';
import { pluralizar } from '@/lib/formatar';
import {
  GraduationCap,
  Users,
  Key,
  BookOpen,
  ArrowRight,
  Loader2,
  FileEdit,
  Send,
  Archive,
  AlertCircle,
  Database,
  Search,
  MessageSquare,
  Eye,
  Plus,
  Sparkles,
  Clock,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CheckCircle2,
  Table,
  LayoutGrid,
} from 'lucide-react';
import { ModalObservacaoAluno } from '../components/ModalObservacaoAluno';
import { ModalNovaAtividadeRapida } from '../components/ModalNovaAtividadeRapida';
import { ModalGeradorIA } from '../components/ModalGeradorIA';
import { TabelaAlunosSerie } from '../components/TabelaAlunosSerie';

interface OfertaComContagem extends OfertaDetalhada {
  totalRascunhos: number;
  totalPublicadas: number;
  totalEncerradas: number;
  totalGeral: number;
  totalPendentesCorrecao: number;
  primeiraAtividadeComPendenteId?: string | null;
}

interface AlunoEmAtencaoDashboard {
  aluno_id: string;
  nome_completo: string;
  turma_nome: string;
  turma_serie?: string;
  disciplina_nome: string;
  oferta_id: string;
  media: number;
}

interface AtividadePrazoProximo {
  id: string;
  titulo: string;
  prazo: string;
  turma_nome: string;
  disciplina_nome: string;
  oferta_id: string;
  modo: 'prova' | 'exercicio';
  diasRestantes: number;
  serie?: string;
}

export const ProfessorDashboardPage: React.FC = () => {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [ofertas, setOfertas] = useState<OfertaComContagem[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoAtivo, setPeriodoAtivo] = useState<Periodo | null>(null);
  const [serieSelecionada, setSerieSelecionada] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Só considera "sem turma" depois de carregar, para não travar os botões durante o carregamento
  const semTurmas = !carregando && !erro && ofertas.length === 0;

  // Métricas e Painéis Adicionais
  const [cotaIA, setCotaIA] = useState<{ uso_mes: number; limite_mes: number } | null>(null);
  const [alunosEmAtencao, setAlunosEmAtencao] = useState<AlunoEmAtencaoDashboard[]>([]);
  const [atividadesPrazoProximo, setAtividadesPrazoProximo] = useState<AtividadePrazoProximo[]>([]);
  const [totalAlunosGeral, setTotalAlunosGeral] = useState<number>(0);
  const [radarExpandido, setRadarExpandido] = useState<boolean>(false);

  // Modais
  const [modalNovaAtividadeAberto, setModalNovaAtividadeAberto] = useState(false);
  const [modalGeradorIAAberto, setModalGeradorIAAberto] = useState(false);
  const [combinacoes, setCombinacoes] = useState<CombinacaoProfessor[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);

  // Alternador da visão para a série escolhida: Atividades vs Alunos
  const [abaVisao, setAbaVisao] = useState<'atividades' | 'alunos'>('atividades');

  // Estado dos alunos da série selecionada
  const [alunosSerie, setAlunosSerie] = useState<AlunoComDesempenhoResumo[]>([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('todos');
  const [filtroFaixa, setFiltroFaixa] = useState('todos');

  // Modal de Observação do Aluno
  const [alunoObservacao, setAlunoObservacao] = useState<AlunoComDesempenhoResumo | null>(null);
  const [modoVisualizacaoAlunos, setModoVisualizacaoAlunos] = useState<'tabela' | 'cards'>('tabela');

  // Totais consolidados
  const totalRascunhosGeral = useMemo(
    () => ofertas.reduce((acc, o) => acc + o.totalRascunhos, 0),
    [ofertas]
  );
  const totalPublicadasGeral = useMemo(
    () => ofertas.reduce((acc, o) => acc + o.totalPublicadas, 0),
    [ofertas]
  );
  const totalEncerradasGeral = useMemo(
    () => ofertas.reduce((acc, o) => acc + o.totalEncerradas, 0),
    [ofertas]
  );
  const totalGeralPendentesCorrecao = useMemo(
    () => ofertas.reduce((acc, o) => acc + o.totalPendentesCorrecao, 0),
    [ofertas]
  );
  const primeiraAtividadePendenteId = useMemo(() => {
    const ofertaComPendente = ofertas.find((o) => o.primeiraAtividadeComPendenteId);
    return ofertaComPendente?.primeiraAtividadeComPendenteId || null;
  }, [ofertas]);

  // Extrai todas as séries únicas das ofertas atribuídas ao professor
  const seriesDisponiveis = useMemo(() => {
    const setSeries = new Set<string>();
    ofertas.forEach((o) => {
      if (o.turma_serie) {
        setSeries.add(o.turma_serie);
      } else {
        setSeries.add('Outras turmas');
      }
    });
    return Array.from(setSeries).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [ofertas]);

  // Mantém a primeira série selecionada por padrão ou ajusta se a lista mudar
  useEffect(() => {
    if (seriesDisponiveis.length > 0) {
      if (!serieSelecionada || !seriesDisponiveis.includes(serieSelecionada)) {
        setSerieSelecionada(seriesDisponiveis[0]);
      }
    } else {
      setSerieSelecionada(null);
    }
  }, [seriesDisponiveis, serieSelecionada]);

  // Filtra as ofertas de acordo com a série ativa
  const ofertasFiltradas = useMemo(() => {
    if (!serieSelecionada) return ofertas;
    return ofertas.filter((o) => (o.turma_serie || 'Outras turmas') === serieSelecionada);
  }, [ofertas, serieSelecionada]);

  // Turmas únicas na série selecionada para filtro de turma no modo Alunos
  const turmasNaSerie = useMemo(() => {
    const mapa = new Map<string, string>();
    ofertasFiltradas.forEach((o) => {
      mapa.set(o.turma_id, o.turma_nome);
    });
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [ofertasFiltradas]);

  // Atividades com prazo próximo filtradas pela série ativa
  const prazosExibidos = useMemo(() => {
    if (!serieSelecionada) return atividadesPrazoProximo;
    return atividadesPrazoProximo.filter((a) => !a.serie || a.serie === serieSelecionada);
  }, [atividadesPrazoProximo, serieSelecionada]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // 1. Carrega ofertas básicas do professor
      const listaOfertas = await professorService.minhasOfertas();

      // 2. Carrega períodos para identificar o período ativo
      let listaPeriodos: Periodo[] = [];
      let pAtivo: Periodo | null = null;
      try {
        listaPeriodos = await gestaoService.listarPeriodos();
        pAtivo = listaPeriodos.find((p) => p.ativo) || listaPeriodos[0] || null;
        setPeriodos(listaPeriodos);
        setPeriodoAtivo(pAtivo);
      } catch {
        // Silencia se não for possível carregar períodos
      }

      // 3. Consulta cota de IA
      if (!IA_SEM_LIMITE) {
        try {
          const cota = await iaService.consultarCota();
          setCotaIA(cota);
        } catch {
          setCotaIA(null);
        }
      }

      // 4. Carrega combinações de disciplina/série para o gerador de IA
      try {
        const combs = await bancoService.listarCombinacoesDoProfessor();
        setCombinacoes(combs);
      } catch {
        setCombinacoes([]);
      }

      const alunosAtencaoAcumulados: AlunoEmAtencaoDashboard[] = [];
      const prazosProximosAcumulados: AtividadePrazoProximo[] = [];
      const alunosIdsSet = new Set<string>();

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // 5. Para cada oferta, busca atividades, contagens, pendências e alunos em atenção
      const ofertasComContagens: OfertaComContagem[] = await Promise.all(
        listaOfertas.map(async (oferta) => {
          try {
            const atividades = await professorService.listarAtividades(oferta.id);
            const totalRascunhos = atividades.filter((a) => a.status === 'rascunho').length;
            const totalPublicadas = atividades.filter((a) => a.status === 'publicada').length;
            const totalEncerradas = atividades.filter((a) => a.status === 'encerrada').length;

            let totalPendentesCorrecao = 0;
            let primeiraAtividadeComPendenteId: string | null = null;

            const ativsComRespostas = atividades.filter(
              (a) => a.status === 'publicada' || a.status === 'encerrada'
            );

            for (const ativ of ativsComRespostas) {
              try {
                const pends = await professorService.listarCorrecoesPendentes(ativ.id);
                if (pends.length > 0) {
                  totalPendentesCorrecao += pends.length;
                  if (!primeiraAtividadeComPendenteId) {
                    primeiraAtividadeComPendenteId = ativ.id;
                  }
                }
              } catch {
                // Silencia se não houver pendentes
              }

              // Checa prazos de atividades publicadas
              if (ativ.status === 'publicada' && ativ.prazo) {
                const partes = ativ.prazo.split('-');
                if (partes.length === 3) {
                  const dataPrazo = new Date(
                    Number(partes[0]),
                    Number(partes[1]) - 1,
                    Number(partes[2])
                  );
                  dataPrazo.setHours(0, 0, 0, 0);
                  const diffDias = Math.ceil(
                    (dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  if (diffDias >= 0 && diffDias <= 4) {
                    prazosProximosAcumulados.push({
                      id: ativ.id,
                      titulo: ativ.titulo,
                      prazo: ativ.prazo,
                      turma_nome: oferta.turma_nome,
                      disciplina_nome: oferta.disciplina_nome,
                      oferta_id: oferta.id,
                      modo: ativ.modo,
                      diasRestantes: diffDias,
                      serie: oferta.turma_serie,
                    });
                  }
                }
              }
            }

            // 6. Alunos em atenção pelo relatório de desempenho do período ativo
            if (pAtivo) {
              try {
                const relatorio = await professorService.desempenhoOferta(oferta.id, pAtivo.id);
                relatorio.alunos.forEach((al) => {
                  alunosIdsSet.add(al.aluno_id);
                  if (al.faixa === 'Atenção' && al.media !== null) {
                    alunosAtencaoAcumulados.push({
                      aluno_id: al.aluno_id,
                      nome_completo: al.nome_completo,
                      turma_nome: oferta.turma_nome,
                      turma_serie: oferta.turma_serie,
                      disciplina_nome: oferta.disciplina_nome,
                      oferta_id: oferta.id,
                      media: al.media,
                    });
                  }
                });
              } catch {
                // Silencia caso a oferta não tenha avaliações no período
              }
            }

            return {
              ...oferta,
              totalRascunhos,
              totalPublicadas,
              totalEncerradas,
              totalGeral: atividades.length,
              totalPendentesCorrecao,
              primeiraAtividadeComPendenteId,
            };
          } catch {
            return {
              ...oferta,
              totalRascunhos: 0,
              totalPublicadas: 0,
              totalEncerradas: 0,
              totalGeral: 0,
              totalPendentesCorrecao: 0,
              primeiraAtividadeComPendenteId: null,
            };
          }
        })
      );

      setOfertas(ofertasComContagens);
      setAlunosEmAtencao(alunosAtencaoAcumulados.sort((a, b) => a.media - b.media));
      setAtividadesPrazoProximo(
        prazosProximosAcumulados.sort((a, b) => a.diasRestantes - b.diasRestantes)
      );
      setTotalAlunosGeral(alunosIdsSet.size);
    } catch (err: unknown) {
      setErro(
        err instanceof Error ? err.message : 'Falha ao carregar turmas do professor.'
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carrega alunos quando a série selecionada muda ou ao alternar para a aba Alunos
  const carregarAlunosDaSerie = useCallback(async () => {
    if (!serieSelecionada) return;
    setCarregandoAlunos(true);
    try {
      const lista = await professorService.listarAlunosPorSerie(serieSelecionada);
      setAlunosSerie(lista);
    } catch (err) {
      console.error('Erro ao listar alunos da série:', err);
    } finally {
      setCarregandoAlunos(false);
    }
  }, [serieSelecionada]);

  useEffect(() => {
    carregarDados();

    const desassinar = assinarMudancas(() => {
      carregarDados();
    });

    return () => {
      desassinar();
    };
  }, [carregarDados]);

  useEffect(() => {
    if (abaVisao === 'alunos' && serieSelecionada) {
      carregarAlunosDaSerie();
    }
  }, [abaVisao, serieSelecionada, carregarAlunosDaSerie]);

  // Alunos filtrados por busca, turma e faixa na Visão 2
  const alunosFiltrados = useMemo(() => {
    return alunosSerie.filter((aluno) => {
      if (filtroTurma !== 'todos' && aluno.turma_id !== filtroTurma) {
        return false;
      }
      if (filtroFaixa !== 'todos' && aluno.faixa_geral !== filtroFaixa) {
        return false;
      }
      if (buscaAluno.trim()) {
        const termo = buscaAluno.toLowerCase();
        const matchNome = aluno.aluno.nome_completo.toLowerCase().includes(termo);
        const matchChamada = String(aluno.aluno.numero_chamada).includes(termo);
        if (!matchNome && !matchChamada) return false;
      }
      return true;
    });
  }, [alunosSerie, filtroTurma, filtroFaixa, buscaAluno]);

  // Handler para abrir Gerador IA diretamente no dashboard
  const handleAbrirGeradorIA = async () => {
    try {
      const combs = await bancoService.listarCombinacoesDoProfessor();
      setCombinacoes(combs);
      if (combs.length > 0) {
        const listaAssuntos = await bancoService.listarAssuntos(combs[0].disciplina_id);
        setAssuntos(listaAssuntos);
      }
      setModalGeradorIAAberto(true);
    } catch (err) {
      console.error('Erro ao preparar gerador IA:', err);
      setModalGeradorIAAberto(true);
    }
  };

  const handleCriarAssuntoIA = async (nome: string): Promise<Assunto> => {
    const discId = combinacoes[0]?.disciplina_id || ofertas[0]?.disciplina_id;
    if (!discId) throw new Error('Nenhuma disciplina selecionada.');
    const novo = await bancoService.criarAssunto(discId, nome);
    setAssuntos((prev) => [...prev, novo]);
    return novo;
  };

  const handleSucessoGeracaoIA = (total: number) => {
    setModalGeradorIAAberto(false);
    toast.success(`${total} nova(s) questão(ões) gerada(s) com sucesso para o seu Banco!`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* =========================================================================
            1. CABEÇALHO DE BOAS-VINDAS E BARRA DE AÇÕES RÁPIDAS
           ========================================================================= */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
                Minhas Turmas
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-sans">
                Olá, {usuario?.nome || 'Professor(a)'}! Crie novas atividades, acompanhe o
                diagnóstico da turma e gerencie suas avaliações.
              </p>
            </div>
          </div>

          {/* Barra de Ações Rápidas no Topo */}
          <div className="shrink-0 flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5 text-white" />}
              onClick={() => setModalNovaAtividadeAberto(true)}
              disabled={semTurmas}
              title={semTurmas ? 'Você ainda não tem turma atribuída' : undefined}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs shadow-indigo-200"
              data-testid="btn-nova-atividade-rapida"
            >
              Nova Atividade
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-purple-600" />}
              onClick={handleAbrirGeradorIA}
              disabled={semTurmas}
              title={semTurmas ? 'Você ainda não tem turma atribuída' : undefined}
              className="border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 text-purple-900 font-bold"
              data-testid="btn-gerar-ia-dashboard"
            >
              Gerar com IA
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Database className="w-3.5 h-3.5 text-indigo-600" />}
              onClick={() => navigate('/professor/banco')}
              className="border-slate-300 hover:border-indigo-400 font-semibold text-slate-700"
            >
              Banco de questões
            </Button>
          </div>
        </div>

        {/* =========================================================================
            2. FAIXA DE KPIS DOCENTES (4 Cards de Estatísticas Consolidadas)
           ========================================================================= */}
        {!carregando && !erro && ofertas.length > 0 && (
          <div
            className={`grid grid-cols-2 ${
              IA_SEM_LIMITE ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
            } gap-2.5 sm:gap-3.5`}
          >
            {/* KPI 1: Turmas e Alunos */}
            <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-xs flex items-center gap-2 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block sm:truncate">
                  Regência
                </span>
                <span className="font-heading font-black text-sm sm:text-lg text-slate-900 leading-tight block truncate">
                  {ofertas.length} {ofertas.length === 1 ? 'Turma' : 'Turmas'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 sm:truncate block mt-0.5">
                  {totalAlunosGeral > 0
                    ? `${pluralizar(totalAlunosGeral, 'aluno', 'alunos')} acompanhados`
                    : `${seriesDisponiveis.length} séries vinculadas`}
                </span>
              </div>
            </div>

            {/* KPI 2: Atividades Publicadas */}
            <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-xs flex items-center gap-2 sm:gap-3.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block sm:truncate">
                  Atividades Ativas
                </span>
                <span className="font-heading font-black text-sm sm:text-lg text-emerald-900 leading-tight block truncate">
                  {totalPublicadasGeral} {totalPublicadasGeral === 1 ? 'Publicada' : 'Publicadas'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 sm:truncate block mt-0.5">
                  {pluralizar(totalRascunhosGeral, 'rascunho', 'rascunhos')} · {pluralizar(totalEncerradasGeral, 'encerrada', 'encerradas')}
                </span>
              </div>
            </div>

            {/* KPI 3: Correções Discursivas Pendentes (com Ação Direta) */}
            <div
              onClick={() => {
                if (primeiraAtividadePendenteId) {
                  navigate(
                    `/professor/atividade/${primeiraAtividadePendenteId}/resultados?aba=correcoes`
                  );
                }
              }}
              className={`bg-white border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-3 transition-all ${
                IA_SEM_LIMITE ? 'col-span-2 lg:col-span-1' : ''
              } ${
                totalGeralPendentesCorrecao > 0
                  ? 'border-purple-300 bg-purple-50/40 hover:bg-purple-50/70 hover:border-purple-400 cursor-pointer group'
                  : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                    totalGeralPendentesCorrecao > 0
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block truncate">
                    Correções Pendentes
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-heading font-black text-sm sm:text-lg leading-tight block truncate ${
                        totalGeralPendentesCorrecao > 0 ? 'text-purple-900' : 'text-slate-900'
                      }`}
                    >
                      {totalGeralPendentesCorrecao}
                    </span>
                    {totalGeralPendentesCorrecao > 0 && (
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-600 animate-pulse shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 truncate block mt-0.5">
                    {totalGeralPendentesCorrecao > 0
                      ? `${totalGeralPendentesCorrecao} discursiva${totalGeralPendentesCorrecao > 1 ? 's' : ''}`
                      : 'Notas em dia'}
                  </span>
                </div>
              </div>

              {totalGeralPendentesCorrecao > 0 && (
                <span className="text-[10px] sm:text-2xs font-bold text-purple-700 bg-white border border-purple-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0 shadow-2xs self-end sm:self-auto">
                  Corrigir →
                </span>
              )}
            </div>

            {/* KPI 4: Cota de IA do Mês */}
            {!IA_SEM_LIMITE && (
              <div className="bg-white border border-slate-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-xs flex items-center gap-2 sm:gap-3.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block truncate">
                    Cota IA (Mês)
                  </span>
                  <span className="font-heading font-black text-sm sm:text-lg text-amber-900 leading-tight block truncate">
                    {cotaIA ? `${cotaIA.uso_mes} / ${cotaIA.limite_mes}` : '200'}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 truncate block mt-0.5">
                    {cotaIA
                      ? `${Math.max(0, cotaIA.limite_mes - cotaIA.uso_mes)} restantes`
                      : 'Gerações com IA'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            3. LEMBRETE DE PRAZOS PRÓXIMOS (se houver atividades vencendo em até 4 dias)
           ========================================================================= */}
        {prazosExibidos.length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3 sm:px-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-amber-900 font-heading font-bold text-xs shrink-0">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Prazos próximos ({prazosExibidos.length}):</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-1">
              {prazosExibidos.map((ativ) => (
                <button
                  key={ativ.id}
                  type="button"
                  aria-label={`Atividade ${ativ.titulo} com prazo próximo`}
                  onClick={() => navigate(`/professor/atividade/${ativ.id}/resultados`)}
                  className="p-2 rounded-xl bg-white border border-amber-200/90 hover:border-amber-400 transition-all flex items-center gap-2 text-xs cursor-pointer shadow-2xs group shrink-0"
                >
                  <span
                    aria-hidden="true"
                    className="font-bold text-slate-800 truncate max-w-[200px] group-hover:text-indigo-600 text-left"
                  >
                    {ativ.titulo}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {ativ.prazo ? `Vence em ${ativ.prazo.split('-').reverse().join('/')}` : 'Sem data'}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`font-semibold text-2xs uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${
                      ativ.diasRestantes === 0
                        ? 'bg-rose-100 text-rose-800 border-rose-200 font-bold'
                        : ativ.diasRestantes === 1
                        ? 'bg-amber-100 text-amber-900 border-amber-200 font-bold'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {ativ.diasRestantes === 0
                      ? 'Hoje'
                      : ativ.diasRestantes === 1
                      ? 'Amanhã'
                      : `${ativ.diasRestantes}d`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            4. RADAR DIAGNÓSTICO: ALUNOS EM ATENÇÃO (< 60% no Período Ativo)
           ========================================================================= */}
        {!carregando && !erro && ofertas.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div
              onClick={() => setRadarExpandido((prev) => !prev)}
              className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    alunosEmAtencao.length > 0
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}
                >
                  {alunosEmAtencao.length > 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-heading font-black text-sm sm:text-base text-slate-900 leading-snug">
                      Radar Pedagógico: Alunos em Atenção
                    </h3>
                    <span
                      className={`inline-flex items-center whitespace-nowrap shrink-0 text-2xs sm:text-xs font-bold px-2 py-0.5 rounded-full border w-fit ${
                        alunosEmAtencao.length > 0
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {alunosEmAtencao.length}{' '}
                      {alunosEmAtencao.length === 1 ? 'estudante' : 'estudantes'}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    {periodoAtivo ? `${periodoAtivo.nome} — ` : ''}Aproveitamento inferior a 60% nas suas matérias.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400 shrink-0">
                <span className="text-xs font-semibold hidden sm:inline">
                  {radarExpandido ? 'Recolher' : 'Expandir lista'}
                </span>
                {radarExpandido ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </div>

            {/* Conteúdo Expandido do Radar (com scroll máximo para não quebrar a tela) */}
            {radarExpandido && (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-slate-100 max-h-[360px] overflow-y-auto pr-1">
                {alunosEmAtencao.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-emerald-900 flex items-center gap-3 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Excelente notícia! Nenhum estudante das suas turmas está na faixa de atenção no momento.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {alunosEmAtencao.map((aluno) => (
                      <div
                        key={`${aluno.oferta_id}-${aluno.aluno_id}`}
                        className="p-3 rounded-xl border border-rose-200/80 bg-rose-50/30 hover:bg-rose-50/70 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-500 truncate">
                              {aluno.turma_nome} • {aluno.disciplina_nome}
                            </span>
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                              {aluno.media}%
                            </span>
                          </div>
                          <h4 className="font-heading font-black text-sm text-slate-900 leading-snug">
                            {aluno.nome_completo}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-rose-100">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Eye className="w-3.5 h-3.5 text-indigo-600" />}
                            onClick={() => navigate(`/professor/aluno/${aluno.aluno_id}`)}
                            className="flex-1 text-xs font-semibold bg-white border-slate-200 hover:border-indigo-300 py-1"
                          >
                            Ver Ficha
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Plus className="w-3.5 h-3.5 text-emerald-600" />}
                            onClick={() =>
                              navigate(`/professor/oferta/${aluno.oferta_id}?aba=atividades`)
                            }
                            className="flex-1 text-xs font-semibold bg-white border-slate-200 hover:border-emerald-300 py-1"
                            title="Ir para a turma para criar atividade de reforço"
                          >
                            Reforço
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Estado de Carregamento Base */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando suas turmas...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {!carregando && erro && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-medium">{erro}</p>
          </div>
        )}

        {/* =========================================================================
            6. SELETOR DE SÉRIES COM ESCOLHA ENTRE ATIVIDADES OU ALUNOS
           ========================================================================= */}
        {!carregando && !erro && seriesDisponiveis.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Séries em que leciona:
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {seriesDisponiveis.length}{' '}
                  {seriesDisponiveis.length === 1 ? 'série vinculada' : 'séries vinculadas'}
                </span>
              </div>

              {/* Alternador de Visão por Série: Atividades vs Alunos */}
              <div
                className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto"
                role="tablist"
                aria-label="Escolher visualização da série"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaVisao === 'atividades'}
                  onClick={() => setAbaVisao('atividades')}
                  data-testid="toggle-visao-atividades"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    abaVisao === 'atividades'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Atividades da Série</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={abaVisao === 'alunos'}
                  onClick={() => setAbaVisao('alunos')}
                  data-testid="toggle-visao-alunos"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    abaVisao === 'alunos'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Alunos da Série</span>
                </button>
              </div>
            </div>

            {/* Abas de Seleção de Série */}
            <div className="flex flex-wrap items-center gap-2 pt-1" role="tablist" aria-label="Séries">
              {seriesDisponiveis.map((serie) => {
                const ativa = serie === serieSelecionada;
                const qtdMaterias = ofertas.filter(
                  (o) => (o.turma_serie || 'Outras turmas') === serie
                ).length;

                return (
                  <button
                    key={serie}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setSerieSelecionada(serie)}
                    data-testid={`aba-serie-${serie}`}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                      ativa
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600/30'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-white hover:text-indigo-600'
                    }`}
                  >
                    <span>{serie}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        ativa
                          ? 'bg-indigo-700/80 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {qtdMaterias} {qtdMaterias === 1 ? 'matéria' : 'matérias'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nenhuma turma atribuída */}
        {!carregando && !erro && ofertas.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-heading font-bold text-lg text-slate-700">
              Nenhuma turma atribuída
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Você ainda não possui ofertas vinculadas. A coordenação escolar é responsável pela
              atribuição de turmas e disciplinas.
            </p>
          </div>
        )}

        {/* =========================================================================
            VISÃO 1: ATIVIDADES DA SÉRIE (Cartões de Ofertas e Turmas)
           ========================================================================= */}
        {abaVisao === 'atividades' && (
          <>
            {!carregando && !erro && ofertas.length > 0 && ofertasFiltradas.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-heading font-bold text-base text-slate-700">
                  Nenhuma matéria encontrada nesta série
                </h3>
                <p className="text-sm text-slate-500">
                  Selecione outra série acima para visualizar suas turmas e disciplinas.
                </p>
              </div>
            )}

            {!carregando && !erro && ofertasFiltradas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ofertasFiltradas.map((oferta) => (
                  <Card
                    key={oferta.id}
                    hover
                    onClick={() => navigate(`/professor/oferta/${oferta.id}`)}
                    className="cursor-pointer border-slate-200 hover:border-indigo-300 group flex flex-col justify-between"
                  >
                    <CardContent className="p-6 space-y-4">
                      {/* Topo do Cartão: Turma e Disciplina */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                            {oferta.disciplina_nome}
                          </span>
                          <div
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg"
                            title="Código de acesso para os alunos"
                          >
                            <Key className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono font-bold text-slate-700">
                              {oferta.turma_codigo}
                            </span>
                          </div>
                        </div>

                        <h2 className="font-heading font-black text-xl text-slate-900 group-hover:text-indigo-600 transition-colors pt-1">
                          {oferta.turma_nome}
                        </h2>
                      </div>

                      {/* Contagem de Atividades por Status */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                          Atividades ({oferta.totalGeral})
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {/* Rascunhos */}
                          <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-center">
                            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 mb-0.5">
                              <FileEdit className="w-3 h-3" />
                              <span>Rascunho</span>
                            </div>
                            <span className="font-heading font-black text-base text-amber-900">
                              {oferta.totalRascunhos}
                            </span>
                          </div>

                          {/* Publicadas */}
                          <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-center">
                            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 mb-0.5">
                              <Send className="w-3 h-3" />
                              <span>Publicada</span>
                            </div>
                            <span className="font-heading font-black text-base text-emerald-900">
                              {oferta.totalPublicadas}
                            </span>
                          </div>

                          {/* Encerradas */}
                          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-center">
                            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 mb-0.5">
                              <Archive className="w-3 h-3" />
                              <span>Encerrada</span>
                            </div>
                            <span className="font-heading font-black text-base text-slate-800">
                              {oferta.totalEncerradas}
                            </span>
                          </div>
                        </div>

                        {/* Alerta de Correções Discursivas Pendentes */}
                        {oferta.totalPendentesCorrecao > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (oferta.primeiraAtividadeComPendenteId) {
                                navigate(
                                  `/professor/atividade/${oferta.primeiraAtividadeComPendenteId}/resultados?aba=correcoes`
                                );
                              } else {
                                navigate(`/professor/oferta/${oferta.id}?aba=resultados`);
                              }
                            }}
                            className="mt-2.5 p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between text-xs font-bold hover:bg-purple-100 transition-colors shadow-2xs cursor-pointer"
                            title="Clique para ir direto às correções pendentes"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                              <span>
                                {oferta.totalPendentesCorrecao} discursiva
                                {oferta.totalPendentesCorrecao > 1 ? 's' : ''} para corrigir
                              </span>
                            </div>
                            <span className="text-2xs uppercase tracking-wider text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                              Corrigir →
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Ação Inferior */}
                      <div className="pt-2 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Gerenciar atividades
                        </span>
                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* =========================================================================
            VISÃO 2: ALUNOS DA SÉRIE (Média por matéria + Observações)
           ========================================================================= */}
        {abaVisao === 'alunos' && (
          <div className="space-y-4">
            {/* Barra de Busca e Filtros de Alunos */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Buscar aluno por nome ou nº de chamada..."
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                {turmasNaSerie.length > 1 && (
                  <div className="w-full sm:w-44">
                    <Select
                      aria-label="Filtrar por turma"
                      value={filtroTurma}
                      onChange={(e) => setFiltroTurma(e.target.value)}
                      options={[
                        { value: 'todos', label: 'Todas as turmas' },
                        ...turmasNaSerie.map((t) => ({ value: t.id, label: t.nome })),
                      ]}
                    />
                  </div>
                )}

                <div className="w-full sm:w-40">
                  <Select
                    aria-label="Filtrar por faixa de rendimento"
                    value={filtroFaixa}
                    onChange={(e) => setFiltroFaixa(e.target.value)}
                    options={[
                      { value: 'todos', label: 'Todas as faixas' },
                      { value: 'Ótimo', label: 'Faixa: Ótimo' },
                      { value: 'Bom', label: 'Faixa: Bom' },
                      { value: 'Atenção', label: 'Faixa: Atenção' },
                      { value: 'Sem atividades', label: 'Sem atividades' },
                    ]}
                  />
                </div>

                {/* Alternador de Modo de Exibição: Tabela vs. Cartões */}
                <div
                  className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0"
                  role="group"
                  aria-label="Modo de visualização dos alunos"
                >
                  <button
                    type="button"
                    onClick={() => setModoVisualizacaoAlunos('tabela')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modoVisualizacaoAlunos === 'tabela'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Visualização em Tabela"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabela</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisualizacaoAlunos('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modoVisualizacaoAlunos === 'cards'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Visualização em Cartões"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cartões</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Estado de Carregamento de Alunos */}
            {carregandoAlunos && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium">Carregando alunos do {serieSelecionada}...</p>
              </div>
            )}

            {/* Nenhum aluno encontrado */}
            {!carregandoAlunos && alunosFiltrados.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-heading font-bold text-base text-slate-700">
                  Nenhum aluno encontrado
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  {buscaAluno
                    ? 'Tente ajustar os termos de busca ou remover os filtros aplicados.'
                    : 'Nenhum estudante matriculado nas turmas desta série.'}
                </p>
              </div>
            )}

            {/* Modo Tabela de Alunos da Série */}
            {!carregandoAlunos && alunosFiltrados.length > 0 && modoVisualizacaoAlunos === 'tabela' && (
              <TabelaAlunosSerie
                alunos={alunosFiltrados}
                carregando={carregandoAlunos}
                onAbrirObservacao={(item: AlunoComDesempenhoResumo) => setAlunoObservacao(item)}
                onVisualizarAluno={(alunoId: string) => navigate(`/professor/aluno/${alunoId}`)}
                serieNome={serieSelecionada || 'Série'}
              />
            )}

            {/* Modo Grid de Cartões de Alunos da Série */}
            {!carregandoAlunos && alunosFiltrados.length > 0 && modoVisualizacaoAlunos === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alunosFiltrados.map((item) => {
                  const temObservacao = Boolean(item.ultima_observacao);

                  return (
                    <Card
                      key={item.aluno.id}
                      className="border-slate-200 hover:border-indigo-300 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <CardContent className="p-5 space-y-4">
                        {/* Topo do Aluno: Nome, Número de Chamada e Turma */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              Nº {item.aluno.numero_chamada} • {item.turma_nome}
                            </span>

                            {/* Badge da Faixa Geral */}
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                item.faixa_geral === 'Ótimo'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : item.faixa_geral === 'Bom'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : item.faixa_geral === 'Atenção'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {item.media_geral !== null ? `${item.media_geral}% Geral` : item.faixa_geral}
                            </span>
                          </div>

                          <h3 className="font-heading font-black text-base text-slate-900 leading-snug">
                            {item.aluno.nome_completo}
                          </h3>
                        </div>

                        {/* Média de Acerto de Cada Aluno por Matéria */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Média de acerto por matéria:
                          </span>

                          {item.materias.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              Sem matérias registradas.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {item.materias.map((mat) => {
                                const temMedia = mat.media !== null;
                                const corBadge =
                                  mat.faixa === 'Ótimo'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : mat.faixa === 'Bom'
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : mat.faixa === 'Atenção'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200';

                                return (
                                  <div
                                    key={mat.disciplina_id}
                                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-bold text-slate-800 truncate">
                                        {mat.disciplina_nome}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        ({mat.atividades_concluidas}/{mat.total_atividades} ativ.)
                                      </span>
                                    </div>

                                    <span
                                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border shrink-0 ${corBadge}`}
                                      title={
                                        temMedia
                                          ? `${mat.soma_acertos} acertos em ${mat.soma_questoes} questões`
                                          : 'Nenhuma atividade avaliada'
                                      }
                                    >
                                      {temMedia ? `${mat.media}%` : '—'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Prévia da Observação Pedagógica */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-indigo-500" />
                              <span>Observação pedagógica:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setAlunoObservacao(item)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>{temObservacao ? 'Editar' : 'Escrever'}</span>
                            </button>
                          </div>

                          {temObservacao && item.ultima_observacao ? (
                            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-1">
                              <p className="line-clamp-2 leading-relaxed italic">
                                &ldquo;{item.ultima_observacao.texto}&rdquo;
                              </p>
                              <span className="text-[10px] text-amber-700 block font-medium">
                                Por {item.ultima_observacao.professor_nome}
                              </span>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                              <p className="text-[11px] text-slate-400 italic">
                                Nenhuma observação registrada ainda.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Ações Inferiores: Escrever Observação & Visualizar Aluno */}
                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<FileEdit className="w-3.5 h-3.5 text-indigo-600" />}
                            onClick={() => setAlunoObservacao(item)}
                            className="flex-1 text-xs font-semibold"
                          >
                            Observação
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => navigate(`/professor/aluno/${item.aluno.id}`)}
                            className="flex-1 text-xs font-semibold"
                          >
                            Visualizar aluno
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Nova Atividade Rápida */}
      <ModalNovaAtividadeRapida
        aberto={modalNovaAtividadeAberto}
        onFechar={() => setModalNovaAtividadeAberto(false)}
        ofertas={ofertas}
        periodos={periodos}
        periodoAtivoId={periodoAtivo?.id}
        onCriada={(novaAtivId) => {
          setModalNovaAtividadeAberto(false);
          navigate(`/professor/atividade/${novaAtivId}`);
        }}
      />

      {/* Modal: Gerador de Questões com IA */}
      <ModalGeradorIA
        aberto={modalGeradorIAAberto}
        onFechar={() => setModalGeradorIAAberto(false)}
        disciplinaIdInicial={combinacoes[0]?.disciplina_id || ofertas[0]?.disciplina_id || ''}
        serieInicial={combinacoes[0]?.serie || serieSelecionada || '6º Ano'}
        combinacoes={combinacoes}
        assuntos={assuntos}
        onCriarAssunto={handleCriarAssuntoIA}
        onSucesso={handleSucessoGeracaoIA}
      />

      {/* Modal de Observação do Aluno */}
      {alunoObservacao && (
        <ModalObservacaoAluno
          isOpen={Boolean(alunoObservacao)}
          onClose={() => setAlunoObservacao(null)}
          alunoId={alunoObservacao.aluno.id}
          alunoNome={alunoObservacao.aluno.nome_completo}
          turmaNome={alunoObservacao.turma_nome}
          numeroChamada={alunoObservacao.aluno.numero_chamada}
          onSalvo={carregarAlunosDaSerie}
        />
      )}
    </AppShell>
  );
};

export default ProfessorDashboardPage;
