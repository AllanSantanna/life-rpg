import { isDate } from '../../records/dates';
import { exerciseCatalog, normalizedName, starterExercises } from './catalog';
import { normalizeExerciseName } from './importing/normalize';
import {
  muscleLabels,
  type AdvancedWorkoutState,
  type Exercise,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSet,
} from './types';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 1000): v is string =>
  typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => text(v, 200) && !!v.trim();
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const list = (
  v: unknown,
  valid: (entry: unknown) => boolean,
  max = 10000,
): v is { id: string }[] =>
  Array.isArray(v) &&
  v.length <= max &&
  v.every(valid) &&
  new Set(v.map((e) => e.id)).size === v.length;
const muscle = (v: unknown) =>
  typeof v === 'string' && Object.hasOwn(muscleLabels, v);
export function isExercise(v: unknown): v is Exercise {
  return (
    object(v) &&
    id(v.id) &&
    id(v.name) &&
    muscle(v.primary) &&
    Array.isArray(v.secondary) &&
    v.secondary.every(muscle) &&
    new Set(v.secondary).size === v.secondary.length &&
    !v.secondary.includes(v.primary) &&
    text(v.equipment, 200)
  );
}
export function isWorkoutSet(v: unknown): v is WorkoutSet {
  return (
    object(v) &&
    id(v.id) &&
    (v.kind === 'warmup' || v.kind === 'working') &&
    (v.weight === null ||
      (typeof v.weight === 'number' &&
        Number.isFinite(v.weight) &&
        v.weight >= 0 &&
        v.weight <= 2000)) &&
    (v.reps === null || integer(v.reps, 1, 1000)) &&
    (v.rir === null || integer(v.rir, 0, 10)) &&
    typeof v.completed === 'boolean' &&
    (!v.completed || (v.weight !== null && v.reps !== null))
  );
}
export function isPlan(
  v: unknown,
  catalog: readonly Exercise[],
): v is WorkoutPlan {
  return (
    object(v) &&
    id(v.id) &&
    id(v.name) &&
    text(v.description) &&
    text(v.notes) &&
    list(
      v.exercises,
      (e) =>
        object(e) &&
        id(e.id) &&
        catalog.some((ex) => ex.id === e.exerciseId) &&
        integer(e.sets, 1, 30) &&
        (e.reps === null || integer(e.reps, 1, 1000)) &&
        text(e.notes),
      100,
    ) &&
    new Set(
      (v.exercises as unknown as { exerciseId: string }[]).map(
        (e) => e.exerciseId,
      ),
    ).size === v.exercises.length
  );
}
export function isSession(v: unknown): v is WorkoutSession {
  if (
    !object(v) ||
    !id(v.id) ||
    !isDate(v.date) ||
    !(v.planId === null || id(v.planId)) ||
    !id(v.planName) ||
    !text(v.notes) ||
    (v.status !== 'in_progress' && v.status !== 'completed')
  )
    return false;
  if (
    !list(
      v.exercises,
      (e) =>
        object(e) &&
        id(e.id) &&
        isExercise(e.exercise) &&
        text(e.notes) &&
        list(e.sets, isWorkoutSet, 100),
      100,
    )
  )
    return false;
  const exercises = v.exercises as WorkoutSession['exercises'];
  return (
    new Set(exercises.map((e) => e.exercise.id)).size === exercises.length &&
    (v.status !== 'completed' ||
      exercises.some((e) => e.sets.some((s) => s.completed)))
  );
}
export function isAdvancedWorkoutState(v: unknown): v is AdvancedWorkoutState {
  if (
    !object(v) ||
    v.version !== 1 ||
    typeof v.enabled !== 'boolean' ||
    !list(v.exercises, isExercise, 1000)
  )
    return false;
  const state = v as unknown as AdvancedWorkoutState;
  const catalog = exerciseCatalog(state);
  return (
    new Set(catalog.map((e) => e.id)).size === catalog.length &&
    new Set(catalog.map((e) => normalizedName(e.name))).size ===
      catalog.length &&
    !state.exercises.some((e) => starterExercises.some((s) => s.id === e.id)) &&
    list(v.plans, (p) => isPlan(p, catalog), 1000) &&
    list(v.sessions, isSession) &&
    (v.importSettings === undefined ||
      (object(v.importSettings) &&
        ['weight-reps', 'reps-weight', 'auto'].includes(
          String(v.importSettings.inputOrder),
        ) &&
        list(
          v.importSettings.aliases,
          (a) =>
            object(a) &&
            id(a.id) &&
            id(a.name) &&
            !!normalizeExerciseName(a.name) &&
            id(a.exerciseId) &&
            (a.planId === null || id(a.planId)),
          2000,
        ) &&
        new Set(
          state.importSettings!.aliases.map((a) =>
            JSON.stringify([a.planId, normalizeExerciseName(a.name)]),
          ),
        ).size === state.importSettings!.aliases.length)) &&
    (v.rotation === undefined ||
      (object(v.rotation) &&
        Array.isArray(v.rotation.sequence) &&
        v.rotation.sequence.length <= 200 &&
        v.rotation.sequence.every((ref) =>
          state.plans.some((p) => p.id === ref),
        ) &&
        integer(
          v.rotation.cursor,
          0,
          Math.max(0, v.rotation.sequence.length - 1),
        )))
  );
}
