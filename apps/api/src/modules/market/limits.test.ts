import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import {
  createBrapiClient,
  MarketError,
  type BrapiClient,
  type MarketSnapshot,
} from './brapi.js';
import { createRateLimiter } from './rateLimit.js';
import { createMarketService, RETRY_AFTER_FAILURE } from './service.js';

const snapshot = (ticker: string): MarketSnapshot => ({
  ticker,
  name: ticker,
  priceCents: 1000,
  previousCloseCents: 990,
  marketTime: 1,
  history: [],
});
function fakeClient(overrides: Partial<BrapiClient> = {}): BrapiClient {
  return {
    quote: vi.fn(async (ticker: string) => snapshot(ticker)),
    search: vi.fn(async () => []),
    ...overrides,
  } as BrapiClient;
}
const invalidJson = (async () =>
  new Response('<html>erro</html>', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as unknown as typeof fetch;

describe('B-07: classificação de respostas da fonte', () => {
  it('JSON inválido é erro da fonte (502), na cotação e na busca', async () => {
    const client = createBrapiClient({ fetcher: invalidJson });
    await expect(client.quote('VALE3')).rejects.toMatchObject({
      code: 'invalid',
    });
    const app = createApp('http://127.0.0.1:5173', {
      market: createMarketService(client),
    });
    const quote = await request(app).get('/market/quotes/VALE3');
    expect(quote.status).toBe(502);
    expect(quote.body.code).toBe('invalid');
    const search = await request(app).get('/market/tickers?search=vale');
    expect(search.status).toBe(502);
    expect(search.body).toEqual({
      error: 'Resposta inválida da fonte de cotações.',
      code: 'invalid',
    });
  });

  it('acesso recusado não revela configuração ao cliente; limite envia Retry-After', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createApp('http://127.0.0.1:5173', {
      market: createMarketService(
        createBrapiClient({
          fetcher: (async () =>
            new Response('{}', { status: 401 })) as unknown as typeof fetch,
        }),
      ),
    });
    const denied = await request(app).get('/market/quotes/BBAS3');
    expect(denied.status).toBe(502);
    expect(JSON.stringify(denied.body)).not.toMatch(/BRAPI|token/i);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/BRAPI_TOKEN/));
    const limited = createApp('http://127.0.0.1:5173', {
      market: createMarketService(
        fakeClient({
          quote: vi.fn(async () => {
            throw new MarketError('rate_limited', 'Limite atingido.');
          }),
        }),
      ),
    });
    const response = await request(limited).get('/market/quotes/VALE3');
    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe(
      String(RETRY_AFTER_FAILURE / 1000),
    );
  });

  it('erro interno do app na busca continua 500 e não é guardado como falha da fonte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const search = vi.fn(async () => {
      throw new TypeError('defeito interno');
    });
    const service = createMarketService(fakeClient({ search }));
    const app = createApp('http://127.0.0.1:5173', { market: service });
    expect((await request(app).get('/market/tickers?search=vale')).status).toBe(
      500,
    );
    expect((await request(app).get('/market/tickers?search=vale')).status).toBe(
      500,
    );
    expect(search).toHaveBeenCalledTimes(2);
    expect(service.sizes().searchFailures).toBe(0);
  });
});

describe('M-04: caches limitados e proteção da cota', () => {
  it('cada cache tem tamanho máximo e mantém os itens usados recentemente', async () => {
    const client = fakeClient();
    let time = 0;
    const service = createMarketService(client, () => time, { maxEntries: 3 });
    for (const ticker of ['AAAA3', 'BBBB3', 'CCCC3'])
      await service.quote(ticker);
    await service.quote('AAAA3'); // renovado
    await service.quote('DDDD3');
    await service.quote('EEEE3');
    expect(service.sizes().quotes).toBe(3);
    const calls = (client.quote as ReturnType<typeof vi.fn>).mock.calls.length;
    await service.quote('AAAA3'); // renovado antes: continua em cache
    expect(client.quote).toHaveBeenCalledTimes(calls);
    await service.quote('BBBB3'); // o menos usado foi descartado
    expect(client.quote).toHaveBeenCalledTimes(calls + 1);
    time += 1;
  });

  it('busca com falha não consulta a fonte de novo antes da espera', async () => {
    let time = 0;
    const search = vi.fn(async () => {
      throw new MarketError('unavailable', 'Fonte de cotações indisponível.');
    });
    const service = createMarketService(fakeClient({ search }), () => time);
    await expect(service.search('vale')).rejects.toMatchObject({
      code: 'unavailable',
    });
    await expect(service.search('VALE')).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(search).toHaveBeenCalledTimes(1);
    time += RETRY_AFTER_FAILURE;
    await expect(service.search('vale')).rejects.toBeInstanceOf(MarketError);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('orçamento por hora protege a cota e devolve a última cotação conhecida', async () => {
    let time = 0;
    const client = fakeClient();
    const service = createMarketService(client, () => time, {
      upstreamPerHour: 2,
    });
    await service.quote('AAAA3');
    await service.quote('BBBB3');
    await expect(service.quote('CCCC3')).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(client.quote).toHaveBeenCalledTimes(2);
    // Cotação expirada com orçamento esgotado: a última conhecida, desatualizada.
    time += 31 * 60 * 1000;
    expect(await service.quote('AAAA3')).toMatchObject({
      ticker: 'AAAA3',
      stale: true,
    });
    time += 60 * 60 * 1000;
    expect(await service.quote('CCCC3')).toMatchObject({ stale: false });
  });

  it('limite por cliente responde 429 com Retry-After e libera na próxima janela', async () => {
    let time = 0;
    const app = createApp('http://127.0.0.1:5173', {
      market: createMarketService(fakeClient()),
    });
    // Rotas com limitador injetado para o teste.
    const { marketRoutes } = await import('./routes.js');
    const express = (await import('express')).default;
    const limited = express();
    limited.use(
      marketRoutes(
        createMarketService(fakeClient()),
        createRateLimiter({ limit: 2, windowMs: 60_000, now: () => time }),
      ),
    );
    expect((await request(limited).get('/market/quotes/VALE3')).status).toBe(
      200,
    );
    expect((await request(limited).get('/market/quotes/VALE3')).status).toBe(
      200,
    );
    const blocked = await request(limited).get('/market/quotes/VALE3');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('60');
    expect(blocked.body.code).toBe('too_many_requests');
    time += 60_000;
    expect((await request(limited).get('/market/quotes/VALE3')).status).toBe(
      200,
    );
    // O app real aplica o limitador padrão sem afetar uso normal.
    expect((await request(app).get('/market/quotes/VALE3')).status).toBe(200);
  });
});
