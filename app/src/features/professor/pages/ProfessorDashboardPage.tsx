import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { GraduationCap, ArrowLeft, ClipboardCheck, BarChart2, Calendar } from 'lucide-react';

export const ProfessorDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen p-4 relative overflow-hidden" style={{background: 'radial-gradient(ellipse at 60% 0%, #f5f3ff 0%, #f8fafc 60%)'}}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      </div>

      <div className="relative max-w-2xl mx-auto pt-6 space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Início
        </Link>

        <div className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-300/40">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-slate-900">Portal do Professor</h1>
            <p className="text-xs text-slate-500">Turmas, atividades, chamada e diagnóstico pedagógico</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <ClipboardCheck className="w-5 h-5" />, label: 'Atividades', desc: 'Criar, publicar e encerrar exercícios', colorClass: 'bg-violet-100 text-violet-600' },
            { icon: <Calendar className="w-5 h-5" />, label: 'Frequência', desc: 'Chamada diária P / F / J', colorClass: 'bg-sky-100 text-sky-600' },
            { icon: <BarChart2 className="w-5 h-5" />, label: 'Diagnóstico', desc: 'Mapa de calor por questão', colorClass: 'bg-emerald-100 text-emerald-600' },
          ].map((item) => (
            <Card key={item.label} className="p-4 opacity-60">
              <div className={`w-9 h-9 rounded-xl ${item.colorClass} flex items-center justify-center mb-3`}>
                {item.icon}
              </div>
              <p className="font-heading font-semibold text-sm text-slate-800">{item.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
            </Card>
          ))}
        </div>

        <Card className="border-violet-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Portal em desenvolvimento</CardTitle>
            <CardDescription>
              Gerencie turmas, crie atividades com questões de múltipla escolha, registre a frequência diária e acompanhe o desempenho da turma em tempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-xs text-violet-800 leading-relaxed">
              🚧 Esta área está em construção. Em breve você terá acesso completo ao painel docente.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfessorDashboardPage;
