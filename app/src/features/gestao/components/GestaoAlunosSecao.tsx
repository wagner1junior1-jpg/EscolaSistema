import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Modal,
  useToast,
} from '@/components/ui';
import {
  gestaoService,
  Turma,
  AlunoPublico,
  Escola,
} from '@/services';
import {
  GraduationCap,
  Plus,
  Edit3,
  Key,
  Printer,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Search,
  Users,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { FilipetasImpressao, PinGeradoItem } from './FilipetasImpressao';

export const GestaoAlunosSecao: React.FC = () => {
  const toast = useToast();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [escola, setEscola] = useState<Escola | null>(null);
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string>('');
  const [alunos, setAlunos] = useState<AlunoPublico[]>([]);

  const [carregandoTurmas, setCarregandoTurmas] = useState(true);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca e Filtro
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('ativos');

  // Modal Novo Aluno Individual
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoNumero, setNovoNumero] = useState<number>(1);
  const [novoPin, setNovoPin] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  // Modal Lote
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [textoLote, setTextoLote] = useState('');
  const [salvandoLote, setSalvandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);

  // Modal Editar Aluno
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [editandoAluno, setEditandoAluno] = useState<AlunoPublico | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editNumero, setEditNumero] = useState<number>(1);
  const [editAtivo, setEditAtivo] = useState(true);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroEdit, setErroEdit] = useState<string | null>(null);

  // Reset Individual
  const [alunoParaResetPin, setAlunoParaResetPin] = useState<AlunoPublico | null>(null);
  const [resetandoPinIndividual, setResetandoPinIndividual] = useState(false);
  const [modoResetPin, setModoResetPin] = useState<'manual' | 'automatico'>('manual');
  const [resetPinValor, setResetPinValor] = useState('');
  const [erroResetPin, setErroResetPin] = useState<string | null>(null);

  // Reset Geral de Turma
  const [modalResetGeralAberto, setModalResetGeralAberto] = useState(false);
  const [confirmacaoTextoTurma, setConfirmacaoTextoTurma] = useState('');
  const [resetandoGeral, setResetandoGeral] = useState(false);

  // Modal PINs Gerados
  const [pinsGerados, setPinsGerados] = useState<PinGeradoItem[]>([]);
  const [modalPinsAberto, setModalPinsAberto] = useState(false);
  const [pinCopiadoId, setPinCopiadoId] = useState<string | null>(null);

  const carregarTurmasEEscola = useCallback(async () => {
    setCarregandoTurmas(true);
    setErro(null);
    try {
      const [tList, esc] = await Promise.all([
        gestaoService.listarTurmas(),
        gestaoService.obterEscola(),
      ]);
      setTurmas(tList);
      setEscola(esc);
      if (tList.length > 0 && !turmaSelecionadaId) {
        setTurmaSelecionadaId(tList[0].id);
      }
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar turmas.');
    } finally {
      setCarregandoTurmas(false);
    }
  }, [turmaSelecionadaId]);

  useEffect(() => {
    carregarTurmasEEscola();
  }, [carregarTurmasEEscola]);

  const carregarAlunosDaTurma = useCallback(async (turmaId: string) => {
    if (!turmaId) {
      setAlunos([]);
      return;
    }
    setCarregandoAlunos(true);
    try {
      const lista = await gestaoService.listarAlunos(turmaId);
      setAlunos(lista);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao listar alunos da turma.');
    } finally {
      setCarregandoAlunos(false);
    }
  }, [toast]);

  useEffect(() => {
    if (turmaSelecionadaId) {
      carregarAlunosDaTurma(turmaSelecionadaId);
    }
  }, [turmaSelecionadaId, carregarAlunosDaTurma]);

  const turmaAtual = turmas.find((t) => t.id === turmaSelecionadaId);

  const copiarPin = async (pin: string, id: string) => {
    try {
      await navigator.clipboard.writeText(pin);
      setPinCopiadoId(id);
      toast.success('PIN copiado!');
      setTimeout(() => setPinCopiadoId(null), 2000);
    } catch {
      toast.error('Erro ao copiar PIN.');
    }
  };

  const imprimirFilipetas = () => {
    window.print();
  };

  // Abrir Novo Aluno Individual
  const abrirNovoAluno = () => {
    const proximoNumero = alunos.reduce((max, a) => (a.numero_chamada > max ? a.numero_chamada : max), 0) + 1;
    setNovoNome('');
    setNovoNumero(proximoNumero);
    setNovoPin('');
    setErroNovo(null);
    setModalNovoAberto(true);
  };

  const handleSalvarNovoAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setErroNovo('Informe o nome completo do aluno.');
      return;
    }
    if (!escola || !turmaAtual) {
      setErroNovo('Escola ou turma não selecionada.');
      return;
    }

    const pinLimpo = novoPin.trim();
    if (pinLimpo && !/^\d{4}$/.test(pinLimpo)) {
      setErroNovo('O PIN deve conter exatamente 4 números (ou deixe em branco para gerar automaticamente).');
      return;
    }

    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      const resultado = await gestaoService.cadastrarAluno({
        escola_id: escola.id,
        turma_id: turmaAtual.id,
        nome_completo: novoNome.trim(),
        numero_chamada: novoNumero,
        ativo: true,
        pin: pinLimpo || undefined,
      });

      toast.success('Aluno cadastrado com sucesso!');
      setModalNovoAberto(false);
      await carregarAlunosDaTurma(turmaAtual.id);

      // Exibir modal com PIN gerado
      setPinsGerados([{ aluno: resultado.aluno, pin_puro: resultado.pin_puro }]);
      setModalPinsAberto(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar aluno.';
      setErroNovo(msg);
      toast.error(msg);
    } finally {
      setSalvandoNovo(false);
    }
  };

  // Cadastrar em Lote
  const abrirLote = () => {
    setTextoLote('');
    setErroLote(null);
    setModalLoteAberto(true);
  };

  const handleSalvarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    const linhas = textoLote
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (linhas.length === 0) {
      setErroLote('Informe pelo menos um nome para cadastrar.');
      return;
    }

    if (!turmaAtual) return;

    setSalvandoLote(true);
    setErroLote(null);
    try {
      const resultados = await gestaoService.cadastrarAlunosEmLote(turmaAtual.id, linhas);
      toast.success(`${resultados.length} alunos cadastrados com sucesso!`);
      setModalLoteAberto(false);
      await carregarAlunosDaTurma(turmaAtual.id);

      // Exibir modal com todos os PINs gerados
      setPinsGerados(resultados);
      setModalPinsAberto(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar alunos em lote.';
      setErroLote(msg);
      toast.error(msg);
    } finally {
      setSalvandoLote(false);
    }
  };

  // Editar Aluno
  const abrirEditarAluno = (aluno: AlunoPublico) => {
    setEditandoAluno(aluno);
    setEditNome(aluno.nome_completo);
    setEditNumero(aluno.numero_chamada);
    setEditAtivo(aluno.ativo);
    setErroEdit(null);
    setModalEditarAberto(true);
  };

  const handleSalvarEditAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoAluno) return;
    if (!editNome.trim()) {
      setErroEdit('Informe o nome do aluno.');
      return;
    }

    setSalvandoEdit(true);
    setErroEdit(null);
    try {
      await gestaoService.atualizarAluno(editandoAluno.id, {
        nome_completo: editNome.trim(),
        numero_chamada: editNumero,
        ativo: editAtivo,
      });
      toast.success('Aluno atualizado com sucesso!');
      setModalEditarAberto(false);
      if (turmaAtual) await carregarAlunosDaTurma(turmaAtual.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar dados do aluno.';
      setErroEdit(msg);
      toast.error(msg);
    } finally {
      setSalvandoEdit(false);
    }
  };

  // Resetar PIN Individual
  const abrirResetPinAluno = (aluno: AlunoPublico) => {
    setAlunoParaResetPin(aluno);
    setModoResetPin('automatico');
    setResetPinValor('');
    setErroResetPin(null);
  };

  const handleConfirmarResetIndividual = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!alunoParaResetPin) return;

    const pinCustomizado = modoResetPin === 'manual' ? resetPinValor.trim() : undefined;
    if (modoResetPin === 'manual') {
      if (!pinCustomizado) {
        setErroResetPin('Informe o novo PIN de 4 números ou selecione a opção "Gerar Automático".');
        return;
      }
      if (!/^\d{4}$/.test(pinCustomizado)) {
        setErroResetPin('O PIN deve conter exatamente 4 números.');
        return;
      }
    }

    setResetandoPinIndividual(true);
    setErroResetPin(null);
    try {
      const res = await gestaoService.gerarOuResetarPin(alunoParaResetPin.id, pinCustomizado);
      toast.success(
        `Novo PIN ${modoResetPin === 'manual' ? 'definido' : 'gerado'} para ${alunoParaResetPin.nome_completo}`
      );
      const item: PinGeradoItem = {
        aluno: alunoParaResetPin,
        pin_puro: res.pin_puro,
      };
      setAlunoParaResetPin(null);
      setPinsGerados([item]);
      setModalPinsAberto(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao resetar PIN.';
      setErroResetPin(msg);
      toast.error(msg);
    } finally {
      setResetandoPinIndividual(false);
    }
  };

  // Resetar Todos os PINs da Turma
  const abrirResetGeral = () => {
    setConfirmacaoTextoTurma('');
    setModalResetGeralAberto(true);
  };

  const handleConfirmarResetGeral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaAtual) return;
    if (confirmacaoTextoTurma.trim().toLowerCase() !== turmaAtual.nome.trim().toLowerCase()) {
      toast.error('O nome digitado não confere com o nome da turma.');
      return;
    }

    setResetandoGeral(true);
    try {
      const novosPins: PinGeradoItem[] = [];
      for (const al of alunos) {
        const res = await gestaoService.gerarOuResetarPin(al.id);
        novosPins.push({ aluno: al, pin_puro: res.pin_puro });
      }

      toast.success(`PINs de todos os ${novosPins.length} alunos foram resetados!`);
      setModalResetGeralAberto(false);
      setPinsGerados(novosPins);
      setModalPinsAberto(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao resetar PINs da turma.');
    } finally {
      setResetandoGeral(false);
    }
  };

  // Filtragem
  const alunosFiltrados = alunos.filter((a) => {
    const atendeBusca =
      a.nome_completo.toLowerCase().includes(busca.toLowerCase().trim()) ||
      a.numero_chamada.toString().includes(busca.trim());

    const atendeStatus =
      filtroStatus === 'todos'
        ? true
        : filtroStatus === 'ativos'
        ? a.ativo
        : !a.ativo;

    return atendeBusca && atendeStatus;
  });

  return (
    <div className="space-y-6">
      {/* Componente Invisível na tela, Visível na Impressão (@media print) */}
      <FilipetasImpressao
        itens={pinsGerados}
        escolaNome={escola?.nome || 'Escola'}
        turmaNome={turmaAtual?.nome || ''}
        turmaCodigo={turmaAtual?.codigo_acesso || ''}
      />

      <div className="print:hidden space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Alunos e PINs de Acesso
          </h2>
          <p className="text-sm text-slate-500">
            Cadastre estudantes, emita filipetas e redefina senhas PIN de 4 dígitos.
          </p>
        </div>

        {turmaAtual && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={abrirLote}
              className="flex items-center gap-1.5 text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              Cadastrar em Lote
            </Button>
            <Button
              size="sm"
              onClick={abrirNovoAluno}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Aluno
            </Button>
          </div>
        )}
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Seleção de Turma & Ações Globais da Turma */}
      <Card className="p-4 sm:p-5 bg-white border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Selecione a Turma
            </label>
            <select
              value={turmaSelecionadaId}
              onChange={(e) => setTurmaSelecionadaId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={carregandoTurmas || turmas.length === 0}
            >
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.serie}) — Código: {t.codigo_acesso}
                </option>
              ))}
            </select>
          </div>

          {turmaAtual && (
            <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
              <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs">
                <span className="text-indigo-600 font-bold mr-1.5">Código da Turma:</span>
                <span className="font-mono font-black text-indigo-950 tracking-wider">
                  {turmaAtual.codigo_acesso}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={abrirResetGeral}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1.5"
                title="Resetar todos os PINs desta turma"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Resetar Todos os PINs
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Barra de Filtros da Turma */}
      {turmaAtual && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno por nome ou nº chamada..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'ativos' | 'inativos')}
            aria-label="Filtrar por status"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ativos">Apenas Ativos</option>
            <option value="inativos">Apenas Inativos</option>
            <option value="todos">Todos os Alunos</option>
          </select>
        </div>
      )}

      {/* Tabela de Alunos */}
      {carregandoAlunos ? (
        <div className="p-12 text-center text-slate-400 flex justify-center items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Carregando alunos da turma...</span>
        </div>
      ) : !turmaAtual ? (
        <Card className="p-8 text-center text-slate-500">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Nenhuma turma cadastrada.</p>
          <p className="text-xs text-slate-400">Cadastre uma turma na aba "Turmas" para adicionar alunos.</p>
        </Card>
      ) : alunosFiltrados.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 space-y-2">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">Nenhum aluno encontrado.</p>
          <p className="text-xs text-slate-400">
            {busca || filtroStatus !== 'ativos'
              ? 'Tente ajustar os filtros de busca.'
              : 'Clique em "Novo Aluno" ou "Cadastrar em Lote" para matricular estudantes nesta turma.'}
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-800">
                Alunos Matriculados ({alunosFiltrados.length})
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {alunosFiltrados.map((aluno) => (
                <div
                  key={aluno.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                      #{aluno.numero_chamada}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 text-sm">
                          {aluno.nome_completo}
                        </p>
                        {!aluno.ativo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-700">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">ID: {aluno.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirResetPinAluno(aluno)}
                      className="text-xs flex items-center gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      title="Gerar novo PIN"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Resetar PIN</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirEditarAluno(aluno)}
                      className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900"
                      title="Editar aluno"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Novo Aluno Individual */}
      <Modal
        isOpen={modalNovoAberto}
        onClose={() => !salvandoNovo && setModalNovoAberto(false)}
        title={`Novo Aluno — ${turmaAtual?.nome || ''}`}
      >
        <form onSubmit={handleSalvarNovoAluno} className="space-y-4">
          <Input
            label="Nome Completo do Aluno"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex: João Victor Silva"
            required
            autoFocus
            disabled={salvandoNovo}
          />

          <Input
            label="Número de Chamada"
            type="number"
            min={1}
            value={novoNumero}
            onChange={(e) => setNovoNumero(Number(e.target.value))}
            required
            disabled={salvandoNovo}
          />

          <Input
            label="PIN de Acesso (4 dígitos numéricos)"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={novoPin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setNovoPin(val);
            }}
            placeholder="Ex: 1234 (opcional)"
            disabled={salvandoNovo}
            helperText="Deixe em branco para gerar automaticamente ou digite 4 números para definir agora."
          />

          {erroNovo && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroNovo}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalNovoAberto(false)}
              disabled={salvandoNovo}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvandoNovo} className="flex items-center gap-2">
              {salvandoNovo && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvandoNovo ? 'Cadastrando...' : 'Cadastrar Aluno'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cadastro em Lote */}
      <Modal
        isOpen={modalLoteAberto}
        onClose={() => !salvandoLote && setModalLoteAberto(false)}
        title={`Cadastrar Alunos em Lote — ${turmaAtual?.nome || ''}`}
      >
        <form onSubmit={handleSalvarLote} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cole a lista de nomes (um por linha):
            </label>
            <textarea
              value={textoLote}
              onChange={(e) => setTextoLote(e.target.value)}
              placeholder="Ana Clara Souza&#10;Bernardo Santos&#10;Carlos Eduardo Lima"
              rows={8}
              required
              disabled={salvandoLote}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              A numeração de chamada será sequencial automática a partir do último aluno cadastrado.
              Os PINs de 4 dígitos serão gerados para cada aluno.
            </p>
          </div>

          {erroLote && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroLote}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalLoteAberto(false)}
              disabled={salvandoLote}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvandoLote} className="flex items-center gap-2">
              {salvandoLote && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvandoLote ? 'Importando...' : 'Cadastrar Alunos'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Aluno */}
      <Modal
        isOpen={modalEditarAberto}
        onClose={() => !salvandoEdit && setModalEditarAberto(false)}
        title="Editar Dados do Aluno"
      >
        <form onSubmit={handleSalvarEditAluno} className="space-y-4">
          <Input
            label="Nome Completo"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            required
            disabled={salvandoEdit}
          />

          <Input
            label="Número de Chamada"
            type="number"
            min={1}
            value={editNumero}
            onChange={(e) => setEditNumero(Number(e.target.value))}
            required
            disabled={salvandoEdit}
          />

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="alunoAtivoCheck"
              checked={editAtivo}
              onChange={(e) => setEditAtivo(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              disabled={salvandoEdit}
            />
            <label htmlFor="alunoAtivoCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
              Aluno ativo na turma
            </label>
          </div>

          {erroEdit && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroEdit}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalEditarAberto(false)}
              disabled={salvandoEdit}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvandoEdit} className="flex items-center gap-2">
              {salvandoEdit && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvandoEdit ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Resetar PIN Individual */}
      <Modal
        isOpen={!!alunoParaResetPin}
        onClose={() => !resetandoPinIndividual && setAlunoParaResetPin(null)}
        title={`Resetar PIN — ${alunoParaResetPin?.nome_completo || ''}`}
      >
        <form onSubmit={handleConfirmarResetIndividual} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Atenção ao redefinir</p>
              <p className="text-amber-800 mt-0.5">
                O PIN anterior de <strong>{alunoParaResetPin?.nome_completo}</strong> deixará de funcionar imediatamente.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Como deseja definir o novo PIN?
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoResetPin('manual');
                  setErroResetPin(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modoResetPin === 'manual'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 text-indigo-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Criar PIN Manual</div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  A diretora digita o PIN
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoResetPin('automatico');
                  setErroResetPin(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modoResetPin === 'automatico'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 text-indigo-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Gerar Automático</div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Sistema sorteia 4 dígitos
                </div>
              </button>
            </div>

            {modoResetPin === 'manual' ? (
              <div className="space-y-1 pt-1">
                <Input
                  label="Novo PIN (4 dígitos numéricos)"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={resetPinValor}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setResetPinValor(val);
                    setErroResetPin(null);
                  }}
                  placeholder="Ex: 5678"
                  autoFocus
                  required
                  disabled={resetandoPinIndividual}
                  helperText="Informe exatamente 4 números para o novo PIN do aluno."
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Um novo PIN de 4 dígitos será gerado aleatoriamente e exibido na tela a seguir para cópia e impressão.
              </p>
            )}
          </div>

          {erroResetPin && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroResetPin}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAlunoParaResetPin(null)}
              disabled={resetandoPinIndividual}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={resetandoPinIndividual}
              className="flex items-center gap-2"
            >
              {resetandoPinIndividual && <Loader2 className="w-4 h-4 animate-spin" />}
              {resetandoPinIndividual ? 'Redefinindo...' : 'Gerar Novo PIN'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Reset Geral da Turma (Exige digitar o nome da turma) */}
      <Modal
        isOpen={modalResetGeralAberto}
        onClose={() => !resetandoGeral && setModalResetGeralAberto(false)}
        title="ATENÇÃO: Redefinição Geral de PINs"
      >
        <form onSubmit={handleConfirmarResetGeral} className="space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-900 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Ação Irreversível!</span>
            </div>
            <p>
              Esta ação irá gerar um <strong>novo PIN de acesso para todos os {alunos.length} alunos</strong> da turma{' '}
              <strong>{turmaAtual?.nome}</strong>. Todos os acessos atuais serão invalidados.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Para confirmar, digite exatamente o nome da turma ({turmaAtual?.nome}):
            </label>
            <Input
              value={confirmacaoTextoTurma}
              onChange={(e) => setConfirmacaoTextoTurma(e.target.value)}
              placeholder={turmaAtual?.nome}
              required
              disabled={resetandoGeral}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalResetGeralAberto(false)}
              disabled={resetandoGeral}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={
                resetandoGeral ||
                confirmacaoTextoTurma.trim().toLowerCase() !== turmaAtual?.nome.trim().toLowerCase()
              }
              className="flex items-center gap-2"
            >
              {resetandoGeral && <Loader2 className="w-4 h-4 animate-spin" />}
              {resetandoGeral ? 'Redefinindo...' : 'Confirmar e Redefinir Todos'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal PINs Gerados (Exibição única e Impressão de Filipetas) */}
      <Modal
        isOpen={modalPinsAberto}
        onClose={() => {
          setPinsGerados([]);
          setModalPinsAberto(false);
        }}
        title={`PINs de Acesso Gerados (${pinsGerados.length})`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">Aviso Importante de Segurança:</p>
              <p>
                Por razões de sigilo e segurança, estes códigos PIN <strong>só são exibidos uma única vez</strong> nesta tela e <strong>nunca são salvos no seu navegador</strong>. Anote-os ou imprima as filipetas agora.
              </p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {pinsGerados.map((item) => (
              <div
                key={item.aluno.id}
                className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-mono text-slate-400 mr-2">
                    #{item.aluno.numero_chamada}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {item.aluno.nome_completo}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {item.pin_puro}
                  </span>
                  <button
                    onClick={() => copiarPin(item.pin_puro, item.aluno.id)}
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Copiar PIN"
                  >
                    {pinCopiadoId === item.aluno.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={imprimirFilipetas}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            >
              <Printer className="w-4 h-4" />
              Imprimir Filipetas (A4)
            </Button>

            <Button
              onClick={() => {
                setPinsGerados([]);
                setModalPinsAberto(false);
              }}
              className="w-full sm:w-auto"
            >
              Concluir
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
};
