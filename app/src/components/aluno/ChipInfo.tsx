import React from 'react';

export type ChipColor = 'indigo' | 'pink' | 'amber' | 'emerald' | 'sky' | 'violet' | 'slate';

interface ChipInfoProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: ChipColor;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const ChipInfo: React.FC<ChipInfoProps> = ({
  color = 'indigo',
  icon,
  children,
  className = '',
  ...props
}) => {
  const colorStyles: Record<ChipColor, string> = {
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200/80',
    pink: 'bg-pink-100 text-pink-800 border-pink-200/80',
    amber: 'bg-amber-100 text-amber-900 border-amber-200/80',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200/80',
    sky: 'bg-sky-100 text-sky-800 border-sky-200/80',
    violet: 'bg-violet-100 text-violet-800 border-violet-200/80',
    slate: 'bg-slate-100 text-slate-700 border-slate-200/80',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-heading font-bold uppercase tracking-wider border ${colorStyles[color]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default ChipInfo;
