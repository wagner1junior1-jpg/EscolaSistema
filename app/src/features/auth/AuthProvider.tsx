import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Perfil, PapelUsuario } from '@/lib/types';
import { authService } from '@/services';
import { ShieldAlert, ArrowLeft, LogOut, Loader2 } from 'lucide-react';

interface AuthContextType {
  usuario: Perfil | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<Perfil>;
  sair: () => Promise<void>;
  alterarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let montado = true;
    async function checarUsuario() {
      try {
        const u = await authService.usuarioAtual();
        if (montado) {
          setUsuario(u);
        }
      } catch (err) {
        console.error('Erro ao verificar sessão do usuário:', err);
        if (montado) {
          setUsuario(null);
        }
      } finally {
        if (montado) {
          setCarregando(false);
        }
      }
    }

    checarUsuario();
    return () => {
      montado = false;
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string): Promise<Perfil> => {
    const user = await authService.login(email, senha);
    setUsuario(user);
    return user;
  }, []);

  const sair = useCallback(async (): Promise<void> => {
    await authService.logout();
    setUsuario(null);
  }, []);

  const alterarSenha = useCallback(async (senhaAtual: string, novaSenha: string): Promise<void> => {
    await authService.alterarSenha(senhaAtual, novaSenha);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, sair, alterarSenha }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};

interface RotaProtegidaProps {
  papeis?: PapelUsuario[];
  children: React.ReactNode;
}

export const RotaProtegida: React.FC<RotaProtegidaProps> = ({ papeis, children }) => {
  const { usuario, carregando, sair } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (carregando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Carregando permissões...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/entrar" state={{ from: location }} replace />;
  }

  if (papeis && papeis.length > 0 && !papeis.includes(usuario.papel)) {
    const destinoSugerido = usuario.papel === 'professor' ? '/professor' : '/gestao';

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading font-bold text-xl text-slate-900">
              Sem permissão de acesso
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Você está autenticado como <strong>{usuario.nome}</strong> ({usuario.papel}),
              mas não tem permissão para visualizar esta página.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => navigate(destinoSugerido, { replace: true })}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Ir para minha área ({usuario.papel === 'professor' ? 'Portal Docente' : 'Gestão'})
            </button>

            <button
              type="button"
              onClick={async () => {
                await sair();
                navigate('/entrar', { replace: true });
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
