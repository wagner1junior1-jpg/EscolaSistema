import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { KeyRound, ArrowLeft, Zap } from 'lucide-react';

export const AlunoLoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{background: 'radial-gradient(ellipse at 40% 0%, #ecfdf5 0%, #f8fafc 60%)'}}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-100/40 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-50/60 rounded-full blur-2xl translate-y-1/2 translate-x-1/4" />
      </div>

      <div className="relative w-full max-w-md space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Início
        </Link>

        <Card className="shadow-xl shadow-emerald-100/50 border-slate-200/70">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-300/40">
              <KeyRound className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl">Acesso do Aluno</CardTitle>
            <CardDescription>
              Entre com o código da sua turma e o PIN de 4 dígitos fornecido pelo professor.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
              <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800 leading-relaxed">
                <span className="font-semibold">Portal em desenvolvimento.</span> Em breve você acessa suas atividades, avisos da turma e o Espaço dos Pais.
              </p>
            </div>
            <Link
              to="/aluno/painel"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 py-2 transition-colors"
            >
              Ver painel do aluno →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AlunoLoginPage;
