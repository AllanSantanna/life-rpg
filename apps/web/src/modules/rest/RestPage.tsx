import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { useCommand } from '../records/useCommand';
import { formNumber } from '../records/form';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import {
  Actions,
  Empty,
  Field,
  RecordForm,
  Summary,
  RecordFeedback,
} from '../records/RecordUI';
import { displayDate } from '../records/dates';
import { sleepStats } from './calculations';
import { SleepForm } from './SleepForm';
export function RestPage({ records, today, onCommand }: RecordPageProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { run, message } = useCommand(onCommand);
  const stats = sleepStats(records.sleep, today, records.sleepGoalHours);
  const hours = (value: number) =>
    `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  return (
    <div className="pillar-page" data-area="Descanso">
      <Summary
        values={[
          {
            label: 'Média · últimos 7 dias',
            value: hours(stats.weeklyAverage),
          },
          { label: 'Média · mês atual', value: hours(stats.monthlyAverage) },
          { label: 'Meta diária', value: hours(records.sleepGoalHours) },
          { label: 'Consistência no mês', value: `${stats.consistency}%` },
        ]}
      />
      <p className="record-hint">
        Médias consideram apenas dias registrados ({stats.weeklyCount} na semana
        e {stats.monthlyCount} no mês). Consistência usa os dias decorridos do
        mês.
      </p>
      <div className="record-columns">
        <SleepForm
          key={`${editing}:${revision}`}
          records={records}
          today={today}
          editing={editing}
          run={run}
          onSaved={() => {
            setEditing(null);
            setRevision((value) => value + 1);
          }}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
        <RecordForm
          title="Meta de sono"
          onSubmit={(data) =>
            run({ type: 'setSleepGoal', hours: formNumber(data, 'goal') })
          }
        >
          <Field label="Meta diária em horas">
            <input
              name="goal"
              inputMode="decimal"
              required
              defaultValue={records.sleepGoalHours}
            />
          </Field>
          <p className="record-hint">
            De 1 a 24 horas. Alterar a meta recalcula consistência e
            recompensas; não acumula XP por edições.
          </p>
          <Actions submit="Salvar meta" />
        </RecordForm>
      </div>
      <RecordFeedback message={message} />
      <section className="panel record-section" aria-label="Histórico de sono">
        <h2>Histórico de sono</h2>
        {!records.sleep.length && <Empty>Nenhuma noite registrada.</Empty>}
        <ul className="record-list">
          {[...records.sleep]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((day) => (
              <li key={day.date}>
                <div>
                  <strong>{displayDate(day.date)}</strong>
                  <p>
                    {hours(day.hours)} ·{' '}
                    {day.hours >= records.sleepGoalHours
                      ? 'Meta atingida'
                      : 'Abaixo da meta'}
                  </p>
                </div>
                <div className="record-actions">
                  <button
                    type="button"
                    onClick={() => setEditing(day.date)}
                    aria-label={`Editar sono de ${displayDate(day.date)}`}
                  >
                    Editar
                  </button>
                  <ConfirmAction
                    label="Excluir"
                    ariaLabel={`Excluir sono de ${displayDate(day.date)}`}
                    className=""
                    detail={`O registro de sono de ${displayDate(day.date)} será excluído e o XP correspondente, recalculado.`}
                    onConfirm={() =>
                      run({ type: 'deleteSleep', date: day.date })
                    }
                  />
                </div>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
