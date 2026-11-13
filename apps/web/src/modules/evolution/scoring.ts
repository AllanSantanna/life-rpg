import type { Mission, MissionCategory } from '../missions/types';

export const areas = [
  'Finanças',
  'Treinos',
  'Descanso',
  'Conhecimento',
] as const;
export type Period = 7 | 30 | 90;
export type Scores = Record<MissionCategory, number>;
export interface EffortActivity {
  /** Mesmo identificador para a atividade e sua eventual missão de origem. */
  id: string;
  area: MissionCategory;
  /** Dias anteriores à data de referência da demonstração; zero = hoje. */
  daysAgo: number;
  effort: number;
}
export type EffortGoals = Record<MissionCategory, number>;
export const defaultGoals: EffortGoals = {
  Finanças: 3,
  Treinos: 4,
  Descanso: 7,
  Conhecimento: 5,
};
export const demoReferenceDate = '13/11/2026';

/** Projeta o estado atual, sem acumular eventos a cada clique. */
export function sessionActivities(
  history: readonly EffortActivity[],
  missions: readonly Mission[],
): EffortActivity[] {
  const missionIds = new Set(
    missions.map((mission) => `mission:${mission.id}`),
  );
  return [
    ...history.filter((activity) => !missionIds.has(activity.id)),
    ...missions
      .filter((mission) => mission.completed)
      .map((mission) => ({
        id: `mission:${mission.id}`,
        area: mission.category,
        daysAgo: 0,
        effort: mission.category === 'Descanso' ? 0.5 : 1,
      })),
  ];
}

export function scorePeriod(
  activities: readonly EffortActivity[],
  period: Period,
  goals: EffortGoals = defaultGoals,
  offset = 0,
): Scores {
  const unique = new Map(activities.map((activity) => [activity.id, activity]));
  return Object.fromEntries(
    areas.map((area) => {
      const daily = new Map<number, number>();
      for (const activity of unique.values()) {
        if (
          activity.area !== area ||
          !Number.isInteger(activity.daysAgo) ||
          activity.daysAgo < offset ||
          activity.daysAgo >= offset + period ||
          !Number.isFinite(activity.effort) ||
          activity.effort <= 0
        )
          continue;
        daily.set(
          activity.daysAgo,
          Math.min(1, (daily.get(activity.daysAgo) ?? 0) + activity.effort),
        );
      }
      const target = (goals[area] * period) / 7;
      if (!Number.isFinite(target) || target <= 0) return [area, 0];
      const effort = [...daily.values()].reduce((sum, value) => sum + value, 0);
      const score =
        100 *
        (0.7 * Math.min(1, effort / target) +
          0.3 * Math.min(1, daily.size / target));
      return [area, Math.min(100, Math.max(0, Math.round(score)))];
    }),
  ) as Scores;
}

export function comparePeriods(
  activities: readonly EffortActivity[],
  period: Period,
  goals: EffortGoals = defaultGoals,
) {
  const current = scorePeriod(activities, period, goals);
  const previous = scorePeriod(activities, period, goals, period);
  const delta = Object.fromEntries(
    areas.map((area) => [area, current[area] - previous[area]]),
  ) as Scores;
  return { current, previous, delta };
}
