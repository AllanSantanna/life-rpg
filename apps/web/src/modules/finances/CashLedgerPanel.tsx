import { MoneyInput } from './MoneyInput';
import { FinancialConfirmation } from './FinancialConfirmation';
import { accountDeletionImpact } from './management';
import { Icon } from '../../shared/components/Icon';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { Actions, DateField, Field, RecordForm } from '../records/RecordUI';
import { formCents, formText, newId } from '../records/form';
import { emptyLedger } from './types';
import { accountBalance } from './ledger';
import { money } from './calculations';
import { useCommand } from '../records/useCommand';
import { displayDate } from '../records/dates';
export function AccountField({
  records,
  value,
  label = 'Conta',
  name = 'accountId',
}: {
  records: RecordPageProps['records'];
  value?: string | undefined;
  label?: string;
  name?: string;
}) {
  const accounts = records.finance?.accounts ?? [];
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? 'principal'}>
        {!accounts.some((item) => item.id === 'principal') && (
          <option value="">Conta principal (saldo inicial pendente)</option>
        )}
        {accounts.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function CashLedgerPanel({
  records,
  today,
  onCommand,
}: RecordPageProps) {
  const ledger = records.finance ?? emptyLedger();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [valuationId, setValuationId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { run } = useCommand(onCommand);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleting = ledger.accounts.find((item) => item.id === deletingId);
  const impact = deleting ? accountDeletionImpact(records, deleting.id) : null;
  const linked =
    !!impact &&
    !!(
      impact.movements.length ||
      impact.entries.length ||
      impact.transfers.length ||
      impact.valuations.length
    );
  const closeDeletion = () => {
    setDeletingId(null);
    setConfirmed(false);
    setDeleteError('');
  };
  const account = ledger.accounts.find((item) => item.id === accountId);
  const transfer = ledger.transfers.find((item) => item.id === transferId);
  const valuation = ledger.valuations.find((item) => item.id === valuationId);
  const reset = () => setRevision((n) => n + 1);
  return (
    <details className="panel record-section">
      <summary>Contas, transferências e avaliações manuais</summary>
      <p className="record-hint">
        Cadastre o saldo de abertura de cada conta no início da data escolhida.
        Apenas receitas, despesas, aportes e resgates dessa data em diante
        alteram esse saldo. Operações antigas sem conta pertencem à conta
        principal. Escolha uma data anterior aos registros para acompanhar todo
        o histórico.
      </p>
      <RecordForm
        key={`account:${accountId}:${revision}`}
        title={account ? 'Editar conta' : 'Cadastrar saldo inicial'}
        onSubmit={(data) => {
          const raw = formText(data, 'initial');
          const initialData = new FormData();
          initialData.set('initial', raw.replace(/^-/, ''));
          const cents =
            formCents(initialData, 'initial') * (raw.startsWith('-') ? -1 : 1);
          const error = run({
            type: 'saveAccount',
            value: {
              id:
                account?.id ??
                (!ledger.accounts.some((item) => item.id === 'principal')
                  ? 'principal'
                  : newId()),
              name: formText(data, 'name'),
              date: formText(data, 'date'),
              initialCents: cents,
            },
          });
          if (!error) {
            setAccountId(null);
            reset();
          }
          return error;
        }}
      >
        <div className="record-fields">
          <Field label="Nome da conta">
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={
                account?.name ??
                (!ledger.accounts.length ? 'Conta principal' : '')
              }
            />
          </Field>
          <Field label="Saldo inicial (R$)">
            <MoneyInput
              name="initial"
              allowNegative
              required

              defaultValue={
                account ? (account.initialCents / 100).toFixed(2) : ''
              }
            />
          </Field>
          <DateField today={today} value={account?.date} />
        </div>
        <Actions
          submit={account ? 'Salvar conta' : 'Cadastrar saldo inicial'}
          onCancel={account ? () => setAccountId(null) : undefined}
        />
      </RecordForm>
      <ul className="record-list">
        {ledger.accounts.map((item) => (
          <li key={item.id}>
            <span>
              {item.name} ·{' '}
              {money(accountBalance(records, item.id, today) ?? 0)} · Abertura:{' '}
              {displayDate(item.date)}
            </span>
            <div className="record-actions">
              <button
                type="button"
                onClick={() => setAccountId(item.id)}
                aria-label={`Editar conta ${item.name}`}
              >
                <Icon name="edit" size={16} />
                Editar
              </button>
              <button
                type="button"
                className="financial-danger"
                onClick={() => {
                  setDeletingId(item.id);
                  setConfirmed(false);
                  setDeleteError('');
                }}
                aria-label={`Excluir conta ${item.name}`}
              >
                <Icon name="trash" size={16} />
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
      {ledger.accounts.length >= 2 && (
        <RecordForm
          key={`transfer:${transferId}:${revision}`}
          title={transfer ? 'Editar transferência' : 'Transferir entre contas'}
          onSubmit={(data) => {
            const error = run({
              type: 'saveTransfer',
              value: {
                id: transfer?.id ?? newId(),
                fromId: formText(data, 'fromId'),
                toId: formText(data, 'toId'),
                amountCents: formCents(data, 'amount'),
                date: formText(data, 'date'),
              },
            });
            if (!error) {
              setTransferId(null);
              reset();
            }
            return error;
          }}
        >
          <div className="record-fields">
            <AccountField
              records={records}
              label="Conta de origem"
              name="fromId"
              value={transfer?.fromId}
            />
            <AccountField
              records={records}
              label="Conta de destino"
              name="toId"
              value={transfer?.toId ?? ledger.accounts[1]?.id}
            />
            <Field label="Valor da transferência (R$)">
              <MoneyInput
                name="amount"

                required
                defaultValue={
                  transfer ? (transfer.amountCents / 100).toFixed(2) : ''
                }
              />
            </Field>
            <DateField today={today} value={transfer?.date} />
          </div>
          <Actions
            submit="Salvar transferência"
            onCancel={transfer ? () => setTransferId(null) : undefined}
          />
        </RecordForm>
      )}
      <ul className="record-list">
        {ledger.transfers.map((item) => (
          <li key={item.id}>
            <span>
              {displayDate(item.date)} ·{' '}
              {ledger.accounts.find((a) => a.id === item.fromId)?.name} →{' '}
              {ledger.accounts.find((a) => a.id === item.toId)?.name} ·{' '}
              {money(item.amountCents)}
            </span>
            <div className="record-actions">
              <button onClick={() => setTransferId(item.id)}>
                Editar transferência
              </button>
              <button
                onClick={() => run({ type: 'deleteTransfer', id: item.id })}
              >
                Excluir transferência
              </button>
            </div>
          </li>
        ))}
      </ul>
      {records.investments.some(
        (item) =>
          item.category !== 'Bitcoin' && item.category !== 'Dólar (USD)',
      ) && (
        <RecordForm
          key={`valuation:${valuationId}:${revision}`}
          title={
            valuation ? 'Editar avaliação' : 'Atualizar valor de investimento'
          }
          onSubmit={(data) => {
            const error = run({
              type: 'saveValuation',
              value: {
                id: valuation?.id ?? newId(),
                investmentId: formText(data, 'investmentId'),
                date: formText(data, 'date'),
                amountCents: formCents(data, 'amount'),
                movementsComplete: formText(data, 'movementsComplete') === 'on',
              },
            });
            if (!error) {
              setValuationId(null);
              reset();
            }
            return error;
          }}
        >
          <div className="record-fields">
            <Field label="Investimento avaliado">
              <select
                name="investmentId"
                defaultValue={valuation?.investmentId}
              >
                {records.investments
                  .filter(
                    (item) =>
                      item.category !== 'Bitcoin' &&
                      item.category !== 'Dólar (USD)',
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Valor atual manual (R$)">
              <MoneyInput
                name="amount"

                required
                defaultValue={
                  valuation ? (valuation.amountCents / 100).toFixed(2) : ''
                }
              />
            </Field>
            <DateField today={today} value={valuation?.date} />
          </div>
          <label className="financial-confirmation__check">
            <input
              type="checkbox"
              name="movementsComplete"
              defaultChecked={valuation?.movementsComplete ?? false}
            />
            Para caixinhas: conferi todos os aportes e retiradas para calcular o
            rendimento.
          </label>
          <Actions
            submit="Salvar avaliação"
            onCancel={valuation ? () => setValuationId(null) : undefined}
          />
        </RecordForm>
      )}
      <ul className="record-list">
        {ledger.valuations.map((item) => (
          <li key={item.id}>
            <span>
              {
                records.investments.find((i) => i.id === item.investmentId)
                  ?.name
              }{' '}
              · {displayDate(item.date)} · {money(item.amountCents)}
            </span>
            <div className="record-actions">
              <button onClick={() => setValuationId(item.id)}>
                Editar avaliação
              </button>
              <button
                onClick={() => run({ type: 'deleteValuation', id: item.id })}
              >
                Excluir avaliação
              </button>
            </div>
          </li>
        ))}
      </ul>
      {deleting && impact && (
        <FinancialConfirmation
          title={`Excluir conta ${deleting.name}`}
          onCancel={closeDeletion}
        >
          <p>
            Esta ação é irreversível. O saldo inicial e a conta {deleting.name}{' '}
            serão apagados.
          </p>
          {linked ? (
            <>
              <p>Esta conta possui registros vinculados. Serão excluídos:</p>
              <ul>
                <li>{impact.movements.length} receitas/despesas.</li>
                <li>
                  {impact.investmentIds.size} investimentos completos e{' '}
                  {impact.entries.length} operações de aporte, retirada ou BTC.
                </li>
                <li>
                  {impact.transfers.length} transferências envolvendo esta
                  conta, removidas dos dois lados. O saldo das outras contas
                  será recalculado.
                </li>
                <li>
                  Investimentos incluídos:{' '}
                  {records.investments
                    .filter((item) => impact.investmentIds.has(item.id))
                    .map((item) => item.name)
                    .join(', ') || 'nenhum'}
                  .
                </li>
                <li>{impact.valuations.length} avaliações vinculadas.</li>
              </ul>
              {impact.sharedEntries.length > 0 && (
                <p className="record-error">
                  Investimentos compartilhados: {impact.sharedEntries.length}{' '}
                  operações em outras contas também serão excluídas, para não
                  deixar vendas sem compras ou custo de aquisição inconsistente.
                </p>
              )}
              <label className="financial-confirmation__check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                Confirmo a exclusão da conta e de todos os registros listados,
                incluindo operações compartilhadas.
              </label>
            </>
          ) : (
            <p>Esta conta não possui movimentações vinculadas.</p>
          )}
          {deleteError && <p role="alert">{deleteError}</p>}
          <button
            type="button"
            className="financial-danger"
            disabled={linked && !confirmed}
            onClick={() => {
              const error = run({
                type: 'deleteAccount',
                id: deleting.id,
                confirmed: !linked || confirmed,
              });
              if (error) setDeleteError(error);
              else {
                closeDeletion();
                setAccountId(null);
                setTransferId(null);
                setValuationId(null);
                reset();
              }
            }}
          >
            {linked
              ? 'Excluir conta e registros vinculados'
              : 'Confirmar exclusão da conta'}
          </button>
        </FinancialConfirmation>
      )}
    </details>
  );
}
