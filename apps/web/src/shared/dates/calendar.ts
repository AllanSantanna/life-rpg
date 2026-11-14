/** Datas civis locais, independentes de horário de verão e conversão UTC de inputs. */
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function daysBetween(later: string, earlier: string) {
  return Math.round(
    (Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) /
      86400000,
  );
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function inLastDays(date: string, today: string, days: number) {
  const offset = daysBetween(today, date);
  return offset >= 0 && offset < days;
}
export function monthDates(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !isDate(`${month}-01`)) return [];
  const first = `${month}-01`;
  return Array.from({ length: 31 }, (_, day) => shiftDate(first, day)).filter(
    (date) => date.startsWith(month),
  );
}
export function displayDate(date: string) {
  return date.split('-').reverse().join('/');
}
