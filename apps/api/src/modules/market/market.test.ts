import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import {
  createBrapiClient,
  MarketError,
  parseQuote,
  type MarketSnapshot,
} from './brapi.js';
import {
  createMarketService,
  QUOTE_TTL,
  RETRY_AFTER_FAILURE,
} from './service.js';

// Respostas simuladas no formato documentado em https://brapi.dev/docs/acoes.
const body = {
  results: [
    {
      symbol: 'VALE3',
      shortName: 'VALE ON NM',
      longName: 'Vale S.A.',
      regularMarketPrice: 61.2,
      regularMarketPreviousClose: 60.45,
      regularMarketTime: '2026-11-18T19:30:00.000Z',
      historicalDataPrice: [
        { date: 1763380800, close: 60.1 },
        { date: 1763467200, close: 60.45 },
        { date: 1763467200, close: 60.45 },
        { date: 1763553600, close: null },
      ],
    },
  ],
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const snapshot: MarketSnapshot = {
  ticker: 'VALE3',
  name: 'Vale S.A.',
  priceCents: 6120,
  previousCloseCents: 6045,
  marketTime: 1,
  history: [],
};

describe('cliente brapi', () => {
  it('envia o token apenas no header e normaliza cotação e histórico', async () => {
    const fetcher = vi.fn(async () => json(body));
    const client = createBrapiClient({
      token: 'token-secreto',
      fetcher: fetcher as unknown as typeof fetch,
    });
    const quote = await client.quote('VALE3');
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://brapi.dev/api/quote/VALE3?range=3mo&interval=1d');
    expect(url).not.toContain('token');
    expect(init.headers).toEqual({ Authorization: 'Bearer token-secreto' });
    expect(quote).toEqual({
      ticker: 'VALE3',
      name: 'Vale S.A.',
      priceCents: 6120,
      previousCloseCents: 6045,
      marketTime: Date.parse('2026-11-18T19:30:00.000Z'),
      history: [
        { date: '2025-11-17', closeCents: 6010 },
        { date: '2025-11-18', closeCents: 6045 },
      ],
    });
  });
  it('não inventa preço nem aceita outro ativo na resposta', () => {
    expect(() => parseQuote({ results: [] }, 'VALE3')).toThrow(MarketError);
    expect(() =>
      parseQuote(
        { results: [{ ...body.results[0], symbol: 'PETR4' }] },
        'VALE3',
      ),
    ).toThrow('Resposta de cotação inválida.');
    expect(() =>
      parseQuote(
        { results: [{ ...body.results[0], regularMarketPrice: 0 }] },
        'VALE3',
      ),
    ).toThrow(MarketError);
  });
  it('traduz erros HTTP sem expor detalhes da fonte', async () => {
    for (const [status, code] of [
      [401, 'unauthorized'],
      [404, 'not_found'],
      [429, 'rate_limited'],
      [500, 'unavailable'],
    ] as const) {
      const client = createBrapiClient({
        fetcher: (async () => json({}, status)) as unknown as typeof fetch,
      });
      await expect(client.quote('BBAS3')).rejects.toMatchObject({ code });
    }
  });
  it('pesquisa somente ações e fundos com ticker válido', async () => {
    const client = createBrapiClient({
      fetcher: (async () =>
        json({
          stocks: [
            { stock: 'HGLG11', name: 'CGHG Logística', type: 'fund' },
            { stock: 'VALE34', name: 'BDR', type: 'bdr' },
            { stock: '^BVSP', name: 'Índice', type: 'stock' },
          ],
        })) as unknown as typeof fetch,
    });
    expect(await client.search('hglg')).toEqual([
      { ticker: 'HGLG11', name: 'CGHG Logística', type: 'fund' },
    ]);
  });
});

describe('serviço de cotações', () => {
  it('usa cache, compartilha consultas simultâneas e consulta uma por vez', async () => {
    let clock = 1_000_000;
    let active = 0;
    let maximum = 0;
    const quote = vi.fn(async (ticker: string) => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return { ...snapshot, ticker };
    });
    const service = createMarketService(
      { quote, search: vi.fn() },
      () => clock,
    );
    const [a, b, c] = await Promise.all([
      service.quote('VALE3'),
      service.quote('VALE3'),
      service.quote('PETR4'),
    ]);
    expect(a).toEqual(b);
    expect(c.ticker).toBe('PETR4');
    expect(quote).toHaveBeenCalledTimes(2);
    expect(maximum).toBe(1);
    clock += QUOTE_TTL - 1;
    await service.quote('VALE3');
    expect(quote).toHaveBeenCalledTimes(2);
    clock += 1;
    await service.quote('VALE3');
    expect(quote).toHaveBeenCalledTimes(3);
  });
  it('mantém a última cotação como desatualizada e espera antes de nova tentativa', async () => {
    let clock = 0;
    const quote = vi
      .fn()
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValue(new MarketError('unavailable', 'fora do ar'));
    const service = createMarketService(
      { quote, search: vi.fn() },
      () => clock,
    );
    expect((await service.quote('VALE3')).stale).toBe(false);
    clock += QUOTE_TTL;
    const stale = await service.quote('VALE3');
    expect(stale).toMatchObject({ priceCents: 6120, stale: true });
    clock += RETRY_AFTER_FAILURE - 1;
    await service.quote('VALE3');
    expect(quote).toHaveBeenCalledTimes(2);
    await expect(service.quote('ITUB4')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});

describe('rotas de mercado', () => {
  const service = {
    quote: vi.fn(async () => ({ ...snapshot, fetchedAt: 5, stale: false })),
    search: vi.fn(async () => [
      { ticker: 'VALE3', name: 'Vale', type: 'stock' },
    ]),
  };
  const app = createApp('http://localhost:5173', { market: service });
  it('valida o ticker e devolve a cotação normalizada', async () => {
    expect((await request(app).get('/market/quotes/vale%3B')).status).toBe(400);
    const response = await request(app).get('/market/quotes/vale3');
    expect(response.status).toBe(200);
    expect(service.quote).toHaveBeenCalledWith('VALE3');
    expect(response.body).toMatchObject({ ticker: 'VALE3', priceCents: 6120 });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('responde erros da fonte em JSON e pesquisa tickers', async () => {
    service.quote.mockRejectedValueOnce(
      new MarketError('unauthorized', 'Configure BRAPI_TOKEN no servidor.'),
    );
    const failure = await request(app).get('/market/quotes/BBAS3');
    expect(failure.status).toBe(502);
    expect(failure.body).toEqual({
      error: 'Configure BRAPI_TOKEN no servidor.',
      code: 'unauthorized',
    });
    expect((await request(app).get('/market/tickers?search=a')).status).toBe(
      400,
    );
    const search = await request(app).get('/market/tickers?search=vale');
    expect(search.body).toEqual({
      results: [{ ticker: 'VALE3', name: 'Vale', type: 'stock' }],
    });
  });
});
