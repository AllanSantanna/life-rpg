import { describe, expect, it } from 'vitest';
import {
  areas,
  comparePeriods,
  defaultGoals,
  scorePeriod,
  sessionActivities,
  type EffortActivity,
} from './scoring';
import { initialMissions } from '../../app/mocks/dashboard';
import { effortHistory } from '../../app/mocks/effort';

const workout: EffortActivity = {
  id: 'workout',
  area: 'Treinos',
  daysAgo: 0,
  effort: 1,
};
describe('Pontuação de dedicação', () => {
  it('normaliza entre 0 e 100 e respeita metas configuráveis', () => {
    expect(Object.values(scorePeriod([], 7))).toEqual([0, 0, 0, 0]);
    expect(scorePeriod([workout], 7).Treinos).toBe(25);
    expect(
      scorePeriod([workout], 7, { ...defaultGoals, Treinos: 2 }).Treinos,
    ).toBe(50);
    expect(
      scorePeriod(
        Array.from({ length: 7 }, (_, daysAgo) => ({
          ...workout,
          id: `${daysAgo}`,
          daysAgo,
        })),
        7,
      ).Treinos,
    ).toBe(100);
  });
  it('deduplica registros por identidade e limita esforço diário', () => {
    expect(scorePeriod([workout, workout], 7).Treinos).toBe(25);
    expect(
      scorePeriod([workout, { ...workout, id: 'another', effort: 999 }], 7)
        .Treinos,
    ).toBe(25);
  });
  it('separa períodos contíguos sem sobreposição', () => {
    const activities = [
      workout,
      { ...workout, id: 'previous', daysAgo: 7 },
      { ...workout, id: 'outside', daysAgo: 14 },
    ];
    const result = comparePeriods(activities, 7);
    expect(result.current.Treinos).toBe(25);
    expect(result.previous.Treinos).toBe(25);
    expect(result.delta.Treinos).toBe(0);
    expect(comparePeriods([workout], 7).delta.Treinos).toBe(25);
    expect(comparePeriods([{ ...workout, daysAgo: 7 }], 7).delta.Treinos).toBe(
      -25,
    );
  });
  it('ignora atividades inválidas e metas não positivas', () => {
    const invalid = [-1, NaN, Infinity].map((effort, i) => ({
      ...workout,
      id: `${i}`,
      effort,
    }));
    invalid.push({ ...workout, daysAgo: -1 }, { ...workout, daysAgo: 0.5 });
    expect(scorePeriod(invalid, 7).Treinos).toBe(0);
    expect(
      scorePeriod([workout], 7, { ...defaultGoals, Treinos: 0 }).Treinos,
    ).toBe(0);
  });
  it.each([7, 30, 90] as const)(
    'usa janelas reais e metas proporcionais em %i dias',
    (period) => {
      const activities = Array.from({ length: period }, (_, daysAgo) => ({
        ...workout,
        id: `${daysAgo}`,
        daysAgo,
      }));
      expect(scorePeriod(activities, period).Treinos).toBe(100);
      expect(
        scorePeriod([{ ...workout, daysAgo: period }], period).Treinos,
      ).toBe(0);
      expect(comparePeriods(activities, period).previous.Treinos).toBe(0);
    },
  );
  it('concluir e desfazer cada missão recalcula só a respectiva área, sem mutação ou XP no cálculo', () => {
    const baseline = scorePeriod(
      sessionActivities(effortHistory, initialMissions),
      7,
    );
    for (const mission of initialMissions.filter((item) => !item.completed)) {
      const completed = initialMissions.map((item) =>
        item.id === mission.id ? { ...item, completed: true, xp: 9999 } : item,
      );
      const score = scorePeriod(sessionActivities(effortHistory, completed), 7);
      expect(score[mission.category]).toBeGreaterThan(
        baseline[mission.category],
      );
      for (const area of areas.filter((area) => area !== mission.category))
        expect(score[area]).toBe(baseline[area]);
      expect(
        scorePeriod(sessionActivities(effortHistory, initialMissions), 7),
      ).toEqual(baseline);
    }
  });
  it('a missão é autoridade para sua atividade e desfazê-la remove registros associados', () => {
    const history = [{ ...workout, id: 'mission:workout' }];
    expect(
      sessionActivities(history, initialMissions).filter(
        (item) => item.area === 'Treinos',
      ),
    ).toHaveLength(0);
    const completed = initialMissions.map((mission) => ({
      ...mission,
      completed: true,
    }));
    expect(
      sessionActivities(history, completed).filter(
        (item) => item.id === 'mission:workout',
      ),
    ).toHaveLength(1);
  });
});
