import { areas, comparePeriods, scorePeriod } from '../evolution/scoring';
import type { EffortActivity, Period } from '../evolution/scoring';
import { money } from '../finances/calculations';
import { isInitialPosition } from '../finances/initialPosition';
import { isDate, inLastDays, shiftDate } from '../records/dates';
import type { LifeRecords } from '../records/types';
import type {
  ActivityDay,
  ActivityIndex,
  EvolutionPoint,
  Intensity,
  Pillar,
  PillarSummary,
} from './types';

export const intensityLabels = [
  'Nenhuma atividade',
  'Baixa',
  'Média',
  'Alta',
  'Muito alta',
] as const;

export function emptyActivityDay(date: string): ActivityDay {
  return {
    date,
    trained: false,
    pillars: {
      Finanças: { intensity: 0, details: [] },
      Treinos: { intensity: 0, details: [] },
      Descanso: { intensity: 0, details: [] },
      Conhecimento: { intensity: 0, details: [] },
    },
  };
}

/** Projeção de leitura: não grava dados nem cria esforço, XP ou recompensas. */
export function indexActivities(records: LifeRecords): ActivityIndex {
  const days = new Map<string, ActivityDay>();
  const finance = new Map<
    string,
    { bookkeeping: boolean; investing: boolean }
  >();
  function add(
    date: string,
    area: Pillar,
    detail: string,
    intensity: Intensity,
  ) {
    if (!isDate(date)) return;
    const day = days.get(date) ?? emptyActivityDay(date);
    day.pillars[area].details.push(detail);
    day.pillars[area].intensity = Math.max(
      day.pillars[area].intensity,
      intensity,
    ) as Intensity;
    days.set(date, day);
  }
  function financialDay(date: string, kind: 'bookkeeping' | 'investing') {
    const types = finance.get(date) ?? { bookkeeping: false, investing: false };
    types[kind] = true;
    finance.set(date, types);
  }
  for (const entry of records.movements) {
    add(
      entry.date,
      'Finanças',
      `${entry.kind === 'income' ? 'Receita' : 'Despesa'}: ${entry.description} · ${money(entry.amountCents)}`,
      2,
    );
    financialDay(entry.date, 'bookkeeping');
  }
  for (const entry of records.finance?.transfers ?? []) {
    const accounts = records.finance?.accounts ?? [];
    const from =
      accounts.find((account) => account.id === entry.fromId)?.name ??
      'Conta indisponível';
    const to =
      accounts.find((account) => account.id === entry.toId)?.name ??
      'Conta indisponível';
    add(
      entry.date,
      'Finanças',
      `Transferência: ${from} → ${to} · ${money(entry.amountCents)}`,
      2,
    );
    financialDay(entry.date, 'bookkeeping');
  }
  for (const entry of records.investmentEntries) {
    const name =
      records.investments.find(
        (investment) => investment.id === entry.investmentId,
      )?.name ?? 'Investimento indisponível';
    const initial = isInitialPosition(entry);
    add(
      entry.date,
      'Finanças',
      `${initial ? 'Posição inicial (sem atividade)' : entry.kind === 'contribution' ? 'Aporte' : 'Resgate'}: ${name} · ${money(entry.amountCents)}`,
      initial ? 0 : 3,
    );
    if (!initial) financialDay(entry.date, 'investing');
  }
  for (const entry of records.finance?.valuations ?? []) {
    const name =
      records.investments.find(
        (investment) => investment.id === entry.investmentId,
      )?.name ?? 'Investimento indisponível';
    add(
      entry.date,
      'Finanças',
      `Avaliação: ${name} · ${money(entry.amountCents)}`,
      1,
    );
  }
  for (const [date, types] of finance) {
    const day = days.get(date);
    if (day && types.bookkeeping && types.investing)
      day.pillars.Finanças.intensity = 4;
  }
  const trained = new Set(
    records.workouts
      .filter((entry) => entry.trained)
      .map((entry) => entry.date),
  );
  for (const entry of records.workouts) {
    add(
      entry.date,
      'Treinos',
      entry.trained
        ? 'Dia marcado como treinado.'
        : 'Dia marcado como não treinado.',
      entry.trained ? 2 : 0,
    );
    const day = days.get(entry.date);
    if (day) day.trained = entry.trained;
  }
  for (const session of records.advancedWorkouts?.sessions ?? []) {
    const completed = session.status === 'completed';
    add(
      session.date,
      'Treinos',
      `Sessão ${completed ? 'concluída' : 'em andamento'} · ${session.planName || 'Sem ficha vinculada'} · ${session.exercises.length} exercícios registrados`,
      completed ? (trained.has(session.date) ? 4 : 3) : 1,
    );
  }
  for (const entry of records.sleep) {
    const ratio = entry.hours / records.sleepGoalHours;
    const level: Intensity =
      entry.hours <= 0
        ? 0
        : ratio < 0.5
          ? 1
          : ratio < 0.75
            ? 2
            : ratio < 1
              ? 3
              : 4;
    add(
      entry.date,
      'Descanso',
      `Sono: ${entry.hours.toLocaleString('pt-BR')} h · meta ${records.sleepGoalHours.toLocaleString('pt-BR')} h`,
      level,
    );
  }
  const pages = new Map<string, number>();
  for (const entry of records.readings) {
    const title =
      records.books.find((book) => book.id === entry.bookId)?.title ??
      'Livro indisponível';
    add(
      entry.date,
      'Conhecimento',
      `Leitura: ${title} · ${entry.pages} páginas`,
      0,
    );
    pages.set(entry.date, (pages.get(entry.date) ?? 0) + entry.pages);
  }
  for (const [date, total] of pages) {
    const day = days.get(date);
    if (day)
      day.pillars.Conhecimento.intensity =
        total <= 0 ? 0 : total < 10 ? 1 : total < 20 ? 2 : total < 40 ? 3 : 4;
  }
  return days;
}

function hasEffort(
  activities: readonly EffortActivity[],
  area: Pillar,
  offset: number,
  length: number,
) {
  return activities.some(
    (activity) =>
      activity.area === area &&
      activity.effort > 0 &&
      activity.daysAgo >= offset &&
      activity.daysAgo < offset + length,
  );
}

/** Cada amostra usa a fórmula existente, numa janela móvel de sete dias. */
export function evolutionSeries(
  activities: readonly EffortActivity[],
  today: string,
  period: Period,
): EvolutionPoint[] {
  return Array.from({ length: period }, (_, index) => {
    const offset = period - index - 1;
    return {
      date: shiftDate(today, -offset),
      scores: scorePeriod(activities, 7, undefined, offset),
      previous: scorePeriod(activities, 7, undefined, offset + period),
      comparable: Object.fromEntries(
        areas.map((area) => [
          area,
          hasEffort(activities, area, offset + period, 7),
        ]),
      ) as Record<Pillar, boolean>,
    };
  });
}

export function pillarSummaries(
  index: ActivityIndex,
  activities: readonly EffortActivity[],
  today: string,
  period: Period,
): PillarSummary[] {
  const { current, previous } = comparePeriods(activities, period);
  return areas.map((area) => {
    const days = [...index.values()].filter(
      (day) =>
        inLastDays(day.date, today, period) && day.pillars[area].intensity > 0,
    ).length;
    return {
      area,
      score: current[area],
      previous: previous[area],
      comparable: hasEffort(activities, area, period, period),
      hasEffort: hasEffort(activities, area, 0, period),
      days,
      trainedDays: [...index.values()].filter(
        (day) => day.trained && inLastDays(day.date, today, period),
      ).length,
      consistency: Math.round((100 * days) / period),
    };
  });
}
