export interface MoneyMovement {
  id: string;
  kind: 'income' | 'expense';
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
  'Outros',
] as const;
export type InvestmentCategory = (typeof investmentCategories)[number];
export interface Investment {
  id: string;
  name: string;
  category: InvestmentCategory;
}
export interface InvestmentEntry {
  id: string;
  investmentId: string;
  kind: 'contribution' | 'withdrawal';
  amountCents: number;
  date: string;
  quantity?: number;
  purchasePriceCents?: number;
}
