import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  CardHeader,
  CardTitle,
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
  bancoService,
  assinarMudancas,
  Atividade,
  OfertaDetalhada,
  Periodo,
  ModoAtividade,
  RelatorioDesempenhoOferta,
  Aviso,
  PrioridadeAviso,
  BancoQuestao,
  Assunto,
  CombinacaoProfessor,
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
  BarChart2,
  MessageSquare,
  ClipboardList,
  Filter,
  Database,
  Search,
  Sparkles,
  Check,
} from 'lucide-react';
import { ModalGeradorIA } from '../components/ModalGeradorIA';

interface AtividadeComQtd extends Atividade {
  total_questoes: number;
}

export const ProfessorOfertaPage: React.FC = () => {
  const { ofertaId } = useParams<{ ofertaId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  // Aba principal vinda da URL: 'atividades' | 'desempenho' | 'recados'
  const abaPrincipal = (searchParams.get('aba') as 'atividades' | 'desempenho' | 'recados') || 'atividades';

  const [oferta, setOferta] = useState<OfertaDetalhada | null>(null);
  const [minhasOfertas, setMinhasOfertas] = useState<OfertaDetalhada[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [atividades, setAtividades] = useState<AtividadeComQtd[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Sub-aba de Atividades: 'rascunho' | 'publicada' | 'encerrada'
  const [abaAtividades, setAbaAtividades] = useState<'rascunho' | 'publicada' | 'encerrada'>('rascunho');

  // Estado da Aba Desempenho
  const [relatorioDesempenho, setRelatorioDesempenho] = useState<RelatorioDesempenhoOferta | null>(null);
  const [carregandoDesempenho, setCarregandoDesempenho] = useState(false);
  const [filtroSoAtencao, setFiltroSoAtencao] = useState(false);

  // Estado da Aba Recados
  const [recados, setRecados] = useState<Aviso[]>([]);
  const [carregandoRecados, setCarregandoRecados] = useState(false);
  const [novoRecadoTitulo, setNovoRecadoTitulo] = useState('');
  const [novoRecadoMensagem, setNovoRecadoMensagem] = useState('');
  const [novoRecadoPrioridade, setNovoRecadoPrioridade] = useState<PrioridadeAviso>('media');
  const [enviandoRecado, setEnviandoRecado] = useState(false);

  // Modais de Criação e Ação em Atividades
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoModo, setNovoModo] = useState<ModoAtividade>('exercicio');
  const [novoPeriodoId, setNovoPeriodoId] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [erroValidacaoNova, setErroValidacaoNova] = useState<string | null>(null);

  // Modal Criar Atividade a partir do Banco
  const [modalBancoAtividadeAberto, setModalBancoAtividadeAberto] = useState(false);
  const [questoesBanco, setQuestoesBanco] = useState<BancoQuestao[]>([]);
  const [assuntosOferta, setAssuntosOferta] = useState<Assunto[]>([]);
  const [combinacoesProfessor, setCombinacoesProfessor] = useState<CombinacaoProfessor[]>([]);
  const [carregandoQuestoesBanco, setCarregandoQuestoesBanco] = useState(false);
  const [bancoSelecionadas, setBancoSelecionadas] = useState<string[]>([]);
  const [buscaQuestoesBanco, setBuscaQuestoesBanco] = useState('');
  const [filtroDificuldadeBanco, setFiltroDificuldadeBanco] = useState<string>('todos');
  const [filtroAssuntoBanco, setFiltroAssuntoBanco] = useState<string>('todos');
  const [filtroTipoBanco, setFiltroTipoBanco] = useState<string>('todos');
  const [questoesPrevisualizadas, setQuestoesPrevisualizadas] = useState<Set<string>>(new Set());
  const [modalGeradorIAAberto, setModalGeradorIAAberto] = useState(false);
  const [salvandoAtividadeBanco, setSalvandoAtividadeBanco] = useState(false);
  const [novoBancoTitulo, setNovoBancoTitulo] = useState('');
  const [novoBancoDescricao, setNovoBancoDescricao] = useState('');
  const [novoBancoModo, setNovoBancoModo] = useState<ModoAtividade>('exercicio');
  const [novoBancoPeriodoId, setNovoBancoPeriodoId] = useState('');
  const [novoBancoPrazo, setNovoBancoPrazo] = useState('');
  const [erroValidacaoBanco, setErroValidacaoBanco] = useState<string | null>(null);

  const [atividadePublicar, setAtividadePublicar] = useState<AtividadeComQtd | null>(null);
  const [processandoPublicar, setProcessandoPublicar] = useState(false);

  const [atividadeEncerrar, setAtividadeEncerrar] = useState<AtividadeComQtd | null>(null);
  const [processandoEncerrar, setProcessandoEncerrar] = useState(false);

  const [atividadeExcluir, setAtividadeExcluir] = useState<AtividadeComQtd | null>(null);
  const [processandoExcluir, setProcessandoExcluir] = useState(false);

  const [atividadeDuplicar, setAtividadeDuplicar] = useState<AtividadeComQtd | null>(null);
  const [ofertaDestinoId, setOfertaDestinoId] = useState('');
  const [processandoDuplicar, setProcessandoDuplicar] = useState(false);

  // Carregamento inicial da oferta e períodos
  const carregarDadosBase = useCallback(async () => {
    if (!ofertaId) return;

    setCarregando(true);
    setErro(null);
    try {
      const listaOfertas = await professorService.minhasOfertas();
      setMinhasOfertas(listaOfertas);

      const ofertaEncontrada = listaOfertas.find((o) => o.id === ofertaId);
      if (!ofertaEncontrada) {
        throw new Error('Você não tem permissão para esta ação.');
      }
      setOferta(ofertaEncontrada);

      const listaPeriodos = await gestaoService.listarPeriodos();
      setPeriodos(listaPeriodos);
      const ativo = listaPeriodos.find((p) => p.ativo) || listaPeriodos[0];
      if (ativo) {
        setNovoPeriodoId(ativo.id);
        setPeriodoSelecionadoId(ativo.id);
      }

      // Busca atividades da oferta
      const listaAtividades = await professorService.listarAtividades(ofertaId);
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
      setErro(err instanceof Error ? err.message : 'Falha ao carregar dados da turma.');
    } finally {
      setCarregando(false);
    }
  }, [ofertaId]);

  useEffect(() => {
    carregarDadosBase();
    const desassinar = assinarMudancas(() => {
      carregarDadosBase();
    });
    return () => {
      desassinar();
    };
  }, [carregarDadosBase]);

  // Carregamento de Desempenho
  const carregarDesempenho = useCallback(async (periodoIdParam: string) => {
    if (!ofertaId || !periodoIdParam) return;
    setCarregandoDesempenho(true);
    try {
      const dados = await professorService.desempenhoOferta(ofertaId, periodoIdParam);
      setRelatorioDesempenho(dados);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar desempenho.');
    } finally {
      setCarregandoDesempenho(false);
    }
  }, [ofertaId, toast]);

  useEffect(() => {
    if (abaPrincipal === 'desempenho' && periodoSelecionadoId) {
      carregarDesempenho(periodoSelecionadoId);
    }
  }, [abaPrincipal, periodoSelecionadoId, carregarDesempenho]);

  // Carregamento de Recados
  const carregarRecados = useCallback(async () => {
    if (!oferta?.turma_id) return;
    setCarregandoRecados(true);
    try {
      const lista = await professorService.listarRecadosTurma(oferta.turma_id);
      // Mais recente primeiro
      const ordenados = [...lista].sort(
        (a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime()
      );
      setRecados(ordenados);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar recados.');
    } finally {
      setCarregandoRecados(false);
    }
  }, [oferta?.turma_id, toast]);

  useEffect(() => {
    if (abaPrincipal === 'recados' && oferta?.turma_id) {
      carregarRecados();
    }
  }, [abaPrincipal, oferta?.turma_id, carregarRecados]);

  // Troca de aba superior (grava na URL ?aba=)
  const mudarAbaPrincipal = (novaAba: 'atividades' | 'desempenho' | 'recados') => {
    setSearchParams({ aba: novaAba });
  };

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

  const formatarDataHora = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getPeriodoNome = (id: string) => {
    const p = periodos.find((item) => item.id === id);
    return p ? p.nome : 'Período';
  };

  // Filtragem de atividades por status
  const rascunhos = atividades.filter((a) => a.status === 'rascunho');
  const publicadas = atividades.filter((a) => a.status === 'publicada');
  const encerradas = atividades.filter((a) => a.status === 'encerrada');

  const atividadesExibidas =
    abaAtividades === 'rascunho'
      ? rascunhos
      : abaAtividades === 'publicada'
      ? publicadas
      : encerradas;

  // Ações da Aba Atividades
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
      navigate(`/professor/atividade/${nova.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar atividade.';
      setErroValidacaoNova(msg);
      toast.error(msg);
    } finally {
      setSalvandoNova(false);
    }
  };

  const carregarDadosBancoDaOferta = useCallback(async () => {
    if (!oferta) return;
    setCarregandoQuestoesBanco(true);
    try {
      const [lista, listaAssuntos, listaCombs] = await Promise.all([
        bancoService.listarBanco({
          disciplina_id: oferta.disciplina_id,
          serie: oferta.turma_serie || '',
        }),
        bancoService.listarAssuntos(oferta.disciplina_id),
        bancoService.listarCombinacoesDoProfessor(),
      ]);
      setQuestoesBanco(lista.filter((q) => !q.arquivada));
      setAssuntosOferta(listaAssuntos);
      setCombinacoesProfessor(listaCombs);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao listar questões do banco.');
    } finally {
      setCarregandoQuestoesBanco(false);
    }
  }, [oferta, toast]);

  const handleAbrirModalBancoAtividade = async () => {
    if (!oferta) return;
    setNovoBancoTitulo(`Lista de Exercícios — ${oferta.disciplina_nome}`);
    setNovoBancoDescricao(`Atividade com questões selecionadas do Banco de Questões de ${oferta.disciplina_nome}.`);
    setNovoBancoModo('exercicio');
    setNovoBancoPeriodoId(periodoSelecionadoId || periodos[0]?.id || '');
    setNovoBancoPrazo('');
    setBancoSelecionadas([]);
    setBuscaQuestoesBanco('');
    setFiltroDificuldadeBanco('todos');
    setFiltroAssuntoBanco('todos');
    setFiltroTipoBanco('todos');
    setQuestoesPrevisualizadas(new Set());
    setErroValidacaoBanco(null);
    setModalBancoAtividadeAberto(true);
    await carregarDadosBancoDaOferta();
  };

  const handleAbrirGeradorIAOferta = async () => {
    if (!oferta) return;
    await carregarDadosBancoDaOferta();
    setModalGeradorIAAberto(true);
  };

  const togglePrevisualizarQuestao = (qId: string) => {
    setQuestoesPrevisualizadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(qId)) novo.delete(qId);
      else novo.add(qId);
      return novo;
    });
  };

  const handleCriarAtividadeDoBanco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertaId) return;

    if (!novoBancoTitulo.trim()) {
      setErroValidacaoBanco('O título da atividade é obrigatório.');
      return;
    }
    if (!novoBancoDescricao.trim()) {
      setErroValidacaoBanco('A descrição é obrigatória.');
      return;
    }
    if (!novoBancoPeriodoId) {
      setErroValidacaoBanco('Selecione o bimestre/período.');
      return;
    }
    if (bancoSelecionadas.length === 0) {
      setErroValidacaoBanco('Selecione ao menos 1 questão do banco de questões.');
      return;
    }

    setSalvandoAtividadeBanco(true);
    setErroValidacaoBanco(null);

    try {
      const nova = await professorService.criarAtividade(ofertaId, {
        titulo: novoBancoTitulo.trim(),
        descricao: novoBancoDescricao.trim(),
        modo: novoBancoModo,
        periodo_id: novoBancoPeriodoId,
        prazo: novoBancoPrazo ? novoBancoPrazo : null,
      });

      await bancoService.adicionarDoBanco(nova.id, bancoSelecionadas);

      toast.success(`Atividade criada com ${bancoSelecionadas.length} questão(ões) do banco!`);
      setModalBancoAtividadeAberto(false);
      navigate(`/professor/atividade/${nova.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar atividade do banco.';
      setErroValidacaoBanco(msg);
      toast.error(msg);
    } finally {
      setSalvandoAtividadeBanco(false);
    }
  };

  const questoesBancoFiltradas = questoesBanco.filter((q) => {
    if (filtroAssuntoBanco !== 'todos' && q.assunto_id !== filtroAssuntoBanco) {
      return false;
    }
    if (filtroTipoBanco !== 'todos' && q.tipo !== filtroTipoBanco) {
      return false;
    }
    if (filtroDificuldadeBanco !== 'todos' && q.dificuldade !== filtroDificuldadeBanco) {
      return false;
    }
    if (buscaQuestoesBanco.trim()) {
      const termo = buscaQuestoesBanco.toLowerCase();
      const matchEnunciado = q.enunciado.toLowerCase().includes(termo);
      const matchAlternativas = (q.alternativas || []).some((a) =>
        a.texto.toLowerCase().includes(termo)
      );
      if (!matchEnunciado && !matchAlternativas) return false;
    }
    return true;
  });

  const toggleSelecionarQuestaoBanco = (qId: string) => {
    setBancoSelecionadas((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const toggleSelecionarTodasVisiveisBanco = () => {
    const idsVisiveis = questoesBancoFiltradas.map((q) => q.id);
    const todosJaSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => bancoSelecionadas.includes(id));
    if (todosJaSelecionados) {
      setBancoSelecionadas((prev) => prev.filter((id) => !idsVisiveis.includes(id)));
    } else {
      setBancoSelecionadas((prev) => Array.from(new Set([...prev, ...idsVisiveis])));
    }
  };

  const handleConfirmarPublicar = async () => {
    if (!atividadePublicar) return;
    setProcessandoPublicar(true);
    try {
      await professorService.publicarAtividade(atividadePublicar.id);
      toast.success('Atividade publicada com sucesso!');
      setAtividadePublicar(null);
      await carregarDadosBase();
      setAbaAtividades('publicada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar atividade.');
    } finally {
      setProcessandoPublicar(false);
    }
  };

  const handleConfirmarEncerrar = async () => {
    if (!atividadeEncerrar) return;
    setProcessandoEncerrar(true);
    try {
      await professorService.encerrarAtividade(atividadeEncerrar.id);
      toast.success('Atividade encerrada com sucesso!');
      setAtividadeEncerrar(null);
      await carregarDadosBase();
      setAbaAtividades('encerrada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar atividade.');
    } finally {
      setProcessandoEncerrar(false);
    }
  };

  const handleConfirmarExcluir = async () => {
    if (!atividadeExcluir) return;
    setProcessandoExcluir(true);
    try {
      await professorService.excluirAtividade(atividadeExcluir.id);
      toast.success('Atividade excluída com sucesso!');
      setAtividadeExcluir(null);
      await carregarDadosBase();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir atividade.');
    } finally {
      setProcessandoExcluir(false);
    }
  };

  const handleConfirmarDuplicar = async () => {
    if (!atividadeDuplicar || !ofertaDestinoId) return;
    setProcessandoDuplicar(true);
    try {
      await professorService.duplicarAtividade(atividadeDuplicar.id, ofertaDestinoId);
      toast.success('Atividade duplicada como rascunho com sucesso!');
      setAtividadeDuplicar(null);
      if (ofertaDestinoId === ofertaId) {
        await carregarDadosBase();
        setAbaAtividades('rascunho');
      } else {
        toast.info('A cópia foi criada na turma selecionada.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao duplicar atividade.');
    } finally {
      setProcessandoDuplicar(false);
    }
  };

  // Ação de Publicar Novo Recado
  const handleCriarRecado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertaId) return;

    if (!novoRecadoTitulo.trim()) {
      toast.error('O título do recado é obrigatório.');
      return;
    }
    if (!novoRecadoMensagem.trim()) {
      toast.error('A mensagem do recado é obrigatória.');
      return;
    }

    setEnviandoRecado(true);
    try {
      await professorService.criarRecadoTurma(ofertaId, {
        titulo: novoRecadoTitulo.trim(),
        mensagem: novoRecadoMensagem.trim(),
        prioridade: novoRecadoPrioridade,
      });

      toast.success('Recado publicado para a turma!');
      setNovoRecadoTitulo('');
      setNovoRecadoMensagem('');
      setNovoRecadoPrioridade('media');
      await carregarRecados();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao publicar recado.');
    } finally {
      setEnviandoRecado(false);
    }
  };

  // Filtra alunos em atenção para a aba Desempenho
  const alunosDesempenho = relatorioDesempenho?.alunos
    ? filtroSoAtencao
      ? relatorioDesempenho.alunos.filter((a) => a.faixa === 'Atenção')
      : relatorioDesempenho.alunos
    : [];

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
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
                    <span>
                      Código:{' '}
                      <strong className="font-mono text-slate-800">{oferta.turma_codigo}</strong>
                    </span>
                  </div>
                </div>
                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  {oferta.turma_nome}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Gerencie exercícios formativos, avaliações, desempenho e avisos da turma.
                </p>
              </div>

              {abaPrincipal === 'atividades' && (
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    leftIcon={<Sparkles className="w-4 h-4 text-amber-600" />}
                    onClick={handleAbrirGeradorIAOferta}
                    className="w-full sm:w-auto shrink-0 shadow-sm"
                  >
                    Gerar com IA
                  </Button>
                  <Button
                    variant="outline"
                    leftIcon={<Database className="w-4 h-4 text-indigo-600" />}
                    onClick={handleAbrirModalBancoAtividade}
                    className="w-full sm:w-auto shrink-0 shadow-sm"
                  >
                    Criar a partir do Banco
                  </Button>
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
          )}
        </div>

        {/* Abas Superiores Principais: Atividades | Desempenho | Recados */}
        <div className="border-b border-slate-200 bg-white rounded-2xl px-4 pt-2 shadow-2xs">
          <Tabs
            activeTab={abaPrincipal}
            onChange={(tab) => mudarAbaPrincipal(tab as 'atividades' | 'desempenho' | 'recados')}
            tabs={[
              {
                id: 'atividades',
                label: 'Atividades',
                icon: <ClipboardList className="w-4 h-4" />,
                count: atividades.length,
              },
              {
                id: 'desempenho',
                label: 'Desempenho',
                icon: <BarChart2 className="w-4 h-4" />,
              },
              {
                id: 'recados',
                label: 'Recados',
                icon: <MessageSquare className="w-4 h-4" />,
                count: recados.length > 0 ? recados.length : undefined,
              },
            ]}
          />
        </div>

        {/* Estado de Carregamento Base */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando dados da turma...</p>
          </div>
        )}

        {/* Estado de Erro de Permissão */}
        {!carregando && erro && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-rose-900">
                Acesso não autorizado
              </h3>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{erro}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/professor')} className="mx-auto">
              Voltar para Minhas Turmas
            </Button>
          </div>
        )}

        {/* =========================================================================
            ABA 1: ATIVIDADES
           ========================================================================= */}
        {!carregando && !erro && abaPrincipal === 'atividades' && (
          <div className="space-y-5">
            <Tabs
              activeTab={abaAtividades}
              onChange={(tab) => setAbaAtividades(tab as 'rascunho' | 'publicada' | 'encerrada')}
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

            {atividadesExibidas.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <FileQuestion className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-heading font-bold text-base text-slate-700">
                  Nenhuma atividade neste status
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                  {abaAtividades === 'rascunho'
                    ? 'Você não possui rascunhos no momento. Crie uma nova atividade para começar.'
                    : abaAtividades === 'publicada'
                    ? 'Nenhuma atividade publicada aberta para os alunos responderem.'
                    : 'Nenhuma atividade encerrada nesta turma.'}
                </p>
                {abaAtividades === 'rascunho' && (
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
                          {ativ.modo === 'prova' ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                              Prova
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                              Exercício
                            </span>
                          )}

                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {getPeriodoNome(ativ.periodo_id)}
                          </span>
                        </div>

                        <h3 className="font-heading font-black text-lg text-slate-900 leading-snug">
                          {ativ.titulo}
                        </h3>

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

                        {ativ.status === 'publicada' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<BarChart2 className="w-3.5 h-3.5 text-indigo-600" />}
                              onClick={() => navigate(`/professor/atividade/${ativ.id}/resultados`)}
                              className="text-indigo-700 bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100/60"
                            >
                              Ver resultados
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              leftIcon={<Edit3 className="w-3.5 h-3.5 text-slate-600" />}
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

                        {ativ.status === 'encerrada' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<BarChart2 className="w-3.5 h-3.5" />}
                              onClick={() => navigate(`/professor/atividade/${ativ.id}/resultados`)}
                            >
                              Ver resultados
                            </Button>

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

        {/* =========================================================================
            ABA 2: DESEMPENHO
           ========================================================================= */}
        {!carregando && !erro && abaPrincipal === 'desempenho' && (
          <div className="space-y-6">
            {/* Filtros: Bimestre e "Só Alunos em Atenção" */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="w-full sm:w-72">
                <Select
                  label="Bimestre / Período Letivo:"
                  value={periodoSelecionadoId}
                  onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
                  options={periodos.map((p) => ({
                    value: p.id,
                    label: `${p.nome} (${p.ano_letivo})${p.ativo ? ' — Ativo' : ''}`,
                  }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-4">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filtroSoAtencao}
                    onChange={(e) => setFiltroSoAtencao(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mostrar só alunos em Atenção</span>
                </label>
              </div>
            </div>

            {/* Estado de Carregamento do Desempenho */}
            {carregandoDesempenho && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-medium">Carregando quadro de desempenho...</p>
              </div>
            )}

            {/* Tabela de Desempenho Aluno × Atividade */}
            {!carregandoDesempenho && relatorioDesempenho && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-black text-lg text-slate-900">
                      Quadro Geral de Desempenho
                    </h3>
                    <p className="text-xs text-slate-500">
                      {relatorioDesempenho.periodo_nome} • {alunosDesempenho.length}{' '}
                      {alunosDesempenho.length === 1 ? 'aluno listado' : 'alunos listados'}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto relative">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-heading font-bold text-slate-600">
                        {/* Coluna Fixa do Nome do Aluno */}
                        <th className="py-3 px-4 sticky left-0 bg-slate-50 z-20 shadow-xs whitespace-nowrap min-w-[180px]">
                          Aluno
                        </th>

                        {/* Colunas das Atividades */}
                        {relatorioDesempenho.atividades.map((ativ) => (
                          <th
                            key={ativ.id}
                            className="py-3 px-3 text-center min-w-[120px] max-w-[160px] truncate whitespace-nowrap"
                            title={ativ.titulo}
                          >
                            <span className="block truncate">{ativ.titulo}</span>
                            <span className="text-[10px] font-normal text-slate-400 block uppercase">
                              {ativ.modo}
                            </span>
                          </th>
                        ))}

                        {/* Colunas Finais: Média e Faixa */}
                        <th className="py-3 px-4 text-center min-w-[90px] whitespace-nowrap">
                          Média
                        </th>
                        <th className="py-3 px-4 text-center min-w-[120px] whitespace-nowrap">
                          Faixa
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {alunosDesempenho.length === 0 ? (
                        <tr>
                          <td
                            colSpan={relatorioDesempenho.atividades.length + 3}
                            className="py-10 text-center text-slate-400 text-xs sm:text-sm"
                          >
                            Nenhum aluno encontrado com os filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        alunosDesempenho.map((aluno) => (
                          <tr
                            key={aluno.aluno_id}
                            className="hover:bg-slate-50/70 transition-colors group"
                          >
                            {/* Nome com Coluna Fixa no Mobile */}
                            <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-xs whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/professor/oferta/${ofertaId}/aluno/${aluno.aluno_id}`)
                                }
                                className="flex items-center gap-2 text-left font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                title="Abrir ficha pedagógica individual"
                              >
                                <span className="font-mono text-xs text-slate-400">
                                  #{aluno.numero_chamada}
                                </span>
                                <span>{aluno.nome_completo}</span>
                              </button>
                            </td>

                            {/* Células das Atividades */}
                            {relatorioDesempenho.atividades.map((colAtiv) => {
                              const dadoAtiv = aluno.atividades.find(
                                (a) => a.atividade_id === colAtiv.id
                              );
                              const ativOriginal = atividades.find(
                                (a) => a.id === colAtiv.id
                              );
                              const isAtivEncerrada = ativOriginal?.status === 'encerrada';

                              return (
                                <td
                                  key={colAtiv.id}
                                  className="py-3 px-3 text-center whitespace-nowrap text-xs"
                                >
                                  {!dadoAtiv || dadoAtiv.aproveitamento === null ? (
                                    <span className="text-slate-300 font-mono">—</span>
                                  ) : !dadoAtiv.concluida ? (
                                    isAtivEncerrada ? (
                                      <span className="font-mono font-medium text-slate-700">
                                        {String(dadoAtiv.aproveitamento).replace('.', ',')}% (incompleta)
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                        em andamento
                                      </span>
                                    )
                                  ) : (
                                    <span className="font-mono font-bold text-slate-700">
                                      {String(dadoAtiv.aproveitamento).replace('.', ',')}%
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Coluna Média */}
                            <td className="py-3 px-4 text-center whitespace-nowrap font-mono font-bold text-xs sm:text-sm text-slate-900">
                              {aluno.media !== null ? `${aluno.media}%` : '—'}
                            </td>

                            {/* Coluna Faixa */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                  aluno.faixa === 'Ótimo'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : aluno.faixa === 'Bom'
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : aluno.faixa === 'Atenção'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {aluno.faixa}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            ABA 3: RECADOS DA TURMA
           ========================================================================= */}
        {!carregando && !erro && abaPrincipal === 'recados' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário: Novo Recado */}
            <div className="lg:col-span-1">
              <Card className="border-slate-200 shadow-xs sticky top-20">
                <CardHeader>
                  <CardTitle className="text-base">Publicar Novo Recado</CardTitle>
                  <p className="text-xs text-slate-500">
                    O recado será exibido no painel de todos os alunos desta turma.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCriarRecado} className="space-y-4">
                    <Input
                      label="Título do Recado *"
                      placeholder="Ex: Trazer transferidor amanhã"
                      value={novoRecadoTitulo}
                      onChange={(e) => setNovoRecadoTitulo(e.target.value)}
                      disabled={enviandoRecado}
                      required
                    />

                    <Textarea
                      label="Mensagem *"
                      placeholder="Digite o conteúdo detalhado do aviso aos alunos..."
                      value={novoRecadoMensagem}
                      onChange={(e) => setNovoRecadoMensagem(e.target.value)}
                      disabled={enviandoRecado}
                      rows={3}
                      required
                    />

                    <Select
                      label="Prioridade do Recado *"
                      value={novoRecadoPrioridade}
                      onChange={(e) => setNovoRecadoPrioridade(e.target.value as PrioridadeAviso)}
                      disabled={enviandoRecado}
                      options={[
                        { value: 'baixa', label: 'Baixa prioridade (Informativo)' },
                        { value: 'media', label: 'Média prioridade (Aviso normal)' },
                        { value: 'alta', label: 'Alta prioridade (Urgente / Importante)' },
                      ]}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      isLoading={enviandoRecado}
                      leftIcon={<Send className="w-4 h-4" />}
                    >
                      Publicar recado
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Recados da Turma */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-black text-lg text-slate-900">
                  Recados Publicados ({recados.length})
                </h3>
              </div>

              {carregandoRecados && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium">Carregando recados da turma...</p>
                </div>
              )}

              {!carregandoRecados && recados.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-heading font-bold text-base text-slate-700">
                    Nenhum recado publicado
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                    Utilize o formulário ao lado para enviar o primeiro comunicado para a turma.
                  </p>
                </div>
              )}

              {!carregandoRecados &&
                recados.map((recado) => {
                  const corPrioridade =
                    recado.prioridade === 'alta'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : recado.prioridade === 'media'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <Card key={recado.id} className="border-slate-200 shadow-xs">
                      <CardContent className="p-5 sm:p-6 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${corPrioridade}`}
                          >
                            Prioridade {recado.prioridade.toUpperCase()}
                          </span>

                          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatarDataHora(recado.publicado_em)}
                          </span>
                        </div>

                        <h4 className="font-heading font-bold text-base text-slate-900 leading-snug">
                          {recado.titulo}
                        </h4>

                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {recado.mensagem}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
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

      {/* Modal: Criar Atividade a partir do Banco */}
      <Modal
        isOpen={modalBancoAtividadeAberto}
        onClose={() => !salvandoAtividadeBanco && setModalBancoAtividadeAberto(false)}
        title="Criar a partir do Banco de Questões"
        description={`Selecione questões do banco de ${oferta?.disciplina_nome || 'disciplina'} (${oferta?.turma_serie || ''}) para criar uma nova atividade.`}
        maxWidth="2xl"
      >
        <form onSubmit={handleCriarAtividadeDoBanco} className="p-5 sm:p-6 space-y-5">
          {erroValidacaoBanco && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{erroValidacaoBanco}</span>
            </div>
          )}

          {/* Dados Gerais da Atividade */}
          <div className="space-y-4">
            <Input
              label="Título da Atividade *"
              placeholder="Ex: Revisão Bimestral de Geometria"
              value={novoBancoTitulo}
              onChange={(e) => setNovoBancoTitulo(e.target.value)}
              disabled={salvandoAtividadeBanco}
              required
            />

            <Textarea
              label="Descrição / Orientações *"
              placeholder="Orientações aos alunos sobre a atividade..."
              value={novoBancoDescricao}
              onChange={(e) => setNovoBancoDescricao(e.target.value)}
              disabled={salvandoAtividadeBanco}
              rows={2}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Bimestre / Período Letivo *"
                value={novoBancoPeriodoId}
                onChange={(e) => setNovoBancoPeriodoId(e.target.value)}
                disabled={salvandoAtividadeBanco}
                options={periodos.map((p) => ({
                  value: p.id,
                  label: `${p.nome} (${p.ano_letivo})${p.ativo ? ' — Ativo' : ''}`,
                }))}
              />

              <Input
                label="Prazo de Entrega (Opcional)"
                type="date"
                value={novoBancoPrazo}
                onChange={(e) => setNovoBancoPrazo(e.target.value)}
                disabled={salvandoAtividadeBanco}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 tracking-tight">
                Modo da Atividade *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNovoBancoModo('exercicio')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    novoBancoModo === 'exercicio'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-heading font-bold text-sm text-slate-900">Exercício</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Feedback e explicação imediatos.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNovoBancoModo('prova')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    novoBancoModo === 'prova'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-heading font-bold text-sm text-slate-900">Prova</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Correção liberada apenas no final.
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Seleção de Questões do Banco */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-heading font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Escolha as Questões do Banco</span>
                </h4>
                <p className="text-xs text-slate-500">
                  {questoesBancoFiltradas.length} questão(ões) disponível(is)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalGeradorIAAberto(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Gerar novas com IA</span>
                </button>

                {questoesBancoFiltradas.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelecionarTodasVisiveisBanco}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    {questoesBancoFiltradas.every((q) => bancoSelecionadas.includes(q.id))
                      ? 'Desmarcar todas visíveis'
                      : 'Marcar todas visíveis'}
                  </button>
                )}
              </div>
            </div>

            {/* Filtros da busca (Busca, Assunto, Tipo, Dificuldade) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                placeholder="Buscar por texto no enunciado..."
                value={buscaQuestoesBanco}
                onChange={(e) => setBuscaQuestoesBanco(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
              <Select
                aria-label="Filtrar por assunto no modal"
                value={filtroAssuntoBanco}
                onChange={(e) => setFiltroAssuntoBanco(e.target.value)}
                options={[
                  { value: 'todos', label: 'Todos os assuntos' },
                  ...assuntosOferta.map((a) => ({ value: a.id, label: a.nome })),
                ]}
              />
              <Select
                aria-label="Filtrar por tipo no modal"
                value={filtroTipoBanco}
                onChange={(e) => setFiltroTipoBanco(e.target.value)}
                options={[
                  { value: 'todos', label: 'Todos os tipos (Obj. e Subj.)' },
                  { value: 'objetiva', label: 'Apenas Objetivas' },
                  { value: 'discursiva', label: 'Apenas Subjetivas / Discursivas' },
                ]}
              />
              <Select
                aria-label="Filtrar por dificuldade no modal"
                value={filtroDificuldadeBanco}
                onChange={(e) => setFiltroDificuldadeBanco(e.target.value)}
                options={[
                  { value: 'todos', label: 'Todas as dificuldades' },
                  { value: 'facil', label: 'Fácil' },
                  { value: 'medio', label: 'Médio' },
                  { value: 'dificil', label: 'Difícil' },
                ]}
              />
            </div>

            {/* Lista de Questões */}
            {carregandoQuestoesBanco ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs font-medium">Carregando questões do banco...</p>
              </div>
            ) : questoesBancoFiltradas.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                Nenhuma questão encontrada no banco para esta matéria e filtros.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-xl p-1">
                {questoesBancoFiltradas.map((bq, idx) => {
                  const isChecked = bancoSelecionadas.includes(bq.id);
                  const isPreview = questoesPrevisualizadas.has(bq.id);
                  const corDificuldade =
                    bq.dificuldade === 'facil'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : bq.dificuldade === 'medio'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200';

                  return (
                    <div
                      key={bq.id}
                      onClick={() => togglePrevisualizarQuestao(bq.id)}
                      className={`py-2.5 px-3 rounded-xl border text-left cursor-pointer transition-all space-y-2 ${
                        isChecked
                          ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Linha única compacta da pergunta — clica na linha para abrir */}
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelecionarQuestaoBanco(bq.id)}
                          aria-label={`Selecionar questão ${idx + 1}`}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0 cursor-pointer"
                        />

                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${corDificuldade}`}
                        >
                          {bq.dificuldade}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${
                            bq.tipo === 'discursiva'
                              ? 'bg-violet-50 text-violet-800 border-violet-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {bq.tipo === 'discursiva' ? 'Subjetiva' : 'Objetiva'}
                        </span>

                        {/* APENAS 1 LINHA DA PERGUNTA */}
                        <span
                          className="text-xs font-medium text-slate-800 truncate flex-1 min-w-0"
                          title={bq.enunciado}
                        >
                          {bq.enunciado}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePrevisualizarQuestao(bq.id);
                          }}
                          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                          title="Abrir pergunta e gabarito"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isPreview ? 'Ocultar gabarito' : 'Ver gabarito'}</span>
                        </button>
                      </div>

                      {/* Caixa Expandida ao Clicar na Linha: Enunciado Completo + Alternativas / Gabarito */}
                      {isPreview && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="ml-6 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs cursor-default"
                        >
                          <div className="text-xs font-medium text-slate-800 whitespace-pre-wrap pb-1.5 border-b border-slate-200/80">
                            {bq.enunciado}
                          </div>
                          {bq.tipo === 'discursiva' ? (
                            <div className="space-y-1">
                              <span className="font-bold text-violet-800 block">
                                Resposta Esperada (Gabarito):
                              </span>
                              <p className="text-slate-700 whitespace-pre-wrap">
                                {bq.resposta_esperada || 'Critérios abertos de correção pelo professor.'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <span className="font-bold text-slate-700 block">
                                Alternativas e Gabarito:
                              </span>
                              {(bq.alternativas || []).map((alt) => (
                                <div
                                  key={alt.id || alt.letra}
                                  className={`p-1.5 rounded-lg border flex items-start gap-2 ${
                                    alt.correta
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className="font-bold shrink-0">{alt.letra})</span>
                                  <span className="flex-1">{alt.texto}</span>
                                  {alt.correta && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                                      <Check className="w-3 h-3" /> Correta
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {bq.explicacao && (
                            <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-600">
                              <strong>Comentário:</strong> {bq.explicacao}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer do Modal */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 flex-wrap">
            <span className="text-xs font-semibold text-slate-600">
              <strong className="text-indigo-600 font-bold">{bancoSelecionadas.length}</strong>{' '}
              questão(ões) selecionada(s)
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalBancoAtividadeAberto(false)}
                disabled={salvandoAtividadeBanco}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={salvandoAtividadeBanco}
                disabled={bancoSelecionadas.length === 0}
              >
                Criar atividade ({bancoSelecionadas.length})
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Gerador de Questões por IA direto na Matéria */}
      {oferta && (
        <ModalGeradorIA
          aberto={modalGeradorIAAberto}
          onFechar={() => setModalGeradorIAAberto(false)}
          disciplinaIdInicial={oferta.disciplina_id}
          serieInicial={oferta.turma_serie || '7º Ano'}
          assuntoIdInicial={assuntosOferta[0]?.id}
          combinacoes={
            combinacoesProfessor.length > 0
              ? combinacoesProfessor
              : [
                  {
                    disciplina_id: oferta.disciplina_id,
                    disciplina_nome: oferta.disciplina_nome,
                    serie: oferta.turma_serie || '7º Ano',
                    label: `${oferta.disciplina_nome} — ${oferta.turma_serie || '7º Ano'}`,
                  },
                ]
          }
          assuntos={assuntosOferta}
          onCriarAssunto={async (nome) => {
            const novo = await bancoService.criarAssunto(oferta.disciplina_id, nome);
            setAssuntosOferta((prev) => [...prev, novo]);
            return novo;
          }}
          onSucesso={async () => {
            await carregarDadosBancoDaOferta();
          }}
        />
      )}

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
