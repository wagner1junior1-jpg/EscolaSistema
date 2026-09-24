import React from 'react';
import { Loader2 } from 'lucide-react';

export type BotaoGrandeVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'yellow';

interface BotaoGrandeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BotaoGrandeVariant;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const BotaoGrande: React.FC<BotaoGrandeProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'relative inline-flex items-center justify-center gap-2.5 min-h-[48px] sm:min-h-[52px] px-6 py-3.5 rounded-2xl font-heading font-bold text-base sm:text-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';

  const variantClasses: Record<BotaoGrandeVariant, string> = {
    primary:
      'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-playful hover:shadow-float hover:-translate-y-0.5 active:translate-y-0',
    secondary:
      'bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus:ring-pink-500',
    yellow:
      'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus:ring-amber-500',
    outline:
      'border-2 border-indigo-200 hover:border-indigo-400 bg-white/80 hover:bg-white text-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
    ghost:
      'bg-transparent hover:bg-white/60 text-slate-700 hover:text-slate-900 border border-transparent',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default BotaoGrande;
