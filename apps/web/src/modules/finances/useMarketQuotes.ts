import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { MARKET_TTL, marketClient, type MarketData } from './marketQuote';
import { isMarketCategory } from './types';

export interface MarketState {
  data?: MarketData | undefined;
  error: string;
  loading: boolean;
}
export type MarketStates = Record<string, MarketState>;
export interface MarketTracker {
  states: MarketStates;
  refresh: (ticker: string) => Promise<string>;
}

const time = (value: number) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

/**
 * Acompanha somente os tickers de ações e FIIs cadastrados. Consulta um por
 * vez a cada 30 minutos enquanto o aplicativo está aberto; grava a cotação
 * apenas quando ela muda (sem receita, despesa ou XP).
 */
export function useMarketQuotes({
  records,
  onCommand,
}: Pick<RecordPageProps, 'records' | 'onCommand'>): MarketTracker {
  const callback = useRef(onCommand);
  const stored = useRef(records.finance?.marketQuotes ?? []);
  const [states, setStates] = useState<MarketStates>({});
  const key = [
    ...new Set(
      records.investments
        .filter((item) => isMarketCategory(item.category) && item.ticker)
        .map((item) => item.ticker!),
    ),
  ]
    .sort()
    .join(',');
  const tickers = useMemo(() => (key ? key.split(',') : []), [key]);
  useEffect(() => {
    callback.current = onCommand;
    stored.current = records.finance?.marketQuotes ?? [];
  });
  const save = useCallback((data: MarketData) => {
    const last = stored.current
      .filter((item) => item.ticker === data.quote.ticker)
      .at(-1);
    if (
      last?.marketTime === data.quote.marketTime &&
      last.priceCents === data.quote.priceCents
    )
      return null;
    return callback.current({ type: 'saveMarketQuote', value: data.quote });
  }, []);
  const load = useCallback(
    async (ticker: string, force = false) => {
      setStates((value) => ({
        ...value,
        [ticker]: {
          ...value[ticker],
          error: value[ticker]?.error ?? '',
          loading: true,
        },
      }));
      try {
        const data = await marketClient.fetch(ticker, { force });
        const failure = save(data);
        setStates((value) => ({
          ...value,
          [ticker]: {
            data,
            error:
              failure ??
              (data.stale
                ? 'Fonte indisponível; exibindo a última cotação obtida pelo servidor.'
                : ''),
            loading: false,
          },
        }));
        return data;
      } catch (cause) {
        setStates((value) => ({
          ...value,
          [ticker]: {
            data: value[ticker]?.data ?? marketClient.cached(ticker),
            error:
              cause instanceof Error
                ? cause.message
                : 'Não foi possível consultar a cotação.',
            loading: false,
          },
        }));
        throw cause;
      }
    },
    [save],
  );
  useEffect(() => {
    if (!tickers.length) return;
    let active = true;
    async function update() {
      for (const ticker of tickers) {
        if (!active) return;
        await load(ticker).catch(() => undefined);
      }
    }
    void update();
    const timer = window.setInterval(() => void update(), MARKET_TTL);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [tickers, load]);
  const refresh = useCallback(
    async (ticker: string) => {
      const before = marketClient.cached(ticker);
      try {
        const data = await load(ticker, true);
        return data === before
          ? `Cotação em cache ainda válida, obtida em ${time(data.quote.observedAt)}. A fonte gratuita atualiza a cada 30 minutos.`
          : `Cotação atualizada. Horário da fonte: ${time(data.quote.marketTime)}.`;
      } catch (cause) {
        return `${cause instanceof Error ? cause.message : 'Não foi possível atualizar.'} Mantida a última cotação conhecida; o valor pode estar desatualizado.`;
      }
    },
    [load],
  );
  return { states, refresh };
}
