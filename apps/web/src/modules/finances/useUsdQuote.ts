import { useEffect, useRef, useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { QUOTE_TTL } from './bitcoinQuote';
import { fetchUsdQuote } from './usdQuote';
export function useUsdQuote({
  records,
  onCommand,
}: Pick<RecordPageProps, 'records' | 'onCommand'>) {
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const callback = useRef(onCommand);
  const enabled = records.investments.some(
    (item) => item.category === 'Dólar (USD)',
  );
  const last = records.finance?.usdQuotes?.at(-1);
  useEffect(() => {
    callback.current = onCommand;
  }, [onCommand]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function update() {
      setClock(Date.now());
      try {
        const quote = await fetchUsdQuote(last);
        if (active) {
          if (quote.observedAt !== last?.observedAt) {
            const failure = callback.current({
              type: 'saveUsdQuote',
              value: quote,
            });
            if (failure) throw new Error(failure);
          }
          setError('');
        }
      } catch {
        if (active)
          setError(
            'PTAX indisponível. Mantida a última referência conhecida; nova tentativa em até 60 minutos.',
          );
      }
    }
    void update();
    const timer = window.setInterval(() => void update(), QUOTE_TTL);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [last, enabled]);
  return {
    quote: last,
    error,
    stale: !!last && clock - last.updatedAt >= QUOTE_TTL,
  };
}
