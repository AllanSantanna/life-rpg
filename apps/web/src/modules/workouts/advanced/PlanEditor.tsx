import { useState } from 'react';
import { Field } from '../../records/RecordUI';
import { exerciseCatalog } from './catalog';
import { ExercisePicker } from './ExercisePicker';
import { Icon as WorkoutIcon } from '../../../shared/components/Icon';
import type {
  AdvancedWorkoutState,
  AdvancedCommandHandler,
  WorkoutPlan,
} from './types';
export function PlanEditor({
  plan,
  state,
  onChange,
  onCommand,
}: {
  plan: WorkoutPlan;
  state: AdvancedWorkoutState;
  onChange: (plan: WorkoutPlan) => void;
  onCommand: AdvancedCommandHandler;
}) {
  const [picking, setPicking] = useState(false);
  const catalog = exerciseCatalog(state);
  function update(
    id: string,
    patch: Partial<WorkoutPlan['exercises'][number]>,
  ) {
    onChange({
      ...plan,
      exercises: plan.exercises.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  }
  function move(index: number, offset: number) {
    const exercises = [...plan.exercises];
    const [item] = exercises.splice(index, 1);
    exercises.splice(index + offset, 0, item!);
    onChange({ ...plan, exercises });
  }
  if (picking)
    return (
      <ExercisePicker
        state={state}
        excluded={plan.exercises.map((e) => e.exerciseId)}
        onCommand={onCommand}
        onClose={() => setPicking(false)}
        onAdd={(exercises) =>
          onChange({
            ...plan,
            exercises: [
              ...plan.exercises,
              ...exercises.map((e) => ({
                id: crypto.randomUUID(),
                exerciseId: e.id,
                sets: 3,
                reps: null,
                notes: '',
              })),
            ],
          })
        }
      />
    );
  return (
    <div className="strength-stack">
      <div className="strength-fields">
        <Field label="Nome da ficha">
          <input
            required
            maxLength={200}
            value={plan.name}
            onChange={(e) => onChange({ ...plan, name: e.target.value })}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <input
            maxLength={1000}
            value={plan.description}
            placeholder="Ex.: Peito e tríceps"
            onChange={(e) => onChange({ ...plan, description: e.target.value })}
          />
        </Field>
      </div>
      <ol className="strength-stack plan-exercises">
        {plan.exercises.map((ex, index) => (
          <li className="strength-exercise" key={ex.id}>
            <div className="strength-heading">
              <div className="exercise-title">
                <span className="exercise-glyph">
                  <WorkoutIcon name="dumbbell" />
                </span>
                <strong>
                  {catalog.find((e) => e.id === ex.exerciseId)?.name}
                </strong>
              </div>
              <div className="record-actions">
                <button
                  type="button"
                  className="filter-button"
                  aria-label={`Subir exercício ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="filter-button"
                  aria-label={`Descer exercício ${index + 1}`}
                  disabled={index === plan.exercises.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-action"
                  onClick={() =>
                    onChange({
                      ...plan,
                      exercises: plan.exercises.filter((e) => e.id !== ex.id),
                    })
                  }
                >
                  Remover exercício
                </button>
              </div>
            </div>
            <div className="strength-fields">
              <Field label={`Séries planejadas · exercício ${index + 1}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={30}
                  step={1}
                  value={ex.sets}
                  onChange={(e) =>
                    update(ex.id, { sets: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label={`Repetições planejadas · exercício ${index + 1}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  step={1}
                  value={ex.reps ?? ''}
                  placeholder="Opcional"
                  onChange={(e) =>
                    update(ex.id, {
                      reps:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <details>
              <summary>Observações do exercício</summary>
              <Field label={`Observações · exercício ${index + 1}`}>
                <input
                  maxLength={1000}
                  value={ex.notes}
                  onChange={(e) => update(ex.id, { notes: e.target.value })}
                />
              </Field>
            </details>
          </li>
        ))}
      </ol>
      {!plan.exercises.length && (
        <p className="record-empty">
          Sua ficha está pronta para receber exercícios.
        </p>
      )}
      <button
        type="button"
        className="filter-button workout-wide"
        onClick={() => setPicking(true)}
      >
        <WorkoutIcon name="plus" /> Adicionar exercícios
      </button>
      <details>
        <summary>Observações da ficha</summary>
        <Field label="Observações da ficha">
          <textarea
            maxLength={1000}
            value={plan.notes}
            onChange={(e) => onChange({ ...plan, notes: e.target.value })}
          />
        </Field>
      </details>
    </div>
  );
}
