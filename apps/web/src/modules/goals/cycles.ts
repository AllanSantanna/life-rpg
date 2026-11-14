import { daysBetween, shiftDate } from '../records/dates';
import type { Goal } from './types';
export interface GoalPeriod {
  start: string;
  end: string;
}
export function periodAt(goal: Goal, date: string): GoalPeriod {
  let start = goal.startDate,
    end = goal.deadline ?? date;
  if (goal.cadence === 'daily') {
    start = date;
    end = date;
  }
  if (goal.cadence === 'weekly') {
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    start = shiftDate(date, -((weekday + 6) % 7));
    end = shiftDate(start, 6);
  }
  if (goal.cadence === 'monthly') {
    start = date.slice(0, 7) + '-01';
    const next = new Date(date + 'T12:00:00Z');
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    end = shiftDate(next.toISOString().slice(0, 10), -1);
  }
  if (goal.cadence === 'custom') {
    const index = Math.max(
      0,
      Math.floor(daysBetween(date, goal.startDate) / goal.customDays),
    );
    start = shiftDate(goal.startDate, index * goal.customDays);
    end = shiftDate(start, goal.customDays - 1);
  }
  return {
    start: start < goal.startDate ? goal.startDate : start,
    end: goal.deadline && end > goal.deadline ? goal.deadline : end,
  };
}
export function goalPeriods(goal: Goal, today: string): GoalPeriod[] {
  if (goal.cadence === 'once')
    return [
      {
        start: goal.startDate,
        end: goal.deadline ?? (today < goal.startDate ? goal.startDate : today),
      },
    ];
  if (goal.startDate > today) return [periodAt(goal, goal.startDate)];
  const until = goal.deadline && goal.deadline < today ? goal.deadline : today;
  const result: GoalPeriod[] = [];
  let date = goal.startDate;
  while (date <= until) {
    const period = periodAt(goal, date);
    result.push(period);
    if (period.end >= until) break;
    date = shiftDate(period.end, 1);
  }
  return result;
}
/** Pausa congela a partir do fim do dia informado; retomada inclui o próprio dia. */
export function pausedDate(goal: Goal, date: string) {
  return goal.pauses.some(
    (p) => date > p.from && (p.to === null || date < p.to),
  );
}
export function openPause(goal: Goal) {
  return goal.pauses.find((p) => p.to === null);
}

export function manualScope(
  goal: Pick<Goal, 'kind' | 'unit' | 'cadence' | 'customDays' | 'startDate'>,
) {
  return JSON.stringify([
    goal.kind,
    goal.unit,
    goal.cadence,
    goal.cadence === 'custom' ? goal.customDays : null,
    goal.startDate,
  ]);
}
