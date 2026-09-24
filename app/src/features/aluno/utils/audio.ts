/**
 * SaberPontual — Efeitos Sonoros com Web Audio API
 * 
 * Sons sintetizados puros sem arquivos externos ou dependências.
 * Respeita a preferência do usuário em localStorage ('saberpontual_som').
 */

const STORAGE_KEY_SOM = 'saberpontual_som';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtxClass();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSomHabilitado(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY_SOM) !== 'false';
}

export function setSomHabilitado(ativo: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SOM, ativo ? 'true' : 'false');
}

/**
 * Toca tom suave com frequência, duração e envelope de ganho
 */
function tocarNota(freq: number, startTime: number, duration: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // Envelope ADSR simples (suave para não estalar)
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Som de Acerto (dois tons ascendentes alegres e suaves)
 */
export function tocarSomAcerto(): void {
  if (!isSomHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  tocarNota(523.25, now, 0.12, ctx);        // C5
  tocarNota(659.25, now + 0.1, 0.25, ctx);   // E5
}

/**
 * Som de Erro (tom suave e curto, pedagógico e acolhedor)
 */
export function tocarSomErro(): void {
  if (!isSomHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  tocarNota(293.66, now, 0.12, ctx);        // D4
  tocarNota(246.94, now + 0.1, 0.22, ctx);   // B3
}

/**
 * Som de Fim de Atividade (pequena fanfarra harmoniosa de conclusão)
 */
export function tocarSomFim(): void {
  if (!isSomHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  tocarNota(523.25, now, 0.1, ctx);         // C5
  tocarNota(659.25, now + 0.09, 0.1, ctx);  // E5
  tocarNota(783.99, now + 0.18, 0.12, ctx); // G5
  tocarNota(1046.5, now + 0.28, 0.35, ctx); // C6
}
