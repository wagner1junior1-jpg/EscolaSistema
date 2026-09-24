import React from 'react';

interface CartaoVidroProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const CartaoVidro: React.FC<CartaoVidroProps> = ({
  children,
  className = '',
  hover = false,
  ...props
}) => {
  return (
    <div
      className={`
        bg-white/95 backdrop-blur-md border-2 border-white/80 rounded-3xl
        shadow-playful text-slate-800 transition-all duration-200
        ${hover ? 'hover:-translate-y-1 hover:shadow-float' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export default CartaoVidro;
