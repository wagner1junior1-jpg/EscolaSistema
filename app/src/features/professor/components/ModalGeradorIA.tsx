import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Select,
  useToast,
  MathText,
} from '@/components/ui';
import {
  iaService,
  bancoService,
  Assunto,
  CombinacaoProfessor,
  DificuldadeQuestao,
  QuestaoSugeridaIA,
} from '@/services';
import { obterGeminiApiKey, salvarGeminiApiKeyLocal } from '@/services/mock/ia.mock';
import { reduzirImagem } from '@/lib/imagem';
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  X,
  HelpCircle,
  FolderPlus,
  ChevronDown,
} from 'lucide-react';

interface ModalGeradorIAProps {
  aberto: boolean;
  onFechar: () => void;
  disciplinaIdInicial: string;
  serieInicial: string;
  assuntoIdInicial?: string;
  combinacoes: CombinacaoProfessor[];
  assuntos: Assunto[];
  onCriarAssunto: (nome: string) => Promise<Assunto>;
  onSucesso: (totalNovasQuestoes: number) => void;
}

export const ModalGeradorIA: React.FC<ModalGeradorIAProps> = ({
  aberto,
  onFechar,
  disciplinaIdInicial,
  serieInicial,
  assuntoIdInicial,
  combinacoes,
  assuntos,
  onCriarAssunto,
  onSucesso,
}) => {
  const toast = useToast();

  // Etapa atual: 'formulario' ou 'revisao'
  const [etapa, setEtapa] = useState<'formulario' | 'revisao'>('formulario');

  // Dados do formulário
  const [combSelecionada, setCombSelecionada] = useState<string>('');
  const [assuntoId, setAssuntoId] = useState<string>('');
  const [novoAssuntoNome, setNovoAssuntoNome] = useState('');
  const [criandoAssunto, setCriandoAssunto] = useState(false);
  const [mostrarNovoAssunto, setMostrarNovoAssunto] = useState(false);

  // Parâmetros de quantidade
  const [qtdTotal, setQtdTotal] = useState<number>(20);
  const [qtdSubjetivas, setQtdSubjetivas] = useState<number>(5);
  const [dificuldade, setDificuldade] = useState<'misturada' | DificuldadeQuestao>('misturada');

  // Fotos e texto
  const [fotos, setFotos] = useState<string[]>([]);
  const [textoBase, setTextoBase] = useState<string>('');

  // Estados de carregamento
  const [carregandoIA, setCarregandoIA] = useState<boolean>(false);
  const [transcrevendo, setTranscrevendo] = useState<boolean>(false);
  const [salvandoLote, setSalvandoLote] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Questões geradas para revisão
  const [questoesSugeridas, setQuestoesSugeridas] = useState<QuestaoSugeridaIA[]>([]);
  const [aprovadasIds, setAprovadasIds] = useState<Set<string>>(new Set());
  const [questoesExpandidas, setQuestoesExpandidas] = useState<Set<string>>(new Set());

  const toggleExpandirQuestaoIA = (idTemp: string) => {
    setQuestoesExpandidas((prev) => {
      const novo = new Set(prev);
      if (novo.has(idTemp)) novo.delete(idTemp);
      else novo.add(idTemp);
      return novo;
    });
  };

  // Questão em edição na tela de revisão
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [editEnunciado, setEditEnunciado] = useState('');
  const [editRespostaEsperada, setEditRespostaEsperada] = useState('');

  // Configuração opcional de chave da API Gemini na interface
  const [mostrarConfigChave, setMostrarConfigChave] = useState(false);
  const [chaveGeminiInput, setChaveGeminiInput] = useState('');
  const temChaveAtiva = Boolean(obterGeminiApiKey());

  // Inicialização ao abrir modal
  useEffect(() => {
    if (aberto) {
      setEtapa('formulario');
      setErro(null);
      setQuestoesSugeridas([]);
      setAprovadasIds(new Set());
      setFotos([]);
      setTextoBase('');
      setQtdTotal(20);
      setQtdSubjetivas(5);
      setEditandoIndex(null);

      // Define combinação inicial
      if (disciplinaIdInicial && serieInicial) {
        setCombSelecionada(`${disciplinaIdInicial}__${serieInicial}`);
      } else if (combinacoes.length > 0) {
        setCombSelecionada(`${combinacoes[0].disciplina_id}__${combinacoes[0].serie}`);
      }

      // Define assunto inicial
      if (assuntoIdInicial) {
        setAssuntoId(assuntoIdInicial);
      } else if (assuntos.length > 0) {
        setAssuntoId(assuntos[0].id);
      } else {
        setAssuntoId('');
      }
    }
  }, [aberto, disciplinaIdInicial, serieInicial, assuntoIdInicial, combinacoes, assuntos]);

  // Separa disciplina_id e serie da combinação selecionada
  const [discIdAtual, serieAtual] = combSelecionada.split('__');
  const seriesDisponiveis = Array.from(new Set(combinacoes.map((c) => c.serie))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );
  const serieSelecionadaIA = serieAtual || seriesDisponiveis[0] || '';
  const materiasDaSerieIA = combinacoes.filter((c) => c.serie === serieSelecionadaIA);

  const handleMudarSerieIA = (novaSerie: string) => {
    const primeira = combinacoes.find((c) => c.serie === novaSerie);
    if (primeira) {
      setCombSelecionada(`${primeira.disciplina_id}__${primeira.serie}`);
    }
  };

  const qtdObjetivas = Math.max(0, qtdTotal - qtdSubjetivas);

  // Upload simulado/local de imagens
  const handleSelecionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files || files.length === 0) return;

    if (fotos.length + files.length > 5) {
      toast.warning('Você pode enviar no máximo 5 fotos por vez.');
      return;
    }

    for (const file of Array.from(files)) {
      try {
        const fotoReduzida = await reduzirImagem(file);
        setFotos((prev) => [...prev, fotoReduzida]);
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro ao processar imagem.';
        toast.warning(mensagem);
      }
    }

    input.value = '';
  };

  const handleRemoverFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Transcrição de foto em texto
  const handleTranscreverFotos = async () => {
    if (fotos.length === 0) {
      toast.info('Envie pelo menos uma foto para transcrever.');
      return;
    }
    setTranscrevendo(true);
    setErro(null);
    try {
      const texto = await iaService.transcreverImagem(fotos);
      setTextoBase((prev) => (prev ? `${prev}\n\n${texto}` : texto));
      toast.success('Texto extraído da imagem com sucesso!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao transcrever imagem.');
    } finally {
      setTranscrevendo(false);
    }
  };

  // Criação rápida de submatéria
  const handleSalvarNovoAssunto = async () => {
    if (!novoAssuntoNome.trim()) {
      toast.warning('Informe o nome da submatéria.');
      return;
    }
    setCriandoAssunto(true);
    try {
      const novo = await onCriarAssunto(novoAssuntoNome.trim());
      setAssuntoId(novo.id);
      setNovoAssuntoNome('');
      setMostrarNovoAssunto(false);
      toast.success(`Submatéria "${novo.nome}" cadastrada!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar submatéria.');
    } finally {
      setCriandoAssunto(false);
    }
  };

  // Gerar Questões
  const handleGerarQuestoes = async () => {
    setErro(null);

    if (!discIdAtual || !serieAtual) {
      setErro('Selecione a matéria e a série.');
      return;
    }
    if (!assuntoId) {
      setErro('Selecione ou crie uma submatéria para as questões.');
      return;
    }
    if (qtdTotal <= 0 || qtdTotal > 20) {
      setErro('A quantidade total deve ser entre 1 e 20 questões.');
      return;
    }

    setCarregandoIA(true);
    try {
      const resposta = await iaService.gerarQuestoes({
        disciplina_id: discIdAtual,
        serie: serieAtual,
        assunto_id: assuntoId,
        qtd_total: qtdTotal,
        qtd_objetivas: qtdObjetivas,
        qtd_discursivas: qtdSubjetivas,
        dificuldade,
        fotos: fotos.length > 0 ? fotos : undefined,
        texto_base: textoBase.trim() || undefined,
        anexar_foto: false,
      });

      setQuestoesSugeridas(resposta.questoes);
      setAprovadasIds(new Set());
      setEtapa('revisao');
      toast.success(
        `A IA gerou ${resposta.questoes.length} questões com sucesso! Revise e aprove as questões.`
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao processar geração com IA.');
    } finally {
      setCarregandoIA(false);
    }
  };

  // Salvar questão individual no banco
  const handleAprovarQuestao = async (q: QuestaoSugeridaIA) => {
    try {
      await bancoService.salvarQuestaoBanco({
        disciplina_id: discIdAtual,
        assunto_id: assuntoId,
        serie: serieAtual,
        tipo: q.tipo,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        dica: q.dica,
        explicacao: q.explicacao,
        resposta_esperada: q.resposta_esperada,
        imagem_url: q.imagem_url,
        origem: 'ia',
        alternativas: q.alternativas || [],
      });

      setAprovadasIds((prev) => new Set(prev).add(q.id_temp));
      toast.success('Questão aprovada e cadastrada no banco!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar questão.');
    }
  };

  // Descartar questão
  const handleDescartarQuestao = (idTemp: string) => {
    setQuestoesSugeridas((prev) => prev.filter((q) => q.id_temp !== idTemp));
    toast.info('Questão descartada.');
  };

  // Abrir edição rápida inline
  const handleIniciarEdicao = (index: number) => {
    const q = questoesSugeridas[index];
    setEditandoIndex(index);
    setEditEnunciado(q.enunciado);
    setEditRespostaEsperada(q.resposta_esperada || '');
  };

  const handleSalvarEdicao = (index: number) => {
    setQuestoesSugeridas((prev) => {
      const clone = [...prev];
      clone[index] = {
        ...clone[index],
        enunciado: editEnunciado.trim(),
        resposta_esperada: clone[index].tipo === 'discursiva' ? editRespostaEsperada.trim() : null,
      };
      return clone;
    });
    setEditandoIndex(null);
    toast.success('Alterações salvas na sugestão.');
  };

  // Aprovar Todas em lote
  const handleAprovarTodas = async () => {
    const pendentes = questoesSugeridas.filter((q) => !aprovadasIds.has(q.id_temp));
    if (pendentes.length === 0) {
      toast.info('Todas as questões já foram aprovadas.');
      onFechar();
      return;
    }

    setSalvandoLote(true);
    let salvas = 0;
    try {
      for (const q of pendentes) {
        await bancoService.salvarQuestaoBanco({
          disciplina_id: discIdAtual,
          assunto_id: assuntoId,
          serie: serieAtual,
          tipo: q.tipo,
          dificuldade: q.dificuldade,
          enunciado: q.enunciado,
          dica: q.dica,
          explicacao: q.explicacao,
          resposta_esperada: q.resposta_esperada,
          imagem_url: q.imagem_url,
          origem: 'ia',
          alternativas: q.alternativas || [],
        });
        salvas++;
      }

      toast.success(`${salvas} questões aprovadas e salvas com sucesso no banco!`);
      onSucesso(salvas);
      onFechar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar lote de questões.');
    } finally {
      setSalvandoLote(false);
    }
  };

  return (
    <Modal
      isOpen={aberto}
      onClose={onFechar}
      title={
        etapa === 'formulario'
          ? 'Cadastrar Questões por IA'
          : `Revisão das Questões Geradas (${questoesSugeridas.length})`
      }
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* =================================================================== */}
        {/* ETAPA 1: FORMULÁRIO DE ENTRADA E CONFIGURAÇÃO                       */}
        {/* =================================================================== */}
        {etapa === 'formulario' && (
          <div className="space-y-5">
            {/* Mensagem de topo + Status da Chave Gemini */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-900 leading-relaxed">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold">Assistente Pedagógico com IA</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          temChaveAtiva
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {temChaveAtiva ? 'Google Gemini Conectado' : 'Modo demonstração'}
                      </span>
                    </div>
                    Informe a matéria, a série, a submatéria e, se desejar, fotos ou o texto do conteúdo didático. A IA gerará até 20 questões com gabarito comentado para você revisar antes de salvar.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarConfigChave(!mostrarConfigChave)}
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline shrink-0 cursor-pointer"
                >
                  {mostrarConfigChave ? 'Fechar chave' : 'Chave API'}
                </button>
              </div>

              {mostrarConfigChave && (
                <div className="pt-2 border-t border-indigo-200/60 flex flex-col sm:flex-row gap-2">
                  <Input
                    type="password"
                    placeholder="Cole sua chave VITE_GEMINI_API_KEY (opcional se já estiver no .env)"
                    value={chaveGeminiInput}
                    onChange={(e) => setChaveGeminiInput(e.target.value)}
                    className="text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      salvarGeminiApiKeyLocal(chaveGeminiInput);
                      setMostrarConfigChave(false);
                      toast.success('Configuração da chave Gemini atualizada!');
                    }}
                  >
                    Salvar Chave
                  </Button>
                </div>
              )}
            </div>

            {erro && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {/* Hierarquia em Cascata: 1. Série e 2. Matéria (Linha 1) -> 3. Submatéria e 4. Dificuldade (Linha 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Série */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  1. Série *
                </label>
                <Select
                  value={serieSelecionadaIA}
                  onChange={(e) => handleMudarSerieIA(e.target.value)}
                  className="w-full font-semibold"
                >
                  {seriesDisponiveis.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 2. Matéria */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  2. Matéria *
                </label>
                <Select
                  value={combSelecionada}
                  onChange={(e) => setCombSelecionada(e.target.value)}
                  className="w-full font-semibold"
                >
                  {materiasDaSerieIA.map((c) => (
                    <option
                      key={`${c.disciplina_id}__${c.serie}`}
                      value={`${c.disciplina_id}__${c.serie}`}
                    >
                      {c.disciplina_nome}
                    </option>
                  ))}
                </Select>
              </div>

              {/* 3. Submatéria */}
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                    3. Submatéria *
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarNovoAssunto(!mostrarNovoAssunto)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{mostrarNovoAssunto ? 'Cancelar' : '+ Nova submatéria'}</span>
                  </button>
                </div>

                {mostrarNovoAssunto ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Ex: Porcentagem, Adição..."
                      value={novoAssuntoNome}
                      onChange={(e) => setNovoAssuntoNome(e.target.value)}
                      className="text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleSalvarNovoAssunto}
                      isLoading={criandoAssunto}
                      className="shrink-0"
                    >
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={assuntoId}
                    onChange={(e) => setAssuntoId(e.target.value)}
                    className="w-full"
                  >
                    {assuntos.length === 0 ? (
                      <option value="">Nenhuma submatéria cadastrada</option>
                    ) : (
                      assuntos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                        </option>
                      ))
                    )}
                  </Select>
                )}
              </div>

              {/* 4. Dificuldade */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  4. Dificuldade
                </label>
                <Select
                  value={dificuldade}
                  onChange={(e) =>
                    setDificuldade(e.target.value as 'misturada' | DificuldadeQuestao)
                  }
                  className="w-full"
                >
                  <option value="misturada">Misturada (Todas)</option>
                  <option value="facil">Fácil</option>
                  <option value="medio">Médio</option>
                  <option value="dificil">Difícil</option>
                </Select>
              </div>
            </div>

            {/* Controle de Quantidades (escolha de 1 a 20) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-heading font-black text-sm text-slate-800">
                    Quantidade de Questões (Limite de 20 por vez)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Escolha o total (máx. 20) e quantas serão discursivas/subjetivas.
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xl text-indigo-600">{qtdTotal}</span>
                  <span className="text-xs font-bold text-slate-400 block">questões</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                {/* Seletor de Total */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <label className="text-slate-700">Total de questões:</label>
                    <span className="text-indigo-600 font-mono text-sm">{qtdTotal}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={qtdTotal}
                    onChange={(e) => {
                      const novoTotal = Number(e.target.value);
                      setQtdTotal(novoTotal);
                      if (qtdSubjetivas > novoTotal) setQtdSubjetivas(novoTotal);
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>1 questão</span>
                    <span>20 questões</span>
                  </div>
                </div>

                {/* Seletor de Subjetivas */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <label className="text-slate-700">Discursivas (subjetivas):</label>
                    <span className="text-indigo-600 font-mono text-sm">{qtdSubjetivas}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={qtdTotal}
                    value={qtdSubjetivas}
                    onChange={(e) => setQtdSubjetivas(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>0 discursivas</span>
                    <span>{qtdTotal} discursivas</span>
                  </div>
                </div>
              </div>

              {/* Resumo da Distribuição */}
              <div className="flex items-center justify-around bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-center">
                  <span className="text-xs text-slate-500 font-semibold block">Objetivas</span>
                  <span className="font-heading font-black text-lg text-emerald-600">
                    {qtdObjetivas}
                  </span>
                </div>
                <div className="text-slate-300 text-lg font-light">+</div>
                <div className="text-center">
                  <span className="text-xs text-slate-500 font-semibold block">Discursivas</span>
                  <span className="font-heading font-black text-lg text-indigo-600">
                    {qtdSubjetivas}
                  </span>
                </div>
                <div className="text-slate-300 text-lg font-light">=</div>
                <div className="text-center">
                  <span className="text-xs text-slate-500 font-semibold block">Total</span>
                  <span className="font-heading font-black text-lg text-slate-800">
                    {qtdTotal}
                  </span>
                </div>
              </div>
            </div>

            {/* Upload de Fotos & Transcrição */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Fotos do Livro / Caderno (Opcional - até 5 imagens)
                </label>
                {fotos.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<FileText className="w-3.5 h-3.5 text-indigo-600" />}
                    onClick={handleTranscreverFotos}
                    isLoading={transcrevendo}
                    className="text-xs"
                  >
                    Transcrever texto da foto
                  </Button>
                )}
              </div>

              {/* Área de drop/botão de upload */}
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-5 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="ia-fotos-input"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleSelecionarFoto}
                  className="sr-only"
                />
                <label
                  htmlFor="ia-fotos-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-indigo-600 hover:underline">
                      Clique para escolher fotos
                    </span>
                    <span className="text-xs text-slate-500 block">
                      JPG, PNG ou WEBP (máx. 5 fotos)
                    </span>
                  </div>
                </label>
              </div>

              {/* Miniaturas de fotos anexadas */}
              {fotos.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {fotos.map((foto, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 shadow-xs group"
                    >
                      <img
                        src={foto}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoverFoto(idx)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 cursor-pointer shadow-xs"
                        title="Remover foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}


              {/* Texto Base / Anotações */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Texto de apoio / Transcrição (Opcional)
                </label>
                <Textarea
                  placeholder="Cole aqui o texto da aula, resumo da matéria ou trechos transcritos do material didático..."
                  value={textoBase}
                  onChange={(e) => setTextoBase(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>

              {/* Aviso de conformidade / privacidade */}
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Aviso:</strong> Não envie fotos com nomes, notas ou dados de alunos.
                </span>
              </div>
            </div>

            {/* Ações do Formulário */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button variant="outline" onClick={onFechar} disabled={carregandoIA}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                leftIcon={
                  carregandoIA ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )
                }
                onClick={handleGerarQuestoes}
                isLoading={carregandoIA}
                disabled={carregandoIA || !assuntoId}
              >
                Gerar {qtdTotal} questões com IA
              </Button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* ETAPA 2: TELA DE REVISÃO E APROVAÇÃO DAS QUESTÕES                  */}
        {/* =================================================================== */}
        {etapa === 'revisao' && (
          <div className="space-y-5">
            {/* Barra superior de resumo e ações em lote */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => setEtapa('formulario')}
                  className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 mb-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar aos parâmetros</span>
                </button>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-black text-base text-slate-800">
                    {questoesSugeridas.length} Questões Geradas
                  </h3>
                  <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                    {aprovadasIds.size} salvas
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setQuestoesExpandidas(
                      questoesExpandidas.size === questoesSugeridas.length
                        ? new Set()
                        : new Set(questoesSugeridas.map((q) => q.id_temp))
                    )
                  }
                >
                  {questoesExpandidas.size === questoesSugeridas.length
                    ? 'Recolher todas'
                    : 'Expandir todas'}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={handleAprovarTodas}
                  isLoading={salvandoLote}
                >
                  Aprovar todas para o Banco
                </Button>
              </div>
            </div>

            {/* Lista de cartões em formato 1 linha (clica para abrir) */}
            <div className="space-y-2.5">
              {questoesSugeridas.map((q, idx) => {
                const isAprovada = aprovadasIds.has(q.id_temp);
                const isEditando = editandoIndex === idx;
                const isExpanded = isEditando || questoesExpandidas.has(q.id_temp);

                return (
                  <div
                    key={q.id_temp}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isAprovada
                        ? 'bg-emerald-50/40 border-emerald-300'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Linha única compacta da pergunta — clica na linha para abrir */}
                    <div
                      onClick={() => toggleExpandirQuestaoIA(q.id_temp)}
                      className={`py-2.5 px-4 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${
                        isExpanded
                          ? 'bg-slate-50/90 border-b border-slate-200'
                          : 'bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-heading font-black text-xs text-slate-700 shrink-0">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0 ${
                            q.tipo === 'discursiva'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {q.tipo === 'discursiva' ? 'Subjetiva (Discursiva)' : 'Objetiva'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                          {q.dificuldade}
                        </span>
                        {q.avisos && q.avisos.length > 0 && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 shrink-0 flex items-center gap-1"
                            title={q.avisos.join('; ')}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-700" />
                            {q.avisos.length} {q.avisos.length === 1 ? 'aviso' : 'avisos'}
                          </span>
                        )}

                        {/* APENAS 1 LINHA DA PERGUNTA */}
                        <span
                          className="text-xs sm:text-sm font-medium text-slate-800 truncate flex-1 min-w-0"
                          title={q.enunciado}
                        >
                          {q.enunciado}
                        </span>
                      </div>

                      {/* Status ou Ações */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isAprovada ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-100 px-2.5 py-1 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Salva no Banco
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                isEditando ? setEditandoIndex(null) : handleIniciarEdicao(idx)
                              }
                              className="text-xs text-slate-600 hover:text-indigo-600"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              {isEditando ? 'Cancelar' : 'Editar'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAprovarQuestao(q)}
                              className="text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDescartarQuestao(q.id_temp)}
                              className="text-xs text-rose-600 hover:bg-rose-50"
                              title="Descartar esta sugestão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleExpandirQuestaoIA(q.id_temp)}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title={isExpanded ? 'Recolher detalhes' : 'Abrir pergunta'}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Detalhes Expandidos ao Clicar na Linha */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-3 bg-white">
                        {isEditando ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Enunciado:
                              </label>
                              <Textarea
                                value={editEnunciado}
                                onChange={(e) => setEditEnunciado(e.target.value)}
                                rows={3}
                                className="text-sm"
                              />
                            </div>

                            {q.tipo === 'discursiva' && (
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Resposta Esperada (Gabarito do professor):
                                </label>
                                <Textarea
                                  value={editRespostaEsperada}
                                  onChange={(e) => setEditRespostaEsperada(e.target.value)}
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                              <Button size="sm" variant="outline" onClick={() => setEditandoIndex(null)}>
                                Cancelar
                              </Button>
                              <Button size="sm" variant="primary" onClick={() => handleSalvarEdicao(idx)}>
                                Salvar edição
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Avisos pedagógicos diagnosticados pela IA */}
                            {q.avisos && q.avisos.length > 0 && (
                              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                  <p className="font-bold text-[11px] uppercase tracking-wider text-amber-800">
                                    Avisos para Revisão Docente:
                                  </p>
                                  {q.avisos.map((aviso, aIdx) => (
                                    <p key={aIdx} className="leading-relaxed">
                                      • {aviso}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Enunciado Completo */}
                            <div className="text-sm font-medium text-slate-800 leading-relaxed">
                              <MathText text={q.enunciado} />
                            </div>

                            {/* Imagem de apoio anexada */}
                            {q.imagem_url && (
                              <div className="w-48 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                                <img
                                  src={q.imagem_url}
                                  alt="Apoio da questão"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {/* Corpo: Alternativas para Objetiva */}
                            {q.tipo === 'objetiva' && q.alternativas && (
                              <div className="space-y-2 pt-1">
                                {q.alternativas.map((alt) => (
                                  <div
                                    key={alt.letra}
                                    className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
                                      alt.correta
                                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold'
                                        : 'bg-slate-50/80 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                                          alt.correta
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-200 text-slate-700'
                                        }`}
                                      >
                                        {alt.letra}
                                      </span>
                                      <span>
                                        <MathText text={alt.texto} />
                                      </span>
                                      {alt.correta && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded ml-auto">
                                          Correta
                                        </span>
                                      )}
                                    </div>
                                    {!alt.correta && alt.por_que_errou && (
                                      <div className="text-[11px] text-slate-500 pl-7 italic">
                                        Por que errou: <MathText text={alt.por_que_errou} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Corpo: Gabarito / Resposta Esperada para Discursiva */}
                            {q.tipo === 'discursiva' && (
                              <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 space-y-1">
                                <span className="font-bold block text-purple-800">
                                  Resposta Esperada (Gabarito do professor):
                                </span>
                                <div className="leading-relaxed">
                                  <MathText text={q.resposta_esperada} />
                                </div>
                              </div>
                            )}

                            {/* Dica e Explicação */}
                            {(q.dica || q.explicacao) && (
                              <div className="text-xs text-slate-500 pt-1 space-y-0.5 border-t border-slate-100">
                                {q.dica && (
                                  <p>
                                    <strong>Dica:</strong> <MathText text={q.dica} />
                                  </p>
                                )}
                                {q.explicacao && (
                                  <p>
                                    <strong>Explicação:</strong> <MathText text={q.explicacao} />
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ações Inferiores da Revisão */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => setEtapa('formulario')}
              >
                Voltar aos parâmetros
              </Button>
              <Button
                variant="primary"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleAprovarTodas}
                isLoading={salvandoLote}
              >
                Aprovar todas para o Banco
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ModalGeradorIA;
