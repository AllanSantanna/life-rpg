export function ProgressBar({
  label,
  value,
  max,
  className = '',
}: {
  label: string;
  value: number;
  max: number;
  className?: string;
}) {
  const percentage =
    max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`h-1.5 overflow-hidden rounded-full bg-white/[0.07] ${className}`}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
