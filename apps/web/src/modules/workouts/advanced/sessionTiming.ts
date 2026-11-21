import { isDate, localDate, displayDate } from '../../records/dates';
import type { WorkoutSession } from './types';
export const HOUR_MS = 60 * 60 * 1000;
export const isWorkoutTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
/** Optional minute-precision start with the recorded local UTC offset. No redundant time field. */
export function isSessionStart(value: unknown, date: string): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:00[+-](0\d|1[0-4]):[0-5]\d$/.test(
      value,
    )
  )
    return false;
  const offsetHours = Number(value.slice(-5, -3)),
    offsetMinutes = Number(value.slice(-2));
  return (
    isDate(date) &&
    value.slice(0, 10) === date &&
    (offsetHours < 14 || offsetMinutes === 0) &&
    Number.isFinite(Date.parse(value))
  );
}
export function localWorkoutTime(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
export function sessionTime(
  session: Pick<WorkoutSession, 'startedAt'>,
): string {
  return session.startedAt?.slice(11, 16) ?? '';
}
const formatOffset = (minutes: number) => {
  const abs = Math.abs(minutes);
  return `${minutes >= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};
/**
 * Deslocamentos UTC em que `date time` existe no fuso local, do instante mais
 * cedo para o mais tarde: nenhum (horário pulado no início do horário de
 * verão), um (caso comum) ou dois (horário repetido no fim do horário de verão).
 */
export function localStartOffsets(date: string, time: string): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  const offsets = new Set<number>();
  for (let h = -30; h <= 30; h += 1)
    offsets.add(-new Date(wall + h * HOUR_MS).getTimezoneOffset());
  return [...offsets]
    .map((offset) => ({ offset, instant: wall - offset * 60_000 }))
    .filter(({ instant }) => {
      const local = new Date(instant);
      return localDate(local) === date && localWorkoutTime(local) === time;
    })
    .sort((a, b) => a.instant - b.instant)
    .map(({ offset }) => formatOffset(offset));
}
/** Horário repetido no fim do horário de verão: o usuário escolhe a ocorrência. */
export class AmbiguousTimeError extends Error {
  constructor(
    readonly time: string,
    readonly offsets: string[],
  ) {
    super(
      `O horário ${time} ocorre duas vezes nesta data por causa da troca de horário de verão. Escolha qual ocorrência é o início do treino.`,
    );
    this.name = 'AmbiguousTimeError';
  }
}
export function createSessionStart(
  date: string,
  time: string,
  offset?: string,
): string {
  if (!isDate(date) || !isWorkoutTime(time))
    throw new Error(
      'Informe data válida e horário no formato HH:mm (00:00 a 23:59).',
    );
  const options = localStartOffsets(date, time);
  // Horário pulado no início do horário de verão: recusar, sem deslocar.
  if (!options.length)
    throw new Error(
      'Este horário não existe no fuso local nesta data. Escolha outro horário.',
    );
  // Horário repetido: nunca escolher em silêncio uma das duas ocorrências.
  const chosen =
    options.length === 1
      ? options[0]
      : offset && options.includes(offset)
        ? offset
        : null;
  if (!chosen) throw new AmbiguousTimeError(time, options);
  return `${date}T${time}:00${chosen}`;
}
/**
 * Ordem mais recente primeiro: data civil; no mesmo dia, o instante real (com o
 * deslocamento UTC gravado); sessões sem horário vêm depois das com horário.
 * Empates mantêm a ordem recebida (ordenação estável), o que é determinístico.
 */
export function compareSessionsDesc(
  a: Pick<WorkoutSession, 'date' | 'startedAt'>,
  b: Pick<WorkoutSession, 'date' | 'startedAt'>,
): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  if (a.startedAt && b.startedAt)
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  return a.startedAt ? -1 : b.startedAt ? 1 : 0;
}
/** Auto-fill only when the chosen civil date is the device's current local date. */
export function currentSessionStart(
  date: string,
  now = new Date(),
): string | undefined {
  // O instante atual tem deslocamento conhecido, mesmo na hora repetida.
  return date === localDate(now)
    ? createSessionStart(
        date,
        localWorkoutTime(now),
        formatOffset(-now.getTimezoneOffset()),
      )
    : undefined;
}
/** A start after "now" would hide the session from recovery; reject it on input. */
export function assertStartNotFuture(
  startedAt: string | undefined,
  now = Date.now(),
): void {
  if (startedAt !== undefined && Date.parse(startedAt) > now)
    throw new Error(
      'O horário de início não pode estar no futuro. Confira data e horário.',
    );
}
export function withSessionTiming(
  session: WorkoutSession,
  date: string,
  time: string,
  offset?: string,
): WorkoutSession {
  if (!isDate(date)) throw new Error('Informe uma data válida.');
  if (
    date === session.date &&
    time === sessionTime(session) &&
    (!offset || session.startedAt?.endsWith(offset))
  )
    return session;
  const next: WorkoutSession = { ...session, date };
  // Clearing the time removes the key: unknown start is never stored as a value.
  if (time) next.startedAt = createSessionStart(date, time, offset);
  else delete next.startedAt;
  return next;
}
export function displaySessionDate(
  session: Pick<WorkoutSession, 'date' | 'startedAt'>,
): string {
  return `${displayDate(session.date)}${session.startedAt ? ` às ${sessionTime(session)}` : ''}`;
}
export interface StimulusTiming {
  date: string;
  startedAt: string | null;
  minElapsedHours: number;
  maxElapsedHours: number;
  /** Ordering bound only; unknown times are never persisted as an inferred start. */
  latestPossibleAt: number;
}
export function timingAt(
  session: Pick<WorkoutSession, 'date' | 'startedAt'>,
  now: number,
): StimulusTiming | null {
  if (!isDate(session.date) || !Number.isFinite(now)) return null;
  if (session.startedAt !== undefined) {
    if (!isSessionStart(session.startedAt, session.date)) return null;
    const at = Date.parse(session.startedAt);
    if (at > now) return null;
    const age = (now - at) / HOUR_MS;
    return {
      date: session.date,
      startedAt: session.startedAt,
      minElapsedHours: age,
      maxElapsedHours: age,
      latestPossibleAt: at,
    };
  }
  const start = new Date(`${session.date}T00:00:00`);
  if (start.getTime() > now) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  // At most the latest possible instant is used for decay. The real start remains unknown.
  return {
    date: session.date,
    startedAt: null,
    minElapsedHours: Math.max(0, (now - end.getTime()) / HOUR_MS),
    maxElapsedHours: Math.max(0, (now - start.getTime()) / HOUR_MS),
    latestPossibleAt: Math.min(now, end.getTime()),
  };
}
export function referenceInstant(reference: string | number): number {
  if (typeof reference === 'number' && Number.isFinite(reference))
    return reference;
  if (typeof reference === 'string' && isDate(reference))
    return new Date(`${reference}T23:59:59.999`).getTime();
  throw new Error('Data de referência inválida.');
}
function hoursLabel(hours: number) {
  const minutes = Math.max(0, Math.floor(hours * 60 + 1e-7));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}
export function elapsedLabel(timing: StimulusTiming): string {
  return timing.startedAt
    ? hoursLabel(timing.minElapsedHours)
    : `Entre ${hoursLabel(timing.minElapsedHours)} e ${hoursLabel(timing.maxElapsedHours)}`;
}
