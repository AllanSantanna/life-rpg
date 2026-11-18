import type { RecordCommand } from '../records/types';
import { formCents, formNumber, formText } from '../records/form';
import { decimalToUnits } from './monetary';
import type {
  Investment,
  InvestmentCategory,
  InvestmentEntry,
  MoneyMovement,
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
    (!formText(data, 'quantity') || !formText(data, 'price'))
  )
    throw new Error('Informe quantidade e preço de compra juntos.');
  if (!bitcoin && hasUnits && kind === 'withdrawal')
    throw new Error(
      'Retiradas usam o valor retirado, sem quantidade ou preço de compra.',
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
        ? Math.round(units.quantity * units.purchasePriceCents)
        : unknown
          ? 0
          : formCents(data, 'amount'),
    ...units,
    ...(unknown ? { costUnknown: true } : {}),
    ...(!bitcoin && kind === 'withdrawal' && formText(data, 'costBasis')
      ? { costBasisCents: formCents(data, 'costBasis') }
      : {}),
  };
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
