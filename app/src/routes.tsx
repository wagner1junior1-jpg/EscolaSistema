import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '@/features/home/HomePage';
import LoginPage from '@/features/auth/pages/LoginPage';
import AlunoLoginPage from '@/features/aluno/pages/AlunoLoginPage';
import AlunoPainelPage from '@/features/aluno/pages/AlunoPainelPage';
import AlunoAtividadePage from '@/features/aluno/pages/AlunoAtividadePage';
import ProfessorDashboardPage from '@/features/professor/pages/ProfessorDashboardPage';
import GestaoDashboardPage from '@/features/gestao/pages/GestaoDashboardPage';
import { RotaProtegida } from '@/features/auth/AuthProvider';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Página Inicial — SaberPontual com dois caminhos de acesso */}
      <Route path="/" element={<HomePage />} />

      {/* 2. Login da Equipe Escolar (Professores e Gestão) */}
      <Route path="/entrar" element={<LoginPage />} />

      {/* 3. Acesso do Aluno (Código da Turma -> Nome -> PIN) */}
      <Route path="/aluno" element={<AlunoLoginPage />} />

      {/* 4. Painel do Aluno (Protegido por token de sessão) */}
      <Route path="/aluno/painel" element={<AlunoPainelPage />} />

      {/* 4.1. Player de Atividades e Provas do Aluno */}
      <Route path="/aluno/atividade/:id" element={<AlunoAtividadePage />} />

      {/* 5. Portal do Professor (Protegido por papel: professor) */}
      <Route
        path="/professor"
        element={
          <RotaProtegida papeis={['professor']}>
            <ProfessorDashboardPage />
          </RotaProtegida>
        }
      />

      {/* 6. Gestão Escolar & Coordenação (Protegido por papéis: direcao, coordenacao) */}
      <Route
        path="/gestao"
        element={
          <RotaProtegida papeis={['direcao', 'coordenacao']}>
            <GestaoDashboardPage />
          </RotaProtegida>
        }
      />

      {/* Redirecionamento de rotas desconhecidas */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
