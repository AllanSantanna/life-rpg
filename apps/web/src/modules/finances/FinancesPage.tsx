import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { SavingsBoxFields } from './SavingsBoxFields';
import { SavingsBoxCard } from './SavingsBoxCard';
import { decimalToUnits } from './monetary';
import { isInitialPosition } from './initialPosition';
import { FinancialConfirmation } from './FinancialConfirmation';
import type { RecordCommand } from '../records/types';
import { InvestmentFields } from './InvestmentFields';
import { formatCurrency } from './monetary';
import { MoneyInput } from './MoneyInput';
import { FinancialSettings } from './FinancialSettings';
import { CategoryIcon } from './CategoryIcon';
import { CashLedgerPanel, AccountField } from './CashLedgerPanel';
import { FinancialChart } from './FinancialChart';
import { financialSummary, investmentValue } from './ledger';
import { useCommand } from '../records/useCommand';
import { formText, formCents, formNumber, newId } from '../records/form';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import {
  Actions,
  DateField,
  Empty,
  Field,
  RecordForm,
  Summary,
  RecordFeedback,
} from '../records/RecordUI';
import { displayDate } from '../records/dates';
import {
  investmentCategories,
  type InvestmentCategory,
  type InvestmentEntry,
} from './types';
import {
  investedIn,
  investmentTotals,
  money,
  monthlyBalance,
} from './calculations';

