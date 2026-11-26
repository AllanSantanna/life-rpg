export interface MoneyMovement {
  id: string;
  kind: 'income' | 'expense';
  accountId?: string;
  description: string;
  amountCents: number;
  category: string;
  date: string;
  /**
   * Ocorrência de recorrência confirmada por esta movimentação. Ausente nos
   * registros comuns e anteriores; o par regra/data é único.
   */
  recurrence?: { ruleId: string; date: string };
}
export const investmentCategories = [
  'Ações',
  'Fundos imobiliários',
  'Renda fixa',
  'Caixinhas bancárias',
  'Bitcoin',
  'Dólar (USD)',
  'Outros',
] as const;
export type InvestmentCategory = (typeof investmentCategories)[number];
export interface Investment {
  /** Código B3 (ex.: VALE3, HGLG11); somente Ações e Fundos imobiliários. */
  ticker?: string;
  institution?: string;
  cdiPercentBasisPoints?: number;
  id: string;
  name: string;
  category: InvestmentCategory;
}
export interface InvestmentEntry {
  id: string;
  investmentId: string;
  accountId?: string;
  kind: 'contribution' | 'withdrawal';
  amountCents: number;
  date: string;
  quantity?: number;
  purchasePriceCents?: number;
  costBasisCents?: number;
  costUnknown?: boolean;
  positionInitial?: boolean;
  acquisitionDateUnknown?: boolean;
  /**
   * Escolha explícita de movimentar a Carteira (aporte debita, retirada
   * credita). Ausente em registros anteriores: vale a regra histórica
   * (operações reais movimentam a carteira; posições iniciais não).
   */
  walletLinked?: boolean;
}

export interface CashAccount {
  id: string;
  name: string;
  initialCents: number;
  date: string;
}
export interface AccountTransfer {
  id: string;
  fromId: string;
  toId: string;
  amountCents: number;
  date: string;
}
export interface InvestmentValuation {
  movementsComplete?: boolean;
  basis?: string;
  id: string;
  investmentId: string;
  amountCents: number;
  date: string;
}
export interface BitcoinQuote {
  priceCents: number;
  updatedAt: number;
  observedAt: number;
}
export interface UsdQuote {
  rateUnits: number;
  updatedAt: number;
  observedAt: number;
}
/**
 * Última cotação observada de um ativo da B3 (fonte: brapi.dev via apps/api).
 * Guarda-se uma observação por ticker e por dia, como nas cotações de BTC/USD.
 */
export interface MarketQuote {
  ticker: string;
  priceCents: number;
  /** Fechamento do pregão anterior, quando informado pela fonte. */
  previousCloseCents?: number;
  /** Horário da cotação na fonte (pode ter atraso). */
  marketTime: number;
  observedAt: number;
}
/** Fechamento diário vindo da fonte; não é persistido. */
export interface MarketPricePoint {
  date: string;
  closeCents: number;
}
export const isMarketCategory = (category: InvestmentCategory) =>
  category === 'Ações' || category === 'Fundos imobiliários';
/** Formato de códigos da B3: VALE3, PETR4, B3SA3, HGLG11. */
export const TICKER_PATTERN = /^[A-Z][A-Z0-9]{3}\d{1,2}$/;
export function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';
/**
 * Regra de receita/despesa periódica. É uma previsão: não altera saldo, XP ou
 * orçamento. Cada ocorrência confirmada vira uma `MoneyMovement` real com
 * `recurrence`, que é a fonte única do histórico confirmado.
 */
export interface RecurringRule {
  id: string;
  kind: MoneyMovement['kind'];
  description: string;
  amountCents: number;
  category: string;
  frequency: RecurrenceFrequency;
  /** Data da primeira ocorrência; define o dia de referência da série. */
  startDate: string;
  status: 'active' | 'paused' | 'ended';
  /** Último dia da série quando encerrada. */
  endDate?: string;
  /** Intervalos pausados: ocorrências em [from, to) não ficam pendentes. */
  pauses?: { from: string; to?: string }[];
  /** Ocorrências dispensadas pelo usuário (sem movimentação). */
  skipped?: string[];
}
/**
 * Limite mensal recorrente de uma categoria de despesa, válido de `from` até
 * `to` (meses `AAAA-MM`, inclusive). Alterar o limite cria uma nova versão a
 * partir do mês escolhido, sem reescrever os meses anteriores.
 */
export interface CategoryBudget {
  id: string;
  category: string;
  limitCents: number;
  from: string;
  to?: string;
}
export interface FinanceLedger {
  recurrences?: RecurringRule[];
  budgets?: CategoryBudget[];
  marketQuotes?: MarketQuote[];
  usdQuotes?: UsdQuote[];
  accounts: CashAccount[];
  transfers: AccountTransfer[];
  valuations: InvestmentValuation[];
  quotes: BitcoinQuote[];
}
export const emptyLedger = (): FinanceLedger => ({
  accounts: [],
  transfers: [],
  valuations: [],
  quotes: [],
});
