import React, { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, useToast, ConfirmDialog } from '@/components/ui';
import { Megaphone, Plus, Trash2, Loader2, AlertCircle, Calendar, Bell } from 'lucide-react';
import { gestaoService } from '@/services';
import { Aviso, PrioridadeAviso } from '@/lib/types';

export const GestaoMuralSecao: React.FC = () => {
  const toast = useToast();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal Novo Aviso
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaMensagem, setNovaMensagem] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState<PrioridadeAviso>('media');
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  // Diálogo Excluir Aviso
  const [avisoParaExcluir, setAvisoParaExcluir] = useState<Aviso | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarAvisos = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const lista = await gestaoService.listarAvisosEscola();
      setAvisos(lista);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar avisos da escola.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarAvisos();
  }, []);

  const abrirNovoAviso = () => {
    setNovoTitulo('');
    setNovaMensagem('');
    setNovaPrioridade('media');
    setErroNovo(null);
    setModalNovoAberto(true);
  };

  const handleSalvarNovoAviso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim() || !novaMensagem.trim()) return;

    try {
      setSalvandoNovo(true);
      setErroNovo(null);
      await gestaoService.criarAvisoEscola({
        titulo: novoTitulo.trim(),
        mensagem: novaMensagem.trim(),
        prioridade: novaPrioridade,
      });

      toast.success('Aviso publicado no mural da escola com sucesso!');
      setModalNovoAberto(false);
      await carregarAvisos();
    } catch (err) {
      setErroNovo(err instanceof Error ? err.message : 'Erro ao publicar aviso.');
    } finally {
      setSalvandoNovo(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!avisoParaExcluir) return;

    try {
      setExcluindo(true);
      await gestaoService.excluirAvisoEscola(avisoParaExcluir.id);
      toast.success('Aviso removido do mural.');
      setAvisoParaExcluir(null);
      await carregarAvisos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir aviso.');
    } finally {
      setExcluindo(false);
    }
  };

  const prioridadeConfig: Record<
    PrioridadeAviso,
    { label: string; classe: string }
  > = {
    alta: {
      label: 'Alta',
      classe: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    media: {
      label: 'Média',
      classe: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    baixa: {
      label: 'Baixa',
      classe: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  };

  return (
    <div className="space-y-6">
      {/* Topo com Título e Botão Novo Aviso */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-indigo-600" />
            Mural de Avisos da Escola
          </h2>
          <p className="text-sm text-slate-500">
            Publique comunicados visíveis para todos os estudantes nos seus respectivos painéis.
          </p>
        </div>

        <Button
          size="sm"
          onClick={abrirNovoAviso}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Novo Aviso
        </Button>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Listagem de Avisos */}
      {carregando ? (
        <div className="p-12 text-center text-slate-400 flex justify-center items-center gap-2 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Carregando comunicados...</span>
        </div>
      ) : avisos.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Nenhum aviso publicado no mural.</p>
          <p className="text-xs text-slate-400">
            Clique em "Novo Aviso" para criar comunicados gerais para os alunos.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {avisos.map((aviso) => {
            const prioridade = prioridadeConfig[aviso.prioridade] || prioridadeConfig.media;
            const dataPub = new Date(aviso.publicado_em).toLocaleDateString('pt-BR');

            return (
              <Card
                key={aviso.id}
                className="p-5 border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${prioridade.classe}`}
                    >
                      Prioridade {prioridade.label}
                    </span>

                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {dataPub}
                    </span>
                  </div>

                  <h3 className="font-heading font-black text-base text-slate-900 leading-snug">
                    {aviso.titulo}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 mt-2 whitespace-pre-line leading-relaxed">
                    {aviso.mensagem}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAvisoParaExcluir(aviso)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Novo Aviso */}
      <Modal
        isOpen={modalNovoAberto}
        onClose={() => !salvandoNovo && setModalNovoAberto(false)}
        title="Novo Aviso para a Escola"
        description="Este comunicado ficará visível no mural de todos os alunos da instituição."
      >
        <form onSubmit={handleSalvarNovoAviso} className="space-y-4">
          <Input
            label="Título do Aviso"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Ex: Reunião de Pais e Mestres"
            required
            autoFocus
            disabled={salvandoNovo}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mensagem do Comunicado
            </label>
            <textarea
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              placeholder="Digite o conteúdo da mensagem..."
              rows={5}
              required
              disabled={salvandoNovo}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Prioridade
            </label>
            <select
              value={novaPrioridade}
              onChange={(e) => setNovaPrioridade(e.target.value as PrioridadeAviso)}
              disabled={salvandoNovo}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="baixa">Baixa (Informativo geral)</option>
              <option value="media">Média (Avisos normais)</option>
              <option value="alta">Alta (Destaque importante)</option>
            </select>
          </div>

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
              {salvandoNovo ? 'Publicando...' : 'Publicar Aviso'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={!!avisoParaExcluir}
        onClose={() => setAvisoParaExcluir(null)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Aviso Escolar"
        message={`Deseja realmente remover o comunicado "${avisoParaExcluir?.titulo}" do mural da escola? Esta ação não pode ser desfeita.`}
        confirmText={excluindo ? 'Excluindo...' : 'Sim, Excluir'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={excluindo}
      />
    </div>
  );
};
