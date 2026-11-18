import './Sparkline.css';

export function Sparkline({
  values,
  label,
}: {
  values: readonly number[];
  label: string;
}) {
  const points = values
    .map(
      (value, index) =>
        `${8 + (index * 284) / Math.max(1, values.length - 1)},${64 - Math.max(0, Math.min(100, value)) * 0.56}`,
    )
    .join(' ');
  return (
    <svg
      className="metric-sparkline"
      viewBox="0 0 300 72"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <desc>{values.join(', ')} de 100, em ordem cronológica.</desc>
      <path d="M8 64 H292" className="metric-sparkline-grid" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
