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
export interface FinanceLedger {
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
