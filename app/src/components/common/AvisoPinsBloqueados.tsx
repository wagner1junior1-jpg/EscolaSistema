import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { gestaoService } from '@/services';
import type { PinBloqueado } from '@/lib/types';

interface AvisoPinsBloqueadosProps {
  /** O que a equipe deve fazer (a gestão resolve na própria tela; o professor pede à secretaria). */
  orientacao: string;
  /** Mude o valor para recarregar a lista (ex.: depois de gerar PINs novos). */
  recarregar?: number;
  /** Se informado, cada aluno ganha um botão para abrir a turma dele. */
  onVerTurma?: (turmaId: string) => void;
  /** Recebe a lista carregada (ex.: para marcar os alunos na tabela). */
  onLista?: (lista: PinBloqueado[]) => void;
}

function descreverBloqueio(item: PinBloqueado): string {
  if (item.motivo === 'equipe' || !item.bloqueado_ate) return 'só entra com um PIN novo';
  const hora = new Date(item.bloqueado_ate).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `liberado às ${hora}`;
}

/** Aviso de alunos com PIN bloqueado por tentativas erradas (some quando não há nenhum). */
export const AvisoPinsBloqueados: React.FC<AvisoPinsBloqueadosProps> = ({
  orientacao,
  recarregar = 0,
  onVerTurma,
  onLista,
}) => {
  const [lista, setLista] = useState<PinBloqueado[]>([]);

  useEffect(() => {
    let ativo = true;
    gestaoService
      .listarPinsBloqueados()
      .then((itens) => {
        if (!ativo) return;
        setLista(itens);
        onLista?.(itens);
      })
      .catch((erro) => {
        // O aviso é complementar: se falhar, a tela segue normal e o erro fica no console.
        console.warn('Não foi possível consultar os PINs bloqueados.', erro);
      });
    return () => {
      ativo = false;
    };
    // onLista fica fora de propósito: recarregar só quando a tela pedir.
  }, [recarregar]);

  if (lista.length === 0) return null;

  return (
    <div
      role="status"
      className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm space-y-2"
    >
      <p className="font-semibold flex items-center gap-2">
        <Lock className="w-4 h-4 flex-shrink-0" />
        {lista.length === 1
          ? '1 aluno com o PIN bloqueado por tentativas erradas'
          : `${lista.length} alunos com o PIN bloqueado por tentativas erradas`}
      </p>
      <ul className="space-y-1 pl-6 list-disc">
        {lista.map((item) => (
          <li key={item.aluno_id}>
            <span className="font-medium">{item.nome_completo}</span> ({item.turma_nome}):{' '}
            {descreverBloqueio(item)}
            {onVerTurma && (
              <button
                type="button"
                onClick={() => onVerTurma(item.turma_id)}
                className="ml-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline"
              >
                Ver turma
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-800">{orientacao}</p>
    </div>
  );
};

export default AvisoPinsBloqueados;
