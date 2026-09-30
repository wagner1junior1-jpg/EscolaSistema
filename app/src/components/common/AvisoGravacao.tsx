import React, { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { EVENTO_ERRO_GRAVACAO } from '@/services/mock/db';

const INTERVALO_AVISO_MS = 30_000;

export const AvisoGravacao: React.FC = () => {
  const toast = useToast();
  const ultimoAvisoRef = useRef<number>(0);

  useEffect(() => {
    const handleErroGravacao = () => {
      const agora = Date.now();
      if (agora - ultimoAvisoRef.current >= INTERVALO_AVISO_MS) {
        ultimoAvisoRef.current = agora;
        toast.error(
          'O espaço do navegador acabou. Suas últimas alterações podem ser perdidas ao recarregar a página. Avise a coordenação.',
          'Não foi possível salvar neste aparelho'
        );
      }
    };

    window.addEventListener(EVENTO_ERRO_GRAVACAO, handleErroGravacao);
    return () => {
      window.removeEventListener(EVENTO_ERRO_GRAVACAO, handleErroGravacao);
    };
  }, [toast]);

  return null;
};

export default AvisoGravacao;
