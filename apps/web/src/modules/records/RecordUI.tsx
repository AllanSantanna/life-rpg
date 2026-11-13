import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="record-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function RecordForm({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (data: FormData) => string | null;
  children: ReactNode;
}) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setError(onSubmit(new FormData(event.currentTarget)) ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verifique os campos.');
    }
  }
  return (
    <form aria-label={title} className="panel record-form" onSubmit={submit}>
      <h2>{title}</h2>
      {children}
      {error && (
        <p role="alert" className="record-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Actions({
  onCancel,
  submit = 'Salvar registro',
}: {
  onCancel?: (() => void) | undefined;
  submit?: string;
}) {
  return (
    <div className="record-actions">
      <button type="submit" className="record-primary">
        {submit}
      </button>
      {onCancel && (
        <button type="button" className="filter-button" onClick={onCancel}>
          Cancelar edição
        </button>
      )}
    </div>
  );
}
export function Summary({
  values,
}: {
  values: { label: string; value: string | number }[];
}) {
  return (
    <dl className="record-summary">
      {values.map(({ label, value }) => (
        <div className="panel" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="record-empty">{children}</p>;
}
export function DateField({
  today,
  value,
  label = 'Data',
}: {
  today: string;
  value?: string | undefined;
  label?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="date"
        name="date"
        required
        max={today}
        defaultValue={value ?? today}
      />
    </Field>
  );
}
export function RecordFeedback({ message }: { message: string }) {
  return (
    <p className="record-feedback" aria-live="polite">
      {message}
    </p>
  );
}
