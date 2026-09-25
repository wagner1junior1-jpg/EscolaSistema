import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
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
  bancoService,
  BancoQuestao,
  Assunto,
  CombinacaoProfessor,
  DificuldadeQuestao,
} from '@/services';
import {
  Plus,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Copy,
  Edit2,
  Archive,
  CheckCircle2,
  FolderPlus,
  HelpCircle,
} from 'lucide-react';

const DIFICULDADE_ROTULO: Record<DificuldadeQuestao, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

const DIFICULDADE_COR: Record<DificuldadeQuestao, string> = {
  facil: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  dificil: 'bg-rose-50 text-rose-700 border-rose-200',
};

interface FormAlternativa {
  letra: 'A' | 'B' | 'C' | 'D';
  texto: string;
  correta: boolean;
  por_que_errou: string;
}

export const ProfessorBancoPage: React.FC = () => {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [combinacoes, setCombinacoes] = useState<CombinacaoProfessor[]>([]);
  const [combinacaoSelecionada, setCombinacaoSelecionada] = useState<string>(''); // formato: `${disciplina_id}__${serie}`

  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [questoes, setQuestoes] = useState<BancoQuestao[]>([]);

  // Filtros
  const [filtroAssunto, setFiltroAssunto] = useState<string>('todos');
  const [filtroDificuldade, setFiltroDificuldade] = useState<string>('todas');
  const [filtroEscopo, setFiltroEscopo] = useState<'escola' | 'minhas'>('escola');

  const [carregandoCombinacoes, setCarregandoCombinacoes] = useState(true);
  const [carregandoQuestoes, setCarregandoQuestoes] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Modal de Criação / Edição de Questão
  const [modalQuestaoAberto, setModalQuestaoAberto] = useState(false);
  const [editandoQuestaoId, setEditandoQuestaoId] = useState<string | null>(null);
  const [editandoVersao, setEditandoVersao] = useState<number | undefined>(undefined);
  const [formAssuntoId, setFormAssuntoId] = useState('');
  const [formDificuldade, setFormDificuldade] = useState<DificuldadeQuestao>('facil');
  const [formEnunciado, setFormEnunciado] = useState('');
  const [formDica, setFormDica] = useState('');
  const [formExplicacao, setFormExplicacao] = useState('');
  const [formAlternativas, setFormAlternativas] = useState<FormAlternativa[]>([
    { letra: 'A', texto: '', correta: true, por_que_errou: '' },
    { letra: 'B', texto: '', correta: false, por_que_errou: '' },
    { letra: 'C', texto: '', correta: false, por_que_errou: '' },
    { letra: 'D', texto: '', correta: false, por_que_errou: '' },
  ]);
  const [salvandoQuestao, setSalvandoQuestao] = useState(false);

  // Modal de Novo Assunto
  const [modalAssuntoAberto, setModalAssuntoAberto] = useState(false);
  const [novoAssuntoNome, setNovoAssuntoNome] = useState('');
  const [salvandoAssunto, setSalvandoAssunto] = useState(false);

  // Confirmação para arquivar
  const [questaoParaArquivar, setQuestaoParaArquivar] = useState<BancoQuestao | null>(null);
  const [arquivando, setArquivando] = useState(false);

  // 1. Carrega combinações de ofertas do professor
  useEffect(() => {
    async function carregarCombinacoes() {
      setCarregandoCombinacoes(true);
      try {
        const lista = await bancoService.listarCombinacoesDoProfessor();
        setCombinacoes(lista);
        if (lista.length > 0) {
          const mat = lista.find((c) => c.disciplina_nome.toLowerCase().includes('matemática'));
          const inicial = mat || lista[0];
          setCombinacaoSelecionada(`${inicial.disciplina_id}__${inicial.serie}`);
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Falha ao carregar ofertas.');
      } finally {
        setCarregandoCombinacoes(false);
      }
    }
    carregarCombinacoes();
  }, []);

  const combAtual = combinacoes.find(
    (c) => `${c.disciplina_id}__${c.serie}` === combinacaoSelecionada
  );

  // 2. Carrega assuntos da disciplina selecionada
  useEffect(() => {
    if (!combAtual) return;
    async function carregarAssuntos() {
      try {
        const lista = await bancoService.listarAssuntos(combAtual!.disciplina_id);
        setAssuntos(lista);
      } catch (err) {
        console.error('Falha ao carregar assuntos:', err);
      }
    }
    carregarAssuntos();
  }, [combAtual]);

  // 3. Carrega questões com os filtros
  const carregarQuestoes = useCallback(async () => {
    if (!combAtual) return;
    setCarregandoQuestoes(true);
    setErro(null);
    try {
      const lista = await bancoService.listarBanco({
        disciplina_id: combAtual.disciplina_id,
        serie: combAtual.serie,
        assunto_id: filtroAssunto !== 'todos' ? filtroAssunto : undefined,
        dificuldade:
          filtroDificuldade !== 'todas'
            ? (filtroDificuldade as DificuldadeQuestao)
            : undefined,
        escopo: filtroEscopo,
      });
      setQuestoes(lista);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar questões.');
    } finally {
      setCarregandoQuestoes(false);
    }
  }, [combAtual, filtroAssunto, filtroDificuldade, filtroEscopo]);

  useEffect(() => {
    carregarQuestoes();
  }, [carregarQuestoes]);

  // Abrir modal para Nova Questão
  const handleAbrirNovaQuestao = () => {
    setEditandoQuestaoId(null);
    setEditandoVersao(undefined);
    setFormAssuntoId(assuntos[0]?.id || '');
    setFormDificuldade('facil');
    setFormEnunciado('');
    setFormDica('');
    setFormExplicacao('');
    setFormAlternativas([
      { letra: 'A', texto: '', correta: true, por_que_errou: '' },
      { letra: 'B', texto: '', correta: false, por_que_errou: '' },
      { letra: 'C', texto: '', correta: false, por_que_errou: '' },
      { letra: 'D', texto: '', correta: false, por_que_errou: '' },
    ]);
    setModalQuestaoAberto(true);
  };

  // Abrir modal para Editar Questão
  const handleAbrirEditarQuestao = (q: BancoQuestao) => {
    setEditandoQuestaoId(q.id);
    setEditandoVersao(q.versao);
    setFormAssuntoId(q.assunto_id);
    setFormDificuldade(q.dificuldade);
    setFormEnunciado(q.enunciado);
    setFormDica(q.dica || '');
    setFormExplicacao(q.explicacao || '');

    const alts: FormAlternativa[] = (q.alternativas || []).slice(0, 4).map((a, idx) => ({
      letra: (['A', 'B', 'C', 'D'] as const)[idx],
      texto: a.texto,
      correta: a.correta,
      por_que_errou: a.por_que_errou || '',
    }));
    // Garante 4 alternativas
    while (alts.length < 4) {
      const letra = (['A', 'B', 'C', 'D'] as const)[alts.length];
      alts.push({ letra, texto: '', correta: false, por_que_errou: '' });
    }
    setFormAlternativas(alts);
    setModalQuestaoAberto(true);
  };

  // Salvar Questão
  const handleSalvarQuestao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!combAtual) return;

    if (!formEnunciado.trim()) {
      toast.warning('Digite o enunciado da questão.');
      return;
    }

    if (!formAssuntoId) {
      toast.warning('Selecione um assunto.');
      return;
    }

    // Valida textos das alternativas
    for (const alt of formAlternativas) {
      if (!alt.texto.trim()) {
        toast.warning(`Preencha o texto da alternativa ${alt.letra}.`);
        return;
      }
      if (!alt.correta && !alt.por_que_errou.trim()) {
        toast.warning(
          `Preencha o "Por que errou" da alternativa ${alt.letra} (incorreta).`
        );
        return;
      }
    }

    if (!formExplicacao.trim()) {
      toast.warning('Preencha a explicação da resposta correta.');
      return;
    }

    setSalvandoQuestao(true);
    try {
      await bancoService.salvarQuestaoBanco({
        id: editandoQuestaoId || undefined,
        disciplina_id: combAtual.disciplina_id,
        serie: combAtual.serie,
        assunto_id: formAssuntoId,
        dificuldade: formDificuldade,
        enunciado: formEnunciado.trim(),
        dica: formDica.trim() || null,
        explicacao: formExplicacao.trim() || null,
        versao: editandoVersao,
        alternativas: formAlternativas.map((a) => ({
          letra: a.letra,
          texto: a.texto.trim(),
          correta: a.correta,
          por_que_errou: a.correta ? null : a.por_que_errou.trim(),
        })),
      });

      toast.success(
        editandoQuestaoId
          ? 'Questão atualizada com sucesso!'
          : 'Questão criada com sucesso no banco!'
      );
      setModalQuestaoAberto(false);
      carregarQuestoes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao salvar questão.'
      );
    } finally {
      setSalvandoQuestao(false);
    }
  };

  // Duplicar Questão
  const handleDuplicar = async (q: BancoQuestao) => {
    try {
      await bancoService.duplicarQuestaoBanco(q.id);
      toast.success('Questão duplicada com sucesso! Agora você pode editá-la.');
      carregarQuestoes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao duplicar questão.'
      );
    }
  };

  // Arquivar Questão
  const handleConfirmarArquivar = async () => {
    if (!questaoParaArquivar) return;
    setArquivando(true);
    try {
      await bancoService.arquivarQuestaoBanco(questaoParaArquivar.id);
      toast.success('Questão arquivada com sucesso!');
      setQuestaoParaArquivar(null);
      carregarQuestoes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao arquivar questão.'
      );
    } finally {
      setArquivando(false);
    }
  };

  // Criar Assunto
  const handleCriarAssunto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!combAtual || !novoAssuntoNome.trim()) return;

    setSalvandoAssunto(true);
    try {
      const criado = await bancoService.criarAssunto(
        combAtual.disciplina_id,
        novoAssuntoNome.trim()
      );
      toast.success('Assunto cadastrado com sucesso!');
      setAssuntos((prev) => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)));
      setFormAssuntoId(criado.id);
      setModalAssuntoAberto(false);
      setNovoAssuntoNome('');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao criar assunto.'
      );
    } finally {
      setSalvandoAssunto(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabeçalho da Página */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => navigate('/professor')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para Minhas Turmas</span>
              </button>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Banco de Questões
              </h1>
              <p className="text-sm text-slate-500 font-sans">
                Consulte, monte e compartilhe questões objetivas categorizadas por matéria e série.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                leftIcon={<FolderPlus className="w-4 h-4" />}
                onClick={() => setModalAssuntoAberto(true)}
                disabled={!combAtual}
              >
                Novo assunto
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleAbrirNovaQuestao}
                disabled={!combAtual}
              >
                Nova questão
              </Button>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Seletores */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Seletor Matéria · Série */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Matéria e Série
              </label>
              {carregandoCombinacoes ? (
                <div className="h-10 flex items-center text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Carregando...
                </div>
              ) : combinacoes.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Nenhuma oferta atribuída.</p>
              ) : (
                <Select
                  value={combinacaoSelecionada}
                  onChange={(e) => setCombinacaoSelecionada(e.target.value)}
                  className="w-full font-semibold"
                >
                  {combinacoes.map((c) => (
                    <option
                      key={`${c.disciplina_id}__${c.serie}`}
                      value={`${c.disciplina_id}__${c.serie}`}
                    >
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Filtro por Assunto */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Assunto
              </label>
              <Select
                value={filtroAssunto}
                onChange={(e) => setFiltroAssunto(e.target.value)}
                className="w-full"
                disabled={!combAtual}
              >
                <option value="todos">Todos os assuntos</option>
                {assuntos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </Select>
            </div>

            {/* Filtro por Dificuldade */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Dificuldade
              </label>
              <Select
                value={filtroDificuldade}
                onChange={(e) => setFiltroDificuldade(e.target.value)}
                className="w-full"
                disabled={!combAtual}
              >
                <option value="todas">Todas</option>
                <option value="facil">Fácil</option>
                <option value="medio">Médio</option>
                <option value="dificil">Difícil</option>
              </Select>
            </div>

            {/* Filtro Escopo (Minhas / Da escola) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Escopo
              </label>
              <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setFiltroEscopo('escola')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    filtroEscopo === 'escola'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Da escola
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEscopo('minhas')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    filtroEscopo === 'minhas'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Minhas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mensagem de Erro se houver */}
        {erro && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-medium">{erro}</p>
          </div>
        )}

        {/* Lista de Questões do Banco */}
        {carregandoQuestoes ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando questões do banco...</p>
          </div>
        ) : questoes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-heading font-bold text-lg text-slate-700">
              Nenhuma questão encontrada
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {filtroAssunto !== 'todos' || filtroDificuldade !== 'todas' || filtroEscopo === 'minhas'
                ? 'Tente ajustar os filtros acima ou crie uma nova questão neste assunto.'
                : 'Seja o primeiro a adicionar questões para esta matéria e série no banco da escola.'}
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleAbrirNovaQuestao}
              >
                Criar primeira questão
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-500 px-1">
              Exibindo {questoes.length} questão(ões) no banco
            </div>

            {questoes.map((q, idx) => {
              const souAutor = q.criado_por === usuario?.id;

              return (
                <Card key={q.id} className="border-slate-200">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    {/* Linha superior: Tags e Ações */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            DIFICULDADE_COR[q.dificuldade]
                          }`}
                        >
                          {DIFICULDADE_ROTULO[q.dificuldade]}
                        </span>
                        {q.assunto_nome && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {q.assunto_nome}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          por {souAutor ? 'Você' : q.autor_nome}
                        </span>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-1.5">
                        {souAutor ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                              onClick={() => handleAbrirEditarQuestao(q)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              leftIcon={<Archive className="w-3.5 h-3.5" />}
                              onClick={() => setQuestaoParaArquivar(q)}
                            >
                              Arquivar
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Copy className="w-3.5 h-3.5" />}
                            onClick={() => handleDuplicar(q)}
                          >
                            Duplicar para editar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Enunciado */}
                    <div className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {q.enunciado}
                    </div>

                    {/* Alternativas */}
                    {q.alternativas && q.alternativas.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.alternativas.map((alt) => (
                          <div
                            key={alt.id}
                            className={`p-3 rounded-xl border text-xs leading-snug space-y-1 ${
                              alt.correta
                                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`font-mono font-bold shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[11px] ${
                                  alt.correta
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {alt.letra}
                              </span>
                              <span className="flex-1">{alt.texto}</span>
                              {alt.correta && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              )}
                            </div>
                            {!alt.correta && alt.por_que_errou && (
                              <p className="text-[11px] text-slate-500 pl-7 italic">
                                Por que errou: {alt.por_que_errou}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dica e Explicação */}
                    {(q.dica || q.explicacao) && (
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {q.dica && (
                          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900">
                            <span className="font-bold">Dica pedagógica: </span>
                            {q.dica}
                          </div>
                        )}
                        {q.explicacao && (
                          <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-indigo-900">
                            <span className="font-bold">Explicação da resposta: </span>
                            {q.explicacao}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal Criação / Edição de Questão */}
        <Modal
          isOpen={modalQuestaoAberto}
          onClose={() => setModalQuestaoAberto(false)}
          title={editandoQuestaoId ? 'Editar Questão do Banco' : 'Nova Questão no Banco'}
          maxWidth="lg"
        >
          <form onSubmit={handleSalvarQuestao} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assunto *
                </label>
                <Select
                  value={formAssuntoId}
                  onChange={(e) => setFormAssuntoId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecione um assunto
                  </option>
                  {assuntos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dificuldade *
                </label>
                <Select
                  value={formDificuldade}
                  onChange={(e) => setFormDificuldade(e.target.value as DificuldadeQuestao)}
                  required
                >
                  <option value="facil">Fácil</option>
                  <option value="medio">Médio</option>
                  <option value="dificil">Difícil</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Enunciado da Questão *
              </label>
              <Textarea
                rows={3}
                value={formEnunciado}
                onChange={(e) => setFormEnunciado(e.target.value)}
                placeholder="Digite a pergunta ou situação-problema..."
                required
              />
            </div>

            {/* Alternativas */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Alternativas (Marque exatamente 1 correta) *
              </label>

              {formAlternativas.map((alt, aIdx) => (
                <div
                  key={alt.letra}
                  className={`p-3 rounded-xl border space-y-2 ${
                    alt.correta
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-700">
                      <input
                        type="radio"
                        name="alternativa_correta"
                        checked={alt.correta}
                        onChange={() => {
                          setFormAlternativas((prev) =>
                            prev.map((item, i) => ({
                              ...item,
                              correta: i === aIdx,
                            }))
                          );
                        }}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Opção {alt.letra}</span>
                    </label>

                    <Input
                      className="flex-1"
                      placeholder={`Texto da alternativa ${alt.letra}...`}
                      value={alt.texto}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormAlternativas((prev) =>
                          prev.map((item, i) => (i === aIdx ? { ...item, texto: val } : item))
                        );
                      }}
                      required
                    />
                  </div>

                  {!alt.correta && (
                    <div className="pl-6">
                      <Input
                        placeholder={`Por que errou na letra ${alt.letra}? (explicação pedagógica para o aluno)`}
                        value={alt.por_que_errou}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormAlternativas((prev) =>
                            prev.map((item, i) =>
                              i === aIdx ? { ...item, por_que_errou: val } : item
                            )
                          );
                        }}
                        required
                        className="text-xs text-slate-600 bg-white"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dica e Explicação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Dica pedagógica (opcional)
                </label>
                <Input
                  value={formDica}
                  onChange={(e) => setFormDica(e.target.value)}
                  placeholder="Ex.: Lembre-se que 25% é 1/4..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Explicação da resposta *
                </label>
                <Input
                  value={formExplicacao}
                  onChange={(e) => setFormExplicacao(e.target.value)}
                  placeholder="Ex.: Para achar 25%, divide-se por 4..."
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalQuestaoAberto(false)}
                disabled={salvandoQuestao}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={salvandoQuestao}>
                {editandoQuestaoId ? 'Salvar alterações' : 'Salvar no banco'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Novo Assunto */}
        <Modal
          isOpen={modalAssuntoAberto}
          onClose={() => setModalAssuntoAberto(false)}
          title="Novo Assunto"
          maxWidth="sm"
        >
          <form onSubmit={handleCriarAssunto} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nome do Assunto *
              </label>
              <Input
                value={novoAssuntoNome}
                onChange={(e) => setNovoAssuntoNome(e.target.value)}
                placeholder="Ex.: Equações de 1º Grau"
                required
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Válido para a matéria {combAtual?.disciplina_nome}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalAssuntoAberto(false)}
                disabled={salvandoAssunto}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={salvandoAssunto}>
                Criar assunto
              </Button>
            </div>
          </form>
        </Modal>

        {/* Confirmação de Arquivar */}
        <ConfirmDialog
          isOpen={!!questaoParaArquivar}
          onClose={() => setQuestaoParaArquivar(null)}
          onConfirm={handleConfirmarArquivar}
          title="Arquivar Questão"
          message="Tem certeza de que deseja arquivar esta questão? Ela não aparecerá mais em listagens nem será sorteada em novas atividades."
          confirmText="Sim, arquivar"
          cancelText="Cancelar"
          variant="danger"
          isLoading={arquivando}
        />
      </div>
    </AppShell>
  );
};

export default ProfessorBancoPage;
