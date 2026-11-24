import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyRecords, type LifeRecords } from '../../records/types';
import { applyRecordCommand } from '../../records/commands';
import { shiftDate } from '../../records/dates';
import { projectEffortActivities } from '../../records/progression';
import { scorePeriod } from '../../evolution/scoring';
import { emptyGoals, type GoalState } from '../../goals/types';
import { applyGoalCommand } from '../../goals/commands';
import { blankGoal } from '../../goals/templates';
import { realMissionHistory } from '../../missions/catalog';
import type { Mission } from '../../missions/types';
import {
  achievementAssetPaths,
  achievementMedalAssets,
  ACHIEVEMENT_ASSET_ROOT,
} from './assetPaths';
import {
  achievementCatalog,
  achievementGroups,
  achievementRarities,
} from './catalog';
import {
  achievementTotals,
  featuredAchievements,
  nearestAchievement,
  projectAchievements,
  recentAchievements,
} from './evaluate';
import { achievementMetrics } from './metrics';
import { defaultAchievementFilters, filterAchievements } from './filters';

const today = '2026-11-13'; // sexta-feira
const publicDir = join(process.cwd(), 'public');
const manifest = JSON.parse(
  readFileSync(
    join(publicDir, ACHIEVEMENT_ASSET_ROOT, 'manifest.json'),
    'utf8',
  ),
) as { assets: { files: { webp: { path: string } }; status: string }[] };

function project(
  records: LifeRecords,
  extra: { missions?: Mission[]; goals?: GoalState } = {},
) {
  return projectAchievements({
    records,
    missions: extra.missions ?? [],
    goals: extra.goals ?? emptyGoals(),
    today,
  });
}
const find = (list: ReturnType<typeof project>, id: string) => {
  const status = list.find((item) => item.id === id);
  if (!status) throw new Error(id);
  return status;
};
const unlockedIds = (list: ReturnType<typeof project>) =>
  list.filter((item) => item.unlocked).map((item) => item.id);
const lastDays = (count: number, end = today) =>
  Array.from({ length: count }, (_, i) => shiftDate(end, -i));
const trained = (dates: string[]): LifeRecords => ({
  ...emptyRecords(),
  workouts: dates.map((date) => ({ date, trained: true })),
});

describe('Catálogo de conquistas', () => {
  it('tem 42 conquistas únicas, sem secretas, distribuídas por pilar e raridade', () => {
    expect(achievementCatalog).toHaveLength(42);
    expect(new Set(achievementCatalog.map((a) => a.id)).size).toBe(42);
    const count = (key: 'group' | 'rarity', value: string) =>
      achievementCatalog.filter((a) => a[key] === value).length;
    expect(
      Object.fromEntries(achievementGroups.map((g) => [g, count('group', g)])),
    ).toEqual({
      Treinos: 9,
      Conhecimento: 8,
      Finanças: 8,
      Descanso: 8,
      Especiais: 9,
    });
    expect(
      Object.fromEntries(
        achievementRarities.map((r) => [r, count('rarity', r)]),
      ),
    ).toEqual({ common: 9, uncommon: 9, rare: 10, epic: 8, legendary: 6 });
  });

  it('preserva os ids do catálogo anterior', () => {
    const ids = achievementCatalog.map((a) => a.id);
    for (const id of ['first', 'consistent', 'reader', 'balance'])
      expect(ids).toContain(id);
  });

  it('objetivos progressivos de uma mesma métrica sobem de raridade', () => {
    const byMetric = new Map<string, typeof achievementCatalog>();
    for (const item of achievementCatalog)
      byMetric.set(item.metric, [...(byMetric.get(item.metric) ?? []), item]);
    for (const items of byMetric.values()) {
      const sorted = [...items].sort((a, b) => a.target - b.target);
      const ranks = sorted.map((a) => achievementRarities.indexOf(a.rarity));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(new Set(sorted.map((a) => a.target)).size).toBe(sorted.length);
    }
  });

  it('usa somente assets existentes, listados no manifesto e utilizáveis', () => {
    const manifestPaths = new Map(
      manifest.assets.map((a) => [a.files.webp.path, a.status]),
    );
    for (const item of achievementCatalog)
      expect(achievementMedalAssets).toContain(item.medal);
    for (const path of achievementAssetPaths) {
      expect(existsSync(join(publicDir, path))).toBe(true);
      const relative = path.slice(ACHIEVEMENT_ASSET_ROOT.length);
      expect(manifestPaths.get(relative)).toMatch(/^(ready|review)$/);
      expect(path).toMatch(/\.webp$/);
    }
  });
});

