import type { MoneyMovement } from './types';

/**
 * Categorias de receitas e despesas. Não há cadastro separado: o texto gravado
 * em cada movimentação é o identificador real da categoria, inclusive nas
 * personalizadas. As listas abaixo são sempre derivadas do histórico existente,
 * sem cache persistido; uma categoria sem nenhuma movimentação deixa de aparecer
 * e nenhum registro antigo é alterado.
 */
export const RECENT_CATEGORY_LIMIT = 5;
export const DEFAULT_CATEGORY = 'Geral';

/** Até cinco categorias usadas mais recentemente no tipo informado. */
export function recentCategories(
  movements: readonly MoneyMovement[],
  kind: MoneyMovement['kind'],
  limit = RECENT_CATEGORY_LIMIT,
) {
  const recent: string[] = [];
  // Data mais recente primeiro; na mesma data, o registro gravado por último.
  const ordered = movements
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === kind)
    .sort(
      (a, b) => b.item.date.localeCompare(a.item.date) || b.index - a.index,
    );
  for (const { item } of ordered) {
    if (!recent.includes(item.category)) recent.push(item.category);
    if (recent.length === limit) break;
  }
  return recent;
}

/** Demais categorias existentes (qualquer tipo), sem repetir as recentes. */
export function otherCategories(
  movements: readonly MoneyMovement[],
  recent: readonly string[],
  extra: readonly string[] = [],
) {
  return [...new Set([...movements.map((item) => item.category), ...extra])]
    .filter((category) => !recent.includes(category))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
