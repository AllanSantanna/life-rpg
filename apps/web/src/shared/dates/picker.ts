import { displayDate, isDate, localDate, monthDates } from './calendar';
export type DateMode = 'date' | 'month';
export const months = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
export const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export function validPickerValue(value: string, mode: DateMode) {
  return (
    (mode === 'month'
      ? /^\d{4}-\d{2}$/.test(value) && isDate(`${value}-01`)
      : isDate(value)) && value.slice(0, 4) !== '0000'
  );
}
export function pickerDisplay(value: string, mode: DateMode) {
  if (!value) return '';
  return mode === 'month'
    ? `${value.slice(5, 7)}/${value.slice(0, 4)}`
    : displayDate(value);
}
export function parsePickerText(text: string, mode: DateMode) {
  const raw = text.trim();
  if (validPickerValue(raw, mode)) return raw;
  const match =
    mode === 'date'
      ? raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      : raw.match(/^(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const iso =
    mode === 'date'
      ? `${match[3]}-${match[2]}-${match[1]}`
      : `${match[2]}-${match[1]}`;
  return validPickerValue(iso, mode) ? iso : null;
}
export function maskPickerText(text: string, mode: DateMode) {
  if (text.includes('-')) return text.slice(0, mode === 'date' ? 10 : 7);
  const digits = text.replace(/\D/g, '').slice(0, mode === 'date' ? 8 : 6);
  return mode === 'date'
    ? [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
        .filter(Boolean)
        .join('/')
    : [digits.slice(0, 2), digits.slice(2)].filter(Boolean).join('/');
}
export function pickerError(
  value: string,
  mode: DateMode,
  required: boolean,
  min?: string,
  max?: string,
) {
  const subject = mode === 'date' ? 'uma data' : 'um mês';
  if (!value) return required ? `Escolha ${subject}.` : '';
  if (!validPickerValue(value, mode))
    return mode === 'date'
      ? 'Informe uma data válida.'
      : 'Informe um mês válido.';
  if (min && validPickerValue(min, mode) && value < min)
    return `Escolha ${subject} a partir de ${pickerDisplay(min, mode)}.`;
  if (max && validPickerValue(max, mode) && value > max)
    return `Escolha ${subject} até ${pickerDisplay(max, mode)}.`;
  return '';
}
export function pickerBounds(mode: DateMode, min?: string, max?: string) {
  const lower =
    min && validPickerValue(min, mode)
      ? min
      : mode === 'date'
        ? '0001-01-01'
        : '0001-01';
  const upper =
    max && validPickerValue(max, mode)
      ? max
      : mode === 'date'
        ? '9999-12-31'
        : '9999-12';
  return {
    lower: mode === 'date' ? lower : `${lower}-01`,
    upper: mode === 'date' ? upper : monthDates(upper).at(-1)!,
  };
}
export function clampDate(
  date: string,
  bounds: { lower: string; upper: string },
) {
  return date < bounds.lower
    ? bounds.lower
    : date > bounds.upper
      ? bounds.upper
      : date;
}
export function dateForMonth(date: string, month: string) {
  return `${month}-${String(Math.min(Number(date.slice(8, 10)), monthDates(month).length)).padStart(2, '0')}`;
}
export function shiftMonth(month: string, offset: number) {
  const index = Math.max(
    12,
    Math.min(
      9999 * 12 + 11,
      Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + offset,
    ),
  );
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}
export function pickerCursor(
  value: string,
  mode: DateMode,
  bounds: { lower: string; upper: string },
) {
  const source = validPickerValue(value, mode)
    ? value
    : mode === 'month'
      ? localDate().slice(0, 7)
      : localDate();
  return clampDate(mode === 'date' ? source : `${source}-01`, bounds);
}
export function fullDateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}
