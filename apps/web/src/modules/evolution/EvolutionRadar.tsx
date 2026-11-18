import { useId } from 'react';
import { areas, type Scores } from './scoring';

const axes = [
  {
    area: 'Finanças',
    x: 200,
    y: 55,
    labelX: 200,
    labelY: 28,
    anchor: 'middle',
  },
  {
    area: 'Treinos',
    x: 305,
    y: 160,
    labelX: 323,
    labelY: 164,
    anchor: 'start',
  },
  {
    area: 'Descanso',
    x: 200,
    y: 265,
    labelX: 200,
    labelY: 297,
    anchor: 'middle',
  },
  {
    area: 'Conhecimento',
    x: 95,
    y: 160,
    labelX: 77,
    labelY: 164,
    anchor: 'end',
  },
] as const;
function gridPoints(scale: number) {
  return axes
    .map(({ x, y }) => `${200 + (x - 200) * scale},${160 + (y - 160) * scale}`)
    .join(' ');
}
function scorePoints(scores: Scores) {
  return axes.map(
    ({ x, y, area }) =>
      `${200 + ((x - 200) * scores[area]) / 100},${160 + ((y - 160) * scores[area]) / 100}`,
  );
}
export function EvolutionRadar({
  scores,
  previous,
  compact = false,
}: {
  scores: Scores;
  previous?: Scores;
  compact?: boolean;
}) {
  const id = useId();
  const path = `M${scorePoints(scores).join(' L')} Z`;
  return (
    <figure
      className={`evolution-radar ${compact ? 'radar-compact' : ''}`}
      aria-label={`Radar de Evolução · ${compact ? '7 dias' : 'período selecionado'}`}
    >
      <svg
        viewBox={compact ? '80 40 240 240' : '-20 -5 440 340'}
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <title id={`${id}-title`}>Dedicação recente · escala de 0 a 100</title>
        <desc id={`${id}-description`}>
          {areas
            .map(
              (area) =>
                `${area}: ${scores[area]} de 100${previous ? `; anterior: ${previous[area]}` : ''}`,
            )
            .join('. ')}
        </desc>
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={gridPoints(scale)}
            className="radar-grid"
          />
        ))}
        {axes.map(({ area, x, y }) => (
          <line
            key={area}
            x1="200"
            y1="160"
            x2={x}
            y2={y}
            className="radar-grid"
          />
        ))}
        {!compact &&
          [0, 25, 50, 75, 100].map((value) => (
            <text
              key={value}
              x="205"
              y={160 - value * 1.05}
              className="radar-tick"
            >
              {value}
            </text>
          ))}
        {previous && (
          <polygon
            points={scorePoints(previous).join(' ')}
            className="radar-previous"
          />
        )}
        <path
          className="radar-shape"
          d={path}
          style={{ d: `path("${path}")` }}
        />
        {axes.map(({ area, x, y }) => (
          <circle
            key={area}
            className="radar-point"
            data-area={area}
            r={compact ? 3 : 3.5}
            cx={200 + ((x - 200) * scores[area]) / 100}
            cy={160 + ((y - 160) * scores[area]) / 100}
            style={{
              cx: `${200 + ((x - 200) * scores[area]) / 100}px`,
              cy: `${160 + ((y - 160) * scores[area]) / 100}px`,
            }}
          />
        ))}
        {!compact &&
          axes.map(({ area, labelX, labelY, anchor }) => (
            <text
              key={area}
              x={labelX}
              y={labelY}
              textAnchor={anchor}
              className="radar-label"
              data-area={area}
            >
              {area}
              <tspan x={labelX} dy="1.35em" className="radar-value">
                {scores[area]}
              </tspan>
            </text>
          ))}
      </svg>
      {compact && (
        <figcaption>
          <span>EVOLUÇÃO · 7 DIAS</span>
          <dl className="radar-compact-values">
            {areas.map((area) => (
              <div key={area} data-area={area}>
                <dt>
                  <abbr title={area}>
                    {
                      {
                        Finanças: 'Fin.',
                        Treinos: 'Tre.',
                        Descanso: 'Des.',
                        Conhecimento: 'Con.',
                      }[area]
                    }
                  </abbr>
                </dt>
                <dd>{scores[area]}</dd>
              </div>
            ))}
          </dl>
        </figcaption>
      )}
    </figure>
  );
}
