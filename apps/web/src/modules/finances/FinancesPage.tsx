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
): InvestmentEntry {
  const kind =
    formText(data, 'kind') === 'withdrawal' ? 'withdrawal' : 'contribution';
  const hasUnits = !!formText(data, 'quantity') || !!formText(data, 'price');
  if (hasUnits && (!formText(data, 'quantity') || !formText(data, 'price')))
    throw new Error('Informe quantidade e preço de compra juntos.');
  if (hasUnits && kind === 'withdrawal')
    throw new Error(
      'Retiradas usam o valor retirado, sem quantidade ou preço de compra.',
    );
  const units = hasUnits
    ? {
        quantity: formNumber(data, 'quantity'),
        purchasePriceCents: formCents(data, 'price'),
      }
    : {};
  return {
    id,
    investmentId,
    kind,
    date: formText(data, 'date'),
    amountCents:
      units.quantity !== undefined && units.purchasePriceCents !== undefined
        ? Math.round(units.quantity * units.purchasePriceCents)
        : formCents(data, 'amount'),
    ...units,
  };
}
export function FinancesPage({ records, today, onCommand }: RecordPageProps) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [movementId, setMovementId] = useState<string | null>(null);
  const [investmentId, setInvestmentId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { run, message } = useCommand(onCommand);
  const movement = records.movements.find((item) => item.id === movementId);
  const investment = records.investments.find(
    (item) => item.id === investmentId,
  );
  const entry = records.investmentEntries.find((item) => item.id === entryId);
  const monthly = monthlyBalance(records.movements, month);
  const invested = investmentTotals(
    records.investments,
    records.investmentEntries,
  );
  const reset = () => setRevision((value) => value + 1);
  return (
    <div className="pillar-page" data-area="Finanças">
      <Field label="Mês financeiro">
        <input
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(event) => setMonth(event.target.value)}
        />
      </Field>
      <Summary
        values={[
          { label: 'Receitas do mês', value: money(monthly.income) },
          { label: 'Despesas do mês', value: money(monthly.expense) },
          { label: 'Saldo mensal', value: money(monthly.balance) },
          {
            label: 'Patrimônio aplicado cadastrado',
            value: money(invested.total),
          },
        ]}
      />
      <p className="record-hint">
        Saldo = receitas − despesas de consumo. Investimentos são controlados à
        parte; aportes e retiradas não entram novamente como receitas ou
        despesas. Patrimônio aplicado é custo líquido cadastrado, sem cotações
        ou rentabilidade.
      </p>
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
            <select name="kind" defaultValue={movement?.kind ?? 'expense'}>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
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
            <input
              name="amount"
              inputMode="decimal"
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
                  <button onClick={() => setMovementId(item.id)}>
                    Editar {item.description}
                  </button>
                  <button
                    onClick={() => run({ type: 'deleteMovement', id: item.id })}
                  >
                    Excluir {item.description}
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
        <h2>Investimentos</h2>
        <dl className="investment-totals">
          {invested.byCategory.map((item) => (
            <div key={item.category}>
              <dt>{item.category}</dt>
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
          };
          const initialEntry = investment
            ? undefined
            : entryFromForm(data, newId(), id);
          const error = run(
            initialEntry
              ? { type: 'saveInvestment', value, initialEntry }
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
            <select name="category" defaultValue={investment?.category}>
              {investmentCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          {!investment && (
            <>
              <Field label="Valor aplicado inicial (R$)">
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="Ou preencha quantidade e preço"
                />
              </Field>
              <DateField today={today} />
              <Field label="Quantidade (opcional)">
                <input name="quantity" inputMode="decimal" />
              </Field>
              <Field label="Preço de compra por unidade (R$, opcional)">
                <input name="price" inputMode="decimal" />
              </Field>
            </>
          )}
        </div>
        <p className="record-hint">
          Se informar quantidade e preço, o valor aplicado será calculado pelo
          produto dos dois.
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
            const error = run({
              type: 'saveInvestmentEntry',
              value: entryFromForm(
                data,
                entry?.id ?? newId(),
                formText(data, 'investmentId'),
              ),
            });
            if (!error) {
              setEntryId(null);
              reset();
            }
            return error;
          }}
        >
          <div className="record-fields">
            <Field label="Investimento">
              <select name="investmentId" defaultValue={entry?.investmentId}>
                {records.investments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Operação">
              <select name="kind" defaultValue={entry?.kind ?? 'contribution'}>
                <option value="contribution">Aporte</option>
                <option value="withdrawal">Retirada</option>
              </select>
            </Field>
            <Field label="Valor da operação (R$)">
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={entry ? (entry.amountCents / 100).toFixed(2) : ''}
              />
            </Field>
            <DateField today={today} value={entry?.date} />
            <Field label="Quantidade (opcional)">
              <input
                name="quantity"
                inputMode="decimal"
                defaultValue={entry?.quantity}
              />
            </Field>
            <Field label="Preço de compra por unidade (R$, opcional)">
              <input
                name="price"
                inputMode="decimal"
                defaultValue={
                  entry?.purchasePriceCents !== undefined
                    ? (entry.purchasePriceCents / 100).toFixed(2)
                    : ''
                }
              />
            </Field>
          </div>
          <Actions
            submit={entry ? 'Salvar operação' : 'Registrar operação'}
            onCancel={entry ? () => setEntryId(null) : undefined}
          />
        </RecordForm>
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
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.category} ·{' '}
                  {money(investedIn(records.investmentEntries, item.id))}
                </p>
              </div>
              <div className="record-actions">
                <button onClick={() => setInvestmentId(item.id)}>
                  Editar investimento {item.name}
                </button>
                <button
                  onClick={() => run({ type: 'deleteInvestment', id: item.id })}
                >
                  Excluir investimento e operações de {item.name}
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
              const name = records.investments.find(
                (investment) => investment.id === item.investmentId,
              )?.name;
              return (
                <li key={item.id}>
                  <div>
                    <strong>
                      {name} ·{' '}
                      {item.kind === 'contribution' ? 'Aporte' : 'Retirada'} de{' '}
                      {money(item.amountCents)}
                    </strong>
                    <p>
                      {displayDate(item.date)}
                      {item.quantity !== undefined &&
                        ` · ${item.quantity} unidades a ${money(item.purchasePriceCents ?? 0)}`}
                    </p>
                  </div>
                  <div className="record-actions">
                    <button
                      onClick={() => setEntryId(item.id)}
                      aria-label={`Editar operação de ${name}, ${displayDate(item.date)}, ${money(item.amountCents)}`}
                    >
                      Editar operação
                    </button>
                    <button
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
    </div>
  );
}
