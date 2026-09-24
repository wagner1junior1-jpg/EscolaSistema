import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import {
  Users,
  BookMarked,
  GraduationCap,
  Key,
  Calendar,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface GestaoInicioSecaoProps {
  onNavegar: (secao: string) => void;
  isDirecao: boolean;
}

export const GestaoInicioSecao: React.FC<GestaoInicioSecaoProps> = ({
  onNavegar,
  isDirecao,
}) => {
  const atalhos = [
    {
      id: 'turmas',
      titulo: 'Turmas & Ofertas',
      descricao: 'Gerencie turmas, códigos de acesso e atribuições de disciplinas e professores.',
      icon: <Users className="w-5 h-5 text-indigo-600" />,
      cor: 'bg-indigo-50 border-indigo-100',
    },
    {
      id: 'disciplinas',
      titulo: 'Disciplinas',
      descricao: 'Cadastre a grade curricular da escola e organize as matérias ofertadas.',
      icon: <BookMarked className="w-5 h-5 text-sky-600" />,
      cor: 'bg-sky-50 border-sky-100',
    },
    {
      id: 'professores',
      titulo: 'Professores',
      descricao: 'Convide docentes por e-mail e gerencie os acessos pedagógicos da equipe.',
      icon: <GraduationCap className="w-5 h-5 text-violet-600" />,
      cor: 'bg-violet-50 border-violet-100',
    },
    {
      id: 'alunos',
      titulo: 'Alunos & PINs',
      descricao: 'Cadastre estudantes em lote, gere novos PINs de acesso e imprima filipetas.',
      icon: <Key className="w-5 h-5 text-emerald-600" />,
      cor: 'bg-emerald-50 border-emerald-100',
    },
    ...(isDirecao
      ? [
          {
            id: 'bimestres',
            titulo: 'Bimestres & Períodos',
            descricao: 'Controle o calendário letivo e defina qual bimestre está ativo para a escola.',
            icon: <Calendar className="w-5 h-5 text-amber-600" />,
            cor: 'bg-amber-50 border-amber-100',
          },
          {
            id: 'escola',
            titulo: 'Dados da Escola',
            descricao: 'Edite o nome da instituição, cidade/UF e o ano letivo corrente.',
            icon: <Building2 className="w-5 h-5 text-slate-600" />,
            cor: 'bg-slate-100 border-slate-200',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
          Painel de Gestão Escolar
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Selecione uma área abaixo para gerenciar a estrutura da sua escola.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {atalhos.map((item) => (
          <Card
            key={item.id}
            hover
            onClick={() => onNavegar(item.id)}
            className="cursor-pointer border-slate-200 hover:border-indigo-300 group flex flex-col justify-between"
          >
            <CardHeader className="pb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 border ${item.cor}`}
              >
                {item.icon}
              </div>
              <CardTitle className="text-base group-hover:text-indigo-600 transition-colors">
                {item.titulo}
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                {item.descricao}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                <span>Acessar módulo</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
