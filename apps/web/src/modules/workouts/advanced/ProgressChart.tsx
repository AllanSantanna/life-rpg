import { useId, useRef, useState } from 'react';
import { displayDate } from '../../records/dates';
import { number } from './calculations';
export interface ProgressPoint {
  id: string;
  date: string;
  name: string;
  value: number;
}
export function ProgressChart({
  points,
  label,
  unit,
}: {
  points: ProgressPoint[];
  label: string;
  unit: string;
}) {
  const id = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const refs = useRef<(SVGCircleElement | null)[]>([]);
  if (!points.length)
    return (
      <p className="record-empty">
        Nenhum registro para este exercício e período. O gráfico usa apenas
        séries válidas de sessões concluídas.
      </p>
    );
  const active = points.find((p) => p.id === activeId);
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) =>
    points.length === 1 ? 320 : 65 + (i / (points.length - 1)) * 540;
  const y = (v: number) => 200 - (v / max) * 170;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`)
    .join(' ');
  return (
    <figure className="strength-progress">
      <figcaption>
        {label} · {unit}
      </figcaption>
      <div className="strength-chart-scroll">
        <svg
          viewBox="0 0 640 250"
          role="group"
          aria-label={`${label}: ${points.length} ${points.length === 1 ? 'ponto registrado' : 'pontos registrados'}`}
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1={65}
                x2={605}
                y1={y(t * max)}
                y2={y(t * max)}
                className="strength-chart-grid"
              />
              <text x={55} y={y(t * max) + 4} textAnchor="end">
                {number(t * max)}
              </text>
            </g>
          ))}
          {points.length > 1 && (
            <path d={path} className="strength-chart-line" fill="none" />
          )}
          {points.map((p, i) => (
            <g key={p.id}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={4}
                className="strength-chart-dot"
              />
              <circle
                ref={(el) => {
                  refs.current[i] = el;
                }}
                cx={x(i)}
                cy={y(p.value)}
                r={22}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${displayDate(p.date)} · ${p.name}: ${number(p.value)} ${unit}`}
                aria-describedby={
                  active?.id === p.id ? `${id}-tooltip` : undefined
                }
                onMouseEnter={() => setActiveId(p.id)}
                onFocus={() => setActiveId(p.id)}
                onClick={() => setActiveId(p.id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? Math.min(points.length - 1, i + 1)
                      : event.key === 'ArrowLeft'
                        ? Math.max(0, i - 1)
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? points.length - 1
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    refs.current[next]?.focus();
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveId(p.id);
                  }
                  if (event.key === 'Escape') setActiveId(null);
                }}
              />
              {(i === 0 || i === points.length - 1 || points.length <= 3) && (
                <text
                  x={x(i)}
                  y={232}
                  textAnchor={
                    points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'
                  }
                >
                  {displayDate(p.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {active && (
        <p id={`${id}-tooltip`} role="tooltip" className="strength-tooltip">
          {displayDate(active.date)} · {active.name} ·{' '}
          <strong>
            {number(active.value)} {unit}
          </strong>
        </p>
      )}
      <p className="record-hint">
        Cada ponto representa uma sessão registrada, em ordem cronológica.
        Toque, passe o mouse ou use Tab e as setas para consultar valores.{' '}
        {points.length === 1 ? 'Seu primeiro ponto já está aqui.' : ''}
      </p>
    </figure>
  );
}
