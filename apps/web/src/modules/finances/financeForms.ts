import type { RecordCommand } from '../records/types';
import { formCents, formNumber, formText } from '../records/form';
import { decimalToUnits, quantityTimesPriceCents } from './monetary';
import {
  isMarketCategory,
  normalizeTicker,
  TICKER_PATTERN,
  type Investment,
  type InvestmentCategory,
  type InvestmentEntry,
  type MoneyMovement,
} from './types';

/**
 * Conversões dos formulários financeiros em registros. As regras foram
 * extraídas sem alteração de `FinancesPage.tsx`; os comandos continuam
 * validados e aplicados em `records/commands.ts`.
 */
export function entryFromForm(
  data: FormData,
  id: string,
  investmentId: string,
  category: InvestmentCategory = 'Ações',
  today = '',
): InvestmentEntry {
  const bitcoin = category === 'Bitcoin' || category === 'Dólar (USD)';
  // Ações/FIIs: quantidade opcional na compra (com preço ou valor) e na venda.
  const shares = isMarketCategory(category);
  const positionInitial =
    formText(data, 'positionType') === 'initial' &&
    formText(data, 'kind') !== 'withdrawal';
  const unknown =
    positionInitial && !formText(data, 'amount') && !formText(data, 'price');
  const kind =
    formText(data, 'kind') === 'withdrawal' ? 'withdrawal' : 'contribution';
  const hasUnits = !!formText(data, 'quantity') || !!formText(data, 'price');
  if (
    !positionInitial &&
    !bitcoin &&
    hasUnits &&
    (shares
      ? !formText(data, 'quantity')
      : !formText(data, 'quantity') || !formText(data, 'price'))
  )
    throw new Error(
      shares
        ? 'Informe a quantidade junto com o preço de compra.'
        : 'Informe quantidade e preço de compra juntos.',
    );
  if (
    !bitcoin &&
    kind === 'withdrawal' &&
    (shares ? !!formText(data, 'price') : hasUnits)
  )
    throw new Error(
      shares
        ? 'Vendas usam a quantidade vendida e o valor recebido, sem preço de compra.'
        : 'Retiradas usam o valor retirado, sem quantidade ou preço de compra.',
    );
  const units: Pick<
    Partial<InvestmentEntry>,
    'quantity' | 'purchasePriceCents'
  > = bitcoin
    ? { quantity: formNumber(data, 'quantity') }
    : hasUnits
      ? {
          quantity: formNumber(data, 'quantity'),
          ...(formText(data, 'price')
            ? { purchasePriceCents: formCents(data, 'price') }
            : {}),
        }
      : {};
  return {
    id,
    investmentId,
    ...(formText(data, 'accountId')
      ? { accountId: formText(data, 'accountId') }
      : {}),
    kind,
    date: formText(data, 'date') || (positionInitial ? today : ''),
    ...(positionInitial
      ? {
          positionInitial: true,
          ...(!formText(data, 'date') ? { acquisitionDateUnknown: true } : {}),
        }
      : { positionInitial: false }),
    amountCents:
      units.quantity !== undefined && units.purchasePriceCents !== undefined
        ? quantityTimesPriceCents(units.quantity, units.purchasePriceCents)
        : unknown
          ? 0
          : formCents(data, 'amount'),
    ...units,
    ...(unknown ? { costUnknown: true } : {}),
    ...walletChoice(data, positionInitial),
    // Sem campo de custo resgatado: ativos por valor têm o custo calculado no
    // comando (`withdrawalCost.ts`); BTC, USD, ações e FIIs usam o preço médio.
  };
}

/**
 * Escolha “Utilizar saldo da Carteira” / “Enviar valor para a Carteira”. O campo
 * oculto `walletChoice` indica que o interruptor foi exibido. Na edição de um
 * registro anterior (sem `walletLinked`), manter o interruptor ligado preserva o
 * registro sem o campo, com a mesma regra histórica; desligá-lo grava `false`.
 */
function walletChoice(
  data: FormData,
  positionInitial: boolean,
): Pick<InvestmentEntry, 'walletLinked'> {
  if (positionInitial || formText(data, 'walletChoice') !== '1') return {};
  const linked = formText(data, 'wallet') === 'on';
  if (linked && formText(data, 'walletLegacy') === '1') return {};
  return { walletLinked: linked };
}

export function movementFromForm(data: FormData, id: string): MoneyMovement {
  return {
    id,
    kind: formText(data, 'kind') === 'income' ? 'income' : 'expense',
    description: formText(data, 'description'),
    amountCents: formCents(data, 'amount'),
    category: formText(data, 'category'),
    ...(formText(data, 'accountId')
      ? { accountId: formText(data, 'accountId') }
      : {}),
    date: formText(data, 'date'),
  };
}

/** Comando de cadastro ou edição de investimento, com posição inicial atômica. */
export function investmentCommand(
  data: FormData,
  existing: Investment | undefined,
  today: string,
  newId: () => string,
): RecordCommand {
  const id = existing?.id ?? newId();
  const value: Investment = {
    id,
    name: formText(data, 'name'),
    category: formText(data, 'category') as InvestmentCategory,
    ...(isMarketCategory(formText(data, 'category') as InvestmentCategory) &&
    formText(data, 'ticker')
      ? { ticker: tickerFromForm(data) }
      : {}),
    ...(formText(data, 'category') === 'Caixinhas bancárias'
      ? {
          ...(formText(data, 'institution')
            ? { institution: formText(data, 'institution') }
            : {}),
          ...(formText(data, 'cdiPercent')
            ? {
                cdiPercentBasisPoints: decimalToUnits(
                  formText(data, 'cdiPercent'),
                  2,
                ),
              }
            : {}),
        }
      : {}),
  };
  const initialEntry = existing
    ? undefined
    : entryFromForm(data, newId(), id, value.category, today);
  const initialValuation =
    value.category === 'Caixinhas bancárias' &&
    !existing &&
    formText(data, 'boxBalance')
      ? {
          id: newId(),
          investmentId: id,
          amountCents: formCents(data, 'boxBalance'),
          date: formText(data, 'balanceDate'),
          movementsComplete: formText(data, 'movementsComplete') === 'on',
        }
      : undefined;
  return initialEntry
    ? {
        type: 'saveInvestment',
        value,
        initialEntry,
        ...(initialValuation ? { initialValuation } : {}),
      }
    : { type: 'saveInvestment', value };
}

/** Ticker B3 informado no cadastro; vazio mantém o investimento sem cotação. */
export function tickerFromForm(data: FormData) {
  const ticker = normalizeTicker(formText(data, 'ticker'));
  if (!TICKER_PATTERN.test(ticker))
    throw new Error(
      'Ticker inválido. Use o código da B3, como VALE3, PETR4 ou HGLG11.',
    );
  return ticker;
}
