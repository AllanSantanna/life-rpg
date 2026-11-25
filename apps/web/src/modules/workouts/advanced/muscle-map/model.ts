import {
  compareSessionsDesc,
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
import { periodDays, type TrainingPeriod } from '../calculations';
import type { WorkoutSession } from '../types';
import {
  exerciseParticipation,
  mapGroups,
  type MapGroup,
  type ParticipationRole,
} from './participation';

export type MapMode = 'effort' | 'recovery';
export type Tone =
  | 'unknown'
  | 'stabilizer'
  | 'recovery-stabilizer'
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
/**
 * Rastro de um exercício registrado para um grupo. Fonte única: as sessões
 * salvas; nada é persistido. Estabilizadores têm `units` e `burden` zero.
 */
export interface MuscleContribution {
  key: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  startedAt: string | null;
  sets: number;
  role: ParticipationRole;
  reason: string;
  source: 'review' | 'record';
  /** Séries equivalentes usadas no Esforço (séries × peso do papel). */
  units: number;
  /** Carga antes do decaimento (séries × RIR × volume × peso do papel). */
  burden: number;
  /** Carga residual no instante de referência; 0 fora da janela. */
  residual: number;
  /** Volume (carga × repetições) das séries do exercício. */
  volume: number;
  inPeriod: boolean;
  inRecoveryWindow: boolean;
}
export interface MuscleSummary {
  muscle: MapGroup;
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
  /** Mais recentes primeiro; inclui participações estabilizadoras. */
  contributions: MuscleContribution[];
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
const asTiming = (item: { date: string; startedAt: string | null }) =>
  item.startedAt
    ? { date: item.date, startedAt: item.startedAt }
    : { date: item.date };
const roleWeight = (role: ParticipationRole, config: RecoveryConfig) =>
  role === 'primary' ? 1 : role === 'secondary' ? config.secondaryWeight : 0;

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
    mapGroups.map((m) => [m, new Map<string, MuscleDay>()]),
  ) as Record<MapGroup, Map<string, MuscleDay>>;
  const traces = Object.fromEntries(
    mapGroups.map((m) => [m, [] as MuscleContribution[]]),
  ) as Record<MapGroup, MuscleContribution[]>;
  const stimuli = Object.fromEntries(
    mapGroups.map((m) => [
      m,
      [] as {
        timing: StimulusTiming;
        burden: number;
        rirCount: number;
        session: WorkoutSession;
      }[],
    ]),
  ) as Record<
    MapGroup,
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
      const participation = exerciseParticipation(entry.exercise);
      if (
        !participation.some((p) => p.role !== 'stabilizer') &&
        age < periodDays[period]
      )
        unmappedSets += sets.length;
      for (const { group: m, role, reason, source } of participation) {
        const weight = roleWeight(role, config);
        const inRecoveryWindow = timing.startedAt
          ? timing.minElapsedHours < config.lookbackDays * 24
          : age < config.lookbackDays;
        traces[m].push({
          key: `${session.id}:${entry.id}`,
          sessionId: session.id,
          exerciseId: entry.exercise.id,
          exerciseName: entry.exercise.name,
          date: session.date,
          startedAt: timing.startedAt,
          sets: sets.length,
          role,
          reason,
          source,
          units: sets.length * weight,
          volume,
          burden: burden * weight,
          residual:
            inRecoveryWindow && weight > 0
              ? burden *
                weight *
                2 ** (-timing.minElapsedHours / (24 * config.halfLifeDays))
              : 0,
          inPeriod: age < periodDays[period],
          inRecoveryWindow,
        });
        // Estabilizador: rastreado acima, sem série equivalente nem carga.
        if (weight === 0) continue;
        const direct = role === 'primary';
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
    mapGroups.map((m) => {
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
        // B-09: instante real (deslocamento UTC considerado), não texto.
        contributions: [...traces[m]].sort((a, b) =>
          compareSessionsDesc(asTiming(a), asTiming(b)),
        ),
      };
      return [m, result];
    }),
  ) as Record<MapGroup, MuscleSummary>;
  const max = Math.max(0, ...mapGroups.map((m) => summaries[m].units));
  for (const summary of Object.values(summaries))
    summary.effort =
      summary.units > 0 && max > 0
        ? Math.max(1, Math.round((100 * summary.units) / max))
        : null;
  return { summaries, unmappedSets };
}
/** Contagens exibidas no painel, na mesma janela temporal do índice do modo. */
export interface WindowMetrics {
  sets: number;
  direct: number;
  secondary: number;
  volume: number;
  sessions: number;
}
/**
 * Esforço usa o período escolhido; Recuperação usa a janela fixa de 14 dias.
 * Assim nenhuma contagem do painel mistura as duas janelas (M-02).
 */
export function windowMetrics(
  summary: MuscleSummary | undefined,
  mode: MapMode,
): WindowMetrics {
  if (!summary)
    return { sets: 0, direct: 0, secondary: 0, volume: 0, sessions: 0 };
  if (mode === 'effort') {
    const { sets, direct, secondary, volume, sessions } = summary;
    return { sets, direct, secondary, volume, sessions };
  }
  const counted = summary.contributions.filter(
    (item) => item.inRecoveryWindow && item.units > 0,
  );
  const sum = (pick: (item: MuscleContribution) => number) =>
    counted.reduce((total, item) => total + pick(item), 0);
  return {
    sets: sum((item) => item.sets),
    direct: sum((item) => (item.role === 'primary' ? item.sets : 0)),
    secondary: sum((item) => (item.role === 'secondary' ? item.sets : 0)),
    volume: Math.round(sum((item) => item.volume) * 1e6) / 1e6,
    sessions: new Set(counted.map((item) => item.sessionId)).size,
  };
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
/**
 * Participação somente estabilizadora na janela do modo: Esforço usa o período
 * escolhido; Recuperação, a janela de recuperação. O grupo foi rastreado como
 * estabilizador, mas não tem estímulo contabilizado (valor calculado nulo).
 * Estado apenas visual: `effort` e `recovery` não mudam e nenhum percentual,
 * série equivalente ou carga residual é criado.
 */
export function stabilizerOnly(
  summary: MuscleSummary | undefined,
  mode: MapMode = 'effort',
): boolean {
  if (!summary || summary[mode] !== null) return false;
  const scope = mode === 'effort' ? 'inPeriod' : 'inRecoveryWindow';
  return summary.contributions.some((c) => c[scope] && c.role === 'stabilizer');
}
/** Textos da participação estabilizadora por modo: nunca um percentual. */
export const stabilizerStatus: Record<MapMode, string> = {
  effort: 'Estabilizador · participação não quantificada',
  recovery: 'Estabilizador · sem carga de recuperação calculada',
};
export const isStabilizerTone = (tone: Tone) =>
  tone === 'stabilizer' || tone === 'recovery-stabilizer';
/**
 * Estado visual único do mapa (vistas, lista, legenda e detalhes):
 * 1. valor calculado → escala normal do modo;
 * 2. sem valor, com participação estabilizadora na janela → tom estabilizador
 *    (#80565a no Esforço; verde convencional na Recuperação);
 * 3. sem participação → indeterminado.
 */
export function muscleTone(
  summary: MuscleSummary | undefined,
  mode: MapMode,
): Tone {
  if (stabilizerOnly(summary, mode))
    return mode === 'effort' ? 'stabilizer' : 'recovery-stabilizer';
  return metricTone(summary?.[mode] ?? null, mode);
}
export const toneLabels: Record<Tone, string> = {
  unknown: 'Indeterminado',
  stabilizer: 'Estabilizador',
  'recovery-stabilizer': 'Estabilizador',
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
