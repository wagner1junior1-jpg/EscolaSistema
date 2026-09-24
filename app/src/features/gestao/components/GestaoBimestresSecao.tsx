import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Modal,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { gestaoService, Periodo } from '@/services';
import { Calendar, Plus, Edit3, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';

export const GestaoBimestresSecao: React.FC = () => {
  const toast = useToast();

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal Criar / Editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [anoLetivo, setAnoLetivo] = useState(2026);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Confirmação para definir período ativo
  const [periodoParaAtivar, setPeriodoParaAtivar] = useState<Periodo | null>(null);
  const [ativando, setAtivando] = useState(false);

  const carregarPeriodos = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await gestaoService.listarPeriodos();
      setPeriodos(lista);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar períodos letivos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPeriodos();
  }, [carregarPeriodos]);

  const formatarData = (iso: string) => {
    try {
      const [ano, mes, dia] = iso.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return iso;
    }
  };

  const handleAbrirCriar = () => {
    setEditandoId(null);
    setNome('');
    setAnoLetivo(periodos[0]?.ano_letivo || 2026);
    setDataInicio('');
    setDataFim('');
    setModalAberto(true);
  };

  const handleAbrirEditar = (p: Periodo) => {
    setEditandoId(p.id);
    setNome(p.nome);
    setAnoLetivo(p.ano_letivo);
    setDataInicio(p.data_inicio);
    setDataFim(p.data_fim);
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('O nome do bimestre é obrigatório.');
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error('As datas de início e fim são obrigatórias.');
      return;
    }
    if (dataFim < dataInicio) {
      toast.error('A data de fim deve ser posterior ou igual à data de início.');
      return;
    }

    setSalvando(true);
    try {
      if (editandoId) {
        await gestaoService.atualizarPeriodo(editandoId, {
          nome: nome.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          ano_letivo: anoLetivo,
        });
        toast.success('Bimestre atualizado com sucesso!');
      } else {
        const escola = await gestaoService.obterEscola();
        await gestaoService.criarPeriodo({
          escola_id: escola.id,
          nome: nome.trim(),
          ano_letivo: anoLetivo,
          data_inicio: dataInicio,
          data_fim: dataFim,
          ativo: false,
        });
        toast.success('Novo bimestre cadastrado!');
      }

      setModalAberto(false);
      await carregarPeriodos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar bimestre.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarAtivar = async () => {
    if (!periodoParaAtivar) return;
    setAtivando(true);
    try {
      await gestaoService.definirPeriodoAtivo(periodoParaAtivar.id);
      toast.success(`Bimestre "${periodoParaAtivar.nome}" definido como ativo.`);
      setPeriodoParaAtivar(null);
      await carregarPeriodos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar bimestre ativo.');
    } finally {
      setAtivando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
            Bimestres &amp; Períodos Letivos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Organize os períodos do ano letivo e determine o bimestre ativo da escola.
          </p>
        </div>

        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAbrirCriar}>
          Novo bimestre
        </Button>
      </div>

      {carregando && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">Carregando períodos letivos...</p>
        </div>
      )}

      {!carregando && erro && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-medium">{erro}</p>
        </div>
      )}

      {!carregando && !erro && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {periodos.map((p) => (
            <Card
              key={p.id}
              className={`border-2 transition-all flex flex-col justify-between ${
                p.ativo ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-white'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Ano {p.ano_letivo}
                  </span>
                  {p.ativo ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Ativo</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Inativo
                    </span>
                  )}
                </div>

                <CardTitle className="text-lg pt-1">{p.nome}</CardTitle>

                <div className="pt-2 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Início: <strong>{formatarData(p.data_inicio)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Fim: <strong>{formatarData(p.data_fim)}</strong></span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                  onClick={() => handleAbrirEditar(p)}
                  className="flex-1"
                >
                  Editar
                </Button>

                {!p.ativo && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPeriodoParaAtivar(p)}
                    className="text-xs font-bold"
                  >
                    Ativar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar Período */}
      <Modal
        isOpen={modalAberto}
        onClose={() => !salvando && setModalAberto(false)}
        title={editandoId ? 'Editar Bimestre' : 'Novo Bimestre'}
        maxWidth="md"
      >
        <form onSubmit={handleSalvar} className="p-5 sm:p-6 space-y-4">
          <Input
            label="Nome do Período *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: 1º Bimestre"
            disabled={salvando}
            required
          />

          <Input
            label="Ano Letivo *"
            type="number"
            value={anoLetivo}
            onChange={(e) => setAnoLetivo(parseInt(e.target.value, 10) || 2026)}
            disabled={salvando}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Data de Início *"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              disabled={salvando}
              required
            />

            <Input
              label="Data de Término *"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              disabled={salvando}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={salvando}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmação: Definir Período Ativo */}
      <ConfirmDialog
        isOpen={!!periodoParaAtivar}
        onClose={() => !ativando && setPeriodoParaAtivar(null)}
        onConfirm={handleConfirmarAtivar}
        title="Definir Bimestre Ativo"
        message="O bimestre ativo muda para toda a escola."
        confirmText="Confirmar ativação"
        cancelText="Cancelar"
        variant="primary"
        isLoading={ativando}
      />
    </div>
  );
};
