import { FinanceHelp } from './FinanceHelp';
import { Disclosure } from '../../shared/components/Disclosure';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { MoneyInput } from './MoneyInput';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { Actions, DateField, Field, RecordForm } from '../records/RecordUI';
import { formCents, formText, newId } from '../records/form';
import { emptyLedger } from './types';
import { money } from './calculations';
import { useCommand } from '../records/useCommand';
import { displayDate } from '../records/dates';

/**
 * Avaliações manuais de investimentos sem cotação automática. O cadastro de
 * contas foi substituído pela carteira interna única (`cashAccounts`); aberturas,
 * contas e transferências gravadas por versões anteriores continuam nas
 * projeções, sem gerenciamento visível.
 */
export function ValuationsPanel({
  records,
  today,
  onCommand,
}: RecordPageProps) {
  const ledger = records.finance ?? emptyLedger();
  const [valuationId, setValuationId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { run } = useCommand(onCommand);
  const valuation = ledger.valuations.find((item) => item.id === valuationId);
  const reset = () => setRevision((n) => n + 1);
  const eligible = records.investments.some(
    (item) => item.category !== 'Bitcoin' && item.category !== 'Dólar (USD)',
  );
  if (!eligible && !ledger.valuations.length) return null;
  return (
    <Disclosure
      title="Avaliações manuais"
      className="panel record-section"
      help={<FinanceHelp topic="valuations" />}
    >
      {eligible && (
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
              <CustomSelect
                label="Investimento avaliado"
                name="investmentId"
                defaultValue={valuation?.investmentId}
                options={records.investments
                  .filter(
                    (item) =>
                      item.category !== 'Bitcoin' &&
                      item.category !== 'Dólar (USD)',
                  )
                  .map((item) => ({ value: item.id, label: item.name }))}
              />
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
              <button type="button" onClick={() => setValuationId(item.id)}>
                Editar avaliação
              </button>
              <button
                type="button"
                onClick={() => run({ type: 'deleteValuation', id: item.id })}
              >
                Excluir avaliação
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
