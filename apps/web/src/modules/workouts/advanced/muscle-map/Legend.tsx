import { toneLabels, type MapMode, type Tone } from './model';
const effortScale: [Tone, string][] = [
  ['low', '1–24%'],
  ['moderate', '25–49%'],
  ['high', '50–74%'],
  ['very-high', '75–100%'],
];
const recoveryScale: [Tone, string][] = [
  ['ready', '≥ 90%'],
  ['recovering', '70–89%'],
  ['tired', '50–69%'],
  ['fatigued', '< 50%'],
];
const unknown: [Tone, string] = ['unknown', 'Sem dados suficientes'];
// Fora da escala percentual: participação rastreada, sem séries equivalentes.
const stabilizer: [Tone, string] = [
  'stabilizer',
  'Participação não quantificada',
];
export function Legend({ mode }: { mode: MapMode }) {
  return (
    <div
      className="muscle-v2-legend"
      aria-label={`Legenda de ${mode === 'effort' ? 'esforço' : 'recuperação estimada'}`}
    >
      <strong>
        {mode === 'effort' ? 'Esforço relativo' : 'Recuperação estimada'}
      </strong>
      <ul>
        {(mode === 'effort'
          ? // Effort reads from grey (no data) through light to dark red.
            [unknown, stabilizer, ...effortScale]
          : [...recoveryScale, unknown]
        ).map(([tone, range]) => (
          <li key={tone}>
            <span
              className={`muscle-v2-swatch muscle-tone-${tone}`}
              aria-hidden="true"
            />
            <span>
              {toneLabels[tone]}
              <small>{range}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
