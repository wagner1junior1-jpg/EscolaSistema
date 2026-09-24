import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Select,
} from '@/components/ui';
import {
  professorService,
  AtividadeCompleta,
  MapaDeCalorAtividade,
  ItemMapaDeCalorQuestao,
  questoesCriticas,
  LetraAlternativa,
} from '@/services';
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  AlertCircle,
  Loader2,
  TrendingDown,
} from 'lucide-react';

export const ProfessorResultadosPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [atividade, setAtividade] = useState<AtividadeCompleta | null>(null);
  const [mapa, setMapa] = useState<MapaDeCalorAtividade | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Ordenação: 'ordem' (ordem da prova) | 'dificeis' (mais difíceis primeiro)
  const [ordenacao, setOrdenacao] = useState<'ordem' | 'dificeis'>('ordem');

  const carregarDados = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);

    try {
      const [ativCarregada, mapaCarregado] = await Promise.all([
        professorService.obterAtividade(id),
        professorService.mapaDeCalor(id),
      ]);

      if (!ativCarregada) {
        throw new Error('Atividade não encontrada ou sem permissão de acesso.');
      }

      setAtividade(ativCarregada);
      setMapa(mapaCarregado);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar os resultados da atividade.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

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
            <p className="text-sm font-medium">Carregando mapa de calor e resultados...</p>
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

        {/* Cabeçalho de Resultados */}
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
                </div>

                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  {mapa.titulo}
                </h1>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>
                    <strong>{mapa.total_alunos_responderam}</strong> aluno(s) responderam
                  </span>
                </div>
              </div>

              {/* Seletor de Ordenação */}
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

            {/* Lista de Questões e Estatísticas */}
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
                      <p className="text-sm text-slate-900 font-medium leading-relaxed pt-3">
                        {q.enunciado}
                      </p>
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
                                    <strong>{totalVotos}</strong> aluno(s) ({porcentagem}%)
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

                      {/* Caixa: Pegadinha mais escolhida */}
                      {q.distrator_mais_escolhido && (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-heading font-bold text-rose-900">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              Pegadinha mais escolhida: Letra {q.distrator_mais_escolhido.letra} (
                              {q.distrator_mais_escolhido.total_escolhas} alunos)
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
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ProfessorResultadosPage;
