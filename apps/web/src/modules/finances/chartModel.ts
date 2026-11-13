import type { LifeRecords } from '../records/types';
import { daysBetween } from '../records/dates';
import { financialHistory, financialSummary } from './ledger';

export const chartPeriods = [
  { days: 7, label: 'Semanal' },
  { days: 30, label: 'Mensal' },
  { days: 365, label: 'Anual' },
] as const;
export type ChartPeriod = (typeof chartPeriods)[number]['days'];
export type ChartView = 'cash' | 'wealth';
export function wealthChartModel(
  records: LifeRecords,
  today: string,
  days: ChartPeriod,
  view: ChartView = 'wealth',
) {
  const points = financialHistory(records, today).flatMap((point) => {
    const value = view === 'cash' ? point.cash : point.wealth;
    return value !== null && daysBetween(today, point.date) < days
      ? [{ ...point, value }]
      : [];
  });
  const first = points[0];
  const last = points.at(-1);
  const change =
    first && last && points.length > 1 ? last.value - first.value : null;
  // Percentuais sobre bases zero ou negativas não expressam crescimento relativo.
  const percent =
    change !== null && first && first.value > 0
      ? (change / first.value) * 100
      : null;
  const current = financialSummary(records, today);
  return {
    points,
    current,
    currentValue: view === 'cash' ? current.cash : current.wealth,
    change,
    percent,
    trend:
      change === null || change === 0 ? 'neutral' : change > 0 ? 'up' : 'down',
  };
}
export interface ChartCoordinate {
  x: number;
  y: number;
}
/** Bézier limitada ao retângulo dos pontos vizinhos: passa pelas amostras sem overshoot. */
export function smoothWealthPath(points: readonly ChartCoordinate[]) {
  if (points.length < 2) return '';
  return points.reduce((path, point, index) => {
    const previous = points[index - 1];
    if (!previous) return `M ${point.x} ${point.y}`;
    const third = (point.x - previous.x) / 3;
    return `${path} C ${previous.x + third} ${previous.y}, ${point.x - third} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}
