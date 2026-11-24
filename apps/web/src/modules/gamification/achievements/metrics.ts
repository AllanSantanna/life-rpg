import type { LifeRecords } from '../../records/types';
import type { Mission } from '../../missions/types';
import type { GoalState } from '../../goals/types';
import { goalCycles } from '../../goals/progress';
import { realEfforts } from '../../records/progression';
import { isInitialPosition } from '../../finances/initialPosition';
import { areas, defaultGoals } from '../../evolution/scoring';
import type { AchievementMetric } from './catalog';

/**
 * Valor de uma métrica e a data (pelos registros) em que um alvo foi atingido.
 * `reachedOn` devolve `null` quando a data não pode ser determinada com
 * segurança, por exemplo em posições iniciais com data de aquisição
 * desconhecida.
 */
export interface MetricResult {
  value: number;
  reachedOn: (target: number) => string | null;
}
export type AchievementMetrics = Record<AchievementMetric, MetricResult>;

export interface AchievementSources {
  records: LifeRecords;
  missions: readonly Mission[];
  goals: GoalState;
  today: string;
}

const DAY = 86_400_000;
const dayIndex = (date: string) =>
  Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
/** Semanas de segunda a domingo, como as Quests semanais. */
const weekIndex = (date: string) => Math.floor((dayIndex(date) + 3) / 7);

const unique = (dates: Iterable<string>) => [...new Set(dates)].sort();

/** Contagem de eventos; datada apenas se todos os eventos tiverem data. */
function countMetric(events: readonly (string | null)[]): MetricResult {
  const dated = events.every((date) => date !== null);
  const sorted = dated ? [...(events as string[])].sort() : [];
  return {
    value: events.length,
    reachedOn: (target) => (dated ? (sorted[target - 1] ?? null) : null),
  };
}

/** Maior sequência de índices consecutivos (dias ou semanas). */
function streakMetric(
  items: readonly { index: number; date: string }[],
): MetricResult {
  const sorted = [...items].sort((a, b) => a.index - b.index);
  const firstReach: string[] = [];
  let streak = 0;
  let previous: number | null = null;
  for (const item of sorted) {
    if (item.index === previous) continue;
    streak = previous !== null && item.index === previous + 1 ? streak + 1 : 1;
    previous = item.index;
    if (firstReach[streak - 1] === undefined)
      firstReach[streak - 1] = item.date;
  }
  return {
    value: firstReach.length,
    reachedOn: (target) => firstReach[target - 1] ?? null,
  };
}
const dayStreak = (dates: readonly string[]) =>
  streakMetric(dates.map((date) => ({ index: dayIndex(date), date })));

/** Data em que cada semana atingiu `minimum` dias distintos, em ordem. */
function weeksReaching(dates: readonly string[], minimum: number) {
  const weeks = new Map<number, string[]>();
  for (const date of unique(dates)) {
    const week = weekIndex(date);
    weeks.set(week, [...(weeks.get(week) ?? []), date]);
  }
  return [...weeks]
    .filter(([, days]) => days.length >= minimum)
    .map(([index, days]) => ({ index, date: days[minimum - 1]! }))
    .sort((a, b) => a.index - b.index);
}

