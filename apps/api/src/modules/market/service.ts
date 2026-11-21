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
/** Buscas de tickers mudam pouco: resultados ficam um dia em cache. */
export const SEARCH_TTL = 24 * 60 * 60 * 1000;
/** Entradas máximas por cache; as mais antigas saem primeiro (LRU). */
export const MAX_CACHE_ENTRIES = 500;
/**
 * Orçamento de consultas à fonte por hora. O plano gratuito tem cerca de
 * 15.000 requisições por mês (~20 por hora); o teto absorve picos de uso real
 * e impede que um laço ou cliente defeituoso esgote a cota.
 */
export const UPSTREAM_PER_HOUR = 120;
const HOUR = 60 * 60 * 1000;

export interface MarketResponse extends MarketSnapshot {
  fetchedAt: number;
  /** Última resposta válida reaproveitada após falha da fonte. */
  stale: boolean;
}

/** Mapa com tamanho máximo; leitura e escrita renovam a posição (LRU). */
function boundedMap<K, V>(max: number) {
  const map = new Map<K, V>();
  return {
    get(key: K) {
      const value = map.get(key);
      if (value !== undefined) {
        map.delete(key);
        map.set(key, value);
      }
      return value;
    },
    set(key: K, value: V) {
      map.delete(key);
      map.set(key, value);
      while (map.size > max) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    delete: (key: K) => map.delete(key),
    get size() {
      return map.size;
    },
  };
}

/**
 * Cache em memória do servidor: evita requisições repetidas, compartilha
 * consultas simultâneas e executa uma consulta por vez (limite do plano
 * gratuito). Caches e falhas têm tamanho máximo, e um orçamento por hora
 * protege a cota da fonte. Nenhum dado de usuário é guardado.
 */
export function createMarketService(
  client: BrapiClient,
  now: () => number = Date.now,
  {
    maxEntries = MAX_CACHE_ENTRIES,
    upstreamPerHour = UPSTREAM_PER_HOUR,
  }: { maxEntries?: number; upstreamPerHour?: number } = {},
) {
  const quotes = boundedMap<
    string,
    { value: MarketSnapshot; fetchedAt: number }
  >(maxEntries);
  const failures = boundedMap<string, { error: MarketError; at: number }>(
    maxEntries,
  );
  const pending = new Map<string, Promise<MarketResponse>>();
  const searches = boundedMap<string, { value: TickerMatch[]; at: number }>(
    maxEntries,
  );
  const searchFailures = boundedMap<string, { error: MarketError; at: number }>(
    maxEntries,
  );
  const upstreamCalls: number[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  /** Uma consulta por vez, dentro do orçamento por hora. */
  const serial = <T>(task: () => Promise<T>) => {
    const run = queue.then(() => {
      const time = now();
      while (upstreamCalls.length && time - upstreamCalls[0]! >= HOUR)
        upstreamCalls.shift();
      if (upstreamCalls.length >= upstreamPerHour)
        throw new MarketError(
          'rate_limited',
          'Limite de consultas à fonte atingido nesta hora. Tente mais tarde.',
        );
      upstreamCalls.push(time);
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  };
  const asMarketError = (cause: unknown) =>
    cause instanceof MarketError
      ? cause
      : new MarketError('unavailable', 'Fonte de cotações indisponível.');
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
          const error = asMarketError(cause);
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
      // Falha recente: não consultar a fonte de novo para o mesmo termo.
      const failed = searchFailures.get(key);
      if (failed && now() - failed.at < RETRY_AFTER_FAILURE) throw failed.error;
      try {
        const value = await serial(() => client.search(key));
        searches.set(key, { value, at: now() });
        searchFailures.delete(key);
        return value;
      } catch (cause) {
        // Erro interno do app continua sendo erro interno (500).
        if (!(cause instanceof MarketError)) throw cause;
        searchFailures.set(key, { error: cause, at: now() });
        throw cause;
      }
    },
    /** Tamanho atual dos caches, para testes e diagnóstico. */
    sizes: () => ({
      quotes: quotes.size,
      failures: failures.size,
      searches: searches.size,
      searchFailures: searchFailures.size,
    }),
  };
}
/** Contrato usado pelas rotas; `sizes` é apenas diagnóstico. */
export type MarketService = Pick<
  ReturnType<typeof createMarketService>,
  'quote' | 'search'
>;
