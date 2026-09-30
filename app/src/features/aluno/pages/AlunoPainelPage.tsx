import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande, ChipInfo } from '@/components/aluno';
import { alunoService, assinarMudancas } from '@/services';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui';
import { IndicadorSincronizacao } from '@/components/common/IndicadorSincronizacao';
import {
  LogOut,
  Sparkles,
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
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Clock,
  BarChart3,
  Trophy,
  X,
  Lock,
} from 'lucide-react';
import { AtividadeResumoAluno, Aviso, MeuDesempenhoAluno } from '@/lib/types';
import { isSomHabilitado, setSomHabilitado, tocarSomAcerto } from '../utils/audio';
import { dispararConfeteFim } from '../utils/confetti';

export interface ConfigAvatar {
  id: string;
  emoji: string;
  nome: string;
  bg: string;
  requisitoTipo: 'inicial' | 'atividades' | 'streak';
  requisitoValor: number;
  descricaoRequisito: string;
}

export const AVATARES: ConfigAvatar[] = [
  { id: 'astronauta', emoji: '🚀', nome: 'Astronauta', bg: 'bg-indigo-600', requisitoTipo: 'inicial', requisitoValor: 0, descricaoRequisito: 'Mascote inicial' },
  { id: 'raposa', emoji: '🦊', nome: 'Raposa', bg: 'bg-amber-500', requisitoTipo: 'inicial', requisitoValor: 0, descricaoRequisito: 'Mascote inicial' },
  { id: 'heroi', emoji: '⚡', nome: 'Herói', bg: 'bg-yellow-500', requisitoTipo: 'inicial', requisitoValor: 0, descricaoRequisito: 'Mascote inicial' },
  { id: 'cientista', emoji: '🔬', nome: 'Cientista', bg: 'bg-emerald-600', requisitoTipo: 'atividades', requisitoValor: 1, descricaoRequisito: 'Conclua 1 atividade' },
  { id: 'artista', emoji: '🎨', nome: 'Artista', bg: 'bg-pink-500', requisitoTipo: 'atividades', requisitoValor: 2, descricaoRequisito: 'Conclua 2 atividades' },
  { id: 'coruja', emoji: '🦉', nome: 'Coruja', bg: 'bg-violet-600', requisitoTipo: 'streak', requisitoValor: 2, descricaoRequisito: 'Mantenha 2 dias de sequência' },
  { id: 'robo', emoji: '🤖', nome: 'Robô', bg: 'bg-cyan-600', requisitoTipo: 'atividades', requisitoValor: 4, descricaoRequisito: 'Conclua 4 atividades' },
  { id: 'leao', emoji: '🦁', nome: 'Leão', bg: 'bg-orange-500', requisitoTipo: 'atividades', requisitoValor: 6, descricaoRequisito: 'Conclua 6 atividades' },
];

export function isAvatarDesbloqueado(av: ConfigAvatar, totalConcluidas: number, streak: number): boolean {
  if (av.requisitoTipo === 'inicial') return true;
  if (av.requisitoTipo === 'atividades') return totalConcluidas >= av.requisitoValor;
  if (av.requisitoTipo === 'streak') return streak >= av.requisitoValor;
  return true;
}

function calcularEAtualizarStreak(alunoId: string): number {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const keyUltimoAcesso = `saberpontual_ultimo_acesso_${alunoId}`;
  const keyStreak = `saberpontual_streak_${alunoId}`;
  
  const ultimoAcessoStr = localStorage.getItem(keyUltimoAcesso);
  const streakSalvo = localStorage.getItem(keyStreak);
  const streakAtual = streakSalvo ? parseInt(streakSalvo, 10) : 1;
  
  if (!ultimoAcessoStr) {
    localStorage.setItem(keyUltimoAcesso, hojeStr);
    localStorage.setItem(keyStreak, String(streakAtual > 0 ? streakAtual : 1));
    return streakAtual > 0 ? streakAtual : 1;
  }
  
  if (ultimoAcessoStr === hojeStr) {
    return Math.max(1, streakAtual);
  }
  
  const partesHoje = hojeStr.split('-').map(Number);
  const partesUltimo = ultimoAcessoStr.split('-').map(Number);
  const dataHojeMs = Date.UTC(partesHoje[0], partesHoje[1] - 1, partesHoje[2]);
  const dataUltimoMs = Date.UTC(partesUltimo[0], partesUltimo[1] - 1, partesUltimo[2]);
  const diffDias = Math.round((dataHojeMs - dataUltimoMs) / (1000 * 60 * 60 * 24));
  
  let novoStreak = 1;
  if (diffDias === 1) {
    novoStreak = streakAtual + 1;
  } else if (diffDias > 1) {
    novoStreak = 1;
  } else {
    novoStreak = Math.max(1, streakAtual);
  }
  
  localStorage.setItem(keyUltimoAcesso, hojeStr);
  localStorage.setItem(keyStreak, String(novoStreak));
  return novoStreak;
}

