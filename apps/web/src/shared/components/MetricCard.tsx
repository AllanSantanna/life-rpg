import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { ProgressBar } from './ProgressBar';
export interface MetricSnapshot {
  id: string;
  title: string;
  icon: IconName;
  category: string;
  value: string;
  unit: string;
  change: string;
  details: { label: string; value: string }[];
  progress: { label: string; value: number; max: number; text: string };
  trend: number[];
}
export function MetricCard({
  metric,
  onOpen,
}: {
  metric: MetricSnapshot;
  onOpen?: () => void;
}) {
  return (
    <article
      className={`panel metric-card metric-${metric.id} relative overflow-hidden p-5 sm:p-6`}
      aria-labelledby={`metric-${metric.id}`}
    >
      <div className="metric-heading">
        <h3 id={`metric-${metric.id}`}>
          <Icon name={metric.icon} size={25} />
          {metric.title}
        </h3>
        <div
          className="metric-ring"
          style={
            {
              '--progress': `${Math.min(100, Math.max(0, (metric.progress.value / metric.progress.max) * 100))}%`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <span>
            {Math.round((metric.progress.value / metric.progress.max) * 100)}%
          </span>
        </div>
      </div>
      <p className="metric-category">{metric.category}</p>
      <div className="metric-value">
        <strong>{metric.value}</strong>
        <span>{metric.unit}</span>
      </div>
      <p className="metric-change">{metric.change}</p>
      <dl className="my-5 space-y-3 border-t border-white/[0.06] pt-5">
        {metric.details.map((detail) => (
          <div
            key={detail.label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <dt className="text-muted">{detail.label}</dt>
            <dd className="font-medium">{detail.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mb-2 flex justify-between gap-2 text-xs">
        <span className="text-muted">{metric.progress.label}</span>
        <span>{metric.progress.text}</span>
      </div>
      {onOpen && (
        <button type="button" className="metric-open" onClick={onOpen}>
          Registrar {metric.title} <span aria-hidden="true">↗</span>
        </button>
      )}
      <ProgressBar
        label={`${metric.title}: ${metric.progress.label}`}
        value={metric.progress.value}
        max={metric.progress.max}
      />
    </article>
  );
}
