import { useState } from 'react';
import { CustomDatePicker } from '../../../shared/components/CustomDatePicker';
import { ActionButton } from '../../../shared/components/ActionButton';
import { Field } from '../../records/RecordUI';
import {
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
  return (
    <form
      aria-label="Correção de data e horário"
      className="strength-stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (date > today)
            throw new Error('Informe uma data válida até hoje.');
          const corrected = withSessionTiming(session, date, time);
          assertStartNotFuture(corrected.startedAt);
          setError(onSave(corrected));
        } catch (reason) {
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
            }}
          />
        </Field>
        <Field label="Horário do treino">
          <input
            type="time"
            lang="pt-BR"
            step={60}
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setError(null);
            }}
            aria-describedby="session-time-hint"
          />
        </Field>
      </div>
      <p id="session-time-hint" className="record-hint">
        Início do treino · 24 horas (HH:mm). Deixe vazio se desconhecido.
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
