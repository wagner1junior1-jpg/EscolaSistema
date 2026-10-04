import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AssinaturaWtj } from '../AssinaturaWtj';

describe('AssinaturaWtj', () => {
  it('renderiza e mostra o texto WTJ Soluções Tecnológicas', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
      root.render(<AssinaturaWtj />);
    });

    expect(container.textContent).toContain('WTJ Soluções Tecnológicas');
    expect(container.textContent).toContain('Desenvolvido por');

    root.unmount();
    container.remove();
  });
});
