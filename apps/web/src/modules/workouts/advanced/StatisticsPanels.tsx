import { Icon } from '../../../shared/components/Icon';
import { VolumeChart } from './VolumeChart';
import { useState } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { Summary } from '../../records/RecordUI';
import { displayDate } from '../../records/dates';
import { exerciseCatalog } from './catalog';
import {
  completedSessions,
  exerciseHistory,
  exerciseVolume,
  sessionVolume,
  volumeForDays,
  personalRecords,
  number,
  periodDays,
  type TrainingPeriod,
} from './calculations';
import { PeriodControl } from './Controls';
import { MuscleMap } from './MuscleMap';
import { ProgressChart } from './ProgressChart';
import type { AdvancedWorkoutState } from './types';
export function StatisticsPanels({
  state,
  today,
  view,
}: {
  state: AdvancedWorkoutState;
  today: string;
  view: 'progress' | 'records' | 'volume' | 'muscles';
}) {
  const [period, setPeriod] = useState<TrainingPeriod>('month');
  const [exerciseId, setExerciseId] = useState(
    state.sessions.at(-1)?.exercises[0]?.exercise.id ?? 'bench',
  );
  const [metric, setMetric] = useState<'load' | 'reps' | 'volume' | 'rir'>(
    'load',
  );
  const [load, setLoad] = useState('');
  const [includeWarmup, setIncludeWarmup] = useState(false);
  const catalog = exerciseCatalog(state);
  const history = exerciseHistory(state.sessions, exerciseId, today, period);
  const records = personalRecords(state.sessions, exerciseId, today);
  const loads = [
    ...new Set(history.flatMap((p) => p.sets.map((s) => s.weight))),
  ].sort((a, b) => b - a);
  const comparisonLoad = loads.some((n) => String(n) === load)
    ? Number(load)
    : loads[0];
  const selected = completedSessions(state.sessions, today, period);
  const chartPoints = history.flatMap((p) => {
    const reps = p.sets
      .filter((s) => s.weight === comparisonLoad)
      .map((s) => s.reps);
    const value =
      metric === 'reps' ? (reps.length ? Math.max(...reps) : null) : p[metric];
    return value === null
      ? []
      : [{ id: p.id, date: p.date, name: p.name, value }];
  });
  const metricLabels = {
    load: 'Maior carga',
    reps: `Mais repetições com ${number(comparisonLoad ?? 0)} kg`,
    volume: 'Volume válido',
    rir: 'RIR médio',
  };
  return (
    <div className="strength-stack">
      {view !== 'records' && (
        <div className="strength-period">
          <PeriodControl value={period} onChange={setPeriod} />
          <p className="record-hint">
            Últimos {periodDays[period]} dias, incluindo hoje.
          </p>
        </div>
      )}
      {(view === 'progress' || view === 'records') && (
        <CustomSelect
          label="Exercício para análise"
          value={exerciseId}
          options={catalog.map((e) => ({ value: e.id, label: e.name }))}
          onChange={(id) => {
            setExerciseId(id);
            setLoad('');
          }}
        />
      )}
      {view === 'progress' && (
        <>
          <h3>Evolução de Cargas</h3>
          <div className="strength-fields">
            <CustomSelect
              label="Indicador de evolução"
              value={metric}
              options={[
                { value: 'load', label: 'Maior carga' },
                { value: 'reps', label: 'Repetições com a mesma carga' },
                { value: 'volume', label: 'Volume válido' },
                { value: 'rir', label: 'RIR médio' },
              ]}
              onChange={setMetric}
            />
            {metric === 'reps' && (
              <CustomSelect
                label="Carga para comparar repetições"
                value={
                  comparisonLoad === undefined ? '' : String(comparisonLoad)
                }
                options={loads.map((n) => ({
                  value: String(n),
                  label: `${number(n)} kg`,
                }))}
                onChange={setLoad}
              />
            )}
          </div>
          <ProgressChart
            points={chartPoints}
            label={metricLabels[metric]}
            unit={
              metric === 'load'
                ? 'kg'
                : metric === 'volume'
                  ? 'kg·rep'
                  : metric === 'rir'
                    ? 'RIR'
                    : 'rep'
            }
          />
          <details className="strength-catalog">
            <summary>Sobre os indicadores</summary>
            <p className="record-hint">
              RIR é a média dos valores preenchidos nas séries válidas da
              sessão. Campo vazio não equivale a zero; não há recomendação
              automática de carga.
            </p>
          </details>
        </>
      )}
      {view === 'records' && (
        <>
          <h3>Recordes Pessoais</h3>
          <details className="strength-catalog">
            <summary>Como os recordes são calculados</summary>
            <p className="record-hint">
              Histórico completo deste exercício · apenas séries válidas de
              sessões concluídas. Em empate, mantém a data mais antiga. Recordes
              são recalculados após correções e exclusões e não concedem XP.
            </p>
          </details>
          <div className="strength-cards">
            {[
              {
                label: 'Maior carga',
                value: records.load ? `${number(records.load.weight)} kg` : '—',
                date: records.load?.date,
              },
              {
                label: 'Maior volume em uma série',
                value: records.setVolume
                  ? `${number(records.setVolume.volume)} kg·rep`
                  : '—',
                date: records.setVolume?.date,
              },
              {
                label: 'Melhor sessão registrada',
                value: records.bestSession
                  ? `${number(records.bestSession.volume)} kg·rep`
                  : '—',
                date: records.bestSession?.date,
              },
            ].map((r) => (
              <article className="strength-record" key={r.label}>
                <Icon name="trophy" size={22} />
                <h4>{r.label}</h4>
                <strong>{r.value}</strong>
                <small>{r.date ? displayDate(r.date) : 'Sem registros'}</small>
              </article>
            ))}
          </div>
          <details className="strength-catalog">
            <summary>O que significa melhor sessão?</summary>
            <p className="record-hint">
              Melhor sessão = maior soma de carga × repetições das séries
              válidas concluídas deste exercício. É um critério de registro de
              volume, sem estimar força máxima ou qualidade do treino.
            </p>
          </details>
          <h4>Mais repetições por carga</h4>
          {records.byLoad.length ? (
            <ul className="strength-stack">
              {records.byLoad.map((r) => (
                <li className="strength-heading" key={r.weight}>
                  <span>
                    {number(r.weight)} kg · <strong>{r.reps} repetições</strong>
                  </span>
                  <time dateTime={r.date}>{displayDate(r.date)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="record-empty">
              Seus recordes aparecerão após a primeira série válida em uma
              sessão concluída.
            </p>
          )}
        </>
      )}
      {view === 'volume' && (
        <>
          <h3>Volume de Treinamento</h3>
          <label className="strength-check">
            <input
              type="checkbox"
              checked={includeWarmup}
              onChange={(e) => setIncludeWarmup(e.target.checked)}
            />
            Incluir aquecimento no volume
          </label>
          <Summary
            values={[
              {
                label: 'Volume semanal · 7 dias',
                value: `${number(volumeForDays(state.sessions, today, 7, includeWarmup))} kg·rep`,
              },
              {
                label: 'Volume mensal · 30 dias',
                value: `${number(volumeForDays(state.sessions, today, 30, includeWarmup))} kg·rep`,
              },
            ]}
          />
          <details className="strength-catalog">
            <summary>Como o volume é calculado</summary>
            <p className="record-hint">
              Soma de carga × repetições das séries{' '}
              {includeWarmup ? 'válidas e de aquecimento' : 'válidas'}{' '}
              concluídas. Volume é apenas um registro, não uma medida absoluta
              de hipertrofia ou qualidade do treino. Séries pendentes e sessões
              em andamento não entram nestes indicadores.
            </p>
          </details>
          <VolumeChart sessions={selected} includeWarmup={includeWarmup} />
          {selected.map((s) => (
            <details key={s.id} className="strength-exercise">
              <summary>
                {displayDate(s.date)} · {s.planName} ·{' '}
                {number(sessionVolume(s, includeWarmup))} kg·rep
              </summary>
              <ul>
                {s.exercises.map((e) => (
                  <li className="strength-heading" key={e.id}>
                    <span>{e.exercise.name}</span>
                    <strong>
                      {number(exerciseVolume(e, includeWarmup))} kg·rep
                    </strong>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {!selected.length && (
            <p className="record-empty">Nenhuma sessão concluída no período.</p>
          )}
        </>
      )}
      {view === 'muscles' && (
        <MuscleMap sessions={state.sessions} today={today} period={period} />
      )}
    </div>
  );
}
