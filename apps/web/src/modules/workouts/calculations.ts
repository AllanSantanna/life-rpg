import type { WorkoutDay } from './types';
import { inLastDays, monthDates } from '../records/dates';
export function workoutStats(
  days: readonly WorkoutDay[],
  today: string,
  month = today.slice(0, 7),
) {
  const trained = days.filter((day) => day.trained && day.date <= today);
  const elapsed = monthDates(month).filter((date) => date <= today).length;
  const monthly = trained.filter((day) =>
    day.date.startsWith(`${month}-`),
  ).length;
  return {
    weekly: trained.filter((day) => inLastDays(day.date, today, 7)).length,
    monthly,
    total: trained.length,
    consistency: elapsed ? Math.round((monthly / elapsed) * 100) : 0,
  };
}
