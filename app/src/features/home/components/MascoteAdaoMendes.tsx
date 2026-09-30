import React from 'react';

export type MascoteGenero = 'menina' | 'menino';

export interface MascoteAdaoMendesProps {
  className?: string;
  waving?: boolean;
  genero?: MascoteGenero;
  idPrefix?: string;
}

/**
 * Mascote Oficial do Educandário Adão Mendes
 * 
 * Ilustrações vetoriais lúdicas inspiradas na identidade da escola:
 * - Menina: Inspirada na figura alegre da logo oficial, com cabelo dourado, lacinho escolar azul real e uniforme oficial.
 * - Menino: Cabelo curto despojado castanho-amendoado com topete moderno, traço alegre e uniforme oficial idêntico.
 * 
 * Uniforme oficial completo de ambos:
 * - Camiseta: corpo amarelo sol (#FBBF24 / #FACC15) com gola V azul/amarela
 * - Mangas: raglan em azul real (#1D4ED8) com faixas duplas brancas
 * - Emblema da escola no peito esquerdo (casinha com criança da logo)
 * - Bermuda: azul real (#1D4ED8) com cós e insígnia
 * - Meias brancas e tênis esportivo moderno
 */
export const MascoteAdaoMendes: React.FC<MascoteAdaoMendesProps> = ({
  className = 'w-40 h-52',
  waving = true,
  genero = 'menina',
  idPrefix,
}) => {
  const isMenino = genero === 'menino';
  const prefix = idPrefix || (isMenino ? 'masc-menino-' : 'masc-menina-');

  return (
    <div className={`relative inline-block select-none ${className}`}>
      <svg
        viewBox="0 0 200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label={`Mascote ${isMenino ? 'menino' : 'menina'} do Educandário Adão Mendes com uniforme escolar oficial`}
      >
        <defs>
          {/* Gradiente Cabelo Menina (Dourado Sol inspirado na Logo) */}
          <linearGradient id={`${prefix}cabeloGradMenina`} x1="60" y1="10" x2="140" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" />
            <stop offset="0.5" stopColor="#FACC15" />
            <stop offset="1" stopColor="#EAB308" />
          </linearGradient>

          {/* Gradiente Cabelo Menino (Castanho Chocolate e Âmbar) */}
          <linearGradient id={`${prefix}cabeloGradMenino`} x1="70" y1="15" x2="130" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#78350F" />
            <stop offset="0.6" stopColor="#5B2D10" />
            <stop offset="1" stopColor="#451A03" />
          </linearGradient>

          {/* Gradiente da Camiseta Amarela (Amarelo Sol Oficial) */}
          <linearGradient id={`${prefix}camisetaAmarela`} x1="70" y1="75" x2="130" y2="145" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" />
            <stop offset="0.3" stopColor="#FBBF24" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>

          {/* Gradiente Azul Real (Mangas e Bermuda) */}
          <linearGradient id={`${prefix}azulReal`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>

          {/* Sombra da Bermuda */}
          <linearGradient id={`${prefix}bermudaGrad`} x1="70" y1="135" x2="130" y2="175" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E40AF" />
            <stop offset="0.5" stopColor="#1D4ED8" />
            <stop offset="1" stopColor="#1E3A8A" />
          </linearGradient>

          <filter id={`${prefix}brilhoSuave`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
          </filter>
        </defs>

        <style>{`
          @keyframes waveHandRight {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(13deg); }
          }
          @keyframes waveHandLeft {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-13deg); }
          }
          .${prefix}braco-aceno-dir {
            transform-origin: 58px 90px;
            animation: ${waving ? 'waveHandRight 2.2s ease-in-out infinite' : 'none'};
          }
          .${prefix}braco-aceno-esq {
            transform-origin: 142px 90px;
            animation: ${waving ? 'waveHandLeft 2.2s ease-in-out infinite 0.35s' : 'none'};
          }
          @keyframes floatGentleMascote {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-3.5px); }
          }
          .${prefix}corpo-inteiro {
            animation: floatGentleMascote 4s ease-in-out infinite ${isMenino ? '0.5s' : '0s'};
          }
        `}</style>

        {/* Sombra de Contato no Chão */}
        <ellipse cx="100" cy="234" rx="42" ry="5" fill="#0F172A" opacity="0.15" />

        <g className={`${prefix}corpo-inteiro`}>
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
          <g filter={`url(#${prefix}brilhoSuave)`}>
            {/* Bermuda principal */}
            <path
              d="M72 136 C72 134 74 133 76 133 H124 C126 133 128 134 128 136 L127 172 C127 174 125 175 123 175 H104 C102 175 101 174 100 172 L99 156 L98 172 C98 174 96 175 94 175 H77 C75 175 73 174 73 172 Z"
              fill={`url(#${prefix}bermudaGrad)`}
            />
            {/* Cós elástico da bermuda */}
            <path d="M72 136 H128" stroke="#1E3A8A" strokeWidth="2.5" />
            {/* Vinco central da bermuda */}
            <path d="M100 137 V156" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            {/* Emblema na perna esquerda da bermuda */}
            <circle cx="82" cy="162" r="3.5" fill="#FFFFFF" opacity="0.9" />
            <path d="M80.5 162 L82 160.5 L83.5 162 V164 H80.5 Z" fill="#1D4ED8" />
          </g>

          {/* ================= CORPO DA CAMISETA (AMARELO SOL) ================= */}
          <g filter={`url(#${prefix}brilhoSuave)`}>
            <path
              d="M74 88 C76 84 81 83 87 83 H113 C119 83 124 84 126 88 L129 138 C129 140 127 141 125 141 H75 C73 141 71 140 71 138 Z"
              fill={`url(#${prefix}camisetaAmarela)`}
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

          {/* ================= BRAÇOS (COMPORTAMENTO CONFORME GÊNERO) ================= */}
          {/* Se MENINA: Braço direito (à esquerda do observador) acena, braço esquerdo em repouso */}
          {/* Se MENINO: Braço esquerdo (à direita do observador) acena para fora, braço direito em repouso */}

          {/* --- Braço do Observador à Esquerda (x ~ 45..75) --- */}
          {!isMenino ? (
            /* Menina: Braço Direito Acenando */
            <g className={`${prefix}braco-aceno-dir`}>
              {/* Manga Direita (Azul Real) */}
              <path
                d="M75 86 L56 75 C54 74 51 75 50 78 L46 86 C45 88 46 91 48 92 L61 97 Z"
                fill={`url(#${prefix}azulReal)`}
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
                <circle cx="11" cy="11" r="7" fill="#F7C59F" />
                <ellipse cx="17" cy="13" rx="2.5" ry="3.5" fill="#F7C59F" transform="rotate(30 17 13)" />
                <ellipse cx="6" cy="6" rx="2.2" ry="4" fill="#F7C59F" transform="rotate(-30 6 6)" />
                <ellipse cx="9" cy="4" rx="2.2" ry="4.5" fill="#F7C59F" transform="rotate(-10 9 4)" />
                <ellipse cx="13" cy="4" rx="2.2" ry="4.5" fill="#F7C59F" transform="rotate(10 13 4)" />
                <ellipse cx="16" cy="6" rx="2.2" ry="4" fill="#F7C59F" transform="rotate(30 16 6)" />
              </g>
            </g>
          ) : (
            /* Menino: Braço Direito em repouso ao lado */
            <g>
              <path
                d="M75 86 L56 98 C54 99 54 102 56 104 L62 111 C64 113 66 113 68 111 L81 97 Z"
                fill={`url(#${prefix}azulReal)`}
              />
              <path d="M64 108 L58 102" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M67 111 L61 105" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M64 109 L58 124 C57 126 58 129 60 130 C62 132 65 131 66 129 L72 114 Z"
                fill="#F7C59F"
              />
              <circle cx="59" cy="132" r="5" fill="#F7C59F" />
            </g>
          )}

          {/* --- Braço do Observador à Direita (x ~ 125..160) --- */}
          {!isMenino ? (
            /* Menina: Braço Esquerdo em repouso */
            <g>
              <path
                d="M125 86 L144 98 C146 99 146 102 144 104 L138 111 C136 113 134 113 132 111 L119 97 Z"
                fill={`url(#${prefix}azulReal)`}
              />
              <path d="M136 108 L142 102" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M133 111 L139 105" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M136 109 L142 124 C143 126 142 129 140 130 C138 132 135 131 134 129 L128 114 Z"
                fill="#F7C59F"
              />
              <circle cx="141" cy="132" r="5" fill="#F7C59F" />
            </g>
          ) : (
            /* Menino: Braço Esquerdo Acenando para fora */
            <g className={`${prefix}braco-aceno-esq`}>
              <path
                d="M125 86 L144 75 C146 74 149 75 150 78 L154 86 C155 88 154 91 152 92 L139 97 Z"
                fill={`url(#${prefix}azulReal)`}
              />
              <path d="M151 84 L146 89" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M148 81 L143 86" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M152 84 L164 67 C165 65 165 63 163 61 L158 57 C156 55 154 56 152 58 L143 76 Z"
                fill="#F7C59F"
              />
              {/* Mãozinha do Menino Acenando */}
              <g transform="translate(148, 42)">
                <circle cx="11" cy="11" r="7" fill="#F7C59F" />
                <ellipse cx="5" cy="13" rx="2.5" ry="3.5" fill="#F7C59F" transform="rotate(-30 5 13)" />
                <ellipse cx="16" cy="6" rx="2.2" ry="4" fill="#F7C59F" transform="rotate(30 16 6)" />
                <ellipse cx="13" cy="4" rx="2.2" ry="4.5" fill="#F7C59F" transform="rotate(10 13 4)" />
                <ellipse cx="9" cy="4" rx="2.2" ry="4.5" fill="#F7C59F" transform="rotate(-10 9 4)" />
                <ellipse cx="6" cy="6" rx="2.2" ry="4" fill="#F7C59F" transform="rotate(-30 6 6)" />
              </g>
            </g>
          )}

          {/* ================= PESCOÇO E CABEÇA ================= */}
          {/* Pescoço */}
          <rect x="94" y="73" width="12" height="13" rx="4" fill="#E8B58E" />

          {/* Cabeça */}
          <circle cx="100" cy="50" r={isMenino ? 25.5 : 26} fill="#F7C59F" />

          {/* Orelhas */}
          {!isMenino ? (
            <>
              <ellipse cx="74" cy="50" rx="3" ry="5" fill="#F7C59F" />
              <ellipse cx="126" cy="50" rx="3" ry="5" fill="#F7C59F" />
            </>
          ) : (
            <>
              {/* Orelhas de Menino bem visíveis e definidas */}
              <ellipse cx="73.5" cy="50" rx="3.5" ry="5.5" fill="#F7C59F" />
              <path d="M74 48 C73.2 49 73.2 51 74 52" stroke="#E8B58E" strokeWidth="1" fill="none" />
              <ellipse cx="126.5" cy="50" rx="3.5" ry="5.5" fill="#F7C59F" />
              <path d="M126 48 C126.8 49 126.8 51 126 52" stroke="#E8B58E" strokeWidth="1" fill="none" />
            </>
          )}

          {/* Bochechas Rosadas: APENAS NA MENINA (Menino sem blush) */}
          {!isMenino && (
            <>
              <ellipse cx="85" cy="56" rx="4.5" ry="3" fill="#F472B6" opacity="0.45" />
              <ellipse cx="115" cy="56" rx="4.5" ry="3" fill="#F472B6" opacity="0.45" />
            </>
          )}

          {/* Olhos Sorridentes e Brilhantes */}
          {!isMenino ? (
            <>
              <ellipse cx="88" cy="46" rx="3.5" ry="4.5" fill="#0F172A" />
              <circle cx="89" cy="44.5" r="1.3" fill="#FFFFFF" />
              <ellipse cx="112" cy="46" rx="3.5" ry="4.5" fill="#0F172A" />
              <circle cx="113" cy="44.5" r="1.3" fill="#FFFFFF" />
              {/* Cílios delicados da menina */}
              <path d="M84 43 L82 41" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />
              <path d="M116 43 L118 41" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* Olhos de Menino: expressivos, brilhantes e sem cílios */}
              <ellipse cx="88" cy="47" rx="3.5" ry="4.2" fill="#0F172A" />
              <circle cx="89.5" cy="45.2" r="1.3" fill="#FFFFFF" />
              <ellipse cx="112" cy="47" rx="3.5" ry="4.2" fill="#0F172A" />
              <circle cx="113.5" cy="45.2" r="1.3" fill="#FFFFFF" />
            </>
          )}

          {/* Sobrancelhas */}
          {!isMenino ? (
            <>
              <path d="M83 40 Q88 37 93 40" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path d="M107 40 Q112 37 117 40" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              {/* Sobrancelhas de Menino: mais retas, expressivas e marcantes em castanho escuro */}
              <path d="M82 39.5 L94 41" stroke="#451A03" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M106 41 L118 39.5" stroke="#451A03" strokeWidth="2.8" strokeLinecap="round" />
            </>
          )}

          {/* Narizinho */}
          <circle cx="100" cy={isMenino ? 51 : 50} r={isMenino ? 1.4 : 1.3} fill="#E8B58E" />

          {/* Sorrisos Diferenciados por Gênero */}
          {!isMenino ? (
            /* Sorriso Menina: Largo e Doce (inspirado na logo) */
            <>
              <path
                d="M87 54 C91 66 109 66 113 54 C109 57 91 57 87 54 Z"
                fill="#B91C1C"
              />
              <path
                d="M89 54.5 C93 57.5 107 57.5 111 54.5 C107 56 93 56 89 54.5 Z"
                fill="#FFFFFF"
              />
              <path
                d="M94 62 C97 60 103 60 106 62 C103 64.5 97 64.5 94 62 Z"
                fill="#F472B6"
              />
            </>
          ) : (
            /* Sorriso Menino: Garoto alegre, dentes brancos, traço escuro e sem aspecto de batom */
            <>
              <path
                d="M88 56 C91 66 109 66 112 56 Z"
                fill="#7F1D1D"
                stroke="#1E293B"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M88.5 56.5 C92 59.5 108 59.5 111.5 56.5 H88.5 Z"
                fill="#FFFFFF"
              />
              <path
                d="M94 63.5 C97 61.5 103 61.5 106 63.5 C103 65 97 65 94 63.5 Z"
                fill="#F87171"
              />
              <path d="M86 55.5 Q87 57 88 58" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <path d="M114 55.5 Q113 57 112 58" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            </>
          )}

          {/* ================= CABELOS ESPECÍFICOS ================= */}
          {!isMenino ? (
            /* CABELO MENINA: Amarelo Dourado Sol inspirado na Logo com Lacinho Azul Real */
            <g filter={`url(#${prefix}brilhoSuave)`}>
              <path
                d="M74 44 C72 30 82 18 97 18 C105 18 116 22 123 30 C128 36 128 44 126 48 C124 45 120 42 116 43 C111 40 106 41 103 44 C99 39 94 38 89 42 C85 41 80 43 78 46 C76 45 74 45 74 44 Z"
                fill={`url(#${prefix}cabeloGradMenina)`}
              />
              <path
                d="M93 18 C90 10 97 6 103 8 C107 9 108 14 104 18 Z"
                fill="#FDE047"
              />
              <path d="M83 28 Q92 22 101 24" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M106 25 Q115 27 120 33" stroke="#FEF08A" strokeWidth="1.5" strokeLinecap="round" fill="none" />

              <g transform="translate(73, 27) scale(0.9)">
                <ellipse cx="3" cy="3" rx="4" ry="2.5" fill="#1D4ED8" transform="rotate(-30 3 3)" />
                <ellipse cx="9" cy="3" rx="4" ry="2.5" fill="#1D4ED8" transform="rotate(30 9 3)" />
                <circle cx="6" cy="3" r="2" fill="#FBBF24" />
              </g>
            </g>
          ) : (
            /* CABELO MENINO: Corte Curto Masculino Esportivo/Infantil com Mechas Angulares (SEM COQUE) */
            <g filter={`url(#${prefix}brilhoSuave)`}>
              {/* Contorno do cabelo curto: costeletas, nuca e mechas espetadas esportivas */}
              <path
                d="M74 47
                   L75 51 L77 47
                   C74 38 77 28 85 24
                   L87 18 L94 23
                   L99 15 L104 22
                   L111 16 L115 24
                   C123 28 126 38 123 47
                   L125 51 L126 47
                   C124 40 120 34 115 35
                   L112 39 L108 34
                   L103 38 L98 33
                   L93 37 L88 34
                   C82 34 76 39 74 47 Z"
                fill={`url(#${prefix}cabeloGradMenino)`}
              />

              {/* Linhas de textura e mechas de luz no cabelo de menino */}
              <path d="M89 24 L92 20 L95 24" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M100 22 L103 17 L106 22" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M110 23 L113 18 L115 23" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M90 35 L94 32 L97 35" stroke="#B45309" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M100 35 L104 32 L107 35" stroke="#B45309" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

export default MascoteAdaoMendes;
