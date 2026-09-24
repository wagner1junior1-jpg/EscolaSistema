import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { BookOpen, ArrowLeft, ClipboardList, Bell, Users } from 'lucide-react';

export const AlunoPainelPage: React.FC = () => {
  return (
    <div className="min-h-screen p-4 relative overflow-hidden" style={{background: 'radial-gradient(ellipse at 50% 0%, #fffbeb 0%, #f8fafc 50%)'}}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      </div>

      <div className="relative max-w-2xl mx-auto pt-6 space-y-4">
        <Link
          to="/aluno"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login do aluno
        </Link>

        <div className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-300/40">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-slate-900">Painel do Aluno</h1>
            <p className="text-xs text-slate-500">Suas atividades, avisos e desempenho em um só lugar</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <ClipboardList className="w-5 h-5" />, label: 'Atividades', desc: 'Exercícios e provas pendentes', colorClass: 'bg-amber-100 text-amber-600' },
            { icon: <Bell className="w-5 h-5" />, label: 'Avisos', desc: 'Recados da turma e da escola', colorClass: 'bg-sky-100 text-sky-600' },
            { icon: <Users className="w-5 h-5" />, label: 'Meu Desempenho', desc: 'Aproveitamento e atividades concluídas', colorClass: 'bg-violet-100 text-violet-600' },
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

        <Card className="border-amber-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Portal em desenvolvimento</CardTitle>
            <CardDescription>
              O painel completo com atividades, feedback por questão, avisos e acompanhamento de desempenho estará disponível em breve.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 leading-relaxed">
              🚧 Esta área está sendo construída. Em breve você poderá responder exercícios e acompanhar seu desempenho aqui.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AlunoPainelPage;
