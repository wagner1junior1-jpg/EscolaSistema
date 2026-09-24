import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Building2, ArrowLeft, Users, BookMarked, TrendingUp } from 'lucide-react';

export const GestaoDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen p-4 relative overflow-hidden" style={{background: 'radial-gradient(ellipse at 50% 0%, #f0f9ff 0%, #f8fafc 60%)'}}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-sky-100/30 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3" />
      </div>

      <div className="relative max-w-2xl mx-auto pt-6 space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Início
        </Link>

        <div className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center shadow-lg shadow-sky-300/40">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-slate-900">Gestão Escolar</h1>
            <p className="text-xs text-slate-500">Coordenação pedagógica, turmas, períodos e desempenho escolar</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Users className="w-5 h-5" />, label: 'Turmas & Alunos', desc: 'Cadastro, PIN e filipetas', colorClass: 'bg-sky-100 text-sky-600' },
            { icon: <BookMarked className="w-5 h-5" />, label: 'Disciplinas', desc: 'Ofertas e professores', colorClass: 'bg-indigo-100 text-indigo-600' },
            { icon: <TrendingUp className="w-5 h-5" />, label: 'Desempenho', desc: 'Acompanhamento pedagógico das turmas', colorClass: 'bg-emerald-100 text-emerald-600' },
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

        <Card className="border-sky-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gestão em desenvolvimento</CardTitle>
            <CardDescription>
              Configure a escola, períodos letivos, disciplinas e turmas. Gerencie professores, acompanhe o desempenho das turmas e exporte relatórios.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-xs text-sky-800 leading-relaxed">
              🚧 Painel administrativo em construção. Em breve disponível para direção e coordenação.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GestaoDashboardPage;
