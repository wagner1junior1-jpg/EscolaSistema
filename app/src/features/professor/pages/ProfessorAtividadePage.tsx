import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import {
  professorService,
  gestaoService,
  bancoService,
  AtividadeCompleta,
  Periodo,
  ModoAtividade,
  NovaQuestaoPayload,
  BancoQuestao,
  Assunto,
  DificuldadeQuestao,
  OfertaDetalhada,
} from '@/services';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Info,
  Loader2,
  AlertCircle,
  HelpCircle,
  Check,
  Database,
  Shuffle,
} from 'lucide-react';

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
type Letra = typeof LETRAS[number];

interface AlternativaEditor {
  id?: string;
  letra: Letra;
  texto: string;
  correta: boolean;
  por_que_errou?: string | null;
}

interface QuestaoEditor {
  id?: string;
  ordem: number;
  enunciado: string;
  dica?: string | null;
  explicacao?: string | null;
  banco_questao_id?: string | null;
  assunto_id?: string | null;
  salvar_no_banco?: boolean;
  dificuldade?: DificuldadeQuestao;
  alternativas: AlternativaEditor[];
}

export const ProfessorAtividadePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [atividade, setAtividade] = useState<AtividadeCompleta | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  // Oferta e Assuntos da Atividade
  const [ofertaAtual, setOfertaAtual] = useState<OfertaDetalhada | null>(null);
  const [assuntosOferta, setAssuntosOferta] = useState<Assunto[]>([]);

  // Modal Banco de Questões
  const [modalBancoAberto, setModalBancoAberto] = useState(false);
  const [abaBanco, setAbaBanco] = useState<'escolher' | 'sortear'>('escolher');
  const [questoesBanco, setQuestoesBanco] = useState<BancoQuestao[]>([]);
  const [carregandoBanco, setCarregandoBanco] = useState(false);
  const [bancoSelecionadas, setBancoSelecionadas] = useState<string[]>([]);
  const [filtroAssuntoBanco, setFiltroAssuntoBanco] = useState<string>('todos');
  const [buscaBanco, setBuscaBanco] = useState<string>('');

  // Sorteio
  const [sorteioAssuntoId, setSorteioAssuntoId] = useState<string>('');
  const [sorteioQtdFacil, setSorteioQtdFacil] = useState<number>(0);
  const [sorteioQtdMedio, setSorteioQtdMedio] = useState<number>(0);
  const [sorteioQtdDificil, setSorteioQtdDificil] = useState<number>(0);
  const [executandoBanco, setExecutandoBanco] = useState(false);

  // Metadados da atividade
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modo, setModo] = useState<ModoAtividade>('exercicio');
  const [periodoId, setPeriodoId] = useState('');
  const [prazo, setPrazo] = useState('');

  // Questões
  const [questoes, setQuestoes] = useState<QuestaoEditor[]>([]);

  // Controle de alterações não salvas
  const [temAlteracoesNaoSalvas, setTemAlteracoesNaoSalvas] = useState(false);
  const [modalSairAberto, setModalSairAberto] = useState(false);
  const [destinoNavegacao, setDestinoNavegacao] = useState<string | null>(null);

  // Confirmação para excluir questão
  const [questaoParaExcluirIndex, setQuestaoParaExcluirIndex] = useState<number | null>(null);
  const [excluindoQuestao, setExcluindoQuestao] = useState(false);

  // Carregamento inicial
  const carregarAtividade = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErroCarregamento(null);

    try {
      const [ativCarregada, listaPeriodos, ofertas] = await Promise.all([
        professorService.obterAtividade(id),
        gestaoService.listarPeriodos(),
        professorService.minhasOfertas(),
      ]);

      if (!ativCarregada) {
        throw new Error('Atividade não encontrada ou sem permissão de acesso.');
      }

      setAtividade(ativCarregada);
      setPeriodos(listaPeriodos);

      const ofEncontrada = ofertas.find((o) => o.id === ativCarregada.oferta_id) || null;
      setOfertaAtual(ofEncontrada);

      if (ofEncontrada) {
        try {
          const listaAssuntos = await bancoService.listarAssuntos(ofEncontrada.disciplina_id);
          setAssuntosOferta(listaAssuntos);
        } catch (e) {
          console.error('Falha ao carregar assuntos da oferta:', e);
        }
      }

      // Popula campos de cabeçalho
      setTitulo(ativCarregada.titulo);
      setDescricao(ativCarregada.descricao);
      setModo(ativCarregada.modo);
      setPeriodoId(ativCarregada.periodo_id);
      setPrazo(ativCarregada.prazo || '');

      // Popula lista de questões
      const questoesMapeadas: QuestaoEditor[] = (ativCarregada.questoes || [])
        .sort((a, b) => a.ordem - b.ordem)
        .map((q, idx) => ({
          id: q.id,
          ordem: q.ordem || idx + 1,
          enunciado: q.enunciado || '',
          dica: q.dica || '',
          explicacao: q.explicacao || '',
          banco_questao_id: q.banco_questao_id || null,
          assunto_id: q.assunto_id || null,
          salvar_no_banco: false,
          dificuldade: 'facil',
          alternativas: (q.alternativas || [])
            .sort((a, b) => a.letra.localeCompare(b.letra))
            .map((alt, altIdx) => ({
              id: alt.id,
              letra: (alt.letra as Letra) || LETRAS[altIdx] || 'A',
              texto: alt.texto || '',
              correta: alt.correta,
              por_que_errou: alt.por_que_errou || '',
            })),
        }));

      setQuestoes(questoesMapeadas);
      setTemAlteracoesNaoSalvas(false);
    } catch (err: unknown) {
      setErroCarregamento(
        err instanceof Error ? err.message : 'Falha ao carregar os dados da atividade.'
      );
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregarAtividade();
  }, [carregarAtividade]);

  // Alerta ao fechar ou recarregar a janela com alterações pendentes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (temAlteracoesNaoSalvas) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [temAlteracoesNaoSalvas]);

  const isRascunho = atividade?.status === 'rascunho';
  const isPublicada = atividade?.status === 'publicada';
  const isEncerrada = atividade?.status === 'encerrada';

  // Manipulador de navegação segura (com confirmação se houver alterações)
  const navegarSeguro = (caminho: string) => {
    if (temAlteracoesNaoSalvas) {
      setDestinoNavegacao(caminho);
      setModalSairAberto(true);
    } else {
      navigate(caminho);
    }
  };

  // Funções para manipulação de questões
  const handleAdicionarQuestao = () => {
    if (!isRascunho) return;

    const novaQuestao: QuestaoEditor = {
      ordem: questoes.length + 1,
      enunciado: '',
      dica: '',
      explicacao: '',
      alternativas: [
        { letra: 'A', texto: '', correta: true, por_que_errou: '' },
        { letra: 'B', texto: '', correta: false, por_que_errou: '' },
        { letra: 'C', texto: '', correta: false, por_que_errou: '' },
        { letra: 'D', texto: '', correta: false, por_que_errou: '' },
      ],
    };

    setQuestoes((prev) => [...prev, novaQuestao]);
    setTemAlteracoesNaoSalvas(true);
  };

  const handleMoverQuestao = (index: number, direcao: 'up' | 'down') => {
    if (!isRascunho) return;
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= questoes.length) return;

    setQuestoes((prev) => {
      const copia = [...prev];
      const temp = copia[index];
      copia[index] = copia[novoIndex];
      copia[novoIndex] = temp;

      // Reatribui ordem sequencial
      return copia.map((q, idx) => ({ ...q, ordem: idx + 1 }));
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const handleConfirmarExcluirQuestao = async () => {
    if (questaoParaExcluirIndex === null) return;
    const q = questoes[questaoParaExcluirIndex];

    setExcluindoQuestao(true);
    try {
      if (q.id) {
        await professorService.excluirQuestao(q.id);
      }

      setQuestoes((prev) => {
        const filtradas = prev.filter((_, idx) => idx !== questaoParaExcluirIndex);
        return filtradas.map((item, idx) => ({ ...item, ordem: idx + 1 }));
      });

      toast.success('Questão excluída com sucesso.');
      setQuestaoParaExcluirIndex(null);
      setTemAlteracoesNaoSalvas(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir questão.');
    } finally {
      setExcluindoQuestao(false);
    }
  };

  // Funções para manipulação de alternativas dentro de uma questão
  const handleAdicionarAlternativa = (qIndex: number) => {
    if (!isRascunho) return;
    setQuestoes((prev) => {
      const copia = [...prev];
      const q = { ...copia[qIndex] };
      if (q.alternativas.length >= 5) return prev;

      const proximaLetra = LETRAS[q.alternativas.length];
      q.alternativas = [
        ...q.alternativas,
        {
          letra: proximaLetra,
          texto: '',
          correta: false,
          por_que_errou: '',
        },
      ];
      copia[qIndex] = q;
      return copia;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const handleRemoverAlternativa = (qIndex: number, altIndex: number) => {
    if (!isRascunho) return;
    setQuestoes((prev) => {
      const copia = [...prev];
      const q = { ...copia[qIndex] };
      if (q.alternativas.length <= 2) return prev;

      const foiRemovidaCorreta = q.alternativas[altIndex].correta;
      const novasAlts = q.alternativas.filter((_, idx) => idx !== altIndex);

      // Reatribui letras e garante que pelo menos 1 seja correta
      q.alternativas = novasAlts.map((alt, idx) => ({
        ...alt,
        letra: LETRAS[idx],
        correta: foiRemovidaCorreta && idx === 0 ? true : alt.correta,
      }));

      copia[qIndex] = q;
      return copia;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const handleMarcarCorreta = (qIndex: number, altIndex: number) => {
    if (!isRascunho) return; // Bloqueado em publicada e encerrada
    setQuestoes((prev) => {
      const copia = [...prev];
      const q = { ...copia[qIndex] };
      q.alternativas = q.alternativas.map((alt, idx) => ({
        ...alt,
        correta: idx === altIndex,
      }));
      copia[qIndex] = q;
      return copia;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const handleAlterarTextoQuestao = (qIndex: number, campo: 'enunciado' | 'dica' | 'explicacao', valor: string) => {
    if (isEncerrada) return;
    setQuestoes((prev) => {
      const copia = [...prev];
      copia[qIndex] = { ...copia[qIndex], [campo]: valor };
      return copia;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const handleAlterarTextoAlternativa = (
    qIndex: number,
    altIndex: number,
    campo: 'texto' | 'por_que_errou',
    valor: string
  ) => {
    if (isEncerrada) return;
    setQuestoes((prev) => {
      const copia = [...prev];
      const q = { ...copia[qIndex] };
      const alts = [...q.alternativas];
      alts[altIndex] = { ...alts[altIndex], [campo]: valor };
      q.alternativas = alts;
      copia[qIndex] = q;
      return copia;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  // Handlers para o Modal Banco de Questões
  const handleAbrirModalBanco = async () => {
    if (!ofertaAtual) return;
    setModalBancoAberto(true);
    setCarregandoBanco(true);
    setBancoSelecionadas([]);
    try {
      const lista = await bancoService.listarBanco({
        disciplina_id: ofertaAtual.disciplina_id,
        serie: ofertaAtual.turma_serie || '',
      });
      setQuestoesBanco(lista);
      if (assuntosOferta.length > 0 && !sorteioAssuntoId) {
        setSorteioAssuntoId(assuntosOferta[0].id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao listar banco.');
    } finally {
      setCarregandoBanco(false);
    }
  };

  const handleAdicionarSelecionadas = async () => {
    if (!atividade || bancoSelecionadas.length === 0) return;
    setExecutandoBanco(true);
    try {
      await bancoService.adicionarDoBanco(atividade.id, bancoSelecionadas);
      toast.success(`${bancoSelecionadas.length} questão(ões) adicionada(s) do banco!`);
      setModalBancoAberto(false);
      setBancoSelecionadas([]);
      await carregarAtividade();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar do banco.');
    } finally {
      setExecutandoBanco(false);
    }
  };

  const handleSortearEAdicionar = async () => {
    if (!atividade || !sorteioAssuntoId) {
      toast.error('Selecione um assunto para o sorteio.');
      return;
    }
    const facil = Number(sorteioQtdFacil) || 0;
    const medio = Number(sorteioQtdMedio) || 0;
    const dificil = Number(sorteioQtdDificil) || 0;
    if (facil + medio + dificil <= 0) {
      toast.error('Informe a quantidade de pelo menos uma dificuldade.');
      return;
    }
    setExecutandoBanco(true);
    try {
      const res = await bancoService.sortearDoBanco(atividade.id, sorteioAssuntoId, {
        facil,
        medio,
        dificil,
      });
      if (res.aviso) {
        toast.warning(res.aviso);
      }
      toast.success(`${res.adicionadas} questão(ões) sorteada(s) e adicionada(s)!`);
      setModalBancoAberto(false);
      setSorteioQtdFacil(0);
      setSorteioQtdMedio(0);
      setSorteioQtdDificil(0);
      await carregarAtividade();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sortear questões.');
    } finally {
      setExecutandoBanco(false);
    }
  };

  // Validação e Salvamento
  const handleSalvar = async () => {
    if (!atividade || isEncerrada) return;

    // 1. Validação de metadados
    if (!titulo.trim()) {
      toast.error('O título da atividade não pode ficar vazio.');
      return;
    }
    if (!descricao.trim()) {
      toast.error('A descrição da atividade não pode ficar vazia.');
      return;
    }

    // 2. Validação estrutural de questões
    for (let i = 0; i < questoes.length; i++) {
      const q = questoes[i];
      const num = i + 1;

      if (!q.enunciado.trim()) {
        toast.error(`O enunciado da questão ${num} não pode ficar vazio.`);
        return;
      }

      if (q.alternativas.length < 2 || q.alternativas.length > 5) {
        toast.error(`A questão ${num} deve ter entre 2 e 5 alternativas.`);
        return;
      }

      const corretas = q.alternativas.filter((a) => a.correta).length;
      if (corretas !== 1) {
        toast.error(`A questão ${num} deve conter exatamente 1 alternativa correta marcada.`);
        return;
      }

      for (let j = 0; j < q.alternativas.length; j++) {
        const alt = q.alternativas[j];
        if (!alt.texto.trim()) {
          toast.error(`O texto da alternativa ${alt.letra} da questão ${num} não pode ficar vazio.`);
          return;
        }
      }
    }

    setSalvando(true);
    try {
      // Se houver questões manuais com salvar_no_banco marcado, salvar no banco primeiro
      for (const q of questoes) {
        if (q.salvar_no_banco && ofertaAtual) {
          if (!q.assunto_id) {
            toast.error('Selecione o assunto da questão para salvá-la no banco.');
            setSalvando(false);
            return;
          }
          await bancoService.salvarQuestaoBanco({
            disciplina_id: ofertaAtual.disciplina_id,
            serie: ofertaAtual.turma_serie || '',
            assunto_id: q.assunto_id,
            dificuldade: q.dificuldade || 'facil',
            enunciado: q.enunciado.trim(),
            dica: q.dica ? q.dica.trim() : null,
            explicacao: q.explicacao ? q.explicacao.trim() : null,
            alternativas: q.alternativas.map((alt, altIdx) => ({
              letra: LETRAS[altIdx],
              texto: alt.texto.trim(),
              correta: alt.correta,
              por_que_errou: alt.correta ? null : alt.por_que_errou ? alt.por_que_errou.trim() : null,
            })),
          });
        }
      }

      // Atualiza metadados da atividade
      await professorService.atualizarAtividade(atividade.id, {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prazo: prazo ? prazo : null,
        periodo_id: periodoId,
        modo: isRascunho ? modo : undefined,
      });

      // Constrói payload completo das questões
      const payload: NovaQuestaoPayload[] = questoes.map((q, idx) => ({
        id: q.id,
        ordem: idx + 1,
        enunciado: q.enunciado.trim(),
        dica: q.dica ? q.dica.trim() : null,
        explicacao: q.explicacao ? q.explicacao.trim() : null,
        banco_questao_id: q.banco_questao_id || null,
        assunto_id: q.assunto_id || null,
        alternativas: q.alternativas.map((alt, altIdx) => ({
          id: alt.id,
          letra: LETRAS[altIdx],
          texto: alt.texto.trim(),
          correta: alt.correta,
          por_que_errou: alt.correta ? null : alt.por_que_errou ? alt.por_que_errou.trim() : null,
        })),
      }));

      await professorService.salvarQuestoes(atividade.id, payload);

      toast.success('Atividade salva com sucesso!');
      setTemAlteracoesNaoSalvas(false);

      // Recarrega os dados para sincronizar novos IDs
      await carregarAtividade();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar atividade.');
    } finally {
      setSalvando(false);
    }
  };

  const questoesBancoFiltradas = questoesBanco.filter((q) => {
    if (filtroAssuntoBanco !== 'todos' && q.assunto_id !== filtroAssuntoBanco) {
      return false;
    }
    if (buscaBanco.trim()) {
      const termo = buscaBanco.toLowerCase();
      const matchEnunciado = q.enunciado.toLowerCase().includes(termo);
      const matchAlt = (q.alternativas || []).some((a) => a.texto.toLowerCase().includes(termo));
      if (!matchEnunciado && !matchAlt) return false;
    }
    return true;
  });

  const estoqueAssunto = questoesBanco.filter(
    (q) => !sorteioAssuntoId || q.assunto_id === sorteioAssuntoId
  );
  const estoqueFacil = estoqueAssunto.filter((q) => q.dificuldade === 'facil').length;
  const estoqueMedio = estoqueAssunto.filter((q) => q.dificuldade === 'medio').length;
  const estoqueDificil = estoqueAssunto.filter((q) => q.dificuldade === 'dificil').length;

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Navegação e Barra de Ações Superior */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navegarSeguro(atividade ? `/professor/oferta/${atividade.oferta_id}` : '/professor')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md py-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para as atividades da turma</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Indicador de Alterações Não Salvas */}
            {temAlteracoesNaoSalvas && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Alterações não salvas</span>
              </div>
            )}

            {/* Botão Salvar */}
            {!isEncerrada && (
              <Button
                variant="primary"
                leftIcon={<Save className="w-4 h-4" />}
                onClick={handleSalvar}
                isLoading={salvando}
                disabled={!temAlteracoesNaoSalvas && !salvando}
                className="shadow-sm"
              >
                Salvar atividade
              </Button>
            )}
          </div>
        </div>

        {/* Faixa de Aviso de Status */}
        {isPublicada && (
          <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200 text-indigo-950 flex items-start gap-3 shadow-xs">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-heading font-bold text-sm text-indigo-900">
                Atividade publicada: só é possível corrigir textos.
              </h4>
              <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
                Para manter a integridade das respostas dos alunos, não é permitido adicionar ou
                remover questões/alternativas nem alterar qual é a resposta correta.
              </p>
            </div>
          </div>
        )}

        {isEncerrada && (
          <div className="p-4 rounded-2xl bg-slate-100 border-2 border-slate-300 text-slate-800 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-heading font-bold text-sm text-slate-900">
                Atividade encerrada
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Esta atividade foi encerrada para os alunos. Todos os dados e questões estão em modo somente leitura.
              </p>
            </div>
          </div>
        )}

        {/* Estado de Carregamento */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando editor da atividade...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {!carregando && erroCarregamento && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-rose-900">
                Não foi possível carregar a atividade
              </h3>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{erroCarregamento}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/professor')} className="mx-auto">
              Voltar para Minhas Turmas
            </Button>
          </div>
        )}

        {/* Conteúdo Principal do Editor */}
        {!carregando && !erroCarregamento && atividade && (
          <div className="space-y-8">
            {/* Cartão de Cabeçalho / Metadados */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        isRascunho
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : isPublicada
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {atividade.status.toUpperCase()}
                    </span>

                    <span className="text-xs font-semibold text-slate-500">
                      • {questoes.length} questão(ões) cadastrada(s)
                    </span>
                  </div>
                </div>
                <CardTitle className="text-xl pt-1">Configurações Gerais da Atividade</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                <Input
                  label="Título da Atividade *"
                  value={titulo}
                  onChange={(e) => {
                    setTitulo(e.target.value);
                    setTemAlteracoesNaoSalvas(true);
                  }}
                  disabled={isEncerrada}
                  placeholder="Ex: Prova Bimestral de Geometria"
                />

                <Textarea
                  label="Descrição / Instruções *"
                  value={descricao}
                  onChange={(e) => {
                    setDescricao(e.target.value);
                    setTemAlteracoesNaoSalvas(true);
                  }}
                  disabled={isEncerrada}
                  rows={2}
                  placeholder="Orientações e instruções para os alunos responderem esta atividade..."
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Modo da Atividade */}
                  <Select
                    label="Modo da Atividade *"
                    value={modo}
                    onChange={(e) => {
                      setModo(e.target.value as ModoAtividade);
                      setTemAlteracoesNaoSalvas(true);
                    }}
                    disabled={!isRascunho}
                    helperText={
                      !isRascunho
                        ? 'O modo só pode ser alterado em rascunho.'
                        : modo === 'prova'
                        ? 'Correção sigilosa: só liberada no final.'
                        : 'Correção instantânea a cada resposta.'
                    }
                    options={[
                      { value: 'exercicio', label: 'Exercício (Formativo)' },
                      { value: 'prova', label: 'Prova (Somativo)' },
                    ]}
                  />

                  {/* Bimestre / Período */}
                  <Select
                    label="Bimestre / Período Letivo *"
                    value={periodoId}
                    onChange={(e) => {
                      setPeriodoId(e.target.value);
                      setTemAlteracoesNaoSalvas(true);
                    }}
                    disabled={!isRascunho}
                    options={periodos.map((p) => ({
                      value: p.id,
                      label: `${p.nome} (${p.ano_letivo})${p.ativo ? ' — Ativo' : ''}`,
                    }))}
                  />

                  {/* Prazo */}
                  <Input
                    label="Prazo de Entrega"
                    type="date"
                    value={prazo}
                    onChange={(e) => {
                      setPrazo(e.target.value);
                      setTemAlteracoesNaoSalvas(true);
                    }}
                    disabled={!isRascunho}
                    helperText="Data limite opcional para envio das respostas."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Seção de Questões */}
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading font-black text-xl text-slate-900 tracking-tight">
                    Questões ({questoes.length})
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Defina o enunciado, as alternativas e as justificativas pedagógicas de erro.
                  </p>
                </div>

                {isRascunho && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Database className="w-4 h-4 text-indigo-600" />}
                      onClick={handleAbrirModalBanco}
                    >
                      Adicionar do banco
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={handleAdicionarQuestao}
                    >
                      Adicionar questão
                    </Button>
                  </div>
                )}
              </div>

              {questoes.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="font-heading font-bold text-base text-slate-700">
                    Nenhuma questão adicionada
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                    Esta atividade ainda não possui questões. Adicione questões do banco ou crie manualmente.
                  </p>
                  {isRascunho && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Database className="w-4 h-4" />}
                        onClick={handleAbrirModalBanco}
                      >
                        Adicionar do banco
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={handleAdicionarQuestao}
                      >
                        Adicionar primeira questão
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {questoes.map((q, qIndex) => (
                    <Card key={q.id || `nova-${qIndex}`} className="border-slate-200 shadow-xs">
                      {/* Topo da Questão */}
                      <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 py-3.5 px-5 sm:px-6">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-heading font-black text-xs flex items-center justify-center shadow-xs">
                              {qIndex + 1}
                            </span>
                            <span className="font-heading font-bold text-sm text-slate-800">
                              Questão {qIndex + 1}
                            </span>
                            {q.banco_questao_id && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Database className="w-3 h-3" />
                                Do banco de questões
                              </span>
                            )}
                          </div>

                          {/* Controles de Ordenação e Exclusão */}
                          {isRascunho && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoverQuestao(qIndex, 'up')}
                                disabled={qIndex === 0}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Mover para cima"
                                aria-label="Mover questão para cima"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleMoverQuestao(qIndex, 'down')}
                                disabled={qIndex === questoes.length - 1}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Mover para baixo"
                                aria-label="Mover questão para baixo"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>

                              <div className="w-[1px] h-4 bg-slate-300 mx-1" />

                              <button
                                type="button"
                                onClick={() => setQuestaoParaExcluirIndex(qIndex)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                title="Excluir questão"
                                aria-label="Excluir questão"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="p-5 sm:p-6 space-y-5">
                        {/* Enunciado */}
                        <Textarea
                          label="Enunciado da Questão *"
                          value={q.enunciado}
                          onChange={(e) => handleAlterarTextoQuestao(qIndex, 'enunciado', e.target.value)}
                          disabled={isEncerrada}
                          placeholder="Digite aqui o problema ou enunciado completo da questão..."
                          rows={3}
                          required
                        />

                        {/* Alternativas */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-700 tracking-tight">
                              Alternativas (Marque o rádio da resposta correta) *
                            </label>
                            <span className="text-[11px] text-slate-400">
                              {q.alternativas.length} de 5 alternativas
                            </span>
                          </div>

                          <div className="space-y-3.5">
                            {q.alternativas.map((alt, altIndex) => (
                              <div
                                key={alt.id || `alt-${qIndex}-${altIndex}`}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  alt.correta
                                    ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-400/30'
                                    : 'border-slate-200 bg-white'
                                }`}
                              >
                                {/* Linha Principal da Alternativa */}
                                <div className="flex items-center gap-3">
                                  {/* Rádio da Alternativa Correta */}
                                  <label
                                    className={`flex items-center justify-center w-6 h-6 rounded-full border-2 cursor-pointer transition-all shrink-0 ${
                                      alt.correta
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-slate-300 hover:border-indigo-400 bg-white'
                                    } ${!isRascunho ? 'cursor-not-allowed opacity-80' : ''}`}
                                    title={alt.correta ? 'Alternativa Correta' : 'Marcar como Correta'}
                                  >
                                    <input
                                      type="radio"
                                      name={`correta-${qIndex}`}
                                      checked={alt.correta}
                                      onChange={() => handleMarcarCorreta(qIndex, altIndex)}
                                      disabled={!isRascunho}
                                      className="sr-only"
                                    />
                                    {alt.correta && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </label>

                                  {/* Letra */}
                                  <span
                                    className={`w-6 h-6 rounded-lg text-xs font-heading font-black flex items-center justify-center shrink-0 ${
                                      alt.correta
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {alt.letra}
                                  </span>

                                  {/* Texto da Alternativa */}
                                  <input
                                    type="text"
                                    value={alt.texto}
                                    onChange={(e) =>
                                      handleAlterarTextoAlternativa(
                                        qIndex,
                                        altIndex,
                                        'texto',
                                        e.target.value
                                      )
                                    }
                                    disabled={isEncerrada}
                                    placeholder={`Texto da alternativa ${alt.letra}...`}
                                    className="flex-1 py-1.5 px-3 bg-white border border-slate-200 text-sm text-slate-900 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                                  />

                                  {/* Botão Remover Alternativa */}
                                  {isRascunho && q.alternativas.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoverAlternativa(qIndex, altIndex)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                                      title="Remover alternativa"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                {/* Campo do Distrator / "Por que errou" em alternativas incorretas */}
                                {!alt.correta && (
                                  <div className="mt-2.5 pl-9 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                      <span>Por que o aluno erraria esta? (Diagnóstico do distrator)</span>
                                    </div>
                                    <input
                                      type="text"
                                      value={alt.por_que_errou || ''}
                                      onChange={(e) =>
                                        handleAlterarTextoAlternativa(
                                          qIndex,
                                          altIndex,
                                          'por_que_errou',
                                          e.target.value
                                        )
                                      }
                                      disabled={isEncerrada}
                                      placeholder="Ex: O aluno esqueceu de inverter a fração ao dividir..."
                                      className="w-full py-1.5 px-3 bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white disabled:bg-slate-50"
                                    />

                                    {/* Aviso Amarelo se não houver explicação */}
                                    {(!alt.por_que_errou || !alt.por_que_errou.trim()) && (
                                      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg mt-1 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Sem explicação da pegadinha: o aluno não vai saber por que errou.</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Botão Adicionar Alternativa */}
                          {isRascunho && q.alternativas.length < 5 && (
                            <button
                              type="button"
                              onClick={() => handleAdicionarAlternativa(qIndex)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-1.5 px-3 rounded-lg border border-dashed border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer mt-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar Alternativa ({LETRAS[q.alternativas.length]})</span>
                            </button>
                          )}
                        </div>

                        {/* Campos Opcionais: Dica e Explicação */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                          <Textarea
                            label="Dica para o Aluno (Opcional)"
                            value={q.dica || ''}
                            onChange={(e) => handleAlterarTextoQuestao(qIndex, 'dica', e.target.value)}
                            disabled={isEncerrada}
                            placeholder="Dica exibida a pedido do aluno durante o exercício..."
                            rows={2}
                            helperText="Disponível para o aluno apenas em atividades no modo Exercício."
                          />

                          <Textarea
                            label="Explicação da Resposta Correta"
                            value={q.explicacao || ''}
                            onChange={(e) => handleAlterarTextoQuestao(qIndex, 'explicacao', e.target.value)}
                            disabled={isEncerrada}
                            placeholder="Explicação passo a passo da resolução..."
                            rows={2}
                            helperText="Exibida ao aluno no feedback da resposta."
                          />
                        </div>
                        {/* Opção para salvar no banco de questões */}
                        {!q.banco_questao_id && isRascunho && (
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!q.salvar_no_banco}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setQuestoes((prev) => {
                                    const c = [...prev];
                                    c[qIndex] = {
                                      ...c[qIndex],
                                      salvar_no_banco: checked,
                                      assunto_id: checked ? c[qIndex].assunto_id || assuntosOferta[0]?.id : c[qIndex].assunto_id,
                                    };
                                    return c;
                                  });
                                  setTemAlteracoesNaoSalvas(true);
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              />
                              <span>Salvar também no banco de questões</span>
                            </label>

                            {q.salvar_no_banco && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <Select
                                  label="Assunto *"
                                  value={q.assunto_id || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setQuestoes((prev) => {
                                      const c = [...prev];
                                      c[qIndex] = { ...c[qIndex], assunto_id: val };
                                      return c;
                                    });
                                    setTemAlteracoesNaoSalvas(true);
                                  }}
                                  options={[
                                    { value: '', label: 'Selecione um assunto...' },
                                    ...assuntosOferta.map((a) => ({ value: a.id, label: a.nome })),
                                  ]}
                                />
                                <Select
                                  label="Dificuldade *"
                                  value={q.dificuldade || 'facil'}
                                  onChange={(e) => {
                                    const val = e.target.value as DificuldadeQuestao;
                                    setQuestoes((prev) => {
                                      const c = [...prev];
                                      c[qIndex] = { ...c[qIndex], dificuldade: val };
                                      return c;
                                    });
                                    setTemAlteracoesNaoSalvas(true);
                                  }}
                                  options={[
                                    { value: 'facil', label: 'Fácil' },
                                    { value: 'medio', label: 'Médio' },
                                    { value: 'dificil', label: 'Difícil' },
                                  ]}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Botões de Rodapé para Adicionar Questão */}
              {isRascunho && questoes.length > 0 && (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    leftIcon={<Database className="w-4 h-4 text-indigo-600" />}
                    onClick={handleAbrirModalBanco}
                    className="w-full sm:w-auto"
                  >
                    Adicionar do banco
                  </Button>
                  <Button
                    variant="outline"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleAdicionarQuestao}
                    className="w-full sm:w-auto"
                  >
                    Adicionar outra questão
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmação: Excluir Questão */}
      <ConfirmDialog
        isOpen={questaoParaExcluirIndex !== null}
        onClose={() => !excluindoQuestao && setQuestaoParaExcluirIndex(null)}
        onConfirm={handleConfirmarExcluirQuestao}
        title="Excluir questão"
        message={
          questaoParaExcluirIndex !== null
            ? `Tem certeza que deseja excluir a Questão ${questaoParaExcluirIndex + 1}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmText="Excluir questão"
        cancelText="Cancelar"
        variant="danger"
        isLoading={excluindoQuestao}
      />

      {/* Confirmação: Sair com Alterações Não Salvas */}
      <ConfirmDialog
        isOpen={modalSairAberto}
        onClose={() => setModalSairAberto(false)}
        onConfirm={() => {
          setTemAlteracoesNaoSalvas(false);
          setModalSairAberto(false);
          if (destinoNavegacao) {
            navigate(destinoNavegacao);
          }
        }}
        title="Alterações não salvas"
        message="Você possui alterações que ainda não foram salvas. Se sair agora, todas as modificações serão descartadas. Deseja sair mesmo assim?"
        confirmText="Sair sem salvar"
        cancelText="Continuar editando"
        variant="danger"
      />

      {/* Modal: Adicionar do Banco de Questões */}
      <Modal
        isOpen={modalBancoAberto}
        onClose={() => setModalBancoAberto(false)}
        title="Banco de Questões"
        description={
          ofertaAtual
            ? `${ofertaAtual.disciplina_nome || 'Disciplina'} • ${ofertaAtual.turma_nome || ofertaAtual.turma_serie || ''}`
            : undefined
        }
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Abas */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setAbaBanco('escolher')}
              className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                abaBanco === 'escolher'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Escolher questões
            </button>
            <button
              type="button"
              onClick={() => setAbaBanco('sortear')}
              className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                abaBanco === 'sortear'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sortear questões
            </button>
          </div>

          {carregandoBanco ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <p className="text-xs">Carregando banco de questões...</p>
            </div>
          ) : abaBanco === 'escolher' ? (
            <div className="space-y-4">
              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Filtrar por Assunto"
                  value={filtroAssuntoBanco}
                  onChange={(e) => setFiltroAssuntoBanco(e.target.value)}
                  options={[
                    { value: 'todos', label: 'Todos os assuntos' },
                    ...assuntosOferta.map((a) => ({ value: a.id, label: a.nome })),
                  ]}
                />
                <Input
                  label="Buscar enunciado"
                  value={buscaBanco}
                  onChange={(e) => setBuscaBanco(e.target.value)}
                  placeholder="Buscar texto..."
                />
              </div>

              {/* Lista com checkboxes */}
              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {questoesBancoFiltradas.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Nenhuma questão encontrada para os filtros selecionados.
                  </p>
                ) : (
                  questoesBancoFiltradas.map((bq) => {
                    const isSelected = bancoSelecionadas.includes(bq.id);
                    return (
                      <div
                        key={bq.id}
                        onClick={() => {
                          setBancoSelecionadas((prev) =>
                            prev.includes(bq.id) ? prev.filter((x) => x !== bq.id) : [...prev, bq.id]
                          );
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-400/30'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                                  bq.dificuldade === 'facil'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : bq.dificuldade === 'medio'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {bq.dificuldade}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500">
                                {bq.assunto_nome}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 line-clamp-2 leading-relaxed">
                              {bq.enunciado}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Botão Adicionar Selecionadas */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  {bancoSelecionadas.length} selecionada(s)
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setModalBancoAberto(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={bancoSelecionadas.length === 0 || executandoBanco}
                    isLoading={executandoBanco}
                    onClick={handleAdicionarSelecionadas}
                  >
                    Adicionar selecionadas ({bancoSelecionadas.length})
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Aba Sortear */
            <div className="space-y-4">
              <Select
                label="Selecione o Assunto *"
                value={sorteioAssuntoId}
                onChange={(e) => setSorteioAssuntoId(e.target.value)}
                options={assuntosOferta.map((a) => ({ value: a.id, label: a.nome }))}
              />

              {/* Estoque disponível */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-600">
                <div className="font-semibold text-slate-700">Estoque disponível neste assunto:</div>
                <div className="flex items-center gap-4">
                  <span>Fáceis: <strong className="text-slate-900">{estoqueFacil}</strong></span>
                  <span>Médias: <strong className="text-slate-900">{estoqueMedio}</strong></span>
                  <span>Difíceis: <strong className="text-slate-900">{estoqueDificil}</strong></span>
                </div>
              </div>

              {/* Quantidades desejadas */}
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Fáceis"
                  type="number"
                  min={0}
                  max={estoqueFacil}
                  value={sorteioQtdFacil}
                  onChange={(e) => setSorteioQtdFacil(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
                <Input
                  label="Médias"
                  type="number"
                  min={0}
                  max={estoqueMedio}
                  value={sorteioQtdMedio}
                  onChange={(e) => setSorteioQtdMedio(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
                <Input
                  label="Difíceis"
                  type="number"
                  min={0}
                  max={estoqueDificil}
                  value={sorteioQtdDificil}
                  onChange={(e) => setSorteioQtdDificil(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button variant="ghost" size="sm" onClick={() => setModalBancoAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Shuffle className="w-4 h-4" />}
                  disabled={
                    (Number(sorteioQtdFacil) || 0) + (Number(sorteioQtdMedio) || 0) + (Number(sorteioQtdDificil) || 0) <= 0 ||
                    executandoBanco
                  }
                  isLoading={executandoBanco}
                  onClick={handleSortearEAdicionar}
                >
                  Sortear e adicionar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </AppShell>
  );
};

export default ProfessorAtividadePage;
