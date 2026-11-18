import { describe, it, expect } from 'vitest';
import { areas, scorePeriod, type EffortActivity } from '../evolution/scoring';
import {
  evaluateClass,
  initialClass,
  type ClassState,
  CLASS_RULES,
} from './classes';
const today = '2026-11-13';
function activities(
  area: (typeof areas)[number],
  days = [0, 2, 4, 6, 8, 10],
): EffortActivity[] {
  return days.map((daysAgo) => ({
    id: `${area}:${daysAgo}`,
    area,
    daysAgo,
    effort: 1,
  }));
}
const balanced = () =>
  areas.flatMap((area) =>
    activities(
      area,
      Array.from({ length: 30 }, (_, i) => i),
    ),
  );
describe('classes automáticas sobre o Radar real de 30 dias', () => {
  it('começa sem classe e classifica desde a primeira atividade', () => {
    expect(evaluateClass([], initialClass(), today).state.current).toBeNull();
    expect(
      evaluateClass(activities('Treinos', [0]), initialClass(), today).state
        .current,
    ).toBe('warrior');
    expect(CLASS_RULES.period).toBe(30);
  });
  it.each([
    ['Treinos', 'warrior'],
    ['Conhecimento', 'sage'],
    ['Finanças', 'strategist'],
    ['Descanso', 'guardian'],
  ] as const)(
    'especializa %s como %s sem bônus ou cálculo alternativo',
    (area, id) => {
      const entries = activities(
        area,
        Array.from({ length: 12 }, (_, i) => i * 2),
      );
      const result = evaluateClass(entries, initialClass(), today);
      expect(result.state).toEqual({
        current: id,
        changedOn: today,
        pending: null,
      });
      expect(result.scores).toEqual(scorePeriod(entries, 30));
    },
  );
  it('especializa mesmo com poucos pontos e sem histórico semanal', () => {
    expect(
      evaluateClass(activities('Descanso', [0]), initialClass(), today).state
        .current,
    ).toBe('guardian');
    const repeated = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      area: 'Treinos' as const,
      daysAgo: 0,
      effort: 1,
    }));
    const result = evaluateClass(repeated, initialClass(), today);
    expect(result.state.current).toBe('warrior');
    expect(result.scores).toEqual(scorePeriod(activities('Treinos', [0]), 30));
  });
  it('Mestre exige participação forte nos quatro pilares', () => {
    expect(evaluateClass(balanced(), initialClass(), today).state.current).toBe(
      'master',
    );
    expect(
      evaluateClass(
        balanced().filter((a) => a.area !== 'Descanso'),
        initialClass(),
        today,
      ).state.current,
    ).not.toBe('master');
  });
  it('equilíbrio baixo e vários registros no mesmo dia não conquistam Mestre', () => {
    for (const days of [
      [0],
      [0, 7, 14],
      Array.from({ length: 18 }, (_, i) => i),
    ]) {
      expect(
        evaluateClass(
          areas.flatMap((a) => activities(a, days)),
          initialClass(),
          today,
        ).state.current,
      ).not.toBe('master');
    }
  });
  it('Mestre exige equilíbrio entre pontuações além do mínimo em cada área', () => {
    const entries = balanced().filter(
      (a) => a.area !== 'Descanso' || a.daysAgo % 2 === 0,
    );
    expect(evaluateClass(entries, initialClass(), today).scores.Descanso).toBe(
      50,
    );
    expect(
      evaluateClass(entries, initialClass(), today).state.current,
    ).not.toBe('master');
  });
  it('usa a normalização do Radar para comparar dedicação em pilares com metas diferentes', () => {
    const entries = [
      ...activities('Finanças', [0, 2, 4, 6, 8, 10, 12, 14]),
      ...activities('Treinos', [0, 2, 4, 6, 8, 10, 12, 14]),
    ];
    const result = evaluateClass(entries, initialClass(), today);
    expect(result.scores).toMatchObject({ Finanças: 62, Treinos: 47 });
    expect(result.state.current).toBe('strategist');
  });
  it('Mestre exige equilíbrio mesmo quando os quatro pilares ultrapassam 60 pontos', () => {
    const entries = balanced().filter(
      (a) => a.area !== 'Descanso' || a.daysAgo < 23,
    );
    const result = evaluateClass(entries, initialClass(), today);
    expect(Math.min(...Object.values(result.scores))).toBeGreaterThanOrEqual(
      60,
    );
    expect(result.state.current).not.toBe('master');
    expect(
      evaluateClass(
        [...entries, ...activities('Descanso', [23])],
        initialClass(),
        today,
      ).state.current,
    ).toBe('master');
  });
  it('Mestre exige distribuição semanal em cada pilar mesmo com pontuações altas e equilibradas', () => {
    const entries = areas.flatMap((area) =>
      activities(
        area,
        Array.from(
          {
            length: {
              Finanças: 11,
              Treinos: 14,
              Descanso: 25,
              Conhecimento: 18,
            }[area],
          },
          (_, i) => i,
        ),
      ),
    );
    const result = evaluateClass(entries, initialClass(), today);
    expect(Math.min(...Object.values(result.scores))).toBeGreaterThanOrEqual(
      80,
    );
    expect(
      Math.max(...Object.values(result.scores)) -
        Math.min(...Object.values(result.scores)),
    ).toBeLessThanOrEqual(20);
    expect(result.state.current).not.toBe('master');
  });
  it('considera o 30º dia inclusive e descarta tudo que ocorreu antes', () => {
    const entries = activities('Finanças', [19, 21, 23, 25, 27, 29]);
    expect(evaluateClass(entries, initialClass(), today).state.current).toBe(
      'strategist',
    );
    const expired = entries.map((a) => ({ ...a, daysAgo: a.daysAgo + 1 }));
    expect(evaluateClass(expired, initialClass(), today).state.current).toBe(
      'strategist',
    );
  });
  it('troca imediatamente pela maior estatística e limpa candidatos antigos', () => {
    const state: ClassState = {
      current: 'warrior',
      changedOn: today,
      pending: { id: 'guardian', since: today },
    };
    const result = evaluateClass(activities('Conhecimento', [0]), state, today);
    expect(result.state).toEqual({
      current: 'sage',
      changedOn: today,
      pending: null,
    });
    expect(evaluateClass([], result.state, today).state.current).toBeNull();
  });
  it('preserva a classe entre líderes empatados e resolve novos empates de forma estável', () => {
    const entries = areas.flatMap((area) =>
      activities(
        area,
        Array.from({ length: 30 }, (_, i) => i),
      ),
    );
    // Três pilares saturados empatam em 100; sem Descanso, não há Mestre.
    const tied = entries.filter((a) => a.area !== 'Descanso');
    const state: ClassState = {
      current: 'sage',
      changedOn: today,
      pending: null,
    };
    expect(evaluateClass(tied, state, today).state).toBe(state);
    const first = evaluateClass(tied, initialClass(), today).state;
    expect(first.current).not.toBeNull();
    expect(evaluateClass(tied, first, today).state).toBe(first);
  });
  it('desempata novamente quando a classe atual não está entre os maiores pilares', () => {
    const state: ClassState = {
      current: 'guardian',
      changedOn: today,
      pending: null,
    };
    const entries = [
      ...activities(
        'Treinos',
        Array.from({ length: 30 }, (_, i) => i),
      ),
      ...activities(
        'Conhecimento',
        Array.from({ length: 30 }, (_, i) => i),
      ),
    ];
    expect(evaluateClass(entries, state, today).state.current).toBe('warrior');
  });
  it('exclui datas futuras, valores inválidos, registros fora do período e duplicados', () => {
    const entries = activities('Treinos', [-1, 30, 31, 90]);
    expect(evaluateClass(entries, initialClass(), today).activeDays).toBe(0);
    const real = activities('Treinos');
    expect(
      evaluateClass([...real, ...real], initialClass(), today).scores,
    ).toEqual(scorePeriod(real, 30));
  });
});
