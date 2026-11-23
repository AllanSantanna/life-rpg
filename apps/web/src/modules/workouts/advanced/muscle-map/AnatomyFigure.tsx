import { useId, useLayoutEffect, useRef, useState } from 'react';
import { mapGroupLabels } from './participation';
import {
  anatomicalGroups,
  anatomicalLabels,
  diagrams,
  type MapView,
  type Selection,
} from './anatomy';
import {
  metricTone,
  toneLabels,
  type MapMode,
  type MuscleSummary,
} from './model';

export function AnatomyFigure({
  view,
  selection,
  summaries,
  mode,
  onSelect,
}: {
  view: MapView;
  selection: Selection;
  summaries: Record<string, MuscleSummary>;
  mode: MapMode;
  onSelect: (selection: Selection) => void;
}) {
  const diagram = diagrams[view];
  const uid = useId().replaceAll(':', '');
  const svg = useRef<SVGSVGElement>(null);
  const [anchor, setAnchor] = useState({ x: 430, y: 400 });
  const active =
    selection.view === view
      ? diagram.surfaces.find((s) => s.id === selection.id)
      : undefined;
  const muscle = active ? anatomicalGroups[active.group] : null;
  const value = muscle ? (summaries[muscle]?.[mode] ?? null) : null;
  useLayoutEffect(() => {
    if (!active) return;
    const path = svg.current?.querySelector<SVGPathElement>(
      `[data-surface="${active.id}"]`,
    );
    if (path?.getBBox) {
      const box = path.getBBox();
      setAnchor({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    }
  }, [active]);
  const calloutY = Math.max(180, Math.min(1250, anchor.y - 100));
  return (
    <figure className="muscle-v2-figure">
      <figcaption>{diagram.label}</figcaption>
      <svg
        ref={svg}
        viewBox="70 35 884 1430"
        role="group"
        aria-label={`Mapa muscular · visão ${diagram.label.toLowerCase()}`}
      >
        <defs>
          <clipPath id={`${uid}-body`}>
            {diagram.outline.map((p) => (
              <path key={p.id} d={p.d} />
            ))}
          </clipPath>
          {diagram.surfaces.map((surface) => {
            const group = anatomicalGroups[surface.group];
            const score = group ? (summaries[group]?.[mode] ?? null) : null;
            const tone = metricTone(score, mode);
            return (
              <linearGradient
                key={surface.id}
                id={`${uid}-${surface.id}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
                className={`muscle-tone-${tone}`}
              >
                <stop offset="0" className="muscle-v2-shade" />
                <stop offset=".42" className="muscle-v2-color" />
                <stop offset="1" className="muscle-v2-shade" />
              </linearGradient>
            );
          })}
        </defs>
        <image
          href={diagram.image}
          x="0"
          y="0"
          width="1024"
          height="1536"
          clipPath={`url(#${uid}-body)`}
          className="muscle-v2-base"
          aria-hidden="true"
        />
        {diagram.surfaces.map((surface) => {
          const group = anatomicalGroups[surface.group];
          const score = group ? (summaries[group]?.[mode] ?? null) : null;
          const tone = metricTone(score, mode);
          const selected = active?.id === surface.id;
          const name = anatomicalLabels[surface.group];
          const side = surface.id.includes('_LEFT')
            ? 'esquerda da imagem'
            : 'direita da imagem';
          const status =
            score === null
              ? 'Indeterminado'
              : `${score}% · ${toneLabels[tone]}`;
          return (
            <path
              key={surface.id}
              d={surface.d}
              id={`${uid}-region-${surface.id}`}
              data-surface={surface.id}
              data-group={group ?? 'unmapped'}
              data-tone={tone}
              fill={`url(#${uid}-${surface.id})`}
              className="muscle-v2-surface"
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${diagram.label} · ${name} · ${side}: ${status}`}
              onClick={() => onSelect({ view, id: surface.id })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect({ view, id: surface.id });
                }
              }}
            >
              <title>
                {name} ·{' '}
                {group
                  ? `Grupo: ${mapGroupLabels[group]}`
                  : 'Sem grupo correspondente nos registros'}{' '}
                · {status}
              </title>
            </path>
          );
        })}
        <image
          href={diagram.image}
          x="0"
          y="0"
          width="1024"
          height="1536"
          clipPath={`url(#${uid}-body)`}
          className="muscle-v2-texture"
          aria-hidden="true"
        />
        {active && (
          // Drawn above neighbouring regions so the whole contour stays visible.
          <g className="muscle-v2-selection" aria-hidden="true">
            <path d={active.d} className="muscle-v2-selection-halo" />
            <path d={active.d} className="muscle-v2-selection-line" />
          </g>
        )}
        {active && (
          <g className="muscle-v2-callout" aria-hidden="true">
            <path
              d={`M${anchor.x} ${anchor.y} L${anchor.x < 512 ? 95 : 929} ${calloutY + 70}`}
            />
            <circle cx={anchor.x} cy={anchor.y} r="9" />
            <rect
              x={anchor.x < 512 ? 75 : 709}
              y={calloutY}
              width="220"
              height="140"
              rx="16"
            />
            <text
              x={anchor.x < 512 ? 185 : 819}
              y={calloutY + 52}
              textAnchor="middle"
            >
              {active.group === 'SHOULDERS_FRONT' ||
              active.group === 'SHOULDERS_REAR' ||
              active.group === 'SHOULDERS_SIDE'
                ? 'Deltoide'
                : anatomicalLabels[active.group]}
            </text>
            <text
              x={anchor.x < 512 ? 185 : 819}
              y={calloutY + 108}
              textAnchor="middle"
              className="muscle-v2-callout-value"
            >
              {value === null ? '—' : `${value}%`}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
