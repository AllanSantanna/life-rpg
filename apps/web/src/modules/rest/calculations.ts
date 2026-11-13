import type { SleepDay } from './types';
import { inLastDays, monthDates } from '../records/dates';
export function sleepStats(
  days: readonly SleepDay[],
  today: string,
  goal: number,
  month = today.slice(0, 7),
) {
  const weekly = days.filter((day) => inLastDays(day.date, today, 7));
  const monthly = days.filter(
    (day) => day.date.startsWith(`${month}-`) && day.date <= today,
  );
  const average = (items: readonly SleepDay[]) =>
    items.length
      ? items.reduce((sum, day) => sum + day.hours, 0) / items.length
      : 0;
  const elapsed = monthDates(month).filter((date) => date <= today).length;
  return {
    weeklyAverage: average(weekly),
    monthlyAverage: average(monthly),
    weeklyCount: weekly.length,
    monthlyCount: monthly.length,
    consistency: elapsed
      ? Math.round(
          (monthly.filter((day) => day.hours >= goal).length / elapsed) * 100,
        )
      : 0,
  };
}
