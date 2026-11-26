import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { AdvancedWorkouts } from './advanced/AdvancedWorkouts';
import { emptyAdvancedWorkouts } from './advanced/types';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { useCommand } from '../records/useCommand';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import {
  Summary,
  RecordFeedback,
  Field,
  RecordForm,
  Empty,
} from '../records/RecordUI';
import { displayDate, monthDates } from '../records/dates';
import { workoutStats } from './calculations';
import { plural } from '../../shared/lib/plural';
export function WorkoutsPage({
  records,
  today,
  onCommand,
  whenSaved,
  sessionFocus,
}: RecordPageProps & {
  /** Sessão de treino a exibir, escolhida nas Ações rápidas. */
  sessionFocus?: { sessionId: string; nonce: number } | undefined;
}) {
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const { run, message } = useCommand(onCommand);
  const advanced = records.advancedWorkouts ?? emptyAdvancedWorkouts();
  const selected = records.workouts.find((item) => item.date === date);
  const stats = workoutStats(records.workouts, today, month);
  const calendar = monthDates(month);
  const firstDay = calendar[0]
    ? new Date(`${calendar[0]}T12:00:00`).getDay()
    : 0;
  const frequencySummary = (
    <Summary
      values={[
        {
          label: 'Últimos 7 dias',
          value: plural(stats.weekly, 'treino', 'treinos'),
        },
        {
          label: 'Mês selecionado',
          value: plural(stats.monthly, 'treino', 'treinos'),
        },
        { label: 'Total de dias treinados', value: stats.total },
        { label: 'Consistência no mês', value: `${stats.consistency}%` },
      ]}
    />
  );
  return (
    <div
      className={`pillar-page ${advanced.enabled ? 'advanced-training-page' : ''}`}
      data-area="Treinos"
    >
      <section
        className="panel strength-mode"
        aria-label="Modo Avançado de Treinos"
      >
        <label className="strength-switch">
          <span>
            <strong>Modo Avançado</strong>
            <small>Fichas, histórico, evolução e mais</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Modo Avançado"
            checked={advanced.enabled}
            onChange={(event) =>
              run({
                type: 'advancedWorkout',
                command: { type: 'setEnabled', enabled: event.target.checked },
              })
            }
          />
          <span aria-hidden="true" className="strength-switch-track" />
        </label>
      </section>
      <RecordFeedback message={message} />
      {advanced.enabled && (
        <AdvancedWorkouts
          state={advanced}
          today={today}
          onCommand={(command) => run({ type: 'advancedWorkout', command })}
          {...(whenSaved ? { whenSaved } : {})}
          focus={sessionFocus}
        />
      )}

      {frequencySummary}
      <RecordForm title="Treinou hoje?" onSubmit={() => null}>
        <Field label="Dia do treino">
          <CustomDatePicker
            label="Dia do treino"
            value={date}
            required
            max={today}
            onChange={setDate}
          />
        </Field>
        <p className="record-hint">
          Corrija qualquer dia anterior. Um registro por dia.
        </p>
        <div className="record-actions">
          <button
            type="button"
            aria-pressed={selected?.trained === true}
            className="record-primary"
            onClick={() =>
              run({ type: 'saveWorkout', value: { date, trained: true } })
            }
          >
            Sim
          </button>
          <button
            type="button"
            aria-pressed={selected?.trained === false}
            className="filter-button"
            onClick={() =>
              run({ type: 'saveWorkout', value: { date, trained: false } })
            }
          >
            Não
          </button>
          {selected && (
            <ConfirmAction
              label="Remover registro do dia"
              detail="O registro de treino deste dia será removido; o XP correspondente é recalculado."
              confirmLabel="Confirmar remoção"
              onConfirm={() => run({ type: 'deleteWorkout', date })}
            />
          )}
        </div>
        <p className="record-hint">
          {selected
            ? selected.trained
              ? 'Treino registrado.'
              : 'Dia sem treino registrado.'
            : 'Nenhum registro para este dia.'}
        </p>
      </RecordForm>

      <section
        className="panel record-section"
        aria-label="Calendário de treinos"
      >
        <h2>Calendário de treinos</h2>
        <Field label="Mês do calendário">
          <CustomDatePicker
            label="Mês do calendário"
            mode="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={setMonth}
          />
        </Field>
        <p className="record-hint">
          Verde: treinou · vermelho: não treinou · cinza: sem registro. Toque
          para corrigir.
        </p>
        <div className="workout-calendar">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <span key={day} className="calendar-weekday">
              {day}
            </span>
          ))}
          {calendar.map((day, index) => {
            const item = records.workouts.find((entry) => entry.date === day);
            return (
              <button
                key={day}
                type="button"
                style={
                  index === 0 ? { gridColumnStart: firstDay + 1 } : undefined
                }
                disabled={day > today}
                className={`calendar-day ${item ? (item.trained ? 'trained' : 'not-trained') : ''} ${date === day ? 'selected' : ''}`}
                aria-label={`${displayDate(day)}: ${item ? (item.trained ? 'treinou' : 'não treinou') : 'sem registro'}`}
                onClick={() => setDate(day)}
              >
                {Number(day.slice(-2))}
              </button>
            );
          })}
        </div>
      </section>
      {!records.workouts.length && (
        <Empty>Seu calendário começa no primeiro registro.</Empty>
      )}
    </div>
  );
}
