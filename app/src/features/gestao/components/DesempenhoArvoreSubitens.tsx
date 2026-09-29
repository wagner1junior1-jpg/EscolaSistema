import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  GraduationCap,
  BookOpen,
  FolderTree,
  Search,
  ArrowUpDown,
  AlertTriangle,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Users,
} from 'lucide-react';
import {
  DesempenhoTurmaHierarquico,
  DesempenhoMateriaItem,
} from '@/lib/types';
import { DesempenhoQuestaoLinha } from './DesempenhoQuestaoLinha';

interface DesempenhoArvoreSubitensProps {
  turmas: DesempenhoTurmaHierarquico[];
  nomePeriodo: string;
}

export const DesempenhoArvoreSubitens: React.FC<DesempenhoArvoreSubitensProps> = ({
  turmas,
  nomePeriodo,
}) => {
  // Controle de expansão
  const [turmasAbertas, setTurmasAbertas] = useState<Set<string>>(() => {
    // Abre a primeira turma por padrão
    const setInicial = new Set<string>();
    if (turmas.length > 0) {
      setInicial.add(turmas[0].turma_id);
    }
    return setInicial;
  });

  const [materiasAbertas, setMateriasAbertas] = useState<Set<string>>(() => {
    const setInicial = new Set<string>();
    if (turmas.length > 0 && turmas[0].materias.length > 0) {
      setInicial.add(`${turmas[0].turma_id}-${turmas[0].materias[0].disciplina_id}`);
    }
    return setInicial;
  });

  const [conteudosAbertos, setConteudosAbertos] = useState<Set<string>>(() => {
    const setInicial = new Set<string>();
    if (
      turmas.length > 0 &&
      turmas[0].materias.length > 0 &&
      turmas[0].materias[0].conteudos.length > 0
    ) {
      const t = turmas[0];
      const m = t.materias[0];
      const c = m.conteudos[0];
      setInicial.add(`${t.turma_id}-${m.disciplina_id}-${c.conteudo_id}`);
    }
    return setInicial;
  });

  const [questoesAbertas, setQuestoesAbertas] = useState<Set<string>>(new Set());

  // Métrica padrão: % de acertos (com opção de alternar para % de erro)
  const [metrica, setMetrica] = useState<'acerto' | 'erro'>('acerto');

  // Filtros e ordenação
  const [filtroTexto, setFiltroTexto] = useState('');
  const [ordenacao, setOrdenacao] = useState<'prioridade' | 'alfabetica'>('prioridade');
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  // Semáforo pedagógico dinâmico (cores para % Acerto ou % Erro)
  const renderBadge = (
    pctAcerto: number | null,
    pctErro: number | null,
    tamanho: 'sm' | 'md' = 'md'
  ) => {
    if (pctAcerto === null || pctErro === null) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          Sem atividades
        </span>
      );
    }

    const classeTamanho = tamanho === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

    if (metrica === 'acerto') {
      // Semáforo para % de Acertos: >=75% verde, 55% a 74% âmbar, <55% vermelho
      if (pctAcerto >= 75) {
        return (
          <span
            className={`${classeTamanho} rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5`}
            title="Acerto alto (≥75%): Conteúdo bem assimilado"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {pctAcerto.toString().replace('.', ',')}% acerto
          </span>
        );
      }
      if (pctAcerto >= 55) {
        return (
          <span
            className={`${classeTamanho} rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5`}
            title="Acerto moderado (55% a 74%): Ponto de atenção"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {pctAcerto.toString().replace('.', ',')}% acerto
          </span>
        );
      }
      return (
        <span
          className={`${classeTamanho} rounded-full font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 animate-pulse`}
          title="Acerto crítico (<55%): Gargalo pedagógico"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {pctAcerto.toString().replace('.', ',')}% acerto
        </span>
      );
    }

    // Semáforo para % de Erro: <25% verde, 25% a 45% âmbar, >45% vermelho
    if (pctErro < 25) {
      return (
        <span
          className={`${classeTamanho} rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5`}
          title="Erro baixo (<25%): Conteúdo bem assimilado"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {pctErro.toString().replace('.', ',')}% erro
        </span>
      );
    }
    if (pctErro <= 45) {
      return (
        <span
          className={`${classeTamanho} rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5`}
          title="Erro moderado (25% a 45%): Ponto de atenção"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {pctErro.toString().replace('.', ',')}% erro
        </span>
      );
    }
    return (
      <span
        className={`${classeTamanho} rounded-full font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 animate-pulse`}
        title="Erro crítico (>45%): Gargalo pedagógico"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {pctErro.toString().replace('.', ',')}% erro
      </span>
    );
  };

  // Funções de toggle
  const toggleTurma = (turmaId: string) => {
    setTurmasAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(turmaId)) next.delete(turmaId);
      else next.add(turmaId);
      return next;
    });
  };

  const toggleMateria = (turmaId: string, disciplinaId: string) => {
    const key = `${turmaId}-${disciplinaId}`;
    setMateriasAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleConteudo = (turmaId: string, disciplinaId: string, conteudoId: string) => {
    const key = `${turmaId}-${disciplinaId}-${conteudoId}`;
    setConteudosAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleQuestao = (turmaId: string, disciplinaId: string, questaoId: string) => {
    const key = `${turmaId}-${disciplinaId}-${questaoId}`;
    setQuestoesAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Ações de topo
  const expandirTudo = () => {
    const novasTurmas = new Set<string>();
    const novasMaterias = new Set<string>();
    const novosConteudos = new Set<string>();

    turmas.forEach((t) => {
      novasTurmas.add(t.turma_id);
      t.materias.forEach((m) => {
        novasMaterias.add(`${t.turma_id}-${m.disciplina_id}`);
        m.conteudos.forEach((c) => {
          novosConteudos.add(`${t.turma_id}-${m.disciplina_id}-${c.conteudo_id}`);
        });
      });
    });

    setTurmasAbertas(novasTurmas);
    setMateriasAbertas(novasMaterias);
    setConteudosAbertos(novosConteudos);
  };

  const recolherTudo = () => {
    setTurmasAbertas(new Set());
    setMateriasAbertas(new Set());
    setConteudosAbertos(new Set());
    setQuestoesAbertas(new Set());
  };

  // Foco em Atenção (abre apenas itens com acerto <= 65% ou erro >= 35%)
  const focarEmAtencao = () => {
    const novasTurmas = new Set<string>();
    const novasMaterias = new Set<string>();
    const novosConteudos = new Set<string>();

    turmas.forEach((t) => {
      let turmaTemAtencao =
        metrica === 'acerto'
          ? t.porcentagem_acerto_geral !== null && t.porcentagem_acerto_geral <= 65
          : (t.porcentagem_erro_geral || 0) >= 35;

      t.materias.forEach((m) => {
        const materiaAtencao =
          metrica === 'acerto' ? m.porcentagem_acerto <= 65 : m.porcentagem_erro >= 35;
        if (materiaAtencao) {
          turmaTemAtencao = true;
          novasMaterias.add(`${t.turma_id}-${m.disciplina_id}`);
        }
        m.conteudos.forEach((c) => {
          const conteudoAtencao =
            metrica === 'acerto' ? c.porcentagem_acerto <= 65 : c.porcentagem_erro >= 35;
          if (conteudoAtencao) {
            novosConteudos.add(`${t.turma_id}-${m.disciplina_id}-${c.conteudo_id}`);
          }
        });
      });

      if (turmaTemAtencao) {
        novasTurmas.add(t.turma_id);
      }
    });

    setTurmasAbertas(novasTurmas);
    setMateriasAbertas(novasMaterias);
    setConteudosAbertos(novosConteudos);
  };

  // Copiar Pauta resumida da matéria para Reunião Pedagógica
  const copiarPautaMateria = (turma: DesempenhoTurmaHierarquico, materia: DesempenhoMateriaItem) => {
    let texto = `Período: ${nomePeriodo}\n`;
    texto += `Turma: ${turma.turma_nome} (${turma.total_alunos} alunos)\n`;
    texto += `Disciplina: ${materia.disciplina_nome} — Prof(a): ${materia.professor_nome}\n`;
    texto += `Taxa Geral de Rendimento: ${materia.porcentagem_acerto}% acertos (${materia.porcentagem_erro}% erros em ${materia.total_respostas} respostas avaliadas)`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          setToastMensagem(`Pauta da matéria "${materia.disciplina_nome}" copiada com sucesso!`);
          setTimeout(() => setToastMensagem(null), 3500);
        })
        .catch(() => {
          setToastMensagem('Falha ao copiar pauta para a área de transferência.');
          setTimeout(() => setToastMensagem(null), 3500);
        });
    }
  };

  // Filtragem e ordenação das turmas
  const turmasProcessadas = useMemo(() => {
    let lista = turmas.map((t) => {
      let materias = t.materias.map((m) => {
        let conteudos = m.conteudos.map((c) => {
          let questoes = c.questoes;
          if (filtroTexto) {
            const query = filtroTexto.toLowerCase();
            questoes = questoes.filter(
              (q) =>
                q.enunciado.toLowerCase().includes(query) ||
                q.ordem.toString().includes(query)
            );
          }
          return { ...c, questoes };
        });

        if (filtroTexto) {
          const query = filtroTexto.toLowerCase();
          conteudos = conteudos.filter(
            (c) =>
              c.conteudo_nome.toLowerCase().includes(query) ||
              c.questoes.length > 0
          );
        }

        // Ordenação de conteúdos
        if (ordenacao === 'prioridade') {
          if (metrica === 'acerto') {
            conteudos.sort((a, b) => a.porcentagem_acerto - b.porcentagem_acerto);
          } else {
            conteudos.sort((a, b) => b.porcentagem_erro - a.porcentagem_erro);
          }
        } else {
          conteudos.sort((a, b) => a.conteudo_nome.localeCompare(b.conteudo_nome));
        }

        return { ...m, conteudos };
      });

      if (filtroTexto) {
        const query = filtroTexto.toLowerCase();
        materias = materias.filter(
          (m) =>
            m.disciplina_nome.toLowerCase().includes(query) ||
            m.professor_nome.toLowerCase().includes(query) ||
            m.conteudos.length > 0
        );
      }

      // Ordenação de matérias
      if (ordenacao === 'prioridade') {
        if (metrica === 'acerto') {
          materias.sort((a, b) => a.porcentagem_acerto - b.porcentagem_acerto);
        } else {
          materias.sort((a, b) => b.porcentagem_erro - a.porcentagem_erro);
        }
      } else {
        materias.sort((a, b) => a.disciplina_nome.localeCompare(b.disciplina_nome));
      }

      return { ...t, materias };
    });

    if (filtroTexto) {
      const query = filtroTexto.toLowerCase();
      lista = lista.filter(
        (t) =>
          t.turma_nome.toLowerCase().includes(query) ||
          t.turma_serie.toLowerCase().includes(query) ||
          t.materias.length > 0
      );
    }

    // Ordenação de turmas
    if (ordenacao === 'prioridade') {
      if (metrica === 'acerto') {
        // Turmas com menor acerto primeiro (para intervenção prioritária). Sem atividades (null) vão para o final.
        lista.sort((a, b) => {
          if (a.porcentagem_acerto_geral === null) return 1;
          if (b.porcentagem_acerto_geral === null) return -1;
          return a.porcentagem_acerto_geral - b.porcentagem_acerto_geral;
        });
      } else {
        lista.sort((a, b) => (b.porcentagem_erro_geral ?? -1) - (a.porcentagem_erro_geral ?? -1));
      }
    } else {
      lista.sort((a, b) => a.turma_nome.localeCompare(b.turma_nome));
    }

    return lista;
  }, [turmas, filtroTexto, ordenacao, metrica]);

  return (
    <div className="space-y-4">
      {/* Toast de Confirmação */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in-50 slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMensagem}</span>
        </div>
      )}

      {/* Barra de Controles e Ferramentas Pedagógicas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Campo de Busca Rápida */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por turma, matéria, conteúdo ou questão..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
          {filtroTexto && (
            <button
              onClick={() => setFiltroTexto('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Botões de Ação e Filtro */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Alternador de Métrica: % Acertos (padrão) vs % Erro */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setMetrica('acerto')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                metrica === 'acerto'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir porcentagem de acertos como métrica padrão"
            >
              <span>% Acertos</span>
            </button>
            <button
              onClick={() => setMetrica('erro')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                metrica === 'erro'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir porcentagem de erro"
            >
              <span>% Erro</span>
            </button>
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setOrdenacao('prioridade')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                ordenacao === 'prioridade'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={
                metrica === 'acerto'
                  ? 'Coloca turmas e matérias com menor acerto no topo para intervenção prioritária'
                  : 'Coloca turmas e matérias com mais erros no topo'
              }
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{metrica === 'acerto' ? 'Menor Acerto' : 'Maior Erro'}</span>
            </button>
            <button
              onClick={() => setOrdenacao('alfabetica')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                ordenacao === 'alfabetica'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A-Z
            </button>
          </div>

          {/* Botão Foco em Atenção */}
          <button
            onClick={focarEmAtencao}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            title={
              metrica === 'acerto'
                ? 'Abre automaticamente as turmas e conteúdos com taxa de acerto baixa (≤65%)'
                : 'Abre automaticamente as turmas e conteúdos com taxa de erro elevada (≥35%)'
            }
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Foco em</span> Atenção
          </button>

          {/* Botões Expandir / Recolher */}
          <div className="flex items-center gap-1">
            <button
              onClick={expandirTudo}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              title="Expandir todas as turmas e matérias"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={recolherTudo}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              title="Recolher tudo"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legenda do Semáforo Pedagógico */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500 px-2 flex-wrap">
        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
          Semáforo pedagógico ({metrica === 'acerto' ? '% Acertos' : '% Erro'}):
        </span>
        {metrica === 'acerto' ? (
          <>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Verde: Alto Rendimento (≥75%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Âmbar: Ponto de Atenção (55% a 74%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span>Vermelho: Gargalo Crítico (&lt;55%)</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Verde: Erro Baixo (&lt;25%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Âmbar: Ponto de Atenção (25% a 45%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span>Vermelho: Gargalo Crítico (&gt;45%)</span>
            </span>
          </>
        )}
      </div>

      {/* Árvore de Turmas (Nível 1) */}
      {turmasProcessadas.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
          <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700">Nenhum resultado encontrado.</p>
          <p className="text-xs text-slate-400 mt-1">
            Tente buscar com outro termo ou limpe os filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {turmasProcessadas.map((turma) => {
            const turmaAberta = turmasAbertas.has(turma.turma_id);

            return (
              <div
                key={turma.turma_id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                {/* Linha da Turma (Nível 1) */}
                <div
                  onClick={() => toggleTurma(turma.turma_id)}
                  className={`p-4 sm:px-5 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                    turmaAberta ? 'bg-indigo-50/30 border-b border-slate-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg text-slate-400 transition-transform duration-200 ${
                        turmaAberta ? 'rotate-90 text-indigo-600 bg-indigo-100' : 'bg-slate-100'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                      <GraduationCap className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                          {turma.turma_nome}
                        </h3>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline-block">
                          {turma.turma_serie}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          {turma.total_alunos} alunos
                        </span>
                        <span>•</span>
                        <span>{turma.total_materias_avaliadas} matérias avaliadas</span>
                      </p>
                    </div>
                  </div>

                  {/* Informações da Turma à Direita */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        {metrica === 'acerto' ? 'Média de Acertos da Turma' : 'Média de Erro da Turma'}
                      </span>
                      <div className="mt-0.5">
                        {renderBadge(turma.porcentagem_acerto_geral, turma.porcentagem_erro_geral)}
                      </div>
                    </div>

                    <div className="sm:hidden">
                      {renderBadge(turma.porcentagem_acerto_geral, turma.porcentagem_erro_geral, 'sm')}
                    </div>
                  </div>
                </div>

                {/* Subitens da Turma: Matérias (Nível 2) */}
                {turmaAberta && (
                  <div className="p-3 sm:p-5 bg-slate-50/50 space-y-3">
                    {turma.materias.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 text-xs">
                        Nenhuma matéria possui atividades cadastradas neste período.
                      </div>
                    ) : (
                      turma.materias.map((materia) => {
                        const keyMateria = `${turma.turma_id}-${materia.disciplina_id}`;
                        const materiaAberta = materiasAbertas.has(keyMateria);

                        return (
                          <div
                            key={materia.disciplina_id}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
                          >
                            {/* Linha da Matéria (Nível 2) */}
                            <div
                              onClick={() => toggleMateria(turma.turma_id, materia.disciplina_id)}
                              className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                                materiaAberta
                                  ? 'bg-indigo-50/40 border-b border-slate-200'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`p-1 rounded-md text-slate-400 transition-transform duration-200 ${
                                    materiaAberta ? 'rotate-90 text-indigo-600 bg-indigo-100' : 'bg-slate-100'
                                  }`}
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </div>

                                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  <BookOpen className="w-4 h-4" />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                                      {materia.disciplina_nome}
                                    </h4>
                                    {materia.aguardando_correcao && (
                                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        correções pendentes
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Prof(a). {materia.professor_nome} • {materia.conteudos.length} {materia.conteudos.length === 1 ? 'conteúdo' : 'conteúdos'}
                                  </p>
                                </div>
                              </div>

                              {/* Ações da Matéria: % Acerto/Erro da Matéria e Botão Copiar Pauta */}
                              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                <div className="text-right">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider hidden sm:block">
                                    {metrica === 'acerto' ? 'Geral de Acertos' : 'Geral de Erros'}
                                  </span>
                                  {renderBadge(
                                    materia.total_respostas > 0 ? materia.porcentagem_acerto : null,
                                    materia.total_respostas > 0 ? materia.porcentagem_erro : null
                                  )}
                                </div>

                                {/* Botão Copiar Pauta Pedagógica */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copiarPautaMateria(turma, materia);
                                  }}
                                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-colors flex items-center gap-1.5"
                                  title="Copiar pauta estruturada para reunião pedagógica com o professor"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Copiar Pauta</span>
                                </button>
                              </div>
                            </div>

                            {/* Subitens da Matéria: Conteúdos (Nível 3) */}
                            {materiaAberta && (
                              <div className="p-3 sm:p-4 bg-slate-50/70 space-y-2.5">
                                {materia.conteudos.length === 0 ? (
                                  <div className="p-4 text-center text-slate-400 text-xs bg-white rounded-lg border border-dashed border-slate-200">
                                    Nenhum conteúdo com respostas registradas nesta matéria.
                                  </div>
                                ) : (
                                  materia.conteudos.map((conteudo) => {
                                    const keyConteudo = `${turma.turma_id}-${materia.disciplina_id}-${conteudo.conteudo_id}`;
                                    const conteudoAberto = conteudosAbertos.has(keyConteudo);

                                    return (
                                      <div
                                        key={conteudo.conteudo_id}
                                        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
                                      >
                                        {/* Linha do Conteúdo (Nível 3) */}
                                        <div
                                          onClick={() =>
                                            toggleConteudo(
                                              turma.turma_id,
                                              materia.disciplina_id,
                                              conteudo.conteudo_id
                                            )
                                          }
                                          className={`p-3 sm:px-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                                            conteudoAberto
                                              ? 'bg-slate-100/70 border-b border-slate-200'
                                              : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div
                                              className={`p-1 rounded text-slate-400 transition-transform duration-200 ${
                                                conteudoAberto
                                                  ? 'rotate-90 text-indigo-600 bg-indigo-50'
                                                  : 'bg-slate-100'
                                              }`}
                                            >
                                              <ChevronRight className="w-3 h-3" />
                                            </div>

                                            <FolderTree className="w-4 h-4 text-indigo-500 shrink-0" />

                                            <div className="min-w-0">
                                              <h5 className="font-bold text-slate-800 text-xs sm:text-sm">
                                                {conteudo.conteudo_nome}
                                              </h5>
                                              <p className="text-[11px] text-slate-400">
                                                {conteudo.total_questoes} {conteudo.total_questoes === 1 ? 'questão' : 'questões'} • {conteudo.total_respostas} respostas
                                              </p>
                                            </div>
                                          </div>

                                          {/* % de Acerto/Erro do Conteúdo */}
                                          <div className="flex items-center gap-2 shrink-0">
                                            {renderBadge(
                                              conteudo.total_respostas > 0 ? conteudo.porcentagem_acerto : null,
                                              conteudo.total_respostas > 0 ? conteudo.porcentagem_erro : null,
                                              'sm'
                                            )}
                                          </div>
                                        </div>

                                        {/* Subitens do Conteúdo: Questões em Linha (Nível 4) */}
                                        {conteudoAberto && (
                                          <div className="p-3 sm:p-4 bg-slate-50/50 space-y-2">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                                              Questões do Conteúdo (clique para abrir o gabarito e alternativas):
                                            </div>

                                            {conteudo.questoes.map((questao) => {
                                              const keyQuestao = `${turma.turma_id}-${materia.disciplina_id}-${questao.questao_id}`;
                                              const questaoAberta = questoesAbertas.has(keyQuestao);

                                              return (
                                                <DesempenhoQuestaoLinha
                                                  key={questao.questao_id}
                                                  questao={questao}
                                                  aberta={questaoAberta}
                                                  onToggle={() =>
                                                    toggleQuestao(
                                                      turma.turma_id,
                                                      materia.disciplina_id,
                                                      questao.questao_id
                                                    )
                                                  }
                                                />
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
