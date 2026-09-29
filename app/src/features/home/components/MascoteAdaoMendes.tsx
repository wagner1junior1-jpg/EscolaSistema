import React from 'react';

interface MascoteAdaoMendesProps {
  className?: string;
  waving?: boolean;
}

/**
 * Mascote Oficial do Educandário Adão Mendes
 * 
 * Ilustração vetorial lúdica inspirada no personagem da logo da escola,
 * vestindo o uniforme oficial completo:
 * - Camiseta: corpo amarelo sol/ouro (#FBBF24) com gola V azul/amarela
 * - Mangas: raglan em azul real (#1D4ED8) com faixas duplas brancas
 * - Emblema da escola no peito esquerdo
 * - Bermuda: azul real (#1D4ED8)
 * - Tênis esportivo moderno
 * - Pose acolhedora com aceno de boas-vindas
 */
export const MascoteAdaoMendes: React.FC<MascoteAdaoMendesProps> = ({
  className = 'w-40 h-52',
  waving = true,
}) => {
  return (
    <div className={`relative inline-block select-none ${className}`}>
      <svg
        viewBox="0 0 200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label="Mascote do Educandário Adão Mendes com uniforme escolar oficial"
      >
        <defs>
          {/* Gradiente do Cabelo Dourado */}
          <linearGradient id="cabeloGrad" x1="60" y1="10" x2="140" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" />
            <stop offset="0.5" stopColor="#FACC15" />
            <stop offset="1" stopColor="#EAB308" />
          </linearGradient>

          {/* Gradiente da Camiseta Amarela */}
          <linearGradient id="camisetaAmarela" x1="70" y1="75" x2="130" y2="145" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" />
            <stop offset="0.3" stopColor="#FBBF24" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>

          {/* Gradiente Azul Real (Mangas e Bermuda) */}
          <linearGradient id="azulReal" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>

          {/* Sombra da Bermuda */}
          <linearGradient id="bermudaGrad" x1="70" y1="135" x2="130" y2="175" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E40AF" />
            <stop offset="0.5" stopColor="#1D4ED8" />
            <stop offset="1" stopColor="#1E3A8A" />
          </linearGradient>

          <filter id="brilhoSuave" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
          </filter>
        </defs>

        <style>{`
          @keyframes waveHand {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(12deg); }
          }
          .mascote-braco-aceno {
            transform-origin: 58px 90px;
            animation: ${waving ? 'waveHand 2.2s ease-in-out infinite' : 'none'};
          }
          @keyframes floatGentle {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
          .mascote-corpo-inteiro {
            animation: floatGentle 4s ease-in-out infinite;
          }
        `}</style>

        {/* Sombra de Contato no Chão */}
        <ellipse cx="100" cy="234" rx="42" ry="5" fill="#0F172A" opacity="0.15" />

        <g className="mascote-corpo-inteiro">
          {/* ================= PERNAS E TÊNIS ================= */}
          {/* Perna Esquerda */}
          <rect x="80" y="165" width="13" height="38" rx="6.5" fill="#F7C59F" />
          {/* Meia Esquerda */}
          <path d="M79 194 H94 V204 C94 206 92 208 90 208 H83 C81 208 79 206 79 204 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
          {/* Tênis Esquerdo */}
          <path
            d="M72 216 C72 210 77 206 84 206 H92 C97 206 100 210 100 215 L100 224 C100 227 98 229 95 229 H75 C73 229 72 227 72 224 Z"
            fill="#1E293B"
          />
          {/* Sola Branca do Tênis */}
          <rect x="71" y="224" width="30" height="5" rx="2.5" fill="#FFFFFF" />
          <path d="M78 212 L87 212" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M79 216 L86 216" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

          {/* Perna Direita */}
          <rect x="107" y="165" width="13" height="38" rx="6.5" fill="#F7C59F" />
          {/* Meia Direita */}
          <path d="M106 194 H121 V204 C121 206 119 208 117 208 H110 C108 208 106 206 106 204 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
          {/* Tênis Direito */}
          <path
            d="M100 216 C100 210 105 206 112 206 H120 C125 206 128 210 128 215 L128 224 C128 227 126 229 123 229 H103 C101 229 100 227 100 224 Z"
            fill="#1E293B"
          />
          {/* Sola Branca do Tênis */}
          <rect x="99" y="224" width="30" height="5" rx="2.5" fill="#FFFFFF" />
          <path d="M106 212 L115 212" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M107 216 L114 216" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

          {/* ================= BERMUDA AZUL REAL ================= */}
          <g filter="url(#brilhoSuave)">
            {/* Bermuda principal */}
            <path
              d="M72 136 C72 134 74 133 76 133 H124 C126 133 128 134 128 136 L127 172 C127 174 125 175 123 175 H104 C102 175 101 174 100 172 L99 156 L98 172 C98 174 96 175 94 175 H77 C75 175 73 174 73 172 Z"
              fill="url(#bermudaGrad)"
            />
            {/* Cós elástico da bermuda */}
            <path d="M72 136 H128" stroke="#1E3A8A" strokeWidth="2.5" />
            {/* Vinco central da bermuda */}
            <path d="M100 137 V156" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            {/* Emblema na perna esquerda da bermuda */}
            <circle cx="82" cy="162" r="3.5" fill="#FFFFFF" opacity="0.9" />
            <path d="M80.5 162 L82 160.5 L83.5 162 V164 H80.5 Z" fill="#1D4ED8" />
          </g>

          {/* ================= BRAÇO ESQUERDO (Parado/Ao lado) ================= */}
          <g>
            {/* Manga Esquerda (Azul Real) */}
            <path
              d="M125 86 L144 98 C146 99 146 102 144 104 L138 111 C136 113 134 113 132 111 L119 97 Z"
              fill="url(#azulReal)"
            />
            {/* Listras Brancas na Barra da Manga Esquerda */}
            <path d="M136 108 L142 102" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M133 111 L139 105" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

            {/* Antebraço e Mão Esquerda */}
            <path
              d="M136 109 L142 124 C143 126 142 129 140 130 C138 132 135 131 134 129 L128 114 Z"
              fill="#F7C59F"
            />
            <circle cx="141" cy="132" r="5" fill="#F7C59F" />
          </g>

          {/* ================= CORPO DA CAMISETA (AMARELO SOL) ================= */}
          <g filter="url(#brilhoSuave)">
            <path
              d="M74 88 C76 84 81 83 87 83 H113 C119 83 124 84 126 88 L129 138 C129 140 127 141 125 141 H75 C73 141 71 140 71 138 Z"
              fill="url(#camisetaAmarela)"
            />

            {/* Gola V Azul Real e Amarela */}
            <path
              d="M88 83 C92 89 97 97 100 97 C103 97 108 89 112 83"
              fill="#F7C59F"
              stroke="#1D4ED8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M91 83 C94 88 97 93 100 93 C103 93 106 88 109 83"
              fill="none"
              stroke="#FDE047"
              strokeWidth="1.5"
            />

            {/* Emblema da Escola no Peito Esquerdo (Casinha da Logo) */}
            <g transform="translate(110, 99)">
              <circle cx="6" cy="6" r="7.5" fill="#FFFFFF" stroke="#1D4ED8" strokeWidth="1" />
              {/* Telhadinho Azul da Casa */}
              <path d="M2.5 7 L6 3.5 L9.5 7" stroke="#1D4ED8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              {/* Paredes da Casa */}
              <rect x="3.5" y="6.5" width="5" height="4.5" fill="none" stroke="#1D4ED8" strokeWidth="1" />
              {/* Ponto Amarelo Central (criança) */}
              <circle cx="6" cy="8.2" r="1.2" fill="#FACC15" />
            </g>

            {/* Barra da Camiseta */}
            <path d="M72 138 Q100 142 128 138" stroke="#EAB308" strokeWidth="1" fill="none" opacity="0.6" />
          </g>

          {/* ================= PESCOÇO E CABEÇA ================= */}
          {/* Pescoço */}
          <rect x="94" y="73" width="12" height="13" rx="4" fill="#E8B58E" />

          {/* Cabeça Redonda e Alegre */}
          <circle cx="100" cy="50" r="26" fill="#F7C59F" />

          {/* Bochechas Rosadas */}
          <ellipse cx="85" cy="56" rx="4.5" ry="3" fill="#F472B6" opacity="0.45" />
          <ellipse cx="115" cy="56" rx="4.5" ry="3" fill="#F472B6" opacity="0.45" />

          {/* Olhos Sorridentes e Brilhantes */}
          <ellipse cx="88" cy="46" rx="3.5" ry="4.5" fill="#0F172A" />
          <circle cx="89" cy="44.5" r="1.3" fill="#FFFFFF" />

          <ellipse cx="112" cy="46" rx="3.5" ry="4.5" fill="#0F172A" />
          <circle cx="113" cy="44.5" r="1.3" fill="#FFFFFF" />

          {/* Sobrancelhas Amigáveis */}
          <path d="M83 40 Q88 37 93 40" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M107 40 Q112 37 117 40" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" fill="none" />

          {/* Narizinho */}
          <circle cx="100" cy="50" r="1.3" fill="#E8B58E" />

          {/* Sorriso Largo e Contagiante (igual à logo do Educandário) */}
          <path
            d="M87 54 C91 66 109 66 113 54 C109 57 91 57 87 54 Z"
            fill="#B91C1C"
          />
          {/* Dentinhos Brancos */}
          <path
            d="M89 54.5 C93 57.5 107 57.5 111 54.5 C107 56 93 56 89 54.5 Z"
            fill="#FFFFFF"
          />
          {/* Língua Rosada */}
          <path
            d="M94 62 C97 60 103 60 106 62 C103 64.5 97 64.5 94 62 Z"
            fill="#F472B6"
          />

          {/* Orelhas */}
          <ellipse cx="74" cy="50" rx="3" ry="5" fill="#F7C59F" />
          <ellipse cx="126" cy="50" rx="3" ry="5" fill="#F7C59F" />

          {/* ================= CABELO AMARELO DOURADO (Inspirado na Logo) ================= */}
          <g filter="url(#brilhoSuave)">
            {/* Topete e Mechas Laterais no estilo sol/casa */}
            <path
              d="M74 44 C72 30 82 18 97 18 C105 18 116 22 123 30 C128 36 128 44 126 48 C124 45 120 42 116 43 C111 40 106 41 103 44 C99 39 94 38 89 42 C85 41 80 43 78 46 C76 45 74 45 74 44 Z"
              fill="url(#cabeloGrad)"
            />
            {/* Tufo Superior Alegre */}
            <path
              d="M93 18 C90 10 97 6 103 8 C107 9 108 14 104 18 Z"
              fill="#FDE047"
            />
            {/* Brilhos nas Mechas */}
            <path d="M83 28 Q92 22 101 24" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M106 25 Q115 27 120 33" stroke="#FEF08A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>

          {/* ================= BRAÇO DIREITO COM ACENO (ANIMAÇÃO) ================= */}
          <g className="mascote-braco-aceno">
            {/* Manga Direita (Azul Real) */}
            <path
              d="M75 86 L56 75 C54 74 51 75 50 78 L46 86 C45 88 46 91 48 92 L61 97 Z"
              fill="url(#azulReal)"
            />
            {/* Listras Brancas na Barra da Manga Direita */}
            <path d="M49 84 L54 89" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M52 81 L57 86" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

            {/* Antebraço levantado */}
            <path
              d="M48 84 L36 67 C35 65 35 63 37 61 L42 57 C44 55 46 56 48 58 L57 76 Z"
              fill="#F7C59F"
            />

            {/* Mãozinha Acenando */}
            <g transform="translate(28, 42)">
              {/* Palma */}
              <circle cx="11" cy="11" r="7" fill="#F7C59F" />
              {/* Dedão */}
              <ellipse cx="17" cy="13" rx="2.5" ry="3.5" fill="#F7C59F" transform="rotate(30 17 13)" />
              {/* 4 Dedinhos abertos acenando */}
              <ellipse cx="6" cy="6" rx="2.2" ry="4" fill="#F7C59F" transform="rotate(-30 6 6)" />
              <ellipse cx="9" cy="4" rx="2.2" ry="4.5" fill="#F7C59F" transform="rotate(-10 9 4)" />
              <ellipse cx="13" cy="4" rx="2.2" ry="4.5" fill="#F7C59F" transform="rotate(10 13 4)" />
              <ellipse cx="16" cy="6" rx="2.2" ry="4" fill="#F7C59F" transform="rotate(30 16 6)" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default MascoteAdaoMendes;
