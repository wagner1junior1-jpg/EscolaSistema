import React from 'react';

export const AssinaturaWtj: React.FC = () => {
  return (
    <div className="w-full mt-6 pt-4 border-t border-[#ECEEF6] flex items-center justify-center gap-[10px] text-[13px] text-[#4A4E73]">
      <svg
        width="22"
        height="22"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="13" fill="#14163F" />
        <path
          d="M9 14 L16 34 L24 18 L31 34 L37 21"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M37 21 C33 15 37 9 43 9 C44 15 42 21 37 21 Z"
          fill="#12B58C"
        />
      </svg>
      <span>
        Desenvolvido por{' '}
        <strong className="text-[#14163F]">WTJ Soluções Tecnológicas</strong>
      </span>
    </div>
  );
};

export default AssinaturaWtj;
