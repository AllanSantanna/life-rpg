import { daysBetween } from '../../records/dates';
import {
  muscleLabels,
  type Muscle,
  type SessionExercise,
  type WorkoutSession,
  type WorkoutSet,
} from './types';
export type TrainingPeriod = 'week' | 'month' | 'quarter' | 'halfyear' | 'year';
export const periodDays = {
  week: 7,
  month: 30,
  quarter: 90,
  halfyear: 180,
  year: 365,
} as const;
export const periodOptions = [
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensal' },
  { value: 'quarter', label: 'Trimestral' },
  { value: 'halfyear', label: 'Semestral' },
  { value: 'year', label: 'Anual' },
] as const;
export const number = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export function consideredSets(
  exercise: SessionExercise,
  includeWarmup = false,
) {
  return exercise.sets.filter(
    (s): s is WorkoutSet & { weight: number; reps: number } =>
      s.completed &&
      s.weight !== null &&
      s.reps !== null &&
      (includeWarmup || s.kind === 'working'),
  );
}
// Neutraliza resíduos de ponto flutuante sem arredondar cada carga para kg inteiros.
const roundVolume = (value: number) => Math.round(value * 1e6) / 1e6;
export function exerciseVolume(
  exercise: SessionExercise,
  includeWarmup = false,
) {
  return roundVolume(
    consideredSets(exercise, includeWarmup).reduce(
      (sum, s) => sum + roundVolume(s.weight * s.reps),
      0,
    ),
  );
}
export function sessionVolume(session: WorkoutSession, includeWarmup = false) {
  return roundVolume(
    session.exercises.reduce(
      (sum, ex) => sum + exerciseVolume(ex, includeWarmup),
      0,
    ),
  );
}
export function completedSessions(
  sessions: readonly WorkoutSession[],
  today: string,
  period?: TrainingPeriod,
) {
  return sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.date <= today &&
        (!period || daysBetween(today, s.date) < periodDays[period]),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function volumeForDays(
  sessions: readonly WorkoutSession[],
  today: string,
  days: number,
  includeWarmup = false,
) {
  return roundVolume(
    completedSessions(sessions, today)
      .filter((s) => daysBetween(today, s.date) < days)
      .reduce((sum, s) => sum + sessionVolume(s, includeWarmup), 0),
  );
}
export function exerciseHistory(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  today: string,
  period?: TrainingPeriod,
) {
  return completedSessions(sessions, today, period).flatMap((session) => {
    const exercise = session.exercises.find(
      (e) => e.exercise.id === exerciseId,
    );
    if (!exercise) return [];
    const sets = consideredSets(exercise);
    if (!sets.length) return [];
    const rirs = sets.flatMap((s) => (s.rir === null ? [] : [s.rir]));
    return [
      {
        id: session.id,
        date: session.date,
        name: session.planName,
        exercise,
        sets,
        load: Math.max(...sets.map((s) => s.weight)),
        volume: exerciseVolume(exercise),
        rir: rirs.length
          ? rirs.reduce((sum, n) => sum + n, 0) / rirs.length
          : null,
      },
    ];
  });
}
export function previousPerformance(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  currentId: string,
  date: string,
) {
  const last = exerciseHistory(
    sessions.filter((s) => s.id !== currentId),
    exerciseId,
    date,
  ).at(-1);
  const set = last?.sets.at(-1);
  return set && last
    ? { weight: set.weight, reps: set.reps, date: last.date }
    : null;
}
export function personalRecords(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  today: string,
) {
  const history = exerciseHistory(sessions, exerciseId, today);
  const sets = history.flatMap((point) =>
    point.sets.map((s) => ({
      ...s,
      date: point.date,
      volume: roundVolume(s.weight * s.reps),
    })),
  );
  const best = <T>(items: T[], value: (item: T) => number) =>
    items.reduce<T | null>(
      (current, item) =>
        current === null || value(item) > value(current) ? item : current,
      null,
    );
  const byLoad = [...new Set(sets.map((s) => s.weight))]
    .sort((a, b) => b - a)
    .map((load) =>
      best(
        sets.filter((s) => s.weight === load),
        (s) => s.reps,
      )!,
    );
  return {
    load: best(sets, (s) => s.weight),
    setVolume: best(sets, (s) => s.volume),
    bestSession: best(history, (p) => p.volume),
    byLoad,
  };
}
export function muscleActivity(
  sessions: readonly WorkoutSession[],
  today: string,
  period: TrainingPeriod,
) {
  const counts = Object.fromEntries(
    Object.keys(muscleLabels).map((m) => [m, 0]),
  ) as Record<Muscle, number>;
  for (const session of completedSessions(sessions, today, period)) {
    for (const exercise of session.exercises) {
      const count = consideredSets(exercise).length;
      for (const muscle of new Set([
        exercise.exercise.primary,
        ...exercise.exercise.secondary,
      ]))
        counts[muscle] += count;
    }
  }
  return counts;
}
