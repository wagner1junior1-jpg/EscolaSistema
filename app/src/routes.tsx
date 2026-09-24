import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '@/features/home/HomePage';
import LoginPage from '@/features/auth/pages/LoginPage';
import AlunoLoginPage from '@/features/aluno/pages/AlunoLoginPage';
import AlunoPainelPage from '@/features/aluno/pages/AlunoPainelPage';
import ProfessorDashboardPage from '@/features/professor/pages/ProfessorDashboardPage';
import GestaoDashboardPage from '@/features/gestao/pages/GestaoDashboardPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rota inicial com vitrine de rotas e demonstração dos componentes */}
      <Route path="/" element={<HomePage />} />

      {/* 1. Login do Professor e Gestão */}
      <Route path="/entrar" element={<LoginPage />} />

      {/* 2. Login do Aluno (Código + PIN) */}
      <Route path="/aluno" element={<AlunoLoginPage />} />

      {/* 3. Painel do Aluno */}
      <Route path="/aluno/painel" element={<AlunoPainelPage />} />

      {/* 4. Portal do Professor */}
      <Route path="/professor" element={<ProfessorDashboardPage />} />

      {/* 5. Gestão Escolar & Coordenação */}
      <Route path="/gestao" element={<GestaoDashboardPage />} />

      {/* Redirecionamento de rotas desconhecidas */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
