import {
  MarketError,
  type BrapiClient,
  type MarketSnapshot,
  type TickerMatch,
} from './brapi.js';

/** A fonte atualiza o plano gratuito a cada ~30 minutos. */
export const QUOTE_TTL = 30 * 60 * 1000;
/** Espera após falha antes de consultar o mesmo ticker de novo. */
export const RETRY_AFTER_FAILURE = 5 * 60 * 1000;
const SEARCH_TTL = 24 * 60 * 60 * 1000;

export interface MarketResponse extends MarketSnapshot {
  fetchedAt: number;
  /** Última resposta válida reaproveitada após falha da fonte. */
  stale: boolean;
}

/**
 * Cache em memória do servidor: evita requisições repetidas, compartilha
 * consultas simultâneas e executa uma consulta por vez (limite do plano
 * gratuito). Nenhum dado de usuário é guardado.
 */
export function createMarketService(
  client: BrapiClient,
  now: () => number = Date.now,
) {
  const quotes = new Map<
    string,
    { value: MarketSnapshot; fetchedAt: number }
  >();
  const failures = new Map<string, { error: MarketError; at: number }>();
  const pending = new Map<string, Promise<MarketResponse>>();
  const searches = new Map<string, { value: TickerMatch[]; at: number }>();
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>) => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  function fallback(ticker: string, error: MarketError): MarketResponse {
    const cached = quotes.get(ticker);
    if (!cached) throw error;
    return { ...cached.value, fetchedAt: cached.fetchedAt, stale: true };
  }
  return {
    quote(ticker: string): Promise<MarketResponse> {
      const cached = quotes.get(ticker);
      if (cached && now() - cached.fetchedAt < QUOTE_TTL)
        return Promise.resolve({
          ...cached.value,
          fetchedAt: cached.fetchedAt,
          stale: false,
        });
      const failed = failures.get(ticker);
      if (failed && now() - failed.at < RETRY_AFTER_FAILURE)
        return Promise.resolve().then(() => fallback(ticker, failed.error));
      const running = pending.get(ticker);
      if (running) return running;
      const request = serial(() => client.quote(ticker))
        .then((value) => {
          const fetchedAt = now();
          quotes.set(ticker, { value, fetchedAt });
          failures.delete(ticker);
          return { ...value, fetchedAt, stale: false };
        })
        .catch((cause: unknown) => {
          const error =
            cause instanceof MarketError
              ? cause
              : new MarketError(
                  'unavailable',
                  'Fonte de cotações indisponível.',
                );
          failures.set(ticker, { error, at: now() });
          return fallback(ticker, error);
        })
        .finally(() => pending.delete(ticker));
      pending.set(ticker, request);
      return request;
    },
    async search(term: string) {
      const key = term.toUpperCase();
      const cached = searches.get(key);
      if (cached && now() - cached.at < SEARCH_TTL) return cached.value;
      const value = await serial(() => client.search(key));
      searches.set(key, { value, at: now() });
      return value;
    },
  };
}
export type MarketService = ReturnType<typeof createMarketService>;
