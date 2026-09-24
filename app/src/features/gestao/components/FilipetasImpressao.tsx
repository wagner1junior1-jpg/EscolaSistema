import React from 'react';
import { AlunoPublico } from '@/lib/types';
import { Scissors } from 'lucide-react';

export interface PinGeradoItem {
  aluno: AlunoPublico;
  pin_puro: string;
}

interface FilipetasImpressaoProps {
  itens: PinGeradoItem[];
  escolaNome: string;
  turmaNome: string;
  turmaCodigo: string;
}

export const FilipetasImpressao: React.FC<FilipetasImpressaoProps> = ({
  itens,
  escolaNome,
  turmaNome,
  turmaCodigo,
}) => {
  return (
    <div className="hidden print:block print:w-full print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          header, aside, [role="dialog"], [aria-modal="true"] {
            display: none !important;
          }
        }
      `}</style>

      {/* Grid de 2 colunas x 4 linhas = 8 filipetas por folha A4 */}
      <div className="grid grid-cols-2 gap-3">
        {itens.map((item, idx) => (
          <div
            key={item.aluno.id || idx}
            className="border-2 border-dashed border-slate-400 p-4 rounded-xl flex flex-col justify-between break-inside-avoid relative bg-white"
            style={{ minHeight: '62mm', height: '64mm' }}
          >
            {/* Ícone de tesoura para recorte */}
            <div className="absolute -top-2.5 right-4 bg-white px-1.5 text-slate-500 flex items-center gap-1 text-[10px] font-mono">
              <Scissors className="w-3 h-3 rotate-90" />
              <span>recorte aqui</span>
            </div>

            {/* Cabeçalho da Filipeta */}
            <div className="border-b border-slate-200 pb-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="truncate max-w-[150px]">{escolaNome}</span>
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                  {turmaNome}
                </span>
              </div>
            </div>

            {/* Dados do Aluno e PIN */}
            <div className="py-2 space-y-1.5 text-center">
              <div className="text-xs font-semibold text-slate-500">
                Chamada #{item.aluno.numero_chamada}
              </div>
              <div className="font-heading font-black text-base text-slate-900 leading-tight truncate">
                {item.aluno.nome_completo}
              </div>

              {/* Destaque do PIN e Código da Turma */}
              <div className="flex items-center justify-center gap-3 pt-1">
                <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-left">
                  <div className="text-[9px] uppercase font-bold text-slate-400">Turma</div>
                  <div className="font-mono font-black text-xs text-indigo-700">
                    {turmaCodigo}
                  </div>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-400 px-3.5 py-1 rounded-lg text-center">
                  <div className="text-[9px] uppercase font-bold text-indigo-700">Seu PIN</div>
                  <div className="font-mono font-black text-lg tracking-widest text-indigo-950">
                    {item.pin_puro}
                  </div>
                </div>
              </div>
            </div>

            {/* Instruções de Acesso */}
            <div className="border-t border-slate-200 pt-1.5 text-[9px] text-slate-500 leading-snug text-center">
              Acesse o site, digite o código da turma, escolha seu nome e digite o PIN.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