describe('Progresso calculado dos registros', () => {
  it('conta vazia: nada desbloqueado, progresso zero e sem "mais próxima" inventada', () => {
    const list = project(emptyRecords());
    expect(unlockedIds(list)).toEqual([]);
    expect(find(list, 'training-10').progress).toBe('0 de 10 dias treinados');
    expect(nearestAchievement(list)).toBeNull();
    expect(achievementTotals(list)).toEqual({
      total: 42,
      unlocked: 0,
      locked: 42,
      percent: 0,
    });
  });

  it('desbloqueia por atividade válida, com a data do registro', () => {
    const list = project(trained([today]));
    expect(find(list, 'training-first')).toMatchObject({
      unlocked: true,
      unlockedOn: today,
      progress: 'Conquistada',
    });
    expect(find(list, 'first').unlocked).toBe(true);
    expect(find(list, 'training-10')).toMatchObject({
      unlocked: false,
      current: 1,
      unlockedOn: null,
      progress: '1 de 10 dias treinados',
    });
  });

  it('marcos progressivos: 30 dias liberam 1, 10 e 30, com a data do décimo dia', () => {
    const dates = lastDays(30);
    const list = project(trained(dates));
    expect(find(list, 'training-first').unlocked).toBe(true);
    expect(find(list, 'training-10').unlockedOn).toBe([...dates].sort()[9]);
    expect(find(list, 'training-30').unlocked).toBe(true);
    expect(find(list, 'training-100')).toMatchObject({
      unlocked: false,
      progress: '30 de 100 dias treinados',
    });
    expect(nearestAchievement(list)?.id).not.toBe('training-30');
  });

  it('edição e exclusão de registros recalculam e revertem o estado', () => {
    let records = trained([today]);
    expect(find(project(records), 'training-first').unlocked).toBe(true);
    records = applyRecordCommand(
      records,
      { type: 'saveWorkout', value: { date: today, trained: false } },
      today,
    );
    expect(find(project(records), 'training-first').unlocked).toBe(false);
    records = applyRecordCommand(
      records,
      { type: 'deleteWorkout', date: today },
      today,
    );
    expect(unlockedIds(project(records))).toEqual([]);
  });

  it('ignora registros com data futura', () => {
    expect(unlockedIds(project(trained([shiftDate(today, 1)])))).toEqual([]);
  });

  it('repetir registros no mesmo dia não avança e valores em dinheiro não importam', () => {
    const movement = (id: string, amountCents: number) => ({
      id,
      kind: 'expense' as const,
      description: 'Mercado',
      amountCents,
      category: 'Alimentação',
      date: today,
    });
    const many = project({
      ...emptyRecords(),
      movements: Array.from({ length: 30 }, (_, i) => movement(`m${i}`, 100)),
    });
    const rich = project({
      ...emptyRecords(),
      movements: [movement('big', 999_999_999)],
    });
    expect(find(many, 'finance-first').unlocked).toBe(true);
    expect(find(many, 'finance-weeks-4').progress).toBe(
      'Maior sequência: 1 de 4 semanas seguidas com registro',
    );
    expect(unlockedIds(many)).toEqual(unlockedIds(rich));
  });

  it('semana forte exige 3 dias na mesma semana (segunda a domingo)', () => {
    // Segunda 09/11 a quarta 11/11: mesma semana.
    const list = project(trained(['2026-11-09', '2026-11-10', '2026-11-11']));
    expect(find(list, 'training-strong-week').unlockedOn).toBe('2026-11-11');
    // Domingo 08/11, segunda 09/11 e terça 10/11: duas semanas.
    expect(
      find(
        project(trained(['2026-11-08', '2026-11-09', '2026-11-10'])),
        'training-strong-week',
      ).unlocked,
    ).toBe(false);
  });

  it('ritmo de ferro: 4 semanas seguidas com 3 treinos; uma semana fraca reinicia', () => {
    const week = (monday: string) => [0, 2, 4].map((d) => shiftDate(monday, d));
    const mondays = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'];
    expect(
      find(project(trained(mondays.flatMap(week))), 'training-iron-rhythm')
        .unlocked,
    ).toBe(true);
    const broken = project(
      trained([
        ...week(mondays[0]!),
        ...week(mondays[2]!),
        ...week(mondays[3]!),
      ]),
    );
    expect(find(broken, 'training-iron-rhythm').progress).toBe(
      'Maior sequência: 2 de 4 semanas seguidas com 3 treinos',
    );
  });

  it('livros concluídos usam a data da leitura que completou o livro', () => {
    const records: LifeRecords = {
      ...emptyRecords(),
      books: [
        { id: 'a', title: 'A', totalPages: 100 },
        { id: 'b', title: 'B', totalPages: 50 },
        { id: 'c', title: 'C', totalPages: 80 },
        { id: 'd', title: 'D', totalPages: 300 },
      ],
      readings: [
        { id: 'r1', bookId: 'a', date: '2026-11-01', pages: 60 },
        { id: 'r2', bookId: 'a', date: '2026-11-05', pages: 40 },
        { id: 'r3', bookId: 'b', date: '2026-11-06', pages: 50 },
        { id: 'r4', bookId: 'c', date: '2026-11-10', pages: 80 },
        { id: 'r5', bookId: 'd', date: '2026-11-11', pages: 120 },
      ],
    };
    const list = project(records);
    expect(find(list, 'knowledge-book-1').unlockedOn).toBe('2026-11-05');
    expect(find(list, 'reader').unlockedOn).toBe('2026-11-10');
    expect(find(list, 'knowledge-book-10').progress).toBe(
      '3 de 10 livros concluídos',
    );
    expect(find(list, 'knowledge-days-10').progress).toBe(
      '5 de 10 dias de leitura',
    );
  });

  it('descanso: meta atual de sono, sequências e recálculo ao mudar a meta', () => {
    const sleep = lastDays(7).map((date) => ({ date, hours: 8 }));
    const records: LifeRecords = {
      ...emptyRecords(),
      sleep,
      sleepGoalHours: 8,
    };
    const list = project(records);
    expect(find(list, 'rest-first').unlocked).toBe(true);
    expect(find(list, 'rest-goal-7').unlocked).toBe(true);
    expect(find(list, 'rest-streak-7').unlocked).toBe(true);
    const broken = project({
      ...records,
      sleep: sleep.map((night, i) =>
        i === 3 ? { ...night, hours: 6 } : night,
      ),
    });
    expect(find(broken, 'rest-streak-7').unlocked).toBe(false);
    expect(find(broken, 'rest-goal-7').progress).toBe('6 de 7 noites na meta');
    const stricter = project({ ...records, sleepGoalHours: 9 });
    expect(find(stricter, 'rest-goal-7').unlocked).toBe(false);
    expect(find(stricter, 'rest-first').unlocked).toBe(true);
  });

  it('finanças: investimento sem data de aquisição desbloqueia sem data; diversificação e mapa', () => {
    const records: LifeRecords = {
      ...emptyRecords(),
      investments: [
        { id: 'i1', name: 'Tesouro', category: 'Renda fixa' },
        { id: 'i2', name: 'VALE3', category: 'Ações' },
        { id: 'i3', name: 'BTC', category: 'Bitcoin' },
      ],
      investmentEntries: [
        {
          id: 'e1',
          investmentId: 'i1',
          kind: 'contribution',
          amountCents: 1000,
          date: '2026-11-02',
          positionInitial: true,
          acquisitionDateUnknown: true,
        },
        {
          id: 'e2',
          investmentId: 'i2',
          kind: 'contribution',
          amountCents: 1000,
          date: '2026-11-03',
        },
        {
          id: 'e3',
          investmentId: 'i3',
          kind: 'contribution',
          amountCents: 1000,
          date: '2026-11-04',
        },
      ],
      finance: {
        accounts: [
          { id: 'c', name: 'Conta', initialCents: 0, date: '2026-11-01' },
        ],
        transfers: [],
        valuations: [
          {
            id: 'v',
            investmentId: 'i2',
            amountCents: 1200,
            date: '2026-11-08',
          },
        ],
        quotes: [],
      },
    };
    const list = project(records);
    expect(find(list, 'finance-investment')).toMatchObject({
      unlocked: true,
      unlockedOn: null,
    });
    expect(find(list, 'finance-diversified')).toMatchObject({
      unlocked: true,
      unlockedOn: null,
    });
    expect(find(list, 'finance-mapped')).toMatchObject({
      unlocked: true,
      unlockedOn: '2026-11-08',
    });
    // A posição inicial não é registro financeiro do dia (como no XP).
    expect(find(list, 'finance-first').unlockedOn).toBe('2026-11-03');
  });

  it('Modo Avançado só conta sessões em dias marcados como treinados', () => {
    const session = {
      id: 's',
      date: today,
      status: 'completed' as const,
    };
    const advanced = {
      advancedWorkouts: { sessions: [session] },
    } as unknown as Partial<LifeRecords>;
    expect(
      find(project({ ...emptyRecords(), ...advanced }), 'training-session')
        .unlocked,
    ).toBe(false);
    expect(
      find(project({ ...trained([today]), ...advanced }), 'training-session')
        .unlocked,
    ).toBe(true);
  });

  it('especiais: sequência geral, dia completo e missões confirmadas pelo usuário', () => {
    const missions = realMissionHistory([
      { missionId: 'workout', date: today, completed: true, source: 'user' },
    ]);
    expect(find(project(emptyRecords(), { missions }), 'first').unlocked).toBe(
      true,
    );
    const records: LifeRecords = {
      ...emptyRecords(),
      workouts: lastDays(7).map((date) => ({ date, trained: true })),
      readings: [{ id: 'r', bookId: 'b', date: today, pages: 5 }],
      sleep: [{ date: today, hours: 8 }],
      movements: [
        {
          id: 'm',
          kind: 'income',
          description: 'Salário',
          amountCents: 1,
          category: 'Salário',
          date: today,
        },
      ],
    };
    const list = project(records);
    expect(find(list, 'consistent').unlocked).toBe(true);
    expect(find(list, 'four-pillars-day').unlockedOn).toBe(today);
    expect(find(list, 'active-streak-30').progress).toBe(
      'Maior sequência: 7 de 30 dias seguidos com atividade',
    );
  });

  it('equilíbrio é histórico e usa a mesma regra do Radar (scorePeriod)', () => {
    const week = lastDays(7, shiftDate(today, -40));
    const records: LifeRecords = {
      ...emptyRecords(),
      workouts: week.map((date) => ({ date, trained: true })),
      readings: week.map((date, i) => ({
        id: `r${i}`,
        bookId: 'b',
        date,
        pages: 1,
      })),
      sleep: week.map((date) => ({ date, hours: 8 })),
      movements: week.slice(0, 3).map((date, i) => ({
        id: `m${i}`,
        kind: 'expense' as const,
        description: 'Conta',
        amountCents: 1,
        category: 'Casa',
        date,
      })),
    };
    const activities = projectEffortActivities([], [], records, today);
    expect(Object.values(scorePeriod(activities, 7))).toEqual([0, 0, 0, 0]);
    const list = project(records);
    expect(find(list, 'balance')).toMatchObject({
      unlocked: true,
      unlockedOn: week[0],
    });
    // Equivalência com o Radar: com dados só na janela atual, o melhor valor
    // é o número de pilares com pontuação 100 em scorePeriod.
    const recent: LifeRecords = {
      ...emptyRecords(),
      workouts: lastDays(4).map((date) => ({ date, trained: true })),
      readings: lastDays(3).map((date, i) => ({
        id: `x${i}`,
        bookId: 'b',
        date,
        pages: 1,
      })),
      sleep: lastDays(7).map((date) => ({ date, hours: 8 })),
    };
    const scores = scorePeriod(
      projectEffortActivities([], [], recent, today),
      7,
    );
    const metrics = achievementMetrics({
      records: recent,
      missions: [],
      goals: emptyGoals(),
      today,
    });
    expect(metrics.balancedWeek.value).toBe(
      Object.values(scores).filter((value) => value === 100).length,
    );
    expect(metrics.balancedWeek.value).toBe(2);
  });

  it('quests: conclusão conta; metas de saldo em dinheiro não', () => {
    const save = (
      state: GoalState,
      id: string,
      extra: Partial<ReturnType<typeof blankGoal>>,
    ) =>
      applyGoalCommand(
        state,
        {
          type: 'save',
          id,
          definition: { ...blankGoal(today), title: `Quest ${id}`, ...extra },
        },
        today,
      );
    let goals = save(emptyGoals(), 'q', { kind: 'completion', target: 1000 });
    goals = applyGoalCommand(
      goals,
      {
        type: 'update',
        value: { id: 'u', goalId: 'q', date: today, value: 1000 },
      },
      today,
    );
    expect(
      find(project(emptyRecords(), { goals }), 'quest-first'),
    ).toMatchObject({ unlocked: true, unlockedOn: today });
    const money = save(emptyGoals(), 'cash', {
      pillar: 'Finanças',
      tracking: 'automatic',
      metric: 'cash',
      unit: 'reais',
      target: 1000,
    });
    expect(
      find(project(emptyRecords(), { goals: money }), 'quest-first').unlocked,
    ).toBe(false);
  });
});

