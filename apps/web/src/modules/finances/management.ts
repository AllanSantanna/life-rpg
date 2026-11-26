import { movesWallet } from './initialPosition';
import type { LifeRecords } from '../records/types';
import { emptyLedger } from './types';

/** Calcula exatamente o alcance da exclusão, incluindo posições compartilhadas. */
export function accountDeletionImpact(records: LifeRecords, id: string) {
  const belongs = (entry: {
    accountId?: string;
    positionInitial?: boolean;
    costUnknown?: boolean;
    walletLinked?: boolean;
  }) => movesWallet(entry) && (entry.accountId ?? 'principal') === id;
  const investmentIds = new Set(
    records.investmentEntries
      .filter(belongs)
      .map((entry) => entry.investmentId),
  );
  const entries = records.investmentEntries.filter((entry) =>
    investmentIds.has(entry.investmentId),
  );
  return {
    investmentIds,
    movements: records.movements.filter(belongs),
    entries,
    sharedEntries: entries.filter((entry) => !belongs(entry)),
    transfers: (records.finance?.transfers ?? []).filter(
      (entry) => entry.fromId === id || entry.toId === id,
    ),
    valuations: (records.finance?.valuations ?? []).filter((entry) =>
      investmentIds.has(entry.investmentId),
    ),
  };
}
export function removeAccount(records: LifeRecords, id: string): LifeRecords {
  const impact = accountDeletionImpact(records, id);
  const ledger = records.finance ?? emptyLedger();
  const investments = records.investments.filter(
    (item) => !impact.investmentIds.has(item.id),
  );
  return {
    ...records,
    investments,
    movements: records.movements.filter(
      (item) => (item.accountId ?? 'principal') !== id,
    ),
    investmentEntries: records.investmentEntries.filter(
      (item) => !impact.investmentIds.has(item.investmentId),
    ),
    finance: {
      ...ledger,
      accounts: ledger.accounts.filter((item) => item.id !== id),
      transfers: ledger.transfers.filter(
        (item) => item.fromId !== id && item.toId !== id,
      ),
      valuations: ledger.valuations.filter(
        (item) => !impact.investmentIds.has(item.investmentId),
      ),
      ...(ledger.usdQuotes
        ? {
            usdQuotes: investments.some(
              (item) => item.category === 'Dólar (USD)',
            )
              ? ledger.usdQuotes
              : [],
          }
        : {}),
      quotes: investments.some((item) => item.category === 'Bitcoin')
        ? ledger.quotes
        : [],
    },
  };
}
export function resetFinances(records: LifeRecords): LifeRecords {
  return {
    ...records,
    movements: [],
    investments: [],
    investmentEntries: [],
    finance: emptyLedger(),
  };
}
