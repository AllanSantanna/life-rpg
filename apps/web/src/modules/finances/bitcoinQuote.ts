import type { BitcoinQuote } from './types';
export const QUOTE_TTL = 60 * 60 * 1000;
export const BITCOIN_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true';
let pending: Promise<BitcoinQuote> | null = null;
let lastAttempt = 0;
let cached: BitcoinQuote | undefined;
/** Compartilha requisições e limita tentativas, inclusive após erros/429. */
export function fetchBitcoinQuote(
  last?: BitcoinQuote,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<BitcoinQuote> {
  const newest = [last, cached]
    .filter((item): item is BitcoinQuote => !!item)
    .sort((a, b) => b.observedAt - a.observedAt)[0];
  if (newest && now - newest.observedAt < QUOTE_TTL && now >= newest.observedAt)
    return Promise.resolve(newest);
  if (pending) return pending;
  if (lastAttempt && now - lastAttempt < QUOTE_TTL)
    return Promise.reject(
      new Error(
        'Cotação indisponível. Nova tentativa automática em até 60 minutos.',
      ),
    );
  lastAttempt = now;
  pending = (async () => {
    const response = await fetcher(BITCOIN_URL, {
      signal: AbortSignal.timeout(15000),
      credentials: 'omit',
    });
    if (!response.ok) throw new Error('Não foi possível consultar a cotação.');
    const data: unknown = await response.json();
    const btc = (
      data as { bitcoin?: { brl?: unknown; last_updated_at?: unknown } }
    )?.bitcoin;
    if (
      !btc ||
      typeof btc.brl !== 'number' ||
      !Number.isFinite(btc.brl) ||
      btc.brl <= 0 ||
      !Number.isSafeInteger(Math.round(btc.brl * 100)) ||
      btc.brl * 100 > 1e12 ||
      typeof btc.last_updated_at !== 'number' ||
      !Number.isFinite(btc.last_updated_at) ||
      btc.last_updated_at <= 0 ||
      btc.last_updated_at * 1000 > now + 60000
    )
      throw new Error('Resposta de cotação inválida.');
    cached = {
      priceCents: Math.round(btc.brl * 100),
      updatedAt: btc.last_updated_at * 1000,
      observedAt: now,
    };
    return cached;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
