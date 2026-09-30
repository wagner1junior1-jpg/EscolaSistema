import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Select,
  Tabs,
  Textarea,
  Modal,
  useToast,
  MathText,
} from '@/components/ui';
import {
  professorService,
  AtividadeCompleta,
  MapaDeCalorAtividade,
  ItemMapaDeCalorQuestao,
  questoesCriticas,
  LetraAlternativa,
  ItemCorrecaoPendente,
  ItemCorrecaoFeita,
  assinarMudancas,
} from '@/services';
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  AlertCircle,
  Loader2,
  TrendingDown,
  CheckCircle2,
  XCircle,
  BarChart2,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
  Filter,
  HelpCircle,
  Award,
} from 'lucide-react';
import { formatarPercentual, pluralizar } from '@/lib/formatar';

export const ProfessorResultadosPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [atividade, setAtividade] = useState<AtividadeCompleta | null>(null);
  const [mapa, setMapa] = useState<MapaDeCalorAtividade | null>(null);
  const [pendentes, setPendentes] = useState<ItemCorrecaoPendente[]>([]);
  const [corrigidas, setCorrigidas] = useState<ItemCorrecaoFeita[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Aba principal: 'mapa' | 'correcoes'
  const abaParam = searchParams.get('aba');
  const [abaPrincipal, setAbaPrincipal] = useState<'mapa' | 'correcoes'>(
    abaParam === 'correcoes' ? 'correcoes' : 'mapa'
  );

  // Sub-aba de Correções: 'pendentes' | 'corrigidas'
  const [subAbaCorrecoes, setSubAbaCorrecoes] = useState<'pendentes' | 'corrigidas'>('pendentes');
  const [filtroQuestaoCorrecao, setFiltroQuestaoCorrecao] = useState<string>('todas');
  const [filtroAlunoCorrecao, setFiltroAlunoCorrecao] = useState<string>('');

  // Comentários e notas por resposta_id
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<string, number | ''>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  // Ordenação: 'ordem' (ordem da prova) | 'dificeis' (mais difíceis primeiro)
  const [ordenacao, setOrdenacao] = useState<'ordem' | 'dificeis'>('ordem');

  // Filtro de questões: 'todas' | 'criticas'
  const [filtroCriticas, setFiltroCriticas] = useState<'todas' | 'criticas'>('todas');

  // Questão selecionada para abertura do modal detalhado
  const [questaoModal, setQuestaoModal] = useState<ItemMapaDeCalorQuestao | null>(null);

  const carregarDados = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);

    try {
      const [ativCarregada, mapaCarregado, pendentesCarregados, corrigidasCarregadas] =
        await Promise.all([
          professorService.obterAtividade(id),
          professorService.mapaDeCalor(id),
          professorService.listarCorrecoesPendentes(id),
          professorService.listarCorrecoesFeitas(id),
        ]);

      if (!ativCarregada) {
        throw new Error('Atividade não encontrada ou sem permissão de acesso.');
      }

      setAtividade(ativCarregada);
      setMapa(mapaCarregado);
      setPendentes(pendentesCarregados);
      setCorrigidas(corrigidasCarregadas);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar os resultados da atividade.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregarDados();
    const desassinar = assinarMudancas(() => {
      carregarDados();
    });
    return () => {
      desassinar();
    };
  }, [carregarDados]);

  const mudarAbaPrincipal = (novaAba: 'mapa' | 'correcoes') => {
    setAbaPrincipal(novaAba);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (novaAba === 'correcoes') {
        next.set('aba', 'correcoes');
      } else {
        next.delete('aba');
      }
      return next;
    });
  };

  const handleCorrigir = async (
    respostaId: string,
    correcaoPadrao: 'certo' | 'parcial' | 'errado',
    comentarioManual?: string | null,
    notaManual?: number
  ) => {
    if (!id) return;
    setSalvandoId(respostaId);
    try {
      const textoComentario =
        comentarioManual !== undefined
          ? (comentarioManual ?? '').trim() || undefined
          : (comentarios[respostaId] ?? '').trim() || undefined;

      const notaInformada =
        notaManual !== undefined
          ? notaManual
          : typeof notas[respostaId] === 'number'
          ? (notas[respostaId] as number)
          : undefined;

      let correcaoFinal = correcaoPadrao;
      if (notaInformada !== undefined) {
        if (notaInformada === 100) correcaoFinal = 'certo';
        else if (notaInformada === 0) correcaoFinal = 'errado';
        else correcaoFinal = 'parcial';
      }

      await professorService.corrigirResposta(respostaId, correcaoFinal, textoComentario, notaInformada);
      toast.success('Correção salva com sucesso!');

      // Atualiza listas de pendentes e corrigidas e o mapa de calor
      const [novasPendentes, novasCorrigidas, novoMapa] = await Promise.all([
        professorService.listarCorrecoesPendentes(id),
        professorService.listarCorrecoesFeitas(id),
        professorService.mapaDeCalor(id),
      ]);
      setPendentes(novasPendentes);
      setCorrigidas(novasCorrigidas);
      setMapa(novoMapa);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar correção.');
    } finally {
      setSalvandoId(null);
    }
  };

  const formatarData = (dataStr?: string) => {
    if (!dataStr) return '';
    try {
      const d = new Date(dataStr);
      return isNaN(d.getTime())
        ? dataStr
        : d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    } catch {
      return dataStr;
    }
  };

  // Identifica questões críticas usando a função pura do sistema
  const criticas = mapa ? questoesCriticas(mapa.questoes) : [];
  const idsCriticas = new Set(criticas.map((c) => c.questao_id));

  // Filtra e ordena as questões conforme seleção
  const questoesFiltradas = (mapa ? mapa.questoes : []).filter((q) => {
    if (filtroCriticas === 'criticas') {
      return idsCriticas.has(q.questao_id);
    }
    return true;
  });

  const questoesExibidas: ItemMapaDeCalorQuestao[] = [...questoesFiltradas].sort((a, b) => {
    if (ordenacao === 'dificeis') {
      return a.porcentagem_acerto - b.porcentagem_acerto;
    }
    return a.ordem - b.ordem;
  });

  const pendentesFiltrados = pendentes.filter((item) => {
    if (filtroQuestaoCorrecao !== 'todas' && item.questao_id !== filtroQuestaoCorrecao) {
      return false;
    }
    if (filtroAlunoCorrecao.trim()) {
      const termo = filtroAlunoCorrecao.toLowerCase();
      if (!item.aluno_nome.toLowerCase().includes(termo)) {
        return false;
      }
    }
    return true;
  });

  // Variáveis e manipuladores para o modal da questão selecionada
  const modalIdx = questoesExibidas.findIndex(
    (item) => item.questao_id === questaoModal?.questao_id
  );
  const questaoBaseModal =
    questaoModal && atividade
      ? atividade.questoes.find((item) => item.id === questaoModal.questao_id)
      : null;
  const alternativasModal = questaoBaseModal?.alternativas || [];
  const isCriticaModal = questaoModal ? idsCriticas.has(questaoModal.questao_id) : false;
  const pctModal = questaoModal ? questaoModal.porcentagem_acerto : 0;
  const barraCorModal =
    pctModal >= 80 ? 'bg-emerald-500' : pctModal >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const textoCorModal =
    pctModal >= 80
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : pctModal >= 50
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  const irParaAnterior = () => {
    if (modalIdx > 0) {
      setQuestaoModal(questoesExibidas[modalIdx - 1]);
    }
  };

  const irParaProxima = () => {
    if (modalIdx >= 0 && modalIdx < questoesExibidas.length - 1) {
      setQuestaoModal(questoesExibidas[modalIdx + 1]);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Navegação Voltar */}
        <Link
          to={atividade ? `/professor/oferta/${atividade.oferta_id}?aba=atividades` : '/professor'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para as atividades da turma</span>
        </Link>

        {/* Estado de Carregamento */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando mapa de calor e correções...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {!carregando && erro && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-rose-900">
                Não foi possível carregar os resultados
              </h3>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{erro}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/professor')} className="mx-auto">
              Voltar para Minhas Turmas
            </Button>
          </div>
        )}

        {/* Cabeçalho de Resultados e Abas */}
        {!carregando && !erro && atividade && mapa && (
          <>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      atividade.modo === 'prova'
                        ? 'bg-violet-100 text-violet-800 border-violet-200'
                        : 'bg-teal-100 text-teal-800 border-teal-200'
                    }`}
                  >
                    {atividade.modo === 'prova' ? 'Prova' : 'Exercício'}
                  </span>

                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      atividade.status === 'publicada'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {atividade.status.toUpperCase()}
                  </span>

                  {pendentes.length > 0 && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      {pluralizar(pendentes.length, 'correção pendente', 'correções pendentes')}
                    </span>
                  )}
                </div>

                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  {mapa.titulo}
                </h1>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>
                    <strong>{mapa.total_alunos_responderam}</strong>{' '}
                    {mapa.total_alunos_responderam === 1 ? 'aluno respondeu' : 'alunos responderam'}
                  </span>
                </div>
              </div>
            </div>

            {/* Abas Principais: Resultados e Mapa de Calor | Correções */}
            <div className="border-b border-slate-200 bg-white rounded-2xl px-4 pt-2 shadow-2xs">
              <Tabs
                activeTab={abaPrincipal}
                onChange={(tab) => mudarAbaPrincipal(tab as 'mapa' | 'correcoes')}
                tabs={[
                  {
                    id: 'mapa',
                    label: 'Resultados e Mapa de Calor',
                    icon: <BarChart2 className="w-4 h-4" />,
                  },
                  {
                    id: 'correcoes',
                    label: 'Correções',
                    icon: <CheckCircle2 className="w-4 h-4" />,
                    count: pendentes.length > 0 ? pendentes.length : undefined,
                  },
                ]}
              />
            </div>

            {/* Aba 1: Mapa de Calor e Estatísticas */}
            {abaPrincipal === 'mapa' && (
              <div className="space-y-6">
                {/* Controles de Filtro e Ordenação */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  {/* Filtro Rápido */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      Filtrar:
                    </span>
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setFiltroCriticas('todas')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                          filtroCriticas === 'todas'
                            ? 'bg-white text-indigo-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Todas as questões ({mapa.questoes.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroCriticas('criticas')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                          filtroCriticas === 'criticas'
                            ? 'bg-white text-rose-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>Apenas críticas</span>
                        {criticas.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black">
                            {criticas.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Ordenação */}
                  <div className="w-full sm:w-64">
                    <Select
                      label="Ordenar questões por:"
                      value={ordenacao}
                      onChange={(e) => setOrdenacao(e.target.value as 'ordem' | 'dificeis')}
                      options={[
                        { value: 'ordem', label: 'Ordem da prova' },
                        { value: 'dificeis', label: 'Mais difíceis primeiro' },
                      ]}
                    />
                  </div>
                </div>

                {/* Lista de Questões em Linha */}
                {questoesExibidas.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h3 className="font-heading font-bold text-base text-slate-800">
                      Nenhuma questão crítica nesta atividade
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                      A turma teve bom aproveitamento (≥ 50%) em todas as questões avaliadas!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questoesExibidas.map((q) => {
                      const questaoBase = atividade.questoes.find((item) => item.id === q.questao_id);
                      const alternativasBase = questaoBase?.alternativas || [];
                      const isCritica = idsCriticas.has(q.questao_id);

                      const pct = q.porcentagem_acerto;
                      const barraCor =
                        pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                      const badgeCor =
                        pct >= 80
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : pct >= 50
                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : 'text-rose-700 bg-rose-50 border-rose-200';

                      return (
                        <div
                          key={q.questao_id}
                          onClick={() => setQuestaoModal(q)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setQuestaoModal(q);
                            }
                          }}
                          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          {/* Lado Esquerdo: Identificação, Tipo, Enunciado e Raio-X */}
                          <div className="flex items-start gap-3.5 flex-1 min-w-0">
                            {/* Número da questão */}
                            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-heading font-black text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform mt-0.5">
                              {q.ordem}
                            </span>

                            <div className="space-y-1.5 flex-1 min-w-0">
                              {/* Linha de Badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading font-bold text-sm text-slate-800">
                                  Questão {q.ordem}
                                </span>

                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                    questaoBase?.tipo === 'discursiva'
                                      ? 'bg-violet-50 text-violet-800 border-violet-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {questaoBase?.tipo === 'discursiva' ? 'Discursiva' : 'Objetiva'}
                                </span>

                                {isCritica && (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                    <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Questão crítica</span>
                                  </div>
                                )}

                                {q.distrator_mais_escolhido && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>
                                      Pegadinha: Letra {q.distrator_mais_escolhido.letra} ({pluralizar(q.distrator_mais_escolhido.total_escolhas, 'aluno', 'alunos')})
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Enunciado truncado de 1 linha */}
                              <p className="text-xs sm:text-sm text-slate-600 font-medium truncate max-w-2xl">
                                {q.enunciado}
                              </p>

                              {/* Raio-X das Alternativas ou Distribuição Discursiva */}
                              {q.distribuicao_discursiva ? (
                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
                                    Avaliação:
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>Certo: {formatarPercentual(q.distribuicao_discursiva.certo.porcentagem)} ({q.distribuicao_discursiva.certo.total})</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <span>Parcial: {formatarPercentual(q.distribuicao_discursiva.parcial.porcentagem)} ({q.distribuicao_discursiva.parcial.total})</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>Errado: {formatarPercentual(q.distribuicao_discursiva.errado.porcentagem)} ({q.distribuicao_discursiva.errado.total})</span>
                                  </span>
                                </div>
                              ) : alternativasBase.length > 0 ? (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
                                    Alternativas:
                                  </span>
                                  {(['A', 'B', 'C', 'D', 'E'] as LetraAlternativa[]).map((letra) => {
                                    const altObj = alternativasBase.find((a) => a.letra === letra);
                                    if (!altObj) return null;
                                    const isCorreta = altObj.correta;
                                    const isDistrator =
                                      q.distrator_mais_escolhido?.letra === letra;
                                    const dist = q.distribuicao[letra];
                                    const votos = dist?.total ?? 0;

                                    let badgeStyle =
                                      'border-slate-200 bg-slate-50 text-slate-600';
                                    if (isCorreta) {
                                      badgeStyle =
                                        'border-emerald-500 bg-emerald-50 text-emerald-800 font-black ring-1 ring-emerald-400';
                                    } else if (isDistrator && votos > 0) {
                                      badgeStyle =
                                        'border-rose-400 bg-rose-50 text-rose-800 font-black';
                                    }

                                    return (
                                      <span
                                        key={letra}
                                        title={`${letra}) ${altObj.texto}${
                                          isCorreta ? ' (Correta)' : ''
                                        } — ${votos} escolha(s)`}
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-mono font-bold border transition-colors ${badgeStyle}`}
                                      >
                                        {letra}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* Lado Direito: Barra de Calor, % e Ação */}
                          <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                            {/* Barra de Calor & % */}
                            <div className="w-36 sm:w-48 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Acertos</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs border ${badgeCor}`}
                                >
                                  {formatarPercentual(pct)}
                                </span>
                              </div>

                              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full ${barraCor} transition-all duration-500`}
                                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                />
                              </div>

                              <div className="text-[11px] text-slate-500 text-right font-medium">
                                {q.total_acertos} de {pluralizar(q.total_respostas, 'aluno', 'alunos')}
                              </div>
                            </div>

                            {/* Botão Ver Questão */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 group-hover:text-indigo-800 group-hover:bg-indigo-50 font-bold text-xs gap-1 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuestaoModal(q);
                              }}
                            >
                              <span>Ver detalhes</span>
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Aba 2: Correções */}
            {abaPrincipal === 'correcoes' && (
              <div className="space-y-6">
                <Tabs
                  activeTab={subAbaCorrecoes}
                  onChange={(tab) => setSubAbaCorrecoes(tab as 'pendentes' | 'corrigidas')}
                  tabs={[
                    {
                      id: 'pendentes',
                      label: 'Pendentes',
                      count: pendentes.length,
                    },
                    {
                      id: 'corrigidas',
                      label: 'Corrigidas',
                      count: corrigidas.length,
                    },
                  ]}
                />

                {/* Sub-aba: Pendentes */}
                {subAbaCorrecoes === 'pendentes' && (
                  <div className="space-y-4">
                    {/* Barra de Filtros da Fila de Correção */}
                    {pendentes.length > 0 && (
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                          {/* Filtro por questão */}
                          <div className="sm:w-64">
                            <Select
                              aria-label="Filtrar por Questão"
                              value={filtroQuestaoCorrecao}
                              onChange={(e) => setFiltroQuestaoCorrecao(e.target.value)}
                              className="text-xs"
                            >
                              <option value="todas">Todas as questões ({pendentes.length})</option>
                              {Array.from(new Set(pendentes.map((p) => p.questao_id))).map((qId) => {
                                const qItem = pendentes.find((p) => p.questao_id === qId);
                                const qNum = qItem?.questao_ordem || '?';
                                const qTotal = pendentes.filter((p) => p.questao_id === qId).length;
                                return (
                                  <option key={qId} value={qId}>
                                    Questão {qNum} ({qTotal} pendente{qTotal > 1 ? 's' : ''})
                                  </option>
                                );
                              })}
                            </Select>
                          </div>

                          {/* Busca por aluno */}
                          <div className="sm:w-64">
                            <Input
                              placeholder="Buscar por nome do aluno..."
                              value={filtroAlunoCorrecao}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltroAlunoCorrecao(e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-slate-500 whitespace-nowrap self-end sm:self-center">
                          Mostrando {pendentesFiltrados.length} de {pendentes.length} pendente(s)
                        </div>
                      </div>
                    )}

                    {pendentes.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                        <h3 className="font-heading font-bold text-base text-slate-800">
                          Nenhuma correção pendente
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                          Todas as respostas discursivas enviadas pelos alunos nesta atividade já foram corrigidas.
                        </p>
                      </div>
                    ) : pendentesFiltrados.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                        <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                        <h3 className="font-heading font-bold text-base text-slate-800">
                          Nenhum resultado para estes filtros
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                          Tente limpar ou ajustar o filtro de questão e o nome do aluno pesquisado.
                        </p>
                      </div>
                    ) : (
                      pendentesFiltrados.map((item) => (
                        <Card key={item.resposta_id} className="border-slate-200 shadow-xs">
                          <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-heading font-black text-xs flex items-center justify-center">
                                  {item.aluno_nome.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="font-heading font-bold text-sm text-slate-900">
                                    {item.aluno_nome}
                                  </h3>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Enviada em {formatarData(item.respondida_em)}
                                  </span>
                                </div>
                              </div>

                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                Aguardando correção
                              </span>
                            </div>
                          </CardHeader>

                          <CardContent className="p-5 sm:p-6 space-y-5">
                            {/* Enunciado */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Enunciado da Questão
                              </span>
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 leading-relaxed font-medium">
                                <MathText text={item.enunciado} />
                              </div>
                            </div>

                            {/* Resposta do Aluno */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Resposta do Aluno
                              </span>
                              <div className="p-3.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.texto_resposta || '(Sem resposta)'} />
                              </div>
                            </div>

                            {/* Resposta Esperada */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                Resposta Esperada / Gabarito
                              </span>
                              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.resposta_esperada || '(Sem resposta esperada cadastrada)'} />
                              </div>
                            </div>

                            {/* Comentário Opcional */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <label
                                  htmlFor={`comentario-${item.resposta_id}`}
                                  className="font-semibold text-slate-700"
                                >
                                  Comentário opcional (até 500 caracteres):
                                </label>
                                <span
                                  className={`font-mono text-xs ${
                                    (comentarios[item.resposta_id]?.length ?? 0) >= 480
                                      ? 'text-amber-600 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {comentarios[item.resposta_id]?.length ?? 0}/500
                                </span>
                              </div>
                              <Textarea
                                id={`comentario-${item.resposta_id}`}
                                placeholder="Feedback ou observação opcional para o aluno..."
                                maxLength={500}
                                rows={3}
                                value={comentarios[item.resposta_id] ?? ''}
                                onChange={(e) =>
                                  setComentarios((prev) => ({
                                    ...prev,
                                    [item.resposta_id]: e.target.value.slice(0, 500),
                                  }))
                                }
                                disabled={salvandoId === item.resposta_id}
                              />
                            </div>

                            {/* Avaliação da Nota (0 a 100) e Conclusão */}
                            <div className="pt-4 border-t border-slate-200/80 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                    Atribuir Nota (0 a 100):
                                  </span>
                                </div>

                                {/* Atalhos Rápidos */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-medium text-slate-400 mr-1">Atalhos:</span>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 100 }))}
                                    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${
                                      notas[item.resposta_id] === 100
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    }`}
                                  >
                                    100 (Certo)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 75 }))}
                                    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${
                                      notas[item.resposta_id] === 75
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    }`}
                                  >
                                    75 (Bom)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 50 }))}
                                    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${
                                      notas[item.resposta_id] === 50
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    50 (Médio)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 0 }))}
                                    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all ${
                                      notas[item.resposta_id] === 0
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                    }`}
                                  >
                                    0 (Errado)
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                <div className="flex items-center gap-2">
                                  <div className="relative w-28">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      placeholder="0 - 100"
                                      value={notas[item.resposta_id] ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                          setNotas((prev) => ({ ...prev, [item.resposta_id]: '' }));
                                        } else {
                                          const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
                                          setNotas((prev) => ({ ...prev, [item.resposta_id]: num }));
                                        }
                                      }}
                                      disabled={salvandoId === item.resposta_id}
                                      className="w-full px-3 py-1.5 text-sm font-black text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-center shadow-xs"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                      /100
                                    </span>
                                  </div>

                                  {typeof notas[item.resposta_id] === 'number' && (
                                    <span
                                      className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                        notas[item.resposta_id] === 100
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : (notas[item.resposta_id] as number) >= 60
                                          ? 'bg-blue-100 text-blue-800'
                                          : (notas[item.resposta_id] as number) > 0
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {notas[item.resposta_id] === 100
                                        ? 'Totalmente Certo'
                                        : (notas[item.resposta_id] as number) >= 60
                                        ? 'Acerto Bom'
                                        : (notas[item.resposta_id] as number) > 0
                                        ? 'Acerto Parcial'
                                        : 'Errado (Zerado)'}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={
                                      salvandoId === item.resposta_id ||
                                      notas[item.resposta_id] === '' ||
                                      notas[item.resposta_id] === undefined
                                    }
                                    onClick={() => {
                                      const n = Number(notas[item.resposta_id]);
                                      const corr = n === 100 ? 'certo' : n === 0 ? 'errado' : 'parcial';
                                      handleCorrigir(item.resposta_id, corr, undefined, n);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                                  >
                                    {salvandoId === item.resposta_id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    <span>
                                      {typeof notas[item.resposta_id] === 'number'
                                        ? `Salvar Nota (${notas[item.resposta_id]} pts)`
                                        : 'Salvar Avaliação'}
                                    </span>
                                  </Button>

                                  {/* Botões rápidos clássicos caso professor queira 1-clique */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-medium text-xs"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => handleCorrigir(item.resposta_id, 'certo', undefined, 100)}
                                    title="Dar nota máxima 100"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                    100%
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-rose-500 text-rose-700 hover:bg-rose-50 font-medium text-xs"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => handleCorrigir(item.resposta_id, 'errado', undefined, 0)}
                                    title="Zerar questão (0)"
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                                    0%
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}

                {/* Sub-aba: Corrigidas */}
                {subAbaCorrecoes === 'corrigidas' && (
                  <div className="space-y-4">
                    {corrigidas.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                        <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                        <h3 className="font-heading font-bold text-base text-slate-800">
                          Nenhuma resposta corrigida ainda
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                          As respostas que você corrigir aparecerão aqui com a nota atribuída e a possibilidade de alteração.
                        </p>
                      </div>
                    ) : (
                      corrigidas.map((item) => (
                        <Card key={item.resposta_id} className="border-slate-200 shadow-xs">
                          <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-heading font-black text-xs flex items-center justify-center">
                                  {item.aluno_nome.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="font-heading font-bold text-sm text-slate-900">
                                    {item.aluno_nome}
                                  </h3>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Enviada em {formatarData(item.respondida_em)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">Nota atribuída:</span>
                                {(() => {
                                  const notaExibida =
                                    item.nota ??
                                    (typeof item.pontuacao === 'number'
                                      ? Math.round(item.pontuacao * 100)
                                      : item.correcao === 'certo'
                                      ? 100
                                      : item.correcao === 'parcial'
                                      ? 50
                                      : 0);

                                  return (
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${
                                        notaExibida === 100
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : notaExibida >= 60
                                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                                          : notaExibida > 0
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : 'bg-rose-100 text-rose-900 border-rose-300'
                                      }`}
                                    >
                                      <Award className="w-3.5 h-3.5" />
                                      <span>{notaExibida} / 100</span>
                                      <span className="opacity-75 font-semibold text-[11px]">
                                        ({item.correcao === 'certo' ? 'Certo' : item.correcao === 'parcial' ? 'Parcial' : 'Errado'})
                                      </span>
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-5 sm:p-6 space-y-5">
                            {/* Enunciado */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Enunciado da Questão
                              </span>
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 leading-relaxed font-medium">
                                <MathText text={item.enunciado} />
                              </div>
                            </div>

                            {/* Resposta do Aluno */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Resposta do Aluno
                              </span>
                              <div className="p-3.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.texto_resposta || '(Sem resposta)'} />
                              </div>
                            </div>

                            {/* Resposta Esperada */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                Resposta Esperada / Gabarito
                              </span>
                              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.resposta_esperada || '(Sem resposta esperada cadastrada)'} />
                              </div>
                            </div>

                            {/* Comentário do Professor */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <label
                                  htmlFor={`comentario-${item.resposta_id}`}
                                  className="font-semibold text-slate-700"
                                >
                                  Comentário para o aluno:
                                </label>
                                <span
                                  className={`font-mono text-xs ${
                                    ((comentarios[item.resposta_id] ?? item.comentario_professor ?? '').length >= 480)
                                      ? 'text-amber-600 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {(comentarios[item.resposta_id] ?? item.comentario_professor ?? '').length}/500
                                </span>
                              </div>
                              <Textarea
                                id={`comentario-${item.resposta_id}`}
                                placeholder="Feedback ou observação para o aluno..."
                                maxLength={500}
                                rows={3}
                                value={comentarios[item.resposta_id] !== undefined ? comentarios[item.resposta_id] : (item.comentario_professor || '')}
                                onChange={(e) =>
                                  setComentarios((prev) => ({
                                    ...prev,
                                    [item.resposta_id]: e.target.value.slice(0, 500),
                                  }))
                                }
                                disabled={salvandoId === item.resposta_id}
                              />
                            </div>

                            {/* Opção de Mudar a Nota */}
                            <div className="pt-4 border-t border-slate-200/80 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    Alterar Nota da Questão (0 a 100):
                                  </span>
                                </div>

                                {/* Atalhos Rápidos */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-medium text-slate-400 mr-1">Atalhos:</span>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 100 }))}
                                    className="px-2 py-1 text-xs font-bold rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-all"
                                  >
                                    100 (Certo)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 75 }))}
                                    className="px-2 py-1 text-xs font-bold rounded-lg border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-all"
                                  >
                                    75 (Bom)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 50 }))}
                                    className="px-2 py-1 text-xs font-bold rounded-lg border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-all"
                                  >
                                    50 (Médio)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => setNotas((prev) => ({ ...prev, [item.resposta_id]: 0 }))}
                                    className="px-2 py-1 text-xs font-bold rounded-lg border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 transition-all"
                                  >
                                    0 (Errado)
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                <div className="flex items-center gap-2">
                                  <div className="relative w-28">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      placeholder="0 - 100"
                                      value={
                                        notas[item.resposta_id] !== undefined
                                          ? notas[item.resposta_id]
                                          : item.nota ?? (typeof item.pontuacao === 'number' ? Math.round(item.pontuacao * 100) : item.correcao === 'certo' ? 100 : item.correcao === 'parcial' ? 50 : 0)
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                          setNotas((prev) => ({ ...prev, [item.resposta_id]: '' }));
                                        } else {
                                          const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
                                          setNotas((prev) => ({ ...prev, [item.resposta_id]: num }));
                                        }
                                      }}
                                      disabled={salvandoId === item.resposta_id}
                                      className="w-full px-3 py-1.5 text-sm font-black text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-center shadow-xs"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                      /100
                                    </span>
                                  </div>

                                  <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() => {
                                      const valorNota =
                                        notas[item.resposta_id] !== undefined && notas[item.resposta_id] !== ''
                                          ? Number(notas[item.resposta_id])
                                          : item.nota ?? (typeof item.pontuacao === 'number' ? Math.round(item.pontuacao * 100) : item.correcao === 'certo' ? 100 : item.correcao === 'parcial' ? 50 : 0);

                                      const corr = valorNota === 100 ? 'certo' : valorNota === 0 ? 'errado' : 'parcial';
                                      const textoCom = comentarios[item.resposta_id] !== undefined
                                        ? comentarios[item.resposta_id]
                                        : (item.comentario_professor || undefined);

                                      handleCorrigir(item.resposta_id, corr, textoCom, valorNota);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                                  >
                                    {salvandoId === item.resposta_id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    <span>Salvar Alteração</span>
                                  </Button>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Botões rápidos clássicos caso professor queira 1-clique */}
                                  <Button
                                    variant={item.correcao === 'certo' ? 'primary' : 'outline'}
                                    size="sm"
                                    className={
                                      item.correcao === 'certo'
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                                        : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-medium text-xs'
                                    }
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() =>
                                      handleCorrigir(
                                        item.resposta_id,
                                        'certo',
                                        comentarios[item.resposta_id] !== undefined ? comentarios[item.resposta_id] : (item.comentario_professor || undefined),
                                        100
                                      )
                                    }
                                    title="Definir como 100% Certo"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    100%
                                  </Button>

                                  <Button
                                    variant={item.correcao === 'parcial' ? 'primary' : 'outline'}
                                    size="sm"
                                    className={
                                      item.correcao === 'parcial'
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold'
                                        : 'border-amber-500 text-amber-700 hover:bg-amber-50 font-medium text-xs'
                                    }
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() =>
                                      handleCorrigir(
                                        item.resposta_id,
                                        'parcial',
                                        comentarios[item.resposta_id] !== undefined ? comentarios[item.resposta_id] : (item.comentario_professor || undefined),
                                        50
                                      )
                                    }
                                    title="Definir como 50% Parcial"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                    50%
                                  </Button>

                                  <Button
                                    variant={item.correcao === 'errado' ? 'primary' : 'outline'}
                                    size="sm"
                                    className={
                                      item.correcao === 'errado'
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold'
                                        : 'border-rose-500 text-rose-700 hover:bg-rose-50 font-medium text-xs'
                                    }
                                    disabled={salvandoId === item.resposta_id}
                                    onClick={() =>
                                      handleCorrigir(
                                        item.resposta_id,
                                        'errado',
                                        comentarios[item.resposta_id] !== undefined ? comentarios[item.resposta_id] : (item.comentario_professor || undefined),
                                        0
                                      )
                                    }
                                    title="Zerar questão (0%)"
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    0%
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modal de Detalhes da Questão do Mapa de Calor */}
        {questaoModal && (
          <Modal
            isOpen={!!questaoModal}
            onClose={() => setQuestaoModal(null)}
            title={
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-heading font-black text-xs flex items-center justify-center">
                  {questaoModal.ordem}
                </span>
                <span className="font-heading font-bold text-lg text-slate-900">
                  Questão {questaoModal.ordem}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    questaoBaseModal?.tipo === 'discursiva'
                      ? 'bg-violet-50 text-violet-800 border-violet-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {questaoBaseModal?.tipo === 'discursiva' ? 'Discursiva' : 'Objetiva'}
                </span>
                {isCriticaModal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    Questão crítica
                  </span>
                )}
              </div>
            }
            description={mapa ? `Atividade: ${mapa.titulo}` : undefined}
            maxWidth="2xl"
          >
            <div className="space-y-6">
              {/* Enunciado Integral */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Enunciado da Questão
                </span>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                  <MathText text={questaoModal.enunciado} />
                </div>
              </div>

              {/* Barra Geral de % de Acerto */}
              <div className="space-y-1.5 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Índice de Acerto (1ª resposta)</span>
                  <span className={`px-2 py-0.5 rounded-md border font-mono font-bold ${textoCorModal}`}>
                    {formatarPercentual(pctModal)} ({questaoModal.total_acertos} de {questaoModal.total_respostas} acertos)
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full ${barraCorModal} transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(0, pctModal))}%` }}
                  />
                </div>
              </div>

              {/* Distribuição Discursiva */}
              {questaoModal.distribuicao_discursiva && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Distribuição das Avaliações Discursivas
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                        <span>Certo (100% dos pontos)</span>
                        <span className="font-mono">{pluralizar(questaoModal.distribuicao_discursiva.certo.total, 'aluno', 'alunos')} ({formatarPercentual(questaoModal.distribuicao_discursiva.certo.porcentagem)})</span>
                      </div>
                      <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${questaoModal.distribuicao_discursiva.certo.porcentagem}%` }} />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                        <span>Parcial (50% dos pontos)</span>
                        <span className="font-mono">{pluralizar(questaoModal.distribuicao_discursiva.parcial.total, 'aluno', 'alunos')} ({formatarPercentual(questaoModal.distribuicao_discursiva.parcial.porcentagem)})</span>
                      </div>
                      <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${questaoModal.distribuicao_discursiva.parcial.porcentagem}%` }} />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                        <span>Errado (0% dos pontos)</span>
                        <span className="font-mono">{pluralizar(questaoModal.distribuicao_discursiva.errado.total, 'aluno', 'alunos')} ({formatarPercentual(questaoModal.distribuicao_discursiva.errado.porcentagem)})</span>
                      </div>
                      <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500" style={{ width: `${questaoModal.distribuicao_discursiva.errado.porcentagem}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Distribuição por Alternativa */}
              {alternativasModal.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Distribuição das escolhas por alternativa
                  </div>

                  <div className="space-y-2.5">
                    {(['A', 'B', 'C', 'D', 'E'] as LetraAlternativa[]).map((letra) => {
                      const dist = questaoModal.distribuicao[letra];
                      const altObj = alternativasModal.find((a) => a.letra === letra);
                      if (!altObj && (!dist || dist.total === 0)) return null;

                      const isCorreta = altObj?.correta ?? false;
                      const porcentagem = dist?.porcentagem ?? 0;
                      const totalVotos = dist?.total ?? 0;

                      return (
                        <div
                          key={letra}
                          className={`p-3.5 rounded-xl border space-y-2 ${
                            isCorreta
                              ? 'border-emerald-300 bg-emerald-50/50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-lg font-heading font-black text-xs flex items-center justify-center shrink-0 ${
                                  isCorreta
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {letra}
                              </span>
                              <span className="font-medium text-slate-800 flex-1">
                                <MathText text={altObj?.texto || '(Sem texto)'} />
                              </span>
                              {isCorreta && (
                                <span className="shrink-0 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Correta
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0 font-semibold text-slate-600 font-mono">
                              {pluralizar(totalVotos, 'aluno', 'alunos')} ({formatarPercentual(porcentagem)})
                            </div>
                          </div>

                          {/* Barra de progresso da alternativa */}
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isCorreta ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, porcentagem))}%` }}
                            />
                          </div>

                          {!isCorreta && altObj?.por_que_errou && (
                            <div className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 leading-relaxed">
                              <strong>Diagnóstico pedagógico:</strong> {altObj.por_que_errou}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Caixa: Pegadinha mais escolhida */}
              {questaoModal.distrator_mais_escolhido && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-heading font-bold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Pegadinha mais escolhida: Letra {questaoModal.distrator_mais_escolhido.letra} (
                      {pluralizar(questaoModal.distrator_mais_escolhido.total_escolhas, 'aluno', 'alunos')})
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed pl-6">
                    {questaoModal.distrator_mais_escolhido.por_que_errou ||
                      'Sem explicação da pegadinha cadastrada pelo professor.'}
                  </p>
                </div>
              )}

              {/* Resposta esperada da discursiva */}
              {questaoBaseModal?.tipo === 'discursiva' && questaoBaseModal.resposta_esperada && (
                <div className="p-3.5 rounded-xl bg-violet-50/80 border border-violet-200 space-y-1 text-xs">
                  <span className="font-bold text-violet-900 uppercase tracking-wider block">
                    Resposta Esperada (Critérios de Correção)
                  </span>
                  <div className="text-violet-950 whitespace-pre-wrap leading-relaxed">
                    <MathText text={questaoBaseModal.resposta_esperada} />
                  </div>
                </div>
              )}

              {/* Dica da questão */}
              {questaoBaseModal?.dica && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1 text-xs text-amber-950">
                  <span className="font-bold uppercase tracking-wider block text-amber-900">
                    Dica oferecida ao aluno
                  </span>
                  <div className="leading-relaxed">
                    <MathText text={questaoBaseModal.dica} />
                  </div>
                </div>
              )}

              {/* Explicação / Comentário do professor */}
              {questaoBaseModal?.explicacao && (
                <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-1 text-xs text-indigo-950">
                  <span className="font-bold uppercase tracking-wider block text-indigo-900">
                    Explicação / Resolução do Professor
                  </span>
                  <div className="leading-relaxed">
                    <MathText text={questaoBaseModal.explicacao} />
                  </div>
                </div>
              )}

              {/* Rodapé de navegação no Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={modalIdx <= 0}
                    onClick={irParaAnterior}
                    leftIcon={<ChevronLeft className="w-4 h-4" />}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-slate-500 font-semibold px-1">
                    {modalIdx + 1} de {questoesExibidas.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={modalIdx < 0 || modalIdx >= questoesExibidas.length - 1}
                    onClick={irParaProxima}
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                  >
                    Próxima
                  </Button>
                </div>

                <Button variant="primary" size="sm" onClick={() => setQuestaoModal(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
};

export default ProfessorResultadosPage;
