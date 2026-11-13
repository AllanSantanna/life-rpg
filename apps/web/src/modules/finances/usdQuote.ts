import type { UsdQuote } from './types';
import { QUOTE_TTL } from './bitcoinQuote';
import { shiftDate } from '../records/dates';
import { decimalToUnits } from './monetary';
export function usdQuoteUrl(now: number) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
  const date = (value: string) =>
    `${value.slice(5, 7)}-${value.slice(8, 10)}-${value.slice(0, 4)}`;
  const params = new URLSearchParams({
    '@moeda': "'USD'",
    $filter: "tipoBoletim eq 'Fechamento'",
    '@dataInicial': `'${date(shiftDate(today, -15))}'`,
    '@dataFinalCotacao': `'${date(today)}'`,
    $orderby: 'dataHoraCotacao desc',
    $top: '1',
    $format: 'json',
  });
  return `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?${params}`;
}
export function createUsdQuoteClient() {
  let cached: UsdQuote | undefined;
  let pending: Promise<UsdQuote> | null = null;
  let lastAttempt = 0;
  return function fetchQuote(
    last?: UsdQuote,
    fetcher: typeof fetch = fetch,
    now = Date.now(),
  ): Promise<UsdQuote> {
    const latest = [cached, last]
      .filter((q): q is UsdQuote => !!q)
      .sort((a, b) => b.observedAt - a.observedAt)[0];
    if (
      latest &&
      now >= latest.observedAt &&
      now - latest.observedAt < QUOTE_TTL
    )
      return Promise.resolve(latest);
    if (pending) return pending;
    if (lastAttempt && now - lastAttempt < QUOTE_TTL)
      return Promise.reject(
        new Error('Aguarde a próxima atualização de USD/BRL.'),
      );
    lastAttempt = now;
    pending = (async () => {
      const response = await fetcher(usdQuoteUrl(now), {
        signal: AbortSignal.timeout(15000),
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('PTAX indisponível.');
      const data: unknown = await response.json();
      const row = (
        data as {
          value?: { cotacaoVenda?: unknown; dataHoraCotacao?: unknown }[];
        }
      )?.value?.[0];
      if (
        !row ||
        typeof row.cotacaoVenda !== 'number' ||
        !Number.isFinite(row.cotacaoVenda) ||
        row.cotacaoVenda <= 0 ||
        row.cotacaoVenda > 100000 ||
        typeof row.dataHoraCotacao !== 'string' ||
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
          row.dataHoraCotacao,
        )
      )
        throw new Error('Resposta PTAX inválida.');
      const updatedAt = Date.parse(
        row.dataHoraCotacao.replace(' ', 'T') + '-03:00',
      );
      if (
        !Number.isFinite(updatedAt) ||
        updatedAt <= 0 ||
        updatedAt > now + 60000
      )
        throw new Error('Horário PTAX inválido.');
      const rateUnits = decimalToUnits(row.cotacaoVenda.toFixed(4), 4);
      cached = { rateUnits, updatedAt, observedAt: now };
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
export const fetchUsdQuote = createUsdQuoteClient();