function entryFromForm(
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
export function FinancesPage({
  records,
  today,
  onCommand,
  quoteError = '',
  quoteStale = false,
  usdError = '',
  usdStale = false,
}: RecordPageProps & {
  quoteError?: string;
  quoteStale?: boolean;
  usdError?: string;
  usdStale?: boolean;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [movementId, setMovementId] = useState<string | null>(null);
  const [investmentId, setInvestmentId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] =
    useState<InvestmentCategory>('Ações');
  const [draftEntryInvestment, setDraftEntryInvestment] = useState<
    string | null
  >(null);
  const [pendingConversion, setPendingConversion] =
    useState<RecordCommand | null>(null);
  const [conversionError, setConversionError] = useState('');
  const [revision, setRevision] = useState(0);
  const { run, message } = useCommand(onCommand);
  const movement = records.movements.find((item) => item.id === movementId);
  const investment = records.investments.find(
    (item) => item.id === investmentId,
  );
  const entry = records.investmentEntries.find((item) => item.id === entryId);
  const entryTarget = records.investments.some(
    (asset) => asset.id === draftEntryInvestment,
  )
    ? draftEntryInvestment
    : (entry?.investmentId ?? records.investments[0]?.id);
  const monthly = monthlyBalance(records.movements, month);
  const invested = investmentTotals(
    records.investments,
    records.investmentEntries,
  );
  const financial = financialSummary(records, today);
  const quote = records.finance?.quotes.at(-1);
  const [managementRevision, setManagementRevision] = useState(0);
  const manage: typeof onCommand = (command) => {
    const error = onCommand(command);
    if (
      !error &&
      (command.type === 'deleteAccount' || command.type === 'resetFinances')
    ) {
      setPendingConversion(null);
      setConversionError('');
      setDraftCategory('Ações');
      setDraftEntryInvestment(null);
      setMovementId(null);
      setInvestmentId(null);
      setEntryId(null);
      setRevision((n) => n + 1);
      setManagementRevision((n) => n + 1);
    }
    return error;
  };
  const reset = () => setRevision((value) => value + 1);
  return (
    <div className="pillar-page" data-area="Finanças">
      <Field label="Mês financeiro">
        <CustomDatePicker
          label="Mês financeiro"
          mode="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={setMonth}
        />
      </Field>
      <Summary
        values={[
          { label: 'Receitas do mês', value: money(monthly.income) },
          { label: 'Despesas do mês', value: money(monthly.expense) },
          { label: 'Resultado mensal', value: money(monthly.balance) },
        ]}
      />
      <p className="record-hint">
        Resultado mensal = receitas − despesas. É fluxo do período, separado dos
        saldos e investimentos.
      </p>
      <Summary
        values={[
          {
            label: 'Dinheiro disponível',
            value:
              financial.cash === null
                ? 'Informe os saldos iniciais'
                : money(financial.cash),
          },
          {
            label: 'Valor dos investimentos',
            value: financial.unpriced
              ? 'Cotação pendente'
              : money(financial.investments),
          },
          {
            label: 'Patrimônio financeiro total',
            value:
              financial.wealth === null
                ? 'Patrimônio pendente'
                : money(financial.wealth),
          },
          {
            label: 'Custo de aquisição atual',
            value: financial.costKnown
              ? money(financial.cost)
              : 'Custo parcialmente desconhecido',
          },
          {
            label: 'Total aportado conhecido',
            value: money(financial.contributed),
          },
          { label: 'Resgates e retiradas', value: money(financial.withdrawn) },
        ]}
      />
      {!financial.known && (
        <p className="record-hint">
          Há investimentos sem avaliação atual: o total usa o custo de aquisição
          como referência. Atualize os valores manuais; operações posteriores
          exigem nova avaliação.
        </p>
      )}
      <CashLedgerPanel
        key={managementRevision}
        records={records}
        today={today}
        onCommand={manage}
      />
      <FinancialChart records={records} today={today} />
      <RecordForm
        key={`movement:${movementId}:${revision}`}
        title={movement ? 'Editar movimentação' : 'Receitas e despesas'}
        onSubmit={(data) => {
          const error = run({
            type: 'saveMovement',
            value: {
              id: movement?.id ?? newId(),
              kind: formText(data, 'kind') === 'income' ? 'income' : 'expense',
              description: formText(data, 'description'),
              amountCents: formCents(data, 'amount'),
              category: formText(data, 'category'),
              ...(formText(data, 'accountId')
                ? { accountId: formText(data, 'accountId') }
                : {}),
              date: formText(data, 'date'),
            },
          });
          if (!error) {
            setMovementId(null);
            reset();
          }
          return error;
        }}
      >
        <div className="record-fields">
          <Field label="Tipo de movimentação">
            <CustomSelect
              label="Tipo de movimentação"
              name="kind"
              defaultValue={movement?.kind ?? 'expense'}
              options={[
                { value: 'income', label: 'Receita' },
                { value: 'expense', label: 'Despesa' },
              ]}
            />
          </Field>
          <Field label="Descrição">
            <input
              name="description"
              maxLength={200}
              required
              defaultValue={movement?.description}
            />
          </Field>
          <Field label="Valor (R$)">
            <MoneyInput
              name="amount"

              required
              defaultValue={
                movement ? (movement.amountCents / 100).toFixed(2) : ''
              }
            />
          </Field>
          <Field label="Categoria da movimentação">
            <input
              name="category"
              required
              maxLength={200}
              defaultValue={movement?.category ?? 'Geral'}
            />
          </Field>
          <DateField today={today} value={movement?.date} />
          <AccountField records={records} value={movement?.accountId} />
        </div>
        <Actions
          submit={movement ? 'Salvar movimentação' : 'Adicionar movimentação'}
          onCancel={movement ? () => setMovementId(null) : undefined}
        />
      </RecordForm>
      <section
        className="panel record-section"
        aria-label="Histórico financeiro"
      >
        <h2>Histórico de movimentações · {month}</h2>
        <ul className="record-list">
          {records.movements
            .filter((item) => item.date.startsWith(`${month}-`))
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.description}</strong>
                  <p>
                    {displayDate(item.date)} · {item.category} ·{' '}
                    {item.kind === 'income' ? 'Receita' : 'Despesa'} ·{' '}
                    {money(item.amountCents)}
                  </p>
                </div>
                <div className="record-actions">
                  <button
                    type="button"
                    onClick={() => setMovementId(item.id)}
                    aria-label={`Editar ${item.description}`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => run({ type: 'deleteMovement', id: item.id })}
                    aria-label={`Excluir ${item.description}`}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
        </ul>
        {!records.movements.some((item) =>
          item.date.startsWith(`${month}-`),
        ) && <Empty>Nenhuma movimentação neste mês.</Empty>}
      </section>
      <section className="panel record-section" aria-label="Investimentos">
        <h2>Investimentos · custo de aquisição conhecido por categoria</h2>
        <dl className="investment-totals">
          {invested.byCategory.map((item) => (
            <div key={item.category}>
              <dt>
                <CategoryIcon category={item.category} />
                {item.category === 'Outros'
                  ? 'Outros investimentos'
                  : item.category}
              </dt>
              <dd>{money(item.amountCents)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <RecordForm
        key={`investment:${investmentId}:${revision}`}
        title={investment ? 'Editar investimento' : 'Cadastrar investimento'}
        onSubmit={(data) => {
          const id = investment?.id ?? newId();
          const value = {
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
          const initialEntry = investment
            ? undefined
            : entryFromForm(data, newId(), id, value.category, today);
          const initialValuation =
            value.category === 'Caixinhas bancárias' &&
            !investment &&
            formText(data, 'boxBalance')
              ? {
                  id: newId(),
                  investmentId: id,
                  amountCents: formCents(data, 'boxBalance'),
                  date: formText(data, 'balanceDate'),
                  movementsComplete:
                    formText(data, 'movementsComplete') === 'on',
                }
              : undefined;
          const error = run(
            initialEntry
              ? {
                  type: 'saveInvestment',
                  value,
                  initialEntry,
                  ...(initialValuation ? { initialValuation } : {}),
                }
              : { type: 'saveInvestment', value },
          );
          if (!error) {
            setInvestmentId(null);
            reset();
          }
          return error;
        }}
      >
        <div className="record-fields">
          <Field label="Nome do investimento">
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={investment?.name}
            />
          </Field>
          <Field label="Categoria do investimento">
            <CustomSelect
              label="Categoria do investimento"
              name="category"
              value={draftCategory}
              onChange={setDraftCategory}
              options={investmentCategories.map((category) => ({
                value: category,
                label:
                  category === 'Outros' ? 'Outros investimentos' : category,
              }))}
            />
          </Field>
          {!investment && (
            <>
              <InvestmentFields
                key={draftCategory}
                category={draftCategory}
                records={records}
                today={today}
                initial
                quote={quote}
                usdQuote={records.finance?.usdQuotes?.at(-1)}
              />
            </>
          )}
          {draftCategory === 'Caixinhas bancárias' && (
            <SavingsBoxFields investment={investment} today={today} />
          )}
        </div>
        <p className="record-hint">
          Se informar quantidade e preço, o valor aplicado será calculado pelo
          produto dos dois. Para Bitcoin, informe o valor em reais e a
          quantidade em BTC ou sats; em vendas, informe o valor recebido e a
          quantidade vendida. O preço opcional é ignorado para BTC.
        </p>
        <Actions
          submit={investment ? 'Salvar investimento' : 'Adicionar investimento'}
          onCancel={investment ? () => setInvestmentId(null) : undefined}
        />
      </RecordForm>
      {records.investments.length > 0 && (
        <RecordForm
          key={`entry:${entryId}:${revision}`}
          title={entry ? 'Editar aporte ou retirada' : 'Aportes e retiradas'}
          onSubmit={(data) => {
            const command: RecordCommand = {
              type: 'saveInvestmentEntry',
              value: entryFromForm(
                data,
                entry?.id ?? newId(),
                formText(data, 'investmentId'),
                records.investments.find(
                  (item) => item.id === formText(data, 'investmentId'),
                )?.category ?? 'Ações',
                today,
              ),
            };
            if (
              entry &&
              !isInitialPosition(entry) &&
              isInitialPosition(command.value)
            ) {
              setPendingConversion({ ...command, confirmInitial: true });
              return null;
            }
            const error = run(command);
            if (!error) {
              setEntryId(null);
              reset();
            }
            return error;
          }}
        >
          <div className="record-fields">
            <Field label="Investimento">
              <CustomSelect
                label="Investimento"
                name="investmentId"
                value={entryTarget ?? ''}
                onChange={setDraftEntryInvestment}
                options={records.investments.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </Field>
            <InvestmentFields
              key={`${entryId}:${draftEntryInvestment}:${revision}`}
              category={
                records.investments.find((item) => item.id === entryTarget)
                  ?.category ?? 'Ações'
              }
              entry={entry}
              records={records}
              today={today}
              quote={quote}
              usdQuote={records.finance?.usdQuotes?.at(-1)}
            />
          </div>
          <p className="record-hint">
            Para retiradas de ativos sem cotação, informe o custo de aquisição
            da parcela resgatada se diferente do valor recebido. Sem esse dado,
            o custo retirado é igual ao valor da operação. BTC usa custo médio
            automaticamente.
          </p>
          <Actions
            submit={entry ? 'Salvar operação' : 'Registrar operação'}
            onCancel={entry ? () => setEntryId(null) : undefined}
          />
        </RecordForm>
      )}
      {records.investments.some((item) => item.category === 'Bitcoin') && (
        <section className="panel record-section" aria-label="Cotação Bitcoin">
          <h2>Bitcoin · BTC/BRL</h2>
          <p>
            {quote
              ? `${money(quote.priceCents)} · Atualização: ${new Date(quote.updatedAt).toLocaleString('pt-BR')} · ${quoteStale ? 'Desatualizada' : 'Última cotação conhecida'}`
              : 'Cotação ainda indisponível; valores usam custo de aquisição.'}
          </p>
          <p role="status">{quoteError}</p>
          <p className="record-hint">
            Fonte: CoinGecko. Consulta automática a cada 60 minutos, sem
            negociação.
          </p>
        </section>
      )}
      {records.investments.some((item) => item.category === 'Dólar (USD)') && (
        <section className="panel record-section" aria-label="Cotação Dólar">
          <h2>Dólar · USD/BRL</h2>
          <p>
            {records.finance?.usdQuotes?.at(-1)
              ? `${(records.finance.usdQuotes.at(-1)!.rateUnits / 10000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })} por US$ 1,00 · Atualização: ${new Date(records.finance.usdQuotes.at(-1)!.updatedAt).toLocaleString('pt-BR')} · ${usdStale ? 'Desatualizada' : 'Última referência conhecida'}`
              : 'PTAX indisponível. Não há conversão estimada sem referência.'}
          </p>
          <p role="status">{usdError}</p>
          <p className="record-hint">
            Banco Central · PTAX de venda, referência do dólar comercial. Não é
            dólar turismo nem preço de negociação em tempo real; pode refletir o
            último dia útil. Atualização consultada a cada 60 minutos, sem taxas
            ou spread.
          </p>
        </section>
      )}
      <RecordFeedback message={message} />
      <section
        className="panel record-section"
        aria-label="Carteira cadastrada"
      >
        <h2>Carteira cadastrada</h2>
        {!records.investments.length && (
          <Empty>Nenhum investimento cadastrado.</Empty>
        )}
        <ul className="record-list">
          {records.investments.map((item) => (
            <li key={item.id}>
              {item.category === 'Caixinhas bancárias' ? (
                <SavingsBoxCard
                  investment={item}
                  records={records}
                  today={today}
                  onCommand={onCommand}
                />
              ) : (
                <>
                  <div>
                    <strong>
                      <CategoryIcon category={item.category} />
                      {item.name}
                    </strong>
                    <p>
                      {item.category} ·{' '}
                      {money(
                        item.category === 'Bitcoin' ||
                          item.category === 'Dólar (USD)'
                          ? investmentValue(records, item.id, today).cost
                          : investedIn(records.investmentEntries, item.id),
                      )}
                    </p>
                  </div>
                  <HoldingDetails
                    records={records}
                    id={item.id}
                    today={today}
                  />
                </>
              )}
              <div className="record-actions">
                <button
                  type="button"
                  onClick={() => {
                    setInvestmentId(item.id);
                    setDraftCategory(item.category);
                  }}
                  aria-label={`Editar investimento ${item.name}`}
                >
                  Editar investimento
                </button>
                <button
                  type="button"
                  onClick={() => run({ type: 'deleteInvestment', id: item.id })}
                  aria-label={`Excluir investimento e operações de ${item.name}`}
                >
                  Excluir investimento
                </button>
              </div>
            </li>
          ))}
        </ul>
        <h3 className="mt-6">Histórico de aportes e retiradas</h3>
        <ul className="record-list">
          {[...records.investmentEntries]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => {
              const asset = records.investments.find(
                (investment) => investment.id === item.investmentId,
              );
              const name = asset?.name;
              return (
                <li key={item.id}>
                  <div>
                    <strong>
                      {name} ·{' '}
                      {isInitialPosition(item)
                        ? `Posição inicial · ${item.costUnknown ? 'custo desconhecido' : money(item.amountCents)}`
                        : `${item.kind === 'contribution' ? 'Aporte' : 'Retirada'} de ${money(item.amountCents)}`}
                    </strong>
                    <p>
                      {item.acquisitionDateUnknown
                        ? 'Registrado em ' +
                          displayDate(item.date) +
                          ' · Data original não informada'
                        : displayDate(item.date)}
                      {item.quantity !== undefined &&
                        ` · Quantidade: ${asset?.category === 'Dólar (USD)' ? formatCurrency(Math.round(item.quantity * 100), 'USD') : item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) + (asset?.category === 'Bitcoin' ? ' BTC' : ' unidades')}${item.purchasePriceCents !== undefined ? ' · Preço: ' + money(item.purchasePriceCents) : ''}`}
                      {item.costUnknown &&
                        ' · Posição existente; custo desconhecido, sem débito em conta'}
                    </p>
                  </div>
                  <div className="record-actions">
                    {item.kind === 'contribution' &&
                      !isInitialPosition(item) && (
                        <button
                          type="button"
                          onClick={() => {
                            setConversionError('');
                            setPendingConversion({
                              type: 'convertToInitialPosition',
                              id: item.id,
                              confirmed: true,
                            });
                          }}
                        >
                          Corrigir como posição inicial de {name}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => {
                        setEntryId(item.id);
                        setDraftEntryInvestment(item.investmentId);
                      }}
                      aria-label={`Editar operação de ${name}, ${displayDate(item.date)}, ${money(item.amountCents)}`}
                    >
                      Editar operação
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        run({ type: 'deleteInvestmentEntry', id: item.id })
                      }
                      aria-label={`Excluir operação de ${name}, ${displayDate(item.date)}, ${money(item.amountCents)}`}
                    >
                      Excluir operação
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
      {pendingConversion && (
        <FinancialConfirmation
          title="Converter em posição inicial"
          onCancel={() => {
            setPendingConversion(null);
            setConversionError('');
          }}
        >
          <p>
            Confirme que este investimento já existia. O débito da conta será
            revertido, sem criar receita ou duplicar o ativo. A quantidade, o
            custo e as operações posteriores serão preservados na correção
            direta. O XP, o Radar e o histórico financeiro serão recalculados.
          </p>
          {pendingConversion.type === 'saveInvestmentEntry' && (
            <p>Também serão salvos os campos que você editou nesta operação.</p>
          )}
          {conversionError && <p role="alert">{conversionError}</p>}
          <button
            type="button"
            className="record-primary financial-danger"
            onClick={() => {
              const error = run(pendingConversion);
              if (error) setConversionError(error);
              else {
                setPendingConversion(null);
                setEntryId(null);
                reset();
              }
            }}
          >
            Confirmar conversão
          </button>
        </FinancialConfirmation>
      )}
      <FinancialSettings onCommand={manage} />
    </div>
  );
}

function HoldingDetails({
  records,
  id,
  today,
}: {
  records: RecordPageProps['records'];
  id: string;
  today: string;
}) {
  const value = investmentValue(records, id, today);
  const category = records.investments.find((item) => item.id === id)?.category;
  const bitcoin = category === 'Bitcoin';
  const usd = category === 'Dólar (USD)';
  return (
    <div className="record-hint">
      {(bitcoin || usd) && (
        <p>
          {usd
            ? formatCurrency(value.units, 'USD')
            : (value.units / 1e8).toFixed(8) + ' BTC'}{' '}
          · Preço médio:{' '}
          {value.units && value.costKnown
            ? money(Math.round((value.cost * (usd ? 100 : 1e8)) / value.units))
            : '—'}
        </p>
      )}
      <p>
        Posição inicial (custo conhecido): {money(value.initialCost)} · Aportado
        conhecido: {money(value.contributed)} · Resgatado:{' '}
        {money(value.withdrawn)} · Custo restante:{' '}
        {value.costKnown ? money(value.cost) : 'Desconhecido'}
      </p>
      <p>
        {value.known
          ? 'Valor atual conhecido/estimado'
          : 'Sem avaliação atual; referência pelo custo'}
        : {value.unpriced ? 'Aguardando cotação' : money(value.current)}
      </p>
      {!value.costKnown && (
        <p>
          Custo de aquisição desconhecido; preço médio e valorização não estão
          disponíveis.
        </p>
      )}
      {value.known && value.costKnown && (
        <p>
          Lucro/prejuízo não realizado: {money(value.gain)} ·{' '}
          {value.cost
            ? ((value.gain / value.cost) * 100).toFixed(2) + '%'
            : '—'}
        </p>
      )}
    </div>
  );
}
