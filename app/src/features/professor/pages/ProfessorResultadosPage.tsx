import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Select,
  Tabs,
  Textarea,
  useToast,
  MathText,
} from '@/components/ui';
import {
  professorService,
  AtividadeCompleta,
  MapaDeCalorAtividade,
  ItemMapaDeCalorQuestao,
  questoesCriticas,
  LetraAlternativa,
  ItemCorrecaoPendente,
  ItemCorrecaoFeita,
} from '@/services';
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  AlertCircle,
  Loader2,
  TrendingDown,
  CheckCircle2,
  XCircle,
  BarChart2,
  Clock,
} from 'lucide-react';

export const ProfessorResultadosPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [atividade, setAtividade] = useState<AtividadeCompleta | null>(null);
  const [mapa, setMapa] = useState<MapaDeCalorAtividade | null>(null);
  const [pendentes, setPendentes] = useState<ItemCorrecaoPendente[]>([]);
  const [corrigidas, setCorrigidas] = useState<ItemCorrecaoFeita[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Aba principal: 'mapa' | 'correcoes'
  const abaParam = searchParams.get('aba');
  const [abaPrincipal, setAbaPrincipal] = useState<'mapa' | 'correcoes'>(
    abaParam === 'correcoes' ? 'correcoes' : 'mapa'
  );

  // Sub-aba de Correções: 'pendentes' | 'corrigidas'
  const [subAbaCorrecoes, setSubAbaCorrecoes] = useState<'pendentes' | 'corrigidas'>('pendentes');

  // Comentários por resposta_id
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  // Ordenação: 'ordem' (ordem da prova) | 'dificeis' (mais difíceis primeiro)
  const [ordenacao, setOrdenacao] = useState<'ordem' | 'dificeis'>('ordem');

  const carregarDados = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);

    try {
      const [ativCarregada, mapaCarregado, pendentesCarregados, corrigidasCarregadas] =
        await Promise.all([
          professorService.obterAtividade(id),
          professorService.mapaDeCalor(id),
          professorService.listarCorrecoesPendentes(id),
          professorService.listarCorrecoesFeitas(id),
        ]);

      if (!ativCarregada) {
        throw new Error('Atividade não encontrada ou sem permissão de acesso.');
      }

      setAtividade(ativCarregada);
      setMapa(mapaCarregado);
      setPendentes(pendentesCarregados);
      setCorrigidas(corrigidasCarregadas);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar os resultados da atividade.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const mudarAbaPrincipal = (novaAba: 'mapa' | 'correcoes') => {
    setAbaPrincipal(novaAba);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (novaAba === 'correcoes') {
        next.set('aba', 'correcoes');
      } else {
        next.delete('aba');
      }
      return next;
    });
  };

  const handleCorrigir = async (
    respostaId: string,
    correcao: 'certo' | 'parcial' | 'errado',
    comentarioManual?: string | null
  ) => {
    if (!id) return;
    setSalvandoId(respostaId);
    try {
      const textoComentario =
        comentarioManual !== undefined
          ? (comentarioManual ?? '').trim() || undefined
          : (comentarios[respostaId] ?? '').trim() || undefined;

      await professorService.corrigirResposta(respostaId, correcao, textoComentario);
      toast.success('Correção salva');

      // Atualiza listas de pendentes e corrigidas e o mapa de calor
      const [novasPendentes, novasCorrigidas, novoMapa] = await Promise.all([
        professorService.listarCorrecoesPendentes(id),
        professorService.listarCorrecoesFeitas(id),
        professorService.mapaDeCalor(id),
      ]);
      setPendentes(novasPendentes);
      setCorrigidas(novasCorrigidas);
      setMapa(novoMapa);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar correção.');
    } finally {
      setSalvandoId(null);
    }
  };

  const formatarData = (dataStr?: string) => {
    if (!dataStr) return '';
    try {
      const d = new Date(dataStr);
      return isNaN(d.getTime())
        ? dataStr
        : d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    } catch {
      return dataStr;
    }
  };

  // Identifica questões críticas usando a função pura do sistema
  const criticas = mapa ? questoesCriticas(mapa.questoes) : [];
  const idsCriticas = new Set(criticas.map((c) => c.questao_id));

  // Ordena as questões conforme seleção
  const questoesExibidas: ItemMapaDeCalorQuestao[] = mapa
    ? [...mapa.questoes].sort((a, b) => {
        if (ordenacao === 'dificeis') {
          return a.porcentagem_acerto - b.porcentagem_acerto;
        }
        return a.ordem - b.ordem;
      })
    : [];

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Navegação Voltar */}
        <Link
          to={atividade ? `/professor/oferta/${atividade.oferta_id}?aba=atividades` : '/professor'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para as atividades da turma</span>
        </Link>

        {/* Estado de Carregamento */}
        {carregando && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Carregando mapa de calor e correções...</p>
          </div>
        )}

        {/* Estado de Erro */}
        {!carregando && erro && (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-rose-900">
                Não foi possível carregar os resultados
              </h3>
              <p className="text-sm text-rose-700 max-w-md mx-auto">{erro}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/professor')} className="mx-auto">
              Voltar para Minhas Turmas
            </Button>
          </div>
        )}

        {/* Cabeçalho de Resultados e Abas */}
        {!carregando && !erro && atividade && mapa && (
          <>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      atividade.modo === 'prova'
                        ? 'bg-violet-100 text-violet-800 border-violet-200'
                        : 'bg-teal-100 text-teal-800 border-teal-200'
                    }`}
                  >
                    {atividade.modo === 'prova' ? 'Prova' : 'Exercício'}
                  </span>

                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      atividade.status === 'publicada'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {atividade.status.toUpperCase()}
                  </span>

                  {pendentes.length > 0 && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      {pendentes.length} {pendentes.length === 1 ? 'correção pendente' : 'correções pendentes'}
                    </span>
                  )}
                </div>

                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  {mapa.titulo}
                </h1>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>
                    <strong>{mapa.total_alunos_responderam}</strong>{' '}
                    {mapa.total_alunos_responderam === 1 ? 'aluno respondeu' : 'alunos responderam'}
                  </span>
                </div>
              </div>
            </div>

            {/* Abas Principais: Resultados e Mapa de Calor | Correções */}
            <div className="border-b border-slate-200 bg-white rounded-2xl px-4 pt-2 shadow-2xs">
              <Tabs
                activeTab={abaPrincipal}
                onChange={(tab) => mudarAbaPrincipal(tab as 'mapa' | 'correcoes')}
                tabs={[
                  {
                    id: 'mapa',
                    label: 'Resultados e Mapa de Calor',
                    icon: <BarChart2 className="w-4 h-4" />,
                  },
                  {
                    id: 'correcoes',
                    label: 'Correções',
                    icon: <CheckCircle2 className="w-4 h-4" />,
                    count: pendentes.length > 0 ? pendentes.length : undefined,
                  },
                ]}
              />
            </div>

            {/* Aba 1: Mapa de Calor e Estatísticas */}
            {abaPrincipal === 'mapa' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <div className="w-full sm:w-64">
                    <Select
                      label="Ordenar questões por:"
                      value={ordenacao}
                      onChange={(e) => setOrdenacao(e.target.value as 'ordem' | 'dificeis')}
                      options={[
                        { value: 'ordem', label: 'Ordem da prova' },
                        { value: 'dificeis', label: 'Mais difíceis primeiro' },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  {questoesExibidas.map((q) => {
                    const questaoBase = atividade.questoes.find((item) => item.id === q.questao_id);
                    const alternativasBase = questaoBase?.alternativas || [];
                    const isCritica = idsCriticas.has(q.questao_id);

                    // Determina cor da barra de aproveitamento geral
                    const pct = q.porcentagem_acerto;
                    const barraCor =
                      pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                    const textoCor =
                      pct >= 80
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : pct >= 50
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-rose-700 bg-rose-50 border-rose-200';

                    return (
                      <Card key={q.questao_id} className="border-slate-200 shadow-xs">
                        <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5 sm:p-6">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-heading font-black text-xs flex items-center justify-center shadow-xs">
                                {q.ordem}
                              </span>
                              <span className="font-heading font-bold text-sm text-slate-800">
                                Questão {q.ordem}
                              </span>
                            </div>

                            {/* Chip Vermelho de Questão Crítica */}
                            {isCritica && (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
                                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                                <span>Questão crítica</span>
                              </div>
                            )}
                          </div>

                          {/* Enunciado */}
                          <div className="text-sm text-slate-900 font-medium leading-relaxed pt-3">
                            <MathText text={q.enunciado} />
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 sm:p-6 space-y-6">
                          {/* Barra Geral de % de Acerto */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                              <span>Índice de Acerto (1ª resposta)</span>
                              <span className={`px-2 py-0.5 rounded-md border font-mono font-bold ${textoCor}`}>
                                {pct}% ({q.total_acertos} de {q.total_respostas} acertos)
                              </span>
                            </div>

                            {/* Barra horizontal */}
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div
                                className={`h-full ${barraCor} transition-all duration-500`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                          </div>

                          {/* Distribuição por Alternativa */}
                          {alternativasBase.length > 0 && (
                            <div className="space-y-3 pt-2">
                              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Distribuição das escolhas por alternativa
                              </div>

                              <div className="space-y-2.5">
                                {(['A', 'B', 'C', 'D', 'E'] as LetraAlternativa[]).map((letra) => {
                                  const dist = q.distribuicao[letra];
                                  const altObj = alternativasBase.find((a) => a.letra === letra);
                                  if (!altObj && (!dist || dist.total === 0)) return null;

                                  const isCorreta = altObj?.correta ?? false;
                                  const porcentagem = dist?.porcentagem ?? 0;
                                  const totalVotos = dist?.total ?? 0;

                                  return (
                                    <div
                                      key={letra}
                                      className={`p-3 rounded-xl border transition-all ${
                                        isCorreta
                                          ? 'border-emerald-300 bg-emerald-50/50'
                                          : 'border-slate-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <span
                                            className={`w-5 h-5 rounded-md font-heading font-black text-xs flex items-center justify-center shrink-0 ${
                                              isCorreta
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-200 text-slate-700'
                                            }`}
                                          >
                                            {letra}
                                          </span>
                                          <span className="font-medium text-slate-800 truncate">
                                            {altObj?.texto || '(Sem texto)'}
                                          </span>
                                          {isCorreta && (
                                            <span className="shrink-0 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                              ✓ Correta
                                            </span>
                                          )}
                                        </div>

                                        <div className="text-right shrink-0 font-semibold text-slate-600 font-mono">
                                          <strong>{totalVotos}</strong>{' '}
                                          {totalVotos === 1 ? 'aluno' : 'alunos'} ({porcentagem}%)
                                        </div>
                                      </div>

                                      {/* Barra de progresso da alternativa */}
                                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                                        <div
                                          className={`h-full transition-all duration-300 ${
                                            isCorreta ? 'bg-emerald-500' : 'bg-slate-400'
                                          }`}
                                          style={{ width: `${Math.min(100, Math.max(0, porcentagem))}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Caixa: Pegadinha mais escolhida */}
                          {q.distrator_mais_escolhido && (
                            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs font-heading font-bold text-rose-900">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>
                                  Pegadinha mais escolhida: Letra {q.distrator_mais_escolhido.letra} (
                                  {q.distrator_mais_escolhido.total_escolhas}{' '}
                                  {q.distrator_mais_escolhido.total_escolhas === 1 ? 'aluno' : 'alunos'})
                                </span>
                              </div>
                              <p className="text-xs text-rose-800 leading-relaxed pl-6">
                                {q.distrator_mais_escolhido.por_que_errou ||
                                  'Sem explicação da pegadinha cadastrada pelo professor.'}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aba 2: Correções */}
            {abaPrincipal === 'correcoes' && (
              <div className="space-y-6">
                <Tabs
                  activeTab={subAbaCorrecoes}
                  onChange={(tab) => setSubAbaCorrecoes(tab as 'pendentes' | 'corrigidas')}
                  tabs={[
                    {
                      id: 'pendentes',
                      label: 'Pendentes',
                      count: pendentes.length,
                    },
                    {
                      id: 'corrigidas',
                      label: 'Corrigidas',
                      count: corrigidas.length,
                    },
                  ]}
                />

                {/* Sub-aba: Pendentes */}
                {subAbaCorrecoes === 'pendentes' && (
                  <div className="space-y-4">
                    {pendentes.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                        <h3 className="font-heading font-bold text-base text-slate-800">
                          Nenhuma correção pendente
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                          Todas as respostas discursivas enviadas pelos alunos nesta atividade já foram corrigidas.
                        </p>
                      </div>
                    ) : (
                      pendentes.map((item) => (
                        <Card key={item.resposta_id} className="border-slate-200 shadow-xs">
                          <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-heading font-black text-xs flex items-center justify-center">
                                  {item.aluno_nome.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="font-heading font-bold text-sm text-slate-900">
                                    {item.aluno_nome}
                                  </h3>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Enviada em {formatarData(item.respondida_em)}
                                  </span>
                                </div>
                              </div>

                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                Aguardando correção
                              </span>
                            </div>
                          </CardHeader>

                          <CardContent className="p-5 sm:p-6 space-y-5">
                            {/* Enunciado */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Enunciado da Questão
                              </span>
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 leading-relaxed font-medium">
                                <MathText text={item.enunciado} />
                              </div>
                            </div>

                            {/* Resposta do Aluno */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Resposta do Aluno
                              </span>
                              <div className="p-3.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.texto_resposta || '(Sem resposta)'} />
                              </div>
                            </div>

                            {/* Resposta Esperada */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                Resposta Esperada / Gabarito
                              </span>
                              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.resposta_esperada || '(Sem resposta esperada cadastrada)'} />
                              </div>
                            </div>

                            {/* Comentário Opcional */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <label
                                  htmlFor={`comentario-${item.resposta_id}`}
                                  className="font-semibold text-slate-700"
                                >
                                  Comentário opcional (até 500 caracteres):
                                </label>
                                <span
                                  className={`font-mono text-xs ${
                                    (comentarios[item.resposta_id]?.length ?? 0) >= 480
                                      ? 'text-amber-600 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {comentarios[item.resposta_id]?.length ?? 0}/500
                                </span>
                              </div>
                              <Textarea
                                id={`comentario-${item.resposta_id}`}
                                placeholder="Feedback ou observação opcional para o aluno..."
                                maxLength={500}
                                rows={3}
                                value={comentarios[item.resposta_id] ?? ''}
                                onChange={(e) =>
                                  setComentarios((prev) => ({
                                    ...prev,
                                    [item.resposta_id]: e.target.value.slice(0, 500),
                                  }))
                                }
                                disabled={salvandoId === item.resposta_id}
                              />
                            </div>

                            {/* Botões de Ação */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-500 mr-auto">
                                Avaliar e concluir:
                              </span>

                              <Button
                                variant="outline"
                                size="sm"
                                className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 font-bold"
                                disabled={salvandoId === item.resposta_id}
                                onClick={() => handleCorrigir(item.resposta_id, 'certo')}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                                Certo
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="border-amber-500 text-amber-700 hover:bg-amber-50 hover:border-amber-600 font-bold"
                                disabled={salvandoId === item.resposta_id}
                                onClick={() => handleCorrigir(item.resposta_id, 'parcial')}
                              >
                                <AlertCircle className="w-4 h-4 mr-1.5 text-amber-600" />
                                Parcial
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="border-rose-500 text-rose-700 hover:bg-rose-50 hover:border-rose-600 font-bold"
                                disabled={salvandoId === item.resposta_id}
                                onClick={() => handleCorrigir(item.resposta_id, 'errado')}
                              >
                                <XCircle className="w-4 h-4 mr-1.5 text-rose-600" />
                                Errado
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}

                {/* Sub-aba: Corrigidas */}
                {subAbaCorrecoes === 'corrigidas' && (
                  <div className="space-y-4">
                    {corrigidas.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
                        <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                        <h3 className="font-heading font-bold text-base text-slate-800">
                          Nenhuma resposta corrigida ainda
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                          As respostas que você corrigir aparecerão aqui com a nota atribuída e a possibilidade de alteração.
                        </p>
                      </div>
                    ) : (
                      corrigidas.map((item) => (
                        <Card key={item.resposta_id} className="border-slate-200 shadow-xs">
                          <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 p-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-heading font-black text-xs flex items-center justify-center">
                                  {item.aluno_nome.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="font-heading font-bold text-sm text-slate-900">
                                    {item.aluno_nome}
                                  </h3>
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Enviada em {formatarData(item.respondida_em)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">Nota atribuída:</span>
                                {item.correcao === 'certo' && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Certo
                                  </span>
                                )}
                                {item.correcao === 'parcial' && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                    Parcial
                                  </span>
                                )}
                                {item.correcao === 'errado' && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                    Errado
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-5 sm:p-6 space-y-5">
                            {/* Enunciado */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Enunciado da Questão
                              </span>
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-900 leading-relaxed font-medium">
                                <MathText text={item.enunciado} />
                              </div>
                            </div>

                            {/* Resposta do Aluno */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Resposta do Aluno
                              </span>
                              <div className="p-3.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.texto_resposta || '(Sem resposta)'} />
                              </div>
                            </div>

                            {/* Resposta Esperada */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                Resposta Esperada / Gabarito
                              </span>
                              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">
                                <MathText text={item.resposta_esperada || '(Sem resposta esperada cadastrada)'} />
                              </div>
                            </div>

                            {/* Comentário do Professor */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <label
                                  htmlFor={`comentario-${item.resposta_id}`}
                                  className="font-semibold text-slate-700"
                                >
                                  Comentário para o aluno:
                                </label>
                                <span
                                  className={`font-mono text-xs ${
                                    ((comentarios[item.resposta_id] ?? item.comentario_professor ?? '').length >= 480)
                                      ? 'text-amber-600 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {(comentarios[item.resposta_id] ?? item.comentario_professor ?? '').length}/500
                                </span>
                              </div>
                              <Textarea
                                id={`comentario-${item.resposta_id}`}
                                placeholder="Feedback ou observação para o aluno..."
                                maxLength={500}
                                rows={3}
                                value={comentarios[item.resposta_id] !== undefined ? comentarios[item.resposta_id] : (item.comentario_professor || '')}
                                onChange={(e) =>
                                  setComentarios((prev) => ({
                                    ...prev,
                                    [item.resposta_id]: e.target.value.slice(0, 500),
                                  }))
                                }
                                disabled={salvandoId === item.resposta_id}
                              />
                            </div>

                            {/* Opção de Mudar a Nota */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-600">
                                Opção de mudar a nota ou salvar comentário:
                              </span>

                              <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                  variant={item.correcao === 'certo' ? 'primary' : 'outline'}
                                  size="sm"
                                  className={
                                    item.correcao === 'certo'
                                      ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white font-bold'
                                      : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-medium'
                                  }
                                  disabled={salvandoId === item.resposta_id}
                                  onClick={() =>
                                    handleCorrigir(
                                      item.resposta_id,
                                      'certo',
                                      comentarios[item.resposta_id] !== undefined
                                        ? comentarios[item.resposta_id]
                                        : (item.comentario_professor || undefined)
                                    )
                                  }
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                  Certo
                                </Button>

                                <Button
                                  variant={item.correcao === 'parcial' ? 'primary' : 'outline'}
                                  size="sm"
                                  className={
                                    item.correcao === 'parcial'
                                      ? 'bg-amber-600 hover:bg-amber-700 border-amber-600 text-white font-bold'
                                      : 'border-amber-500 text-amber-700 hover:bg-amber-50 font-medium'
                                  }
                                  disabled={salvandoId === item.resposta_id}
                                  onClick={() =>
                                    handleCorrigir(
                                      item.resposta_id,
                                      'parcial',
                                      comentarios[item.resposta_id] !== undefined
                                        ? comentarios[item.resposta_id]
                                        : (item.comentario_professor || undefined)
                                    )
                                  }
                                >
                                  <AlertCircle className="w-4 h-4 mr-1.5" />
                                  Parcial
                                </Button>

                                <Button
                                  variant={item.correcao === 'errado' ? 'primary' : 'outline'}
                                  size="sm"
                                  className={
                                    item.correcao === 'errado'
                                      ? 'bg-rose-600 hover:bg-rose-700 border-rose-600 text-white font-bold'
                                      : 'border-rose-500 text-rose-700 hover:bg-rose-50 font-medium'
                                  }
                                  disabled={salvandoId === item.resposta_id}
                                  onClick={() =>
                                    handleCorrigir(
                                      item.resposta_id,
                                      'errado',
                                      comentarios[item.resposta_id] !== undefined
                                        ? comentarios[item.resposta_id]
                                        : (item.comentario_professor || undefined)
                                    )
                                  }
                                >
                                  <XCircle className="w-4 h-4 mr-1.5" />
                                  Errado
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ProfessorResultadosPage;
