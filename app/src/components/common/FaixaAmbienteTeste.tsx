import React from 'react';
import { MODO_TESTE } from '@/lib/ambiente';

export const FaixaAmbienteTeste: React.FC = () => {
  if (!MODO_TESTE) return null;
  return (
    <div
      role="status"
      className="w-full bg-amber-100 border-b border-amber-300 text-amber-900 text-[11px] font-bold tracking-wide text-center py-1 px-2"
    >
      AMBIENTE DE TESTE — dados fictícios
    </div>
  );
};
