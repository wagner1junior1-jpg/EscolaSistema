import React, { useEffect, useState } from 'react';
import {
  assinarStatusSincronizacao,
  obterStatusSincronizacao,
  forcarSincronizacao,
  InfoSincronizacao,
} from '@/services';
import { CloudOff, RefreshCw } from 'lucide-react';

interface IndicadorSincronizacaoProps {
  variante?: 'padrao' | 'compacto' | 'aluno';
  className?: string;
}

export const IndicadorSincronizacao: React.FC<IndicadorSincronizacaoProps> = ({
  variante = 'padrao',
  className = '',
}) => {
  const [info, setInfo] = useState<InfoSincronizacao>(() => obterStatusSincronizacao());
  const [sincronizandoManual, setSincronizandoManual] = useState(false);

  useEffect(() => {
    const desassinar = assinarStatusSincronizacao((novoStatus) => {
      setInfo(novoStatus);
    });
    return () => {
      desassinar();
    };
  }, []);

  const handleForcarSincronizacao = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSincronizandoManual(true);
      await forcarSincronizacao();
    } catch (err) {
      console.error('Erro na sincronização manual:', err);
    } finally {
      setTimeout(() => {
        setSincronizandoManual(false);
      }, 500);
    }
  };

  const horaFormatada = info.ultimaSincronizacao
    ? info.ultimaSincronizacao.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const isCarregando = info.status === 'sincronizando' || sincronizandoManual;

  if (variante === 'aluno') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
          info.status === 'conectado'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : isCarregando
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        } ${className}`}
        title={horaFormatada ? `Sincronizado às ${horaFormatada}` : 'Status de sincronização'}
      >
        {isCarregando ? (
          <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
        ) : info.status === 'conectado' ? (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        ) : (
          <CloudOff className="w-3 h-3 text-amber-500" />
        )}
        <span>
          {isCarregando
            ? 'Sincronizando...'
            : info.status === 'conectado'
            ? 'Nuvem Conectada'
            : 'Salvo neste aparelho'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs border transition-all ${
        info.status === 'conectado'
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
          : isCarregando
          ? 'bg-indigo-50/80 border-indigo-200 text-indigo-800'
          : 'bg-slate-50 border-slate-200 text-slate-600'
      } ${className}`}
      title={
        info.origem === 'supabase'
          ? `Banco Supabase ativo${horaFormatada ? ` • Última atualização: ${horaFormatada}` : ''}`
          : 'Armazenamento local'
      }
    >
      <div className="flex items-center gap-1.5">
        {isCarregando ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
        ) : info.status === 'conectado' ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        ) : (
          <CloudOff className="w-3.5 h-3.5 text-slate-400" />
        )}

        <span className="font-medium hidden sm:inline">
          {isCarregando
            ? 'Sincronizando...'
            : info.status === 'conectado'
            ? 'Sincronizado com o BD'
            : 'Salvo neste aparelho'}
        </span>

        {horaFormatada && !isCarregando && (
          <span className="text-[10px] text-emerald-600/80 font-mono hidden md:inline">
            ({horaFormatada})
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleForcarSincronizacao}
        disabled={isCarregando}
        className="p-1 -mr-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
        title="Atualizar dados do banco agora"
      >
        <RefreshCw className={`w-3 h-3 ${isCarregando ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
