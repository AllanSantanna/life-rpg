import { useEffect, useRef, useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { fetchBitcoinQuote, QUOTE_TTL } from './bitcoinQuote';
import { fetchUsdQuote } from './usdQuote';
import type { BitcoinQuote, UsdQuote } from './types';

const time = (value: number) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

/**
 * Pedido manual de cotação. Reutiliza os clientes existentes, que já aplicam
 * cache de 60 minutos, compartilhamento de requisições, timeout e espera após
 * falhas. Uma cotação ainda válida é devolvida sem nova consulta ao provedor.
 * Somente a cotação é gravada: quantidades e movimentações não mudam.
 */
export function useQuoteRefresh(
  asset: 'BTC' | 'USD',
  last: BitcoinQuote | UsdQuote | undefined,
  onCommand: RecordPageProps['onCommand'],
) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setMessage('Consultando cotação…');
    try {
      const quote =
        asset === 'BTC'
          ? await fetchBitcoinQuote(last as BitcoinQuote | undefined)
          : await fetchUsdQuote(last as UsdQuote | undefined);
      if (!mounted.current) return;
      if (quote.observedAt === last?.observedAt) {
        setMessage(
          `Cotação em cache ainda válida, consultada em ${time(quote.observedAt)}. Nova consulta disponível a partir de ${time(quote.observedAt + QUOTE_TTL)}.`,
        );
        return;
      }
      const failure =
        asset === 'BTC'
          ? onCommand({ type: 'saveQuote', value: quote as BitcoinQuote })
          : onCommand({ type: 'saveUsdQuote', value: quote as UsdQuote });
      setMessage(
        failure ??
          `Cotação atualizada. Horário da fonte: ${time(quote.updatedAt)}.`,
      );
    } catch {
      if (!mounted.current) return;
      setMessage(
        last
          ? `Não foi possível atualizar agora. Mantida a última cotação conhecida (${time(last.updatedAt)}); o valor pode estar desatualizado.`
          : 'Cotação indisponível; os valores usam o custo de aquisição como referência.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, message, refresh };
}
