import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface KatexSegmentProps {
  formula: string;
  displayMode: boolean;
}

const KatexSegment: React.FC<KatexSegmentProps> = ({ formula, displayMode }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      try {
        katex.render(formula, spanRef.current, {
          throwOnError: false,
          strict: false,
          displayMode,
          output: 'htmlAndMathml',
        });
      } catch {
        spanRef.current.textContent = formula;
      }
    }
  }, [formula, displayMode]);

  return (
    <span
      ref={spanRef}
      className={displayMode ? 'block my-1.5 overflow-x-auto' : 'inline-block align-middle mx-0.5'}
    >
      {formula}
    </span>
  );
};

interface MathTextProps {
  text?: string | null;
  className?: string;
}

/**
 * Renderiza texto misto com suporte a fórmulas matemáticas LaTeX/KaTeX
 * delimitadas por $$...$$ (bloco) ou $...$ (inline), sem usar dangerouslySetInnerHTML.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;

  // Expressão regular que captura $$...$$ ou $...$ preservando \$ escapado dentro da fórmula
  const regex = /(\$\$[\s\S]+?\$\$|\$(?:\\\$|[^$\n])+?\$)/g;
  const partes = text.split(regex);

  return (
    <span className={className}>
      {partes.map((parte, index) => {
        if (parte.startsWith('$$') && parte.endsWith('$$') && parte.length > 4) {
          const formula = parte.slice(2, -2).trim();
          return <KatexSegment key={index} formula={formula} displayMode={true} />;
        }
        if (parte.startsWith('$') && parte.endsWith('$') && parte.length > 2) {
          const formula = parte.slice(1, -1).trim();
          return <KatexSegment key={index} formula={formula} displayMode={false} />;
        }
        return <React.Fragment key={index}>{parte}</React.Fragment>;
      })}
    </span>
  );
};
