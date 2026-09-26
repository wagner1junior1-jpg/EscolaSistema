import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { School, LogOut, User, Sparkles, ChevronDown } from 'lucide-react';
import { PapelUsuario } from '@/lib/types';
import { alunoService } from '@/services';

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
  const { usuario, entrar, sair } = useAuth();
  const navigate = useNavigate();
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);

  const handleSair = async () => {
    try {
      await sair();
      navigate('/entrar', { replace: true });
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const handleTrocarPerfilDemo = async (tipo: 'equipe' | 'aluno', emailOuId: string) => {
    setMenuPerfilAberto(false);
    try {
      if (tipo === 'aluno') {
        const { token } = await alunoService.login('aluno-7a-1', '1420');
        localStorage.setItem('saberpontual_aluno_token', token);
        navigate('/aluno/painel');
      } else {
        const novoUser = await entrar(emailOuId, 'demo123');
        navigate(novoUser.papel === 'professor' ? '/professor' : '/gestao');
      }
    } catch (err) {
      console.error('Erro ao trocar perfil demo:', err);
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

          {/* Dados do Usuário, Troca Rápida Demo e Botão Sair */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Botão Seletor Rápido de Perfil (Modo Demo) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuPerfilAberto((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
                title="Alternar rapidamente entre perfis de demonstração"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden md:inline">Trocar Perfil</span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
              </button>

              {menuPerfilAberto && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg py-2 z-50 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    Alternar Acesso (1-Clique)
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTrocarPerfilDemo('equipe', 'ana@demo.com')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-800">Profª Ana Paula</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
                      Professor(a)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrocarPerfilDemo('equipe', 'carlos@demo.com')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-800">Prof. Carlos Roberto</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
                      Professor(a)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrocarPerfilDemo('equipe', 'direcao@demo.com')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-800">Diretora Helena</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                      Direção
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrocarPerfilDemo('equipe', 'coordenacao@demo.com')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-800">Coord. Patrícia</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      Coordenação
                    </span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => handleTrocarPerfilDemo('aluno', 'aluno-7a-1')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-emerald-900">Aluno Lucas Oliveira</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      6º Ano A
                    </span>
                  </button>
                </div>
              )}
            </div>

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
