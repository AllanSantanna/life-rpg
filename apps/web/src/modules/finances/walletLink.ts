import type { LifeRecords } from '../records/types';
import { displayDate } from '../records/dates';
import { movesWallet } from './initialPosition';
import { accountBalance, WALLET_ID } from './ledger';
import { formatCurrency } from './monetary';
import { emptyLedger, type InvestmentEntry } from './types';

export { movesWallet };

/** Valor com sinal do movimento interno na Carteira (0 se não movimenta). */
export function walletEffect(entry: InvestmentEntry) {
  if (!movesWallet(entry)) return 0;
  return entry.kind === 'withdrawal' ? entry.amountCents : -entry.amountCents;
}

/**
 * Recusa um aporte vinculado sem saldo suficiente. O saldo é verificado na data
 * da operação e em todas as datas posteriores com registros da conta, sem
 * contar a própria operação (edição). Assim, o aporte não torna negativo um
 * saldo que estava disponível. Retorna a mensagem de recusa ou `null`.
 *
 * Só se aplica a `walletLinked === true` em aportes: registros anteriores e as
 * demais movimentações mantêm a política existente (saldos negativos aceitos).
 */
export function walletShortfall(
  records: LifeRecords,
  entry: InvestmentEntry,
  today: string,
): string | null {
  if (
    entry.walletLinked !== true ||
    entry.kind !== 'contribution' ||
    !movesWallet(entry)
  )
    return null;
  const accountId = entry.accountId ?? WALLET_ID;
  const before: LifeRecords = {
    ...records,
    investmentEntries: records.investmentEntries.filter(
      (item) => item.id !== entry.id,
    ),
  };
  const ledger = records.finance ?? emptyLedger();
  const dates = new Set([entry.date, today]);
  for (const item of [...before.movements, ...before.investmentEntries])
    if (item.date > entry.date) dates.add(item.date);
  for (const item of ledger.transfers)
    if (item.date > entry.date) dates.add(item.date);
  let lowest: { date: string; cents: number } | null = null;
  for (const date of [...dates].sort()) {
    if (date < entry.date) continue;
    const cents = accountBalance(before, accountId, date);
    if (cents !== null && (!lowest || cents < lowest.cents))
      lowest = { date, cents };
  }
  if (!lowest || lowest.cents >= entry.amountCents) return null;
  const available = Math.max(0, lowest.cents);
  return `Saldo insuficiente na Carteira: disponível ${formatCurrency(available)}${
    lowest.date !== entry.date
      ? ` (considerando ${displayDate(lowest.date)})`
      : ''
  } para um aporte de ${formatCurrency(entry.amountCents)}. Reduza o valor ou desmarque “Utilizar saldo da Carteira”. Nada foi salvo.`;
}

/** Movimento interno exibido no histórico da Carteira (somente leitura). */
export interface WalletOperation {
  id: string;
  investmentId: string;
  name: string;
  kind: InvestmentEntry['kind'];
  date: string;
  amountCents: number;
}

/**
 * Operações de investimento que movimentaram a Carteira, derivadas dos
 * registros de investimento (mesmo ID). Não são receitas nem despesas.
 */
export function walletOperations(records: LifeRecords): WalletOperation[] {
  const names = new Map(
    records.investments.map((item) => [item.id, item.name]),
  );
  return records.investmentEntries.filter(movesWallet).map((entry) => ({
    id: entry.id,
    investmentId: entry.investmentId,
    name: names.get(entry.investmentId) ?? 'Investimento',
    kind: entry.kind,
    date: entry.date,
    amountCents: entry.amountCents,
  }));
}
