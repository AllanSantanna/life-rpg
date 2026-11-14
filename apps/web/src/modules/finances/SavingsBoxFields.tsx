import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import type { Investment } from './types';
import { Field } from '../records/RecordUI';
import { MoneyInput } from './MoneyInput';
import { unitsToDecimal } from './monetary';
export function SavingsBoxFields({
  investment,
  today,
}: {
  investment?: Investment | undefined;
  today: string;
}) {
  return (
    <>
      <Field label="Instituição financeira (opcional)">
        <input
          name="institution"
          maxLength={200}
          defaultValue={investment?.institution}
        />
      </Field>
      <Field label="Rentabilidade contratada (% do CDI, opcional)">
        <input
          name="cdiPercent"
          inputMode="decimal"
          placeholder="Ex.: 100"
          defaultValue={
            investment?.cdiPercentBasisPoints !== undefined
              ? unitsToDecimal(investment.cdiPercentBasisPoints, 2).replace(
                  '.',
                  ',',
                )
              : ''
          }
        />
      </Field>
      <p className="record-hint">
        O percentual contratado é apenas informativo. Não consultamos o CDI nem
        estimamos juros, impostos ou valor líquido.
      </p>
      {!investment && (
        <>
          <Field label="Saldo atual da caixinha (R$, opcional)">
            <MoneyInput name="boxBalance" />
          </Field>
          <Field label="Data do saldo informado">
            <CustomDatePicker
              label="Data do saldo informado"
              name="balanceDate"
              max={today}
              defaultValue={today}
            />
          </Field>
          <label className="financial-confirmation__check">
            <input name="movementsComplete" type="checkbox" />
            Conferi que todos os aportes e retiradas estão registrados para
            calcular o rendimento.
          </label>
        </>
      )}
    </>
  );
}
