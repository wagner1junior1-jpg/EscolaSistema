import React from 'react';
import {
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  FileQuestion,
  Info,
} from 'lucide-react';
import { DesempenhoQuestaoItem } from '@/lib/types';
import { MathText } from '@/components/ui/MathText';

interface DesempenhoQuestaoLinhaProps {
  questao: DesempenhoQuestaoItem;
  aberta: boolean;
  onToggle: () => void;
}

export const DesempenhoQuestaoLinha: React.FC<DesempenhoQuestaoLinhaProps> = ({
  questao,
  aberta,
  onToggle,
}) => {
  const isCritica = questao.total_respostas >= 5 && questao.porcentagem_acerto < 50;

  // Badge de acerto da questão
  const getBadgeAcerto = (pct: number, total: number) => {
    if (total === 0) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          Sem respostas
        </span>
      );
    }
    if (pct >= 75) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {pct.toString().replace('.', ',')}% acerto
        </span>
      );
    }
    if (pct >= 50) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
          {pct.toString().replace('.', ',')}% acerto
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        {pct.toString().replace('.', ',')}% acerto
      </span>
    );
  };

  return (
    <div
      className={`border rounded-xl transition-all duration-200 overflow-hidden ${
        aberta
          ? 'border-indigo-300 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-200'
          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/60'
      }`}
    >
      {/* Linha Principal da Questão (clicável) */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3.5 sm:px-4 flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
        aria-expanded={aberta}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* Identificador / Ordem */}
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold shrink-0">
            #{questao.ordem}
          </span>

          {/* Chip de Tipo */}
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
              questao.tipo === 'discursiva'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {questao.tipo === 'discursiva' ? 'Discursiva' : 'Objetiva'}
          </span>

          {/* Enunciado Resumido em Linha */}
          <div className="truncate text-xs sm:text-sm text-slate-700 font-medium min-w-0 flex-1">
            <span className="truncate block">
              {questao.enunciado.replace(/\n+/g, ' ')}
            </span>
          </div>
        </div>

        {/* Informações da Direita: Total de Respostas, % de Acerto e Seta */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
            {questao.total_respostas} {questao.total_respostas === 1 ? 'resposta' : 'respostas'}
          </span>

          {getBadgeAcerto(questao.porcentagem_acerto, questao.total_respostas)}

          <div
            className={`p-1 rounded-md text-slate-400 hover:text-slate-700 transition-transform duration-200 ${
              aberta ? 'rotate-180 text-indigo-600' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Conteúdo Aberto da Questão */}
      {aberta && (
        <div className="border-t border-slate-200 bg-white p-4 sm:p-5 space-y-4 text-sm animate-in fade-in-50 duration-200">
          {/* Alerta de Questão Crítica */}
          {isCritica && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atenção: Questão Crítica na Turma</p>
                <p className="text-rose-700 mt-0.5">
                  Mais de 50% dos alunos erraram esta questão ({questao.porcentagem_erro.toString().replace('.', ',')}% de erro em {questao.total_respostas} respostas).
                </p>
              </div>
            </div>
          )}

          {/* Enunciado Completo */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <FileQuestion className="w-3.5 h-3.5 text-slate-500" />
              Enunciado Completo
            </h4>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-sans">
              <MathText text={questao.enunciado} className="whitespace-pre-line" />
            </div>
          </div>

          {/* Imagem anexada à questão, se houver */}
          {questao.imagem_url && (
            <div className="mt-2">
              <img
                src={questao.imagem_url}
                alt="Ilustração da questão"
                className="max-h-64 rounded-xl border border-slate-200 object-contain shadow-xs bg-slate-50"
              />
            </div>
          )}

          {/* Diagnóstico do Erro Mais Frequente (Distrator mais votado) */}
          {questao.distrator_mais_escolhido && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Erro mais comum na turma: Alternativa {questao.distrator_mais_escolhido.letra} ({questao.distrator_mais_escolhido.porcentagem_escolhas}% dos alunos — {questao.distrator_mais_escolhido.total_escolhas} votos)
                </span>
              </div>
              {questao.distrator_mais_escolhido.por_que_errou && (
                <p className="text-xs text-amber-800 pl-6">
                  <strong>Diagnóstico pedagógico:</strong> {questao.distrator_mais_escolhido.por_que_errou}
                </p>
              )}
            </div>
          )}

          {/* Alternativas (Objetiva) */}
          {questao.alternativas && questao.alternativas.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Alternativas e Distribuição de Respostas dos Alunos
              </h4>
              <div className="space-y-2">
                {questao.alternativas.map((alt) => {
                  const isMaisVotadoDistrator =
                    !alt.correta &&
                    questao.distrator_mais_escolhido?.letra === alt.letra;

                  return (
                    <div
                      key={alt.id || alt.letra}
                      className={`p-3 rounded-xl border text-xs sm:text-sm transition-all ${
                        alt.correta
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
                          : isMaisVotadoDistrator
                          ? 'border-amber-300 bg-amber-50/40 text-slate-800'
                          : 'border-slate-200 bg-slate-50/50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center shrink-0 text-xs ${
                              alt.correta
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : isMaisVotadoDistrator
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {alt.letra}
                          </span>

                          <div className="space-y-1 flex-1 min-w-0 pt-0.5">
                            <div className="font-medium">
                              <MathText text={alt.texto} />
                              {alt.correta && (
                                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Gabarito Correto
                                </span>
                              )}
                            </div>

                            {/* Justificativa pedagógica de erro */}
                            {alt.por_que_errou && (
                              <p className="text-xs text-rose-700 italic">
                                Por que não é essa: {alt.por_que_errou}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Estatística de Escolha dos Alunos */}
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs">
                            {alt.porcentagem_escolhas}%
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {alt.total_escolhas} {alt.total_escolhas === 1 ? 'voto' : 'votos'}
                          </span>
                        </div>
                      </div>

                      {/* Mini barra de progresso da alternativa */}
                      <div className="mt-2 h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${alt.porcentagem_escolhas}%` }}
                          className={`h-full rounded-full transition-all ${
                            alt.correta ? 'bg-emerald-500' : isMaisVotadoDistrator ? 'bg-amber-500' : 'bg-slate-400'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detalhes para Discursiva */}
          {questao.tipo === 'discursiva' && (
            <div className="space-y-3">
              {questao.resposta_esperada && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Resposta Esperada (Gabarito do Professor)
                  </span>
                  <p className="text-emerald-900 leading-relaxed">
                    {questao.resposta_esperada}
                  </p>
                </div>
              )}

              {questao.distribuicao_discursiva && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                  <span className="font-bold text-slate-700 block">
                    Distribuição das Correções na Turma:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <span className="text-[10px] uppercase font-bold block">Certo (1,0)</span>
                      <strong className="text-base">{questao.distribuicao_discursiva.certo}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-800">
                      <span className="text-[10px] uppercase font-bold block">Parcial (0,5)</span>
                      <strong className="text-base">{questao.distribuicao_discursiva.parcial}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                      <span className="text-[10px] uppercase font-bold block">Errado (0,0)</span>
                      <strong className="text-base">{questao.distribuicao_discursiva.errado}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                      <span className="text-[10px] uppercase font-bold block">Pendentes</span>
                      <strong className="text-base">{questao.distribuicao_discursiva.pendente}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dica e Explicação */}
          {(questao.dica || questao.explicacao) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {questao.dica && (
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    Dica Disponível
                  </span>
                  <p className="text-amber-800/90">{questao.dica}</p>
                </div>
              )}

              {questao.explicacao && (
                <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200/80 text-xs text-sky-900 space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-sky-800">
                    <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                    Explicação Pedagógica
                  </span>
                  <p className="text-sky-800/90">{questao.explicacao}</p>
                </div>
              )}
            </div>
          )}

          {/* Rodapé com Atividade de Origem */}
          {questao.atividade_titulo && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                Atividade de origem: <strong>{questao.atividade_titulo}</strong>
              </span>
              {questao.modo_atividade && (
                <span className="capitalize font-medium">Modo {questao.modo_atividade}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
