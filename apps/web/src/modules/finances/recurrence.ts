import { daysBetween, shiftDate } from '../records/dates';
import type { LifeRecords } from '../records/types';
import type { MoneyMovement, RecurringRule } from './types';

/**
 * Agenda das recorrências financeiras. Datas são civis (`AAAA-MM-DD`), sem
 * horário nem fuso: a mesma regra produz as mesmas datas em qualquer fuso.
 *
 * Regra de ajuste: o dia de referência é o da data inicial. Em meses sem esse
 * dia (29, 30 ou 31), a ocorrência cai no último dia do mês; o mês seguinte
 * volta ao dia de referência (31/01 → 28/02 ou 29/02 → 31/03). Na série anual
 * iniciada em 29/02, anos não bissextos usam 28/02. Cada ocorrência é calculada
 * a partir da data inicial (índice n), nunca da ocorrência anterior, para não
 * acumular desvios.
 *
 * Ocorrências não são gravadas: são calculadas somente para a janela
 * consultada, com limite de iterações. A identidade de uma ocorrência é o par
 * regra/data (`occurrenceKey`).
 */
export const RECURRENCE_HORIZON_DAYS = 30;
const MAX_OCCURRENCES = 5000;

export const frequencyLabels: Record<RecurringRule['frequency'], string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function addMonthsClamped(start: string, months: number) {
  const [year, month, day] = start.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const index = month - 1 + months;
  const targetYear = year + Math.floor(index / 12);
  const targetMonth = (((index % 12) + 12) % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

/** Data da ocorrência de índice `n` (0 = data inicial). */
export function occurrenceAt(
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  n: number,
) {
  switch (rule.frequency) {
    case 'weekly':
      return shiftDate(rule.startDate, 7 * n);
    case 'monthly':
      return addMonthsClamped(rule.startDate, n);
    case 'yearly':
      return addMonthsClamped(rule.startDate, 12 * n);
  }
}

/** Primeiro índice cuja data pode ser ≥ `from` (estimativa segura por baixo). */
function firstIndex(
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  from: string,
) {
  if (from <= rule.startDate) return 0;
  const days = daysBetween(from, rule.startDate);
  const n =
    rule.frequency === 'weekly'
      ? Math.floor(days / 7)
      : rule.frequency === 'monthly'
        ? Math.floor(days / 31)
        : Math.floor(days / 366);
  return Math.max(0, n - 1);
}

/** Datas da série em [from, to], com limite de iterações. */
export function scheduledDates(
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  from: string,
  to: string,
) {
  const dates: string[] = [];
  for (
    let n = firstIndex(rule, from), steps = 0;
    steps < MAX_OCCURRENCES;
    n++, steps++
  ) {
    const date = occurrenceAt(rule, n);
    if (date > to) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

/** Indica se `date` pertence à agenda da regra. */
export function isScheduled(
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  date: string,
) {
  return scheduledDates(rule, date, date).length === 1;
}

export const occurrenceKey = (ruleId: string, date: string) =>
  `${ruleId}:${date}`;

/** ID determinístico da movimentação que confirma uma ocorrência. */
export const occurrenceMovementId = (ruleId: string, date: string) =>
  `recorrencia:${ruleId}:${date}`;

/** Ocorrências confirmadas, derivadas das movimentações reais vinculadas. */
export function confirmedOccurrences(
  movements: readonly MoneyMovement[],
  ruleId: string,
) {
  return movements.filter((item) => item.recurrence?.ruleId === ruleId);
}

function paused(rule: RecurringRule, date: string) {
  return (rule.pauses ?? []).some(
    (pause) =>
      pause.from <= date && (pause.to === undefined || date < pause.to),
  );
}

export interface Occurrence {
  key: string;
  rule: RecurringRule;
  date: string;
  overdue: boolean;
}

/**
 * Ocorrências pendentes de uma regra até `to`: não confirmadas, não
 * dispensadas, fora de pausas e dentro da série. Regras encerradas não têm
 * pendências; pausadas, nenhuma enquanto a pausa durar.
 */
export function pendingOccurrences(
  rule: RecurringRule,
  movements: readonly MoneyMovement[],
  today: string,
  to = shiftDate(today, RECURRENCE_HORIZON_DAYS),
): Occurrence[] {
  if (rule.status === 'ended') return [];
  const confirmed = new Set(
    confirmedOccurrences(movements, rule.id).map(
      (item) => item.recurrence!.date,
    ),
  );
  const skipped = new Set(rule.skipped ?? []);
  const last = rule.endDate && rule.endDate < to ? rule.endDate : to;
  return scheduledDates(rule, rule.startDate, last)
    .filter(
      (date) =>
        !confirmed.has(date) && !skipped.has(date) && !paused(rule, date),
    )
    .map((date) => ({
      key: occurrenceKey(rule.id, date),
      rule,
      date,
      overdue: date < today,
    }));
}

/** Pendências de todas as regras, das mais antigas para as mais distantes. */
export function upcomingOccurrences(records: LifeRecords, today: string) {
  return (records.finance?.recurrences ?? [])
    .flatMap((rule) => pendingOccurrences(rule, records.movements, today))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.rule.description.localeCompare(b.rule.description, 'pt-BR'),
    );
}

/** Próxima ocorrência ainda não confirmada a partir de hoje (sem janela). */
export function nextOccurrence(
  rule: RecurringRule,
  movements: readonly MoneyMovement[],
  today: string,
) {
  if (rule.status !== 'active') return null;
  const from = rule.startDate > today ? rule.startDate : today;
  const to = shiftDate(from, rule.frequency === 'yearly' ? 400 : 40);
  return (
    pendingOccurrences(rule, movements, today, to).find(
      (item) => item.date >= today,
    )?.date ?? null
  );
}

/** Movimentação real que confirma a ocorrência (data efetiva ≤ hoje). */
export function confirmationDraft(
  rule: RecurringRule,
  date: string,
  today: string,
): Omit<MoneyMovement, 'id'> {
  return {
    kind: rule.kind,
    description: rule.description,
    amountCents: rule.amountCents,
    category: rule.category,
    // Competência = data prevista; efetivação = data informada ao confirmar.
    // Ocorrências futuras confirmadas antecipadamente usam a data de hoje.
    date: date <= today ? date : today,
    recurrence: { ruleId: rule.id, date },
  };
}
