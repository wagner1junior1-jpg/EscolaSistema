import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import {
  Users,
  BookMarked,
  GraduationCap,
  Key,
  Calendar,
  Building2,
  ArrowRight,
  TrendingUp,
  FileText,
  Loader2,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { relatorioService, assinarMudancas } from '@/services';
import { VisaoGeralEscola } from '@/lib/types';
import { formatarPercentual, pluralizar } from '@/lib/formatar';

interface GestaoInicioSecaoProps {
  onNavegar: (secao: string) => void;
  isDirecao: boolean;
}

export const GestaoInicioSecao: React.FC<GestaoInicioSecaoProps> = ({
  onNavegar,
  isDirecao,
}) => {
  const [visaoGeral, setVisaoGeral] = useState<VisaoGeralEscola | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      try {
        setCarregando(true);
        setErro(null);
        const dados = await relatorioService.visaoGeralEscola();
        if (ativo) {
          setVisaoGeral(dados);
        }
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar visão geral.');
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarDados();

    const desassinar = assinarMudancas(() => {
      if (ativo) {
        carregarDados();
      }
    });

    return () => {
      ativo = false;
      desassinar();
    };
  }, []);

  const atalhos = [
    {
      id: 'conselho',
      titulo: 'Conselho de Professores & Pautas',
      descricao: 'Pautas estruturadas, diagnósticos por turma e roteiro pedagógico para reuniões.',
      icon: <ClipboardList className="w-5 h-5 text-indigo-600" />,
      cor: 'bg-indigo-50 border-indigo-100',
    },
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
    <div className="space-y-8">
      {/* Topo / Boas-vindas */}
      <div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Visão consolidada da escola e atalhos rápidos para gerenciamento.
        </p>
      </div>

      {/* Cartões de Visão Geral (visaoGeralEscola) */}
      {carregando ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Carregando indicadores da escola...</span>
        </div>
      ) : erro ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      ) : visaoGeral ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card Alunos */}
          <Card className="p-4 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Alunos
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900">
                {visaoGeral.total_alunos}
              </div>
            </div>
          </Card>

          {/* Card Turmas */}
          <Card className="p-4 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Turmas
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900">
                {visaoGeral.total_turmas}
              </div>
            </div>
          </Card>

          {/* Card Professores */}
          <Card className="p-4 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Professores
              </span>
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <BookMarked className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900">
                {visaoGeral.total_professores}
              </div>
            </div>
          </Card>

          {/* Card Atividades */}
          <Card className="p-4 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Atividades
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900">
                {visaoGeral.total_atividades_publicadas}
              </div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">
                {pluralizar(visaoGeral.total_atividades_publicadas, 'atividade publicada', 'atividades publicadas')}
              </div>
            </div>
          </Card>

          {/* Card Aproveitamento Médio */}
          <Card className="p-4 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Aproveitamento
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900">
                {visaoGeral.aproveitamento_medio !== null
                  ? formatarPercentual(visaoGeral.aproveitamento_medio)
                  : '—'}
              </div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">
                Média geral da escola
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Seção de Atalhos Rápidos */}
      <div className="space-y-3">
        <h3 className="text-sm font-heading font-bold text-slate-800 uppercase tracking-wider">
          Módulos Administrativos
        </h3>

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
    </div>
  );
};
