import {
  timingAt,
  referenceInstant,
  type StimulusTiming,
} from '../sessionTiming';
import {
  daysBetween,
  isDate,
  localDate,
  shiftDate,
} from '../../../records/dates';
import { normalizedName } from '../catalog';
import { periodDays, type TrainingPeriod } from '../calculations';
import { muscleLabels, type Muscle, type WorkoutSession } from '../types';

export type MapMode = 'effort' | 'recovery';
export type Tone =
  | 'unknown'
  | 'low'
  | 'moderate'
  | 'high'
  | 'very-high'
  | 'ready'
  | 'recovering'
  | 'tired'
  | 'fatigued';
export interface MuscleDay {
  date: string;
  sets: number;
  direct: number;
  secondary: number;
  units: number;
  volume: number;
  burden: number;
  rirCount: number;
  sessions: Set<string>;
}
export interface MuscleSummary {
  muscle: Muscle;
  sets: number;
  direct: number;
  secondary: number;
  units: number;
  volume: number;
  sessions: number;
  lastDate: string | null;
  effort: number | null;
  recovery: number | null;
  recoveryLastDate: string | null;
  rirCount: number;
  history: MuscleDay[];
  lastTiming: StimulusTiming | null;
  recoveryTiming: StimulusTiming | null;
  residualBurden: number;
}
export const defaultRecoveryConfig = {
  halfLifeDays: 2,
  capacity: 12,
  lookbackDays: 14,
  secondaryWeight: 0.5,
} as const;
export type RecoveryConfig = {
  [K in keyof typeof defaultRecoveryConfig]: number;
};
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const muscles = Object.keys(muscleLabels) as Muscle[];

/** Reuses the historical shrug interpretation without mutating snapshots. */
export function muscleParticipation(
  exercise: WorkoutSession['exercises'][number]['exercise'],
) {
  const primary =
    exercise.primary === 'back' &&
    (['shrug', 'barbell-shrug'].includes(exercise.id) ||
      normalizedName(exercise.name).startsWith('encolhimento'))
      ? 'trapezius'
      : exercise.primary;
  return {
    primary,
    secondary: [...new Set(exercise.secondary)].filter((m) => m !== primary),
  };
}

