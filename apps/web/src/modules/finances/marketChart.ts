import { displayDate, shiftDate } from '../records/dates';
import { satoshis } from './position';
import type { InvestmentEntry, MarketPricePoint, MarketQuote } from './types';

export const marketPeriods = [
  { id: '7d', days: 7, label: '7 dias' },
  { id: '30d', days: 30, label: '30 dias' },
  { id: '90d', days: 90, label: '90 dias' },
  { id: '1y', days: 365, label: '1 ano' },
  { id: 'all', days: null, label: 'Histórico completo' },
] as const;
export type MarketPeriod = (typeof marketPeriods)[number]['id'];
export type MarketView = 'price' | 'position';
export interface MarketChartPoint {
  date: string;
  value: number;
  closeCents: number;
  /** Quantidade possuída no fim do dia (apenas na visão da posição). */
  units?: number;
}
export type Trend = 'up' | 'down' | 'flat';

/** Data civil de São Paulo do horário da fonte. */
export function marketDate(milliseconds: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(milliseconds));
}

/**
 * Fechamentos reais da fonte; a cotação atual entra somente se o pregão dela
 * ainda não estiver no histórico. Dias sem negociação não ganham pontos.
 */
export function priceHistory(
  history: readonly MarketPricePoint[],
  quote?: MarketQuote,
): MarketPricePoint[] {
  const points = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (quote) {
    const date = marketDate(quote.marketTime);
    if (!points.some((point) => point.date === date))
      points.push({ date, closeCents: quote.priceCents });
    points.sort((a, b) => a.date.localeCompare(b.date));
  }
  return points;
}

/** Variação do ativo no dia, contra o fechamento anterior da fonte. */
export function dailyChange(quote?: MarketQuote) {
  if (!quote?.previousCloseCents) return null;
  const change = quote.priceCents - quote.previousCloseCents;
  return {
    change,
    percent: (change / quote.previousCloseCents) * 100,
  };
}

export function trendOf(points: readonly { value: number }[]): Trend {
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  if (first === undefined || last === undefined || first === last)
    return 'flat';
  return last > first ? 'up' : 'down';
}

/** Últimos pregões disponíveis para o gráfico compacto do cartão. */
export function compactSeries(
  history: readonly MarketPricePoint[],
  sessions = 7,
): MarketChartPoint[] {
  return history.slice(-sessions).map((point) => ({
    date: point.date,
    value: point.closeCents,
    closeCents: point.closeCents,
  }));
}

export function filterPeriod<T extends { date: string }>(
  points: readonly T[],
  period: MarketPeriod,
): T[] {
  const days = marketPeriods.find((item) => item.id === period)?.days ?? null;
  const last = points.at(-1);
  if (days === null || !last) return [...points];
  const start = shiftDate(last.date, -(days - 1));
  return points.filter((point) => point.date >= start);
}

/**
 * Valor histórico da posição: quantidade efetivamente possuída em cada pregão
 * (compras e vendas até a data) × fechamento. Sem quantidade em todas as
 * operações não há reconstrução confiável, e o motivo é informado.
 */
export function positionHistory(
  entries: readonly InvestmentEntry[],
  history: readonly MarketPricePoint[],
): { points: MarketChartPoint[]; limitation: string | null } {
  if (!entries.length)
    return { points: [], limitation: 'Nenhuma operação registrada.' };
  if (entries.some((entry) => entry.quantity === undefined))
    return {
      points: [],
      limitation:
        'Para reconstruir a posição, informe a quantidade em todas as compras e vendas deste investimento.',
    };
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const points: MarketChartPoint[] = [];
  for (const point of history) {
    const units = sorted
      .filter((entry) => entry.date <= point.date)
      .reduce(
        (sum, entry) =>
          sum +
          (entry.kind === 'contribution' ? 1 : -1) *
            satoshis(entry.quantity ?? 0),
        0,
      );
    if (units <= 0) continue;
    points.push({
      date: point.date,
      closeCents: point.closeCents,
      units,
      value: Number(
        (BigInt(units) * BigInt(point.closeCents) + 50_000_000n) / 100_000_000n,
      ),
    });
  }
  const undated = sorted.find((entry) => entry.acquisitionDateUnknown);
  return {
    points,
    limitation: undated
      ? `A posição inicial foi registrada em ${displayDate(undated.date)} sem data original de aquisição; o gráfico considera a posição somente a partir dessa data.`
      : points.length
        ? null
        : 'Ainda não há pregões com a posição registrada no período disponível.',
  };
}

export function formatUnits(units: number) {
  return (units / 1e8).toLocaleString('pt-BR', { maximumFractionDigits: 8 });
}
