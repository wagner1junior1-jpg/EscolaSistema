import React from 'react';

interface AlunoLayoutProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const AlunoLayout: React.FC<AlunoLayoutProps> = ({
  children,
  className = '',
  containerClassName = '',
}) => {
  return (
    <div
      className={`min-h-screen relative overflow-x-hidden text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #fae8ff 50%, #fef3c7 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Bolhas decorativas de fundo com blur suave */}
      <div
        aria-hidden="true"
        className="fixed rounded-full pointer-events-none z-0 opacity-55 animate-float-slow"
        style={{
          filter: 'blur(40px)',
          background: '#c7d2fe',
        }}
      >
        <div className="w-[220px] h-[220px] sm:w-[400px] sm:h-[400px] -top-[50px] -left-[50px] sm:-top-[100px] sm:-left-[100px] absolute rounded-full bg-[#c7d2fe]" />
      </div>

      <div
        aria-hidden="true"
        className="fixed rounded-full pointer-events-none z-0 opacity-55 animate-float-slow"
        style={{
          filter: 'blur(40px)',
          animationDuration: '25s',
        }}
      >
        <div className="w-[250px] h-[250px] sm:w-[450px] sm:h-[450px] -bottom-[50px] -right-[50px] sm:-bottom-[100px] sm:-right-[100px] fixed rounded-full bg-[#fbcfe8]" />
      </div>

      <div
        aria-hidden="true"
        className="hidden sm:block fixed rounded-full pointer-events-none z-0 opacity-35 animate-float-slow"
        style={{
          filter: 'blur(40px)',
          width: '300px',
          height: '300px',
          background: '#fef08a',
          top: '40%',
          right: '15%',
          animationDuration: '22s',
        }}
      />

      {/* Conteúdo principal */}
      <div className={`relative z-10 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden safe-top safe-bottom ${containerClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default AlunoLayout;
