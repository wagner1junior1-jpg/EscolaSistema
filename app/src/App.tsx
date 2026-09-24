import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { AppRoutes } from './routes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
