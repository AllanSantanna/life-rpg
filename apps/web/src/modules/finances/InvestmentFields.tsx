import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { isInitialPosition } from './initialPosition';
import { AccountField } from './CashLedgerPanel';
import { DateField } from '../records/RecordUI';
import type { LifeRecords } from '../records/types';
import { fetchBitcoinQuote } from './bitcoinQuote';
import { fetchUsdQuote } from './usdQuote';
import { useEffect, useState } from 'react';
import { Field } from '../records/RecordUI';
import { BitcoinQuantity } from './BitcoinQuantity';
import { MoneyInput } from './MoneyInput';
import { money } from './calculations';
import { unitsToDecimal } from './monetary';
import type {
  BitcoinQuote,
  UsdQuote,
  InvestmentCategory,
  InvestmentEntry,
} from './types';
export function InvestmentFields({
  category,
  records,
  today,
  entry,
  initial = false,
  quote: storedQuote,
  usdQuote: storedUsdQuote,
  defaultKind,
  lockKind = false,
}: {
  category: InvestmentCategory;
  records: LifeRecords;
  today: string;
  entry?: InvestmentEntry | undefined;
  initial?: boolean;
  quote?: BitcoinQuote | undefined;
  usdQuote?: UsdQuote | undefined;
  /** Operação inicial quando aberta por uma ação do cartão. */
  defaultKind?: InvestmentEntry['kind'] | undefined;
  /** Mantém a operação escolhida no cartão (Comprar, Vender, Aportar...). */
  lockKind?: boolean;
}) {
  const bitcoin = category === 'Bitcoin',
    usd = category === 'Dólar (USD)';
  const box = category === 'Caixinhas bancárias';
  const [previewBtc, setPreviewBtc] = useState<BitcoinQuote>();
  const [previewUsd, setPreviewUsd] = useState<UsdQuote>();
  const [previewError, setPreviewError] = useState('');
  const quote = storedQuote ?? previewBtc;
  const usdQuote = storedUsdQuote ?? previewUsd;
  useEffect(() => {
    let active = true;
    if (bitcoin && !storedQuote)
      void fetchBitcoinQuote()
        .then((value) => {
          if (active) setPreviewBtc(value);
        })
        .catch(() => {
          if (active)
            setPreviewError(
              'Cotação indisponível; você pode continuar o cadastro.',
            );
        });
    if (usd && !storedUsdQuote)
      void fetchUsdQuote()
        .then((value) => {
          if (active) setPreviewUsd(value);
        })
        .catch(() => {
          if (active)
            setPreviewError(
              'Referência USD indisponível; você pode continuar o cadastro.',
            );
        });
    return () => {
      active = false;
    };
  }, [bitcoin, usd, storedQuote, storedUsdQuote]);
  const [units, setUnits] = useState(() =>
    Math.round((entry?.quantity ?? 0) * (bitcoin ? 1e8 : 100)),
  );
  const [positionInitial, setPositionInitial] = useState(() =>
    entry ? isInitialPosition(entry) : initial,
  );
  const [kind, setKind] = useState(
    entry?.kind ?? defaultKind ?? 'contribution',
  );
  const label =
    positionInitial && kind === 'contribution'
      ? 'Custo de aquisição (R$, se conhecido)'
      : usd && kind === 'contribution'
        ? 'Valor pago (R$, se conhecido)'
        : initial
          ? 'Valor aplicado inicial (R$)'
          : 'Valor da operação (R$)';
  const estimate =
    bitcoin && quote
      ? Number(
          (BigInt(units) * BigInt(quote.priceCents) + 50000000n) / 100000000n,
        )
      : usd && usdQuote
        ? Number((BigInt(units) * BigInt(usdQuote.rateUnits) + 5000n) / 10000n)
        : null;
  return (
    <>
      {!initial && lockKind && <input type="hidden" name="kind" value={kind} />}
      {!initial && !lockKind && (
        <Field label="Operação">
          <CustomSelect
            label="Operação"
            name="kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'contribution', label: 'Aporte / compra' },
              { value: 'withdrawal', label: 'Retirada / venda' },
            ]}
          />
        </Field>
      )}
      {kind === 'contribution' && (
        <Field label="Tipo de registro do investimento">
          <CustomSelect
            label="Tipo de registro do investimento"
            name="positionType"
            value={positionInitial ? 'initial' : 'purchase'}
            options={[
              { value: 'initial', label: 'Investimento que já possuo' },
              { value: 'purchase', label: 'Nova compra ou aporte' },
            ]}
            onChange={(next) => setPositionInitial(next === 'initial')}
          />
        </Field>
      )}
      {kind === 'contribution' && !positionInitial && (
        <p className="record-hint">
          Compra/aporte real: desconta o valor da conta selecionada, sem gerar
          despesa de consumo.
        </p>
      )}
      <Field label={label}>
        <MoneyInput
          name="amount"
          defaultValue={
            entry?.costUnknown
              ? ''
              : entry
                ? unitsToDecimal(entry.amountCents, 2)
                : ''
          }
          required={
            (kind === 'withdrawal' || !positionInitial) && (bitcoin || usd)
          }
        />
      </Field>
      {positionInitial && kind === 'contribution' && (
        <p className="record-hint">
          Posição inicial: não desconta de nenhuma conta e não gera XP de
          compra. Informe o custo original quando conhecido; sem ele, preço
          médio e valorização ficam pendentes.
        </p>
      )}
      {bitcoin ? (
        <BitcoinQuantity quantity={entry?.quantity} onUnitsChange={setUnits} />
      ) : usd ? (
        <Field label="Quantidade em USD">
          <MoneyInput
            name="quantity"
            currency="USD"
            required
            defaultValue={
              entry?.quantity !== undefined
                ? unitsToDecimal(Math.round(entry.quantity * 100), 2)
                : ''
            }
            onValueChange={(value) => setUnits(value ?? 0)}
          />
        </Field>
      ) : (
        <>
          {(!box ||
            entry?.quantity !== undefined ||
            entry?.purchasePriceCents !== undefined) && (
            <>
              <Field label="Quantidade (opcional)">
                <input
                  name="quantity"
                  inputMode="decimal"
                  defaultValue={entry?.quantity}
                />
              </Field>
              <Field label="Preço de compra por unidade (R$, opcional)">
                <MoneyInput
                  name="price"
                  defaultValue={
                    entry?.purchasePriceCents !== undefined
                      ? unitsToDecimal(entry.purchasePriceCents, 2)
                      : ''
                  }
                />
              </Field>
            </>
          )}
          {!initial && kind === 'withdrawal' && (
            <Field label="Custo de aquisição resgatado (R$, opcional)">
              <MoneyInput
                name="costBasis"
                defaultValue={
                  entry?.costBasisCents !== undefined
                    ? unitsToDecimal(entry.costBasisCents, 2)
                    : ''
                }
              />
            </Field>
          )}
        </>
      )}
      {positionInitial && kind === 'contribution' ? (
        <Field label="Data original de aquisição (opcional)">
          <CustomDatePicker
            key="original-date"
            label="Data original de aquisição (opcional)"
            name="date"
            max={today}
            defaultValue={
              entry?.acquisitionDateUnknown ? '' : (entry?.date ?? '')
            }
          />
        </Field>
      ) : (
        <>
          <DateField key="operation-date" today={today} value={entry?.date} />
          <AccountField records={records} value={entry?.accountId} />
        </>
      )}
      {(bitcoin || usd) && (
        <div className="record-hint">
          {previewError && <p role="status">{previewError}</p>}
          {(bitcoin ? quote : usdQuote) && (
            <p>
              Horário da fonte:{' '}
              {new Date((bitcoin ? quote : usdQuote)!.updatedAt).toLocaleString(
                'pt-BR',
              )}
              . Última referência conhecida.
            </p>
          )}
          <p>
            {bitcoin ? 'Cotação BTC/BRL' : 'Referência USD/BRL · PTAX venda'}:{' '}
            {bitcoin
              ? quote
                ? money(quote.priceCents)
                : 'Indisponível'
              : usdQuote
                ? (usdQuote.rateUnits / 10000).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 4,
                  })
                : 'Indisponível'}
          </p>
          <p>
            Valor estimado da quantidade informada:{' '}
            {estimate === null ? 'Aguardando cotação' : money(estimate)}. A
            última cotação conhecida pode estar desatualizada; confira o horário
            no cartão do investimento.
          </p>
        </div>
      )}
    </>
  );
}
