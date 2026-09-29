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
import { gestaoService, Disciplina } from '@/services';
import { BookOpen, Plus, Trash2, Loader2, AlertCircle, Search, Layers } from 'lucide-react';
import { ModalGerenciarSubmaterias } from '@/features/professor/components/ModalGerenciarSubmaterias';

export const GestaoDisciplinasSecao: React.FC = () => {
  const toast = useToast();

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Busca
  const [busca, setBusca] = useState('');

  // Modal Criar
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Modal Excluir
  const [disciplinaParaExcluir, setDisciplinaParaExcluir] = useState<Disciplina | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Modal Submatérias da Disciplina
  const [disciplinaSubmaterias, setDisciplinaSubmaterias] = useState<Disciplina | null>(null);

  const carregarDisciplinas = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await gestaoService.listarDisciplinas();
      setDisciplinas(lista);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar disciplinas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDisciplinas();
  }, [carregarDisciplinas]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nomeNovaDisciplina.trim();
    if (!nomeLimpo) {
      setErroForm('Informe o nome da disciplina.');
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      await gestaoService.criarDisciplina(nomeLimpo);
      toast.success('Disciplina criada com sucesso!');
      setNomeNovaDisciplina('');
      setModalCriarAberto(false);
      await carregarDisciplinas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar disciplina.';
      setErroForm(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!disciplinaParaExcluir) return;

    setExcluindo(true);
    try {
      await gestaoService.excluirDisciplina(disciplinaParaExcluir.id);
      toast.success('Disciplina excluída com sucesso!');
      setDisciplinaParaExcluir(null);
      await carregarDisciplinas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível excluir a disciplina.';
      toast.error(msg);
    } finally {
      setExcluindo(false);
    }
  };

  const disciplinasFiltradas = disciplinas.filter((d) =>
    d.nome.toLowerCase().includes(busca.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Disciplinas
          </h2>
          <p className="text-sm text-slate-500">
            Gerencie a grade curricular e matérias oferecidas na escola.
          </p>
        </div>

        <Button
          onClick={() => {
            setNomeNovaDisciplina('');
            setErroForm(null);
            setModalCriarAberto(true);
          }}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Disciplina
        </Button>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Barra de Filtro */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar disciplina..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
        />
      </div>

      {/* Lista / Tabela */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-slate-800">
              Grade Cadastrada ({disciplinas.length})
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {carregando ? (
            <div className="p-8 flex justify-center items-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Carregando disciplinas...</span>
            </div>
          ) : disciplinasFiltradas.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">
                {busca ? 'Nenhuma disciplina encontrada com esse termo.' : 'Nenhuma disciplina cadastrada.'}
              </p>
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {disciplinasFiltradas.map((disc) => (
                <div
                  key={disc.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {disc.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{disc.nome}</p>
                      <p className="text-xs text-slate-400">ID: {disc.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisciplinaSubmaterias(disc)}
                      className="text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Submatérias</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisciplinaParaExcluir(disc)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      title="Excluir disciplina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Disciplina */}
      <Modal
        isOpen={modalCriarAberto}
        onClose={() => !salvando && setModalCriarAberto(false)}
        title="Nova Disciplina"
      >
        <form onSubmit={handleCriar} className="space-y-4">
          <Input
            label="Nome da Disciplina"
            value={nomeNovaDisciplina}
            onChange={(e) => setNomeNovaDisciplina(e.target.value)}
            placeholder="Ex: Língua Portuguesa, Matemática, História"
            required
            autoFocus
            disabled={salvando}
            error={erroForm || undefined}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalCriarAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="flex items-center gap-2">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={!!disciplinaParaExcluir}
        onClose={() => setDisciplinaParaExcluir(null)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Disciplina"
        message={`Tem certeza que deseja excluir "${disciplinaParaExcluir?.nome}"? Se houver turmas ou atividades vinculadas, a exclusão não será permitida.`}
        confirmText={excluindo ? 'Excluindo...' : 'Sim, excluir'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={excluindo}
      />

      {/* Modal Gerenciar Submatérias da Disciplina */}
      {disciplinaSubmaterias && (
        <ModalGerenciarSubmaterias
          aberto={!!disciplinaSubmaterias}
          onFechar={() => setDisciplinaSubmaterias(null)}
          disciplinaId={disciplinaSubmaterias.id}
          disciplinaNome={disciplinaSubmaterias.nome}
        />
      )}
    </div>
  );
};
