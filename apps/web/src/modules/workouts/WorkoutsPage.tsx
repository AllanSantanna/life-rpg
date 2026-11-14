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
export function WorkoutsPage({ records, today, onCommand }: RecordPageProps) {
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const { run, message } = useCommand(onCommand);
  const selected = records.workouts.find((item) => item.date === date);
  const stats = workoutStats(records.workouts, today, month);
  const calendar = monthDates(month);
  const firstDay = calendar[0]
    ? new Date(`${calendar[0]}T12:00:00`).getDay()
    : 0;
  return (
    <div className="pillar-page" data-area="Treinos">
      <Summary
        values={[
          { label: 'Últimos 7 dias', value: `${stats.weekly} treinos` },
          { label: 'Mês selecionado', value: `${stats.monthly} treinos` },
          { label: 'Total de dias treinados', value: stats.total },
          { label: 'Consistência no mês', value: `${stats.consistency}%` },
        ]}
      />
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
            <button
              type="button"
              className="text-action"
              onClick={() => run({ type: 'deleteWorkout', date })}
            >
              Remover registro do dia
            </button>
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
      <RecordFeedback message={message} />
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
