import { displayDate, shiftDate } from '../../shared/dates/calendar';

/** “Hoje”, “Ontem” ou a data por extenso curto (dd/mm/aaaa). */
export function dateLabel(date: string, today: string) {
  if (date === today) return 'Hoje';
  if (date === shiftDate(today, -1)) return 'Ontem';
  return displayDate(date);
}
