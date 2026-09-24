import React from 'react';
import { Link } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande } from '@/components/aluno';
import { School, Sparkles, GraduationCap, ArrowRight, UserCheck } from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <AlunoLayout containerClassName="items-center justify-center p-4 py-12">
      <main className="w-full max-w-lg space-y-6 text-center">
        {/* Card central com o tema do aluno */}
        <CartaoVidro className="p-6 sm:p-10 space-y-8">
          {/* Logo e Título */}
          <div className="space-y-4 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-300/50">
              <School className="w-10 h-10" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-heading font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Plataforma Escolar SaberPontual</span>
            </div>

            <div className="space-y-1">
              <h1 className="font-heading font-black text-3xl sm:text-4xl text-slate-900 tracking-tight">
                SaberPontual
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-sm mx-auto font-sans leading-relaxed">
                Exercícios Rápidos &amp; Diagnóstico Pedagógico
              </p>
            </div>
          </div>

          {/* Botões de Acesso */}
          <div className="space-y-4 pt-2">
            <Link to="/aluno" className="block w-full">
              <BotaoGrande
                variant="primary"
                className="w-full py-4 text-lg"
                leftIcon={<GraduationCap className="w-6 h-6" />}
                rightIcon={<ArrowRight className="w-5 h-5 ml-auto opacity-70" />}
              >
                Sou aluno
              </BotaoGrande>
            </Link>

            <Link to="/entrar" className="block w-full">
              <BotaoGrande
                variant="outline"
                className="w-full py-4 text-base sm:text-lg"
                leftIcon={<UserCheck className="w-5 h-5 text-indigo-600" />}
                rightIcon={<ArrowRight className="w-5 h-5 ml-auto opacity-70 text-indigo-500" />}
              >
                Sou professor ou da gestão
              </BotaoGrande>
            </Link>
          </div>
        </CartaoVidro>

        <p className="text-xs text-slate-500">
          Acesso seguro e simplificado para alunos, professores e coordenação.
        </p>
      </main>
    </AlunoLayout>
  );
};

export default HomePage;
