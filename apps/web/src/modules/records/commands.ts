import { applyAdvancedWorkoutCommand } from '../workouts/advanced/commands';
import { isAdvancedWorkoutState } from '../workouts/advanced/validation';
import { isInitialPosition } from '../finances/initialPosition';
import { removeAccount, resetFinances } from '../finances/management';
import { localQuoteDate, valuationBasis } from '../finances/ledger';
import type { LifeRecords, RecordCommand } from './types';
import { position, positionMode } from '../finances/position';
import { isShareSaleWithCostBasis } from '../finances/costDiagnostics';
import { quantityTimesPriceCents } from '../finances/monetary';
import {
  emptyLedger,
  isMarketCategory,
  TICKER_PATTERN,
  type InvestmentCategory,
  type MarketQuote,
  type RecurringRule,
} from '../finances/types';
import { investmentCategories } from '../finances/types';
import { walletShortfall } from '../finances/walletLink';
import { isMonth, removeBudget, setBudget } from '../finances/budget';
import { isScheduled, occurrenceMovementId } from '../finances/recurrence';
import { shiftDate } from './dates';
import { bookProgress } from '../knowledge/calculations';
import { isDate } from './dates';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
/** Cotações BTC/USD só são guardadas enquanto houver posição da categoria. */
function withoutOrphanQuotes(
  records: LifeRecords & { finance: NonNullable<LifeRecords['finance']> },
): NonNullable<LifeRecords['finance']> {
  const ledger = records.finance;
  const has = (category: InvestmentCategory) =>
    records.investments.some((item) => item.category === category);
  return {
    ...ledger,
    quotes: has('Bitcoin') ? ledger.quotes : [],
    ...(ledger.usdQuotes
      ? { usdQuotes: has('Dólar (USD)') ? ledger.usdQuotes : [] }
      : {}),
  };
}
/** Motivo específico de uma recusa financeira, quando identificável. */
function rejectionReason(records: LifeRecords): string | null {
  const ledger = records.finance;
  if (ledger) {
    if (ledger.transfers.some((item) => item.fromId === item.toId))
      return 'A transferência precisa usar duas contas diferentes.';
    const opening = new Map(
      ledger.accounts.map((item) => [item.id, item.date]),
    );
    if (
      ledger.transfers.some(
        (item) =>
          (opening.get(item.fromId) ?? '') > item.date ||
          (opening.get(item.toId) ?? '') > item.date,
      )
    )
      return 'A transferência não pode ser anterior à abertura das contas envolvidas.';
  }
  for (const investment of records.investments) {
    try {
      position(
        records.investmentEntries.filter(
          (item) => item.investmentId === investment.id,
        ),
        positionMode(investment.category),
      );
    } catch (error) {
      if (error instanceof Error) return `${investment.name}: ${error.message}`;
    }
  }
  return null;
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
function isRecurringRule(item: Record<string, unknown>) {
  const pauses = item.pauses;
  const skipped = item.skipped;
  const validPauses =
    pauses === undefined ||
    (Array.isArray(pauses) &&
      pauses.length <= 1000 &&
      pauses.every(
        (pause: unknown, index: number) =>
          record(pause) &&
          isDate(pause.from) &&
          (pause.to === undefined
            ? index === pauses.length - 1
            : isDate(pause.to) && String(pause.to) > String(pause.from)),
      ));
  const openPause =
    Array.isArray(pauses) &&
    record(pauses.at(-1)) &&
    (pauses.at(-1) as Record<string, unknown>).to === undefined;
  return (
    text(item.id) &&
    (item.kind === 'income' || item.kind === 'expense') &&
    text(item.description) &&
    cents(item.amountCents) &&
    text(item.category) &&
    (item.frequency === 'weekly' ||
      item.frequency === 'monthly' ||
      item.frequency === 'yearly') &&
    isDate(item.startDate) &&
    (item.status === 'active' ||
      item.status === 'paused' ||
      item.status === 'ended') &&
    (item.status === 'ended'
      ? isDate(item.endDate)
      : item.endDate === undefined) &&
    validPauses &&
    openPause === (item.status === 'paused') &&
    (skipped === undefined ||
      (Array.isArray(skipped) &&
        skipped.length <= 10000 &&
        skipped.every(isDate) &&
        new Set(skipped).size === skipped.length))
  );
}
/** Versões de limite da mesma categoria não podem se sobrepor. */
function budgetsDisjoint(budgets: Record<string, unknown>[]) {
  const sorted = [...budgets].sort(
    (a, b) =>
      String(a.category).localeCompare(String(b.category)) ||
      String(a.from).localeCompare(String(b.from)),
  );
  return sorted.every((item, index) => {
    const previous = sorted[index - 1];
    return (
      !previous ||
      previous.category !== item.category ||
      (previous.to !== undefined && String(previous.to) < String(item.from))
    );
  });
}
export function isLifeRecords(value: unknown): value is LifeRecords {
  if (
    !record(value) ||
    (value.advancedWorkouts !== undefined &&
      !isAdvancedWorkoutState(value.advancedWorkouts)) ||
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
        isDate(item.date) &&
        (item.recurrence === undefined ||
          (record(item.recurrence) &&
            text(item.recurrence.ruleId) &&
            isDate(item.recurrence.date))),
    ) ||
    // Uma ocorrência de recorrência é confirmada no máximo uma vez.
    new Set(
      value.movements
        .filter((item) => record(item.recurrence))
        .map((item) => {
          const link = item.recurrence as Record<string, unknown>;
          return `${String(link.ruleId)}:${String(link.date)}`;
        }),
    ).size !== value.movements.filter((item) => record(item.recurrence)).length
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
        investmentCategories.some((category) => category === item.category) &&
        (item.ticker === undefined ||
          (isMarketCategory(item.category as InvestmentCategory) &&
            typeof item.ticker === 'string' &&
            TICKER_PATTERN.test(item.ticker))),
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
        item.walletLinked !== undefined &&
        (typeof item.walletLinked !== 'boolean' ||
          (item.walletLinked &&
            (item.positionInitial === true || item.costUnknown === true)))
      )
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
      // Ações/FIIs: quantidade com valor informado (compra) ou vendida.
      const shareUnits =
        positive(item.quantity) &&
        Number.isSafeInteger(Math.round(item.quantity * 1e8)) &&
        Math.round(item.quantity * 1e8) > 0 &&
        Math.abs(item.quantity * 1e8 - Math.round(item.quantity * 1e8)) <
          0.00001;
      if (
        isMarketCategory(asset.category as InvestmentCategory) &&
        shareUnits &&
        item.purchasePriceCents === undefined
      )
        return true;
      return (
        (item.quantity === undefined &&
          item.purchasePriceCents === undefined) ||
        (item.positionInitial === true &&
          positive(item.quantity) &&
          item.purchasePriceCents === undefined) ||
        (item.kind === 'contribution' &&
          positive(item.quantity) &&
          cents(item.purchasePriceCents) &&
          // B-05: cálculo exato em inteiros; o arredondamento em ponto
          // flutuante de versões anteriores continua aceito para registros
          // já gravados (compatibilidade, sem reinterpretar valores).
          (quantityTimesPriceCents(item.quantity, item.purchasePriceCents) ===
            item.amountCents ||
            Math.round(item.quantity * item.purchasePriceCents) ===
              item.amountCents))
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
        positionMode(investment.category as InvestmentCategory),
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
      ledger.marketQuotes !== undefined &&
      (!Array.isArray(ledger.marketQuotes) ||
        ledger.marketQuotes.length > 10000 ||
        !ledger.marketQuotes.every(
          (q: unknown) =>
            record(q) &&
            typeof q.ticker === 'string' &&
            TICKER_PATTERN.test(q.ticker) &&
            cents(q.priceCents) &&
            (q.previousCloseCents === undefined ||
              cents(q.previousCloseCents)) &&
            positive(q.marketTime) &&
            positive(q.observedAt) &&
            q.marketTime <= q.observedAt + 60000,
        ))
    )
      return false;
    if (
      ledger.recurrences !== undefined &&
      !list(ledger.recurrences, isRecurringRule)
    )
      return false;
    if (
      ledger.budgets !== undefined &&
      (!list(
        ledger.budgets,
        (item) =>
          text(item.id) &&
          text(item.category) &&
          cents(item.limitCents) &&
          isMonth(item.from) &&
          (item.to === undefined ||
            (isMonth(item.to) && String(item.to) >= String(item.from))),
      ) ||
        !budgetsDisjoint(ledger.budgets))
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
    case 'advancedWorkout': {
      const advancedWorkouts = applyAdvancedWorkoutCommand(
        records.advancedWorkouts,
        command.command,
        today,
      );
      next = { ...records, advancedWorkouts };
      if (command.command.type === 'finishSession' && command.command.markDay) {
        const sessionId = command.command.id;
        const session = advancedWorkouts.sessions.find(
          (s) => s.id === sessionId,
        )!;
        next = {
          ...next,
          workouts: upsert(
            records.workouts,
            { date: session.date, trained: true },
            'date',
          ),
        };
      }
      break;
    }
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
    case 'saveMarketQuote': {
      const quote: MarketQuote = command.value;
      // Só tickers da carteira; não gera receita, despesa nem XP.
      if (!records.investments.some((item) => item.ticker === quote.ticker))
        return records;
      next = {
        ...records,
        finance: {
          ...finance,
          marketQuotes: [
            ...(finance.marketQuotes ?? []).filter(
              (item) =>
                item.ticker !== quote.ticker ||
                localQuoteDate(item.observedAt) !==
                  localQuoteDate(quote.observedAt),
            ),
            quote,
          ].sort((a, b) => a.observedAt - b.observedAt),
        },
      };
      break;
    }
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

    case 'saveMovement': {
      // O vínculo com uma recorrência só nasce na confirmação e é preservado
      // nas edições; não pode ser criado, trocado ou removido por aqui.
      const existing = records.movements.find(
        (item) => item.id === command.value.id,
      );
      assert(
        JSON.stringify(existing?.recurrence) ===
          JSON.stringify(command.value.recurrence),
        'Use “Confirmar” em Próximas movimentações para registrar uma ocorrência.',
      );
      next = {
        ...records,
        movements: upsert(records.movements, command.value, 'id'),
      };
      break;
    }
    case 'saveRecurrence': {
      const rules = finance.recurrences ?? [];
      const existing = rules.find((item) => item.id === command.rule.id);
      // Estado (pausa, encerramento, dispensas) muda só pelos próprios comandos.
      const input = command.rule;
      const fields = {
        id: input.id,
        kind: input.kind,
        description: input.description,
        amountCents: input.amountCents,
        category: input.category,
        frequency: input.frequency,
        startDate: input.startDate,
      };
      const rule: RecurringRule = existing
        ? {
            ...fields,
            status: existing.status,
            ...(existing.endDate ? { endDate: existing.endDate } : {}),
            ...(existing.pauses ? { pauses: existing.pauses } : {}),
            ...(existing.skipped ? { skipped: existing.skipped } : {}),
          }
        : { ...fields, status: 'active' };
      const first = command.firstMovement;
      if (first) {
        assert(
          !existing &&
            first.kind === rule.kind &&
            first.recurrence?.ruleId === rule.id &&
            first.recurrence.date === rule.startDate &&
            first.date === rule.startDate &&
            first.id === occurrenceMovementId(rule.id, rule.startDate) &&
            isDate(first.date) &&
            first.date <= today &&
            !records.movements.some((item) => item.id === first.id),
          'A primeira ocorrência deve corresponder à data inicial da recorrência.',
        );
      }
      next = {
        ...records,
        movements: first ? [...records.movements, first] : records.movements,
        finance: { ...finance, recurrences: upsert(rules, rule, 'id') },
      };
      break;
    }
    case 'confirmRecurrence': {
      const link = command.value.recurrence;
      assert(link, 'Selecione uma ocorrência prevista.');
      const rule = finance.recurrences?.find((item) => item.id === link.ruleId);
      assert(rule, 'Recorrência não encontrada.');
      // Idempotente: confirmar de novo a mesma ocorrência não cria nada.
      if (
        records.movements.some(
          (item) =>
            item.recurrence?.ruleId === link.ruleId &&
            item.recurrence.date === link.date,
        )
      )
        return records;
      assert(
        rule.status !== 'ended' &&
          isScheduled(rule, link.date) &&
          !(rule.skipped ?? []).includes(link.date) &&
          command.value.kind === rule.kind &&
          command.value.id === occurrenceMovementId(rule.id, link.date) &&
          !records.movements.some((item) => item.id === command.value.id),
        'Esta ocorrência não está disponível para confirmação.',
      );
      next = { ...records, movements: [...records.movements, command.value] };
      break;
    }
    case 'setRecurrenceStatus': {
      const rules = finance.recurrences ?? [];
      const rule = rules.find((item) => item.id === command.id);
      assert(rule, 'Recorrência não encontrada.');
      const pauses = rule.pauses ?? [];
      const open = pauses.at(-1)?.to === undefined ? pauses.at(-1) : undefined;
      /** Fecha a pausa aberta hoje; uma pausa iniciada hoje é descartada. */
      const closed = open
        ? open.from === today
          ? pauses.slice(0, -1)
          : [...pauses.slice(0, -1), { from: open.from, to: today }]
        : pauses;
      /** Regra sem as pausas, para regravá-las já ajustadas. */
      const base: RecurringRule = { ...rule };
      delete base.pauses;
      let updated: RecurringRule;
      if (command.status === 'paused') {
        assert(
          rule.status === 'active',
          'Somente recorrências ativas podem ser pausadas.',
        );
        updated = {
          ...rule,
          status: 'paused',
          pauses: [...pauses, { from: today }],
        };
      } else if (command.status === 'active') {
        assert(
          rule.status === 'paused',
          'Somente recorrências pausadas podem ser reativadas.',
        );
        updated = {
          ...base,
          status: 'active',
          ...(closed.length ? { pauses: closed } : {}),
        };
      } else {
        assert(rule.status !== 'ended', 'A recorrência já está encerrada.');
        updated = {
          ...base,
          status: 'ended',
          endDate: today,
          ...(closed.length ? { pauses: closed } : {}),
        };
      }
      next = {
        ...records,
        finance: { ...finance, recurrences: upsert(rules, updated, 'id') },
      };
      break;
    }
    case 'skipRecurrence': {
      const rules = finance.recurrences ?? [];
      const rule = rules.find((item) => item.id === command.id);
      assert(rule, 'Recorrência não encontrada.');
      assert(
        isScheduled(rule, command.date) &&
          command.date <= shiftDate(today, 400) &&
          !records.movements.some(
            (item) =>
              item.recurrence?.ruleId === rule.id &&
              item.recurrence.date === command.date,
          ),
        'Esta ocorrência não pode ser dispensada.',
      );
      if ((rule.skipped ?? []).includes(command.date)) return records;
      next = {
        ...records,
        finance: {
          ...finance,
          recurrences: upsert(
            rules,
            {
              ...rule,
              skipped: [...(rule.skipped ?? []), command.date].sort(),
            },
            'id',
          ),
        },
      };
      break;
    }
    case 'deleteRecurrence':
      // As movimentações já confirmadas são reais e permanecem no histórico.
      next = {
        ...records,
        finance: {
          ...finance,
          recurrences: (finance.recurrences ?? []).filter(
            (item) => item.id !== command.id,
          ),
        },
      };
      break;
    case 'setBudget':
      assert(
        text(command.category) &&
          cents(command.limitCents) &&
          isMonth(command.month),
        'Informe a categoria, um limite maior que zero e o mês.',
      );
      next = {
        ...records,
        finance: {
          ...finance,
          budgets: setBudget(finance.budgets ?? [], {
            id: command.id,
            category: command.category.trim(),
            limitCents: command.limitCents,
            month: command.month,
          }),
        },
      };
      break;
    case 'removeBudget':
      assert(isMonth(command.month), 'Informe o mês.');
      next = {
        ...records,
        finance: {
          ...finance,
          budgets: removeBudget(
            finance.budgets ?? [],
            command.category,
            command.month,
          ),
        },
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
      if (command.initialEntry) {
        const shortfall = walletShortfall(next, command.initialEntry, today);
        assert(!shortfall, shortfall ?? '');
      }
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
      if (next.finance)
        next = {
          ...next,
          finance: withoutOrphanQuotes({ ...next, finance: next.finance }),
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
    case 'saveInvestmentEntry': {
      const target = records.investments.find(
        (item) => item.id === command.value.investmentId,
      );
      assert(
        !(
          target &&
          positionMode(target.category as InvestmentCategory) === 'shares' &&
          isShareSaleWithCostBasis(command.value)
        ),
        'Em vendas de ações e FIIs com quantidade, o custo vendido sai pelo preço médio. Deixe o custo de aquisição resgatado em branco.',
      );
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
      // Aporte com “Utilizar saldo da Carteira”: recusa integral sem saldo.
      const shortfall = walletShortfall(next, command.value, today);
      assert(!shortfall, shortfall ?? '');
      break;
    }
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
  // Cotações de tickers removidos da carteira deixam de ser guardadas.
  if (next.finance?.marketQuotes) {
    const tickers = new Set(next.investments.map((item) => item.ticker));
    const kept = next.finance.marketQuotes.filter((q) => tickers.has(q.ticker));
    if (kept.length !== next.finance.marketQuotes.length)
      next = {
        ...next,
        finance: {
          ...next.finance,
          ...(kept.length ? { marketQuotes: kept } : { marketQuotes: [] }),
        },
      };
  }
  if (!isLifeRecords(next))
    throw new Error(
      rejectionReason(next) ??
        'Verifique os campos. Valores devem ser válidos e uma retirada não pode exceder o saldo aplicado na data.',
    );
  return next;
}
