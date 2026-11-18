import { useState } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { exerciseCatalog, recentExercises, searchExercises } from './catalog';
import { ExerciseManager } from './ExerciseManager';
import { Icon as WorkoutIcon } from '../../../shared/components/Icon';
import {
  muscleLabels,
  type AdvancedWorkoutState,
  type AdvancedCommandHandler,
  type Exercise,
} from './types';

export function ExercisePicker({
  state,
  excluded,
  onAdd,
  onClose,
  onCommand,
}: {
  state: AdvancedWorkoutState;
  excluded: string[];
  onAdd: (exercises: Exercise[]) => void;
  onClose: () => void;
  onCommand: AdvancedCommandHandler;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const catalog = exerciseCatalog(state);
  const results = searchExercises(catalog, query, muscle, equipment);
  const recent = recentExercises(state).filter((e) =>
    results.some((r) => r.id === e.id),
  );
  function row(ex: Exercise) {
    const added = excluded.includes(ex.id);
    const checked = selected.includes(ex.id);
    return (
      <li key={ex.id}>
        <button
          type="button"
          className={`exercise-result ${checked ? 'is-selected' : ''}`}
          aria-label={`${checked ? 'Desmarcar' : 'Selecionar'} ${ex.name}`}
          aria-pressed={checked}
          disabled={added}
          onClick={() =>
            setSelected(
              checked
                ? selected.filter((id) => id !== ex.id)
                : [...selected, ex.id],
            )
          }
        >
          <span className="exercise-glyph">
            <WorkoutIcon name="dumbbell" size={25} />
          </span>
          <span className="exercise-result-copy">
            <strong>{ex.name}</strong>
            <small>
              {muscleLabels[ex.primary]} · {ex.equipment || 'Livre'}
            </small>
          </span>
          <span className="exercise-add">
            <WorkoutIcon name={checked || added ? 'check' : 'plus'} size={18} />
          </span>
        </button>
      </li>
    );
  }
  return (
    <section
      className="exercise-picker strength-stack"
      aria-label="Adicionar exercícios"
    >
      <div className="strength-heading">
        <button className="filter-button" type="button" onClick={onClose}>
          <WorkoutIcon name="back" /> Voltar
        </button>
        <h3>Adicionar exercícios</h3>
      </div>
      <label className="exercise-search">
        <WorkoutIcon name="search" />
        <input
          type="search"
          autoFocus
          aria-label="Pesquisar exercícios"
          placeholder="Buscar exercício ou nome alternativo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="strength-fields">
        <CustomSelect
          label="Filtrar por grupo muscular"
          value={muscle}
          options={[
            { value: '', label: 'Todos os músculos' },
            ...Object.entries(muscleLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          onChange={setMuscle}
        />
        <CustomSelect
          label="Filtrar por equipamento"
          value={equipment}
          options={[
            { value: '', label: 'Todos os equipamentos' },
            ...[...new Set(catalog.map((e) => e.equipment))]
              .filter(Boolean)
              .sort()
              .map((value) => ({ value, label: value })),
          ]}
          onChange={setEquipment}
        />
      </div>
      {recent.length > 0 && !query && (
        <div>
          <h4 className="picker-section-title">
            <WorkoutIcon name="history" size={16} /> Recentes
          </h4>
          <ul className="exercise-results">{recent.map(row)}</ul>
        </div>
      )}
      <div>
        <p className="picker-section-title" role="status">
          {results.length} exercícios encontrados
        </p>
        <ul className="exercise-results">{results.map(row)}</ul>
        {!results.length && (
          <p className="record-empty">
            Nenhum exercício encontrado. Tente outro nome ou cadastre o seu
            abaixo.
          </p>
        )}
      </div>
      <ExerciseManager state={state} onCommand={onCommand} compact />
      <div className="workout-sticky-actions">
        <span aria-live="polite">{selected.length} selecionados</span>
        <button
          type="button"
          className="record-primary"
          disabled={!selected.length}
          onClick={() => {
            onAdd(
              selected.flatMap((id) => {
                const ex = catalog.find((e) => e.id === id);
                return ex ? [ex] : [];
              }),
            );
            onClose();
          }}
        >
          Adicionar ({selected.length}) <WorkoutIcon name="plus" size={18} />
        </button>
      </div>
    </section>
  );
}
