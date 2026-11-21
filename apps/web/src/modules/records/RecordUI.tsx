import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import type { FormEvent, ReactNode } from 'react';
import { useId, useRef, useState } from 'react';
import { FieldError } from './form';

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
  const errorId = `${useId()}-error`;
  const marked = useRef<HTMLElement | null>(null);
  /** Remove a marcação de campo inválido da tentativa anterior. */
  function unmark() {
    const field = marked.current;
    if (!field) return;
    field.removeAttribute('aria-invalid');
    const rest = (field.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .filter((id) => id && id !== errorId)
      .join(' ');
    if (rest) field.setAttribute('aria-describedby', rest);
    else field.removeAttribute('aria-describedby');
    marked.current = null;
  }
  /** Associa o erro ao campo informado: aria-invalid, descrição e foco. */
  function mark(form: HTMLFormElement, name: string) {
    const named = form.elements.namedItem(name);
    const element = named instanceof HTMLElement ? named : null;
    // Campos com máscara guardam o valor num input oculto; marca o visível.
    const field =
      element instanceof HTMLInputElement && element.type === 'hidden'
        ? (element
            .closest('label')
            ?.querySelector<HTMLElement>('input:not([type="hidden"])') ?? null)
        : element;
    if (!field) return;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute(
      'aria-describedby',
      [field.getAttribute('aria-describedby'), errorId]
        .filter(Boolean)
        .join(' '),
    );
    field.focus();
    marked.current = field;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    unmark();
    try {
      setError(onSubmit(new FormData(form)) ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verifique os campos.');
      if (cause instanceof FieldError) mark(form, cause.field);
    }
  }
  return (
    <form
      aria-label={title}
      aria-describedby={error ? errorId : undefined}
      className="panel record-form"
      onSubmit={submit}
    >
      <h2>{title}</h2>
      {children}
      {error && (
        <p role="alert" id={errorId} className="record-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Actions({
  onCancel,
  submit = 'Salvar registro',
  cancel = 'Cancelar edição',
}: {
  onCancel?: (() => void) | undefined;
  submit?: string;
  /** Rótulo do cancelamento; formulários de criação usam “Cancelar”. */
  cancel?: string;
}) {
  return (
    <div className="record-actions">
      <button type="submit" className="record-primary">
        {submit}
      </button>
      {onCancel && (
        <button type="button" className="filter-button" onClick={onCancel}>
          {cancel}
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
      <CustomDatePicker
        label={label}
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