function obterSaudacao(): string {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function obterStatusPrazo(prazoStr: string | null): {
  label: string;
  tipo: 'urgente' | 'amanha' | 'proximo' | 'normal' | 'expirado';
} | null {
  if (!prazoStr) return null;
  const parteData = prazoStr.split('T')[0];
  const partes = parteData.split('-');
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  if (!ano || !mes || !dia) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPrazo = new Date(ano, mes - 1, dia);
  dataPrazo.setHours(0, 0, 0, 0);

  const diffMs = dataPrazo.getTime() - hoje.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return { label: `Venceu em ${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`, tipo: 'expirado' };
  }
  if (diffDias === 0) {
    return { label: 'Vence hoje!', tipo: 'urgente' };
  }
  if (diffDias === 1) {
    return { label: 'Vence amanhã!', tipo: 'amanha' };
  }
  if (diffDias <= 3) {
    return { label: `Restam ${diffDias} dias`, tipo: 'proximo' };
  }
  return { label: `Até ${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`, tipo: 'normal' };
}

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
  const [expandirAvisos, setExpandirAvisos] = useState(true);
  const [indiceAvisoAtual, setIndiceAvisoAtual] = useState(0);
  const [muralMinimizado, setMuralMinimizado] = useState(false);

  // Módulos 1, 2, 4, 5
  const [avatarEscolhido, setAvatarEscolhido] = useState<string>('astronauta');
  const [modalAvatarAberto, setModalAvatarAberto] = useState(false);
  const [diasStreak, setDiasStreak] = useState<number>(3);
  const [mostrarBoletim, setMostrarBoletim] = useState(false);
  const [disciplinaFiltro, setDisciplinaFiltro] = useState<string>('todas');

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

  // Lista de disciplinas disponíveis para filtro
  const disciplinasDisponiveis = useMemo(() => {
    return Object.keys(gruposPorDisciplina);
  }, [gruposPorDisciplina]);

  // Grupos filtrados pela disciplina ativa
  const gruposFiltrados = useMemo(() => {
    if (disciplinaFiltro === 'todas') return gruposPorDisciplina;
    if (!gruposPorDisciplina[disciplinaFiltro]) return {};
    return { [disciplinaFiltro]: gruposPorDisciplina[disciplinaFiltro] };
  }, [gruposPorDisciplina, disciplinaFiltro]);

  // Progresso geral do bimestre
  const totalGeralAtividades = atividades.length;
  const totalConcluidasGeral = atividadesConcluidas.length;
  const pctGeral = totalGeralAtividades > 0
    ? Math.round((totalConcluidasGeral / totalGeralAtividades) * 100)
    : 0;

  // Avatar atual selecionado
  const avatarAtual = useMemo(() => {
    return AVATARES.find((a) => a.id === avatarEscolhido) || AVATARES[0];
  }, [avatarEscolhido]);

  // Sincroniza avatar e streak do aluno com cálculo de data civil
  useEffect(() => {
    if (dadosAluno?.aluno.id) {
      const alunoId = dadosAluno.aluno.id;
      const avatarSalvo = localStorage.getItem(`saberpontual_avatar_${alunoId}`);
      if (avatarSalvo && AVATARES.some((a) => a.id === avatarSalvo)) {
        setAvatarEscolhido(avatarSalvo);
      }
      const streakCalculado = calcularEAtualizarStreak(alunoId);
      setDiasStreak(streakCalculado);
    }
  }, [dadosAluno?.aluno.id]);

  // Gamificação: Cálculo de XP acumulado pelo aluno
  const xpAcumulado = useMemo(() => {
    let xp = 0;
    // Cada atividade concluída confere 50 XP
    xp += totalConcluidasGeral * 50;
    // Aproveitamento de cada atividade soma XP proporcional
    for (const ativ of atividadesConcluidas) {
      if (ativ.aproveitamento !== undefined && ativ.aproveitamento !== null) {
        xp += Math.round(ativ.aproveitamento * 0.5);
      }
    }
    // Bônus de streak de frequência diária: 15 XP por dia
    xp += diasStreak * 15;
    return xp;
  }, [totalConcluidasGeral, atividadesConcluidas, diasStreak]);

  // Nível pedagógico do aluno baseado em XP
  const nivelAluno = useMemo(() => {
    if (xpAcumulado >= 500) {
      return { nivel: 4, titulo: 'Mestre do Saber', cor: 'text-amber-800 bg-amber-50 border-amber-300' };
    }
    if (xpAcumulado >= 300) {
      return { nivel: 3, titulo: 'Estudante Focado', cor: 'text-purple-700 bg-purple-50 border-purple-200' };
    }
    if (xpAcumulado >= 150) {
      return { nivel: 2, titulo: 'Explorador', cor: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    }
    return { nivel: 1, titulo: 'Aprendiz', cor: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }, [xpAcumulado]);

  // Celebração automática quando todas as atividades forem concluídas
  const disparouConfeteRef = useRef(false);
  useEffect(() => {
    if (
      !carregando &&
      atividades.length > 0 &&
      atividadesParaFazer.length === 0 &&
      !disparouConfeteRef.current
    ) {
      disparouConfeteRef.current = true;
      dispararConfeteFim();
    }
  }, [carregando, atividades.length, atividadesParaFazer.length]);

  // Avisos ordenados: prioridade 'alta' (Importante) vem primeiro, seguido de data decrescente
  const avisosOrdenados = useMemo(() => {
    return [...avisos].sort((a, b) => {
      if (a.prioridade === 'alta' && b.prioridade !== 'alta') return -1;
      if (b.prioridade === 'alta' && a.prioridade !== 'alta') return 1;
      return new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime();
    });
  }, [avisos]);

  const indiceValido = Math.min(indiceAvisoAtual, Math.max(0, avisosOrdenados.length - 1));

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
        {/* 1. TOPO: Identificação do Aluno, Avatar, Streak, Controle de Som e Sair (Mobile-First) */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white/85 backdrop-blur-md p-3.5 sm:p-6 rounded-3xl border-2 border-white/80 shadow-playful">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar Interativo com Seletor */}
              <button
                type="button"
                onClick={() => setModalAvatarAberto(true)}
                title="Clique para trocar seu avatar"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${avatarAtual.bg} text-white flex items-center justify-center shadow-md shadow-indigo-300/40 shrink-0 text-2xl sm:text-3xl hover:scale-105 active:scale-95 transition-all cursor-pointer relative group border-2 border-white`}
              >
                <span>{avatarAtual.emoji}</span>
                <span className="absolute -bottom-1 -right-1 bg-white text-indigo-700 text-[10px] font-bold px-1 rounded-md shadow-xs border border-indigo-100 group-hover:scale-110 transition-transform">
                  ✏️
                </span>
              </button>

              <div className="min-w-0">
                <h1
                  className="font-heading font-black text-lg sm:text-2xl text-slate-900 tracking-tight leading-snug line-clamp-1"
                  title={alunoNome}
                >
                  Olá, <span className="text-indigo-700">{alunoNome}</span>!
                </h1>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {obterSaudacao()}
                  </span>
                  {turmaNome && (
                    <ChipInfo color="indigo" className="py-0.5 px-2 text-[11px]">
                      {turmaNome}
                    </ChipInfo>
                  )}
                  {/* Foguinho de Frequência (Streak) */}
                  <div
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-heading font-bold shadow-2xs"
                    title="Dias seguidos acessando a plataforma!"
                  >
                    <span>🔥</span>
                    <span>{diasStreak} {diasStreak === 1 ? 'dia' : 'dias'} seguidos</span>
                  </div>
                  {/* XP Pedagógico e Título de Nível */}
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-heading font-bold shadow-2xs ${nivelAluno.cor}`}
                    title={`${xpAcumulado} pontos de experiência acumulados`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{xpAcumulado} XP • {nivelAluno.titulo}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:border-none">
            {/* Indicador de Nuvem / Sincronização */}
            <IndicadorSincronizacao variante="aluno" />

            {/* Botão Meu Boletim / Desempenho */}
            <button
              type="button"
              onClick={() => setMostrarBoletim(!mostrarBoletim)}
              className={`px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-heading font-bold min-h-[42px] ${
                mostrarBoletim
                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200'
              }`}
              title={mostrarBoletim ? 'Fechar boletim' : 'Ver meu desempenho por matéria'}
            >
              <BarChart3 className={`w-4 h-4 sm:w-5 sm:h-5 ${mostrarBoletim ? 'text-white' : 'text-indigo-600'}`} />
              <span className="hidden xs:inline sm:inline">Boletim</span>
            </button>

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

        {/* 1.1 SEÇÃO: Meu Boletim Escolar (Aproveitamento das matérias) */}
        {mostrarBoletim && dadosAluno && (
          <section aria-labelledby="meu-desempenho-titulo" className="animate-in fade-in slide-in-from-top-3 duration-200">
            <CartaoVidro className="p-5 sm:p-6 space-y-4 border-2 border-indigo-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 id="meu-desempenho-titulo" className="font-heading font-black text-lg text-slate-900">
                      Meu Desempenho Escolar
                    </h2>
                    <p className="text-xs text-slate-500 font-sans">
                      {dadosAluno.periodo_atual.nome} • Acompanhe suas notas e situação por disciplina
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarBoletim(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Fechar boletim"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {dadosAluno.disciplinas.map((item) => {
                  const mediaFmt = item.media_periodo !== null ? item.media_periodo.toFixed(1).replace('.', ',') : '—';
                  const corFaixa =
                    item.faixa === 'Ótimo'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : item.faixa === 'Bom'
                      ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                      : item.faixa === 'Atenção'
                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : 'text-slate-600 bg-slate-50 border-slate-200';

                  const rotuloFaixa = item.faixa;

                  const mediaNum = item.media_periodo !== null ? item.media_periodo : null;
                  const pctMedia = mediaNum !== null ? Math.min(100, Math.max(0, (mediaNum / 10) * 100)) : 0;
                  const corBarra =
                    item.faixa === 'Ótimo'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : item.faixa === 'Bom'
                      ? 'bg-gradient-to-r from-indigo-500 to-blue-500'
                      : item.faixa === 'Atenção'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-slate-300';

                  return (
                    <div
                      key={item.oferta_id}
                      className="p-4 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-heading font-bold text-base text-slate-900">
                            {item.disciplina_nome}
                          </h3>
                          <p className="text-xs text-slate-500 font-sans">
                            {item.professor_nome}
                          </p>
                        </div>
                        <span className={`text-[11px] font-heading font-bold px-2 py-0.5 rounded-full border ${corFaixa}`}>
                          {rotuloFaixa}
                        </span>
                      </div>

                      <div className="flex items-end justify-between pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-[11px] text-slate-400 font-sans block">Média no período</span>
                          <span className="font-heading font-black text-xl text-slate-900">
                            {mediaFmt}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 font-sans block">Atividades</span>
                          <span className="text-xs font-heading font-bold text-slate-700">
                            {item.atividades_concluidas} concluídas
                          </span>
                        </div>
                      </div>

                      {/* Mini Barra Visual de Aproveitamento com Marcador de Meta 6.0 */}
                      <div className="space-y-1 pt-1.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-heading font-semibold text-slate-500">
                          <span>Aproveitamento da média</span>
                          <span>{mediaNum !== null ? `${Math.round(pctMedia)}%` : 'Sem notas'}</span>
                        </div>
                        <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${corBarra}`}
                            style={{ width: `${pctMedia}%` }}
                          />
                          {/* Linha indicadora de meta 6.0 (60%) */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-400/70 z-10"
                            style={{ left: '60%' }}
                            title="Meta da escola: 6,0"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CartaoVidro>
          </section>
        )}

        {/* 2. MURAL DE AVISOS (alunoService.avisos) */}
        {avisos.length > 0 ? (
          <section aria-labelledby="mural-avisos-titulo">
            {muralMinimizado ? (
              <CartaoVidro className="p-3 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-slate-800">
                      Mural de Avisos
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMuralMinimizado(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 py-1.5 px-3 rounded-xl transition-all cursor-pointer"
                  title="Expandir mural de avisos"
                >
                  <span>Abrir mural</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </CartaoVidro>
            ) : (
              <CartaoVidro className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <h2 id="mural-avisos-titulo" className="font-heading font-black text-lg text-slate-800">
                      Mural de Avisos
                    </h2>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {avisos.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {avisos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExpandirAvisos(!expandirAvisos)}
                        className="inline-flex items-center gap-1 text-xs font-heading font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer p-1.5 rounded-lg hover:bg-indigo-50/80 transition-colors"
                        title={expandirAvisos ? 'Recolher para 1 aviso' : 'Ver todos os avisos'}
                      >
                        <span>{expandirAvisos ? 'Ver menos' : `Ver todos (${avisos.length})`}</span>
                        {expandirAvisos ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setMuralMinimizado(true)}
                      title="Ocultar mural temporariamente"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Minimizar mural"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Exibição: 1 Aviso em Destaque (com navegação) vs Grade Completa */}
                {!expandirAvisos && avisosOrdenados.length > 0 && (() => {
                  const aviso = avisosOrdenados[indiceValido];
                  const isAlta = aviso.prioridade === 'alta';
                  return (
                    <div className="space-y-3">
                      <div
                        key={aviso.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isAlta
                            ? 'bg-gradient-to-br from-amber-50/90 to-rose-50/70 border-amber-300 shadow-sm'
                            : 'bg-white/80 border-slate-200/80 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
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

                          {/* Navegação tipo carrossel 1 de N quando há mais de 1 aviso */}
                          {avisosOrdenados.length > 1 && (
                            <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-2 py-1 rounded-xl border border-slate-200/60 text-xs text-slate-600">
                              <button
                                type="button"
                                onClick={() => setIndiceAvisoAtual((prev) => (prev > 0 ? prev - 1 : avisosOrdenados.length - 1))}
                                aria-label="Aviso anterior"
                                className="p-0.5 rounded hover:bg-slate-200/60 cursor-pointer transition-colors text-slate-600 hover:text-slate-900"
                                title="Aviso anterior"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-heading font-semibold text-[11px] select-none">
                                {indiceValido + 1} de {avisosOrdenados.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIndiceAvisoAtual((prev) => (prev < avisosOrdenados.length - 1 ? prev + 1 : 0))}
                                aria-label="Próximo aviso"
                                className="p-0.5 rounded hover:bg-slate-200/60 cursor-pointer transition-colors text-slate-600 hover:text-slate-900"
                                title="Próximo aviso"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <h3 className="font-heading font-bold text-base text-slate-800 mb-1.5">
                          {aviso.titulo}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                          {aviso.mensagem}
                        </p>
                      </div>

                      {avisosOrdenados.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExpandirAvisos(true)}
                          className="w-full py-2.5 px-4 text-xs font-heading font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/80 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-dashed border-indigo-200 shadow-2xs"
                        >
                          <span>Ver outros {avisosOrdenados.length - 1} {avisosOrdenados.length - 1 === 1 ? 'aviso' : 'avisos'}</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })()}

                {expandirAvisos && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {avisosOrdenados.map((aviso) => {
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

                    <button
                      type="button"
                      onClick={() => setExpandirAvisos(false)}
                      className="w-full py-2 px-4 text-xs font-heading font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                    >
                      <span>Recolher mural (mostrar apenas 1 aviso)</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </CartaoVidro>
            )}
          </section>
        ) : (
          <section aria-label="Mural de avisos">
            <CartaoVidro className="p-3.5 sm:p-4 flex items-center justify-between gap-3 bg-white/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-heading font-bold text-xs sm:text-sm text-slate-700 block">
                    Mural de Avisos
                  </span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Nenhum aviso novo no momento. Bons estudos!
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-heading font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                Tudo em dia ✨
              </span>
            </CartaoVidro>
          </section>
        )}

        {/* 2.1 META DO BIMESTRE E PROGRESSO GERAL (Gamificação Módulo 2) */}
        {totalGeralAtividades > 0 && (
          <div className="bg-white/85 backdrop-blur-md p-4 sm:p-5 rounded-3xl border-2 border-white/80 shadow-playful flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-300/40 shrink-0">
                <Trophy className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-black text-base sm:text-lg text-slate-900">
                    Sua meta do bimestre
                  </span>
                  <span className="text-xs font-heading font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {pctGeral}% feito
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-sans mt-0.5">
                  {totalConcluidasGeral} de {totalGeralAtividades} atividades concluídas • <span className="font-bold text-indigo-600">+{xpAcumulado} XP acumulado</span>
                </p>
              </div>
            </div>

            <div className="w-full sm:w-64 flex flex-col gap-1.5">
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 rounded-full transition-all duration-700 shadow-xs"
                  style={{ width: `${pctGeral}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-heading font-bold text-slate-400 px-0.5">
                <span>{atividadesParaFazer.length} pendentes</span>
                <span>{totalGeralAtividades} no total</span>
              </div>
            </div>
          </div>
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

          {/* Filtro Rápido por Disciplina (Módulo 4) */}
          {disciplinasDisponiveis.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setDisciplinaFiltro('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer whitespace-nowrap ${
                  disciplinaFiltro === 'todas'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80'
                }`}
              >
                Todas ({listaExibicao.length})
              </button>
              {disciplinasDisponiveis.map((disc) => {
                const qtd = gruposPorDisciplina[disc]?.length || 0;
                return (
                  <button
                    key={disc}
                    type="button"
                    onClick={() => setDisciplinaFiltro(disc)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer whitespace-nowrap ${
                      disciplinaFiltro === disc
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80'
                    }`}
                  >
                    {disc} ({qtd})
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista vazia */}
          {Object.keys(gruposFiltrados).length === 0 && (
            <CartaoVidro className="p-8 sm:p-12 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-black text-lg text-slate-800">
                {abaAtiva === 'para_fazer'
                  ? 'Tudo em dia! Parabéns! 🎉'
                  : 'Nenhuma atividade concluída ainda'}
              </h3>
              <p className="text-sm text-slate-600 font-sans max-w-md mx-auto">
                {abaAtiva === 'para_fazer'
                  ? 'Você não tem atividades pendentes para fazer no momento. Parabéns pelo empenho nos estudos!'
                  : 'Assim que você concluir seus exercícios ou provas, os resultados aparecerão aqui.'}
              </p>
              {abaAtiva === 'para_fazer' && (
                <button
                  type="button"
                  onClick={() => {
                    dispararConfeteFim();
                    toast.success('Parabéns pela dedicação aos estudos!', 'Sensacional!');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-heading font-bold text-xs hover:shadow-md transition-all cursor-pointer mt-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Comemorar com confetes!</span>
                </button>
              )}
            </CartaoVidro>
          )}

          {/* Grupos por Disciplina (com filtro ativo) */}
          {Object.entries(gruposFiltrados).map(([disciplina, lista]) => (
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

                            {ativ.aguardando_correcao && (
                              <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-[11px] font-heading font-bold bg-amber-50 border border-amber-300 text-amber-800 shadow-2xs">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Aguardando correção
                              </span>
                            )}
                          </div>

                          {/* Alerta Inteligente de Prazo (Módulo 3) */}
                          {ativ.prazo && !isEncerrada && (() => {
                            const status = obterStatusPrazo(ativ.prazo);
                            if (!status) return null;

                            if (status.tipo === 'urgente') {
                              return (
                                <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-[11px] font-heading font-black bg-rose-50 border border-rose-300 text-rose-700 animate-pulse shadow-xs">
                                  <Clock className="w-3 h-3 text-rose-600" />
                                  {status.label}
                                </span>
                              );
                            }
                            if (status.tipo === 'amanha') {
                              return (
                                <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-[11px] font-heading font-bold bg-amber-50 border border-amber-300 text-amber-800 shadow-xs">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  {status.label}
                                </span>
                              );
                            }
                            if (status.tipo === 'proximo') {
                              return (
                                <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-[11px] font-heading font-bold bg-amber-50/80 border border-amber-200 text-amber-700">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  {status.label}
                                </span>
                              );
                            }
                            if (status.tipo === 'expirado') {
                              return (
                                <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-[11px] font-heading font-bold bg-slate-100 border border-slate-200 text-slate-600">
                                  <AlertCircle className="w-3 h-3 text-slate-500" />
                                  {status.label}
                                </span>
                              );
                            }
                            return (
                              <ChipInfo color="amber" icon={<Calendar className="w-3 h-3 text-amber-700" />}>
                                {status.label}
                              </ChipInfo>
                            );
                          })()}
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
                        ) : ativ.aguardando_correcao ? (
                          <BotaoGrande
                            variant="outline"
                            onClick={() => navigate(`/aluno/atividade/${ativ.id}`)}
                            leftIcon={<Clock className="w-4 h-4 text-amber-600" />}
                            className="w-full text-sm sm:text-base min-h-[48px] border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100/60"
                          >
                            Ver envio (em correção)
                          </BotaoGrande>
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

        {/* 4. MODAL DE SELEÇÃO DE AVATAR (Módulo 5) */}
        {modalAvatarAberto && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <CartaoVidro className="w-full max-w-md p-6 space-y-4 bg-white/95 shadow-2xl border-2 border-indigo-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-black text-lg text-slate-900">
                  Escolha seu Avatar
                </h3>
                <button
                  type="button"
                  onClick={() => setModalAvatarAberto(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 font-sans">
                Escolha o mascote que mais combina com seu estilo de estudo. Alguns são desbloqueados conforme suas conquistas!
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {AVATARES.map((av) => {
                  const selecionado = avatarEscolhido === av.id;
                  const desbloqueado = isAvatarDesbloqueado(av, totalConcluidasGeral, diasStreak);

                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => {
                        if (!desbloqueado) {
                          toast.info(`Complete a missão: "${av.descricaoRequisito}" para liberar o avatar ${av.nome}!`, 'Mascote Bloqueado');
                          return;
                        }
                        setAvatarEscolhido(av.id);
                        if (dadosAluno?.aluno.id) {
                          localStorage.setItem(`saberpontual_avatar_${dadosAluno.aluno.id}`, av.id);
                        }
                        setModalAvatarAberto(false);
                        toast.success(`Avatar ${av.nome} selecionado!`, 'Avatar atualizado');
                      }}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                        !desbloqueado
                          ? 'bg-slate-100/90 text-slate-400 border border-dashed border-slate-300 opacity-70 hover:opacity-100 hover:border-slate-400'
                          : selecionado
                          ? `${av.bg} text-white ring-4 ring-indigo-200 scale-105 shadow-md`
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 hover:scale-105'
                      }`}
                    >
                      {!desbloqueado && (
                        <div className="absolute top-1.5 right-1.5 bg-slate-800/80 text-white p-1 rounded-full text-[9px]">
                          <Lock className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <span className={`text-2xl ${!desbloqueado ? 'grayscale contrast-50' : ''}`}>
                        {av.emoji}
                      </span>
                      <span className="text-[11px] font-heading font-bold truncate max-w-full">
                        {av.nome}
                      </span>
                      {!desbloqueado && (
                        <span className="text-[9px] text-slate-500 font-sans text-center leading-tight">
                          {av.descricaoRequisito}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CartaoVidro>
          </div>
        )}
      </div>
    </AlunoLayout>
  );
};

export default AlunoPainelPage;
