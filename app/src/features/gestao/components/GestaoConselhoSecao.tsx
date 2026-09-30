import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button } from '@/components/ui';
import {
  ClipboardList,
  Copy,
  Check,
  Printer,
  Loader2,
  AlertCircle,
  AlertTriangle,
  GraduationCap,
  Users,
  BookOpen,
  HelpCircle,
  MessageSquare,
  FileText,
  Calendar,
} from 'lucide-react';
import { relatorioService, gestaoService, assinarMudancas } from '@/services';
import {
  DesempenhoTurmaHierarquico,
  AlunoEmAtencaoItem,
  QuestaoCriticaEscolaItem,
  VisaoGeralEscola,
  Periodo,
  Perfil,
} from '@/lib/types';
import {
  formatarPautaConselhoGeral,
  formatarPautaConselhoTurma,
  formatarPautaConselhoProfessor,
  TurmaDoProfessorResumo,
} from '../utils/pautaConselhoFormatador';
import { agruparAlunosEmAtencao } from '../utils/alunosAtencaoAgrupamento';

type ModoVisaoConselho = 'geral' | 'turma' | 'professor';

export const GestaoConselhoSecao: React.FC = () => {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string>('');
  const [modoVisao, setModoVisao] = useState<ModoVisaoConselho>('geral');

  // Dados carregados
  const [visaoGeral, setVisaoGeral] = useState<VisaoGeralEscola | null>(null);
  const [turmasHierarquicas, setTurmasHierarquicas] = useState<DesempenhoTurmaHierarquico[]>([]);
  const [alunosAtencao, setAlunosAtencao] = useState<AlunoEmAtencaoItem[]>([]);
  const [questoesCriticas, setQuestoesCriticas] = useState<QuestaoCriticaEscolaItem[]>([]);
  const [professores, setProfessores] = useState<Perfil[]>([]);

  // Seleções para abas específicas
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string>('');
  const [professorSelecionadoId, setProfessorSelecionadoId] = useState<string>('');

  // Encaminhamentos e Deliberações anotados pela diretora (persistência em localStorage)
  const [deliberacoes, setDeliberacoes] = useState<string>('');

  // Estados de carregamento e feedback
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // 1. Carrega períodos e professores
  useEffect(() => {
    let ativo = true;

    async function carregarIniciais() {
      try {
        setCarregandoPeriodos(true);
        const [listaPeriodos, listaProfs] = await Promise.all([
          gestaoService.listarPeriodos(),
          gestaoService.listarProfessores(),
        ]);

        if (ativo) {
          setPeriodos(listaPeriodos);
          setProfessores(listaProfs);
          const periodoAtivo = listaPeriodos.find((p) => p.ativo) || listaPeriodos[0];
          if (periodoAtivo) {
            setPeriodoSelecionadoId(periodoAtivo.id);
          }
          if (listaProfs.length > 0) {
            setProfessorSelecionadoId(listaProfs[0].id);
          }
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar dados iniciais.');
        }
      } finally {
        if (ativo) {
          setCarregandoPeriodos(false);
        }
      }
    }

    carregarIniciais();

    return () => {
      ativo = false;
    };
  }, []);

  // 2. Carrega relatórios do período selecionado
  useEffect(() => {
    if (!periodoSelecionadoId) return;

    let ativo = true;

    async function carregarDadosPeriodo() {
      try {
        setCarregandoDados(true);
        setErro(null);

        const [vg, th, aa, qc] = await Promise.all([
          relatorioService.visaoGeralEscola(),
          relatorioService.desempenhoHierarquicoTurmas(periodoSelecionadoId),
          relatorioService.alunosEmAtencao(periodoSelecionadoId),
          relatorioService.questoesCriticasEscola(periodoSelecionadoId),
        ]);

        if (ativo) {
          setVisaoGeral(vg);
          setTurmasHierarquicas(th);
          setAlunosAtencao(aa);
          setQuestoesCriticas(qc);

          if (th.length > 0 && !turmaSelecionadaId) {
            setTurmaSelecionadaId(th[0].turma_id);
          }
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar relatórios do período.');
        }
      } finally {
        if (ativo) {
          setCarregandoDados(false);
        }
      }
    }

    carregarDadosPeriodo();

    const desassinar = assinarMudancas(() => {
      if (ativo) {
        carregarDadosPeriodo();
      }
    });

    return () => {
      ativo = false;
      desassinar();
    };
  }, [periodoSelecionadoId]);

  // 3. Persistência de deliberações por período e visão no localStorage
  useEffect(() => {
    if (!periodoSelecionadoId) return;
    const chave = `saberpontual_conselho_delib_${periodoSelecionadoId}_${modoVisao}_${
      modoVisao === 'turma' ? turmaSelecionadaId : modoVisao === 'professor' ? professorSelecionadoId : 'geral'
    }`;
    const salvo = localStorage.getItem(chave);
    setDeliberacoes(salvo || '');
  }, [periodoSelecionadoId, modoVisao, turmaSelecionadaId, professorSelecionadoId]);

  const handleSalvarDeliberacoes = (texto: string) => {
    setDeliberacoes(texto);
    if (!periodoSelecionadoId) return;
    const chave = `saberpontual_conselho_delib_${periodoSelecionadoId}_${modoVisao}_${
      modoVisao === 'turma' ? turmaSelecionadaId : modoVisao === 'professor' ? professorSelecionadoId : 'geral'
    }`;
    localStorage.setItem(chave, texto);
  };

  const periodoAtual = periodos.find((p) => p.id === periodoSelecionadoId);
  const turmaAtual = turmasHierarquicas.find((t) => t.turma_id === turmaSelecionadaId) || turmasHierarquicas[0];
  const professorAtual = professores.find((p) => p.id === professorSelecionadoId) || professores[0];

  const resumoAtencao = useMemo(() => agruparAlunosEmAtencao(alunosAtencao), [alunosAtencao]);

  // Indicadores calculados estritamente com as respostas do período selecionado
  const mediaGeralPeriodo = useMemo(() => {
    let somaPontos = 0;
    let totalRespostas = 0;
    turmasHierarquicas.forEach((turma) => {
      turma.materias.forEach((materia) => {
        if (materia.total_respostas > 0) {
          somaPontos += (materia.porcentagem_acerto / 100) * materia.total_respostas;
          totalRespostas += materia.total_respostas;
        }
      });
    });
    return totalRespostas > 0 ? Math.round((somaPontos / totalRespostas) * 10) / 10 : null;
  }, [turmasHierarquicas]);

  const totalTurmasAvaliadas = useMemo(() => {
    return turmasHierarquicas.filter((t) => t.porcentagem_acerto_geral !== null).length;
  }, [turmasHierarquicas]);

  const totalAtividadesPeriodo = useMemo(() => {
    const titulos = new Set<string>();
    turmasHierarquicas.forEach((t) => {
      t.materias.forEach((m) => {
        m.conteudos.forEach((c) => {
          c.questoes.forEach((q) => {
            if (q.atividade_titulo) titulos.add(q.atividade_titulo);
          });
        });
      });
    });
    return titulos.size > 0 ? titulos.size : (visaoGeral?.total_atividades_publicadas ?? 0);
  }, [turmasHierarquicas, visaoGeral]);

  const resumoAtencaoTurmaAtual = useMemo(() => {
    if (!turmaAtual) return null;
    return resumoAtencao.turmas.find((t) => t.turma_nome === turmaAtual.turma_nome) || null;
  }, [resumoAtencao, turmaAtual]);

  // Resumo de turmas lecionadas pelo professor selecionado
  const turmasDoProfessorAtual = useMemo<TurmaDoProfessorResumo[]>(() => {
    if (!professorAtual) return [];
    const lista: TurmaDoProfessorResumo[] = [];
    const nomeProf = professorAtual.nome.trim().toLowerCase();

    turmasHierarquicas.forEach((turma) => {
      turma.materias.forEach((materia) => {
        const nomeMateriaProf = materia.professor_nome.trim().toLowerCase();
        const corresponde =
          nomeMateriaProf === nomeProf ||
          nomeMateriaProf.includes(nomeProf) ||
          nomeProf.includes(nomeMateriaProf);

        if (corresponde) {
          const conteudosCriticos = materia.conteudos
            .filter((c) => c.porcentagem_erro > 35)
            .map((c) => `${c.conteudo_nome} (${c.porcentagem_erro}% erro)`);

          const alunosNaMateria = alunosAtencao
            .filter(
              (a) =>
                (a.turma_id ? a.turma_id === turma.turma_id : a.turma_nome === turma.turma_nome) &&
                (a.disciplina_id
                  ? a.disciplina_id === materia.disciplina_id
                  : a.disciplina_nome.toLowerCase() === materia.disciplina_nome.toLowerCase())
            )
            .map(
              (a) =>
                `#${String(a.numero_chamada).padStart(2, '0')} ${a.nome_completo} (${a.media.toFixed(1).replace('.', ',')}%)`
            );

          lista.push({
            turmaNome: turma.turma_nome,
            disciplinaNome: materia.disciplina_nome,
            porcentagemAcerto: materia.porcentagem_acerto,
            porcentagemErro: materia.porcentagem_erro,
            totalRespostas: materia.total_respostas,
            conteudosCriticos,
            alunosEmAtencao: alunosNaMateria,
          });
        }
      });
    });

    return lista;
  }, [professorAtual, turmasHierarquicas, alunosAtencao]);

  // Alunos em atenção em 2 ou mais matérias desduplicados
  const alunosMultiplaUnicos = useMemo(() => {
    const mapa = new Map<string, (typeof resumoAtencao.turmas)[0]['materias'][0]['alunos'][0]>();
    resumoAtencao.turmas.forEach((turma) => {
      turma.materias.forEach((materia) => {
        materia.alunos.forEach((aluno) => {
          if (aluno.tem_multiplas_materias && !mapa.has(aluno.aluno_id)) {
            mapa.set(aluno.aluno_id, aluno);
          }
        });
      });
    });
    return Array.from(mapa.values());
  }, [resumoAtencao]);

  // Geração do texto da pauta baseado na visão atual
  const textoPautaAtual = useMemo(() => {
    if (modoVisao === 'geral') {
      return formatarPautaConselhoGeral({
        periodoNome: periodoAtual?.nome,
        mediaGeralPeriodo,
        totalAtividadesPeriodo,
        totalTurmasAvaliadas,
        totalTurmasCadastradas: turmasHierarquicas.length,
        visaoGeral,
        turmasHierarquicas,
        alunosAtencao,
        questoesCriticas,
        deliberacoes,
      });
    }

    if (modoVisao === 'turma' && turmaAtual) {
      return formatarPautaConselhoTurma({
        periodoNome: periodoAtual?.nome,
        turma: turmaAtual,
        resumoAtencaoTurma: resumoAtencaoTurmaAtual,
        deliberacoes,
      });
    }

    if (modoVisao === 'professor' && professorAtual) {
      return formatarPautaConselhoProfessor({
        periodoNome: periodoAtual?.nome,
        professorNome: professorAtual.nome,
        turmas: turmasDoProfessorAtual,
        deliberacoes,
      });
    }

    return '';
  }, [
    modoVisao,
    periodoAtual,
    visaoGeral,
    turmasHierarquicas,
    alunosAtencao,
    questoesCriticas,
    turmaAtual,
    resumoAtencaoTurmaAtual,
    professorAtual,
    turmasDoProfessorAtual,
    deliberacoes,
  ]);

  // Copiar Pauta
  const handleCopiarPauta = () => {
    if (!textoPautaAtual) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(textoPautaAtual)
        .then(() => {
          setCopiado(true);
          setToastMensagem('Pauta copiada com sucesso! Pronta para WhatsApp, e-mail ou documento.');
          setTimeout(() => setCopiado(false), 3000);
          setTimeout(() => setToastMensagem(null), 3500);
        })
        .catch(() => {
          setToastMensagem('Não foi possível copiar automaticamente para a área de transferência.');
          setTimeout(() => setToastMensagem(null), 3500);
        });
    } else {
      // Fallback para seleção manual caso navegador restrinja clipboard
      setToastMensagem('Copie manualmente o texto da prévia na coluna ao lado.');
      setTimeout(() => setToastMensagem(null), 3500);
    }
  };

  // Imprimir Pauta
  const handleImprimir = () => {
    window.print();
  };

  if (carregandoPeriodos) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Carregando informações do conselho...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast de Confirmação Flutuante */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 print:hidden">
          <Check className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMensagem}</span>
        </div>
      )}

      {/* Cabeçalho da Seção */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl print:hidden">
              <ClipboardList className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight">
              Conselho de Professores & Pautas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Roteiro estruturado com diagnósticos e tópicos essenciais para condução da reunião pedagógica e conselho de classe.
          </p>
        </div>

        {/* Seleção de Bimestre e Ações */}
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={periodoSelecionadoId}
              onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.ativo ? '(Ativo)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleCopiarPauta}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            {copiado ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiado ? 'Pauta Copiada!' : 'Copiar Pauta'}</span>
          </Button>

          <Button
            onClick={handleImprimir}
            variant="outline"
            className="flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </Button>
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Abas de Navegação do Modo da Pauta */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setModoVisao('geral')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            modoVisao === 'geral'
              ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Pauta Geral da Reunião</span>
        </button>

        <button
          onClick={() => setModoVisao('turma')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            modoVisao === 'turma'
              ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Conselho por Turma</span>
        </button>

        <button
          onClick={() => setModoVisao('professor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            modoVisao === 'professor'
              ? 'bg-indigo-50 text-indigo-700 shadow-xs border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Alinhamento por Professor</span>
        </button>
      </div>

      {carregandoDados ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Consolidando indicadores para o conselho...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da Esquerda e Centro: O que conversar na reunião */}
          <div className="lg:col-span-2 space-y-6">
            {/* SUB-SELETOR PARA MODO TURMA */}
            {modoVisao === 'turma' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs sm:text-sm font-bold text-slate-700">Selecione a Turma:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {turmasHierarquicas.map((t) => (
                    <button
                      key={t.turma_id}
                      onClick={() => setTurmaSelecionadaId(t.turma_id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        turmaAtual?.turma_id === t.turma_id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t.turma_nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-SELETOR PARA MODO PROFESSOR */}
            {modoVisao === 'professor' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs sm:text-sm font-bold text-slate-700">Selecione o(a) Professor(a):</span>
                </div>
                <select
                  value={professorSelecionadoId}
                  onChange={(e) => setProfessorSelecionadoId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-hidden"
                >
                  {professores.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CARD PRINCIPAL: O QUE CONVERSAR (ROTEIRO PEDAGÓGICO) */}
            <Card className="border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50/70 via-white to-white p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-heading font-black text-base sm:text-lg text-slate-900">
                      Roteiro da Reunião — O que Conversar com a Equipe
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pontos-chave diagnosticados pelo sistema para orientar o diálogo pedagógico.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* 1. Diagnóstico Macro ou Específico */}
                {modoVisao === 'geral' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Média do Período</span>
                        <p className="text-lg font-black text-indigo-700 mt-0.5">
                          {mediaGeralPeriodo !== null
                            ? `${mediaGeralPeriodo.toFixed(1).replace('.', ',')}%`
                            : visaoGeral?.aproveitamento_medio !== null && visaoGeral?.aproveitamento_medio !== undefined
                            ? `${visaoGeral.aproveitamento_medio.toFixed(1).replace('.', ',')}%`
                            : '--'}
                        </p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Turmas Avaliadas</span>
                        <p className="text-lg font-black text-slate-800 mt-0.5">
                          {totalTurmasAvaliadas}{' '}
                          <span className="text-xs font-semibold text-slate-400">/ {turmasHierarquicas.length}</span>
                        </p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Total em Atenção</span>
                        <p className="text-lg font-black text-amber-600 mt-0.5">{resumoAtencao.total_alunos_unicos}</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Múltiplas Matérias</span>
                        <p className="text-lg font-black text-rose-600 mt-0.5">
                          {resumoAtencao.total_alunos_multipla_atencao}
                        </p>
                      </div>
                    </div>

                    {/* Turmas em Alerta */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Turmas que Necessitam de Foco e Apoio</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {turmasHierarquicas.map((t) => {
                          const temDados = t.porcentagem_acerto_geral !== null;
                          const critico = temDados && t.porcentagem_acerto_geral! < 60;
                          return (
                            <div
                              key={t.turma_id}
                              className={`p-3 rounded-xl border flex items-center justify-between ${
                                !temDados
                                  ? 'bg-slate-50/80 border-slate-200 text-slate-700'
                                  : critico
                                  ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                                  : 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-xs sm:text-sm">{t.turma_nome}</p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {t.total_materias_avaliadas > 0
                                    ? `${t.total_materias_avaliadas} ${t.total_materias_avaliadas === 1 ? 'matéria avaliada' : 'matérias avaliadas'}`
                                    : 'Nenhuma avaliação realizada'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                    !temDados
                                      ? 'bg-slate-200 text-slate-600'
                                      : critico
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {temDados ? `${t.porcentagem_acerto_geral}% acerto` : 'Sem dados'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Casos Prioritários Multidisciplinares */}
                    {resumoAtencao.total_alunos_multipla_atencao > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>Casos Prioritários: Alunos em Atenção em 2 ou Mais Matérias</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Estes estudantes exigem intervenção integrada entre os professores e convocação pedagógica dos responsáveis:
                        </p>

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {alunosMultiplaUnicos.map((aluno) => {
                            const mats = aluno.todas_materias
                              .map((m) => `${m.disciplina_nome} (${m.media.toFixed(1).replace('.', ',')}%)`)
                              .join(', ');
                            return (
                              <div
                                key={aluno.aluno_id}
                                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">
                                    #{String(aluno.numero_chamada).padStart(2, '0')} {aluno.nome_completo}
                                  </span>
                                  <span className="text-slate-400 ml-1.5">({aluno.turma_nome})</span>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Atenção em {aluno.total_materias_em_atencao} matérias: {mats}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full self-start sm:self-center">
                                  Intervenção Urgente
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Defasagens Coletivas (Top Questões Críticas) */}
                    {questoesCriticas.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Defasagens Coletivas: O que os Estudantes Mais Erraram</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Utilize estes dados para cobrar dos professores a revisão de conteúdos específicos:
                        </p>

                        <div className="space-y-2">
                          {questoesCriticas.slice(0, 3).map((q, idx) => (
                            <div key={q.questao_id} className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-amber-900">
                                  {idx + 1}. {q.disciplina_nome} — {q.turma_nome} (Questão {q.ordem})
                                </span>
                                <span className="font-black text-rose-700 text-[11px]">
                                  {100 - q.porcentagem_acerto}% de erros
                                </span>
                              </div>
                              <p className="text-slate-700 mt-1 line-clamp-2 italic">"{q.enunciado}"</p>
                              {q.distrator_mais_escolhido?.por_que_errou && (
                                <p className="text-[11px] text-amber-800 mt-1 font-medium">
                                  ↳ Ponto cego: {q.distrator_mais_escolhido.por_que_errou}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Diagnóstico no Modo Turma */}
                {modoVisao === 'turma' && turmaAtual && (
                  <div className="space-y-5">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{turmaAtual.turma_nome}</h4>
                        <p className="text-xs text-slate-500">
                          Total de alunos matriculados: {turmaAtual.total_alunos}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Média Geral da Sala</span>
                          <p className="text-base font-black text-indigo-700">
                            {turmaAtual.porcentagem_acerto_geral !== null ? `${turmaAtual.porcentagem_acerto_geral}%` : '--'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Matérias da Turma */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Rendimento por Disciplina na Sala</span>
                      </h4>

                      <div className="space-y-2">
                        {turmaAtual.materias.map((m) => {
                          const semDados = m.total_respostas === 0;
                          const critico = !semDados && m.porcentagem_acerto < 60;
                          return (
                            <div
                              key={m.disciplina_id}
                              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4"
                            >
                              <div>
                                <span className="font-bold text-xs sm:text-sm text-slate-900">
                                  {m.disciplina_nome}
                                </span>
                                <span className="text-xs text-slate-500 ml-2">Prof(a). {m.professor_nome}</span>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {m.total_respostas > 0
                                    ? `${m.total_respostas} respostas avaliadas`
                                    : 'Nenhuma resposta avaliada no período'}
                                </p>
                              </div>
                              <span
                                className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                  semDados
                                    ? 'bg-slate-100 text-slate-600'
                                    : critico
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {semDados ? 'Sem avaliações' : `${m.porcentagem_acerto}% acertos`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Alunos da turma em atenção */}
                    {resumoAtencaoTurmaAtual && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-500" />
                          <span>Estudantes desta Turma em Atenção ({resumoAtencaoTurmaAtual.total_alunos_unicos})</span>
                        </h4>

                        <div className="space-y-1.5">
                          {resumoAtencaoTurmaAtual.materias.map((mat) => (
                            <div key={mat.disciplina_nome} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                              <span className="font-bold text-xs text-slate-800">
                                {mat.disciplina_nome} ({mat.total_alunos} {mat.total_alunos === 1 ? 'aluno' : 'alunos'}):
                              </span>
                              <div className="space-y-1">
                                {mat.alunos.map((a) => (
                                  <div key={a.aluno_id} className="text-xs text-slate-600 flex items-center justify-between">
                                    <span>
                                      #{String(a.numero_chamada).padStart(2, '0')} {a.nome_completo}
                                    </span>
                                    <span className="font-bold text-rose-600">
                                      {a.media_nesta_disciplina.toFixed(1).replace('.', ',')}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Diagnóstico no Modo Professor */}
                {modoVisao === 'professor' && professorAtual && (
                  <div className="space-y-5">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{professorAtual.nome}</h4>
                        <p className="text-xs text-slate-500">{professorAtual.email}</p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                        {turmasDoProfessorAtual.filter((t) => t.totalRespostas > 0).length} de {turmasDoProfessorAtual.length}{' '}
                        {turmasDoProfessorAtual.length === 1 ? 'turma avaliada' : 'turmas avaliadas'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Rendimento nas Turmas Deste Docente</span>
                      </h4>

                      {turmasDoProfessorAtual.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Nenhuma resposta avaliada neste período para as turmas deste professor.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {turmasDoProfessorAtual.map((t) => {
                            const semDados = t.totalRespostas === 0;
                            const critico = !semDados && t.porcentagemAcerto < 60;
                            return (
                              <div
                                key={`${t.turmaNome}-${t.disciplinaNome}`}
                                className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                                      {t.turmaNome} — {t.disciplinaNome}
                                    </span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      {t.totalRespostas > 0
                                        ? `${t.totalRespostas} respostas avaliadas`
                                        : 'Nenhuma resposta avaliada no período'}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                      semDados
                                        ? 'bg-slate-100 text-slate-600'
                                        : critico
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {semDados ? 'Sem avaliações' : `${t.porcentagemAcerto}% acertos`}
                                  </span>
                                </div>

                              {t.conteudosCriticos.length > 0 && (
                                <p className="text-[11px] text-amber-800">
                                  <strong>Defasagens:</strong> {t.conteudosCriticos.join(', ')}
                                </p>
                              )}

                              {t.alunosEmAtencao.length > 0 && (
                                <p className="text-[11px] text-rose-700">
                                  <strong>Alunos em Atenção ({t.alunosEmAtencao.length}):</strong>{' '}
                                  {t.alunosEmAtencao.join(', ')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* CARD: DELIBERAÇÕES & ENCAMINHAMENTOS SALVOS */}
            <Card className="border border-slate-200 rounded-2xl shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                    Deliberações & Encaminhamentos do Conselho
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Salvo automaticamente</span>
              </div>
              <p className="text-xs text-slate-500">
                Anote aqui os combinados com os professores (datas de reforço, convocações de responsáveis ou acordos pedagógicos). O texto é incorporado à pauta na hora de copiar.
              </p>
              <textarea
                value={deliberacoes}
                onChange={(e) => handleSalvarDeliberacoes(e.target.value)}
                placeholder="Exemplo: Acordado que o professor João aplicará lista diagnóstica de frações na próxima semana. Agendar reunião com os pais do aluno Lucas..."
                rows={4}
                className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-700 bg-slate-50/50"
              />
            </Card>
          </div>

          {/* Coluna da Direita: Prévia da Pauta Pronta para Cópia */}
          <div className="space-y-4">
            <Card className="border border-slate-200 rounded-2xl shadow-xs overflow-hidden sticky top-6">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-xs uppercase tracking-wider">Prévia da Pauta Formatada</span>
                </div>
                <button
                  onClick={handleCopiarPauta}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="p-4 bg-slate-950 font-mono text-[11px] text-slate-300 max-h-[550px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {textoPautaAtual}
              </div>

              <div className="p-3 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Pronto para WhatsApp e documentos</span>
                <Button
                  onClick={handleCopiarPauta}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 px-3"
                >
                  Copiar Texto
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoConselhoSecao;
