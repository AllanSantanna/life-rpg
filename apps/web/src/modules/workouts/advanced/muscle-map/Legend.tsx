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
        {[
          ...(mode === 'effort' ? effortScale : recoveryScale),
          ['unknown', 'Sem dados suficientes'] as [Tone, string],
        ].map(([tone, range]) => (
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
