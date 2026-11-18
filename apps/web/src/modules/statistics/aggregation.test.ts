import { describe, expect, it } from 'vitest';
import { comparePeriods, scorePeriod } from '../evolution/scoring';
import { emptyRecords } from '../records/types';
import { projectEffortActivities, recordReward } from '../records/progression';
import {
  testSession,
  testState,
  testSet,
} from '../workouts/advanced/testFixtures';
import {
  evolutionSeries,
  indexActivities,
  pillarSummaries,
} from './aggregation';
import { surfaceGeometry } from './sceneGeometry';

const today = '2026-11-13';
describe('Projeções de Estatísticas', () => {
  it('apresenta ausência de dados sem inventar atividades ou comparações', () => {
    const index = indexActivities(emptyRecords());
    expect(index.size).toBe(0);
    expect(evolutionSeries([], today, 7)).toHaveLength(7);
    expect(pillarSummaries(index, [], today, 7)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          score: 0,
          days: 0,
          consistency: 0,
          comparable: false,
          hasEffort: false,
        }),
      ]),
    );
  });
  it.each([7, 30, 90] as const)(
    'mantém %i amostras e os limites exatos de cada período',
    (period) => {
      const activities = [
        { id: 'current', area: 'Treinos' as const, effort: 1, daysAgo: 0 },
        {
          id: 'boundary',
          area: 'Treinos' as const,
          effort: 1,
          daysAgo: period,
        },
      ];
      const series = evolutionSeries(activities, today, period);
      expect(series).toHaveLength(period);
      expect(series.at(-1)?.date).toBe(today);
      expect(series.at(-1)?.scores).toEqual(scorePeriod(activities, 7));
      expect(series.at(-1)?.previous).toEqual(
        scorePeriod(activities, 7, undefined, period),
      );
      const summaries = pillarSummaries(
        indexActivities(emptyRecords()),
        activities,
        today,
        period,
      );
      const existing = comparePeriods(activities, period);
      expect(
        summaries.find((summary) => summary.area === 'Treinos'),
      ).toMatchObject({
        score: existing.current.Treinos,
        previous: existing.previous.Treinos,
        comparable: true,
      });
    },
  );
  it('usa cobertura financeira por tipo, independentemente do montante e da quantidade de despesas', () => {
    const records = emptyRecords();
    records.movements = [
      {
        id: 'm',
        date: today,
        kind: 'expense',
        amountCents: 100,
        category: 'Geral',
        description: 'Conta paga',
      },
    ];
    expect(
      indexActivities(records).get(today)?.pillars.Finanças.intensity,
    ).toBe(2);
    records.movements.push({
      ...records.movements[0]!,
      id: 'large',
      amountCents: 99999999,
    });
    expect(
      indexActivities(records).get(today)?.pillars.Finanças.intensity,
    ).toBe(2);
    records.investmentEntries.push({
      id: 'initial',
      date: today,
      investmentId: 'missing',
      kind: 'contribution',
      amountCents: 100,
      positionInitial: true,
    });
    expect(
      indexActivities(records).get(today)?.pillars.Finanças.intensity,
    ).toBe(2);
    records.investmentEntries.push({
      ...records.investmentEntries[0]!,
      id: 'real',
      positionInitial: false,
    });
    expect(
      indexActivities(records).get(today)?.pillars.Finanças.intensity,
    ).toBe(4);
    records.movements = [];
    expect(
      indexActivities(records).get(today)?.pillars.Finanças.intensity,
    ).toBe(3);
  });
  it('identifica avaliações e transferências sem confundir cotações ou saldos iniciais com atividade', () => {
    const records = emptyRecords();
    records.finance = {
      accounts: [
        { id: 'a', name: 'Principal', date: today, initialCents: 100 },
      ],
      transfers: [],
      valuations: [
        { id: 'v', investmentId: 'missing', date: today, amountCents: 200 },
      ],
      quotes: [{ priceCents: 100, observedAt: 1, updatedAt: 1 }],
    };
    expect(
      indexActivities(records).get(today)?.pillars.Finanças.intensity,
    ).toBe(1);
    records.finance.transfers.push({
      id: 't',
      fromId: 'a',
      toId: 'missing',
      date: today,
      amountCents: 50,
    });
    expect(indexActivities(records).get(today)?.pillars.Finanças).toMatchObject(
      {
        intensity: 2,
        details: expect.arrayContaining([
          expect.stringContaining('Principal → Conta indisponível'),
        ]),
      },
    );
    records.finance.valuations = [];
    records.finance.transfers = [];
    expect(indexActivities(records).size).toBe(0);
  });
  it('mantém posições iniciais legadas visíveis sem contá-las como atividade', () => {
    const records = emptyRecords();
    records.investmentEntries = [
      {
        id: 'i',
        investmentId: 'missing',
        date: today,
        kind: 'contribution',
        amountCents: 100,
        costUnknown: true,
      },
    ];
    expect(indexActivities(records).get(today)?.pillars.Finanças).toMatchObject(
      { intensity: 0, details: [expect.stringContaining('Posição inicial')] },
    );
  });
  it('distingue sessão em andamento, conclusão e dia treinado sem contar séries como intensidade', () => {
    const records = emptyRecords();
    records.advancedWorkouts = testState();
    records.advancedWorkouts.sessions[0]!.status = 'in_progress';
    expect(indexActivities(records).get(today)?.pillars.Treinos.intensity).toBe(
      1,
    );
    records.workouts = [{ date: today, trained: true }];
    expect(indexActivities(records).get(today)?.pillars.Treinos.intensity).toBe(
      2,
    );
    records.advancedWorkouts.sessions[0]!.status = 'completed';
    expect(indexActivities(records).get(today)?.pillars.Treinos.intensity).toBe(
      4,
    );
    records.workouts = [];
    expect(indexActivities(records).get(today)?.pillars.Treinos.intensity).toBe(
      3,
    );
    records.advancedWorkouts.sessions.push(
      testSession(
        'many',
        today,
        Array.from({ length: 20 }, (_, i) => testSet(String(i))),
      ),
    );
    expect(indexActivities(records).get(today)?.pillars.Treinos.intensity).toBe(
      3,
    );
    expect(
      pillarSummaries(indexActivities(records), [], today, 7).find(
        (item) => item.area === 'Treinos',
      ),
    ).toMatchObject({ days: 1, trainedDays: 0, hasEffort: false });
  });
  it.each([
    [0, 0],
    [3, 1],
    [4, 2],
    [6, 3],
    [8, 4],
    [12, 4],
  ])(
    'classifica %i horas de sono com nível %i para meta de oito horas',
    (hours, expected) => {
      const records = emptyRecords();
      records.sleep = [{ date: today, hours }];
      expect(
        indexActivities(records).get(today)?.pillars.Descanso.intensity,
      ).toBe(expected);
      records.sleepGoalHours = 6;
      if (hours === 6)
        expect(
          indexActivities(records).get(today)?.pillars.Descanso.intensity,
        ).toBe(4);
    },
  );
  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 2],
    [20, 3],
    [40, 4],
  ])(
    'classifica %i páginas no nível %i sem inventar títulos',
    (pages, expected) => {
      const records = emptyRecords();
      records.readings = [{ id: 'r', date: today, bookId: 'missing', pages }];
      const actual = indexActivities(records).get(today)?.pillars.Conhecimento;
      expect(actual?.intensity).toBe(expected);
      expect(actual?.details[0]).toContain('Livro indisponível');
    },
  );
  it('agrega páginas por dia e exclui dias futuros e fora do período da consistência', () => {
    const records = emptyRecords();
    records.readings = [
      { id: '1', date: today, bookId: 'b', pages: 10 },
      { id: '2', date: today, bookId: 'b', pages: 10 },
      { id: '3', date: '2026-11-14', bookId: 'b', pages: 40 },
      { id: '4', date: '2026-11-06', bookId: 'b', pages: 10 },
    ];
    const index = indexActivities(records);
    expect(index.get(today)?.pillars.Conhecimento.intensity).toBe(3);
    expect(
      pillarSummaries(index, [], today, 7).find(
        (item) => item.area === 'Conhecimento',
      ),
    ).toMatchObject({ days: 1, consistency: 14 });
  });
  it('não altera registros, persistência, XP ou Radar; sessões sozinhas não criam dedicação', () => {
    const records = emptyRecords();
    records.advancedWorkouts = testState();
    const before = JSON.stringify(records);
    const reward = recordReward(records, [], today);
    const activities = projectEffortActivities([], [], records, today);
    const radar = scorePeriod(activities, 7);
    for (const period of [7, 30, 90] as const) {
      const index = indexActivities(records);
      evolutionSeries(activities, today, period);
      pillarSummaries(index, activities, today, period);
    }
    expect(JSON.stringify(records)).toBe(before);
    expect(recordReward(records, [], today)).toBe(reward);
    expect(
      scorePeriod(projectEffortActivities([], [], records, today), 7),
    ).toEqual(radar);
    expect(activities).toEqual([]);
  });
  it.each(['landscape', 'surface'] as const)(
    'a geometria %s preserva datas e alturas dos dados, inclusive zero',
    (mode) => {
      const series = evolutionSeries(
        [{ id: 'r', area: 'Treinos', daysAgo: 0, effort: 1 }],
        today,
        7,
      );
      const geometry = surfaceGeometry(series, 'Treinos', 0, mode);
      const positions = geometry.getAttribute('position');
      expect(positions.getY(1)).toBe(0);
      expect(positions.getY(6 * 3 + 1)).toBeCloseTo(
        series[6]!.scores.Treinos * 0.06,
      );
      expect(positions.getX(1)).toBe(-5);
      expect(positions.getX(19)).toBe(5);
      geometry.dispose();
    },
  );
});
