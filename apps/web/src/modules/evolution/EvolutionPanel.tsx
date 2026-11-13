import { EvolutionRadar } from './EvolutionRadar';
import {
  areas,
  comparePeriods,
  defaultGoals,
  type EffortActivity,
  type Period,
} from './scoring';

export function EvolutionPanel({
  activities,
  period,
  onPeriodChange,
  referenceDate,
}: {
  activities: readonly EffortActivity[];
  period: Period;
  referenceDate: string;
  onPeriodChange: (period: Period) => void;
}) {
  const { current, previous, delta } = comparePeriods(activities, period);
  return (
    <section
      className="panel evolution-panel mb-7 p-5 sm:p-6"
      aria-label="Radar de Evolução"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-red-400">Atributos em movimento</p>
          <h2 className="mt-1 text-xl font-semibold">Radar de Evolução</h2>
        </div>
        <div className="flex gap-2" role="group" aria-label="Período do radar">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              className={`filter-button ${period === days ? 'active' : ''}`}
              aria-pressed={period === days}
              onClick={() => onPeriodChange(days)}
            >
              {days} dias
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Registros reais + histórico demonstrativo preservado. Referência:{' '}
        {referenceDate}. Últimos {period} dias versus os {period} anteriores.
      </p>
      <div className="evolution-detail-layout">
        <div>
          <EvolutionRadar scores={current} previous={previous} />
          <div className="radar-legend">
            <span>Atual</span>
            <span>Anterior (tracejado)</span>
          </div>
        </div>
        <dl className="evolution-values">
          {areas.map((area) => (
            <div key={area} className="evolution-value-row">
              <dt data-area={area}>{area}</dt>
              <dd>
                <strong>{current[area]}/100</strong>
                <span
                  className={
                    delta[area] > 0
                      ? 'score-up'
                      : delta[area] < 0
                        ? 'score-down'
                        : 'text-muted'
                  }
                >
                  {delta[area] > 0 ? '↑ +' : delta[area] < 0 ? '↓ ' : '= '}
                  {delta[area]} pontos · anterior {previous[area]}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <details className="radar-explanation">
        <summary>Como as pontuações são calculadas?</summary>
        <p>
          70% esforço + 30% frequência, em relação à meta do período. Limite de
          1 unidade por área/dia; escala de 0 a 100.
        </p>
        <p>
          Metas semanais:{' '}
          {areas.map((area) => `${area} ${defaultGoals[area]}`).join(' · ')}{' '}
          dias equivalentes.
        </p>
        <p>
          Missões de finanças, treino e leitura valem 1 unidade; hidratação e
          desconexão, 0,5 cada. Desfazer remove a contribuição. XP e patrimônio
          não entram no cálculo. Registros reais e missões da mesma área/dia
          compartilham o limite diário. Sono usa a proporção da meta pessoal.
        </p>
      </details>
    </section>
  );
}
