import { isInitialPosition } from '../finances/initialPosition';
import type { Mission, MissionCategory } from '../missions/types';
import type { EffortActivity } from '../evolution/scoring';
import { isDate } from './dates';
import type { LifeRecords } from './types';
import { daysBetween, shiftDate } from './dates';

export const legacyReferenceDate = '2026-11-13';
export const dailyRewards: Record<MissionCategory, number> = {
  Finanças: 80,
  Treinos: 150,
  Descanso: 120,
  Conhecimento: 100,
};
interface DailyEffort {
  date: string;
  area: MissionCategory;
  effort: number;
  qualifies: boolean;
}
/** Uma entrada por área/dia, sem dependência do valor financeiro ou volume de páginas. */
export function recordEfforts(records: LifeRecords): DailyEffort[] {
  const days = new Map<string, DailyEffort>();
  function add(
    date: string,
    area: MissionCategory,
    effort: number,
    qualifies = true,
  ) {
    const key = `${area}:${date}`;
    const previous = days.get(key);
    days.set(key, {
      date,
      area,
      effort: Math.max(effort, previous?.effort ?? 0),
      qualifies: qualifies || (previous?.qualifies ?? false),
    });
  }
  for (const entry of [
    ...records.movements,
    ...records.investmentEntries.filter((entry) => !isInitialPosition(entry)),
  ])
    add(entry.date, 'Finanças', 1);
  for (const entry of records.workouts)
    if (entry.trained) add(entry.date, 'Treinos', 1);
  for (const entry of records.sleep)
    if (entry.hours > 0)
      add(
        entry.date,
        'Descanso',
        Math.min(1, entry.hours / records.sleepGoalHours),
        entry.hours >= records.sleepGoalHours,
      );
  for (const entry of records.readings) add(entry.date, 'Conhecimento', 1);
  return [...days.values()];
}
/** Junta declarações reais datadas e registros, com um prêmio por área/dia. */
export function realEfforts(
  records: LifeRecords,
  missions: readonly Mission[],
): DailyEffort[] {
  const days = new Map(
    recordEfforts(records).map((day) => [`${day.area}:${day.date}`, day]),
  );
  const missionDays = new Map<string, DailyEffort>();
  for (const mission of missions) {
    if (
      !mission.completed ||
      mission.source !== 'user' ||
      !isDate(mission.completedOn)
    )
      continue;
    const key = `${mission.category}:${mission.completedOn}`;
    const previous = missionDays.get(key);
    missionDays.set(key, {
      area: mission.category,
      date: mission.completedOn,
      effort: Math.min(
        1,
        (previous?.effort ?? 0) + (mission.category === 'Descanso' ? 0.5 : 1),
      ),
      qualifies: true,
    });
  }
  for (const [key, day] of missionDays) {
    const previous = days.get(key);
    days.set(key, {
      ...day,
      effort: Math.max(previous?.effort ?? 0, day.effort),
      qualifies: true,
    });
  }
  return [...days.values()];
}
export function recordReward(
  records: LifeRecords,
  missions: readonly Mission[],
  today: string,
) {
  return realEfforts(records, missions)
    .filter((day) => day.qualifies && day.date <= today)
    .reduce((sum, day) => sum + dailyRewards[day.area], 0);
}
/** O histórico opaco anterior é ignorado: o Radar usa somente origens verificáveis. */
export function projectEffortActivities(
  _history: readonly EffortActivity[],
  missions: readonly Mission[],
  records: LifeRecords,
  today: string,
): EffortActivity[] {
  return realEfforts(records, missions)
    .filter((day) => day.date <= today)
    .map((day) => ({
      id: `${day.area}:${day.date}`,
      area: day.area,
      daysAgo: daysBetween(today, day.date),
      effort: day.effort,
    }));
}

/** XP das ações datadas; o saldo inicial do personagem não é atividade da semana. */
export function weeklyRecordXP(
  records: LifeRecords,
  missions: readonly Mission[],
  today: string,
) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(today, index - 6);
    const xp =
      recordReward(records, missions, date) -
      recordReward(records, missions, shiftDate(date, -1));
    return {
      date,
      day: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'short',
      }),
      xp,
    };
  });
}
