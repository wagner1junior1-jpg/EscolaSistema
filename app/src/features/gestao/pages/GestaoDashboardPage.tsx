import React from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Building2, Users, BookMarked, TrendingUp } from 'lucide-react';

export const GestaoDashboardPage: React.FC = () => {
  const { usuario } = useAuth();

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Boas-vindas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Olá, {usuario?.nome || 'Gestor(a)'}!
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-sans">
                Gestão Escolar &amp; Coordenação Pedagógica — Visão geral da escola, turmas, períodos e relatórios.
              </p>
            </div>
          </div>
        </div>

        {/* Recursos em desenvolvimento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2">
                <Users className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Turmas &amp; Alunos</CardTitle>
              <CardDescription>
                Gerenciamento de turmas, matrículas, geração e reset de PINs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                Módulo em breve
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                <BookMarked className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Disciplinas &amp; Ofertas</CardTitle>
              <CardDescription>
                Atribuição de professores a disciplinas por turma e períodos letivos.
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
                <TrendingUp className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Diagnóstico da Escola</CardTitle>
              <CardDescription>
                Desempenho consolidado por turma, alunos em atenção e questões críticas.
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

export default GestaoDashboardPage;
