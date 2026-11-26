import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { isInitialPosition } from './initialPosition';
import { DateField } from '../records/RecordUI';
import { fetchBitcoinQuote } from './bitcoinQuote';
import { fetchUsdQuote } from './usdQuote';
import { useEffect, useState } from 'react';
import { Field } from '../records/RecordUI';
import { BitcoinQuantity } from './BitcoinQuantity';
import { MoneyInput } from './MoneyInput';
import { money } from './calculations';
import { unitsToDecimal } from './monetary';
import { isMarketCategory } from './types';
import { SwitchField } from './FinanceLayout';
import { FinanceHelp } from './FinanceHelp';
import { movesWallet } from './initialPosition';
import type {
  BitcoinQuote,
  UsdQuote,
  InvestmentCategory,
  InvestmentEntry,
} from './types';
export function InvestmentFields({
  category,
  today,
  entry,
  initial = false,
  quote: storedQuote,
  usdQuote: storedUsdQuote,
  defaultKind,
  lockKind = false,
}: {
  category: InvestmentCategory;
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
  const shares = isMarketCategory(category);
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
  // Registros novos começam ligados (regra histórica: operações reais
  // movimentam a Carteira); a edição mostra o estado efetivo do registro.
  const [wallet, setWallet] = useState(() =>
    entry && !isInitialPosition(entry) ? movesWallet(entry) : true,
  );
  const legacyWallet =
    !!entry && entry.walletLinked === undefined && !isInitialPosition(entry);
  const label =
    positionInitial && kind === 'contribution'
      ? 'Custo de aquisição (R$, se conhecido)'
      : usd && kind === 'contribution'
        ? 'Valor pago (R$, se conhecido)'
        : initial
          ? 'Valor aplicado inicial (R$)'
          : kind === 'withdrawal' && !bitcoin && !usd && !shares
            ? 'Valor do resgate (R$)'
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
      {(kind === 'withdrawal' || !positionInitial) && (
        <>
          <input type="hidden" name="walletChoice" value="1" />
          {legacyWallet && (
            <input type="hidden" name="walletLegacy" value="1" />
          )}
          <SwitchField
            name="wallet"
            label={
              kind === 'withdrawal'
                ? 'Enviar valor para a Carteira'
                : 'Utilizar saldo da Carteira'
            }
            help={
              <FinanceHelp
                topic={
                  kind === 'withdrawal'
                    ? 'walletWithdrawal'
                    : 'walletContribution'
                }
              />
            }
            checked={wallet}
            onChange={setWallet}
          />
        </>
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
          {shares && kind === 'withdrawal' ? (
            <>
              <Field label="Quantidade vendida (opcional)">
                <input
                  name="quantity"
                  inputMode="decimal"
                  defaultValue={entry?.quantity}
                />
              </Field>
              <p className="record-hint">
                Informe a quantidade vendida para manter o valor de mercado e o
                preço médio. Com quantidade, o custo da parcela vendida sai pelo
                preço médio.
              </p>
              {entry?.costBasisCents !== undefined &&
                entry.quantity !== undefined && (
                  <p className="record-hint">
                    Este registro antigo informava um custo resgatado. Ao salvar
                    a edição, a venda passará a sair pelo preço médio.
                  </p>
                )}
            </>
          ) : (
            // Resgates de ativos por valor pedem só o valor: o custo da
            // parcela é calculado internamente.
            kind !== 'withdrawal' &&
            (!box ||
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
            )
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
          {/* Sem escolha de conta: aportes e retiradas usam a carteira interna;
              a edição preserva a conta de operações anteriores. */}
          {entry?.accountId !== undefined && (
            <input type="hidden" name="accountId" value={entry.accountId} />
          )}
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
