import { useRef } from 'react';
import type { RecordPageProps } from '../records/types';
import type { Investment } from './types';
import type { investmentValue } from './ledger';
import { money } from './calculations';
import { displayDate } from '../records/dates';
import { Field, DateField, RecordForm, Actions } from '../records/RecordUI';
import { MoneyInput } from './MoneyInput';
import { formCents, formText, newId } from '../records/form';

type HoldingValue = ReturnType<typeof investmentValue>;
const confirmedYield = (value: HoldingValue) =>
  !!(
    value.boxBalanceValid &&
    value.valuation?.movementsComplete &&
    value.costKnown
  );

/** Saldo e métricas principais da caixinha, exibidos no cartão da carteira. */
export function SavingsBoxSummary({ value }: { value: HoldingValue }) {
  const valid = value.boxBalanceValid;
  const confirmed = confirmedYield(value);
  return (
    <>
      <p className="investment-card__value">
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
      <dl className="investment-card__metrics">
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
      {!confirmed && (
        <p className="record-hint">
          A diferença não comprova rendimento: confira se existem aportes ou
          retiradas não registrados.
        </p>
      )}
    </>
  );
}

/** Informações secundárias da caixinha, exibidas em “Ver detalhes”. */
export function SavingsBoxDetails({
  investment,
  value,
}: {
  investment: Investment;
  value: HoldingValue;
}) {
  const valuation = value.valuation;
  const valid = value.boxBalanceValid;
  return (
    <>
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
      {confirmedYield(value) && (
        <p className="record-hint">
          Rendimento = saldo menos custo restante, com movimentações conferidas.
          O saldo segue o valor exibido pelo banco, sem presumir se é bruto ou
          líquido.
        </p>
      )}
      {value.balanceEstimated && (
        <p className="record-hint">
          Saldo derivado da última informação do banco mais aportes e menos
          retiradas posteriores. Não inclui rendimento novo; atualize com o
          saldo real.
        </p>
      )}
    </>
  );
}

/** Atualização manual do saldo: grava uma avaliação, sem movimentar contas. */
export function SavingsBalanceForm({
  investment,
  today,
  onCommand,
  onClose,
  onSaved,
}: Pick<RecordPageProps, 'today' | 'onCommand'> & {
  investment: Investment;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const saved = useRef(false);
  return (
    <RecordForm
      title={`Atualizar saldo de ${investment.name}`}
      onSubmit={(data) => {
        if (saved.current) return null;
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
          saved.current = true;
          onSaved('Saldo atualizado sem movimentar a conta ou gerar XP.');
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
        Conferi que todos os aportes e retiradas estão registrados para calcular
        o rendimento.
      </label>
      <Actions submit="Salvar saldo" onCancel={onClose} />
    </RecordForm>
  );
}
