import type { InvestmentEntry } from './types';
/** Ausência do campo preserva a regra anterior; USD sem custo já era posição existente. */
export function isInitialPosition(
  entry: Pick<InvestmentEntry, 'positionInitial' | 'costUnknown'>,
) {
  return (
    entry.positionInitial === true ||
    (entry.positionInitial === undefined && entry.costUnknown === true)
  );
}

/**
 * Regra única de quais operações de investimento movimentam a Carteira.
 *
 * - Posições iniciais (e posições USD antigas de custo desconhecido) nunca
 *   movimentam: o dinheiro não saiu da carteira.
 * - `walletLinked` explícito decide nos registros novos.
 * - Sem o campo (registros anteriores), vale a regra histórica: compras e
 *   aportes reais debitam, retiradas e vendas creditam. Nada é reinterpretado.
 *
 * O débito/crédito não é um segundo registro: é projetado do próprio
 * `InvestmentEntry`, com o mesmo ID. Por isso a operação e o movimento interno
 * são gravados, editados e excluídos juntos, sem possibilidade de órfãos.
 */
export function movesWallet(
  entry: Pick<
    InvestmentEntry,
    'positionInitial' | 'costUnknown' | 'walletLinked'
  >,
) {
  if (isInitialPosition(entry) || entry.costUnknown) return false;
  return entry.walletLinked !== false;
}
