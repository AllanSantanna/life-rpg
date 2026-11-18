import type { Period } from '../evolution/scoring';

export function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div
      className="statistics-period"
      role="group"
      aria-label="Período dos novos gráficos"
    >
      {([7, 30, 90] as const).map((days) => (
        <button
          type="button"
          key={days}
          className={`filter-button ${period === days ? 'active' : ''}`}
          aria-label={`${days} dias nos novos gráficos`}
          aria-pressed={period === days}
          onClick={() => onChange(days)}
        >
          {days} dias
        </button>
      ))}
    </div>
  );
}
