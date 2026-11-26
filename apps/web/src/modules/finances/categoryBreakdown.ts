import type { LifeRecords } from '../records/types';
import { investmentValue } from './ledger';
import type { InvestmentCategory } from './types';

/** Linha por categoria para os gráficos de distribuição e custo × valor. */
export interface CategoryBreakdown {
  category: InvestmentCategory;
  /** Valor atual conhecido ou de referência; exclui posições sem preço nem custo. */
  value: number;
  cost: number;
  costKnown: boolean;
  /** Alguma posição usa o custo como referência por falta de avaliação/cotação. */
  reference: boolean;
  /** Alguma posição não tem custo nem cotação: fica fora do valor. */
  unpriced: boolean;
  /** Participação no valor total (0 a 1); 0 quando não há valor. */
  share: number;
}

/**
 * Agrega `investmentValue` (mesmas regras de patrimônio) por categoria, sem
 * inventar preços nem rentabilidade. Somente leitura.
 */
export function categoryBreakdown(
  records: LifeRecords,
  today: string,
): CategoryBreakdown[] {
  const rows = new Map<InvestmentCategory, CategoryBreakdown>();
  for (const investment of records.investments) {
    const figures = investmentValue(records, investment.id, today);
    if (figures.current === 0 && figures.cost === 0 && !figures.unpriced)
      continue;
    const row = rows.get(investment.category) ?? {
      category: investment.category,
      value: 0,
      cost: 0,
      costKnown: true,
      reference: false,
      unpriced: false,
      share: 0,
    };
    row.value += figures.unpriced ? 0 : figures.current;
    row.cost += figures.cost;
    row.costKnown &&= figures.costKnown;
    row.reference ||= !figures.known && !figures.unpriced;
    row.unpriced ||= figures.unpriced;
    rows.set(investment.category, row);
  }
  const list = [...rows.values()];
  const total = list.reduce((sum, row) => sum + row.value, 0);
  return list
    .map((row) => ({ ...row, share: total > 0 ? row.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}
