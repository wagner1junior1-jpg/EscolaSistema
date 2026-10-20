import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { AvisoGravacao } from '@/components/common/AvisoGravacao';
import { FaixaAmbienteTeste } from '@/components/common/FaixaAmbienteTeste';
import { AppRoutes } from './routes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AvisoGravacao />
        <FaixaAmbienteTeste />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
