import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Modal,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import {
  gestaoService,
  Turma,
  OfertaDetalhada,
  Disciplina,
  Perfil,
  SegmentoTurma,
  Escola,
} from '@/services';
import {
  GraduationCap,
  Plus,
  Edit3,
  Copy,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  BookOpen,
  UserCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

const CONSOANTES = 'BCDFGHJKLMNPQRSTVWXYZ';

export function gerarCodigoAcessoSugerido(serie: string = '', nome: string = ''): string {
  const numMatch = serie.match(/\d+/) || nome.match(/\d+/);
  const num = numMatch ? numMatch[0] : '';
  const words = nome.trim().split(/\s+/);
  const lastWord = words[words.length - 1]?.toUpperCase() || '';
  const letter = /^[A-Z]$/.test(lastWord)
    ? lastWord
    : (nome.match(/[A-Za-z]/)?.[0]?.toUpperCase() || 'A');

  const prefixo = `${num}${letter}` || 'TUR';
  let rand = '';
  for (let i = 0; i < 3; i++) {
    rand += CONSOANTES.charAt(Math.floor(Math.random() * CONSOANTES.length));
  }
  return `${prefixo}-${rand}`.toUpperCase();
}

export const GestaoTurmasSecao: React.FC = () => {
  const toast = useToast();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [ofertas, setOfertas] = useState<OfertaDetalhada[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [professores, setProfessores] = useState<Perfil[]>([]);
  const [escola, setEscola] = useState<Escola | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Busca e filtros
  const [busca, setBusca] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todos');

  // Turmas expandidas para ver ofertas
  const [turmasExpandidas, setTurmasExpandidas] = useState<Record<string, boolean>>({});

  // Cópia de código
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Modal Criar / Editar Turma
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);
  const [editandoTurmaId, setEditandoTurmaId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formSerie, setFormSerie] = useState('');
  const [formSegmento, setFormSegmento] = useState<SegmentoTurma>('fund2');
  const [formAnoLetivo, setFormAnoLetivo] = useState(2026);
  const [formCodigoAcesso, setFormCodigoAcesso] = useState('');
  const [formAtiva, setFormAtiva] = useState(true);
  const [salvandoTurma, setSalvandoTurma] = useState(false);
  const [erroFormTurma, setErroFormTurma] = useState<string | null>(null);

  // Modal Adicionar Oferta
  const [modalOfertaAberto, setModalOfertaAberto] = useState(false);
  const [ofertaTurmaAlvo, setOfertaTurmaAlvo] = useState<Turma | null>(null);
  const [ofertaDisciplinaId, setOfertaDisciplinaId] = useState('');
  const [ofertaProfessorId, setOfertaProfessorId] = useState('');
  const [salvandoOferta, setSalvandoOferta] = useState(false);
  const [erroFormOferta, setErroFormOferta] = useState<string | null>(null);

  // Excluir Oferta Confirmação
  const [ofertaParaExcluir, setOfertaParaExcluir] = useState<OfertaDetalhada | null>(null);
  const [excluindoOferta, setExcluindoOferta] = useState(false);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [tList, oList, dList, pList, esc] = await Promise.all([
        gestaoService.listarTurmas(),
        gestaoService.listarOfertas(),
        gestaoService.listarDisciplinas(),
        gestaoService.listarProfessores(),
        gestaoService.obterEscola(),
      ]);
      setTurmas(tList);
      setOfertas(oList);
      setDisciplinas(dList);
      setProfessores(pList);
      setEscola(esc);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar dados de turmas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const toggleExpandir = (turmaId: string) => {
    setTurmasExpandidas((prev) => ({
      ...prev,
      [turmaId]: !prev[turmaId],
    }));
  };

  const copiarCodigo = async (codigo: string, id: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiadoId(id);
      toast.success(`Código ${codigo} copiado!`);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      toast.error('Erro ao copiar código.');
    }
  };

  const abrirCriarTurma = () => {
    setEditandoTurmaId(null);
    setFormNome('');
    setFormSerie('');
    setFormSegmento('fund2');
    setFormAnoLetivo(escola?.ano_letivo_atual || 2026);
    setFormCodigoAcesso(gerarCodigoAcessoSugerido('7º Ano', '7º Ano A'));
    setFormAtiva(true);
    setErroFormTurma(null);
    setModalTurmaAberto(true);
  };

  const abrirEditarTurma = (t: Turma) => {
    setEditandoTurmaId(t.id);
    setFormNome(t.nome);
    setFormSerie(t.serie);
    setFormSegmento(t.segmento);
    setFormAnoLetivo(t.ano_letivo);
    setFormCodigoAcesso(t.codigo_acesso);
    setFormAtiva(t.ativa);
    setErroFormTurma(null);
    setModalTurmaAberto(true);
  };

  const handleSalvarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formSerie.trim() || !formCodigoAcesso.trim()) {
      setErroFormTurma('Preencha todos os campos obrigatórios.');
      return;
    }

    setSalvandoTurma(true);
    setErroFormTurma(null);
    try {
      if (editandoTurmaId) {
        await gestaoService.atualizarTurma(editandoTurmaId, {
          nome: formNome.trim(),
          serie: formSerie.trim(),
          segmento: formSegmento,
          ano_letivo: formAnoLetivo,
          codigo_acesso: formCodigoAcesso.trim().toUpperCase(),
          ativa: formAtiva,
        });
        toast.success('Turma atualizada com sucesso!');
      } else {
        if (!escola) throw new Error('Escola não configurada.');
        await gestaoService.criarTurma({
          escola_id: escola.id,
          nome: formNome.trim(),
          serie: formSerie.trim(),
          segmento: formSegmento,
          ano_letivo: formAnoLetivo,
          codigo_acesso: formCodigoAcesso.trim().toUpperCase(),
          ativa: formAtiva,
        });
        toast.success('Turma cadastrada com sucesso!');
      }
      setModalTurmaAberto(false);
      await carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar turma.';
      setErroFormTurma(msg);
      toast.error(msg);
    } finally {
      setSalvandoTurma(false);
    }
  };

  const abrirAdicionarOferta = (turma: Turma) => {
    setOfertaTurmaAlvo(turma);
    setOfertaDisciplinaId(disciplinas[0]?.id || '');
    setOfertaProfessorId(professores[0]?.id || '');
    setErroFormOferta(null);
    setModalOfertaAberto(true);
  };

  const handleSalvarOferta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertaTurmaAlvo || !ofertaDisciplinaId || !ofertaProfessorId) {
      setErroFormOferta('Selecione a disciplina e o professor.');
      return;
    }

    setSalvandoOferta(true);
    setErroFormOferta(null);
    try {
      await gestaoService.criarOferta({
        turma_id: ofertaTurmaAlvo.id,
        disciplina_id: ofertaDisciplinaId,
        professor_id: ofertaProfessorId,
      });
      toast.success('Oferta adicionada com sucesso!');
      setModalOfertaAberto(false);
      // Garantir que a turma fique expandida
      setTurmasExpandidas((prev) => ({ ...prev, [ofertaTurmaAlvo.id]: true }));
      await carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao adicionar oferta.';
      setErroFormOferta(msg);
      toast.error(msg);
    } finally {
      setSalvandoOferta(false);
    }
  };

  const handleConfirmarExclusaoOferta = async () => {
    if (!ofertaParaExcluir) return;

    setExcluindoOferta(true);
    try {
      await gestaoService.excluirOferta(ofertaParaExcluir.id);
      toast.success('Oferta removida com sucesso!');
      setOfertaParaExcluir(null);
      await carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover oferta.';
      toast.error(msg);
    } finally {
      setExcluindoOferta(false);
    }
  };

  const turmasFiltradas = turmas.filter((t) => {
    const atendeBusca =
      t.nome.toLowerCase().includes(busca.toLowerCase().trim()) ||
      t.serie.toLowerCase().includes(busca.toLowerCase().trim()) ||
      t.codigo_acesso.toLowerCase().includes(busca.toLowerCase().trim());
    const atendeSegmento = filtroSegmento === 'todos' || t.segmento === filtroSegmento;
    return atendeBusca && atendeSegmento;
  });

  const getSegmentoLabel = (seg: SegmentoTurma) => {
    switch (seg) {
      case 'fund1':
        return 'Ensino Fund. I';
      case 'fund2':
        return 'Ensino Fund. II';
      case 'medio':
        return 'Ensino Médio';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            Turmas
          </h2>
          <p className="text-sm text-slate-500">
            Cadastre turmas, códigos de acesso para os alunos e associe disciplinas e professores.
          </p>
        </div>

        <Button onClick={abrirCriarTurma} className="flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          Nova Turma
        </Button>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, série ou código..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>

        <select
          value={filtroSegmento}
          onChange={(e) => setFiltroSegmento(e.target.value)}
          aria-label="Filtrar por segmento"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="todos">Todos os Segmentos</option>
          <option value="fund1">Fundamental I</option>
          <option value="fund2">Fundamental II</option>
          <option value="medio">Ensino Médio</option>
        </select>
      </div>

      {/* Lista de Turmas */}
      {carregando ? (
        <div className="p-12 text-center text-slate-400 flex justify-center items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Carregando turmas...</span>
        </div>
      ) : turmasFiltradas.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 space-y-2">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">Nenhuma turma encontrada.</p>
          <p className="text-xs text-slate-400">
            {busca || filtroSegmento !== 'todos'
              ? 'Tente ajustar os filtros de busca.'
              : 'Clique em "Nova Turma" para cadastrar a primeira.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {turmasFiltradas.map((turma) => {
            const ofertasDaTurma = ofertas.filter((o) => o.turma_id === turma.id);
            const expandida = !!turmasExpandidas[turma.id];

            return (
              <Card key={turma.id} className="overflow-hidden border-slate-200">
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                  {/* Informações Principais */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading font-black text-lg text-slate-900">
                        {turma.nome}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                        {getSegmentoLabel(turma.segmento)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                        Ano {turma.ano_letivo}
                      </span>
                      {!turma.ativa && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700">
                          Inativa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Série: <span className="font-medium text-slate-700">{turma.serie}</span> •{' '}
                      {ofertasDaTurma.length} disciplina{ofertasDaTurma.length !== 1 ? 's' : ''} ofertada{ofertasDaTurma.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Código de Acesso em Destaque */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 shadow-sm">
                      <div className="text-left mr-3">
                        <span className="block text-[9px] uppercase font-bold text-indigo-500 leading-tight">
                          Código de Acesso
                        </span>
                        <span className="font-mono font-black text-sm tracking-wider text-indigo-950">
                          {turma.codigo_acesso}
                        </span>
                      </div>
                      <button
                        onClick={() => copiarCodigo(turma.codigo_acesso, turma.id)}
                        className="p-1 rounded text-indigo-600 hover:bg-indigo-100 transition-colors"
                        title="Copiar código de acesso"
                      >
                        {copiadoId === turma.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirEditarTurma(turma)}
                        className="text-xs flex items-center gap-1"
                        title="Editar dados da turma"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpandir(turma.id)}
                        className="text-xs flex items-center gap-1 text-slate-600"
                        title={expandida ? 'Recolher ofertas' : 'Ver ofertas'}
                      >
                        <span>Ofertas ({ofertasDaTurma.length})</span>
                        {expandida ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Seção de Ofertas Vinculadas (Expandível) */}
                {expandida && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                        Disciplinas e Professores Associados
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => abrirAdicionarOferta(turma)}
                        className="text-xs flex items-center gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Oferta
                      </Button>
                    </div>

                    {ofertasDaTurma.length === 0 ? (
                      <div className="p-4 bg-white rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500">
                        Nenhuma oferta vinculada a esta turma ainda. Clique em "Adicionar Oferta"
                        para vincular disciplinas e professores.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ofertasDaTurma.map((of) => (
                          <div
                            key={of.id}
                            className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <p className="font-bold text-sm text-slate-800 truncate">
                                {of.disciplina_nome}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                                <UserCheck className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{of.professor_nome}</span>
                              </p>
                            </div>

                            <button
                              onClick={() => setOfertaParaExcluir(of)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors flex-shrink-0"
                              title="Remover oferta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Criar / Editar Turma */}
      <Modal
        isOpen={modalTurmaAberto}
        onClose={() => !salvandoTurma && setModalTurmaAberto(false)}
        title={editandoTurmaId ? 'Editar Turma' : 'Nova Turma'}
      >
        <form onSubmit={handleSalvarTurma} className="space-y-4">
          <Input
            label="Nome da Turma"
            value={formNome}
            onChange={(e) => {
              const val = e.target.value;
              setFormNome(val);
              if (!editandoTurmaId) {
                setFormCodigoAcesso(gerarCodigoAcessoSugerido(formSerie, val));
              }
            }}
            placeholder="Ex: 7º Ano A"
            required
            disabled={salvandoTurma}
          />

          <Input
            label="Série / Ano"
            value={formSerie}
            onChange={(e) => {
              const val = e.target.value;
              setFormSerie(val);
              if (!editandoTurmaId) {
                setFormCodigoAcesso(gerarCodigoAcessoSugerido(val, formNome));
              }
            }}
            placeholder="Ex: 7º Ano"
            required
            disabled={salvandoTurma}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Segmento Escolar
              </label>
              <select
                value={formSegmento}
                onChange={(e) => setFormSegmento(e.target.value as SegmentoTurma)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={salvandoTurma}
              >
                <option value="fund1">Fundamental I</option>
                <option value="fund2">Fundamental II</option>
                <option value="medio">Ensino Médio</option>
              </select>
            </div>

            <div>
              <Input
                label="Ano Letivo"
                type="number"
                value={formAnoLetivo}
                onChange={(e) => setFormAnoLetivo(Number(e.target.value))}
                required
                disabled={salvandoTurma}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Código de Acesso dos Alunos
              </label>
              <button
                type="button"
                onClick={() => setFormCodigoAcesso(gerarCodigoAcessoSugerido(formSerie, formNome))}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Sugerir novo
              </button>
            </div>
            <Input
              value={formCodigoAcesso}
              onChange={(e) => setFormCodigoAcesso(e.target.value.toUpperCase())}
              placeholder="Ex: 7A-KRT"
              required
              disabled={salvandoTurma}
              className="font-mono uppercase font-bold tracking-wider"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Sugestão automática: série + letra + 3 consoantes. Os alunos usarão este código para entrar.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="turmaAtivaCheck"
              checked={formAtiva}
              onChange={(e) => setFormAtiva(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              disabled={salvandoTurma}
            />
            <label htmlFor="turmaAtivaCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
              Turma ativa no ano letivo
            </label>
          </div>

          {erroFormTurma && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroFormTurma}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalTurmaAberto(false)}
              disabled={salvandoTurma}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvandoTurma} className="flex items-center gap-2">
              {salvandoTurma && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvandoTurma ? 'Salvando...' : 'Salvar Turma'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Adicionar Oferta */}
      <Modal
        isOpen={modalOfertaAberto}
        onClose={() => !salvandoOferta && setModalOfertaAberto(false)}
        title={`Adicionar Oferta — ${ofertaTurmaAlvo?.nome || ''}`}
      >
        <form onSubmit={handleSalvarOferta} className="space-y-4">
          <p className="text-xs text-slate-500">
            Associe uma disciplina e o respectivo professor responsável para esta turma.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Disciplina
            </label>
            <select
              value={ofertaDisciplinaId}
              onChange={(e) => setOfertaDisciplinaId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              disabled={salvandoOferta}
            >
              <option value="" disabled>Selecione uma disciplina...</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Professor Responsável
            </label>
            <select
              value={ofertaProfessorId}
              onChange={(e) => setOfertaProfessorId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              disabled={salvandoOferta}
            >
              <option value="" disabled>Selecione um professor...</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.email || 'sem e-mail'})
                </option>
              ))}
            </select>
          </div>

          {erroFormOferta && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroFormOferta}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOfertaAberto(false)}
              disabled={salvandoOferta}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvandoOferta} className="flex items-center gap-2">
              {salvandoOferta && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvandoOferta ? 'Adicionando...' : 'Adicionar Oferta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmação de Exclusão de Oferta */}
      <ConfirmDialog
        isOpen={!!ofertaParaExcluir}
        onClose={() => setOfertaParaExcluir(null)}
        onConfirm={handleConfirmarExclusaoOferta}
        title="Remover Oferta"
        message={`Tem certeza que deseja remover a oferta de "${ofertaParaExcluir?.disciplina_nome}" com o professor "${ofertaParaExcluir?.professor_nome}"? Se houver atividades cadastradas, a remoção será bloqueada.`}
        confirmText={excluindoOferta ? 'Removendo...' : 'Sim, remover'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={excluindoOferta}
      />
    </div>
  );
};
