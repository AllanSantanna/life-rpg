import {
  TICKER_PATTERN,
  type MarketPricePoint,
  type MarketQuote,
} from './types';

/** Mesmo intervalo do servidor: a fonte gratuita atualiza a cada ~30 min. */
export const MARKET_TTL = 30 * 60 * 1000;
export const MARKET_RETRY = 5 * 60 * 1000;

export interface MarketData {
  quote: MarketQuote;
  name: string;
  history: MarketPricePoint[];
  /** O servidor reaproveitou a última resposta válida após falha da fonte. */
  stale: boolean;
}
export interface TickerMatch {
  ticker: string;
  name: string;
  type: string;
}

/** Endereço do apps/api, que guarda o token da brapi fora do navegador. */
export function marketApiUrl() {
  return (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}
const cents = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= 1e12;

export function parseMarketResponse(
  body: unknown,
  ticker: string,
  observedAt: number,
): MarketData {
  const data = body as Record<string, unknown> | null;
  if (
    !data ||
    data.ticker !== ticker ||
    !cents(data.priceCents) ||
    (data.previousCloseCents !== undefined &&
      !cents(data.previousCloseCents)) ||
    typeof data.marketTime !== 'number' ||
    !(data.marketTime > 0) ||
    data.marketTime > observedAt + 60000 ||
    !Array.isArray(data.history)
  )
    throw new Error('Resposta de cotação inválida.');
  const history = (data.history as Record<string, unknown>[])
    .filter(
      (point): point is { date: string; closeCents: number } =>
        typeof point?.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
        cents(point.closeCents),
    )
    .map(({ date, closeCents }) => ({ date, closeCents }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    quote: {
      ticker,
      priceCents: data.priceCents,
      ...(data.previousCloseCents !== undefined
        ? { previousCloseCents: data.previousCloseCents as number }
        : {}),
      marketTime: data.marketTime,
      observedAt,
    },
    name: typeof data.name === 'string' ? data.name : ticker,
    history,
    stale: data.stale === true,
  };
}

/** Cache por ticker, requisições compartilhadas e espera após falhas. */
export function createMarketClient() {
  const cache = new Map<string, { value: MarketData; at: number }>();
  const pending = new Map<string, Promise<MarketData>>();
  const failed = new Map<string, number>();
  return {
    cached(ticker: string) {
      return cache.get(ticker)?.value;
    },
    fetch(
      ticker: string,
      { force = false, fetcher = fetch, now = Date.now() } = {},
    ): Promise<MarketData> {
      if (!TICKER_PATTERN.test(ticker))
        return Promise.reject(new Error('Ticker inválido.'));
      const hit = cache.get(ticker);
      // Atualização manual ainda respeita o intervalo da fonte.
      if (hit && now - hit.at < (force ? MARKET_RETRY : MARKET_TTL))
        return Promise.resolve(hit.value);
      const running = pending.get(ticker);
      if (running) return running;
      const lastFailure = failed.get(ticker);
      if (lastFailure !== undefined && now - lastFailure < MARKET_RETRY)
        return Promise.reject(
          new Error(
            'Cotação indisponível. Nova tentativa automática em alguns minutos.',
          ),
        );
      const request = (async () => {
        const response = await fetcher(
          `${marketApiUrl()}/market/quotes/${ticker}`,
          { signal: AbortSignal.timeout(15000), credentials: 'omit' },
        );
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            typeof (body as { error?: unknown })?.error === 'string'
              ? (body as { error: string }).error
              : 'Não foi possível consultar a cotação.',
          );
        const value = parseMarketResponse(body, ticker, now);
        cache.set(ticker, { value, at: now });
        failed.delete(ticker);
        return value;
      })()
        .catch((error: unknown) => {
          failed.set(ticker, now);
          throw error instanceof Error
            ? error
            : new Error('Não foi possível consultar a cotação.');
        })
        .finally(() => pending.delete(ticker));
      pending.set(ticker, request);
      return request;
    },
    async search(term: string, fetcher: typeof fetch = fetch) {
      const response = await fetcher(
        `${marketApiUrl()}/market/tickers?search=${encodeURIComponent(term)}`,
        { signal: AbortSignal.timeout(15000), credentials: 'omit' },
      );
      const body = (await response.json().catch(() => null)) as {
        results?: TickerMatch[];
        error?: string;
      } | null;
      if (!response.ok || !Array.isArray(body?.results))
        throw new Error(body?.error ?? 'Pesquisa de tickers indisponível.');
      return body.results.filter(
        (item) =>
          typeof item.ticker === 'string' && TICKER_PATTERN.test(item.ticker),
      );
    },
  };
}
export const marketClient = createMarketClient();
