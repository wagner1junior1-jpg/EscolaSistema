import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Textarea, Select } from '@/components/ui';
import { OfertaDetalhada, Periodo, ModoAtividade, professorService } from '@/services';
import { AlertCircle, BookOpen, FileCheck } from 'lucide-react';

export interface ModalNovaAtividadeRapidaProps {
  aberto: boolean;
  onFechar: () => void;
  ofertas: OfertaDetalhada[];
  periodos: Periodo[];
  periodoAtivoId?: string;
  onCriada: (novaAtividadeId: string, ofertaId: string) => void;
}

export const ModalNovaAtividadeRapida: React.FC<ModalNovaAtividadeRapidaProps> = ({
  aberto,
  onFechar,
  ofertas,
  periodos,
  periodoAtivoId,
  onCriada,
}) => {
  const [ofertaSelecionadaId, setOfertaSelecionadaId] = useState<string>('');
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [titulo, setTitulo] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [modo, setModo] = useState<ModoAtividade>('exercicio');
  const [prazo, setPrazo] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inicializa a oferta padrão e o período ativo quando o modal abre
  useEffect(() => {
    if (aberto) {
      if (ofertas.length > 0 && !ofertaSelecionadaId) {
        setOfertaSelecionadaId(ofertas[0].id);
      }
      if (periodoAtivoId) {
        setPeriodoSelecionadoId(periodoAtivoId);
      } else if (periodos.length > 0) {
        const ativo = periodos.find((p) => p.ativo) || periodos[0];
        setPeriodoSelecionadoId(ativo.id);
      }
      setTitulo('');
      setDescricao('');
      setModo('exercicio');
      setPrazo('');
      setErro(null);
      setSalvando(false);
    }
  }, [aberto, ofertas, periodos, periodoAtivoId, ofertaSelecionadaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!ofertaSelecionadaId) {
      setErro('Selecione para qual turma e matéria a atividade será criada.');
      return;
    }
    if (!titulo.trim()) {
      setErro('Informe o título da atividade.');
      return;
    }
    if (!periodoSelecionadoId) {
      setErro('Selecione o período letivo da atividade.');
      return;
    }

    try {
      setSalvando(true);
      const nova = await professorService.criarAtividade(ofertaSelecionadaId, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || 'Atividade pedagógica da turma.',
        prazo: prazo || null,
        periodo_id: periodoSelecionadoId,
        modo,
      });

      onCriada(nova.id, ofertaSelecionadaId);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar nova atividade.');
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={aberto}
      onClose={() => !salvando && onFechar()}
      title="Nova Atividade Rápida"
      description="Crie uma nova atividade em qualquer uma de suas turmas e passe direto para a montagem de questões."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {erro && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Seleção de Turma / Oferta */}
        <div>
          <Select
            label="Turma e Disciplina *"
            value={ofertaSelecionadaId}
            onChange={(e) => setOfertaSelecionadaId(e.target.value)}
            disabled={salvando}
            required
            options={ofertas.map((o) => ({
              value: o.id,
              label: `${o.turma_nome} — ${o.disciplina_nome} (${o.turma_serie || 'Turma'})`,
            }))}
          />
        </div>

        {/* Seleção de Período Letivo */}
        <div>
          <Select
            label="Período Letivo *"
            value={periodoSelecionadoId}
            onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
            disabled={salvando}
            required
            options={periodos.map((p) => ({
              value: p.id,
              label: `${p.nome}${p.ativo ? ' (Período Atual)' : ''}`,
            }))}
          />
        </div>

        {/* Título da Atividade */}
        <div>
          <Input
            label="Título da Atividade *"
            placeholder="Ex: Frações e Operações Fundamentais"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            disabled={salvando}
            required
          />
        </div>

        {/* Orientações aos Alunos */}
        <div>
          <Textarea
            label="Instruções aos Alunos"
            placeholder="Orientações aos alunos sobre a atividade ou avaliação..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={salvando}
            rows={2}
          />
        </div>

        {/* Modo da Atividade (Exercício x Prova) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 tracking-tight">
            Modo da Atividade *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setModo('exercicio')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                modo === 'exercicio'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-heading font-bold text-sm text-slate-900">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Exercício</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Feedback e explicação imediatos a cada questão. Aluno pode tentar novamente se errar.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModo('prova')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                modo === 'prova'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-heading font-bold text-sm text-slate-900">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <span>Prova / Avaliação</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Resposta única e definitiva. Correção e gabarito liberados somente após a entrega final.
              </div>
            </button>
          </div>
        </div>

        {/* Prazo de Entrega */}
        <div>
          <Input
            label="Prazo de Entrega (Opcional)"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            disabled={salvando}
          />
        </div>

        {/* Rodapé / Botões */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={salvando}
            className="font-bold shadow-md shadow-indigo-200"
          >
            Criar e Adicionar Questões →
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ModalNovaAtividadeRapida;
