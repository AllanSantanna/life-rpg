import type { LifeRecords, RecordCommand } from './types';
import { investmentCategories } from '../finances/types';
import { bookProgress } from '../knowledge/calculations';
import { isDate } from './dates';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const cents = (value: unknown): value is number =>
  positive(value) && Number.isSafeInteger(value) && value <= 1e12;
function list(
  value: unknown,
  valid: (entry: Record<string, unknown>) => boolean,
  key = 'id',
): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length <= 10000 &&
    value.every((item: unknown) => record(item) && valid(item)) &&
    new Set(value.map((item: Record<string, unknown>) => item[key])).size ===
      value.length
  );
}
export function isLifeRecords(value: unknown): value is LifeRecords {
  if (
    !record(value) ||
    !positive(value.sleepGoalHours) ||
    value.sleepGoalHours < 1 ||
    value.sleepGoalHours > 24
  )
    return false;
  if (
    !list(
      value.movements,
      (item) =>
        text(item.id) &&
        (item.kind === 'income' || item.kind === 'expense') &&
        text(item.description) &&
        text(item.category) &&
        cents(item.amountCents) &&
        isDate(item.date),
    )
  )
    return false;
  if (
    !list(
      value.investments,
      (item) =>
        text(item.id) &&
        text(item.name) &&
        investmentCategories.some((category) => category === item.category),
    )
  )
    return false;
  const investments = value.investments;
  if (
    !list(
      value.investmentEntries,
      (item) =>
        text(item.id) &&
        investments.some((investment) => investment.id === item.investmentId) &&
        (item.kind === 'contribution' || item.kind === 'withdrawal') &&
        cents(item.amountCents) &&
        isDate(item.date) &&
        ((item.quantity === undefined &&
          item.purchasePriceCents === undefined) ||
          (item.kind === 'contribution' &&
            positive(item.quantity) &&
            cents(item.purchasePriceCents) &&
            Math.round(item.quantity * item.purchasePriceCents) ===
              item.amountCents)),
    )
  )
    return false;
  const entries = value.investmentEntries;
  const gross = [...value.movements, ...entries].reduce(
    (sum, item) => sum + Number(item.amountCents),
    0,
  );
  if (!Number.isSafeInteger(gross)) return false;
  for (const investment of investments) {
    let balance = 0;
    for (const entry of [...entries]
      .filter((item) => item.investmentId === investment.id)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
      balance +=
        entry.kind === 'contribution'
          ? Number(entry.amountCents)
          : -Number(entry.amountCents);
      if (balance < 0 || !Number.isSafeInteger(balance)) return false;
    }
  }
  if (
    !list(
      value.workouts,
      (item) => isDate(item.date) && typeof item.trained === 'boolean',
      'date',
    )
  )
    return false;
  if (
    !list(
      value.sleep,
      (item) =>
        isDate(item.date) &&
        typeof item.hours === 'number' &&
        Number.isFinite(item.hours) &&
        item.hours >= 0 &&
        item.hours <= 24,
      'date',
    )
  )
    return false;
  if (
    !list(
      value.books,
      (item) =>
        text(item.id) &&
        text(item.title) &&
        cents(item.totalPages) &&
        item.totalPages <= 1e6,
    )
  )
    return false;
  const books = value.books;
  if (
    !list(
      value.readings,
      (item) =>
        text(item.id) &&
        books.some((book) => book.id === item.bookId) &&
        cents(item.pages) &&
        isDate(item.date),
    )
  )
    return false;
  const readings = value.readings;
  return books.every(
    (book) =>
      readings
        .filter((entry: Record<string, unknown>) => entry.bookId === book.id)
        .reduce(
          (sum: number, entry: Record<string, unknown>) =>
            sum + Number(entry.pages),
          0,
        ) <= Number(book.totalPages),
  );
}
function upsert<T>(items: readonly T[], value: T, key: keyof T): T[] {
  const exists = items.some((item) => item[key] === value[key]);
  return exists
    ? items.map((item) => (item[key] === value[key] ? value : item))
    : [...items, value];
}
/** Operações puras: só publica um estado inteiro e válido. Edição substitui, não acumula. */
export function applyRecordCommand(
  records: LifeRecords,
  command: RecordCommand,
  today: string,
): LifeRecords {
  if ('value' in command && 'date' in command.value)
    assert(
      isDate(command.value.date) && command.value.date <= today,
      'Informe uma data válida até hoje.',
    );
  let next: LifeRecords = records;
  switch (command.type) {
    case 'saveMovement':
      next = {
        ...records,
        movements: upsert(records.movements, command.value, 'id'),
      };
      break;
    case 'deleteMovement':
      next = {
        ...records,
        movements: records.movements.filter((item) => item.id !== command.id),
      };
      break;
    case 'saveInvestment':
      if (command.initialEntry)
        assert(
          command.initialEntry.investmentId === command.value.id &&
            command.initialEntry.kind === 'contribution' &&
            command.initialEntry.date <= today,
          'A aplicação inicial deve pertencer a este investimento.',
        );
      next = {
        ...records,
        investments: upsert(records.investments, command.value, 'id'),
        investmentEntries: command.initialEntry
          ? upsert(records.investmentEntries, command.initialEntry, 'id')
          : records.investmentEntries,
      };
      break;
    case 'deleteInvestment':
      next = {
        ...records,
        investments: records.investments.filter(
          (item) => item.id !== command.id,
        ),
        investmentEntries: records.investmentEntries.filter(
          (item) => item.investmentId !== command.id,
        ),
      };
      break;
    case 'saveInvestmentEntry':
      next = {
        ...records,
        investmentEntries: upsert(
          records.investmentEntries,
          command.value,
          'id',
        ),
      };
      break;
    case 'deleteInvestmentEntry':
      next = {
        ...records,
        investmentEntries: records.investmentEntries.filter(
          (item) => item.id !== command.id,
        ),
      };
      break;
    case 'saveWorkout':
      next = {
        ...records,
        workouts: upsert(records.workouts, command.value, 'date'),
      };
      break;
    case 'deleteWorkout':
      next = {
        ...records,
        workouts: records.workouts.filter((item) => item.date !== command.date),
      };
      break;
    case 'saveSleep':
      next = {
        ...records,
        sleep: upsert(records.sleep, command.value, 'date'),
      };
      break;
    case 'deleteSleep':
      next = {
        ...records,
        sleep: records.sleep.filter((item) => item.date !== command.date),
      };
      break;
    case 'setSleepGoal':
      next = { ...records, sleepGoalHours: command.hours };
      break;
    case 'saveBook': {
      const pages = records.readings
        .filter((item) => item.bookId === command.value.id)
        .reduce((sum, item) => sum + item.pages, 0);
      assert(
        command.value.totalPages >= pages,
        'O total do livro não pode ser menor que as páginas já lidas.',
      );
      next = { ...records, books: upsert(records.books, command.value, 'id') };
      break;
    }
    case 'deleteBook':
      next = {
        ...records,
        books: records.books.filter((book) => book.id !== command.id),
        readings: records.readings.filter(
          (entry) => entry.bookId !== command.id,
        ),
      };
      break;
    case 'saveReading': {
      const book = records.books.find(
        (item) => item.id === command.value.bookId,
      );
      assert(book, 'Selecione um livro cadastrado.');
      const otherPages = records.readings
        .filter(
          (item) => item.bookId === book.id && item.id !== command.value.id,
        )
        .reduce((sum, item) => sum + item.pages, 0);
      assert(
        otherPages + command.value.pages <= book.totalPages,
        'A leitura ultrapassa o total de páginas do livro.',
      );
      next = {
        ...records,
        readings: upsert(records.readings, command.value, 'id'),
      };
      break;
    }
    case 'deleteReading':
      next = {
        ...records,
        readings: records.readings.filter((item) => item.id !== command.id),
      };
      break;
    case 'finishBook': {
      const book = records.books.find((item) => item.id === command.id);
      assert(book, 'Livro não encontrado.');
      assert(
        isDate(command.date) && command.date <= today,
        'Informe uma data válida até hoje.',
      );
      const { remaining } = bookProgress(book, records.readings);
      if (!remaining) return records;
      assert(
        !records.readings.some((entry) => entry.id === command.entryId),
        'Identificador de leitura já utilizado.',
      );
      next = {
        ...records,
        readings: [
          ...records.readings,
          {
            id: command.entryId,
            bookId: book.id,
            date: command.date,
            pages: remaining,
          },
        ],
      };
      break;
    }
  }
  assert(
    isLifeRecords(next),
    'Verifique os campos. Valores devem ser válidos e uma retirada não pode exceder o saldo aplicado na data.',
  );
  return next;
}
