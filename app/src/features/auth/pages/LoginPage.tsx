import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../AuthProvider';
import { useToast } from '@/components/ui';
import { LogIn, School, Mail, Lock, ArrowLeft, AlertCircle, Loader2, Sparkles } from 'lucide-react';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail institucional.')
    .email('Digite um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const usuariosDemo = [
  {
    nome: 'Diretora Helena Ramos',
    email: 'direcao@demo.com',
    papel: 'Direção',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    nome: 'Coord. Patrícia Silveira',
    email: 'coordenacao@demo.com',
    papel: 'Coordenação',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    nome: 'Profª Ana Paula',
    email: 'ana@demo.com',
    papel: 'Professor(a)',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    nome: 'Prof. Carlos Roberto',
    email: 'carlos@demo.com',
    papel: 'Professor(a)',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
];

export const LoginPage: React.FC = () => {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const isMock =
    !import.meta.env.VITE_DATA_SOURCE || import.meta.env.VITE_DATA_SOURCE === 'mock';

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      senha: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setErroGeral(null);
    try {
      const usuario = await entrar(data.email, data.senha);
      const destinoPadrao = usuario.papel === 'professor' ? '/professor' : '/gestao';
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      navigate(from || destinoPadrao, { replace: true });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Os dados foram atualizados em outra aba')) {
          toast.warning(err.message, 'Atenção');
          setErroGeral(err.message);
        } else {
          setErroGeral(err.message);
        }
      } else {
        setErroGeral('Erro ao tentar entrar no sistema. Tente novamente.');
      }
    }
  };

  const preencherDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('senha', 'demo123', { shouldValidate: true });
    clearErrors();
    setErroGeral(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Link para voltar ao Início */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao início</span>
        </Link>

        {/* Cabeçalho do Card */}
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <School className="w-8 h-8" />
          </div>
          <h1 className="mt-4 font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
            Acesso da Equipe Escolar
          </h1>
          <p className="mt-2 text-sm text-slate-600 font-sans">
            Entre com seu e-mail e senha para acessar o portal
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/90 rounded-2xl sm:px-10 space-y-6">
          {/* Mensagem de Erro Geral */}
          {erroGeral && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-900 text-xs sm:text-sm leading-relaxed"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{erroGeral}</span>
            </div>
          )}

          {/* Formulário com react-hook-form + zod */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs sm:text-sm font-heading font-bold text-slate-700 mb-1.5"
              >
                E-mail institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="exemplo@demo.com"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`block w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    errors.email
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-indigo-600'
                  }`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-rose-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="senha"
                className="block text-xs sm:text-sm font-heading font-bold text-slate-700 mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={errors.senha ? 'true' : 'false'}
                  aria-describedby={errors.senha ? 'senha-error' : undefined}
                  className={`block w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    errors.senha
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-indigo-600'
                  }`}
                  {...register('senha')}
                />
              </div>
              {errors.senha && (
                <p id="senha-error" className="mt-1.5 text-xs text-rose-600 font-medium">
                  {errors.senha.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-heading font-bold text-base transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>

          {/* Caixa de Usuários de Demonstração (apenas no modo mock) */}
          {isMock && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-slate-700">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Usuários de demonstração (senha: demo123)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Clique em um usuário para preencher os dados automaticamente:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {usuariosDemo.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => preencherDemo(u.email)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-left transition-all group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 truncate">
                        {u.nome}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${u.badge}`}
                      >
                        {u.papel}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                      {u.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
