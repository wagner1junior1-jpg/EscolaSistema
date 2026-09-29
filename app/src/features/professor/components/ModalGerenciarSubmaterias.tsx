import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { bancoService, Assunto } from '@/services';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  AlertCircle,
  Layers,
} from 'lucide-react';

interface ModalGerenciarSubmateriasProps {
  aberto: boolean;
  onFechar: () => void;
  disciplinaId: string;
  disciplinaNome: string;
  onAtualizado?: () => void;
  onSelecionarSubmateria?: (assuntoId: string) => void;
}

export const ModalGerenciarSubmaterias: React.FC<ModalGerenciarSubmateriasProps> = ({
  aberto,
  onFechar,
  disciplinaId,
  disciplinaNome,
  onAtualizado,
  onSelecionarSubmateria,
}) => {
  const toast = useToast();

  const [submaterias, setSubmaterias] = useState<Assunto[]>([]);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Cadastro de nova submatéria
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // Edição inline de submatéria
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Exclusão
  const [submateriaParaExcluir, setSubmateriaParaExcluir] = useState<Assunto | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Carrega dados da disciplina
  const carregarDados = useCallback(async () => {
    if (!disciplinaId) return;
    setCarregando(true);
    setErro(null);
    try {
      const [lista, counts] = await Promise.all([
        bancoService.listarAssuntos(disciplinaId),
        bancoService.contarQuestoesPorAssunto(disciplinaId),
      ]);
      setSubmaterias(lista);
      setContagens(counts);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar submatérias.');
    } finally {
      setCarregando(false);
    }
  }, [disciplinaId]);

  useEffect(() => {
    if (aberto) {
      setNovoNome('');
      setEditandoId(null);
      carregarDados();
    }
  }, [aberto, carregarDados]);

  // Criar nova submatéria
  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = novoNome.trim();
    if (!limpo || !disciplinaId) return;

    setSalvandoNovo(true);
    setErro(null);
    try {
      const criada = await bancoService.criarAssunto(disciplinaId, limpo);
      toast.success(`Submatéria "${criada.nome}" adicionada com sucesso!`);
      setNovoNome('');
      await carregarDados();
      onAtualizado?.();
      if (onSelecionarSubmateria) {
        onSelecionarSubmateria(criada.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar submatéria.';
      setErro(msg);
      toast.error(msg);
    } finally {
      setSalvandoNovo(false);
    }
  };

  // Iniciar edição
  const handleIniciarEdicao = (sub: Assunto) => {
    setEditandoId(sub.id);
    setNomeEditado(sub.nome);
  };

  // Cancelar edição
  const handleCancelarEdicao = () => {
    setEditandoId(null);
    setNomeEditado('');
  };

  // Salvar renomeação
  const handleSalvarEdicao = async (id: string) => {
    const limpo = nomeEditado.trim();
    if (!limpo) {
      toast.warning('O nome não pode ficar vazio.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      const atualizada = await bancoService.renomearAssunto(id, limpo);
      toast.success(`Submatéria renomeada para "${atualizada.nome}".`);
      setEditandoId(null);
      setNomeEditado('');
      await carregarDados();
      onAtualizado?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao renomear submatéria.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Confirmar exclusão
  const handleConfirmarExclusao = async () => {
    if (!submateriaParaExcluir) return;
    setExcluindo(true);
    try {
      await bancoService.excluirAssunto(submateriaParaExcluir.id);
      toast.success(`Submatéria "${submateriaParaExcluir.nome}" excluída.`);
      setSubmateriaParaExcluir(null);
      await carregarDados();
      onAtualizado?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir submatéria.');
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={aberto}
        onClose={onFechar}
        title={`Submatérias — ${disciplinaNome || 'Matéria'}`}
        maxWidth="lg"
      >
        <div className="space-y-6">
          {/* Caixa de Ajuda Pedagógica */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Uso Compartilhado na Escola:</p>
              <p className="text-indigo-700 mt-0.5 font-sans leading-relaxed">
                As submatérias cadastradas aqui categorizam o banco de questões. Qualquer submatéria
                acrescentada fica imediatamente disponível como <strong>filtro de busca</strong> e para
                criar atividades para <strong>todos os professores de {disciplinaNome}</strong> na escola.
              </p>
            </div>
          </div>

          {/* Formulário de Adicionar Nova Submatéria */}
          <form onSubmit={handleCriar} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Acrescentar Nova Submatéria
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1">
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Porcentagem, Adição e Subtração, Equações, Frações..."
                  disabled={salvandoNovo}
                  className="w-full"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                isLoading={salvandoNovo}
                disabled={!novoNome.trim()}
                className="shrink-0"
              >
                Adicionar submatéria
              </Button>
            </div>
            {erro && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {erro}
              </p>
            )}
          </form>

          {/* Listagem de Submatérias da Matéria */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Submatérias Cadastradas ({submaterias.length})
              </span>
              <span className="text-xs text-slate-400">
                Total de questões associadas no Banco
              </span>
            </div>

            {carregando ? (
              <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Carregando submatérias...
              </div>
            ) : submaterias.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-500">
                  Nenhuma submatéria cadastrada para {disciplinaNome}.
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adicione a primeira acima (ex.: Porcentagem, Adição, Subtração...) para organizar as questões.
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {submaterias.map((sub) => {
                  const qtdQuestoes = contagens[sub.id] || 0;
                  const isEditando = editandoId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-200 transition-colors"
                    >
                      {/* Lado Esquerdo: Nome ou Input de Edição */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        {isEditando ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <Input
                              value={nomeEditado}
                              onChange={(e) => setNomeEditado(e.target.value)}
                              className="h-8 text-xs py-1"
                              autoFocus
                              disabled={salvandoEdicao}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSalvarEdicao(sub.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelarEdicao();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSalvarEdicao(sub.id)}
                              disabled={salvandoEdicao}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Salvar alteração"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelarEdicao}
                              disabled={salvandoEdicao}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {sub.nome}
                          </span>
                        )}
                      </div>

                      {/* Lado Direito: Badge de Questões e Ações */}
                      {!isEditando && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${
                              qtdQuestoes > 0
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          >
                            {qtdQuestoes === 1
                              ? '1 questão'
                              : `${qtdQuestoes} questões`}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleIniciarEdicao(sub)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Renomear submatéria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSubmateriaParaExcluir(sub)}
                            disabled={qtdQuestoes > 0}
                            className={`p-1 rounded-lg transition-colors ${
                              qtdQuestoes > 0
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                            title={
                              qtdQuestoes > 0
                                ? 'Não pode excluir: possui questões vinculadas no Banco'
                                : 'Excluir submatéria'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={onFechar}>
              Concluído
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={!!submateriaParaExcluir}
        onClose={() => setSubmateriaParaExcluir(null)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Submatéria"
        message={`Tem certeza de que deseja excluir a submatéria "${submateriaParaExcluir?.nome}"? Esta ação removerá a opção de filtro desta submatéria.`}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        variant="danger"
        isLoading={excluindo}
      />
    </>
  );
};