describe('Seletores de resumo e filtros', () => {
  const list = project(trained(lastDays(30)));

  it('recentes por data dos registros, destaques por raridade e no máximo o limite', () => {
    const recent = recentAchievements(list, 3);
    expect(recent).toHaveLength(3);
    expect(recent.every((item) => item.unlocked)).toBe(true);
    const dates = recent.map((item) => item.unlockedOn ?? '');
    expect(dates).toEqual([...dates].sort().reverse());
    const featured = featuredAchievements(list, 4);
    const ranks = featured.map((item) =>
      achievementRarities.indexOf(item.rarity),
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  it('a mais próxima é a bloqueada com maior fração real do objetivo', () => {
    const nearest = nearestAchievement(list)!;
    expect(nearest.unlocked).toBe(false);
    for (const item of list.filter((a) => !a.unlocked))
      expect(item.current / item.target).toBeLessThanOrEqual(
        nearest.current / nearest.target,
      );
  });

  it('filtra por pilar, raridade e estado', () => {
    const all = filterAchievements(list, defaultAchievementFilters);
    expect(all).toHaveLength(42);
    const training = filterAchievements(list, {
      ...defaultAchievementFilters,
      group: 'Treinos',
    });
    expect(training.every((a) => a.group === 'Treinos')).toBe(true);
    const unlockedRare = filterAchievements(list, {
      group: 'all',
      rarity: 'rare',
      state: 'unlocked',
    });
    // 30 dias seguidos também cobrem 4 semanas com 3 treinos.
    expect(unlockedRare.map((a) => a.id)).toEqual([
      'training-30',
      'training-iron-rhythm',
    ]);
    const locked = filterAchievements(list, {
      ...defaultAchievementFilters,
      state: 'locked',
    });
    expect(locked.every((a) => !a.unlocked)).toBe(true);
    expect(locked.length + achievementTotals(list).unlocked).toBe(42);
  });
});
