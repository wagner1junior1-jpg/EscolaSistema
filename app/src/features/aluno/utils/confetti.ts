/**
 * SaberPontual — Disparo de Confetes com canvas-confetti
 * 
 * Regra: respeita estritamente prefers-reduced-motion (docs/ESPECIFICACAO.md 7.2).
 */

import confetti from 'canvas-confetti';

function prefereMovimentoReduzido(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Confete de acerto imediato na questão (modo exercício)
 */
export function dispararConfeteAcerto(): void {
  if (prefereMovimentoReduzido()) return;

  confetti({
    particleCount: 40,
    spread: 60,
    origin: { y: 0.75 },
    colors: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'],
    disableForReducedMotion: true,
  });
}

/**
 * Confete de encerramento da atividade (aproveitamento >= 70%)
 */
export function dispararConfeteFim(): void {
  if (prefereMovimentoReduzido()) return;

  // Lado esquerdo
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.7 },
    colors: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#38bdf8'],
    disableForReducedMotion: true,
  });

  // Lado direito
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#38bdf8'],
      disableForReducedMotion: true,
    });
  }, 180);
}
