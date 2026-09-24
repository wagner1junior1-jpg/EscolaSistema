import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
        hover
          ? 'hover:shadow-md hover:shadow-indigo-100/50 hover:border-indigo-200/60 hover:-translate-y-0.5 hover:ring-1 hover:ring-indigo-100'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`p-5 sm:p-6 border-b border-slate-100/80 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3
      className={`font-heading font-bold text-lg text-slate-900 tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p className={`text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`p-4 sm:p-6 bg-slate-50/70 border-t border-slate-100/80 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
