import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande, ChipInfo } from '@/components/aluno';
import { alunoService } from '@/services';
import { useToast, MathText } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Volume1,
  Sparkles,
  FileText,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trophy,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  AtividadeParaAluno,
  QuestaoParaAluno,
  ResultadoProva,
  RespostaExercicio,
  TipoQuestao,
  StatusCorrecao,
} from '@/lib/types';
import { isSomHabilitado, setSomHabilitado, tocarSomAcerto, tocarSomErro, tocarSomFim } from '../utils/audio';
import { dispararConfeteAcerto, dispararConfeteFim } from '../utils/confetti';
import { isSpeechSupported, falarQuestao, pararFala } from '../utils/speech';
import { calcularPlacar, QuestaoPlacarItem, PlacarCalculado } from '../utils/placar';

interface RespostaLocalState {
  acertou?: boolean; // 1ª tentativa
  alternativa_correta_id?: string;
  por_que_errou?: string | null;
  explicacao?: string | null;
  alternativa_escolhida_id?: string | null;
  registradaProva?: boolean;
  tentativas?: number;
  acertou_final?: boolean;
  tipo?: TipoQuestao;
  texto_respondido?: string | null;
  correcao?: StatusCorrecao | null;
  pontuacao?: number | null;
  nota?: number | null;
  comentario_professor?: string | null;
  resposta_esperada?: string | null;
}

const chaveRascunhoDiscursiva = (questaoId: string): string =>
  `saberpontual_rascunho_discursiva_${questaoId}`;

