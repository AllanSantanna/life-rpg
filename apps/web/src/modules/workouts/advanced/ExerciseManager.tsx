import { useState } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { Field } from '../../records/RecordUI';
import { exerciseCatalog } from './catalog';
import {
  muscleLabels,
  type AdvancedWorkoutState,
  type AdvancedCommandHandler,
  type Exercise,
  type Muscle,
} from './types';
const muscles = Object.entries(muscleLabels).map(([value, label]) => ({
  value: value as Muscle,
  label,
}));
export function ExerciseManager({
  state,
  onCommand,
  compact = false,
}: {
  compact?: boolean;
  state: AdvancedWorkoutState;
  onCommand: AdvancedCommandHandler;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Exercise | null>(null);
  return (
    <details className="strength-catalog" open={expanded}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setExpanded(!expanded);
        }}
      >
        {compact
          ? 'Não encontrou? Criar exercício personalizado'
          : 'Catálogo de exercícios'}
      </summary>
      {expanded && (
        <div>
          <button
            type="button"
            className="filter-button"
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(),
                name: '',
                primary: 'chest',
                secondary: [],
                equipment: '',
              })
            }
          >
            Novo exercício
          </button>
          {draft && (
            <form
              className="strength-editor"
              aria-label="Cadastro de exercício"
              onSubmit={(event) => {
                event.preventDefault();
                if (!onCommand({ type: 'saveExercise', value: draft }))
                  setDraft(null);
              }}
            >
              <Field label="Nome do exercício">
                <input
                  required
                  maxLength={200}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Grupo muscular principal">
                <CustomSelect
                  label="Grupo muscular principal"
                  value={draft.primary}
                  options={muscles}
                  onChange={(primary) =>
                    setDraft({
                      ...draft,
                      primary,
                      secondary: draft.secondary.filter((m) => m !== primary),
                    })
                  }
                />
              </Field>
              <fieldset className="strength-secondary">
                <legend>Grupos secundários (opcional)</legend>
                {muscles
                  .filter((m) => m.value !== draft.primary)
                  .map((m) => (
                    <label key={m.value}>
                      <input
                        type="checkbox"
                        checked={draft.secondary.includes(m.value)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            secondary: e.target.checked
                              ? [...draft.secondary, m.value]
                              : draft.secondary.filter((v) => v !== m.value),
                          })
                        }
                      />
                      {m.label}
                    </label>
                  ))}
              </fieldset>
              <Field label="Equipamento (opcional)">
                <input
                  maxLength={200}
                  value={draft.equipment}
                  onChange={(e) =>
                    setDraft({ ...draft, equipment: e.target.value })
                  }
                />
              </Field>
              <div className="record-actions">
                <button type="submit" className="record-primary">
                  Salvar exercício
                </button>
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => setDraft(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {!compact && (
            <ul className="strength-exercise-catalog">
              {exerciseCatalog(state).map((ex) => (
                <li key={ex.id}>
                  <span>
                    <strong>{ex.name}</strong>
                    <small>
                      {muscleLabels[ex.primary]}
                      {ex.equipment ? ` · ${ex.equipment}` : ''}
                    </small>
                  </span>
                  {state.exercises.some((e) => e.id === ex.id) && (
                    <button
                      type="button"
                      className="text-action"
                      aria-label={`Editar exercício ${ex.name}`}
                      onClick={() => setDraft(structuredClone(ex))}
                    >
                      Editar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}
