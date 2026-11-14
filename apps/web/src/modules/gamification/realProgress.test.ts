import { describe, it, expect } from 'vitest';
import {
  startingProgress,
  realAttributes,
  realAchievements,
} from './realProgress';
import { projectProgress } from './progression';
import { emptyRecords } from '../records/types';
import {
  recordReward,
  projectEffortActivities,
  weeklyRecordXP,
} from '../records/progression';
import { legacyMissionCatalog, realMissionHistory } from '../missions/catalog';
import { initialMissions } from '../../app/mocks/dashboard';
import { effortHistory } from '../../app/mocks/effort';
import { scorePeriod } from '../evolution/scoring';
import { shiftDate } from '../records/dates';
import { applyRecordCommand } from '../records/commands';
const today = '2026-11-13';
describe('Progressão exclusivamente real', () => {
  it('não usa XP, atributos, missões ou histórico ilustrativo em uma conta vazia', () => {
    const records = emptyRecords();
    expect(
      projectProgress(
        startingProgress,
        recordReward(records, initialMissions, today),
      ),
    ).toEqual({ level: 1, xp: 0, xpPerLevel: 2000 });
    const activities = projectEffortActivities(
      effortHistory,
      initialMissions,
      records,
      today,
    );
    expect(activities).toEqual([]);
    expect(
      realAttributes(scorePeriod(activities, 7)).every(
        (attribute) => attribute.value === 0,
      ),
    ).toBe(true);
    expect(
      realAchievements(records, [], today, activities).every(
        (achievement) => !achievement.unlocked,
      ),
    ).toBe(true);
    expect(
      weeklyRecordXP(records, initialMissions, today).every(
        (day) => day.xp === 0,
      ),
    ).toBe(true);
  });
  it('soma os quatro pilares, sem XP pela posição inicial ou cotação', () => {
    const records = {
      ...emptyRecords(),
      movements: [
        {
          id: 'expense',
          kind: 'expense' as const,
          date: today,
          amountCents: 100,
          description: 'Despesa',
          category: 'Geral',
        },
      ],
      workouts: [{ date: today, trained: true }],
      sleep: [{ date: today, hours: 8 }],
      books: [{ id: 'b', title: 'Livro', totalPages: 100 }],
      readings: [{ id: 'r', bookId: 'b', date: today, pages: 10 }],
    };
    expect(recordReward(records, [], today)).toBe(450);
    expect(projectProgress(startingProgress, 450).level).toBe(1);
    expect(
      projectEffortActivities(effortHistory, [], records, today),
    ).toHaveLength(4);
    const withMission = realMissionHistory([
      { missionId: 'workout', completed: true, date: today, source: 'user' },
    ]);
    expect(recordReward(records, withMission, today)).toBe(450);
    expect(
      recordReward(
        records,
        [{ ...legacyMissionCatalog[1]!, completed: true, completedOn: today }],
        today,
      ),
    ).toBe(450);
    const sleep = realMissionHistory([
      { missionId: 'water', date: today, completed: true, source: 'user' },
      { missionId: 'sleep', date: today, completed: true, source: 'user' },
    ]);
    expect(recordReward(emptyRecords(), sleep, today)).toBe(120);
    expect(
      projectEffortActivities([], sleep, emptyRecords(), today)[0]?.effort,
    ).toBe(1);
  });
  it('sobe e desce níveis com dados reais, sem alterar a fórmula de 2000 XP', () => {
    let records = {
      ...emptyRecords(),
      workouts: Array.from({ length: 14 }, (_, i) => ({
        date: shiftDate(today, -i),
        trained: true,
      })),
    };
    const total = recordReward(records, [], today);
    expect(total).toBe(2100);
    expect(projectProgress(startingProgress, total)).toEqual({
      level: 2,
      xp: 100,
      xpPerLevel: 2000,
    });
    records = applyRecordCommand(
      records,
      { type: 'deleteWorkout', date: shiftDate(today, -13) },
      today,
    );
    expect(
      projectProgress(startingProgress, recordReward(records, [], today)),
    ).toEqual({ level: 1, xp: 1950, xpPerLevel: 2000 });
    for (let i = 0; i < 7; i++)
      records = applyRecordCommand(
        records,
        {
          type: 'saveWorkout',
          value: { date: shiftDate(today, -i), trained: false },
        },
        today,
      );
    expect(
      scorePeriod(projectEffortActivities([], [], records, today), 7).Treinos,
    ).toBe(0);
  });
  it('conquistas acompanham livros e dias verdadeiros e revertem após exclusões', () => {
    const records = {
      ...emptyRecords(),
      workouts: Array.from({ length: 7 }, (_, i) => ({
        date: shiftDate(today, -i),
        trained: true,
      })),
      books: [
        { id: 'a', title: 'Um', totalPages: 1 },
        { id: 'b', title: 'Dois', totalPages: 1 },
        { id: 'c', title: 'Três', totalPages: 1 },
      ],
      readings: ['a', 'b', 'c'].map((id) => ({
        id,
        bookId: id,
        date: today,
        pages: 1,
      })),
    };
    const calculate = (r: typeof records) =>
      realAchievements(r, [], today, projectEffortActivities([], [], r, today));
    expect(
      calculate(records)
        .filter((a) => a.unlocked)
        .map((a) => a.id),
    ).toEqual(['first', 'consistent', 'reader']);
    expect(
      calculate({ ...records, workouts: [], readings: [] }).every(
        (a) => !a.unlocked,
      ),
    ).toBe(true);
  });
});