export const AlunoAtividadePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [atividade, setAtividade] = useState<AtividadeParaAluno | null>(null);
  const [indiceAtual, setIndiceAtual] = useState<number>(0);

  // Seleção e interação na questão atual
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [textoDiscursiva, setTextoDiscursiva] = useState<string>('');
  const [confirmando, setConfirmando] = useState(false);
  const [confirmarEnvioDiscursiva, setConfirmarEnvioDiscursiva] = useState(false);
  const [dicaAberta, setDicaAberta] = useState(false);
  const [falando, setFalando] = useState(false);
  const [modoTentarNovamente, setModoTentarNovamente] = useState(false);

  // Histórico de respostas por questão
  const [respostasMap, setRespostasMap] = useState<Record<string, RespostaLocalState>>({});

  // Tela final
  const [exibirTelaFinal, setExibirTelaFinal] = useState(false);
  const [resultadoProvaFinal, setResultadoProvaFinal] = useState<ResultadoProva | null>(null);
  const [carregandoResultadoProva, setCarregandoResultadoProva] = useState(false);

  const [somAtivo, setSomAtivoState] = useState<boolean>(() => isSomHabilitado());

  // Carrega a atividade e inicializa estados
  const carregar = useCallback(async () => {
    const token = localStorage.getItem('saberpontual_aluno_token');
    if (!token) {
      navigate('/aluno', { replace: true });
      return;
    }

    if (!id) {
      navigate('/aluno/painel', { replace: true });
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const ativ = await alunoService.carregarAtividade(token, id);
      setAtividade(ativ);

      // Popula respostas já existentes (se houver)
      const mapaInicial: Record<string, RespostaLocalState> = {};
      let totalRespondidas = 0;

      for (const q of ativ.questoes) {
        if (q.respondida) {
          totalRespondidas++;
          mapaInicial[q.id] = {
            acertou: q.acertou,
            alternativa_correta_id: q.alternativa_correta_id,
            por_que_errou: q.por_que_errou,
            explicacao: q.explicacao,
            alternativa_escolhida_id: q.alternativa_respondida_id,
            registradaProva: ativ.modo === 'prova',
            tentativas: q.tentativas ?? 1,
            acertou_final: q.acertou_final ?? q.acertou,
            tipo: q.tipo,
            texto_respondido: q.texto_respondido,
            correcao: q.correcao,
            pontuacao: q.pontuacao,
            nota: q.nota,
            comentario_professor: q.comentario_professor,
            resposta_esperada: q.resposta_esperada,
          };
        }
      }

      setRespostasMap(mapaInicial);

      // Se a atividade já estiver encerrada ou todas respondidas, abre resultado
      if (ativ.status === 'encerrada') {
        setExibirTelaFinal(true);
        if (ativ.modo === 'prova') {
          setCarregandoResultadoProva(true);
          try {
            const res = await alunoService.resultadoProva(token, id);
            setResultadoProvaFinal(res);
          } finally {
            setCarregandoResultadoProva(false);
          }
        }
      } else if (totalRespondidas === ativ.questoes.length && ativ.questoes.length > 0) {
        setExibirTelaFinal(true);
        if (ativ.modo === 'prova') {
          setCarregandoResultadoProva(true);
          try {
            const res = await alunoService.resultadoProva(token, id);
            setResultadoProvaFinal(res);
          } finally {
            setCarregandoResultadoProva(false);
          }
        }
      } else {
        // Abre na PRIMEIRA questão não respondida (regra do F5 e abertura)
        const primeiraNaoRespondidaIdx = ativ.questoes.findIndex((q) => !q.respondida);
        setIndiceAtual(primeiraNaoRespondidaIdx >= 0 ? primeiraNaoRespondidaIdx : 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErro(msg);
      toast.error(msg, 'Erro ao carregar atividade');
    } finally {
      setCarregando(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    carregar();
    return () => {
      pararFala();
    };
  }, [carregar]);

  // Alternador de som
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

  const questaoAtual: QuestaoParaAluno | undefined = atividade?.questoes[indiceAtual];
  const respAtual: RespostaLocalState | undefined = questaoAtual ? respostasMap[questaoAtual.id] : undefined;
  const isDiscursiva = questaoAtual?.tipo === 'discursiva';

  // Questão já foi respondida e confirmada?
  const questaoJaRespondida = !!respAtual && !modoTentarNovamente;

  // Leitura em voz alta
  const handleFalar = () => {
    if (!questaoAtual) return;
    if (falando) {
      pararFala();
      setFalando(false);
      return;
    }

    setFalando(true);
    falarQuestao(
      questaoAtual.enunciado,
      questaoAtual.alternativas?.map((a) => ({ letra: a.letra, texto: a.texto })) || [],
      () => setFalando(true),
      () => setFalando(false)
    );
  };

  // Parar fala ao mudar de questão
  useEffect(() => {
    pararFala();
    setFalando(false);
    setDicaAberta(false);
    setModoTentarNovamente(false);
    setSelecionadaId(null);
    setTextoDiscursiva('');
    setConfirmarEnvioDiscursiva(false);
  }, [indiceAtual]);

  // Recupera o rascunho da resposta discursiva ao abrir a questão (sobrevive a recarregar a página)
  const questaoAtualId = questaoAtual?.id;
  useEffect(() => {
    if (!questaoAtualId || !isDiscursiva) return;
    try {
      const salvo = sessionStorage.getItem(chaveRascunhoDiscursiva(questaoAtualId));
      if (salvo) setTextoDiscursiva(salvo);
    } catch {
      // sessionStorage indisponível: segue sem rascunho
    }
  }, [questaoAtualId, isDiscursiva]);

  const handleMudarTextoDiscursiva = (valor: string) => {
    setTextoDiscursiva(valor);
    if (!questaoAtualId) return;
    try {
      if (valor) sessionStorage.setItem(chaveRascunhoDiscursiva(questaoAtualId), valor);
      else sessionStorage.removeItem(chaveRascunhoDiscursiva(questaoAtualId));
    } catch {
      // ignora falha ao guardar rascunho
    }
  };

  // Confirmar Resposta Objetiva
  const handleConfirmar = async () => {
    if (!questaoAtual || !selecionadaId || !atividade) return;
    const token = localStorage.getItem('saberpontual_aluno_token');
    if (!token) {
      navigate('/aluno');
      return;
    }

    setConfirmando(true);
    try {
      if (modoTentarNovamente) {
        // Tentar Novamente (modo exercício)
        const resultado = await alunoService.tentarNovamente(token, questaoAtual.id, selecionadaId);
        
        // Mantém acertou da 1ª tentativa para o placar, atualiza acertou_final e feedback
        setRespostasMap((prev) => {
          const anterior = prev[questaoAtual.id];
          const tentativasAnteriores = anterior?.tentativas ?? 1;
          return {
            ...prev,
            [questaoAtual.id]: {
              ...anterior,
              alternativa_correta_id: resultado.alternativa_correta_id,
              por_que_errou: resultado.por_que_errou,
              explicacao: resultado.explicacao,
              tentativas: tentativasAnteriores + 1,
              acertou_final: resultado.acertou,
              alternativa_escolhida_id: selecionadaId,
            },
          };
        });

        setModoTentarNovamente(false);

        if (resultado.acertou) {
          tocarSomAcerto();
          dispararConfeteAcerto();
        } else {
          tocarSomErro();
        }
      } else {
        // 1ª Resposta
        const resultado = await alunoService.responder(token, questaoAtual.id, selecionadaId);

        if (resultado.modo === 'exercicio') {
          const resEx = resultado as RespostaExercicio;
          setRespostasMap((prev) => ({
            ...prev,
            [questaoAtual.id]: {
              tipo: 'objetiva',
              acertou: resEx.acertou,
              alternativa_correta_id: resEx.alternativa_correta_id,
              por_que_errou: resEx.por_que_errou,
              explicacao: resEx.explicacao,
              alternativa_escolhida_id: selecionadaId,
              tentativas: 1,
              acertou_final: resEx.acertou,
            },
          }));

          if (resEx.acertou) {
            tocarSomAcerto();
            dispararConfeteAcerto();
          } else {
            tocarSomErro();
          }
        } else {
          // Modo Prova: resposta gravada sem feedback de acerto/erro
          setRespostasMap((prev) => ({
            ...prev,
            [questaoAtual.id]: {
              tipo: 'objetiva',
              registradaProva: true,
              alternativa_escolhida_id: selecionadaId,
              tentativas: 1,
            },
          }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Erro ao salvar resposta');
    } finally {
      setConfirmando(false);
    }
  };

  // Enviar Resposta Discursiva
  const handleEnviarDiscursiva = async () => {
    if (!questaoAtual || !textoDiscursiva.trim() || !atividade) return;
    const token = localStorage.getItem('saberpontual_aluno_token');
    if (!token) {
      navigate('/aluno');
      return;
    }

    setConfirmarEnvioDiscursiva(false);
    setConfirmando(true);
    try {
      const resultado = await alunoService.responderDiscursiva(
        token,
        questaoAtual.id,
        textoDiscursiva.trim()
      );

      try {
        sessionStorage.removeItem(chaveRascunhoDiscursiva(questaoAtual.id));
      } catch {
        // ignora
      }

      setRespostasMap((prev) => ({
        ...prev,
        [questaoAtual.id]: {
          tipo: 'discursiva',
          texto_respondido: textoDiscursiva.trim(),
          correcao: 'pendente',
          registradaProva: atividade.modo === 'prova',
          explicacao: resultado.explicacao || questaoAtual.explicacao || null,
          tentativas: 1,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Erro ao enviar resposta');
    } finally {
      setConfirmando(false);
    }
  };

  // Botão Tentar Novamente (modo exercício)
  const handleIniciarTentarNovamente = () => {
    setModoTentarNovamente(true);
    setSelecionadaId(null);
  };

  // Avançar para próxima questão ou finalizar
  const handleAvancar = async () => {
    if (!atividade) return;
    const proximoIdx = indiceAtual + 1;

    if (proximoIdx < atividade.questoes.length) {
      setIndiceAtual(proximoIdx);
    } else {
      // Chegou ao fim!
      const token = localStorage.getItem('saberpontual_aluno_token');
      if (atividade.modo === 'prova' && token) {
        setCarregandoResultadoProva(true);
        try {
          const resultadoProva = await alunoService.resultadoProva(token, atividade.id);
          setResultadoProvaFinal(resultadoProva);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(msg, 'Erro ao obter resultado');
        } finally {
          setCarregandoResultadoProva(false);
        }
      }
      setExibirTelaFinal(true);
    }
  };

  // Placar do exercício (calculado estritamente pela 1ª resposta)
  const placarExercicio: PlacarCalculado = useMemo(() => {
    if (!atividade) {
      return { total_questoes: 0, acertos: 0, erros: 0, aproveitamento: 0 };
    }
    const questoesPlacar: QuestaoPlacarItem[] = atividade.questoes.map((q) => {
      const r = respostasMap[q.id];
      return {
        id: q.id,
        acertou: r?.acertou ?? null,
        tentativas: r?.tentativas ?? 1,
        acertou_final: r?.acertou_final ?? null,
      };
    });
    return calcularPlacar(questoesPlacar);
  }, [atividade, respostasMap]);

  // Efeito ao entrar na tela final: comemoração se aproveitamento >= 70%
  useEffect(() => {
    if (!exibirTelaFinal) return;

    tocarSomFim();

    const aproveitamento =
      atividade?.modo === 'prova' && resultadoProvaFinal
        ? resultadoProvaFinal.aproveitamento
        : placarExercicio.aproveitamento;

    if (aproveitamento >= 70) {
      dispararConfeteFim();
    }
  }, [exibirTelaFinal, atividade?.modo, resultadoProvaFinal, placarExercicio.aproveitamento]);

  if (carregando) {
    return (
      <AlunoLayout containerClassName="items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-indigo-700">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="font-heading font-bold text-lg">Carregando atividade...</p>
        </div>
      </AlunoLayout>
    );
  }

  if (erro || !atividade) {
    return (
      <AlunoLayout containerClassName="items-center justify-center p-4 py-12">
        <main className="w-full max-w-lg space-y-4">
          <CartaoVidro className="p-6 sm:p-10 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="font-heading font-black text-2xl text-slate-900">
                Atividade indisponível
              </h1>
              <p className="text-sm text-slate-600 font-sans">{erro || 'Não foi possível carregar a atividade.'}</p>
            </div>
            <BotaoGrande variant="primary" onClick={() => navigate('/aluno/painel')} className="w-full">
              Voltar ao painel
            </BotaoGrande>
          </CartaoVidro>
        </main>
      </AlunoLayout>
    );
  }

  /* =========================================================================
   * TELA FINAL (Resultado da Prova ou Placar do Exercício)
   * ========================================================================= */
  if (exibirTelaFinal) {
    const isProva = atividade.modo === 'prova';
    const totalQ = isProva && resultadoProvaFinal ? resultadoProvaFinal.total_questoes : placarExercicio.total_questoes;
    const acertos = isProva && resultadoProvaFinal ? resultadoProvaFinal.acertos : placarExercicio.acertos;
    const erros = isProva && resultadoProvaFinal ? resultadoProvaFinal.erros : placarExercicio.erros;
    const aproveitamento = isProva && resultadoProvaFinal ? resultadoProvaFinal.aproveitamento : placarExercicio.aproveitamento;

    return (
      <AlunoLayout containerClassName="p-3 sm:p-6 lg:p-8">
        <main className="max-w-3xl mx-auto w-full space-y-4 sm:space-y-6 pb-16 safe-bottom">
          {/* Header Superior */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/aluno/painel')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-sm text-xs font-heading font-bold cursor-pointer transition-all min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao painel</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSom}
              aria-label={somAtivo ? 'Desativar som' : 'Ativar som'}
              className="p-2.5 rounded-2xl bg-white/80 border border-slate-200 text-slate-600 shadow-sm cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              {somAtivo ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>

          {/* Card Principal de Conclusão / Placar (Mobile-First) */}
          <CartaoVidro className="p-4 sm:p-10 text-center space-y-5 sm:space-y-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-900 flex items-center justify-center shadow-lg shadow-amber-200/60">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-2">
                <ChipInfo color={isProva ? 'pink' : 'emerald'} className="text-xs">
                  {isProva ? 'Prova Concluída' : 'Exercício Concluído'}
                </ChipInfo>
              </div>
              <h1 className="font-heading font-black text-xl sm:text-3xl text-slate-900 tracking-tight leading-snug">
                {atividade.titulo}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-sans">
                {aproveitamento >= 70
                  ? 'Excelente resultado! Você foi muito bem.'
                  : 'Atividade finalizada! Revise as questões para continuar aprendendo.'}
              </p>
            </div>

            {/* Placar em Destaque (Grid 2x2 equilibrado em telas pequenas) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1">
              <div className="p-3 sm:p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex flex-col items-center">
                <span className="text-[10px] sm:text-[11px] font-heading font-bold uppercase text-indigo-700 tracking-wider">
                  Aproveitamento
                </span>
                <span className="font-heading font-black text-2xl sm:text-3xl text-indigo-900 mt-0.5 sm:mt-1">
                  {aproveitamento}%
                </span>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100 flex flex-col items-center">
                <span className="text-[10px] sm:text-[11px] font-heading font-bold uppercase text-emerald-700 tracking-wider">
                  Acertos (1ª resp)
                </span>
                <span className="font-heading font-black text-2xl sm:text-3xl text-emerald-900 mt-0.5 sm:mt-1">
                  {acertos}
                </span>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-rose-50/80 border border-rose-100 flex flex-col items-center">
                <span className="text-[10px] sm:text-[11px] font-heading font-bold uppercase text-rose-700 tracking-wider">
                  Erros
                </span>
                <span className="font-heading font-black text-2xl sm:text-3xl text-rose-900 mt-0.5 sm:mt-1">
                  {erros}
                </span>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center">
                <span className="text-[10px] sm:text-[11px] font-heading font-bold uppercase text-slate-600 tracking-wider">
                  Total
                </span>
                <span className="font-heading font-black text-2xl sm:text-3xl text-slate-800 mt-0.5 sm:mt-1">
                  {totalQ}
                </span>
              </div>
            </div>

            <BotaoGrande
              variant="primary"
              onClick={() => navigate('/aluno/painel')}
              leftIcon={<ArrowLeft className="w-5 h-5" />}
              className="w-full sm:w-auto px-8 min-h-[48px]"
            >
              Voltar ao painel
            </BotaoGrande>
          </CartaoVidro>

          {/* Correção Completa da Prova */}
          {isProva && resultadoProvaFinal && (
            <section className="space-y-4 pt-4" aria-labelledby="revisao-prova-titulo">
              <h2 id="revisao-prova-titulo" className="font-heading font-black text-xl text-slate-800 px-1">
                Gabarito e Correção Detalhada
              </h2>

              <div className="space-y-4">
                {resultadoProvaFinal.questoes.map((q) => {
                  const questaoBase = atividade.questoes.find((item) => item.id === q.questao_id);
                  const isDisc = q.tipo === 'discursiva' || questaoBase?.tipo === 'discursiva';

                  if (isDisc) {
                    const textoResp = q.texto_respondido ?? questaoBase?.texto_respondido ?? null;
                    const semResposta = !textoResp;
                    const correcao = q.correcao ?? questaoBase?.correcao ?? (semResposta ? null : 'pendente');
                    const isPendente = !semResposta && (!correcao || correcao === 'pendente');
                    const comentarioProf = q.comentario_professor ?? questaoBase?.comentario_professor ?? null;
                    const respEsperada = q.resposta_esperada ?? questaoBase?.resposta_esperada ?? null;
                    const imagemUrl = q.imagem_url || questaoBase?.imagem_url;
                    const nota = q.nota ?? (typeof q.pontuacao === 'number' ? (q.pontuacao <= 1 ? Math.round(q.pontuacao * 100) : Math.round(q.pontuacao)) : null);

                    return (
                      <CartaoVidro key={q.questao_id} className="p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-heading font-black text-indigo-600 uppercase tracking-wider">
                            Questão {q.ordem}
                          </span>

                          {semResposta ? (
                            <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5" />}>
                              Sem resposta (em branco)
                            </ChipInfo>
                          ) : isPendente ? (
                            <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5 text-amber-600" />}>
                              Aguardando correção
                            </ChipInfo>
                          ) : correcao === 'certo' ? (
                            <ChipInfo color="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}>
                              Certo {nota !== null ? `(${nota}/100)` : ''}
                            </ChipInfo>
                          ) : correcao === 'parcial' ? (
                            <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5 text-amber-600" />}>
                              Parcial {nota !== null ? `(${nota}/100)` : ''}
                            </ChipInfo>
                          ) : (
                            <ChipInfo color="pink" icon={<XCircle className="w-3.5 h-3.5 text-rose-600" />}>
                              Errado {nota !== null ? `(${nota}/100)` : ''}
                            </ChipInfo>
                          )}
                        </div>

                        <p className="font-heading font-bold text-base sm:text-lg text-slate-900 leading-snug">
                          <MathText text={q.enunciado} />
                        </p>

                        {imagemUrl && (
                          <div className="max-w-md w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs my-2">
                            <img
                              src={imagemUrl}
                              alt="Apoio da questão"
                              className="w-full h-auto max-h-72 object-contain bg-slate-50"
                            />
                          </div>
                        )}

                        {/* Resposta do Aluno */}
                        <div className="space-y-2 pt-1">
                          {semResposta ? (
                            <div className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-600 text-sm flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="font-heading font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                                  Sua resposta
                                </span>
                                <span className="italic font-medium text-slate-500">Em branco</span>
                              </div>
                              <span className="text-xs font-heading font-bold text-slate-400">Não respondida</span>
                            </div>
                          ) : (
                            <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm leading-relaxed space-y-1">
                              <span className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 block">
                                Sua resposta:
                              </span>
                              <p className="whitespace-pre-wrap font-sans">{textoResp}</p>
                            </div>
                          )}
                        </div>

                        {/* Aguardando correção */}
                        {isPendente && (
                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Aguardando correção</span>
                          </div>
                        )}

                        {/* Quando corrigida */}
                        {!isPendente && !semResposta && (
                          <>
                            {comentarioProf && (
                              <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200 text-indigo-950 text-sm leading-relaxed space-y-1">
                                <div className="flex items-center gap-1.5 font-heading font-bold text-indigo-800 text-xs uppercase tracking-wider">
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                  <span>Comentário do professor</span>
                                </div>
                                <p className="whitespace-pre-wrap">{comentarioProf}</p>
                              </div>
                            )}

                            {respEsperada && (
                              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-950 text-sm leading-relaxed space-y-1">
                                <div className="flex items-center gap-1.5 font-heading font-bold text-emerald-800 text-xs uppercase tracking-wider">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>Resposta esperada</span>
                                </div>
                                <p className="whitespace-pre-wrap">{respEsperada}</p>
                              </div>
                            )}

                            {q.explicacao && (
                              <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 text-slate-800 text-sm leading-relaxed space-y-1">
                                <div className="flex items-center gap-1.5 font-heading font-bold text-slate-700 text-xs uppercase tracking-wider">
                                  <HelpCircle className="w-4 h-4 text-slate-500" />
                                  <span>Explicação pedagógica</span>
                                </div>
                                <p className="whitespace-pre-wrap">{q.explicacao}</p>
                              </div>
                            )}
                          </>
                        )}
                      </CartaoVidro>
                    );
                  }

                  const semResposta = q.alternativa_escolhida_id === null;
                  const altEscolhida = questaoBase?.alternativas.find(
                    (a) => a.id === q.alternativa_escolhida_id
                  );
                  const altCorreta = questaoBase?.alternativas.find(
                    (a) => a.id === q.alternativa_correta_id
                  );

                  return (
                    <CartaoVidro key={q.questao_id} className="p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-heading font-black text-indigo-600 uppercase tracking-wider">
                          Questão {q.ordem}
                        </span>

                        {semResposta ? (
                          <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5" />}>
                            Sem resposta (em branco)
                          </ChipInfo>
                        ) : q.acertou ? (
                          <ChipInfo color="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}>
                            Você acertou
                          </ChipInfo>
                        ) : (
                          <ChipInfo color="pink" icon={<XCircle className="w-3.5 h-3.5 text-rose-600" />}>
                            Você errou
                          </ChipInfo>
                        )}
                      </div>

                      <p className="font-heading font-bold text-base sm:text-lg text-slate-900 leading-snug">
                        <MathText text={q.enunciado} />
                      </p>

                      {questaoBase?.imagem_url && (
                        <div className="max-w-md w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs my-2">
                          <img
                            src={questaoBase.imagem_url}
                            alt="Apoio da questão"
                            className="w-full h-auto max-h-72 object-contain bg-slate-50"
                          />
                        </div>
                      )}

                      {/* Alternativa Escolhida e Alternativa Correta */}
                      <div className="space-y-2 pt-1">
                        {/* Alternativa Escolhida pelo Aluno */}
                        {semResposta ? (
                          <div className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-600 text-sm flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="font-heading font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                                Sua resposta
                              </span>
                              <span className="italic font-medium text-slate-500">Em branco</span>
                            </div>
                            <span className="text-xs font-heading font-bold text-slate-400">Não respondida</span>
                          </div>
                        ) : q.acertou ? (
                          <div className="p-3.5 rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-emerald-100/90 text-emerald-950 text-sm flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <span className="font-heading font-black text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white shrink-0">
                                {altEscolhida ? altEscolhida.letra : 'Sua resposta'}
                              </span>
                              <span className="font-medium leading-snug">
                                {altEscolhida ? altEscolhida.texto : ''}
                              </span>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 to-rose-100/90 text-rose-950 text-sm flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <span className="font-heading font-black text-xs px-2.5 py-1 rounded-lg bg-rose-600 text-white shrink-0">
                                {altEscolhida ? altEscolhida.letra : 'Sua resposta'}
                              </span>
                              <span className="font-medium leading-snug">
                                {altEscolhida ? altEscolhida.texto : ''}
                              </span>
                            </div>
                            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          </div>
                        )}

                        {/* Alternativa Correta (exibida quando o aluno errou ou deixou em branco) */}
                        {(!q.acertou || semResposta) && altCorreta && (
                          <div className="p-3.5 rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-emerald-100/90 text-emerald-950 text-sm flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <span className="font-heading font-black text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white shrink-0">
                                {altCorreta.letra}
                              </span>
                              <span className="font-bold leading-snug">
                                {altCorreta.texto}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-xs font-heading font-bold text-emerald-700">
                              <span>Resposta correta</span>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Caixa de Por que errou (se errou) */}
                      {!q.acertou && q.por_que_errou && (
                        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-950 text-sm leading-relaxed space-y-1">
                          <div className="flex items-center gap-1.5 font-heading font-bold text-rose-800 text-xs uppercase tracking-wider">
                            <AlertCircle className="w-4 h-4 text-rose-600" />
                            <span>Onde prestar atenção</span>
                          </div>
                          <p>{q.por_que_errou}</p>
                        </div>
                      )}

                      {/* Caixa de Explicação da resposta correta */}
                      {q.explicacao && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-950 text-sm leading-relaxed space-y-1">
                          <div className="flex items-center gap-1.5 font-heading font-bold text-emerald-800 text-xs uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Entenda a resposta correta</span>
                          </div>
                          <p>{q.explicacao}</p>
                        </div>
                      )}
                    </CartaoVidro>
                  );
                })}
              </div>
            </section>
          )}

          {/* Revisão do Exercício */}
          {!isProva && (
            <section className="space-y-4 pt-4" aria-labelledby="revisao-exercicio-titulo">
              <h2 id="revisao-exercicio-titulo" className="font-heading font-black text-xl text-slate-800 px-1">
                Revisão das Questões
              </h2>

              <div className="space-y-4">
                {atividade.questoes.map((q) => {
                  const resp = respostasMap[q.id];
                  const isDisc = q.tipo === 'discursiva';

                  if (isDisc) {
                    const textoResp = resp?.texto_respondido ?? q.texto_respondido ?? null;
                    const semResposta = !textoResp;
                    const correcao = resp?.correcao ?? q.correcao ?? (semResposta ? null : 'pendente');
                    const isPendente = !semResposta && (!correcao || correcao === 'pendente');
                    const comentarioProf = resp?.comentario_professor ?? q.comentario_professor ?? null;
                    const respEsperada = resp?.resposta_esperada ?? q.resposta_esperada ?? null;
                    const imagemUrl = q.imagem_url;
                    const nota = resp?.nota ?? q.nota ?? (
                      typeof resp?.pontuacao === 'number'
                        ? (resp.pontuacao <= 1 ? Math.round(resp.pontuacao * 100) : Math.round(resp.pontuacao))
                        : (typeof q.pontuacao === 'number'
                            ? (q.pontuacao <= 1 ? Math.round(q.pontuacao * 100) : Math.round(q.pontuacao))
                            : null)
                    );

                    return (
                      <CartaoVidro key={q.id} className="p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-heading font-black text-indigo-600 uppercase tracking-wider">
                            Questão {q.ordem}
                          </span>

                          {semResposta ? (
                            <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5" />}>
                              Sem resposta
                            </ChipInfo>
                          ) : isPendente ? (
                            <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5 text-amber-600" />}>
                              Aguardando correção
                            </ChipInfo>
                          ) : correcao === 'certo' ? (
                            <ChipInfo color="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}>
                              Certo {nota !== null ? `(${nota}/100)` : ''}
                            </ChipInfo>
                          ) : correcao === 'parcial' ? (
                            <ChipInfo color="amber" icon={<AlertCircle className="w-3.5 h-3.5 text-amber-600" />}>
                              Parcial {nota !== null ? `(${nota}/100)` : ''}
                            </ChipInfo>
                          ) : (
                            <ChipInfo color="pink" icon={<XCircle className="w-3.5 h-3.5 text-rose-600" />}>
                              Errado {nota !== null ? `(${nota}/100)` : ''}
                            </ChipInfo>
                          )}
                        </div>

                        <p className="font-heading font-bold text-base sm:text-lg text-slate-900 leading-snug">
                          <MathText text={q.enunciado} />
                        </p>

                        {imagemUrl && (
                          <div className="max-w-md w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs my-2">
                            <img
                              src={imagemUrl}
                              alt="Apoio da questão"
                              className="w-full h-auto max-h-72 object-contain bg-slate-50"
                            />
                          </div>
                        )}

                        {/* Resposta do Aluno */}
                        <div className="space-y-2 pt-1">
                          {semResposta ? (
                            <div className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-600 text-sm flex items-center justify-between gap-3">
                              <span className="italic font-medium text-slate-500">Sem resposta</span>
                            </div>
                          ) : (
                            <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm leading-relaxed space-y-1">
                              <span className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 block">
                                Sua resposta:
                              </span>
                              <p className="whitespace-pre-wrap font-sans">{textoResp}</p>
                            </div>
                          )}
                        </div>

                        {/* Aguardando correção */}
                        {isPendente && (
                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Aguardando correção</span>
                          </div>
                        )}

                        {/* Quando corrigida */}
                        {!isPendente && !semResposta && (
                          <>
                            {comentarioProf && (
                              <div className="p-3.5 sm:p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs sm:text-sm space-y-1">
                                <span className="font-bold text-indigo-800 block">Comentário do professor:</span>
                                <p className="whitespace-pre-wrap">{comentarioProf}</p>
                              </div>
                            )}

                            {respEsperada && (
                              <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm space-y-1">
                                <span className="font-bold text-emerald-800 block">Resposta esperada:</span>
                                <p className="whitespace-pre-wrap">{respEsperada}</p>
                              </div>
                            )}

                            {(resp?.explicacao || q.explicacao) && (
                              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm space-y-1">
                                <span className="font-bold text-slate-600 block">Explicação pedagógica:</span>
                                <p className="whitespace-pre-wrap">{resp?.explicacao || q.explicacao}</p>
                              </div>
                            )}
                          </>
                        )}
                      </CartaoVidro>
                    );
                  }

                  const acertou = resp?.acertou;

                  return (
                    <CartaoVidro key={q.id} className="p-5 sm:p-6 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-heading font-black text-indigo-600 uppercase tracking-wider">
                          Questão {q.ordem}
                        </span>
                        {acertou ? (
                          <ChipInfo color="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                            Acertou de 1ª
                          </ChipInfo>
                        ) : (
                          <ChipInfo color="pink" icon={<XCircle className="w-3.5 h-3.5" />}>
                            {resp?.acertou_final ? 'Acertou na 2ª tentativa' : 'Errou'}
                          </ChipInfo>
                        )}
                      </div>

                      <p className="font-heading font-bold text-base sm:text-lg text-slate-900 leading-snug">
                        <MathText text={q.enunciado} />
                      </p>

                      {q.imagem_url && (
                        <div className="max-w-md w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs my-2">
                          <img
                            src={q.imagem_url}
                            alt="Apoio da questão"
                            className="w-full h-auto max-h-72 object-contain bg-slate-50"
                          />
                        </div>
                      )}

                      {resp?.por_que_errou && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm">
                          <span className="font-bold block mb-0.5">Onde prestar atenção:</span>
                          {resp.por_que_errou}
                        </div>
                      )}

                      {resp?.explicacao && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm">
                          <span className="font-bold block mb-0.5">Explicação pedagógica:</span>
                          {resp.explicacao}
                        </div>
                      )}
                    </CartaoVidro>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </AlunoLayout>
    );
  }

  /* =========================================================================
   * O PLAYER DE QUESTÕES
   * ========================================================================= */
  const totalQuestoes = atividade.questoes.length;
  const porcentagemProgresso = totalQuestoes > 0 ? ((indiceAtual + 1) / totalQuestoes) * 100 : 0;
  const isProva = atividade.modo === 'prova';
  const isEncerrada = atividade.status === 'encerrada';

  // Identificação das alternativas respondidas e corretas
  const altEscolhidaId = questaoJaRespondida ? respAtual?.alternativa_escolhida_id : selecionadaId;
  const altCorretaId = questaoJaRespondida && !isProva ? respAtual?.alternativa_correta_id : undefined;

  return (
    <AlunoLayout containerClassName="p-3 sm:p-6 lg:p-8">
      <main className="max-w-3xl mx-auto w-full space-y-4 sm:space-y-5 pb-16 safe-bottom">
        {/* Barra Superior de Navegação e Configuração (Mobile-First) */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 bg-white/70 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-white/80 shadow-sm">
          <button
            type="button"
            onClick={() => navigate('/aluno/painel')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs text-xs font-heading font-bold cursor-pointer transition-all shrink-0 min-h-[38px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Painel</span>
          </button>

          {/* Navegador rápido de questões (pills com rolagem fluida no mobile) */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5 px-1 no-scrollbar justify-start sm:justify-center">
            {atividade.questoes.map((q, idx) => {
              const respondida = !!respostasMap[q.id];
              const isAtual = idx === indiceAtual;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndiceAtual(idx)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 min-w-[32px] sm:min-w-[36px] rounded-xl text-xs font-heading font-black flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    isAtual
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 scale-105'
                      : respondida
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-white/90 text-slate-600 border border-slate-200 hover:border-indigo-300'
                  }`}
                  title={`Questão ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleToggleSom}
            aria-label={somAtivo ? 'Desativar som' : 'Ativar som'}
            className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-xs cursor-pointer shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            {somAtivo ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {/* Card Principal da Questão */}
        <CartaoVidro className="relative overflow-hidden p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Barra de Progresso Fina no Topo do Card */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-300"
              style={{ width: `${porcentagemProgresso}%` }}
            />
          </div>

          {/* Chips do Topo: Disciplina, Modo e Questão N de T */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <ChipInfo color="indigo" className="text-[11px] sm:text-xs">
                {atividade.disciplina_nome}
              </ChipInfo>

              {isProva ? (
                <ChipInfo color="pink" icon={<FileText className="w-3 h-3" />} className="text-[11px] sm:text-xs">
                  Modo Prova
                </ChipInfo>
              ) : (
                <ChipInfo color="emerald" icon={<Sparkles className="w-3 h-3" />} className="text-[11px] sm:text-xs">
                  Modo Exercício
                </ChipInfo>
              )}
            </div>

            <span className="text-[11px] sm:text-xs font-heading font-black text-slate-500 uppercase tracking-wider">
              Questão {indiceAtual + 1} de {totalQuestoes}
            </span>
          </div>

          {/* Enunciado e Ações (Dica e Som) */}
          <div className="space-y-3.5 sm:space-y-4">
            <h2 className="font-heading font-black text-lg sm:text-2xl text-slate-900 leading-snug tracking-tight break-words">
              <MathText text={questaoAtual?.enunciado} />
            </h2>

            {questaoAtual?.imagem_url && (
              <div className="max-w-md w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs my-2">
                <img
                  src={questaoAtual.imagem_url}
                  alt="Apoio da questão"
                  className="w-full h-auto max-h-72 object-contain bg-slate-50"
                />
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-0.5">
              {/* Botão de Dica (apenas se existir dica) */}
              {questaoAtual?.dica && !questaoJaRespondida && (
                <button
                  type="button"
                  onClick={() => setDicaAberta(!dicaAberta)}
                  className="text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm font-heading font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs min-h-[40px]"
                >
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>💡 Precisa de uma dica?</span>
                </button>
              )}

              {/* Botão 🔊 de Leitura em Voz Alta (pt-BR) */}
              {isSpeechSupported() && (
                <button
                  type="button"
                  onClick={handleFalar}
                  className={`rounded-xl px-3 py-2 text-xs sm:text-sm font-heading font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs min-h-[40px] ${
                    falando
                      ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse'
                      : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                  title="Ouvir enunciado e alternativas em voz alta"
                >
                  {falando ? <Volume1 className="w-4 h-4 animate-bounce" /> : <Volume2 className="w-4 h-4" />}
                  <span>{falando ? 'Ouvindo...' : '🔊 Ouvir questão'}</span>
                </button>
              )}
            </div>

            {/* Caixa da Dica Aberta */}
            {dicaAberta && questaoAtual?.dica && !questaoJaRespondida && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-200 text-amber-950 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 animate-slideDownFade motion-reduce:animate-none">
                <span className="text-lg">💡</span>
                <div>
                  <span className="font-heading font-bold block text-amber-900 mb-0.5">Dica da questão:</span>
                  <p>
                    <MathText text={questaoAtual.dica} />
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Corpo da Questão: Campo Discursivo ou Alternativas Objetivas */}
          {isDiscursiva ? (
            <div className="space-y-3 pt-1">
              {!questaoJaRespondida ? (
                <div className="space-y-2">
                  <label
                    htmlFor="campo-resposta-discursiva"
                    className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Sua resposta:
                  </label>
                  <textarea
                    id="campo-resposta-discursiva"
                    rows={6}
                    maxLength={2000}
                    value={textoDiscursiva}
                    onChange={(e) => handleMudarTextoDiscursiva(e.target.value)}
                    disabled={confirmando || isEncerrada}
                    placeholder="Escreva sua resposta detalhada aqui..."
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-sans text-sm sm:text-base text-slate-900 placeholder:text-slate-400 resize-y min-h-[140px] outline-none"
                  />
                  <div className="flex items-center justify-end text-xs font-medium text-slate-500">
                    <span>{textoDiscursiva.length}/2000</span>
                  </div>
                  <ConfirmDialog
                    isOpen={confirmarEnvioDiscursiva}
                    onClose={() => setConfirmarEnvioDiscursiva(false)}
                    onConfirm={handleEnviarDiscursiva}
                    title="Enviar minha resposta?"
                    message="Depois de enviar, você não poderá mudar esta resposta. O professor vai corrigir."
                    confirmText="Enviar"
                    cancelText="Voltar e revisar"
                    isLoading={confirmando}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="block text-xs font-heading font-bold text-slate-500 uppercase tracking-wider">
                    Sua resposta:
                  </span>
                  <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                    {respAtual?.texto_respondido || textoDiscursiva}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3 pt-1" role="radiogroup" aria-label="Alternativas">
              {questaoAtual?.alternativas.map((alt) => {
                const isEscolhida = altEscolhidaId === alt.id;
                const isCorreta = altCorretaId === alt.id;

                // Em modo prova, nunca expõe cores de certo/errado
                let estiloAlternativa = 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-800';
                let estiloLetra = 'bg-slate-100 text-slate-700 border-slate-200';
                let iconeStatus: React.ReactNode = null;

                if (questaoJaRespondida) {
                  if (isProva) {
                    // Prova travada: apenas mostra a selecionada de forma neutra
                    if (isEscolhida) {
                      estiloAlternativa = 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-bold';
                      estiloLetra = 'bg-indigo-600 text-white border-indigo-600';
                    } else {
                      estiloAlternativa = 'border-slate-100 bg-slate-50/60 text-slate-400 opacity-70';
                    }
                  } else {
                    // Modo Exercício: destaque de correta e incorreta
                    if (isCorreta) {
                      estiloAlternativa = 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-emerald-100/90 text-emerald-950 font-bold shadow-sm ring-2 ring-emerald-400/30';
                      estiloLetra = 'bg-emerald-600 text-white border-emerald-600';
                      iconeStatus = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
                    } else if (isEscolhida && !respAtual?.acertou) {
                      estiloAlternativa = 'border-rose-500 bg-gradient-to-r from-rose-50 to-rose-100/90 text-rose-950 font-bold shadow-sm ring-2 ring-rose-400/30';
                      estiloLetra = 'bg-rose-600 text-white border-rose-600';
                      iconeStatus = <XCircle className="w-5 h-5 text-rose-600 shrink-0" />;
                    } else {
                      estiloAlternativa = 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60';
                    }
                  }
                } else {
                  // Estado ativo de escolha antes de confirmar
                  if (selecionadaId === alt.id) {
                    estiloAlternativa = 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-sm ring-2 ring-indigo-500/20';
                    estiloLetra = 'bg-indigo-600 text-white border-indigo-600';
                  }
                }

                return (
                  <button
                    key={alt.id}
                    type="button"
                    disabled={questaoJaRespondida || isEncerrada}
                    onClick={() => setSelecionadaId(alt.id)}
                    className={`w-full text-left p-3.5 sm:p-5 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-3 sm:gap-4 select-none min-h-[54px] active:scale-[0.99] ${
                      !questaoJaRespondida && !isEncerrada ? 'cursor-pointer' : 'cursor-default'
                    } ${estiloAlternativa}`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <span
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-heading font-black text-sm sm:text-base shrink-0 border transition-all ${estiloLetra}`}
                      >
                        {alt.letra}
                      </span>
                      <span className="text-sm sm:text-base leading-snug break-words flex-1">
                        <MathText text={alt.texto} />
                      </span>
                    </div>

                    {iconeStatus}
                  </button>
                );
              })}
            </div>
          )}

          {/* Feedback do Modo Exercício (após responder) */}
          {questaoJaRespondida && !isProva && respAtual && (
            <div className="space-y-3 pt-2 animate-slideDownFade motion-reduce:animate-none">
              {isDiscursiva ? (
                <>
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200 text-indigo-900 font-heading font-bold text-sm sm:text-base flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span>Resposta enviada ✓. Seu professor vai corrigir.</span>
                  </div>

                  {(respAtual.explicacao || questaoAtual?.explicacao) && (
                    <div className="p-3.5 sm:p-5 rounded-2xl bg-emerald-50/90 border-2 border-emerald-200 text-emerald-950 text-xs sm:text-base leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 font-heading font-bold text-emerald-800 text-xs sm:text-sm uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Entenda a resposta correta</span>
                      </div>
                      <p>
                        <MathText text={respAtual.explicacao || questaoAtual?.explicacao} />
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Faixa de Resultado (Verde ou Degradê Vermelho->Laranja) */}
                  {respAtual.acertou || respAtual.acertou_final ? (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-heading font-black text-base sm:text-xl flex items-center gap-2.5 sm:gap-3 shadow-md shadow-emerald-200">
                      <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
                      <span>Mandou bem! 🎉</span>
                    </div>
                  ) : (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white font-heading font-bold text-sm sm:text-lg flex items-center gap-2.5 sm:gap-3 shadow-md shadow-rose-200">
                      <span className="text-xl sm:text-2xl shrink-0">💪</span>
                      <span>Não foi dessa vez, mas faz parte aprender!</span>
                    </div>
                  )}

                  {/* Cartão Rosa: Onde prestar atenção (por_que_errou) */}
                  {!respAtual.acertou && respAtual.por_que_errou && (
                    <div className="p-3.5 sm:p-5 rounded-2xl bg-rose-50/90 border-2 border-rose-200 text-rose-950 text-xs sm:text-base leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 font-heading font-bold text-rose-800 text-xs sm:text-sm uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Onde prestar atenção</span>
                      </div>
                      <p>
                        <MathText text={respAtual.por_que_errou} />
                      </p>
                    </div>
                  )}

                  {/* Cartão Verde: Entenda a resposta correta (explicacao) */}
                  {respAtual.explicacao && (
                    <div className="p-3.5 sm:p-5 rounded-2xl bg-emerald-50/90 border-2 border-emerald-200 text-emerald-950 text-xs sm:text-base leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 font-heading font-bold text-emerald-800 text-xs sm:text-sm uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Entenda a resposta correta</span>
                      </div>
                      <p>
                        <MathText text={respAtual.explicacao} />
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Feedback do Modo Prova (Discreto: Resposta registrada ✓) */}
          {questaoJaRespondida && isProva && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-200 text-indigo-900 font-heading font-bold text-sm sm:text-base flex items-center gap-2.5 animate-slideDownFade motion-reduce:animate-none">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              <span>Resposta registrada ✓</span>
            </div>
          )}

          {/* Ações Inferiores (Mobile-First: botões confortáveis em tela cheia) */}
          <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            {!questaoJaRespondida && !isEncerrada ? (
              <BotaoGrande
                variant="primary"
                disabled={isDiscursiva ? !textoDiscursiva.trim() || confirmando : !selecionadaId || confirmando}
                isLoading={confirmando}
                onClick={isDiscursiva ? () => setConfirmarEnvioDiscursiva(true) : handleConfirmar}
                className="w-full sm:w-auto px-8 min-h-[50px] text-base"
              >
                {isDiscursiva ? 'Enviar resposta' : 'Confirmar resposta'}
              </BotaoGrande>
            ) : (
              <div className="flex items-center justify-between w-full gap-2.5 flex-col sm:flex-row">
                {/* Botão Tentar Novamente (só em exercício quando acertou_final for false e NÃO for discursiva) */}
                {!isProva && !isDiscursiva && respAtual?.acertou_final === false && !isEncerrada && (
                  <BotaoGrande
                    variant="yellow"
                    onClick={handleIniciarTentarNovamente}
                    leftIcon={<RotateCcw className="w-4 h-4" />}
                    className="w-full sm:w-auto text-sm sm:text-base min-h-[48px]"
                  >
                    Tentar novamente
                  </BotaoGrande>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                  <BotaoGrande
                    variant="primary"
                    onClick={handleAvancar}
                    isLoading={carregandoResultadoProva}
                    rightIcon={<ArrowRight className="w-5 h-5" />}
                    className="w-full sm:w-auto px-8 text-sm sm:text-base min-h-[50px]"
                  >
                    {indiceAtual === totalQuestoes - 1
                      ? isProva
                        ? 'Finalizar prova'
                        : 'Ver resultado'
                      : 'Próxima'}
                  </BotaoGrande>
                </div>
              </div>
            )}
          </div>
        </CartaoVidro>
      </main>
    </AlunoLayout>
  );
};

export default AlunoAtividadePage;