/** Pure projection. Numeric reference = live instant; civil date = historical end of day. */
export function projectMuscles(
  sessions: readonly WorkoutSession[],
  reference: string | number,
  period: TrainingPeriod,
  config: RecoveryConfig = defaultRecoveryConfig,
) {
  const now = referenceInstant(reference);
  const today = localDate(new Date(now));
  if (
    !Object.values(config).every(Number.isFinite) ||
    config.halfLifeDays <= 0 ||
    config.capacity <= 0 ||
    !Number.isInteger(config.lookbackDays) ||
    config.lookbackDays < 1 ||
    config.secondaryWeight < 0 ||
    config.secondaryWeight > 1
  )
    throw new Error('Configuração de recuperação inválida.');
  const days = Object.fromEntries(
    muscles.map((m) => [m, new Map<string, MuscleDay>()]),
  ) as Record<Muscle, Map<string, MuscleDay>>;
  const stimuli = Object.fromEntries(
    muscles.map((m) => [
      m,
      [] as {
        timing: StimulusTiming;
        burden: number;
        rirCount: number;
        session: WorkoutSession;
      }[],
    ]),
  ) as Record<
    Muscle,
    {
      timing: StimulusTiming;
      burden: number;
      rirCount: number;
      session: WorkoutSession;
    }[]
  >;
  const previousVolumes = new Map<string, { date: string; volume: number }[]>();
  let unmappedSets = 0;
  // Group each date before comparisons, so same-day ordering never changes the estimate.
  const completed = sessions
    .filter(
      (s) =>
        s.status === 'completed' && isDate(s.date) && timingAt(s, now) !== null,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startedAt && b.startedAt
          ? Date.parse(a.startedAt) - Date.parse(b.startedAt)
          : 0),
    );
  for (const session of completed) {
    const age = daysBetween(today, session.date);
    const timing = timingAt(session, now)!;
    for (const entry of session.exercises) {
      const sets = entry.sets.filter(
        (s) =>
          s.completed &&
          s.kind === 'working' &&
          s.weight !== null &&
          Number.isFinite(s.weight) &&
          s.weight >= 0 &&
          s.reps !== null &&
          Number.isInteger(s.reps) &&
          s.reps > 0,
      );
      if (!sets.length) continue;
      const volume = sets.reduce((sum, s) => sum + s.weight! * s.reps!, 0);
      const prior = (previousVolumes.get(entry.exercise.id) ?? [])
        .filter((v) => {
          const distance = daysBetween(session.date, v.date);
          return distance > 0 && distance <= 28 && v.volume > 0;
        })
        .map((v) => v.volume)
        .sort((a, b) => a - b);
      const median = prior.length
        ? (prior[Math.floor((prior.length - 1) / 2)]! +
            prior[Math.floor(prior.length / 2)]!) /
          2
        : 0;
      // External volume is comparable only within the same exercise, with >=2 prior observations.
      const volumeFactor =
        prior.length >= 2 && median > 0
          ? clamp(Math.sqrt(volume / median), 1, 1.5)
          : 1;
      const knownRir = sets.filter(
        (s) =>
          s.rir !== null &&
          Number.isInteger(s.rir) &&
          s.rir >= 0 &&
          s.rir <= 10,
      );
      const burden =
        sets.reduce(
          (sum, s) =>
            sum +
            (s.rir !== null &&
            Number.isInteger(s.rir) &&
            s.rir >= 0 &&
            s.rir <= 10
              ? 1 + (0.2 * (4 - Math.min(s.rir, 4))) / 4
              : 1),
          0,
        ) * volumeFactor;
      const { primary, secondary } = muscleParticipation(entry.exercise);
      const participation = [primary, ...secondary].filter((m): m is Muscle =>
        muscles.includes(m),
      );
      if (!participation.length && age < periodDays[period])
        unmappedSets += sets.length;
      for (const m of participation) {
        const direct = m === primary;
        const weight = direct ? 1 : config.secondaryWeight;
        const day = days[m].get(session.date) ?? {
          date: session.date,
          sets: 0,
          direct: 0,
          secondary: 0,
          units: 0,
          volume: 0,
          burden: 0,
          rirCount: 0,
          sessions: new Set<string>(),
        };
        day.sets += sets.length;
        day[direct ? 'direct' : 'secondary'] += sets.length;
        day.units += sets.length * weight;
        // Participation volume, not a split of the total workout tonnage.
        day.volume += volume;
        day.burden += burden * weight;
        day.rirCount += knownRir.length;
        day.sessions.add(session.id);
        days[m].set(session.date, day);
        stimuli[m].push({
          timing,
          burden: burden * weight,
          rirCount: knownRir.length,
          session,
        });
      }
      previousVolumes.set(entry.exercise.id, [
        ...(previousVolumes.get(entry.exercise.id) ?? []),
        { date: session.date, volume },
      ]);
    }
  }
  const summaries = Object.fromEntries(
    muscles.map((m) => {
      const all = [...days[m].values()];
      const history = all.filter(
        (d) => daysBetween(today, d.date) < periodDays[period],
      );
      const recent = stimuli[m].filter(({ timing }) =>
        timing.startedAt
          ? timing.minElapsedHours < config.lookbackDays * 24
          : daysBetween(today, timing.date) < config.lookbackDays,
      );
      const units = history.reduce((sum, d) => sum + d.units, 0);
      const burden = recent.reduce(
        (sum, stimulus) =>
          sum +
          stimulus.burden *
            2 **
              (-stimulus.timing.minElapsedHours / (24 * config.halfLifeDays)),
        0,
      );
      const latestTiming = (events: typeof recent) =>
        [...events].sort(
          (a, b) => b.timing.latestPossibleAt - a.timing.latestPossibleAt,
        )[0]?.timing ?? null;
      const lastTiming = latestTiming(
        stimuli[m].filter(
          (s) => daysBetween(today, s.timing.date) < periodDays[period],
        ),
      );
      const recoveryTiming = latestTiming(recent);
      const result: MuscleSummary = {
        muscle: m,
        history,
        units,
        sets: history.reduce((sum, d) => sum + d.sets, 0),
        direct: history.reduce((sum, d) => sum + d.direct, 0),
        secondary: history.reduce((sum, d) => sum + d.secondary, 0),
        volume:
          Math.round(history.reduce((sum, d) => sum + d.volume, 0) * 1e6) / 1e6,
        sessions: new Set(history.flatMap((d) => [...d.sessions])).size,
        lastDate: history.at(-1)?.date ?? null,
        effort: null,
        recovery:
          burden > 0
            ? Math.min(
                99,
                Math.round(100 * Math.exp(-burden / config.capacity)),
              )
            : null,
        recoveryLastDate: recoveryTiming?.date ?? null,
        rirCount: recent.reduce((sum, d) => sum + d.rirCount, 0),
        lastTiming,
        recoveryTiming,
        residualBurden: burden,
      };
      return [m, result];
    }),
  ) as Record<Muscle, MuscleSummary>;
  const max = Math.max(0, ...muscles.map((m) => summaries[m].units));
  for (const summary of Object.values(summaries))
    summary.effort =
      summary.units > 0 && max > 0
        ? Math.max(1, Math.round((100 * summary.units) / max))
        : null;
  return { summaries, unmappedSets };
}
export function metricTone(value: number | null, mode: MapMode): Tone {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  if (mode === 'effort')
    return value >= 75
      ? 'very-high'
      : value >= 50
        ? 'high'
        : value >= 25
          ? 'moderate'
          : 'low';
  return value >= 90
    ? 'ready'
    : value >= 70
      ? 'recovering'
      : value >= 50
        ? 'tired'
        : 'fatigued';
}
export const toneLabels: Record<Tone, string> = {
  unknown: 'Indeterminado',
  low: 'Baixo',
  moderate: 'Moderado',
  high: 'Alto',
  'very-high': 'Muito alto',
  ready: 'Estimativa alta',
  recovering: 'Intermediária',
  tired: 'Baixa',
  fatigued: 'Muito baixa',
};
export function dailyHistory(
  summary: MuscleSummary,
  today: string,
  period: TrainingPeriod,
) {
  return Array.from({ length: periodDays[period] }, (_, i) => {
    const date = shiftDate(today, i - periodDays[period] + 1);
    return {
      date,
      units: summary.history.find((d) => d.date === date)?.units ?? null,
    };
  });
}
