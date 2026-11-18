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
  it('aceita token opcional da brapi e exige origem HTTPS', () => {
    expect(loadConfig({}).brapiToken).toBeUndefined();
    expect(loadConfig({ BRAPI_TOKEN: '  abcdefgh123  ' }).brapiToken).toBe(
      'abcdefgh123',
    );
    expect(() => loadConfig({ BRAPI_TOKEN: 'com espaço inválido' })).toThrow();
    expect(() => loadConfig({ BRAPI_BASE_URL: 'http://brapi.dev' })).toThrow();
  });
});
