import { useState } from 'react';
import { periodOptions, type TrainingPeriod } from './calculations';
export function DeleteAction({
  label,
  detail,
  onConfirm,
}: {
  label: string;
  detail: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <div
      className="strength-confirm"
      role="group"
      aria-label={`Confirmar ${label.toLowerCase()}`}
    >
      <p>{detail}</p>
      <button
        type="button"
        className="record-primary"
        onClick={() => {
          onConfirm();
          setConfirming(false);
        }}
      >
        Confirmar exclusão
      </button>
      <button
        type="button"
        className="filter-button"
        onClick={() => setConfirming(false)}
      >
        Cancelar
      </button>
    </div>
  ) : (
    <button
      type="button"
      className="text-action"
      onClick={() => setConfirming(true)}
    >
      {label}
    </button>
  );
}
export function PeriodControl({
  value,
  onChange,
}: {
  value: TrainingPeriod;
  onChange: (value: TrainingPeriod) => void;
}) {
  const shortLabels = {
    week: '7D',
    month: '1M',
    quarter: '3M',
    halfyear: '6M',
    year: '1A',
  };
  return (
    <div
      className="workout-period-control"
      role="group"
      aria-label="Período de treino"
    >
      {periodOptions.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-label={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {shortLabels[option.value]}
        </button>
      ))}
    </div>
  );
}
