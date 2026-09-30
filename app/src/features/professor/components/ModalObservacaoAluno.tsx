import React, { useState, useEffect } from 'react';
import { Modal, Button, Textarea, useToast } from '@/components/ui';
import { professorService, AlunoObservacao } from '@/services';
import { FileEdit, MessageSquare, Clock, Trash2, User } from 'lucide-react';

interface ModalObservacaoAlunoProps {
  isOpen: boolean;
  onClose: () => void;
  alunoId: string;
  alunoNome: string;
  turmaNome: string;
  numeroChamada?: number;
  onSalvo?: () => void;
}

export const ModalObservacaoAluno: React.FC<ModalObservacaoAlunoProps> = ({
  isOpen,
  onClose,
  alunoId,
  alunoNome,
  turmaNome,
  numeroChamada,
  onSalvo,
}) => {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [observacoes, setObservacoes] = useState<AlunoObservacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !alunoId) return;

    let ativo = true;
    async function carregarObservacoes() {
      setCarregando(true);
      try {
        const lista = await professorService.listarObservacoesAluno(alunoId);
        if (ativo) {
          setObservacoes(lista);
          // Pré-carrega o texto se o professor logado já tiver uma anotação recente
          if (lista.length > 0) {
            setTexto(lista[0].texto);
          } else {
            setTexto('');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar observações:', err);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarObservacoes();
    return () => {
      ativo = false;
    };
  }, [isOpen, alunoId]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) {
      toast.error('Digite o texto da observação antes de salvar.');
      return;
    }

    setSalvando(true);
    try {
      await professorService.salvarObservacaoAluno(alunoId, texto.trim());
      toast.success('Observação pedagógica registrada com sucesso!');
      onSalvo?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar observação.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (obsId: string) => {
    setExcluindoId(obsId);
    try {
      await professorService.excluirObservacaoAluno(obsId);
      toast.success('Observação removida.');
      setObservacoes((prev) => prev.filter((o) => o.id !== obsId));
      setTexto('');
      onSalvo?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover observação.');
    } finally {
      setExcluindoId(null);
    }
  };

  const formatarData = (iso: string) => {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !salvando && onClose()}
      title="Observações Pedagógicas do Aluno"
      description={`Aluno: ${numeroChamada ? `#${numeroChamada} ` : ''}${alunoNome} • ${turmaNome}`}
      maxWidth="lg"
    >
      <div className="p-5 sm:p-6 space-y-5">
        {/* Histórico de observações registradas */}
        {observacoes.length > 0 && (
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
              <span>Observações Registradas ({observacoes.length})</span>
            </span>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {observacoes.map((obs) => (
                <div
                  key={obs.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs text-slate-700"
                >
                  <div className="flex items-center justify-between text-slate-400 gap-2 flex-wrap">
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {obs.professor_nome}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {formatarData(obs.updated_at || obs.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExcluir(obs.id)}
                        disabled={excluindoId === obs.id}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5"
                        title="Excluir observação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
                    {obs.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulário para Nova / Atualização de Observação */}
        <form onSubmit={handleSalvar} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
                <span>Registrar / Editar Observação</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {texto.length} / 1000
              </span>
            </div>

            <Textarea
              placeholder="Digite anotações sobre dificuldades, avanços, comportamento ou combinados com o aluno..."
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
              disabled={salvando || carregando}
              rows={4}
              required
            />
            <p className="text-[11px] text-slate-400">
              Esta anotação fica visível para os professores e equipe escolar no acompanhamento do aluno.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={salvando}
              disabled={carregando || !texto.trim()}
              leftIcon={<FileEdit className="w-4 h-4" />}
            >
              Salvar observação
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ModalObservacaoAluno;
