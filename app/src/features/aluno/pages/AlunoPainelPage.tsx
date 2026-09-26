import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande, ChipInfo } from '@/components/aluno';
import { alunoService, assinarMudancas } from '@/services';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui';
import {
  LogOut,
  Sparkles,
  GraduationCap,
  Loader2,
  RefreshCw,
  AlertCircle,
  Volume2,
  VolumeX,
  Bell,
  Calendar,
  Play,
  ArrowRight,
  CheckCircle2,
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AtividadeResumoAluno, Aviso, MeuDesempenhoAluno } from '@/lib/types';
import { isSomHabilitado, setSomHabilitado, tocarSomAcerto } from '../utils/audio';

function formatarDataBr(dataStr: string | null): string {
  if (!dataStr) return '';
  const parteData = dataStr.split('T')[0];
  const partes = parteData.split('-');
  if (partes.length !== 3) return dataStr;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export const AlunoPainelPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { entrar } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [dadosAluno, setDadosAluno] = useState<MeuDesempenhoAluno | null>(null);
  const [atividades, setAtividades] = useState<AtividadeResumoAluno[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const [somAtivo, setSomAtivoState] = useState<boolean>(() => isSomHabilitado());
  const [abaAtiva, setAbaAtiva] = useState<'para_fazer' | 'concluidas'>('para_fazer');
  const [expandirAvisos, setExpandirAvisos] = useState(false);

  const carregarDados = useCallback(async () => {
    const token = localStorage.getItem('saberpontual_aluno_token');

    if (!token) {
      navigate('/aluno', { replace: true });
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const [desempenho, ativs, avisosList] = await Promise.all([
        alunoService.meuDesempenho(token),
        alunoService.atividadesPendentes(token),
        alunoService.avisos(token),
      ]);

      setDadosAluno(desempenho);
      setAtividades(ativs);
      setAvisos(avisosList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      const isSessaoInvalida =
        msgLower.includes('sessão expirada') ||
        msgLower.includes('sessão inválida') ||
        msgLower.includes('aluno não encontrado') ||
        msgLower.includes('acesse novamente');

      if (isSessaoInvalida) {
        localStorage.removeItem('saberpontual_aluno_token');
        toast.error('Sua sessão expirou ou é inválida. Por favor, acesse novamente.', 'Sessão encerrada');
        navigate('/aluno', { replace: true });
      } else {
        if (msg.includes('Os dados foram atualizados em outra aba')) {
          toast.warning(msg, 'Atenção');
        } else {
          toast.error(msg, 'Erro ao carregar');
        }
        setErro(msg);
      }
    } finally {
      setCarregando(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    carregarDados();
    const desassinar = assinarMudancas(() => {
      carregarDados();
    });
    return () => {
      desassinar();
    };
  }, [carregarDados]);

  const handleToggleSom = () => {
    const novoValor = !somAtivo;
    setSomHabilitado(novoValor);
    setSomAtivoState(novoValor);
    if (novoValor) {
      tocarSomAcerto();
      toast.info('Efeitos sonoros ativados', 'Som ligado');
    } else {
      toast.info('Efeitos sonoros desativados', 'Som mudo');
    }
  };

  const handleSair = () => {
    localStorage.removeItem('saberpontual_aluno_token');
    navigate('/aluno', { replace: true });
  };

  // Separação oficial: "Para fazer" vs "Concluídas"
  const atividadesParaFazer = useMemo(
    () => atividades.filter((a) => !a.concluida && a.status !== 'encerrada'),
    [atividades]
  );

  const atividadesConcluidas = useMemo(
    () => atividades.filter((a) => a.concluida || a.status === 'encerrada'),
    [atividades]
  );

  // Agrupamento por disciplina da aba atual
  const listaExibicao = abaAtiva === 'para_fazer' ? atividadesParaFazer : atividadesConcluidas;

  const gruposPorDisciplina = useMemo(() => {
    const grupos: Record<string, AtividadeResumoAluno[]> = {};
    for (const ativ of listaExibicao) {
      const disc = ativ.disciplina_nome || 'Geral';
      if (!grupos[disc]) {
        grupos[disc] = [];
      }
      grupos[disc].push(ativ);
    }
    return grupos;
  }, [listaExibicao]);

  const avisosVisiveis = useMemo(() => {
    if (expandirAvisos) return avisos;
    return avisos.slice(0, 3);
  }, [avisos, expandirAvisos]);

  if (carregando) {
    return (
      <AlunoLayout containerClassName="items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-indigo-700">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-heading font-bold text-lg">Carregando seu painel...</p>
        </div>
      </AlunoLayout>
    );
  }

  if (erro && !dadosAluno) {
    return (
      <AlunoLayout containerClassName="items-center justify-center p-4 py-12">
        <main className="w-full max-w-lg space-y-4">
          <CartaoVidro className="p-6 sm:p-10 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="font-heading font-black text-2xl text-slate-900 tracking-tight">
                Não foi possível carregar os dados
              </h1>
              <p className="text-sm text-slate-600 font-sans leading-relaxed">{erro}</p>
            </div>

            <div className="space-y-3 pt-2">
              <BotaoGrande
                variant="primary"
                onClick={carregarDados}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="w-full"
              >
                Tentar de novo
              </BotaoGrande>

              <BotaoGrande
                variant="outline"
                onClick={handleSair}
                leftIcon={<LogOut className="w-4 h-4" />}
                className="w-full text-slate-600"
              >
                Sair
              </BotaoGrande>
            </div>
          </CartaoVidro>
        </main>
      </AlunoLayout>
    );
  }

  const alunoNome = dadosAluno?.aluno.nome_completo || 'Aluno';
  const turmaNome = dadosAluno?.turma.nome || '';

  return (
    <AlunoLayout containerClassName="p-3 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto w-full space-y-5 sm:space-y-8 pb-12">
        {/* 1. TOPO: Identificação do Aluno, Turma, Controle de Som e Sair (Mobile-First) */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white/85 backdrop-blur-md p-3.5 sm:p-6 rounded-3xl border-2 border-white/80 shadow-playful">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-300/50 shrink-0">
                <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-black text-lg sm:text-2xl text-slate-900 tracking-tight truncate">
                  Olá, {alunoNome}!
                </h1>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {turmaNome && (
                    <ChipInfo color="indigo" className="py-0.5 px-2 text-[11px]">
                      {turmaNome}
                    </ChipInfo>
                  )}
                  <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Bons estudos!</span>
                </div>
              </div>
            </div>

            {/* Em telas muito pequenas, o botão sair pode ficar ao lado ou na barra de ações */}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:border-none">
            {/* Atalho Rápido para voltar ao Professor */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await entrar('ana@demo.com', 'demo123');
                  navigate('/professor');
                } catch {
                  navigate('/entrar');
                }
              }}
              className="px-2.5 py-2 sm:p-3 rounded-2xl border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-heading font-bold shadow-sm min-h-[42px]"
              title="Alternar para visão da Professora Ana Paula"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="hidden xs:inline sm:inline">Modo Prof</span>
            </button>

            {/* Botão de Som */}
            <button
              type="button"
              onClick={handleToggleSom}
              aria-label={somAtivo ? 'Desativar som' : 'Ativar som'}
              title={somAtivo ? 'Som ligado (clique para mutar)' : 'Som desligado (clique para ativar)'}
              className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-heading font-bold min-h-[42px] ${
                somAtivo
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm'
                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {somAtivo ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />}
              <span className="hidden sm:inline">{somAtivo ? 'Som ligado' : 'Mudo'}</span>
            </button>

            {/* Botão Sair */}
            <button
              type="button"
              onClick={handleSair}
              className="p-2.5 sm:p-3 rounded-2xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-heading font-bold shadow-sm min-h-[42px]"
              title="Sair do portal"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* 2. MURAL DE AVISOS (alunoService.avisos) */}
        {avisos.length > 0 && (
          <section aria-labelledby="mural-avisos-titulo">
            <CartaoVidro className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h2 id="mural-avisos-titulo" className="font-heading font-black text-lg text-slate-800">
                    Mural de Avisos
                  </h2>
                </div>

                {avisos.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setExpandirAvisos(!expandirAvisos)}
                    className="inline-flex items-center gap-1 text-xs font-heading font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer p-1"
                  >
                    <span>{expandirAvisos ? 'Ver menos' : `Ver todos (${avisos.length})`}</span>
                    {expandirAvisos ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {avisosVisiveis.map((aviso) => {
                  const isAlta = aviso.prioridade === 'alta';
                  return (
                    <div
                      key={aviso.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isAlta
                          ? 'bg-gradient-to-br from-amber-50/90 to-rose-50/70 border-amber-300 shadow-sm'
                          : 'bg-white/80 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {isAlta ? (
                          <ChipInfo color="amber" icon={<AlertCircle className="w-3 h-3 text-amber-600" />}>
                            Importante
                          </ChipInfo>
                        ) : (
                          <ChipInfo color="slate">Aviso</ChipInfo>
                        )}
                        <span className="text-[11px] font-sans text-slate-400">
                          {formatarDataBr(aviso.publicado_em)}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold text-sm text-slate-800 mb-1">
                        {aviso.titulo}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-sans line-clamp-3">
                        {aviso.mensagem}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CartaoVidro>
          </section>
        )}

        {/* 3. ATIVIDADES: Separadas em "Para fazer" e "Concluídas", agrupadas por disciplina */}
        <section aria-labelledby="atividades-secao-titulo" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="atividades-secao-titulo" className="font-heading font-black text-2xl text-slate-900 tracking-tight">
                Suas Atividades
              </h2>
              <p className="text-sm text-slate-600 font-sans">
                Acesse suas tarefas e acompanhe seu aprendizado
              </p>
            </div>

            {/* Alternador de Abas (Mobile-First: largura total e toque confortável) */}
            <div className="w-full sm:w-auto flex p-1 rounded-2xl bg-white/85 backdrop-blur-md border border-slate-200/80 shadow-sm">
              <button
                type="button"
                onClick={() => setAbaAtiva('para_fazer')}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-heading font-bold transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] ${
                  abaAtiva === 'para_fazer'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <span>Para fazer</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    abaAtiva === 'para_fazer' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {atividadesParaFazer.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva('concluidas')}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-heading font-bold transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] ${
                  abaAtiva === 'concluidas'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <span>Concluídas</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    abaAtiva === 'concluidas' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {atividadesConcluidas.length}
                </span>
              </button>
            </div>
          </div>

          {/* Lista vazia */}
          {Object.keys(gruposPorDisciplina).length === 0 && (
            <CartaoVidro className="p-8 sm:p-12 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-black text-lg text-slate-800">
                {abaAtiva === 'para_fazer'
                  ? 'Tudo em dia!'
                  : 'Nenhuma atividade concluída ainda'}
              </h3>
              <p className="text-sm text-slate-600 font-sans max-w-md mx-auto">
                {abaAtiva === 'para_fazer'
                  ? 'Você não tem atividades pendentes para fazer no momento. Parabéns pelo empenho!'
                  : 'Assim que você concluir seus exercícios ou provas, os resultados aparecerão aqui.'}
              </p>
            </CartaoVidro>
          )}

          {/* Grupos por Disciplina */}
          {Object.entries(gruposPorDisciplina).map(([disciplina, lista]) => (
            <div key={disciplina} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="font-heading font-black text-lg text-slate-800">
                  {disciplina}
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  ({lista.length} {lista.length === 1 ? 'atividade' : 'atividades'})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lista.map((ativ) => {
                  const pct =
                    ativ.total_questoes > 0
                      ? Math.round((ativ.questoes_respondidas / ativ.total_questoes) * 100)
                      : 0;

                  const isEncerrada = ativ.status === 'encerrada';
                  const isProva = ativ.modo === 'prova';

                  return (
                    <CartaoVidro
                      key={ativ.id}
                      hover
                      className="p-4 sm:p-6 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Chips superiores */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isProva ? (
                              <ChipInfo color="pink" icon={<FileText className="w-3.5 h-3.5" />}>
                                Prova
                              </ChipInfo>
                            ) : (
                              <ChipInfo color="emerald" icon={<Sparkles className="w-3.5 h-3.5" />}>
                                Exercício
                              </ChipInfo>
                            )}

                            {isEncerrada && (
                              <ChipInfo color="slate">Encerrada</ChipInfo>
                            )}
                          </div>

                          {ativ.prazo && !isEncerrada && (
                            <ChipInfo color="amber" icon={<Calendar className="w-3 h-3 text-amber-700" />}>
                              Até {formatarDataBr(ativ.prazo)}
                            </ChipInfo>
                          )}
                        </div>

                        {/* Título e Descrição */}
                        <div>
                          <h4 className="font-heading font-black text-base sm:text-xl text-slate-900 leading-snug">
                            {ativ.titulo}
                          </h4>
                          {ativ.descricao && (
                            <p className="text-xs sm:text-sm text-slate-600 font-sans mt-1 leading-relaxed line-clamp-2">
                              {ativ.descricao}
                            </p>
                          )}
                        </div>

                        {/* Barra de Progresso Fina */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs font-heading font-bold text-slate-600">
                            <span>Progresso</span>
                            <span>
                              {ativ.questoes_respondidas} de {ativ.total_questoes} respondidas
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                ativ.concluida || isEncerrada
                                  ? 'bg-emerald-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Aproveitamento em exercício concluído */}
                        {abaAtiva === 'concluidas' &&
                          !isProva &&
                          ativ.aproveitamento !== undefined && (
                            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                              <span className="text-xs font-heading font-bold text-emerald-800">
                                Aproveitamento:
                              </span>
                              <span className="font-heading font-black text-base text-emerald-700">
                                {ativ.aproveitamento}%
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Botão de Ação (Mobile-First: min-h 48px e largura total) */}
                      <div className="pt-3.5 mt-2">
                        {abaAtiva === 'para_fazer' ? (
                          ativ.questoes_respondidas === 0 ? (
                            <BotaoGrande
                              variant="primary"
                              onClick={() => navigate(`/aluno/atividade/${ativ.id}`)}
                              leftIcon={<Play className="w-4 h-4 fill-white" />}
                              className="w-full text-sm sm:text-base min-h-[48px]"
                            >
                              Começar
                            </BotaoGrande>
                          ) : (
                            <BotaoGrande
                              variant="primary"
                              onClick={() => navigate(`/aluno/atividade/${ativ.id}`)}
                              leftIcon={<ArrowRight className="w-4 h-4" />}
                              className="w-full text-sm sm:text-base min-h-[48px]"
                            >
                              Continuar
                            </BotaoGrande>
                          )
                        ) : (
                          <BotaoGrande
                            variant="outline"
                            onClick={() => navigate(`/aluno/atividade/${ativ.id}`)}
                            leftIcon={<CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                            className="w-full text-sm sm:text-base min-h-[48px]"
                          >
                            Ver resultado
                          </BotaoGrande>
                        )}
                      </div>
                    </CartaoVidro>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </AlunoLayout>
  );
};

export default AlunoPainelPage;
