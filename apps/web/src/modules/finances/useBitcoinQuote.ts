import { useEffect, useRef, useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { fetchBitcoinQuote, QUOTE_TTL } from './bitcoinQuote';
export function useBitcoinQuote({
  records,
  onCommand,
}: Pick<RecordPageProps, 'records' | 'onCommand'>) {
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const callback = useRef(onCommand);
  const enabled = records.investments.some(
    (item) => item.category === 'Bitcoin',
  );
  const last = records.finance?.quotes.at(-1);
  useEffect(() => {
    callback.current = onCommand;
  }, [onCommand]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function update() {
      setClock(Date.now());
      try {
        const quote = await fetchBitcoinQuote(last);
        if (active) {
          if (quote.observedAt !== last?.observedAt) {
            const failure = callback.current({
              type: 'saveQuote',
              value: quote,
            });
            if (failure) throw new Error(failure);
          }
          setError('');
        }
      } catch {
        if (active)
          setError(
            'Cotação indisponível. Mantida a última conhecida; nova tentativa em até 60 minutos.',
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
