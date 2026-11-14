import type { LifeRecords } from '../records/types';
import type { Mission } from '../missions/types';
import { realEfforts, dailyRewards } from '../records/progression';
import { goalCycles } from './progress';
import { difficultyXP, type GoalState } from './types';
export const GOAL_DAILY_CAP = 50,
  GOAL_WEEKLY_CAP = 100;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
export function goalRewards(
  state: GoalState,
  records: LifeRecords,
  missions: readonly Mission[],
  today: string,
) {
  const base = new Map(
    realEfforts(records, missions)
      .filter((day) => day.qualifies && day.date <= today)
      .map((day) => [`${day.area}:${day.date}`, dailyRewards[day.area]]),
  );
  const candidates = state.items
    .filter((goal) => !goal.deletedOn)
    .flatMap((goal) => {
      if (
        goal.tracking === 'automatic' &&
        ['cash', 'wealth', 'investments'].includes(goal.metric ?? '')
      )
        return [];
      return goalCycles(goal, state, records, today)
        .filter(
          (c) =>
            c.completed && c.completedOn && c.completedOn >= goal.createdDate,
        )
        .map((c) => ({
          goalId: goal.id,
          date: c.completedOn!,
          amount: difficultyXP[goal.difficulty],
          pillar: goal.pillar,
          key: `${goal.pillar}:${normalize(goal.title)}:${goal.cadence}:${goal.cadence === 'once' ? 'once' : c.start}`,
        }));
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        b.amount - a.amount ||
        a.goalId.localeCompare(b.goalId),
    );
  const daily = new Map<string, number>(),
    weekly = new Map<string, number>(),
    areas = new Map<string, number>(),
    seen = new Set<string>();
  const entries: { goalId: string; date: string; xp: number }[] = [];
  for (const c of candidates) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    const day = new Date(c.date + 'T12:00:00Z').getUTCDay();
    const monday = new Date(
      Date.parse(c.date + 'T12:00:00Z') - ((day + 6) % 7) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const areaKey = `${c.pillar}:${c.date}`;
    const available =
      c.pillar === 'Geral'
        ? GOAL_DAILY_CAP
        : dailyRewards[c.pillar] -
          (base.get(areaKey) ?? 0) -
          (areas.get(areaKey) ?? 0);
    const xp = Math.max(
      0,
      Math.min(
        c.amount,
        available,
        GOAL_DAILY_CAP - (daily.get(c.date) ?? 0),
        GOAL_WEEKLY_CAP - (weekly.get(monday) ?? 0),
      ),
    );
    if (xp) {
      entries.push({ goalId: c.goalId, date: c.date, xp });
      daily.set(c.date, (daily.get(c.date) ?? 0) + xp);
      weekly.set(monday, (weekly.get(monday) ?? 0) + xp);
      areas.set(areaKey, (areas.get(areaKey) ?? 0) + xp);
    }
  }
  return { total: entries.reduce((sum, e) => sum + e.xp, 0), entries };
}
