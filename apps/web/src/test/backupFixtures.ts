import { createInitialPlayerState, type PlayerState } from '../app/playerState';
import { applyGoalCommand } from '../modules/goals/commands';
import { blankGoal } from '../modules/goals/templates';
import { emptyLedger } from '../modules/finances/types';
import { starterExercises } from '../modules/workouts/advanced/catalog';
import {
  testSession,
  testSet,
  testState,
} from '../modules/workouts/advanced/testFixtures';

/**
 * Jogador SINTÉTICO com todos os tipos de registro persistidos. Usado nos
 * testes de backup e na auditoria nativa; nenhum valor vem de dados reais.
 * `scale` multiplica as listas para os cenários com muitos registros.
 */
export function syntheticPlayer(scale = 1): PlayerState {
  const value = createInitialPlayerState();
  value.profile = {
    ...value.profile,
    name: 'Jogador Sintético',
    initials: 'JS',
    joined: 'novembro de 2026',
  };
  const day = (i: number) => {
    const date = new Date(Date.UTC(2026, 10, 20) - (i % 300) * 86400000);
    return date.toISOString().slice(0, 10);
  };
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  const r = value.records;
  r.movements = range(3 * scale).map((i) => ({
    id: `movement-${i}`,
    kind: i % 3 === 0 ? ('income' as const) : ('expense' as const),
    description: `Movimento sintético ${i}`,
    category: i % 3 === 0 ? 'Trabalho' : 'Alimentação',
    amountCents: 1001 + i * 37,
    date: day(i),
  }));
  r.investments = range(2 * scale).map((i) => ({
    id: `asset-${i}`,
    name: `Ativo sintético ${i}`,
    category: 'Ações',
    ticker: 'VALE3',
  }));
  r.investmentEntries = range(2 * scale).map((i) => ({
    id: `entry-${i}`,
    investmentId: `asset-${i}`,
    kind: 'contribution' as const,
    amountCents: 6000 + i,
    quantity: 1,
    date: day(i),
    positionInitial: true,
  }));
  r.finance = {
    ...emptyLedger(),
    accounts: [
      { id: 'account-a', name: 'Conta A', initialCents: 50000, date: day(299) },
      { id: 'account-b', name: 'Conta B', initialCents: 0, date: day(299) },
    ],
    transfers: range(scale).map((i) => ({
      id: `transfer-${i}`,
      fromId: 'account-a',
      toId: 'account-b',
      amountCents: 250 + i,
      date: day(i),
    })),
    valuations: [
      {
        id: 'valuation-0',
        investmentId: 'asset-0',
        amountCents: 6150,
        date: day(0),
      },
    ],
    quotes: [
      {
        priceCents: 50000000,
        updatedAt: Date.UTC(2026, 10, 20, 12),
        observedAt: Date.UTC(2026, 10, 20, 12),
      },
    ],
  };
  r.workouts = range(Math.min(300, 2 * scale)).map((i) => ({
    date: day(i),
    trained: i % 4 !== 3,
  }));
  r.sleep = range(Math.min(300, 2 * scale)).map((i) => ({
    date: day(i),
    hours: 7 + (i % 3) * 0.5,
  }));
  r.books = range(scale).map((i) => ({
    id: `book-${i}`,
    title: `Livro sintético ${i}`,
    totalPages: 100 + i,
  }));
  r.readings = range(2 * scale).map((i) => ({
    id: `reading-${i}`,
    bookId: `book-${i % scale}`,
    pages: 10,
    date: day(i),
  }));
  const advanced = testState();
  advanced.sessions = range(scale).map((i) => ({
    ...testSession(`session-${i}`, day(i), [testSet(`set-${i}`, 40 + i, 10)]),
    startedAt: `${day(i)}T08:30:00-03:00`,
  }));
  advanced.exercises = [
    {
      ...structuredClone(starterExercises.find((e) => e.id === 'bench')!),
      id: 'custom-exercise',
      name: 'Supino sintético',
    },
  ];
  advanced.plans = [
    {
      id: 'plan-a',
      name: 'Ficha sintética',
      description: 'Ficha de teste',
      notes: '',
      exercises: [
        {
          id: 'plan-a:custom',
          exerciseId: 'custom-exercise',
          sets: 3,
          reps: 10,
          notes: '',
        },
      ],
    },
  ];
  r.advancedWorkouts = advanced;
  value.goals = applyGoalCommand(
    value.goals,
    {
      type: 'save',
      id: 'goal-sintetica',
      definition: {
        ...blankGoal('2026-11-21'),
        title: 'Quest sintética',
        kind: 'completion',
        target: 1000,
      },
    },
    '2026-11-21',
  );
  value.goals = applyGoalCommand(
    value.goals,
    {
      type: 'update',
      value: {
        id: 'goal-update',
        goalId: 'goal-sintetica',
        date: '2026-11-21',
        value: 1000,
      },
    },
    '2026-11-21',
  );
  value.missionEvents = [
    {
      missionId: 'workout',
      date: '2026-11-13',
      completed: true,
      source: 'user',
    },
  ];
  value.preferences = { radarPeriod: 30, missionFilter: 'pending' };
  return value;
}
