import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 active:from-indigo-700 active:to-indigo-800 shadow-sm shadow-indigo-300/50 focus-visible:ring-indigo-500',
  secondary:
    'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus-visible:ring-indigo-500',
  ghost:
    'text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400',
  danger:
    'bg-gradient-to-b from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700 active:from-rose-700 active:to-rose-800 shadow-sm shadow-rose-300/50 focus-visible:ring-rose-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs font-semibold px-3 py-1.5 rounded-lg gap-1.5 tracking-wide',
  md: 'text-sm font-semibold px-4 py-2.5 rounded-xl gap-2 tracking-wide',
  lg: 'text-base font-semibold px-5 py-3 rounded-2xl gap-2.5 tracking-wide',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-heading transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed select-none active:scale-[0.98] disabled:active:scale-100';

    const width = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${width} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
