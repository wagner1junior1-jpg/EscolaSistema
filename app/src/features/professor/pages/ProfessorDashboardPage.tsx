import React from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { GraduationCap, ClipboardCheck, BarChart2, BookOpen } from 'lucide-react';

export const ProfessorDashboardPage: React.FC = () => {
  const { usuario } = useAuth();

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Boas-vindas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-200 shrink-0">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Olá, {usuario?.nome || 'Professor(a)'}!
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-sans">
                Portal do Professor — Planeje atividades, avalie turmas e acompanhe o diagnóstico pedagógico.
              </p>
            </div>
          </div>
        </div>

        {/* Recursos em desenvolvimento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Minhas Ofertas</CardTitle>
              <CardDescription>
                Turmas e disciplinas atribuídas a você no período letivo atual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100">
                Módulo em breve
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Atividades &amp; Provas</CardTitle>
              <CardDescription>
                Criação de exercícios diagnósticos, publicação e encerramento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                Módulo em breve
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <BarChart2 className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Mapa de Calor &amp; Média</CardTitle>
              <CardDescription>
                Diagnóstico de questões críticas e acompanhamento individual de alunos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                Módulo em breve
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default ProfessorDashboardPage;
