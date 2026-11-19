import { areas } from '../evolution/scoring';
import { displayDate } from '../records/dates';
import type { EvolutionPoint, Pillar } from './types';

export function EvolutionLines({
  series,
  visible,
  selected,
  onSelect,
}: {
  series: EvolutionPoint[];
  visible: Pillar[];
  selected: number;
  onSelect: (index: number, area?: Pillar) => void;
}) {
  const x = (index: number) =>
    40 + (index * 540) / Math.max(1, series.length - 1);
  return (
    <svg
      className="statistics-lines"
      viewBox="0 0 600 260"
      role="img"
      aria-label="Alternativa 2D: dedicação móvel de 7 dias"
      onPointerUp={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width)
          onSelect(
            Math.max(
              0,
              Math.min(
                series.length - 1,
                Math.round(
                  ((((event.clientX - rect.left) / rect.width) * 600 - 40) /
                    540) *
                    (series.length - 1),
                ),
              ),
            ),
          );
      }}
    >
      <title>Dedicação móvel de sete dias · escala de 0 a 100</title>
      <desc>
        Os mesmos dados da paisagem. Use o seletor de data ou a tabela para
        consultar os valores.
      </desc>
      {[0, 25, 50, 75, 100].map((score) => (
        <g key={score}>
          <path
            d={`M40 ${220 - score * 1.9} H580`}
            className="statistics-line-grid"
          />
          <text x="8" y={224 - score * 1.9}>
            {score}
          </text>
        </g>
      ))}
      {areas
        .filter((area) => visible.includes(area))
        .map((area) => (
          <g key={area} data-area={area}>
            <polyline
              points={series
                .map(
                  (point, index) =>
                    `${x(index)},${220 - point.scores[area] * 1.9}`,
                )
                .join(' ')}
              className="statistics-line-series"
            />
            <circle
              cx={x(selected)}
              cy={220 - (series[selected]?.scores[area] ?? 0) * 1.9}
              r="4"
              className="statistics-line-point"
            />
          </g>
        ))}
      <text x="40" y="248">
        {displayDate(series[0]!.date)}
      </text>
      <text x="580" y="248" textAnchor="end">
        {displayDate(series.at(-1)!.date)}
      </text>
    </svg>
  );
}
