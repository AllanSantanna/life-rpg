import { useState } from 'react';
import { CustomDatePicker } from '../../../shared/components/CustomDatePicker';
import { ActionButton } from '../../../shared/components/ActionButton';
import { CustomTimePicker } from '../../../shared/components/CustomTimePicker';
import { Field } from '../../records/RecordUI';
import { StartOccurrenceSelect } from './StartOccurrenceSelect';
import {
  AmbiguousTimeError,
  assertStartNotFuture,
  sessionTime,
  withSessionTiming,
} from './sessionTiming';
import type { WorkoutSession } from './types';
export function SessionTimingEditor({
  session,
  today,
  onSave,
}: {
  session: WorkoutSession;
  today: string;
  onSave: (session: WorkoutSession) => string | null;
}) {
  const [date, setDate] = useState(session.date);
  const [time, setTime] = useState(sessionTime(session));
  const [error, setError] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<string[]>([]);
  const [offset, setOffset] = useState('');
  const resetOccurrence = () => {
    setOffsets([]);
    setOffset('');
  };
  return (
    <form
      aria-label="Correção de data e horário"
      className="strength-stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (date > today)
            throw new Error('Informe uma data válida até hoje.');
          const corrected = withSessionTiming(
            session,
            date,
            time,
            offset || undefined,
          );
          assertStartNotFuture(corrected.startedAt);
          setError(onSave(corrected));
        } catch (reason) {
          if (reason instanceof AmbiguousTimeError) setOffsets(reason.offsets);
          setError(
            reason instanceof Error
              ? reason.message
              : 'Confira data e horário.',
          );
        }
      }}
    >
      <div className="strength-fields">
        <Field label="Data da sessão">
          <CustomDatePicker
            label="Data da sessão"
            value={date}
            max={today}
            onChange={(value) => {
              setDate(value);
              setError(null);
              resetOccurrence();
            }}
          />
        </Field>
        <Field label="Horário do treino">
          <CustomTimePicker
            label="Horário do treino"
            value={time}
            onChange={(value) => {
              setTime(value);
              setError(null);
              resetOccurrence();
            }}
            describedBy="session-time-hint"
          />
        </Field>
        <StartOccurrenceSelect
          offsets={offsets}
          value={offset}
          onChange={(value) => {
            setOffset(value);
            setError(null);
          }}
        />
      </div>
      <p id="session-time-hint" className="record-hint">
        Início do treino · 24 horas (HH:mm). Use “Limpar” se desconhecido.
        Aplique data e horário juntos; exercícios e séries serão preservados.
        {session.startedAt
          ? ` Fuso registrado: UTC${session.startedAt.slice(-6)}.`
          : ''}
      </p>
      {error && (
        <p className="record-error" role="alert">
          {error}
        </p>
      )}
      <ActionButton
        type="submit"
        icon="check"
        disabled={date === session.date && time === sessionTime(session)}
      >
        Salvar data/hora
      </ActionButton>
    </form>
  );
}
