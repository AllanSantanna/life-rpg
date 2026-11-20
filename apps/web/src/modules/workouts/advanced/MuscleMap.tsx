import { useWorkoutClock } from './useWorkoutClock';
import { localDate } from '../../records/dates';
import { useId, useMemo, useRef, useState } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { Icon } from '../../../shared/components/Icon';
import { shiftDate } from '../../records/dates';
import { number, periodDays, type TrainingPeriod } from './calculations';
import type { WorkoutSession } from './types';
import { mapGroupLabels, type MapGroup } from './muscle-map/participation';
import { AnatomyFigure } from './muscle-map/AnatomyFigure';
import {
  anatomicalGroups,
  anatomicalLabels,
  findSurface,
  type Selection,
} from './muscle-map/anatomy';
import { Legend } from './muscle-map/Legend';
import { MethodHelp } from './muscle-map/MethodHelp';
import { MuscleDetails, type HistoryPoint } from './muscle-map/MuscleDetails';
import {
  dailyHistory,
  metricTone,
  projectMuscles,
  type MapMode,
} from './muscle-map/model';
import './muscle-map/muscle-map.css';
import { SelectionConnector } from './muscle-map/SelectionConnector';

export function MuscleMap({
  sessions,
  period,
  onPeriodChange,
}: {
  sessions: WorkoutSession[];
  today: string;
  period: TrainingPeriod;
  onPeriodChange?: (period: TrainingPeriod) => void;
}) {
  const [mode, setMode] = useState<MapMode>('effort');
  const [selection, setSelection] = useState<Selection>({
    view: 'front',
    id: 'CHEST_LEFT',
  });
  const now = useWorkoutClock();
  const referenceDay = localDate(new Date(now));
  const uid = useId();
  const grid = useRef<HTMLDivElement>(null);
  const { summaries, unmappedSets } = useMemo(
    () => projectMuscles(sessions, now, period),
    [sessions, now, period],
  );
  const selectedGroup = anatomicalGroups[findSurface(selection).group];
  const summary = selectedGroup ? summaries[selectedGroup] : undefined;
  const history = useMemo<HistoryPoint[]>(() => {
    if (mode === 'recovery')
      return Array.from({ length: 14 }, (_, i) => {
        const date = shiftDate(referenceDay, i - 13);
        return {
          date,
          value: selectedGroup
            ? projectMuscles(sessions, i === 13 ? now : date, period).summaries[
                selectedGroup
              ].recovery
            : null,
        };
      });
    if (!summary) return [];
    const daily = dailyHistory(summary, referenceDay, period);
    const bucketSize = Math.ceil(daily.length / 14);
    return Array.from(
      { length: Math.ceil(daily.length / bucketSize) },
      (_, i) => {
        const chunk = daily.slice(i * bucketSize, (i + 1) * bucketSize);
        const values = chunk.filter((d) => d.units !== null);
        return {
          date: chunk[0]!.date,
          endDate: chunk.at(-1)!.date,
          value: values.length
            ? values.reduce((sum, d) => sum + d.units!, 0)
            : null,
        };
      },
    );
  }, [mode, period, selectedGroup, sessions, summary, referenceDay, now]);
  function selectGroup(muscle: MapGroup) {
    setSelection(documentedSelection(muscle));
  }
  return (
    <section className="muscle-v2" aria-label="Mapa muscular">
      <header className="muscle-v2-heading">
        <div className="muscle-v2-title">
          <span className="muscle-v2-emblem">
            <Icon name="dumbbell" size={30} />
          </span>
          <div>
            <h3>Mapa muscular</h3>
            <p>
              Visualize o esforço dos treinos e a recuperação estimada de cada
              grupo.
            </p>
          </div>
        </div>
        <MethodHelp />
      </header>
      <div className="muscle-v2-toolbar">
        <div
          className="muscle-v2-modes"
          role="tablist"
          aria-label="Modo do mapa muscular"
        >
          {(['effort', 'recovery'] as const).map((value) => (
            <button
              type="button"
              key={value}
              id={`${uid}-${value}`}
              role="tab"
              aria-selected={mode === value}
              aria-controls={`${uid}-panel`}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => setMode(value)}
              onKeyDown={(e) => {
                if (
                  ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === 'Home'
                      ? 'effort'
                      : e.key === 'End'
                        ? 'recovery'
                        : mode === 'effort'
                          ? 'recovery'
                          : 'effort';
                  setMode(next);
                  document.getElementById(`${uid}-${next}`)?.focus();
                }
              }}
            >
              <Icon
                name={value === 'effort' ? 'dumbbell' : 'shield'}
                size={22}
              />
              {value === 'effort' ? 'Esforço' : 'Recuperação'}
            </button>
          ))}
        </div>
        {onPeriodChange && (
          <CustomSelect
            label="Período do mapa"
            icon="calendar"
            value={period}
            options={(Object.keys(periodDays) as TrainingPeriod[]).map(
              (value) => ({
                value,
                label: `Últimos ${periodDays[value]} dias`,
              }),
            )}
            onChange={onPeriodChange}
          />
        )}
      </div>
      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-${mode}`}
      >
        <div className="muscle-v2-grid" ref={grid}>
          <SelectionConnector container={grid} selection={selection} />
          <div className="muscle-v2-stage">
            <div className="muscle-v2-bodies">
              <AnatomyFigure
                view="front"
                mode={mode}
                selection={selection}
                summaries={summaries}
                onSelect={setSelection}
              />
              <AnatomyFigure
                view="back"
                mode={mode}
                selection={selection}
                summaries={summaries}
                onSelect={setSelection}
              />
            </div>
            <p className="muscle-v2-stage-caption">
              {anatomicalLabels[findSurface(selection).group]} ·{' '}
              {summary?.[mode] === null || summary?.[mode] === undefined
                ? 'Indeterminado'
                : `${summary[mode]}%${mode === 'recovery' ? ' · índice estimado' : ' · esforço relativo'}`}
              <br />
              Selecione uma região no corpo ou na lista abaixo.
            </p>
          </div>
          <MuscleDetails
            selection={selection}
            summary={summary}
            mode={mode}
            history={history}
            days={periodDays[period]}
          />
        </div>
        <Legend mode={mode} />
        <p className="muscle-v2-announcement" aria-live="polite">
          {selectedGroup
            ? `${mapGroupLabels[selectedGroup]}: ${number(summary?.sets ?? 0)} ${summary?.sets === 1 ? 'série válida' : 'séries válidas'} no período.`
            : 'Grupo sem correspondência nos registros.'}
        </p>
        {mode === 'recovery' && (
          <p className="record-hint">
            Estimativa baseada no histórico registrado; não substitui percepção
            de fadiga e recuperação.
          </p>
        )}
        <details className="muscle-v2-picker" open>
          <summary>Grupos musculares · dados agregados</summary>
          <ul>
            {(Object.entries(mapGroupLabels) as [MapGroup, string][]).map(
              ([muscle, label]) => (
                <li key={muscle}>
                  <button
                    type="button"
                    aria-pressed={selectedGroup === muscle}
                    onClick={() => selectGroup(muscle)}
                  >
                    <span
                      className={`muscle-v2-dot muscle-tone-${metricTone(summaries[muscle][mode], mode)}`}
                      aria-hidden="true"
                    />
                    {label}
                    <strong>{summaries[muscle].sets}</strong>
                  </button>
                </li>
              ),
            )}
          </ul>
        </details>
        {unmappedSets > 0 && (
          <p className="record-hint">
            {unmappedSets} séries sem grupo reconhecido não receberam pontuação.
          </p>
        )}
        {!Object.values(summaries).some((s) => s.sets > 0) && (
          <p className="record-empty">
            Nenhuma série válida concluída neste período.
          </p>
        )}
      </div>
    </section>
  );
}
// Seleções canônicas da lista; grupos só do mapa não alteram snapshots nem tipos salvos.
function documentedSelection(muscle: MapGroup): Selection {
  const selections: Record<MapGroup, Selection> = {
    chest: { view: 'front', id: 'CHEST_LEFT' },
    shoulders: { view: 'front', id: 'SHOULDER_FRONT_LEFT' },
    biceps: { view: 'front', id: 'BICEPS_LEFT' },
    triceps: { view: 'back', id: 'TRICEPS_LEFT' },
    forearms: { view: 'front', id: 'FOREARM_LEFT' },
    core: { view: 'front', id: 'CORE_LEFT' },
    trapezius: { view: 'back', id: 'TRAPEZIUS_LEFT' },
    back: { view: 'back', id: 'LATISSIMUS_LEFT' },
    lowerBack: { view: 'back', id: 'LOWER_BACK_LEFT' },
    adductors: { view: 'front', id: 'ADDUCTOR_LEFT' },
    abductors: { view: 'front', id: 'ABDUCTOR_LEFT' },
    glutes: { view: 'back', id: 'GLUTEUS_LEFT' },
    quadriceps: { view: 'front', id: 'QUADRICEPS_LEFT' },
    hamstrings: { view: 'back', id: 'HAMSTRINGS_LEFT' },
    calves: { view: 'back', id: 'CALVES_LEFT' },
  };
  return selections[muscle];
}
