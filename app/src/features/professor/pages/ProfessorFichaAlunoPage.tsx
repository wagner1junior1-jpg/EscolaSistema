import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import {
  professorService,
  assinarMudancas,
  FichaAluno,
  LetraAlternativa,
} from '@/services';
import {
  ArrowLeft,
  User,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertCircle,
  Loader2,
  BookOpen,
  MessageSquare,
  FileEdit,
  GraduationCap,
  Clock,
} from 'lucide-react';
import { ModalObservacaoAluno } from '../components/ModalObservacaoAluno';

export const ProfessorFichaAlunoPage: React.FC = () => {
  const { ofertaId, alunoId } = useParams<{ ofertaId?: string; alunoId?: string }>();
  const navigate = useNavigate();

  // Se a rota for /professor/aluno/:alunoId, o parâmetro alunoId vem preenchido
  const idDoAluno = alunoId || '';
  const idDaOferta = ofertaId || '';

  const [ficha, setFicha] = useState<FichaAluno | null>(null);
  const [mapaLetras, setMapaLetras] = useState<Record<string, Record<string, LetraAlternativa>>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalObsAberto, setModalObsAberto] = useState(false);

  const carregarFicha = useCallback(async () => {
    if (!idDoAluno) return;
    setCarregando(true);
    setErro(null);

    try {
      const fichaCarregada = idDaOferta
        ? await professorService.fichaAluno(idDaOferta, idDoAluno)
        : await professorService.fichaAluno(idDoAluno);

      setFicha(fichaCarregada);

      // Busca dados estruturais das atividades para mapear letras de cada alternativa
      const mapaTemp: Record<string, Record<string, LetraAlternativa>> = {};

      await Promise.all(
        fichaCarregada.atividades.map(async (ativ) => {
          try {
            const completa = await professorService.obterAtividade(ativ.atividade_id);
            if (completa) {
              const altsMap: Record<string, LetraAlternativa> = {};
              completa.questoes.forEach((q) => {
                q.alternativas.forEach((alt) => {
                  altsMap[alt.id] = alt.letra as LetraAlternativa;
                });
              });
              mapaTemp[ativ.atividade_id] = altsMap;
            }
          } catch {
            // Continua se não conseguir carregar alternativas
          }
        })
      );

      setMapaLetras(mapaTemp);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar ficha pedagógica do aluno.');
    } finally {
      setCarregando(false);
    }
  }, [idDaOferta, idDoAluno]);

  useEffect(() => {
    carregarFicha();
    const desassinar = assinarMudancas(() => {
      carregarFicha();
    });
    return () => {
      desassinar();
    };
  }, [carregarFicha]);

  const obterLetra = (ativId: string, altId: string | null) => {
    if (!altId) return null;
    return mapaLetras[ativId]?.[altId] || null;
  };

  const linkVoltar = idDaOferta
    ? `/professor/oferta/${idDaOferta}?aba=desempenho`
    : '/professor';

  const textoVoltar = idDaOferta
    ? 'Voltar para o Desempenho da Turma'
    : 'Voltar para Minhas Turmas';

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Navegação Voltar */}
        <Link
          to={linkVoltar}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{textoVoltar}</span>
        </Link>

        {/* Estado de Carregamento */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando ficha do aluno...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {!carregando && erro && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-rose-900">
                Não foi possível carregar a ficha
              </h3>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{erro}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate(linkVoltar)}
              className="mx-auto"
            >
              {textoVoltar}
            </Button>
          </div>
        )}

        {/* Conteúdo Principal do Aluno */}
        {!carregando && !erro && ficha && (
          <>
            {/* 1. Cabeçalho do Aluno */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500">
                      Nº {ficha.aluno.numero_chamada} • {ficha.turma_nome}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                      {ficha.disciplina_nome}
                    </span>
                  </div>
                  <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mt-0.5">
                    {ficha.aluno.nome_completo}
                  </h1>
                </div>
              </div>

              {/* Média no Período e Faixa */}
              <div className="flex items-center gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {idDaOferta ? 'Média na Matéria' : 'Média Geral'}
                  </div>
                  <div className="font-heading font-black text-2xl text-slate-900">
                    {ficha.media_periodo !== null ? `${ficha.media_periodo}%` : '—'}
                  </div>
                </div>

                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                      ficha.faixa === 'Ótimo'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : ficha.faixa === 'Bom'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : ficha.faixa === 'Atenção'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {ficha.faixa}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Média de Acerto de Cada Aluno por Matéria */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-heading font-black text-lg text-slate-900">
                    Média de Acerto por Matéria
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Desempenho consolidado do aluno em todas as disciplinas da turma
                </span>
              </div>

              {(!ficha.desempenho_materias || ficha.desempenho_materias.length === 0) ? (
                <p className="text-xs text-slate-400 italic">
                  Nenhuma disciplina com atividades avaliadas encontrada para este aluno.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  {ficha.desempenho_materias.map((mat) => {
                    const temMedia = mat.media !== null;
                    const corBadge =
                      mat.faixa === 'Ótimo'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : mat.faixa === 'Bom'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : mat.faixa === 'Atenção'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200';

                    const corBarra =
                      mat.faixa === 'Ótimo'
                        ? 'bg-emerald-500'
                        : mat.faixa === 'Bom'
                        ? 'bg-sky-500'
                        : mat.faixa === 'Atenção'
                        ? 'bg-rose-500'
                        : 'bg-slate-300';

                    return (
                      <div
                        key={mat.disciplina_id}
                        className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-heading font-bold text-sm text-slate-900 leading-snug">
                              {mat.disciplina_nome}
                            </h3>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {mat.professor_nome}
                            </span>
                          </div>

                          <span
                            className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border ${corBadge}`}
                          >
                            {temMedia ? `${mat.media}%` : '—'}
                          </span>
                        </div>

                        {/* Barra de Progresso do Aproveitamento */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${corBarra}`}
                              style={{ width: `${mat.media ?? 0}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                            <span>
                              {mat.atividades_concluidas} de {mat.total_atividades}{' '}
                              {mat.total_atividades === 1 ? 'atividade' : 'atividades'}
                            </span>
                            <span className="font-semibold">{mat.faixa}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Seção de Observações Pedagógicas do Aluno */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-heading font-black text-lg text-slate-900">
                    Observações Pedagógicas do Aluno
                  </h2>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<FileEdit className="w-4 h-4 text-indigo-600" />}
                  onClick={() => setModalObsAberto(true)}
                  className="font-semibold text-xs"
                >
                  Registrar / Editar Observação
                </Button>
              </div>

              {(!ficha.observacoes || ficha.observacoes.length === 0) ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Nenhuma observação registrada para este aluno até o momento.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<FileEdit className="w-3.5 h-3.5" />}
                    onClick={() => setModalObsAberto(true)}
                    className="text-xs"
                  >
                    Adicionar a primeira observação
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {ficha.observacoes.map((obs) => (
                    <div
                      key={obs.id}
                      className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/70 text-xs text-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between text-slate-400 gap-2 flex-wrap">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          {obs.professor_nome}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          {new Date(obs.updated_at || obs.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-800 text-xs sm:text-sm">
                        {obs.texto}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Lista de Atividades do Aluno */}
            <div className="space-y-6">
              <h2 className="font-heading font-black text-xl text-slate-900 tracking-tight">
                Atividades Realizadas ({ficha.atividades.length})
              </h2>

              {ficha.atividades.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="font-heading font-bold text-base text-slate-700">
                    Nenhuma atividade avaliada nesta oferta
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                    Não há registros de atividades concluídas ou em andamento para este aluno nesta matéria.
                  </p>
                </div>
              ) : (
                ficha.atividades.map((ativ) => (
                  <Card key={ativ.atividade_id} className="border-slate-200 shadow-xs">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                ativ.modo === 'prova'
                                  ? 'bg-violet-100 text-violet-800 border-violet-200'
                                  : 'bg-teal-100 text-teal-800 border-teal-200'
                              }`}
                            >
                              {ativ.modo === 'prova' ? 'Prova' : 'Exercício'}
                            </span>

                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                ativ.status_aluno === 'concluida'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : ativ.status_aluno === 'em_andamento'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {ativ.status_aluno === 'concluida'
                                ? 'Concluída'
                                : ativ.status_aluno === 'em_andamento'
                                ? 'Em andamento'
                                : 'Pendente'}
                            </span>
                          </div>

                          <CardTitle className="text-lg pt-1">{ativ.titulo}</CardTitle>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-400 block">
                            Aproveitamento
                          </span>
                          <span className="font-heading font-black text-xl text-slate-900">
                            {ativ.aproveitamento !== null ? `${ativ.aproveitamento}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6 space-y-4">
                      {ativ.questoes.map((q) => {
                        const isDiscursiva = q.tipo === 'discursiva';
                        const letraEscolhida = obterLetra(ativ.atividade_id, q.alternativa_escolhida_id);
                        const letraCorreta = obterLetra(ativ.atividade_id, q.alternativa_correta_id);
                        const semResposta = isDiscursiva ? !q.texto_resposta : !q.alternativa_escolhida_id;

                        const temRetentativa = !isDiscursiva && q.tentativas > 1 && q.acertou_final;

                        let borderBg = 'border-slate-200 bg-slate-50/50';
                        if (isDiscursiva) {
                          if (q.correcao === 'certo') borderBg = 'border-emerald-200 bg-emerald-50/20';
                          else if (q.correcao === 'parcial') borderBg = 'border-amber-200 bg-amber-50/20';
                          else if (q.correcao === 'errado') borderBg = 'border-rose-200 bg-rose-50/20';
                          else if (semResposta) borderBg = 'border-slate-200 bg-slate-50/50';
                          else borderBg = 'border-indigo-100 bg-indigo-50/20';
                        } else {
                          if (q.acertou || q.acertou_final) borderBg = 'border-emerald-200 bg-emerald-50/20';
                          else if (semResposta) borderBg = 'border-slate-200 bg-slate-50/50';
                          else borderBg = 'border-rose-200 bg-rose-50/20';
                        }

                        return (
                          <div
                            key={q.questao_id}
                            className={`p-4 rounded-2xl border transition-all ${borderBg}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-heading font-black text-xs text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                    Q{q.ordem}
                                  </span>

                                  {isDiscursiva ? (
                                    <>
                                      {(() => {
                                        const notaDisc = typeof q.pontuacao_discursiva === 'number'
                                          ? Math.round(q.pontuacao_discursiva <= 1 ? q.pontuacao_discursiva * 100 : q.pontuacao_discursiva)
                                          : (q.correcao === 'certo' ? 100 : q.correcao === 'parcial' ? 50 : 0);

                                        return (
                                          <>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                                              Discursiva
                                            </span>
                                            {q.correcao === 'certo' && (
                                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                <span>Certo ({notaDisc}/100)</span>
                                              </span>
                                            )}
                                            {q.correcao === 'parcial' && (
                                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                                <span>Parcial ({notaDisc}/100)</span>
                                              </span>
                                            )}
                                            {q.correcao === 'errado' && (
                                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                                                <XCircle className="w-4 h-4 text-rose-600" />
                                                <span>Errado ({notaDisc}/100)</span>
                                              </span>
                                            )}
                                            {q.correcao === null && (
                                              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                <span>Aguardando correção</span>
                                              </span>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </>
                                  ) : (
                                    <>
                                      {q.acertou || q.acertou_final ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                          <span>Acertou</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                                          <XCircle className="w-4 h-4 text-rose-600" />
                                          <span>Errou</span>
                                        </span>
                                      )}

                                      {temRetentativa && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                          <Sparkles className="w-3 h-3 text-amber-600" />
                                          <span>acertou na {q.tentativas}ª tentativa</span>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                                  {q.enunciado}
                                </p>
                              </div>
                            </div>

                            {/* Detalhes da resposta */}
                            {isDiscursiva ? (
                              <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                                <div className="text-xs">
                                  <span className="font-semibold text-slate-600 block mb-1">
                                    Resposta do aluno:
                                  </span>
                                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap">
                                    {q.texto_resposta ? (
                                      q.texto_resposta
                                    ) : (
                                      <span className="italic text-slate-400">Em branco</span>
                                    )}
                                  </div>
                                </div>

                                {q.comentario_professor && (
                                  <div className="text-xs p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900">
                                    <span className="font-bold">Comentário do professor: </span>
                                    <span>{q.comentario_professor}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-4 text-xs flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-500">
                                    Resposta do aluno:
                                  </span>
                                  {semResposta ? (
                                    <span className="italic text-slate-400">Em branco</span>
                                  ) : (
                                    <span
                                      className={`font-heading font-black px-2 py-0.5 rounded-md ${
                                        q.acertou || q.acertou_final
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-rose-600 text-white'
                                      }`}
                                    >
                                      Letra {letraEscolhida || '?'}
                                    </span>
                                  )}
                                </div>

                                {(!q.acertou || semResposta) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-500">
                                      Resposta correta:
                                    </span>
                                    <span className="font-heading font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                                      Letra {letraCorreta || '?'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Modal de Registro e Edição de Observações */}
            {modalObsAberto && (
              <ModalObservacaoAluno
                isOpen={modalObsAberto}
                onClose={() => setModalObsAberto(false)}
                alunoId={ficha.aluno.id}
                alunoNome={ficha.aluno.nome_completo}
                turmaNome={ficha.turma_nome}
                numeroChamada={ficha.aluno.numero_chamada}
                onSalvo={carregarFicha}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ProfessorFichaAlunoPage;
