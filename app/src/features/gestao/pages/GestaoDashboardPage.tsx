import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Users,
  Key,
  Calendar,
  Building2,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

import { GestaoInicioSecao } from '../components/GestaoInicioSecao';
import { GestaoTurmasSecao } from '../components/GestaoTurmasSecao';
import { GestaoDisciplinasSecao } from '../components/GestaoDisciplinasSecao';
import { GestaoProfessoresSecao } from '../components/GestaoProfessoresSecao';
import { GestaoAlunosSecao } from '../components/GestaoAlunosSecao';
import { GestaoBimestresSecao } from '../components/GestaoBimestresSecao';
import { GestaoEscolaSecao } from '../components/GestaoEscolaSecao';

type SecaoGestao =
  | 'inicio'
  | 'turmas'
  | 'disciplinas'
  | 'professores'
  | 'alunos'
  | 'bimestres'
  | 'escola';

export const GestaoDashboardPage: React.FC = () => {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const isDirecao = usuario?.papel === 'direcao';

  const secaoQuery = (searchParams.get('secao') as SecaoGestao) || 'inicio';
  // Se usuário não for direção e tentar acessar bimestres ou escola, redireciona para início
  const secaoAtiva: SecaoGestao =
    !isDirecao && (secaoQuery === 'bimestres' || secaoQuery === 'escola')
      ? 'inicio'
      : secaoQuery;

  const handleMudarSecao = (novaSecao: string) => {
    setSearchParams({ secao: novaSecao });
    setMenuMobileAberto(false);
  };

  const itensMenu = [
    {
      id: 'inicio',
      label: 'Início',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'turmas',
      label: 'Turmas',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: 'disciplinas',
      label: 'Disciplinas',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'professores',
      label: 'Professores',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'alunos',
      label: 'Alunos e PINs',
      icon: <Key className="w-4 h-4" />,
    },
    ...(isDirecao
      ? [
          {
            id: 'bimestres',
            label: 'Bimestres',
            icon: <Calendar className="w-4 h-4" />,
          },
          {
            id: 'escola',
            label: 'Escola',
            icon: <Building2 className="w-4 h-4" />,
          },
        ]
      : []),
  ];

  const itemAtual = itensMenu.find((m) => m.id === secaoAtiva) || itensMenu[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabeçalho do Painel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
                  Painel de Gestão
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {usuario?.papel === 'direcao' ? 'Direção' : 'Coordenação'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Olá, {usuario?.nome || 'Gestor(a)'} — Administração escolar e pedagógica.
              </p>
            </div>
          </div>

          {/* Botão de Menu para Dispositivos Móveis */}
          <div className="w-full sm:w-auto md:hidden pt-2 border-t border-slate-100 sm:pt-0 sm:border-0">
            <button
              onClick={() => setMenuMobileAberto(!menuMobileAberto)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {itemAtual.icon}
                <span>Menu: <strong>{itemAtual.label}</strong></span>
              </div>
              {menuMobileAberto ? (
                <X className="w-4 h-4 text-slate-500" />
              ) : (
                <Menu className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Layout Principal: Menu Lateral + Conteúdo */}
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Menu Lateral (Desktop e Gaveta no Mobile) */}
          <aside
            className={`w-full md:w-60 shrink-0 bg-white border border-slate-200 rounded-2xl p-2 shadow-xs transition-all ${
              menuMobileAberto ? 'block' : 'hidden md:block'
            }`}
          >
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navegação
            </div>

            <nav className="space-y-1">
              {itensMenu.map((item) => {
                const ativo = secaoAtiva === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMudarSecao(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      ativo
                        ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={ativo ? 'text-indigo-600' : 'text-slate-400'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {ativo && <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Área de Conteúdo da Seção */}
          <main className="flex-1 min-w-0 w-full">
            {secaoAtiva === 'inicio' && (
              <GestaoInicioSecao onNavegar={handleMudarSecao} isDirecao={isDirecao} />
            )}
            {secaoAtiva === 'turmas' && <GestaoTurmasSecao />}
            {secaoAtiva === 'disciplinas' && <GestaoDisciplinasSecao />}
            {secaoAtiva === 'professores' && <GestaoProfessoresSecao />}
            {secaoAtiva === 'alunos' && <GestaoAlunosSecao />}
            {secaoAtiva === 'bimestres' && isDirecao && <GestaoBimestresSecao />}
            {secaoAtiva === 'escola' && isDirecao && <GestaoEscolaSecao />}
          </main>
        </div>
      </div>
    </AppShell>
  );
};

export default GestaoDashboardPage;
