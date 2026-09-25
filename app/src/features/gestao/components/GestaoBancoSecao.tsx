import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Select,
  Input,
  useToast,
} from '@/components/ui';
import {
  gestaoService,
  bancoService,
  Disciplina,
  Turma,
  Assunto,
  BancoQuestao,
  DificuldadeQuestao,
} from '@/services';
import { Database, Loader2, Check, AlertTriangle, BookOpen } from 'lucide-react';

export const GestaoBancoSecao: React.FC = () => {
  const toast = useToast();

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [questoes, setQuestoes] = useState<BancoQuestao[]>([]);

  const [disciplinaId, setDisciplinaId] = useState<string>('');
  const [serie, setSerie] = useState<string>('');
  const [assuntoId, setAssuntoId] = useState<string>('todos');
  const [dificuldade, setDificuldade] = useState<string>('todas');
  const [busca, setBusca] = useState<string>('');

  const [carregandoFiltros, setCarregandoFiltros] = useState<boolean>(true);
  const [carregandoQuestoes, setCarregandoQuestoes] = useState<boolean>(false);

  // Séries únicas das turmas ativas
  const seriesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    turmas.forEach((t) => {
      if (t.serie) set.add(t.serie);
    });
    return Array.from(set).sort();
  }, [turmas]);

  // Carrega disciplinas e turmas no início
  useEffect(() => {
    const carregarIniciais = async () => {
      setCarregandoFiltros(true);
      try {
        const [discList, turmaList] = await Promise.all([
          gestaoService.listarDisciplinas(),
          gestaoService.listarTurmas(),
        ]);
        setDisciplinas(discList);
        setTurmas(turmaList);

        if (discList.length > 0) {
          const mat = discList.find((d) => d.nome.toLowerCase().includes('matemática'));
          setDisciplinaId(mat ? mat.id : discList[0].id);
        }
        setSerie(''); // Todas as séries por padrão
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Falha ao carregar opções.');
      } finally {
        setCarregandoFiltros(false);
      }
    };

    carregarIniciais();
  }, [toast]);

  // Carrega assuntos da disciplina selecionada
  useEffect(() => {
    if (!disciplinaId) {
      setAssuntos([]);
      setAssuntoId('todos');
      return;
    }

    const carregarAssuntos = async () => {
      try {
        const list = await bancoService.listarAssuntos(disciplinaId);
        setAssuntos(list);
        setAssuntoId('todos');
      } catch (err: unknown) {
        console.error('Erro ao listar assuntos:', err);
        setAssuntos([]);
      }
    };

    carregarAssuntos();
  }, [disciplinaId]);

  // Carrega questões do banco para a matéria e série selecionadas
  useEffect(() => {
    if (!disciplinaId) return;

    const carregarQuestoes = async () => {
      setCarregandoQuestoes(true);
      try {
        const list = await bancoService.listarBanco({
          disciplina_id: disciplinaId,
          serie: serie || '',
          assunto_id: assuntoId !== 'todos' ? assuntoId : undefined,
          dificuldade: dificuldade !== 'todas' ? (dificuldade as DificuldadeQuestao) : undefined,
        });
        setQuestoes(list);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Falha ao buscar questões do banco.');
        setQuestoes([]);
      } finally {
        setCarregandoQuestoes(false);
      }
    };

    carregarQuestoes();
  }, [disciplinaId, serie, assuntoId, dificuldade, toast]);

  // Filtro local de busca textual (enunciado ou alternativas)
  const questoesFiltradas = useMemo(() => {
    if (!busca.trim()) return questoes;
    const termo = busca.toLowerCase();
    return questoes.filter((q) => {
      const matchEnunciado = q.enunciado.toLowerCase().includes(termo);
      const matchAlt = (q.alternativas || []).some((a) => a.texto.toLowerCase().includes(termo));
      return matchEnunciado || matchAlt;
    });
  }, [questoes, busca]);

  const discAtual = disciplinas.find((d) => d.id === disciplinaId);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-black text-xl text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Banco de Questões da Escola
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consulta pedagógica unificada do acervo de questões de todas as disciplinas e séries. Modo somente leitura.
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Disciplina */}
            <Select
              label="Disciplina"
              value={disciplinaId}
              onChange={(e) => setDisciplinaId(e.target.value)}
              disabled={carregandoFiltros}
              options={disciplinas.map((d) => ({
                value: d.id,
                label: d.nome,
              }))}
            />

            {/* Série */}
            <Select
              label="Série / Ano"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              disabled={carregandoFiltros}
              options={[
                { value: '', label: 'Todas as séries' },
                ...seriesDisponiveis.map((s) => ({ value: s, label: s })),
              ]}
            />

            {/* Assunto */}
            <Select
              label="Assunto"
              value={assuntoId}
              onChange={(e) => setAssuntoId(e.target.value)}
              disabled={carregandoFiltros || assuntos.length === 0}
              options={[
                { value: 'todos', label: 'Todos os assuntos' },
                ...assuntos.map((a) => ({ value: a.id, label: a.nome })),
              ]}
            />

            {/* Dificuldade */}
            <Select
              label="Dificuldade"
              value={dificuldade}
              onChange={(e) => setDificuldade(e.target.value)}
              options={[
                { value: 'todas', label: 'Todas as dificuldades' },
                { value: 'facil', label: 'Fácil' },
                { value: 'medio', label: 'Médio' },
                { value: 'dificil', label: 'Difícil' },
              ]}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Buscar por texto do enunciado..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Exibindo <strong>{questoesFiltradas.length}</strong> questão(ões)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem de Questões */}
      {carregandoQuestoes ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">Carregando questões do banco...</p>
        </div>
      ) : questoesFiltradas.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-heading font-bold text-base text-slate-700">
              Nenhuma questão encontrada
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              Não foram encontradas questões com os filtros selecionados para {discAtual?.nome || 'esta disciplina'}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questoesFiltradas.map((q, idx) => (
            <Card key={q.id} className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <CardHeader className="bg-slate-50/70 border-b border-slate-200/80 py-3.5 px-5 sm:px-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-heading font-black text-xs flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </span>
                    <span className="font-heading font-bold text-sm text-slate-800">
                      {q.assunto_nome}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-600">
                      {q.serie}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        q.dificuldade === 'facil'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : q.dificuldade === 'medio'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {q.dificuldade}
                    </span>

                    {q.autor_nome && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        Prof(a). {q.autor_nome}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-4">
                {/* Enunciado */}
                <p className="text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {q.enunciado}
                </p>

                {/* Alternativas */}
                <div className="space-y-2.5 pt-1">
                  {(q.alternativas || []).map((alt) => (
                    <div
                      key={alt.id || alt.letra}
                      className={`p-3 rounded-xl border text-xs sm:text-sm ${
                        alt.correta
                          ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20 text-emerald-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-md text-[11px] font-heading font-black flex items-center justify-center shrink-0 ${
                            alt.correta
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {alt.letra}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span>{alt.texto}</span>
                            {alt.correta && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 uppercase">
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> Correta (Gabarito)
                              </span>
                            )}
                          </div>

                          {!alt.correta && alt.por_que_errou && (
                            <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5 pt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>Distrator: {alt.por_que_errou}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dica e Explicação */}
                {(q.dica || q.explicacao) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    {q.dica && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-700 block mb-0.5">Dica:</span>
                        <p className="text-slate-600">{q.dica}</p>
                      </div>
                    )}
                    {q.explicacao && (
                      <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
                        <span className="font-bold text-indigo-900 block mb-0.5">Explicação / Resolução:</span>
                        <p className="text-indigo-800">{q.explicacao}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
