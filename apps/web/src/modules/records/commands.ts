import { isInitialPosition } from '../finances/initialPosition';
import { removeAccount, resetFinances } from '../finances/management';
import { localQuoteDate, valuationBasis } from '../finances/ledger';
import type { LifeRecords, RecordCommand } from './types';
import { position } from '../finances/position';
import { emptyLedger } from '../finances/types';
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
        (item.institution === undefined ||
          (item.category === 'Caixinhas bancárias' &&
            text(item.institution))) &&
        (item.cdiPercentBasisPoints === undefined ||
          (item.category === 'Caixinhas bancárias' &&
            Number.isSafeInteger(item.cdiPercentBasisPoints) &&
            Number(item.cdiPercentBasisPoints) >= 0 &&
            Number(item.cdiPercentBasisPoints) <= 100000)) &&
        investmentCategories.some((category) => category === item.category),
    )
  )
    return false;
  const investments = value.investments;
  if (
    !list(value.investmentEntries, (item) => {
      const asset = investments.find(
        (investment) => investment.id === item.investmentId,
      );
      if (
        !text(item.id) ||
        !asset ||
        (item.kind !== 'contribution' && item.kind !== 'withdrawal') ||
        !isDate(item.date)
      )
        return false;
      if (
        item.positionInitial !== undefined &&
        typeof item.positionInitial !== 'boolean'
      )
        return false;
      if (item.positionInitial === true && item.kind !== 'contribution')
        return false;
      if (
        item.acquisitionDateUnknown !== undefined &&
        (typeof item.acquisitionDateUnknown !== 'boolean' ||
          item.positionInitial !== true)
      )
        return false;
      const unknown = item.costUnknown === true;
      if (
        item.costUnknown !== undefined &&
        typeof item.costUnknown !== 'boolean'
      )
        return false;
      if (
        unknown
          ? !(
              ((asset.category === 'Dólar (USD)' &&
                item.positionInitial !== false) ||
                item.positionInitial === true) &&
              item.kind === 'contribution' &&
              item.amountCents === 0
            )
          : !cents(item.amountCents)
      )
        return false;
      if (
        item.costBasisCents !== undefined &&
        !(
          item.kind === 'withdrawal' &&
          Number.isSafeInteger(item.costBasisCents) &&
          Number(item.costBasisCents) >= 0 &&
          Number(item.costBasisCents) <= 1e12
        )
      )
        return false;
      if (asset.category === 'Bitcoin' || asset.category === 'Dólar (USD)') {
        const scale = asset.category === 'Bitcoin' ? 1e8 : 100;
        return (
          positive(item.quantity) &&
          Number.isSafeInteger(Math.round(item.quantity * scale)) &&
          Math.round(item.quantity * scale) > 0 &&
          Math.abs(item.quantity * scale - Math.round(item.quantity * scale)) <
            0.00001 &&
          (item.purchasePriceCents === undefined ||
            cents(item.purchasePriceCents))
        );
      }
      return (
        (item.quantity === undefined &&
          item.purchasePriceCents === undefined) ||
        (item.positionInitial === true &&
          positive(item.quantity) &&
          item.purchasePriceCents === undefined) ||
        (item.kind === 'contribution' &&
          positive(item.quantity) &&
          cents(item.purchasePriceCents) &&
          Math.round(item.quantity * item.purchasePriceCents) ===
            item.amountCents)
      );
    })
  )
    return false;
  const entries = value.investmentEntries;
  const gross = [...value.movements, ...entries].reduce(
    (sum, item) => sum + Number(item.amountCents),
    0,
  );
  if (!Number.isSafeInteger(gross)) return false;
  try {
    for (const investment of investments) {
      const selected = entries.filter(
        (item) => item.investmentId === investment.id,
      );
      if (
        investment.category === 'Bitcoin' &&
        selected.some((item) => !positive(item.quantity))
      )
        return false;
      position(
        selected as unknown as import('../finances/types').InvestmentEntry[],
        investment.category === 'Bitcoin'
          ? true
          : investment.category === 'Dólar (USD)'
            ? 'USD'
            : false,
      );
    }
  } catch {
    return false;
  }
  if (value.finance !== undefined) {
    const ledger = value.finance;
    if (
      !record(ledger) ||
      !list(
        ledger.accounts,
        (item) =>
          text(item.id) &&
          text(item.name) &&
          Number.isSafeInteger(item.initialCents) &&
          Math.abs(Number(item.initialCents)) <= 1e12 &&
          isDate(item.date),
      )
    )
      return false;
    const accounts = ledger.accounts;
    const accountExists = (id: unknown) =>
      accounts.some((account) => account.id === id);
    if (
      !list(
        ledger.transfers,
        (item) =>
          accountExists(item.fromId) &&
          accountExists(item.toId) &&
          item.fromId !== item.toId &&
          text(item.id) &&
          cents(item.amountCents) &&
          isDate(item.date) &&
          accounts
            .filter(
              (account) =>
                account.id === item.fromId || account.id === item.toId,
            )
            .every((account) => String(account.date) <= String(item.date)),
      )
    )
      return false;
    if (
      !list(
        ledger.valuations,
        (item) =>
          text(item.id) &&
          (item.movementsComplete === undefined ||
            typeof item.movementsComplete === 'boolean') &&
          (item.basis === undefined ||
            (typeof item.basis === 'string' && item.basis.length <= 5000000)) &&
          investments.some(
            (investment) =>
              investment.id === item.investmentId &&
              investment.category !== 'Bitcoin' &&
              investment.category !== 'Dólar (USD)',
          ) &&
          Number.isSafeInteger(item.amountCents) &&
          Number(item.amountCents) >= 0 &&
          Number(item.amountCents) <= 1e12 &&
          isDate(item.date),
      )
    )
      return false;
    if (
      !Array.isArray(ledger.quotes) ||
      ledger.quotes.length > 10000 ||
      !ledger.quotes.every(
        (quote: unknown) =>
          record(quote) &&
          cents(quote.priceCents) &&
          positive(quote.updatedAt) &&
          positive(quote.observedAt) &&
          quote.updatedAt <= quote.observedAt + 60000,
      )
    )
      return false;
    if (
      ledger.usdQuotes !== undefined &&
      (!Array.isArray(ledger.usdQuotes) ||
        ledger.usdQuotes.length > 10000 ||
        !ledger.usdQuotes.every(
          (q: unknown) =>
            record(q) &&
            positive(q.rateUnits) &&
            Number.isSafeInteger(q.rateUnits) &&
            q.rateUnits <= 1e9 &&
            positive(q.updatedAt) &&
            positive(q.observedAt) &&
            q.updatedAt <= q.observedAt + 60000,
        ))
    )
      return false;
    if (
      [...value.movements, ...entries].some(
        (item) =>
          item.accountId !== undefined &&
          !accountExists(item.accountId) &&
          !(
            'investmentId' in item &&
            isInitialPosition(
              item as unknown as import('../finances/types').InvestmentEntry,
            )
          ),
      )
    )
      return false;
  } else if (
    [...value.movements, ...entries].some(
      (item) => item.accountId !== undefined,
    )
  )
    return false;
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
  const finance = records.finance ?? emptyLedger();
  switch (command.type) {
    case 'deleteAccount':
      assert(
        command.confirmed === true,
        'Confirme explicitamente a exclusão da conta e dos registros vinculados.',
      );
      assert(
        finance.accounts.some((item) => item.id === command.id),
        'Conta não encontrada.',
      );
      next = removeAccount(records, command.id);
      break;
    case 'resetFinances':
      assert(command.confirmation === 'ZERAR', 'Digite ZERAR para confirmar.');
      next = resetFinances(records);
      break;
    case 'saveAccount':
      next = {
        ...records,
        finance: {
          ...finance,
          accounts: upsert(finance.accounts, command.value, 'id'),
        },
      };
      break;
    case 'saveTransfer':
      next = {
        ...records,
        finance: {
          ...finance,
          transfers: upsert(finance.transfers, command.value, 'id'),
        },
      };
      break;
    case 'deleteTransfer':
      next = {
        ...records,
        finance: {
          ...finance,
          transfers: finance.transfers.filter((item) => item.id !== command.id),
        },
      };
      break;
    case 'saveValuation':
      if (
        records.investments.some(
          (item) =>
            item.id === command.value.investmentId &&
            item.category === 'Caixinhas bancárias',
        )
      )
        assert(
          records.investmentEntries.some(
            (item) =>
              item.investmentId === command.value.investmentId &&
              item.date <= command.value.date,
          ),
          'A data do saldo deve ser igual ou posterior ao registro da caixinha.',
        );
      next = {
        ...records,
        finance: {
          ...finance,
          valuations: upsert(
            finance.valuations,
            {
              ...command.value,
              basis: valuationBasis(
                records.investmentEntries,
                command.value.investmentId,
                command.value.date,
              ),
            },
            'id',
          ),
        },
      };
      break;
    case 'deleteValuation':
      next = {
        ...records,
        finance: {
          ...finance,
          valuations: finance.valuations.filter(
            (item) => item.id !== command.id,
          ),
        },
      };
      break;
    case 'saveUsdQuote':
      if (!records.investments.some((item) => item.category === 'Dólar (USD)'))
        return records;
      next = {
        ...records,
        finance: {
          ...finance,
          usdQuotes: [
            ...(finance.usdQuotes ?? []).filter(
              (q) =>
                localQuoteDate(q.observedAt) !==
                localQuoteDate(command.value.observedAt),
            ),
            command.value,
          ].sort((a, b) => a.observedAt - b.observedAt),
        },
      };
      break;
    case 'saveQuote':
      if (!records.investments.some((item) => item.category === 'Bitcoin'))
        return records;
      next = {
        ...records,
        finance: {
          ...finance,
          quotes: [
            ...finance.quotes.filter(
              (item) =>
                localQuoteDate(item.observedAt) !==
                localQuoteDate(command.value.observedAt),
            ),
            command.value,
          ].sort((a, b) => a.observedAt - b.observedAt),
        },
      };
      break;

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
      if (command.initialValuation) {
        const v = command.initialValuation;
        assert(
          command.value.category === 'Caixinhas bancárias' &&
            v.investmentId === command.value.id &&
            isDate(v.date) &&
            v.date <= today &&
            next.investmentEntries.some(
              (item) =>
                item.investmentId === v.investmentId && item.date <= v.date,
            ),
          'Informe um saldo de caixinha com data válida após a aplicação.',
        );
        next = {
          ...next,
          finance: {
            ...(next.finance ?? emptyLedger()),
            valuations: upsert(
              next.finance?.valuations ?? [],
              {
                ...v,
                basis: valuationBasis(
                  next.investmentEntries,
                  v.investmentId,
                  v.date,
                ),
              },
              'id',
            ),
          },
        };
      }
      break;
    case 'deleteInvestment':
      next = {
        ...records,
        finance: {
          ...finance,
          valuations: finance.valuations.filter(
            (item) => item.investmentId !== command.id,
          ),
        },
        investments: records.investments.filter(
          (item) => item.id !== command.id,
        ),
        investmentEntries: records.investmentEntries.filter(
          (item) => item.investmentId !== command.id,
        ),
      };
      break;
    case 'convertToInitialPosition': {
      const entry = records.investmentEntries.find(
        (item) => item.id === command.id,
      );
      assert(
        command.confirmed === true,
        'Confirme a conversão em posição inicial.',
      );
      assert(
        entry && entry.kind === 'contribution',
        'Selecione uma compra ou aporte existente.',
      );
      next = {
        ...records,
        investmentEntries: records.investmentEntries.map((item) =>
          item.id === command.id ? { ...item, positionInitial: true } : item,
        ),
      };
      break;
    }
    case 'saveInvestmentEntry':
      assert(
        !(
          records.investmentEntries.some(
            (item) => item.id === command.value.id && !isInitialPosition(item),
          ) && isInitialPosition(command.value)
        ) || command.confirmInitial === true,
        'Confirme a conversão em posição inicial.',
      );
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
