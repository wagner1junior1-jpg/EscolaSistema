/**
 * SaberPontual — Leitura em Voz Alta (SpeechSynthesis)
 * 
 * Lê enunciados e alternativas em português do Brasil (pt-BR).
 */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function pararFala(): void {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function falarQuestao(
  enunciado: string,
  alternativas: Array<{ letra: string; texto: string }>,
  onStart?: () => void,
  onEnd?: () => void
): void {
  if (!isSpeechSupported()) return;

  pararFala();

  const textoAlts = alternativas
    .map((a) => `Alternativa ${a.letra}: ${a.texto}`)
    .join('. ');

  const textoCompleto = `${enunciado}. ${textoAlts}`;
  const utterance = new SpeechSynthesisUtterance(textoCompleto);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.95; // Leitura clara e amigável

  if (onStart) {
    utterance.onstart = () => onStart();
  }

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    if (onEnd) onEnd();
  }
}