function booksFinished({ records, today }: AchievementSources) {
  return records.books.flatMap((book) => {
    const entries = records.readings
      .filter((entry) => entry.bookId === book.id && entry.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const pages = entries.reduce((sum, entry) => sum + entry.pages, 0);
    // Mesmo critério do catálogo anterior: páginas lidas iguais ao total.
    if (pages !== book.totalPages) return [];
    let sum = 0;
    for (const entry of entries) {
      sum += entry.pages;
      if (sum >= book.totalPages) return [entry.date];
    }
    return [];
  });
}

function investmentEvents({ records, today }: AchievementSources) {
  return records.investments.flatMap((investment) => {
    const entries = records.investmentEntries.filter(
      (entry) => entry.investmentId === investment.id && entry.date <= today,
    );
    if (!entries.length) return [];
    // Uma posição inicial sem data de aquisição não permite datar o marco.
    const date = entries.some((entry) => entry.acquisitionDateUnknown)
      ? null
      : entries.map((entry) => entry.date).sort()[0]!;
    return [{ category: investment.category, date }];
  });
}

function questCompletions({ goals, records, today }: AchievementSources) {
  return goals.items
    .filter(
      (goal) =>
        !goal.deletedOn &&
        // Mesmo critério das recompensas: metas de saldo não contam.
        !(
          goal.tracking === 'automatic' &&
          ['cash', 'wealth', 'investments'].includes(goal.metric ?? '')
        ),
    )
    .flatMap((goal) => {
      const dates = goalCycles(goal, goals, records, today)
        .filter(
          (cycle) =>
            cycle.completed &&
            cycle.completedOn !== null &&
            cycle.completedOn >= goal.createdDate &&
            cycle.completedOn <= today,
        )
        .map((cycle) => cycle.completedOn!)
        .sort();
      return dates.length ? [dates[0]!] : [];
    });
}

/**
 * Maior número de pilares com a meta de dedicação atingida numa mesma janela
 * de 7 dias, com a regra de `scorePeriod` (esforço somado e dias distintos
 * iguais ou acima da meta semanal). Basta avaliar janelas que terminam em dias
 * com atividade: qualquer outra janela está contida em uma delas.
 */
function balancedWeek(efforts: ReturnType<typeof realEfforts>): MetricResult {
  const byArea = new Map(
    areas.map((area) => [area, new Map<number, number>()]),
  );
  for (const day of efforts) {
    if (!(day.effort > 0)) continue;
    const daily = byArea.get(day.area)!;
    const index = dayIndex(day.date);
    daily.set(index, Math.min(1, (daily.get(index) ?? 0) + day.effort));
  }
  const firstReach: string[] = [];
  for (const end of unique(efforts.map((day) => day.date))) {
    const last = dayIndex(end);
    let met = 0;
    for (const area of areas) {
      const daily = byArea.get(area)!;
      let effort = 0;
      let days = 0;
      for (let index = last - 6; index <= last; index += 1) {
        const value = daily.get(index);
        if (value) {
          effort += value;
          days += 1;
        }
      }
      const goal = defaultGoals[area];
      if (effort >= goal && days >= goal) met += 1;
    }
    for (let count = 1; count <= met; count += 1) {
      firstReach[count - 1] ??= end;
    }
  }
  return {
    value: firstReach.length,
    reachedOn: (target) => firstReach[target - 1] ?? null,
  };
}

/** Todas as métricas do catálogo, sem estado salvo e sem efeitos colaterais. */
export function achievementMetrics(
  sources: AchievementSources,
): AchievementMetrics {
  const { records, missions, today } = sources;
  const efforts = realEfforts(records, missions).filter(
    (day) => day.date <= today,
  );
  const qualifying = efforts.filter((day) => day.qualifies);
  const activeDates = unique(qualifying.map((day) => day.date));
  const areasByDate = new Map<string, Set<string>>();
  for (const day of qualifying) {
    areasByDate.set(
      day.date,
      (areasByDate.get(day.date) ?? new Set()).add(day.area),
    );
  }

  const trainingDates = unique(
    records.workouts
      .filter((entry) => entry.trained && entry.date <= today)
      .map((entry) => entry.date),
  );
  const strongWeeks = weeksReaching(trainingDates, 3);
  // Como no XP, uma sessão do Modo Avançado só conta se o dia foi marcado
  // como treinado: os dados avançados sozinhos não alteram a progressão.
  const trainedSet = new Set(trainingDates);
  const sessionDates = unique(
    (records.advancedWorkouts?.sessions ?? [])
      .filter(
        (session) =>
          session.status === 'completed' && trainedSet.has(session.date),
      )
      .map((session) => session.date),
  );
  const readingDates = unique(
    records.readings
      .filter((entry) => entry.pages > 0 && entry.date <= today)
      .map((entry) => entry.date),
  );
  const financeDates = unique(
    [
      ...records.movements,
      ...records.investmentEntries.filter((entry) => !isInitialPosition(entry)),
    ]
      .filter((entry) => entry.date <= today)
      .map((entry) => entry.date),
  );
  const investments = investmentEvents(sources);
  const categories = new Map<string, (string | null)[]>();
  for (const { category, date } of investments) {
    categories.set(category, [...(categories.get(category) ?? []), date]);
  }
  const finance = records.finance;
  const firstAccount = (finance?.accounts ?? [])
    .map((account) => account.date)
    .filter((date) => date <= today)
    .sort()[0];
  const firstValuation = (finance?.valuations ?? [])
    .map((valuation) => valuation.date)
    .filter((date) => date <= today)
    .sort()[0];
  const sleep = records.sleep.filter(
    (entry) => entry.hours > 0 && entry.date <= today,
  );
  const sleepDates = unique(sleep.map((entry) => entry.date));
  const sleepGoalDates = unique(
    sleep
      .filter((entry) => entry.hours >= records.sleepGoalHours)
      .map((entry) => entry.date),
  );
  const monthStarts = new Map<string, string>();
  for (const date of activeDates) {
    if (!monthStarts.has(date.slice(0, 7)))
      monthStarts.set(date.slice(0, 7), date);
  }

  return {
    trainingDays: countMetric(trainingDates),
    strongWeeks: countMetric(strongWeeks.map((week) => week.date)),
    strongWeekStreak: streakMetric(strongWeeks),
    detailedSessionDays: countMetric(sessionDates),
    readingDays: countMetric(readingDates),
    booksFinished: countMetric(booksFinished(sources)),
    financeRecordDays: countMetric(financeDates),
    financeWeekStreak: streakMetric(
      weeksReaching(financeDates, 1).map((week) => week),
    ),
    investmentsTracked: countMetric(investments.map((item) => item.date)),
    investmentCategories: countMetric(
      [...categories.values()].map((dates) =>
        dates.includes(null) ? null : [...(dates as string[])].sort()[0]!,
      ),
    ),
    wealthMapped: countMetric(
      [firstAccount, firstValuation].filter(
        (date): date is string => date !== undefined,
      ),
    ),
    sleepNights: countMetric(sleepDates),
    sleepGoalNights: countMetric(sleepGoalDates),
    sleepGoalStreak: dayStreak(sleepGoalDates),
    activeDays: countMetric(activeDates),
    activeStreak: dayStreak(activeDates),
    activeMonths: countMetric([...monthStarts.values()]),
    fourPillarDays: countMetric(
      activeDates.filter(
        (date) => areasByDate.get(date)!.size === areas.length,
      ),
    ),
    balancedWeek: balancedWeek(efforts),
    questsCompleted: countMetric(questCompletions(sources)),
  };
}
