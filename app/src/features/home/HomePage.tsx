import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande } from '@/components/aluno';
import { Sparkles, GraduationCap, ArrowRight, UserCheck } from 'lucide-react';
import logoEscola from '@/assets/logo-escola.png';
import { MascoteAdaoMendes } from './components/MascoteAdaoMendes';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AlunoLayout containerClassName="items-center justify-center p-4 py-8 sm:py-12">
      <main className="w-full max-w-lg space-y-6 text-center">
        {/* Card central com o tema do Educandário Adão Mendes */}
        <CartaoVidro className="p-6 sm:p-9 space-y-6 relative overflow-hidden">
          {/* Faixa decorativa superior com as cores oficiais do uniforme */}
          <div
            aria-hidden="true"
            className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-amber-400 to-blue-600"
          />

          {/* Logo Oficial e Identificação da Escola */}
          <div className="space-y-3 flex flex-col items-center">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white p-1 shadow-lg ring-4 ring-blue-500/20 border-2 border-amber-400 flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105">
                <img
                  src={logoEscola}
                  alt="Logo Educandário Adão Mendes"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-heading font-extrabold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Educandário Adão Mendes</span>
              </div>

              <div>
                <p className="text-xs font-heading font-bold text-amber-600 tracking-wide italic">
                  &ldquo;Sua casa na escola&rdquo;
                </p>
                {/* Heading principal SaberPontual para acessibilidade e testes */}
                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight pt-1">
                  SaberPontual
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto font-sans leading-relaxed">
                  Exercícios Rápidos &amp; Diagnóstico Pedagógico
                </p>
              </div>
            </div>
          </div>

          {/* Mascote no Uniforme Oficial da Escola */}
          <div className="py-1 flex flex-col items-center">
            {/* Balão acolhedor de boas-vindas */}
            <div className="mb-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-heading font-bold flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Vista seu uniforme e venha aprender!</span>
            </div>

            {/* Ilustração vetorial do bonequinho no uniforme oficial */}
            <MascoteAdaoMendes className="w-32 h-40 sm:w-36 sm:h-44 drop-shadow-sm my-1" waving />

            {/* Indicadores das cores oficiais do uniforme */}
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500" />
                Amarelo Sol
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-blue-700" />
                Azul Real
              </span>
            </div>
          </div>

          {/* Botões de Acesso */}
          <div className="space-y-3 pt-1">
            <BotaoGrande
              variant="primary"
              className="w-full py-4 text-base sm:text-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-500/25 ring-2 ring-blue-600/30"
              onClick={() => navigate('/aluno')}
              leftIcon={<GraduationCap className="w-6 h-6" />}
              rightIcon={<ArrowRight className="w-5 h-5 ml-auto opacity-70" />}
            >
              Sou aluno
            </BotaoGrande>

            <BotaoGrande
              variant="outline"
              className="w-full py-3.5 text-base border-blue-200 text-blue-800 hover:border-blue-400 hover:bg-blue-50/50"
              onClick={() => navigate('/entrar')}
              leftIcon={<UserCheck className="w-5 h-5 text-blue-600" />}
              rightIcon={<ArrowRight className="w-5 h-5 ml-auto opacity-70 text-blue-500" />}
            >
              Sou professor ou da gestão
            </BotaoGrande>
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
