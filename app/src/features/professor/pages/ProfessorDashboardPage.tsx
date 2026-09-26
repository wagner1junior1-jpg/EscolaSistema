import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, Button } from '@/components/ui';
import { professorService, OfertaDetalhada, assinarMudancas } from '@/services';
import {
  GraduationCap,
  Users,
  Key,
  BookOpen,
  ArrowRight,
  Loader2,
  FileEdit,
  Send,
  Archive,
  AlertCircle,
  Database,
} from 'lucide-react';

interface OfertaComContagem extends OfertaDetalhada {
  totalRascunhos: number;
  totalPublicadas: number;
  totalEncerradas: number;
  totalGeral: number;
}

export const ProfessorDashboardPage: React.FC = () => {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [ofertas, setOfertas] = useState<OfertaComContagem[]>([]);
  const [serieSelecionada, setSerieSelecionada] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Extrai todas as séries únicas das ofertas atribuídas ao professor
  const seriesDisponiveis = React.useMemo(() => {
    const setSeries = new Set<string>();
    ofertas.forEach((o) => {
      if (o.turma_serie) {
        setSeries.add(o.turma_serie);
      } else {
        setSeries.add('Outras turmas');
      }
    });
    return Array.from(setSeries).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [ofertas]);

  // Mantém a primeira série selecionada por padrão ou ajusta se a lista mudar
  useEffect(() => {
    if (seriesDisponiveis.length > 0) {
      if (!serieSelecionada || !seriesDisponiveis.includes(serieSelecionada)) {
        setSerieSelecionada(seriesDisponiveis[0]);
      }
    } else {
      setSerieSelecionada(null);
    }
  }, [seriesDisponiveis, serieSelecionada]);

  // Filtra as ofertas de acordo com a série ativa
  const ofertasFiltradas = React.useMemo(() => {
    if (!serieSelecionada) return ofertas;
    return ofertas.filter((o) => (o.turma_serie || 'Outras turmas') === serieSelecionada);
  }, [ofertas, serieSelecionada]);

  useEffect(() => {
    let montado = true;

    async function carregarDados() {
      setCarregando(true);
      setErro(null);
      try {
        const listaOfertas = await professorService.minhasOfertas();

        // Para cada oferta, busca suas atividades e calcula a contagem por status
        const ofertasComContagens: OfertaComContagem[] = await Promise.all(
          listaOfertas.map(async (oferta) => {
            try {
              const atividades = await professorService.listarAtividades(oferta.id);
              const totalRascunhos = atividades.filter((a) => a.status === 'rascunho').length;
              const totalPublicadas = atividades.filter((a) => a.status === 'publicada').length;
              const totalEncerradas = atividades.filter((a) => a.status === 'encerrada').length;

              return {
                ...oferta,
                totalRascunhos,
                totalPublicadas,
                totalEncerradas,
                totalGeral: atividades.length,
              };
            } catch {
              return {
                ...oferta,
                totalRascunhos: 0,
                totalPublicadas: 0,
                totalEncerradas: 0,
                totalGeral: 0,
              };
            }
          })
        );

        if (montado) {
          setOfertas(ofertasComContagens);
        }
      } catch (err: unknown) {
        if (montado) {
          setErro(
            err instanceof Error ? err.message : 'Falha ao carregar turmas do professor.'
          );
        }
      } finally {
        if (montado) {
          setCarregando(false);
        }
      }
    }

    carregarDados();

    const desassinar = assinarMudancas(() => {
      if (montado) {
        carregarDados();
      }
    });

    return () => {
      montado = false;
      desassinar();
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabeçalho de Boas-vindas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Minhas Turmas
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-sans">
                Olá, {usuario?.nome || 'Professor(a)'}! Selecione uma turma para gerenciar
                atividades, avaliações e exercícios diagnósticos.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <Button
              variant="outline"
              leftIcon={<Database className="w-4 h-4 text-indigo-600" />}
              onClick={() => navigate('/professor/banco')}
              className="border-slate-300 hover:border-indigo-400 font-semibold"
            >
              Banco de questões
            </Button>
          </div>
        </div>

        {/* Estado de Carregamento */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando suas turmas...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {!carregando && erro && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-medium">{erro}</p>
          </div>
        )}

        {/* Seletor de Séries em que o Professor leciona */}
        {!carregando && !erro && seriesDisponiveis.length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Séries em que leciona:
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {seriesDisponiveis.length} {seriesDisponiveis.length === 1 ? 'série' : 'séries'} vinculada{seriesDisponiveis.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1" role="tablist" aria-label="Séries">
              {seriesDisponiveis.map((serie) => {
                const ativa = serie === serieSelecionada;
                const qtdMaterias = ofertas.filter(
                  (o) => (o.turma_serie || 'Outras turmas') === serie
                ).length;

                return (
                  <button
                    key={serie}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setSerieSelecionada(serie)}
                    data-testid={`aba-serie-${serie}`}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                      ativa
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600/30'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-white hover:text-indigo-600'
                    }`}
                  >
                    <span>{serie}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        ativa
                          ? 'bg-indigo-700/80 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {qtdMaterias} {qtdMaterias === 1 ? 'matéria' : 'matérias'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de Turmas / Ofertas */}
        {!carregando && !erro && ofertas.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-heading font-bold text-lg text-slate-700">
              Nenhuma turma atribuída
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Você ainda não possui ofertas vinculadas. A coordenação escolar é responsável pela
              atribuição de turmas e disciplinas.
            </p>
          </div>
        )}

        {/* Nenhuma matéria na série selecionada */}
        {!carregando && !erro && ofertas.length > 0 && ofertasFiltradas.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-heading font-bold text-base text-slate-700">
              Nenhuma matéria encontrada nesta série
            </h3>
            <p className="text-sm text-slate-500">
              Selecione outra série acima para visualizar suas turmas e disciplinas.
            </p>
          </div>
        )}

        {!carregando && !erro && ofertasFiltradas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {ofertasFiltradas.map((oferta) => (
              <Card
                key={oferta.id}
                hover
                onClick={() => navigate(`/professor/oferta/${oferta.id}`)}
                className="cursor-pointer border-slate-200 hover:border-indigo-300 group flex flex-col justify-between"
              >
                <CardContent className="p-6 space-y-4">
                  {/* Topo do Cartão: Turma e Disciplina */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                        {oferta.disciplina_nome}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg" title="Código de acesso para os alunos">
                        <Key className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono font-bold text-slate-700">{oferta.turma_codigo}</span>
                      </div>
                    </div>

                    <h2 className="font-heading font-black text-xl text-slate-900 group-hover:text-indigo-600 transition-colors pt-1">
                      {oferta.turma_nome}
                    </h2>
                  </div>

                  {/* Contagem de Atividades por Status */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      Atividades ({oferta.totalGeral})
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Rascunhos */}
                      <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 mb-0.5">
                          <FileEdit className="w-3 h-3" />
                          <span>Rascunho</span>
                        </div>
                        <span className="font-heading font-black text-base text-amber-900">
                          {oferta.totalRascunhos}
                        </span>
                      </div>

                      {/* Publicadas */}
                      <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 mb-0.5">
                          <Send className="w-3 h-3" />
                          <span>Publicada</span>
                        </div>
                        <span className="font-heading font-black text-base text-emerald-900">
                          {oferta.totalPublicadas}
                        </span>
                      </div>

                      {/* Encerradas */}
                      <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-600 mb-0.5">
                          <Archive className="w-3 h-3" />
                          <span>Encerrada</span>
                        </div>
                        <span className="font-heading font-black text-base text-slate-800">
                          {oferta.totalEncerradas}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ação Inferior */}
                  <div className="pt-2 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Gerenciar atividades
                    </span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ProfessorDashboardPage;
