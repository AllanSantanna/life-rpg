import { useState } from 'react';
import { muscleActivity, number, type TrainingPeriod } from './calculations';
import { muscleLabels, type Muscle, type WorkoutSession } from './types';
const front: Partial<Record<Muscle, string[]>> = {
  chest: [
    'M70 75 Q83 69 97 77 L97 103 Q78 107 66 95Z',
    'M103 77 Q118 69 131 75 L134 95 Q122 107 103 103Z',
  ],
  shoulders: [
    'M60 68 Q70 65 74 73 L65 95 51 97 Q48 77 60 68Z',
    'M140 68 Q130 65 126 73 L135 95 149 97 Q152 77 140 68Z',
  ],
  biceps: [
    'M51 100 64 101 55 128 43 137 39 125Z',
    'M149 100 136 101 145 128 157 137 161 125Z',
  ],
  forearms: [
    'M41 137 53 132 46 160 32 184 25 180Z',
    'M159 137 147 132 154 160 168 184 175 180Z',
  ],
  trapezius: [
    'M90 56 L89 63 66 67 70 71 Q82 70 92 66Z',
    'M110 56 L111 63 134 67 130 71 Q118 70 108 66Z',
  ],
  core: [
    'M79 108 97 110 97 161 84 170 76 142Z',
    'M103 110 121 108 124 142 116 170 103 161Z',
  ],
  quadriceps: [
    'M78 181 97 177 94 225 86 247 73 236 68 204Z',
    'M103 177 122 181 132 204 127 236 114 247 106 225Z',
  ],
  calves: [
    'M76 258 88 259 86 299 80 317 72 314 69 285Z',
    'M112 259 124 258 131 285 128 314 120 317 114 299Z',
  ],
};
const back: Partial<Record<Muscle, string[]>> = {
  back: [
    'M70 75 97 67 97 151 84 163 70 135 64 96Z',
    'M103 67 130 75 136 96 130 135 116 163 103 151Z',
  ],
  trapezius: [
    'M97 54 L90 56 Q78 63 66 68 L74 74 Q86 84 97 112Z',
    'M103 54 L110 56 Q122 63 134 68 L126 74 Q114 84 103 112Z',
  ],
  shoulders: front.shoulders!,
  triceps: [
    'M51 100 64 98 57 129 45 137 39 125Z',
    'M149 100 136 98 143 129 155 137 161 125Z',
  ],
  forearms: front.forearms!,
  glutes: [
    'M82 164 98 159 98 197 78 204 69 190 73 175Z',
    'M102 159 118 164 127 175 131 190 122 204 102 197Z',
  ],
  hamstrings: [
    'M72 207 96 203 92 237 84 250 73 243 67 224Z',
    'M104 203 128 207 133 224 127 243 116 250 108 237Z',
  ],
  calves: [
    'M74 256 Q88 250 91 270 L84 304 76 317 69 291Z',
    'M109 270 Q112 250 126 256 L131 291 124 317 116 304Z',
  ],
};
function Body({
  side,
  paths,
  counts,
  selected,
  onSelect,
}: {
  side: string;
  paths: typeof front;
  counts: Record<Muscle, number>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <figure>
      <figcaption>{side}</figcaption>
      <svg
        viewBox="0 0 200 350"
        role="group"
        aria-label={`Mapa muscular · visão ${side.toLocaleLowerCase('pt-BR')}`}
      >
        <g fill="#333333" stroke="#777777" strokeWidth="1.5">
          <ellipse cx="100" cy="30" rx="18" ry="23" />
          <path d="M89 52 88 62 61 66Q46 70 42 95L32 132 20 181 25 195 34 191 49 163 62 138 71 127 75 153 68 184 62 209 70 250 66 282 72 320 65 333 68 340 85 338 93 314 99 257 100 213 101 257 107 314 115 338 132 340 135 333 128 320 134 282 130 250 138 209 132 184 125 153 129 127 138 138 151 163 166 191 175 195 180 181 168 132 158 95Q154 70 139 66L112 62 111 52Z" />
        </g>
        {(Object.entries(paths) as [Muscle, string[]][]).map(
          ([muscle, regions]) => (
            <g key={muscle}>
              {regions.map((d, index) => (
                <path
                  key={index}
                  d={d}
                  fill={
                    counts[muscle]
                      ? `rgba(220,38,38,${0.3 + (0.7 * counts[muscle]) / max})`
                      : '#424242'
                  }
                  stroke={selected === muscle ? '#fff1e9' : '#161015'}
                  strokeWidth={selected === muscle ? 2 : 1.5}
                  role="button"
                  tabIndex={0}
                  aria-label={`${side} · ${muscleLabels[muscle]}: ${counts[muscle]} séries válidas`}
                  onClick={() => onSelect(muscle)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(muscle);
                    }
                  }}
                >
                  <title>
                    {muscleLabels[muscle]}: {counts[muscle]} séries válidas
                  </title>
                </path>
              ))}
            </g>
          ),
        )}
      </svg>
    </figure>
  );
}
export function MuscleMap({
  sessions,
  today,
  period,
}: {
  sessions: WorkoutSession[];
  today: string;
  period: TrainingPeriod;
}) {
  const counts = muscleActivity(sessions, today, period);
  const [selected, setSelected] = useState<Muscle | null>(null);
  return (
    <div className="strength-stack">
      <h3>Mapa Muscular</h3>
      <details className="strength-catalog">
        <summary>Sobre o mapa muscular</summary>
        <p className="record-hint">
          Séries válidas concluídas por grupo muscular. A cor mostra apenas a
          quantidade registrada, sem medir recuperação, hipertrofia ou qualidade
          do treino. Grupos principais e secundários recebem a mesma contagem de
          participação.
        </p>
      </details>
      <div className="strength-body-map">
        <Body
          side="Frontal"
          paths={front}
          counts={counts}
          selected={selected}
          onSelect={setSelected}
        />
        <Body
          side="Traseira"
          paths={back}
          counts={counts}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      <p aria-live="polite">
        {selected
          ? `${muscleLabels[selected]}: ${number(counts[selected])} ${counts[selected] === 1 ? 'série válida' : 'séries válidas'} no período.`
          : 'Selecione um músculo ou consulte a legenda.'}
      </p>
      <ul className="strength-muscle-legend">
        {(Object.entries(muscleLabels) as [Muscle, string][]).map(
          ([muscle, label]) => (
            <li key={muscle}>
              <button
                type="button"
                aria-pressed={selected === muscle}
                onClick={() => setSelected(muscle)}
              >
                <span className={counts[muscle] ? 'muscle-worked' : ''} />
                {label}
                <strong>{counts[muscle]}</strong>
              </button>
            </li>
          ),
        )}
      </ul>
      {!Object.values(counts).some(Boolean) && (
        <p className="record-empty">
          Nenhuma série válida concluída neste período.
        </p>
      )}
    </div>
  );
}
