import { describe, it, expect } from 'vitest';
import { discursivaPendente } from '../calculos';

describe('discursivaPendente (regra única de discursiva aguardando correção)', () => {
  const discursiva = { tipo: 'discursiva' as const };
  const objetiva = { tipo: 'objetiva' as const };

  it('é pendente quando a discursiva está marcada como pendente', () => {
    expect(discursivaPendente(discursiva, { correcao: 'pendente' })).toBe(true);
  });

  it('é pendente quando a discursiva respondida ainda não tem correção', () => {
    expect(discursivaPendente(discursiva, { correcao: null })).toBe(true);
    expect(discursivaPendente(discursiva, {})).toBe(true);
  });

  it('não é pendente depois de corrigida (certo, parcial, errado ou nota livre)', () => {
    expect(discursivaPendente(discursiva, { correcao: 'certo' })).toBe(false);
    expect(discursivaPendente(discursiva, { correcao: 'parcial' })).toBe(false);
    expect(discursivaPendente(discursiva, { correcao: 'errado' })).toBe(false);
    expect(discursivaPendente(discursiva, { correcao: 'parcial', pontuacao: 75 })).toBe(false);
  });

  it('discursiva sem resposta não é pendente', () => {
    expect(discursivaPendente(discursiva, undefined)).toBe(false);
    expect(discursivaPendente(discursiva, null)).toBe(false);
  });

  it('questão objetiva ou ausente nunca é pendente', () => {
    expect(discursivaPendente(objetiva, { acertou: false })).toBe(false);
    expect(discursivaPendente(objetiva, { correcao: 'pendente' })).toBe(false);
    expect(discursivaPendente(null, { correcao: 'pendente' })).toBe(false);
  });
});
