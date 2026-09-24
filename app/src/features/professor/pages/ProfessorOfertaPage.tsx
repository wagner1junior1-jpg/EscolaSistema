import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  CardContent,
  Button,
  Tabs,
  Modal,
  ConfirmDialog,
  Input,
  Textarea,
  Select,
  useToast,
} from '@/components/ui';
import {
  professorService,
  gestaoService,
  Atividade,
  OfertaDetalhada,
  Periodo,
  ModoAtividade,
} from '@/services';
import {
  ArrowLeft,
  Plus,
  Key,
  Calendar,
  HelpCircle,
  Clock,
  Edit3,
  Send,
  Archive,
  Copy,
  Trash2,
  Eye,
  AlertCircle,
  Loader2,
  FileQuestion,
  Info,
} from 'lucide-react';

interface AtividadeComQtd extends Atividade {
  total_questoes: number;
}

export const ProfessorOfertaPage: React.FC = () => {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [oferta, setOferta] = useState<OfertaDetalhada | null>(null);
  const [minhasOfertas, setMinhasOfertas] = useState<OfertaDetalhada[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [atividades, setAtividades] = useState<AtividadeComQtd[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Aba ativa: 'rascunho' | 'publicada' | 'encerrada'
  const [abaAtiva, setAbaAtiva] = useState<'rascunho' | 'publicada' | 'encerrada'>('rascunho');

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvandoNova, setSalvandoNova] = useState(false);

  // Formulário Nova Atividade
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoModo, setNovoModo] = useState<ModoAtividade>('exercicio');
  const [novoPeriodoId, setNovoPeriodoId] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [erroValidacaoNova, setErroValidacaoNova] = useState<string | null>(null);

  // Confirmações
  const [atividadePublicar, setAtividadePublicar] = useState<AtividadeComQtd | null>(null);
  const [processandoPublicar, setProcessandoPublicar] = useState(false);

  const [atividadeEncerrar, setAtividadeEncerrar] = useState<AtividadeComQtd | null>(null);
  const [processandoEncerrar, setProcessandoEncerrar] = useState(false);

  const [atividadeExcluir, setAtividadeExcluir] = useState<AtividadeComQtd | null>(null);
  const [processandoExcluir, setProcessandoExcluir] = useState(false);

  const [atividadeDuplicar, setAtividadeDuplicar] = useState<AtividadeComQtd | null>(null);
  const [ofertaDestinoId, setOfertaDestinoId] = useState('');
  const [processandoDuplicar, setProcessandoDuplicar] = useState(false);

  const carregarDados = useCallback(async () => {
    if (!ofertaId) return;

    setCarregando(true);
    setErro(null);
    try {
      // 1. Busca ofertas do professor e valida pertencimento
      const listaOfertas = await professorService.minhasOfertas();
      setMinhasOfertas(listaOfertas);

      const ofertaEncontrada = listaOfertas.find((o) => o.id === ofertaId);
      if (!ofertaEncontrada) {
        throw new Error('Você não tem permissão para esta ação.');
      }
      setOferta(ofertaEncontrada);

      // 2. Busca períodos letivos
      const listaPeriodos = await gestaoService.listarPeriodos();
      setPeriodos(listaPeriodos);
      const ativo = listaPeriodos.find((p) => p.ativo) || listaPeriodos[0];
      if (ativo) {
        setNovoPeriodoId(ativo.id);
      }

      // 3. Busca atividades da oferta
      const listaAtividades = await professorService.listarAtividades(ofertaId);

      // Para cada atividade, obtém número de questões
      const atividadesComQtd: AtividadeComQtd[] = await Promise.all(
        listaAtividades.map(async (ativ) => {
          try {
            const completa = await professorService.obterAtividade(ativ.id);
            return {
              ...ativ,
              total_questoes: completa?.questoes.length ?? 0,
            };
          } catch {
            return {
              ...ativ,
              total_questoes: 0,
            };
          }
        })
      );

      setAtividades(atividadesComQtd);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar atividades da turma.');
    } finally {
      setCarregando(false);
    }
  }, [ofertaId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Formatação de data
  const formatarPrazo = (prazo: string | null) => {
    if (!prazo) return 'Sem prazo';
    try {
      const [ano, mes, dia] = prazo.split('-');
      if (ano && mes && dia) return `Até ${dia}/${mes}/${ano}`;
      return prazo;
    } catch {
      return prazo;
    }
  };

  // Obter nome do período
  const getPeriodoNome = (id: string) => {
    const p = periodos.find((item) => item.id === id);
    return p ? p.nome : 'Período';
  };

  // Filtragem por status
  const rascunhos = atividades.filter((a) => a.status === 'rascunho');
  const publicadas = atividades.filter((a) => a.status === 'publicada');
  const encerradas = atividades.filter((a) => a.status === 'encerrada');

  const atividadesExibidas =
    abaAtiva === 'rascunho'
      ? rascunhos
      : abaAtiva === 'publicada'
      ? publicadas
      : encerradas;

  // Ação: Criar Nova Atividade
  const handleCriarAtividade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertaId) return;

    if (!novoTitulo.trim()) {
      setErroValidacaoNova('O título da atividade é obrigatório.');
      return;
    }
    if (!novaDescricao.trim()) {
      setErroValidacaoNova('A descrição é obrigatória.');
      return;
    }
    if (!novoPeriodoId) {
      setErroValidacaoNova('Selecione o bimestre/período.');
      return;
    }

    setSalvandoNova(true);
    setErroValidacaoNova(null);
    try {
      const nova = await professorService.criarAtividade(ofertaId, {
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim(),
        modo: novoModo,
        periodo_id: novoPeriodoId,
        prazo: novoPrazo ? novoPrazo : null,
      });

      toast.success('Atividade criada como rascunho!');
      setModalNovoAberto(false);
      // Redireciona diretamente para o editor
      navigate(`/professor/atividade/${nova.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar atividade.';
      setErroValidacaoNova(msg);
      toast.error(msg);
    } finally {
      setSalvandoNova(false);
    }
  };

  // Ação: Publicar
  const handleConfirmarPublicar = async () => {
    if (!atividadePublicar) return;
    setProcessandoPublicar(true);
    try {
      await professorService.publicarAtividade(atividadePublicar.id);
      toast.success('Atividade publicada com sucesso!');
      setAtividadePublicar(null);
      await carregarDados();
      setAbaAtiva('publicada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar atividade.');
    } finally {
      setProcessandoPublicar(false);
    }
  };

  // Ação: Encerrar
  const handleConfirmarEncerrar = async () => {
    if (!atividadeEncerrar) return;
    setProcessandoEncerrar(true);
    try {
      await professorService.encerrarAtividade(atividadeEncerrar.id);
      toast.success('Atividade encerrada com sucesso!');
      setAtividadeEncerrar(null);
      await carregarDados();
      setAbaAtiva('encerrada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar atividade.');
    } finally {
      setProcessandoEncerrar(false);
    }
  };

  // Ação: Excluir
  const handleConfirmarExcluir = async () => {
    if (!atividadeExcluir) return;
    setProcessandoExcluir(true);
    try {
      await professorService.excluirAtividade(atividadeExcluir.id);
      toast.success('Atividade excluída com sucesso!');
      setAtividadeExcluir(null);
      await carregarDados();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir atividade.');
    } finally {
      setProcessandoExcluir(false);
    }
  };

  // Ação: Duplicar
  const handleConfirmarDuplicar = async () => {
    if (!atividadeDuplicar || !ofertaDestinoId) return;
    setProcessandoDuplicar(true);
    try {
      await professorService.duplicarAtividade(atividadeDuplicar.id, ofertaDestinoId);
      toast.success('Atividade duplicada como rascunho com sucesso!');
      setAtividadeDuplicar(null);
      if (ofertaDestinoId === ofertaId) {
        await carregarDados();
        setAbaAtiva('rascunho');
      } else {
        toast.info('A cópia foi criada na turma selecionada.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao duplicar atividade.');
    } finally {
      setProcessandoDuplicar(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Navegação e Cabeçalho da Oferta */}
        <div>
          <Link
            to="/professor"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Minhas Turmas</span>
          </Link>

          {oferta && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                    {oferta.disciplina_nome}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span>Código: <strong className="font-mono text-slate-800">{oferta.turma_codigo}</strong></span>
                  </div>
                </div>
                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  {oferta.turma_nome}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Gerencie exercícios formativos e provas com correção automática.
                </p>
              </div>

              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setNovoTitulo('');
                  setNovaDescricao('');
                  setNovoModo('exercicio');
                  setNovoPrazo('');
                  setErroValidacaoNova(null);
                  setModalNovoAberto(true);
                }}
                className="w-full sm:w-auto shrink-0 shadow-sm"
              >
                Nova atividade
              </Button>
            </div>
          )}
        </div>

        {/* Estado de Carregamento */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando atividades da turma...</p>
          </div>
        )}

        {/* Estado de Erro de Permissão ou Carregamento */}
        {!carregando && erro && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-rose-900">
                Acesso não autorizado
              </h3>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{erro}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/professor')}
              className="mx-auto"
            >
              Voltar para Minhas Turmas
            </Button>
          </div>
        )}

        {/* Conteúdo com Abas de Atividades */}
        {!carregando && !erro && (
          <div className="space-y-5">
            <Tabs
              activeTab={abaAtiva}
              onChange={(tab) => setAbaAtiva(tab as 'rascunho' | 'publicada' | 'encerrada')}
              tabs={[
                {
                  id: 'rascunho',
                  label: 'Rascunhos',
                  count: rascunhos.length,
                },
                {
                  id: 'publicada',
                  label: 'Publicadas',
                  count: publicadas.length,
                },
                {
                  id: 'encerrada',
                  label: 'Encerradas',
                  count: encerradas.length,
                },
              ]}
            />

            {/* Listagem de Atividades da Aba Selecionada */}
            {atividadesExibidas.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <FileQuestion className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-heading font-bold text-base text-slate-700">
                  Nenhuma atividade neste status
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                  {abaAtiva === 'rascunho'
                    ? 'Você não possui rascunhos no momento. Crie uma nova atividade para começar.'
                    : abaAtiva === 'publicada'
                    ? 'Nenhuma atividade publicada aberta para os alunos responderem.'
                    : 'Nenhuma atividade encerrada nesta turma.'}
                </p>
                {abaAtiva === 'rascunho' && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setNovoTitulo('');
                      setNovaDescricao('');
                      setNovoModo('exercicio');
                      setNovoPrazo('');
                      setErroValidacaoNova(null);
                      setModalNovoAberto(true);
                    }}
                    className="mt-2"
                  >
                    Criar nova atividade
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {atividadesExibidas.map((ativ) => (
                  <Card
                    key={ativ.id}
                    className="border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs"
                  >
                    <CardContent className="p-5 sm:p-6 space-y-4">
                      {/* Topo do Cartão: Chips de Modo e Bimestre */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {/* Chip do Modo */}
                          {ativ.modo === 'prova' ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                              Prova
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                              Exercício
                            </span>
                          )}

                          {/* Bimestre */}
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {getPeriodoNome(ativ.periodo_id)}
                          </span>
                        </div>

                        {/* Título da Atividade */}
                        <h3 className="font-heading font-black text-lg text-slate-900 leading-snug">
                          {ativ.titulo}
                        </h3>

                        {/* Descrição */}
                        {ativ.descricao && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {ativ.descricao}
                          </p>
                        )}
                      </div>

                      {/* Metadados: Prazo e Nº de Questões */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                          <strong>{ativ.total_questoes}</strong> questão(ões)
                        </span>

                        <span className="flex items-center gap-1 text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatarPrazo(ativ.prazo)}
                        </span>
                      </div>

                      {/* Ações conforme o Status */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        {/* Status Rascunho */}
                        {ativ.status === 'rascunho' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                              onClick={() => navigate(`/professor/atividade/${ativ.id}`)}
                              className="flex-1"
                            >
                              Editar
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Send className="w-3.5 h-3.5 text-emerald-600" />}
                              onClick={() => setAtividadePublicar(ativ)}
                              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
                              title="Publicar atividade para os alunos"
                            >
                              Publicar
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Copy className="w-3.5 h-3.5 text-slate-500" />}
                              onClick={() => {
                                setAtividadeDuplicar(ativ);
                                setOfertaDestinoId(ofertaId || '');
                              }}
                              title="Duplicar atividade"
                            />

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAtividadeExcluir(ativ)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                              title="Excluir rascunho"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}

                        {/* Status Publicada */}
                        {ativ.status === 'publicada' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Edit3 className="w-3.5 h-3.5 text-indigo-600" />}
                              onClick={() => navigate(`/professor/atividade/${ativ.id}`)}
                              className="flex-1"
                            >
                              Editar textos
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Archive className="w-3.5 h-3.5 text-amber-600" />}
                              onClick={() => setAtividadeEncerrar(ativ)}
                              className="text-amber-800 hover:bg-amber-50 border-amber-300"
                            >
                              Encerrar
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Copy className="w-3.5 h-3.5 text-slate-500" />}
                              onClick={() => {
                                setAtividadeDuplicar(ativ);
                                setOfertaDestinoId(ofertaId || '');
                              }}
                              title="Duplicar atividade"
                            />
                          </>
                        )}

                        {/* Status Encerrada */}
                        {ativ.status === 'encerrada' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Eye className="w-3.5 h-3.5 text-slate-600" />}
                              onClick={() => navigate(`/professor/atividade/${ativ.id}`)}
                              className="flex-1"
                            >
                              Ver
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Copy className="w-3.5 h-3.5 text-slate-500" />}
                              onClick={() => {
                                setAtividadeDuplicar(ativ);
                                setOfertaDestinoId(ofertaId || '');
                              }}
                              title="Duplicar atividade"
                            >
                              Duplicar
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Nova Atividade */}
      <Modal
        isOpen={modalNovoAberto}
        onClose={() => !salvandoNova && setModalNovoAberto(false)}
        title="Nova Atividade"
        description="Crie o cabeçalho da atividade e defina suas regras. Você editará as questões a seguir."
        maxWidth="lg"
      >
        <form onSubmit={handleCriarAtividade} className="p-5 sm:p-6 space-y-4">
          {erroValidacaoNova && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{erroValidacaoNova}</span>
            </div>
          )}

          <Input
            label="Título da Atividade *"
            placeholder="Ex: Frações e Decimais — Diagnóstico Inicial"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            disabled={salvandoNova}
            required
          />

          <Textarea
            label="Descrição / Orientações *"
            placeholder="Orientações aos alunos sobre a atividade ou avaliação..."
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
            disabled={salvandoNova}
            rows={3}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-tight">
              Modo da Atividade *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNovoModo('exercicio')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  novoModo === 'exercicio'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="font-heading font-bold text-sm text-slate-900">Exercício</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Feedback e explicação imediatos a cada questão.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNovoModo('prova')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  novoModo === 'prova'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="font-heading font-bold text-sm text-slate-900">Prova</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Avaliação sigilosa; correção liberada só no final.
                </div>
              </button>
            </div>

            {novoModo === 'prova' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 mt-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>o aluno só vê a correção no final após responder todas as questões.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Bimestre / Período Letivo *"
              value={novoPeriodoId}
              onChange={(e) => setNovoPeriodoId(e.target.value)}
              disabled={salvandoNova}
              options={periodos.map((p) => ({
                value: p.id,
                label: `${p.nome} (${p.ano_letivo})${p.ativo ? ' — Ativo' : ''}`,
              }))}
            />

            <Input
              label="Prazo de Entrega (Opcional)"
              type="date"
              value={novoPrazo}
              onChange={(e) => setNovoPrazo(e.target.value)}
              disabled={salvandoNova}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalNovoAberto(false)}
              disabled={salvandoNova}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={salvandoNova}>
              Criar e editar questões
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmação: Publicar Atividade */}
      <ConfirmDialog
        isOpen={!!atividadePublicar}
        onClose={() => !processandoPublicar && setAtividadePublicar(null)}
        onConfirm={handleConfirmarPublicar}
        title="Publicar atividade"
        message="Depois de publicar, só será possível corrigir textos. Os alunos já poderão responder."
        confirmText="Publicar agora"
        cancelText="Voltar"
        variant="primary"
        isLoading={processandoPublicar}
      />

      {/* Confirmação: Encerrar Atividade */}
      <ConfirmDialog
        isOpen={!!atividadeEncerrar}
        onClose={() => !processandoEncerrar && setAtividadeEncerrar(null)}
        onConfirm={handleConfirmarEncerrar}
        title="Encerrar atividade"
        message="Os alunos não poderão mais responder. Na prova, o resultado é liberado para todos."
        confirmText="Encerrar atividade"
        cancelText="Voltar"
        variant="danger"
        isLoading={processandoEncerrar}
      />

      {/* Confirmação: Excluir Rascunho */}
      <ConfirmDialog
        isOpen={!!atividadeExcluir}
        onClose={() => !processandoExcluir && setAtividadeExcluir(null)}
        onConfirm={handleConfirmarExcluir}
        title="Excluir atividade"
        message="Tem certeza que deseja excluir esta atividade em rascunho? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        isLoading={processandoExcluir}
      />

      {/* Modal: Duplicar Atividade */}
      <Modal
        isOpen={!!atividadeDuplicar}
        onClose={() => !processandoDuplicar && setAtividadeDuplicar(null)}
        title="Duplicar Atividade"
        description={`Copiar a atividade "${atividadeDuplicar?.titulo}" como rascunho.`}
        maxWidth="md"
      >
        <div className="p-5 sm:p-6 space-y-4">
          <Select
            label="Escolha a turma de destino *"
            value={ofertaDestinoId}
            onChange={(e) => setOfertaDestinoId(e.target.value)}
            disabled={processandoDuplicar}
            options={minhasOfertas.map((o) => ({
              value: o.id,
              label: `${o.turma_nome} — ${o.disciplina_nome}`,
            }))}
          />

          <p className="text-xs text-slate-500 leading-relaxed">
            Uma nova atividade idêntica será criada com o sufixo <em>(Cópia)</em> no status <strong>Rascunho</strong>, permitindo nova edição e publicação independente.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAtividadeDuplicar(null)}
              disabled={processandoDuplicar}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmarDuplicar}
              isLoading={processandoDuplicar}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              Duplicar atividade
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
};

export default ProfessorOfertaPage;
