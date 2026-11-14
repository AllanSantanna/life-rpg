import { describe, it, expect } from 'vitest';
import { applyGoalCommand, isGoalState } from './commands';
import { blankGoal, goalTemplates } from './templates';
import { emptyGoals, type GoalDefinition, type GoalState } from './types';
import { goalCycles, currentGoalCycle } from './progress';
import { goalRewards } from './rewards';
import { emptyRecords, type LifeRecords } from '../records/types';
import { recordReward, projectEffortActivities } from '../records/progression';
import { realMissionHistory } from '../missions/catalog';
import { shiftDate } from '../records/dates';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { createLocalStateStorage } from '../../shared/storage/localStateStorage';
const today = '2026-11-13';
const apply = (
  state: GoalState,
  c: Parameters<typeof applyGoalCommand>[1],
  date = today,
) => applyGoalCommand(state, c, date);
function goal(def: Partial<GoalDefinition> = {}, date = today) {
  return apply(
    emptyGoals(),
    {
      type: 'save',
      id: 'g',
      definition: { ...blankGoal(date), title: 'Meu objetivo livre', ...def },
    },
    date,
  );
}
function update(state: GoalState, date: string, value: number, goalId = 'g') {
  return apply(
    state,
    {
      type: 'update',
      value: {
        id: `${goalId}-${date}-${state.updates.length}`,
        goalId,
        date,
        value,
      },
    },
    date,
  );
}
describe('Quests livres, ciclos e indicadores', () => {
  it('cria livremente com unidade personalizada e não cria quests ao listar modelos', () => {
    const state = goal({
      title: 'Construir um instrumento',
      unit: 'peças',
      target: 10000,
      description: 'Projeto artesanal',
    });
    expect(isGoalState(state)).toBe(true);
    expect(state.items[0]).toMatchObject({
      title: 'Construir um instrumento',
      unit: 'peças',
    });
    expect(goalTemplates(today)).toHaveLength(5);
    expect(emptyGoals().items).toEqual([]);
    expect(() =>
      goal({
        tracking: 'automatic',
        metric: 'cash',
        pillar: 'Treinos',
        unit: 'reais',
      }),
    ).toThrow();
    expect(() => goal({ deadline: '2026-01-01' })).toThrow();
  });
  it('atualiza progresso absoluto, substitui o mesmo dia e permite desfazer/excluir sem duplicar', () => {
    let state = update(goal(), today, 3000);
    state = update(state, today, 5000);
    expect(state.updates).toHaveLength(1);
    expect(
      currentGoalCycle(state.items[0]!, state, emptyRecords(), today),
    ).toMatchObject({ value: 5000, percent: 50, completed: false });
    state = update(state, today, 10000);
    expect(goalRewards(state, emptyRecords(), [], today).total).toBe(25);
    state = update(state, today, 0);
    expect(goalRewards(state, emptyRecords(), [], today).total).toBe(0);
    state = apply(state, { type: 'deleteUpdate', id: state.updates[0]!.id });
    expect(state.updates).toEqual([]);
  });
  it('mantém histórico diário e inicia novos ciclos sem transportar progresso', () => {
    let state = goal({ cadence: 'daily', target: 1000 }, '2026-11-11');
    state = update(state, '2026-11-11', 1000);
    state = update(state, '2026-11-12', 1000);
    const cycles = goalCycles(state.items[0]!, state, emptyRecords(), today);
    expect(cycles.map((c) => c.status)).toEqual([
      'completed',
      'completed',
      'active',
    ]);
    expect(cycles.at(-1)?.value).toBe(0);
    expect(goalRewards(state, emptyRecords(), [], today).total).toBe(50);
  });
  it('não transforma horas antigas em páginas nem totais diários em semanais ao editar', () => {
    let state = goal({ unit: 'horas', target: 10000 });
    state = update(state, today, 5000);
    state = apply(state, {
      type: 'save',
      id: 'g',
      definition: {
        ...blankGoal(today),
        title: 'Meu objetivo livre',
        unit: 'páginas',
        target: 10000,
      },
    });
    expect(
      currentGoalCycle(state.items[0]!, state, emptyRecords(), today).value,
    ).toBe(0);
    expect(state.updates[0]!.unit).toBe('horas');
    state = update(state, today, 3000);
    expect(state.updates).toHaveLength(2);
    expect(
      currentGoalCycle(state.items[0]!, state, emptyRecords(), today).value,
    ).toBe(3000);
  });
  it('calcula ciclos semanais, mensais, personalizados e prazos vencidos', () => {
    const records = {
      ...emptyRecords(),
      workouts: [
        { date: '2026-11-01', trained: true },
        { date: '2026-11-09', trained: true },
        { date: '2026-11-10', trained: true },
        { date: today, trained: false },
      ],
    };
    for (const [cadence, expected] of [
      ['weekly', 2000],
      ['monthly', 2000],
      ['custom', 2000],
    ] as const) {
      const state = goal({
        pillar: 'Treinos',
        tracking: 'automatic',
        metric: 'workouts',
        unit: 'dias',
        target: 4000,
        cadence,
        customDays: 7,
        startDate: '2026-11-09',
      });
      expect(
        currentGoalCycle(state.items[0]!, state, records, today).value,
      ).toBe(expected);
    }
    const expired = goal({ deadline: '2026-11-12', startDate: '2026-11-01' });
    expect(
      currentGoalCycle(expired.items[0]!, expired, records, today).status,
    ).toBe('overdue');
    const planned = goal({ startDate: '2026-12-01' });
    expect(
      currentGoalCycle(planned.items[0]!, planned, records, today).status,
    ).toBe('planned');
  });
  it('soma páginas e sono reais no período sem usar missões ou dados duplicados', () => {
    const records = {
      ...emptyRecords(),
      readings: [
        { id: 'r1', bookId: 'b', date: today, pages: 20 },
        { id: 'r2', bookId: 'b', date: '2026-11-12', pages: 10 },
      ],
      sleep: [
        { date: today, hours: 7.5 },
        { date: '2026-11-12', hours: 8 },
      ],
    };
    const pages = goal({
      pillar: 'Conhecimento',
      tracking: 'automatic',
      metric: 'pages',
      unit: 'páginas',
      target: 100000,
      startDate: '2026-11-12',
    });
    expect(currentGoalCycle(pages.items[0]!, pages, records, today).value).toBe(
      30000,
    );
    const sleep = goal({
      pillar: 'Descanso',
      tracking: 'automatic',
      metric: 'sleep',
      unit: 'horas',
      target: 8000,
      cadence: 'daily',
      startDate: '2026-11-12',
    });
    expect(
      currentGoalCycle(sleep.items[0]!, sleep, records, today),
    ).toMatchObject({ value: 7500, completed: false });
    const almost = { ...records, sleep: [{ date: today, hours: 7.9996 }] };
    expect(
      currentGoalCycle(sleep.items[0]!, sleep, almost, today).completed,
    ).toBe(false);
  });
  it('distingue aportes, receitas, despesas, saldo e patrimônio com cotações reais disponíveis', () => {
    const records: LifeRecords = {
      ...emptyRecords(),
      finance: {
        accounts: [
          { id: 'principal', name: 'Conta', initialCents: 100000, date: today },
        ],
        transfers: [],
        valuations: [],
        quotes: [],
      },
      movements: [
        {
          id: 'income',
          kind: 'income',
          description: 'Receita',
          category: 'Geral',
          amountCents: 10000,
          date: today,
        },
        {
          id: 'expense',
          kind: 'expense',
          description: 'Consumo',
          category: 'Geral',
          amountCents: 5000,
          date: today,
        },
      ],
      investments: [
        { id: 'i', name: 'Caixinha', category: 'Caixinhas bancárias' },
      ],
      investmentEntries: [
        {
          id: 'initial',
          investmentId: 'i',
          kind: 'contribution',
          positionInitial: true,
          amountCents: 10000,
          date: today,
        },
        {
          id: 'buy',
          investmentId: 'i',
          kind: 'contribution',
          amountCents: 20000,
          date: today,
        },
      ],
    };
    for (const [metric, value] of [
      ['contributions', 200000],
      ['income', 100000],
      ['expenses', 50000],
      ['net', 50000],
      ['cash', 850000],
      ['investments', 300000],
      ['wealth', 1150000],
    ] as const) {
      const state = goal({
        pillar: 'Finanças',
        tracking: 'automatic',
        metric,
        unit: 'reais',
        target: 500000,
      });
      expect(
        currentGoalCycle(state.items[0]!, state, records, today).value,
      ).toBe(value);
    }
    const missing = goal({
      pillar: 'Finanças',
      tracking: 'automatic',
      metric: 'wealth',
      unit: 'reais',
    });
    expect(
      currentGoalCycle(missing.items[0]!, missing, emptyRecords(), today).value,
    ).toBeNull();
  });
  it('pausa sem apagar dados, impede progresso manual e retoma mantendo o histórico', () => {
    let state = goal({ cadence: 'daily', target: 1000 }, '2026-11-10');
    state = update(state, '2026-11-10', 1000);
    state = apply(state, { type: 'pause', id: 'g' }, '2026-11-10');
    expect(() => update(state, '2026-11-11', 1000)).toThrow(/ativas/);
    const records = {
      ...emptyRecords(),
      workouts: [{ date: '2026-11-11', trained: true }],
    };
    expect(
      currentGoalCycle(state.items[0]!, state, records, '2026-11-11').status,
    ).toBe('paused');
    state = apply(state, { type: 'resume', id: 'g' }, '2026-11-12');
    state = update(state, '2026-11-12', 1000);
    expect(state.updates).toHaveLength(2);
    expect(state.items[0]!.pauses).toEqual([
      { from: '2026-11-10', to: '2026-11-12' },
    ]);
  });
  it('editar recalcula recompensas e guarda configuração anterior; excluir exige confirmação e conserva histórico', () => {
    let state = update(goal(), today, 10000);
    expect(goalRewards(state, emptyRecords(), [], today).total).toBe(25);
    state = apply(state, {
      type: 'save',
      id: 'g',
      definition: {
        ...blankGoal(today),
        title: 'Meu objetivo livre',
        target: 20000,
      },
    });
    expect(goalRewards(state, emptyRecords(), [], today).total).toBe(0);
    expect(state.items[0]!.revisions).toHaveLength(1);
    expect(state.updates).toHaveLength(1);
    expect(() =>
      apply(state, { type: 'delete', id: 'g', confirmed: false }),
    ).toThrow();
    state = apply(state, { type: 'delete', id: 'g', confirmed: true });
    expect(state.items[0]!.deletedOn).toBe(today);
    expect(state.updates).toHaveLength(1);
    expect(goalRewards(state, emptyRecords(), [], today).total).toBe(0);
  });
});
describe('XP limitado e Radar preservado', () => {
  it('limita quests idênticas e o total por dia/semana, sem depósitos repetidos', () => {
    let state = emptyGoals();
    for (let i = 0; i < 6; i++) {
      const date = shiftDate('2026-11-09', Math.floor(i / 2));
      state = apply(
        state,
        {
          type: 'save',
          id: `g${i}`,
          definition: {
            ...blankGoal(date),
            title: `Objetivo ${i}`,
            difficulty: 'hard',
            target: 1000,
          },
        },
        date,
      );
      state = update(state, date, 1000, `g${i}`);
    }
    const reward = goalRewards(state, emptyRecords(), [], today);
    expect(reward.total).toBe(100);
    expect(
      reward.entries
        .filter((e) => e.date === '2026-11-09')
        .reduce((sum, e) => sum + e.xp, 0),
    ).toBe(50);
    expect(goalRewards(state, emptyRecords(), [], today)).toEqual(reward);
    let twins = goal({ target: 1000 });
    twins = apply(twins, {
      type: 'save',
      id: 'twin',
      definition: {
        ...blankGoal(today),
        title: '  MEU OBJETIVO LIVRE  ',
        target: 1000,
      },
    });
    twins = update(twins, today, 1000);
    twins = update(twins, today, 1000, 'twin');
    expect(goalRewards(twins, emptyRecords(), [], today).total).toBe(25);
  });
  it('atividade e missão já premiadas consomem o orçamento da quest do mesmo pilar', () => {
    const records = {
      ...emptyRecords(),
      workouts: [{ date: today, trained: true }],
    };
    let state = goal({
      title: 'Meu treino',
      pillar: 'Treinos',
      tracking: 'automatic',
      metric: 'workouts',
      unit: 'dias',
      target: 1000,
    });
    expect(
      currentGoalCycle(state.items[0]!, state, records, today).completed,
    ).toBe(true);
    expect(goalRewards(state, records, [], today).total).toBe(0);
    expect(recordReward(records, [], today)).toBe(150);
    state = update(goal({ pillar: 'Treinos', target: 1000 }), today, 1000);
    const missions = realMissionHistory([
      { missionId: 'workout', date: today, completed: true, source: 'user' },
    ]);
    expect(goalRewards(state, emptyRecords(), missions, today).total).toBe(0);
  });
  it('criar/editar quests, concluir quest Geral ou atingir saldo não modifica o Radar', () => {
    const records = emptyRecords(),
      before = projectEffortActivities([], [], records, today);
    const state = update(
      goal({ kind: 'completion', target: 1000 }),
      today,
      1000,
    );
    expect(goalRewards(state, records, [], today).total).toBe(25);
    expect(projectEffortActivities([], [], records, today)).toEqual(before);
    const financial = {
      ...records,
      finance: {
        accounts: [
          { id: 'principal', name: 'Conta', initialCents: 100000, date: today },
        ],
        transfers: [],
        valuations: [],
        quotes: [],
      },
    };
    const money = goal({
      pillar: 'Finanças',
      tracking: 'automatic',
      metric: 'cash',
      unit: 'reais',
      target: 100000,
    });
    expect(goalRewards(money, financial, [], today).total).toBe(0);
  });
  it('não premia retrospectivamente dados anteriores à criação nem conserva recompensa após desfazer', () => {
    let state = goal({
      pillar: 'Treinos',
      tracking: 'automatic',
      metric: 'workouts',
      unit: 'dias',
      target: 1000,
      startDate: '2026-11-01',
    });
    const records = {
      ...emptyRecords(),
      workouts: [{ date: '2026-11-02', trained: true }],
    };
    expect(goalRewards(state, records, [], today).total).toBe(0);
    state = goal({ target: 1000 }, '2026-11-10');
    state = update(state, '2026-11-10', 1000);
    state = update(state, '2026-11-11', 0);
    state = update(state, today, 1000);
    expect(
      currentGoalCycle(state.items[0]!, state, emptyRecords(), today)
        .completedOn,
    ).toBe(today);
  });
});
describe('Persistência e migração de quests v4', () => {
  it('migra v3 conservando perfil, registros e missões, e salva sem repetir a migração', () => {
    const state = createInitialPlayerState();
    state.profile.name = 'Lia';
    state.records.workouts = [{ date: today, trained: true }];
    state.missionEvents = [
      { missionId: 'read', date: today, completed: true, source: 'user' },
    ];
    const old: Record<string, unknown> = { ...state };
    delete old.goals;
    const migrated = migratePlayerState(3, old);
    expect(migrated).toMatchObject({
      profile: state.profile,
      records: state.records,
      missionEvents: state.missionEvents,
      goals: emptyGoals(),
    });
    expect(isPlayerState(migrated)).toBe(true);
    if (!migrated) throw new Error('Migração esperada');
    migrated.goals = update(goal(), today, 3000);
    const storage = createLocalStateStorage(
      'goal-test',
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => localStorage,
      migratePlayerState,
    );
    expect(storage.save(migrated)).toBe(true);
    expect(storage.load()).toEqual({ status: 'loaded', data: migrated });
    expect(
      isPlayerState({
        ...migrated,
        goals: { items: [], updates: [{ id: 'bad' }] },
      }),
    ).toBe(false);
  });
});
