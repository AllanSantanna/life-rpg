import { useState } from 'react';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { displayDate } from '../records/dates';
import { formNumber, formText } from '../records/form';
import { Actions, Field, RecordForm } from '../records/RecordUI';
import type { LifeRecords, RecordCommand } from '../records/types';

const hoursText = (hours: number) => hours.toString().replace('.', ',');

/**
 * Registro de sono compartilhado pela página Descanso e pelas Ações rápidas:
 * mesmo comando (`saveSleep`), mesmas validações e um registro por data.
 * Ao escolher uma data que já tem registro, o formulário avisa e preenche as
 * horas atuais: salvar corrige esse dia, sem criar outro registro.
 */
export function SleepForm({
  records,
  today,
  editing = null,
  initial,
  run,
  onSaved,
  onCancel,
  cancelLabel,
}: {
  records: LifeRecords;
  today: string;
  /** Data em edição (fixa); `null` registra uma nova noite. */
  editing?: string | null;
  /** Valores iniciais de um novo registro (ex.: comando por voz). */
  initial?: { date: string; hours?: number | undefined } | undefined;
  run: (command: RecordCommand) => string | null;
  onSaved?: () => void;
  onCancel?: (() => void) | undefined;
  cancelLabel?: string;
}) {
  const [date, setDate] = useState(editing ?? initial?.date ?? today);
  const existing = records.sleep.find((day) => day.date === date);
  return (
    <RecordForm
      title={editing ? 'Editar sono' : 'Registrar sono'}
      onSubmit={(data) => {
        const chosen = formText(data, 'date');
        if (
          editing &&
          editing !== chosen &&
          records.sleep.some((day) => day.date === chosen)
        )
          return 'Já existe um registro na data escolhida. Edite esse registro.';
        // A data fica fixa durante edição; um novo dia substitui apenas o próprio dia.
        const error = run({
          type: 'saveSleep',
          value: { date: chosen, hours: formNumber(data, 'hours') },
        });
        if (!error) onSaved?.();
        return error;
      }}
    >
      {editing ? (
        <Field label="Data">
          <CustomDatePicker label="Data" name="date" value={editing} readOnly />
        </Field>
      ) : (
        <Field label="Data">
          <CustomDatePicker
            label="Data"
            name="date"
            required
            max={today}
            defaultValue={initial?.date ?? today}
            onChange={setDate}
          />
        </Field>
      )}
      <Field label="Horas dormidas">
        <input
          // Troca de data com registro existente recarrega as horas salvas.
          key={editing ? 'editing' : (existing?.date ?? 'new')}
          name="hours"
          inputMode="decimal"
          required
          placeholder="Ex.: 7,5"
          defaultValue={
            initial?.hours !== undefined && date === initial.date
              ? hoursText(initial.hours)
              : existing
                ? hoursText(existing.hours)
                : undefined
          }
        />
      </Field>
      {!editing && existing ? (
        <p className="record-hint" role="status">
          Já existe registro de {hoursText(existing.hours)} h em{' '}
          {displayDate(existing.date)}. Salvar corrige as horas desse dia.
        </p>
      ) : (
        <p className="record-hint">
          Um registro por data. Salvar no mesmo dia corrige as horas anteriores.
        </p>
      )}
      <Actions
        onCancel={onCancel}
        {...(cancelLabel ? { cancel: cancelLabel } : {})}
      />
    </RecordForm>
  );
}
