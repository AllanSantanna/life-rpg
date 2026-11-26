import { isInitialPosition } from './initialPosition';
import type {
  Investment,
  InvestmentCategory,
  InvestmentEntry,
  MoneyMovement,
} from './types';

/** Filtros somente de leitura: nunca alteram ou recriam registros. */
export const ALL = 'all';
export const HISTORY_PAGE_SIZE = 20;

export interface MovementFilters {
  month: string;
  kind: typeof ALL | MoneyMovement['kind'];
  accountId: string;
  category: string;
  /** Texto da pesquisa rápida; vazio não filtra. */
  query?: string;
}
export function filterMovements(
  movements: readonly MoneyMovement[],
  filters: MovementFilters,
) {
  return movements
    .filter(
      (item) =>
        item.date.startsWith(`${filters.month}-`) &&
        (filters.kind === ALL || item.kind === filters.kind) &&
        (filters.accountId === ALL ||
          // Registros legados sem conta pertencem à conta principal.
          (item.accountId ?? 'principal') === filters.accountId) &&
        (filters.category === ALL || item.category === filters.category) &&
        matchesSearch(item, filters.query ?? ''),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
/** Texto comparável: sem acentos, minúsculo e com espaços normalizados. */
export function searchable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}
/**
 * Pesquisa rápida: todas as palavras precisam aparecer na descrição ou na
 * categoria (campos textuais do modelo). Somente leitura; combina-se com os
 * filtros de mês, tipo e categoria.
 */
export function matchesSearch(
  item: { description: string; category: string },
  query: string,
) {
  const terms = searchable(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const text = searchable(`${item.description} ${item.category}`);
  return terms.every((term) => text.includes(term));
}
export function movementCategories(movements: readonly MoneyMovement[]) {
  return [...new Set(movements.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

export type EntryOperation = 'initial' | InvestmentEntry['kind'];
export const entryOperation = (entry: InvestmentEntry): EntryOperation =>
  isInitialPosition(entry) ? 'initial' : entry.kind;

export interface EntryFilters {
  investmentId: string;
  category: typeof ALL | InvestmentCategory;
  operation: typeof ALL | EntryOperation;
  from: string;
  to: string;
}
export function filterInvestmentEntries(
  entries: readonly InvestmentEntry[],
  investments: readonly Investment[],
  filters: EntryFilters,
) {
  const category = new Map(investments.map((item) => [item.id, item.category]));
  return entries
    .filter(
      (item) =>
        (filters.investmentId === ALL ||
          item.investmentId === filters.investmentId) &&
        (filters.category === ALL ||
          category.get(item.investmentId) === filters.category) &&
        (filters.operation === ALL ||
          entryOperation(item) === filters.operation) &&
        (!filters.from || item.date >= filters.from) &&
        (!filters.to || item.date <= filters.to),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
