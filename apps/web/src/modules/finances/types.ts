export interface MoneyMovement {
  id: string;
  kind: 'income' | 'expense';
  accountId?: string;
  description: string;
  amountCents: number;
  category: string;
  date: string;
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
export interface FinanceLedger {
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
