import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import type { Investment } from './types';
import { investmentValue } from './ledger';
import { money } from './calculations';
import { displayDate } from '../records/dates';
import { Field, DateField, RecordForm, Actions } from '../records/RecordUI';
import { MoneyInput } from './MoneyInput';
import { formCents, formText, newId } from '../records/form';
import { Icon } from '../../shared/components/Icon';
export function SavingsBoxCard({
  investment,
  records,
  today,
  onCommand,
}: RecordPageProps & { investment: Investment }) {
  const [opened, setOpened] = useState(false);
  const [message, setMessage] = useState('');
  const value = investmentValue(records, investment.id, today);
  const valuation = value.valuation;
  const valid = value.boxBalanceValid;
  const confirmed = valid && valuation?.movementsComplete && value.costKnown;
  return (
    <div
      className="savings-box"
      role="group"
      aria-label={`Caixinha ${investment.name}`}
    >
      <div className="savings-box__heading">
        <div>
          <Icon name="safe" size={20} />
          <strong>{investment.name}</strong>
        </div>
        <span>{investment.institution ?? 'Instituição não informada'}</span>
      </div>
      <p className="savings-box__balance">
        <span>
          {valid
            ? value.balanceEstimated
              ? 'Saldo após movimentações registradas'
              : 'Saldo atual informado'
            : 'Referência pelo custo · atualize o saldo'}
        </span>
        <strong>
          {value.unpriced ? 'Saldo pendente' : money(value.current)}
        </strong>
      </p>
      <dl className="savings-box__metrics">
        <div>
          <dt>Total aplicado conhecido</dt>
          <dd>{money(value.initialCost + value.contributed)}</dd>
        </div>
        <div>
          <dt>Total retirado</dt>
          <dd>{money(value.withdrawn)}</dd>
        </div>
        <div>
          <dt>Custo da posição</dt>
          <dd>{value.costKnown ? money(value.cost) : 'Desconhecido'}</dd>
        </div>
        <div>
          <dt>
            {confirmed ? 'Rendimento acumulado' : 'Diferença saldo/custo'}
          </dt>
          <dd>{valid && value.costKnown ? money(value.gain) : 'Pendente'}</dd>
        </div>
      </dl>
      <p className="record-hint">
        Última atualização informada:{' '}
        {valuation ? displayDate(valuation.date) : 'Nenhuma'}
        {valuation && !valid
          ? ` · Último saldo informado: ${money(valuation.amountCents)}; operações alteradas, confira novamente.`
          : ''}
      </p>
      {investment.cdiPercentBasisPoints !== undefined && (
        <p className="record-hint">
          Contrato:{' '}
          {(investment.cdiPercentBasisPoints / 100).toLocaleString('pt-BR')}% do
          CDI · informativo, sem cálculo automático.
        </p>
      )}
      <p className="record-hint">
        {confirmed
          ? 'Rendimento = saldo menos custo restante, com movimentações conferidas. O saldo segue o valor exibido pelo banco, sem presumir se é bruto ou líquido.'
          : 'A diferença não comprova rendimento: confira se existem aportes ou retiradas não registrados.'}
      </p>
      {value.balanceEstimated && (
        <p className="record-hint">
          Saldo derivado da última informação do banco mais aportes e menos
          retiradas posteriores. Não inclui rendimento novo; atualize com o
          saldo real.
        </p>
      )}
      <div className="record-actions">
        <button
          type="button"
          className="record-primary"
          aria-label={`Atualizar saldo de ${investment.name}`}
          onClick={() => {
            setOpened(true);
            setMessage('');
          }}
        >
          Atualizar saldo
        </button>
      </div>
      {opened && (
        <RecordForm
          title={`Atualizar saldo de ${investment.name}`}
          onSubmit={(data) => {
            const error = onCommand({
              type: 'saveValuation',
              value: {
                id: newId(),
                investmentId: investment.id,
                amountCents: formCents(data, 'amount'),
                date: formText(data, 'date'),
                movementsComplete: formText(data, 'movementsComplete') === 'on',
              },
            });
            if (!error) {
              setOpened(false);
              setMessage(
                'Saldo atualizado sem movimentar a conta ou gerar XP.',
              );
            }
            return error;
          }}
        >
          <div className="record-fields">
            <Field label="Saldo atual exibido pelo banco (R$)">
              <MoneyInput name="amount" required />
            </Field>
            <DateField today={today} />
          </div>
          <label className="financial-confirmation__check">
            <input type="checkbox" name="movementsComplete" />
            Conferi que todos os aportes e retiradas estão registrados para
            calcular o rendimento.
          </label>
          <Actions submit="Salvar saldo" onCancel={() => setOpened(false)} />
        </RecordForm>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
