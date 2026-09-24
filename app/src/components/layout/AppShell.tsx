import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { School, LogOut, User } from 'lucide-react';
import { PapelUsuario } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
}

const papelRotulo: Record<PapelUsuario, string> = {
  direcao: 'Direção',
  coordenacao: 'Coordenação',
  professor: 'Professor(a)',
};

const papelCor: Record<PapelUsuario, string> = {
  direcao: 'bg-sky-50 text-sky-700 border-sky-200',
  coordenacao: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  professor: 'bg-violet-50 text-violet-700 border-violet-200',
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();

  const handleSair = async () => {
    try {
      await sair();
      navigate('/entrar', { replace: true });
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const papelTexto = usuario ? papelRotulo[usuario.papel] : '';
  const papelEstilo = usuario ? papelCor[usuario.papel] : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Cabeçalho superior com visual sóbrio */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo e Nome da Plataforma */}
          <Link
            to={usuario?.papel === 'professor' ? '/professor' : '/gestao'}
            className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <School className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-base tracking-tight text-slate-900 leading-tight">
                SaberPontual
              </span>
              <span className="text-[10px] text-slate-400 font-medium leading-none hidden sm:inline">
                Área Administrativa &amp; Docente
              </span>
            </div>
          </Link>

          {/* Dados do Usuário e Botão Sair */}
          <div className="flex items-center gap-3 sm:gap-4">
            {usuario && (
              <div className="flex items-center gap-2.5 text-right">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-semibold text-slate-800 leading-snug">
                    {usuario.nome}
                  </span>
                  <span
                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${papelEstilo}`}
                  >
                    {papelTexto}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 sm:hidden">
                  <User className="w-4 h-4" />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSair}
              aria-label="Sair da conta"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Área de conteúdo principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 print:p-0 print:max-w-none print:m-0">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
