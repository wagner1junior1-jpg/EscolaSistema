import { describe, it, expect, vi } from 'vitest';
import { getDatabase, saveDatabase, EVENTO_ERRO_GRAVACAO } from '../mock/db';

describe('Tratamento de erro de gravação no localStorage', () => {
  it('dispara EVENTO_ERRO_GRAVACAO e não lança erro quando setItem falha por cota', async () => {
    const db = await getDatabase();

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const localSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation((...args) => {
      return Storage.prototype.setItem.apply(window.localStorage, args);
    });

    let chamadasEvento = 0;
    const listener = () => {
      chamadasEvento++;
    };

    window.addEventListener(EVENTO_ERRO_GRAVACAO, listener);

    try {
      expect(() => {
        saveDatabase(db);
      }).not.toThrow();

      expect(chamadasEvento).toBe(1);
    } finally {
      window.removeEventListener(EVENTO_ERRO_GRAVACAO, listener);
      localSpy.mockRestore();
      spy.mockRestore();
    }
  });
});
