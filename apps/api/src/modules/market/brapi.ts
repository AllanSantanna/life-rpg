/**
 * Cliente da brapi.dev (https://brapi.dev/docs/acoes). O token fica somente no
 * servidor e é enviado no header Authorization, como recomenda a documentação.
 * Sem token, a fonte atende apenas os tickers de teste (PETR4, MGLU3, VALE3,
 * ITUB4).
 */
export const TICKER_PATTERN = /^[A-Z][A-Z0-9]{3}\d{1,2}$/;
/** Plano gratuito: histórico de até 3 meses e intervalo diário. */
export const HISTORY_RANGE = '3mo';

export interface MarketPoint {
  date: string;
  closeCents: number;
}
export interface MarketSnapshot {
  ticker: string;
  name: string;
  priceCents: number;
  previousCloseCents?: number;
  /** Horário da cotação na fonte, em milissegundos. */
  marketTime: number;
  history: MarketPoint[];
}
export interface TickerMatch {
  ticker: string;
  name: string;
  type: string;
}
export type MarketErrorCode =
  'not_found' | 'unauthorized' | 'rate_limited' | 'unavailable';
export class MarketError extends Error {
  constructor(
    readonly code: MarketErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const toCents = (value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value < 1e10
    ? Math.round(value * 100)
    : undefined;

/** Data civil de São Paulo, para alinhar pregões e o calendário do app. */
export function saoPauloDate(milliseconds: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(milliseconds));
}

function failure(status: number) {
  if (status === 404)
    return new MarketError('not_found', 'Ticker não encontrado na fonte.');
  if (status === 401 || status === 403)
    return new MarketError(
      'unauthorized',
      'A fonte exige um token para este ticker. Configure BRAPI_TOKEN no servidor.',
    );
  if (status === 429)
    return new MarketError(
      'rate_limited',
      'Limite de consultas da fonte atingido. Tente mais tarde.',
    );
  return new MarketError('unavailable', 'Fonte de cotações indisponível.');
}

export function parseQuote(body: unknown, ticker: string): MarketSnapshot {
  const result = (body as { results?: unknown[] } | null)?.results?.[0] as
    Record<string, unknown> | undefined;
  const priceCents = toCents(result?.regularMarketPrice);
  const time =
    typeof result?.regularMarketTime === 'string'
      ? Date.parse(result.regularMarketTime)
      : typeof result?.regularMarketTime === 'number'
        ? result.regularMarketTime *
          (result.regularMarketTime < 1e12 ? 1000 : 1)
        : NaN;
  if (
    !result ||
    String(result.symbol ?? '').toUpperCase() !== ticker ||
    priceCents === undefined ||
    !Number.isFinite(time) ||
    time <= 0
  )
    throw new MarketError('unavailable', 'Resposta de cotação inválida.');
  const byDate = new Map<string, number>();
  for (const point of Array.isArray(result.historicalDataPrice)
    ? (result.historicalDataPrice as Record<string, unknown>[])
    : []) {
    const close = toCents(point?.close);
    const date =
      typeof point?.date === 'number' && point.date > 0
        ? saoPauloDate(point.date * (point.date < 1e12 ? 1000 : 1))
        : undefined;
    // Somente pregões reais; nenhum ponto é criado para dias sem negociação.
    if (close !== undefined && date) byDate.set(date, close);
  }
  const previousCloseCents = toCents(result.regularMarketPreviousClose);
  const name = [result.longName, result.shortName].find(
    (value): value is string => typeof value === 'string' && !!value.trim(),
  );
  return {
    ticker,
    name: name?.trim() ?? ticker,
    priceCents,
    ...(previousCloseCents !== undefined ? { previousCloseCents } : {}),
    marketTime: time,
    history: [...byDate]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, closeCents]) => ({ date, closeCents })),
  };
}

export function createBrapiClient({
  token,
  baseUrl = 'https://brapi.dev',
  fetcher = fetch,
}: {
  token?: string | undefined;
  baseUrl?: string;
  fetcher?: typeof fetch;
}) {
  async function get(path: string) {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new MarketError('unavailable', 'Fonte de cotações indisponível.');
    }
    if (!response.ok) throw failure(response.status);
    return response.json() as Promise<unknown>;
  }
  return {
    async quote(ticker: string) {
      return parseQuote(
        await get(
          `/api/quote/${encodeURIComponent(ticker)}?range=${HISTORY_RANGE}&interval=1d`,
        ),
        ticker,
      );
    },
    async search(term: string): Promise<TickerMatch[]> {
      const body = (await get(
        `/api/quote/list?search=${encodeURIComponent(term)}&limit=10`,
      )) as { stocks?: Record<string, unknown>[] } | null;
      return (body?.stocks ?? [])
        .filter(
          (item) =>
            typeof item.stock === 'string' &&
            TICKER_PATTERN.test(item.stock) &&
            (item.type === 'stock' || item.type === 'fund'),
        )
        .map((item) => ({
          ticker: String(item.stock),
          name: typeof item.name === 'string' ? item.name : String(item.stock),
          type: String(item.type),
        }));
    },
  };
}
export type BrapiClient = ReturnType<typeof createBrapiClient>;
