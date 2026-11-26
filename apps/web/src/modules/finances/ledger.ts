import { projectBoxBalance } from './savingsBox';
import { isInitialPosition } from './initialPosition';
import type { LifeRecords } from '../records/types';
import {
  emptyLedger,
  type CashAccount,
  type FinanceLedger,
  type InvestmentEntry,
} from './types';
import { monthlyBalance } from './calculations';

import { position, positionMode } from './position';
export { position, satoshis } from './position';
export function valuationBasis(
  entries: readonly InvestmentEntry[],
  id: string,
  date: string,
) {
  return JSON.stringify(
    entries
      .filter((item) => item.investmentId === id && item.date <= date)
      .map(({ id, kind, date, amountCents, quantity, costBasisCents }) => [
        id,
        kind,
        date,
        amountCents,
        quantity,
        costBasisCents,
      ]),
  );
}
export function investmentValue(
  records: LifeRecords,
  id: string,
  date: string,
) {
  const ledger = records.finance ?? emptyLedger();
  const investment = records.investments.find((item) => item.id === id);
  const entries = records.investmentEntries.filter(
    (item) => item.investmentId === id && item.date <= date,
  );
  const bitcoin = investment?.category === 'Bitcoin';
  const usd = investment?.category === 'Dólar (USD)';
  const holding = position(
    entries,
    investment ? positionMode(investment.category) : false,
  );
  // Ações/FIIs: cotação de mercado só vale a partir do dia em que foi observada.
  const marketQuote = investment?.ticker
    ? ledger.marketQuotes
        ?.filter(
          (q) =>
            q.ticker === investment.ticker &&
            localQuoteDate(q.observedAt) <= date,
        )
        .at(-1)
    : undefined;
  const marketPriced = !!marketQuote && holding.unitsKnown && holding.units > 0;
  const usdQuote = ledger.usdQuotes
    ?.filter((q) => localQuoteDate(q.observedAt) <= date)
    .at(-1);
  const quote = ledger.quotes
    .filter((item) => localQuoteDate(item.observedAt) <= date)
    .at(-1);
  const valuation = [...ledger.valuations]
    .filter((item) => item.investmentId === id && item.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const manualValid =
    valuation &&
    !entries.some((item) => item.date > valuation.date) &&
    (valuation.basis === undefined ||
      valuation.basis ===
        valuationBasis(records.investmentEntries, id, valuation.date));
  const box = investment?.category === 'Caixinhas bancárias';
  const projectedBox = box ? projectBoxBalance(entries, valuation) : null;
  const boxBalanceValid = box && (!!projectedBox || !!manualValid);
  const empty =
    bitcoin || usd
      ? holding.units === 0
      : holding.cost === 0 && holding.costKnown;
  let known = box
    ? empty || boxBalanceValid
    : empty ||
      (usd ? !!usdQuote : bitcoin ? !!quote : marketPriced || !!manualValid);
  let current =
    box && (projectedBox || manualValid)
      ? (projectedBox?.amount ?? valuation!.amountCents)
      : empty
        ? 0
        : usd && usdQuote
          ? Number(
              (BigInt(holding.units) * BigInt(usdQuote.rateUnits) + 5000n) /
                10000n,
            )
          : bitcoin && quote
            ? Number(
                (BigInt(holding.units) * BigInt(quote.priceCents) +
                  50_000_000n) /
                  100_000_000n,
              )
            : marketPriced
              ? Number(
                  (BigInt(holding.units) * BigInt(marketQuote.priceCents) +
                    50_000_000n) /
                    100_000_000n,
                )
              : manualValid
                ? valuation.amountCents
                : holding.cost;
  const unsafe = !Number.isSafeInteger(current);
  if (unsafe) {
    current = holding.cost;
    known = false;
  }
  return {
    ...holding,
    boxBalanceValid,
    balanceEstimated: projectedBox?.estimated ?? false,
    current,
    known,
    quote,
    usdQuote,
    marketQuote,
    marketPriced,
    unpriced: unsafe || (!holding.costKnown && !known),
    valuation,
    gain: current - holding.cost,
  };
}
export function localQuoteDate(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Carteira interna única: recebe os registros sem `accountId`. */
export const WALLET_ID = 'principal';
/**
 * Contas consideradas nas projeções de saldo. A carteira interna existe
 * implicitamente, com saldo inicial zero desde o primeiro registro, enquanto não
 * houver uma abertura `principal` gravada por versões anteriores; essa abertura,
 * quando existe, continua valendo sem alteração. Nada é gravado aqui: a lista
 * persistida, seus IDs e as demais contas legadas permanecem como estão.
 */
export function cashAccounts(ledger: FinanceLedger): CashAccount[] {
  return ledger.accounts.some((item) => item.id === WALLET_ID)
    ? ledger.accounts
    : [
        ...ledger.accounts,
        { id: WALLET_ID, name: 'Carteira', initialCents: 0, date: '' },
      ];
}
export function accountBalance(
  records: LifeRecords,
  accountId: string,
  date: string,
) {
  const ledger = records.finance ?? emptyLedger();
  const account = cashAccounts(ledger).find(
    (item) => item.id === accountId && item.date <= date,
  );
  if (!account) return null;
  const applies = (item: { date: string; accountId?: string }) =>
    (item.accountId ?? WALLET_ID) === accountId &&
    item.date >= account.date &&
    item.date <= date;
  return (
    account.initialCents +
    records.movements
      .filter(applies)
      .reduce(
        (sum, item) =>
          sum + (item.kind === 'income' ? item.amountCents : -item.amountCents),
        0,
      ) +
    records.investmentEntries
      .filter(
        (item) =>
          applies(item) && !isInitialPosition(item) && !item.costUnknown,
      )
      .reduce(
        (sum, item) =>
          sum +
          (item.kind === 'withdrawal' ? item.amountCents : -item.amountCents),
        0,
      ) +
    ledger.transfers
      .filter((item) => item.date >= account.date && item.date <= date)
      .reduce(
        (sum, item) =>
          sum +
          (item.toId === accountId ? item.amountCents : 0) -
          (item.fromId === accountId ? item.amountCents : 0),
        0,
      )
  );
}
export function financialSummary(records: LifeRecords, date: string) {
  const accounts = cashAccounts(records.finance ?? emptyLedger());
  const missingAccount = [
    ...records.movements,
    ...records.investmentEntries,
  ].some(
    (item) =>
      !('investmentId' in item && isInitialPosition(item)) &&
      item.date <= date &&
      !accounts.some(
        (account) =>
          account.id === (item.accountId ?? WALLET_ID) && account.date <= date,
      ),
  );
  const activeAccounts = accounts.filter((item) => item.date <= date);
  const cash =
    activeAccounts.length && !missingAccount
      ? activeAccounts.reduce(
          (sum, item) => sum + (accountBalance(records, item.id, date) ?? 0),
          0,
        )
      : null;
  const holdings = records.investments.map((item) =>
    investmentValue(records, item.id, date),
  );
  const investments = holdings.reduce((sum, item) => sum + item.current, 0);
  return {
    cash,
    investments,
    wealth:
      cash === null || holdings.some((item) => item.unpriced)
        ? null
        : cash + investments,
    unpriced: holdings.some((item) => item.unpriced),
    costKnown: holdings.every((item) => item.costKnown),
    known: holdings.every((item) => item.known),
    cost: holdings.reduce((sum, item) => sum + item.cost, 0),
    initialCost: holdings.reduce((sum, item) => sum + item.initialCost, 0),
    contributed: holdings.reduce((sum, item) => sum + item.contributed, 0),
    withdrawn: holdings.reduce((sum, item) => sum + item.withdrawn, 0),
  };
}
export function financialHistory(records: LifeRecords, today: string) {
  const ledger = records.finance ?? emptyLedger();
  const dates = new Set(
    [
      ...records.movements,
      ...records.investmentEntries,
      ...ledger.accounts,
      ...ledger.transfers,
      ...ledger.valuations,
    ].map((item) => item.date),
  );
  ledger.usdQuotes?.forEach((q) => dates.add(localQuoteDate(q.observedAt)));
  ledger.marketQuotes?.forEach((q) => dates.add(localQuoteDate(q.observedAt)));
  ledger.quotes.forEach((item) => dates.add(localQuoteDate(item.observedAt)));
  return [...dates]
    .filter((date) => date <= today)
    .sort()
    .map((date) => ({
      date,
      ...financialSummary(records, date),
      monthly:
        monthlyBalance(records.movements, date.slice(0, 7)).balance -
        records.movements
          .filter(
            (item) =>
              item.date > date && item.date.startsWith(date.slice(0, 7)),
          )
          .reduce(
            (sum, item) =>
              sum +
              (item.kind === 'income' ? item.amountCents : -item.amountCents),
            0,
          ),
    }));
}
