import { exerciseCatalog } from '../catalog';
import type { AdvancedWorkoutState, ExerciseAlias } from '../types';
import { normalizeExerciseName } from './normalize';
import type { ImportExercise, ImportTarget } from './types';

export function importPlanId(
  state: AdvancedWorkoutState,
  target: ImportTarget,
): string | null {
  const id =
    'planId' in target
      ? target.planId
      : state.sessions.find((s) => s.id === target.sessionId)?.planId;
  return state.plans.some((p) => p.id === id) ? id! : null;
}
export function aliasIssue(
  state: AdvancedWorkoutState,
  alias: ExerciseAlias,
): string | null {
  if (alias.planId !== null && !state.plans.some((p) => p.id === alias.planId))
    return 'Ficha de destino excluída.';
  if (!exerciseCatalog(state).some((e) => e.id === alias.exerciseId))
    return 'Exercício de destino excluído.';
  return null;
}
export function saveImportAlias(
  state: AdvancedWorkoutState,
  alias: ExerciseAlias,
): AdvancedWorkoutState {
  if (!normalizeExerciseName(alias.name) || alias.name.length > 200)
    throw new Error('Informe um apelido de até 200 caracteres.');
  const issue = aliasIssue(state, alias);
  if (issue) throw new Error(issue);
  const settings = state.importSettings ?? {
    inputOrder: 'weight-reps' as const,
    aliases: [],
  };
  const collision = settings.aliases.find(
    (a) =>
      a.id !== alias.id &&
      a.planId === alias.planId &&
      normalizeExerciseName(a.name) === normalizeExerciseName(alias.name),
  );
  if (collision) {
    if (collision.exerciseId === alias.exerciseId) return state;
    throw new Error(
      'Este apelido já aponta para outro exercício neste contexto. Edite a associação existente.',
    );
  }
  return {
    ...state,
    importSettings: {
      ...settings,
      aliases: [
        ...settings.aliases.filter((a) => a.id !== alias.id),
        { ...alias, name: alias.name.trim() },
      ],
    },
  };
}
export function confirmedAliases(
  state: AdvancedWorkoutState,
  target: ImportTarget,
  rows: ImportExercise[],
): ExerciseAlias[] {
  const planId = importPlanId(state, target);
  return rows
    .filter((r) => r.manuallyConfirmed && r.rememberName && r.exerciseId)
    .map((r) => ({
      id:
        state.importSettings?.aliases.find(
          (a) =>
            a.planId === planId &&
            normalizeExerciseName(a.name) ===
              normalizeExerciseName(r.sourceName),
        )?.id ?? crypto.randomUUID(),
      name: r.sourceName,
      exerciseId: r.exerciseId!,
      planId,
    }));
}
