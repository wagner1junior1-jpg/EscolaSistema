import React from 'react';
import { ModalAlterarSenha } from './ModalAlterarSenha';

/** Tela que bloqueia a área da equipe até o usuário trocar a senha provisória. */
export const TrocaSenhaObrigatoria: React.FC = () => (
  <div className="min-h-screen bg-slate-50">
    <ModalAlterarSenha isOpen obrigatorio onClose={() => undefined} />
  </div>
);

export default TrocaSenhaObrigatoria;
