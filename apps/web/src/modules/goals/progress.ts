import type { LifeRecords } from '../records/types';
import { financialSummary } from '../finances/ledger';
import { isInitialPosition } from '../finances/initialPosition';
import {
  manualScope,
  goalPeriods,
  openPause,
  pausedDate,
  type GoalPeriod,
} from './cycles';
import type { Goal, GoalState } from './types';
import { daysBetween, shiftDate } from '../records/dates';
export interface GoalCycle extends GoalPeriod {
  value: number | null;
  percent: number;
  completed: boolean;
  completedOn: string | null;
  status: 'active' | 'completed' | 'overdue' | 'paused' | 'planned';
}
function effectiveEnd(goal: Goal, period: GoalPeriod, today: string) {
  const pause = openPause(goal);
  return [
    period.end,
    today,
    ...(pause && pause.from < today ? [pause.from] : []),
  ].sort()[0]!;
}
function valuesFor(
  goal: Goal,
  state: GoalState,
  records: LifeRecords,
  period: GoalPeriod,
  end: string,
): { date: string; value: number | null }[] {
  const within = (entry: { date: string }) =>
    entry.date >= period.start &&
    entry.date <= end &&
    !pausedDate(goal, entry.date);
  if (goal.tracking === 'manual')
    return state.updates
      .filter(
        (u) =>
          u.goalId === goal.id &&
          within(u) &&
          (!u.unit || u.unit === goal.unit) &&
          (!u.scope || u.scope === manualScope(goal)),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((u) => ({ date: u.date, value: u.value }));
  if (['cash', 'wealth', 'investments'].includes(goal.metric ?? '')) {
    // Saldos são posições conhecidas, não somas de movimentações nem rentabilidade.
    const dates = new Set([
      period.start,
      end,
      ...records.movements.filter(within).map((e) => e.date),
      ...records.investmentEntries.filter(within).map((e) => e.date),
      ...(records.finance?.accounts ?? []).filter(within).map((e) => e.date),
      ...(records.finance?.transfers ?? []).filter(within).map((e) => e.date),
      ...(records.finance?.valuations ?? []).filter(within).map((e) => e.date),
    ]);
    // Avaliações/cotações entram apenas quando observadas. A projeção não fabrica preços passados.
    for (const q of [
      ...(records.finance?.quotes ?? []),
      ...(records.finance?.usdQuotes ?? []),
    ]) {
      const d = new Date(q.observedAt);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (within({ date })) dates.add(date);
    }
    return [...dates]
      .filter((date) => within({ date }))
      .sort()
      .map((date) => {
        const summary = financialSummary(records, date);
        const amount =
          goal.metric === 'cash'
            ? summary.cash
            : goal.metric === 'wealth'
              ? summary.wealth
              : summary.unpriced
                ? null
                : summary.investments;
        return { date, value: amount === null ? null : amount * 10 };
      });
  }
  const amounts = new Map<string, number>();
  const add = (date: string, value: number) => {
    if (within({ date })) amounts.set(date, (amounts.get(date) ?? 0) + value);
  };
  if (goal.metric === 'workouts')
    records.workouts.filter((e) => e.trained).forEach((e) => add(e.date, 1000));
  if (goal.metric === 'pages')
    records.readings.forEach((e) => add(e.date, e.pages * 1000));
  if (goal.metric === 'sleep')
    records.sleep.forEach((e) => add(e.date, e.hours * 1000));
  if (goal.metric === 'contributions')
    records.investmentEntries
      .filter((e) => e.kind === 'contribution' && !isInitialPosition(e))
      .forEach((e) => add(e.date, e.amountCents * 10));
  if (['income', 'expenses', 'net'].includes(goal.metric ?? ''))
    records.movements.forEach((e) => {
      if (goal.metric === 'net')
        add(e.date, (e.kind === 'income' ? 1 : -1) * e.amountCents * 10);
      else if (
        (goal.metric === 'income' && e.kind === 'income') ||
        (goal.metric === 'expenses' && e.kind === 'expense')
      )
        add(e.date, e.amountCents * 10);
    });
  let sum = 0;
  return [...amounts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, value: (sum += amount) }));
}
export function goalCycles(
  goal: Goal,
  state: GoalState,
  records: LifeRecords,
  today: string,
): GoalCycle[] {
  return goalPeriods(goal, today).map((period) => {
    const end = effectiveEnd(goal, period, today);
    const values =
      period.start <= end ? valuesFor(goal, state, records, period, end) : [];
    const value = values.length
      ? values.at(-1)!.value
      : goal.tracking === 'automatic' &&
          ['cash', 'wealth', 'investments'].includes(goal.metric ?? '')
        ? null
        : 0;
    const completed = value !== null && value >= goal.target;
    // Uma reversão posterior remove a conclusão e sua recompensa.
    let completedOn: string | null = null;
    let above = false;
    for (const point of values) {
      const reached = point.value !== null && point.value >= goal.target;
      if (reached && !above) completedOn = point.date;
      if (!reached) completedOn = null;
      above = reached;
    }
    if (!completed) completedOn = null;
    const status = completed
      ? 'completed'
      : period.start > today
        ? 'planned'
        : openPause(goal) && period.end >= openPause(goal)!.from
          ? 'paused'
          : period.end < today
            ? 'overdue'
            : 'active';
    return {
      ...period,
      value,
      percent:
        value === null
          ? 0
          : Math.max(0, Math.min(100, (value / goal.target) * 100)),
      completed,
      completedOn,
      status,
    };
  });
}
export function currentGoalCycle(
  goal: Goal,
  state: GoalState,
  records: LifeRecords,
  today: string,
) {
  return goalCycles(goal, state, records, today).at(-1)!;
}
export function goalStatusLabel(status: GoalCycle['status']) {
  return {
    active: 'Ativa',
    completed: 'Concluída',
    overdue: 'Vencida',
    paused: 'Pausada',
    planned: 'Ainda não iniciada',
  }[status];
}
export function cycleDayCount(period: GoalPeriod) {
  return daysBetween(period.end, period.start) + 1;
}
export const previousDay = (date: string) => shiftDate(date, -1);
