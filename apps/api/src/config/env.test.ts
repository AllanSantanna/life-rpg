import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

describe('Configuração do ambiente', () => {
  it.each(['abc', '0', '65536', '1.5'])('rejeita PORT inválida: %s', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow();
  });
  it('rejeita uma origem com caminho', () => {
    expect(() =>
      loadConfig({ WEB_ORIGIN: 'http://localhost:5173/path' }),
    ).toThrow();
  });
});
