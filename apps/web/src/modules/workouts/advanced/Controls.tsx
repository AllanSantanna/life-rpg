import { ConfirmAction } from '../../../shared/components/ConfirmAction';
import { periodOptions, type TrainingPeriod } from './calculations';
/** Exclusão confirmada; delega ao componente compartilhado `ConfirmAction`. */
export function DeleteAction({
  label,
  detail,
  onConfirm,
}: {
  label: string;
  detail: string;
  onConfirm: () => void;
}) {
  return <ConfirmAction label={label} detail={detail} onConfirm={onConfirm} />;
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
