import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { LogIn, ArrowLeft, Shield } from 'lucide-react';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: 'radial-gradient(ellipse at 60% 0%, #eef2ff 0%, #f8fafc 60%)'}}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50/60 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
      </div>

      <div className="relative w-full max-w-md space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Início
        </Link>

        <Card className="shadow-xl shadow-indigo-100/50 border-slate-200/70">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center mb-4 shadow-lg shadow-indigo-300/40">
              <LogIn className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl">Acesso da Equipe Escolar</CardTitle>
            <CardDescription>
              Professores, coordenadores e diretores acessam aqui com e-mail e senha institucionais.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800 leading-relaxed">
                <span className="font-semibold">Módulo em desenvolvimento.</span> O login com autenticação Supabase estará disponível em breve.
              </p>
            </div>
            <p className="text-center text-xs text-slate-400">
              Acesso restrito à equipe pedagógica da escola.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
