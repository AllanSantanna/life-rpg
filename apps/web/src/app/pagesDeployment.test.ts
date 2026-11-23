import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appPath,
  classFromPath,
  publicPath,
  viewFromPath,
} from './useUrlNavigation';
import {
  createMarketClient,
  MARKET_API_UNAVAILABLE,
  resolveMarketApiUrl,
} from '../modules/finances/marketQuote';

// GitHub Pages publica em /life-rpg/; local e testes usam a raiz.
afterEach(() => vi.unstubAllEnvs());

describe('rotas sob a base de publicação', () => {
  it('converte caminhos publicados em rotas do app e vice-versa', () => {
    const base = '/life-rpg';
    expect(appPath('/life-rpg/', base)).toBe('/');
    expect(appPath('/life-rpg', base)).toBe('/');
    expect(appPath('/life-rpg/perfil', base)).toBe('/perfil');
    expect(appPath('/life-rpg/perfil/', base)).toBe('/perfil');
    // Prefixo parecido não é a base.
    expect(appPath('/life-rpgx/perfil', base)).toBe('/life-rpgx/perfil');
    expect(publicPath('/', base)).toBe('/life-rpg/');
    expect(publicPath('/financas', base)).toBe('/life-rpg/financas');
  });

  it('mantém a raiz inalterada no endereço local', () => {
    expect(appPath('/perfil', '')).toBe('/perfil');
    expect(publicPath('/', '')).toBe('/');
    expect(publicPath('/treinos', '')).toBe('/treinos');
    expect(viewFromPath('/perfil')).toBe('profile');
  });

  it('resolve a galeria e o detalhe das classes, também sob /life-rpg/', () => {
    expect(appPath('/life-rpg/perfil/classes/guerreiro', '/life-rpg')).toBe(
      '/perfil/classes/guerreiro',
    );
    expect(publicPath('/perfil/classes', '/life-rpg')).toBe(
      '/life-rpg/perfil/classes',
    );
    expect(viewFromPath('/perfil/classes')).toBe('classes');
    expect(classFromPath('/perfil/classes')).toBeNull();
    expect(viewFromPath('/perfil/classes/guardiao')).toBe('classes');
    expect(classFromPath('/perfil/classes/guardiao/')).toBe('guardiao');
    // Caminhos mais profundos não são rotas do app.
    expect(viewFromPath('/perfil/classes/guardiao/extra')).toBe('home');
  });
});

describe('cotações sem servidor configurado', () => {
  it('só usa o servidor local padrão em desenvolvimento', () => {
    expect(resolveMarketApiUrl(undefined, true)).toBe('http://localhost:3001');
    expect(resolveMarketApiUrl('', false)).toBeNull();
    expect(resolveMarketApiUrl(undefined, false)).toBeNull();
    expect(resolveMarketApiUrl(' https://api.example/ ', false)).toBe(
      'https://api.example',
    );
  });

  it('falha com mensagem clara, sem requisição de rede', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('DEV', false);
    const fetcher = vi.fn();
    const client = createMarketClient();
    await expect(
      client.fetch('VALE3', { fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow(MARKET_API_UNAVAILABLE);
    await expect(
      client.search('VALE', fetcher as unknown as typeof fetch),
    ).rejects.toThrow(/indisponível nesta versão/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
