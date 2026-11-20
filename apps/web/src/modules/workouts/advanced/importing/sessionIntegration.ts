import { sessionTime, withSessionTiming } from '../sessionTiming';
import { exerciseCatalog } from '../catalog';
import { sessionFromPlan } from '../commands';
import type {
  AdvancedWorkoutCommand,
  AdvancedWorkoutState,
  Exercise,
  SessionExercise,
  WorkoutSession,
  WorkoutSet,
} from '../types';
import { isImportSetValid } from './validation';
import type { ImportExercise, ImportTarget } from './types';
import { importPlanId } from './aliases';

export function importCatalog(
  state: AdvancedWorkoutState,
  target: ImportTarget,
): Exercise[] {
  const snapshots =
    'sessionId' in target
      ? (state.sessions
          .find((s) => s.id === target.sessionId)
          ?.exercises.map((e) => e.exercise) ?? [])
      : [];
  return [
    ...snapshots,
    ...exerciseCatalog(state).filter(
      (e) => !snapshots.some((s) => s.id === e.id),
    ),
  ];
}
export function preferredExerciseIds(
  state: AdvancedWorkoutState,
  target: ImportTarget,
): string[] {
  const plan = state.plans.find((p) => p.id === importPlanId(state, target));
  if (plan) return plan.exercises.map((e) => e.exerciseId);
  return 'sessionId' in target
    ? (state.sessions
        .find((s) => s.id === target.sessionId)
        ?.exercises.map((e) => e.exercise.id) ?? [])
    : (state.plans
        .find((p) => p.id === target.planId)
        ?.exercises.map((e) => e.exerciseId) ?? []);
}
export function importConflict(
  session: WorkoutSession | undefined,
  exerciseId: string | null,
): SessionExercise | undefined {
  return session?.exercises.find(
    (e) =>
      e.exercise.id === exerciseId &&
      e.sets.some(
        (s) =>
          s.weight !== null || s.reps !== null || s.rir !== null || s.completed,
      ),
  );
}
const sameSet = (a: WorkoutSet, b: WorkoutSet) =>
  a.kind === b.kind &&
  a.weight === b.weight &&
  a.reps === b.reps &&
  a.rir === b.rir;

/** Append a multiset difference: three equal sets remain three, retries add zero. */
export function onlyNewSets(
  existing: WorkoutSet[],
  incoming: WorkoutSet[],
): WorkoutSet[] {
  const remaining = [...existing];
  return incoming.filter((set) => {
    const index = remaining.findIndex((old) => sameSet(old, set));
    if (index < 0) return true;
    remaining.splice(index, 1);
    return false;
  });
}

export function prepareWorkoutImport(
  state: AdvancedWorkoutState,
  target: ImportTarget,
  rows: ImportExercise[],
  id: () => string = () => crypto.randomUUID(),
): Extract<AdvancedWorkoutCommand, { type: 'importSession' }> {
  const catalog = importCatalog(state, target);
  const expected =
    'sessionId' in target
      ? state.sessions.find((s) => s.id === target.sessionId)
      : null;
  if (expected === undefined)
    throw new Error('Sessão de destino não encontrada.');
  if (!rows.length) throw new Error('Inclua pelo menos um exercício.');
  if (new Set(rows.map((e) => e.exerciseId)).size !== rows.length)
    throw new Error(
      'Há exercícios repetidos na prévia. Reúna as séries em um único exercício.',
    );
  const plan =
    'planId' in target && target.planId !== null
      ? state.plans.find((p) => p.id === target.planId)
      : null;
  if (plan === undefined) throw new Error('Ficha de destino não encontrada.');
  let value = structuredClone(
    expected ?? sessionFromPlan(plan, state, id(), target.date ?? ''),
  );
  if (target.date)
    value = withSessionTiming(value, target.date, sessionTime(value));
  const importedIds: string[] = [];
  for (const row of rows) {
    const exercise = catalog.find((e) => e.id === row.exerciseId);
    if (!exercise)
      throw new Error(`Escolha o exercício para “${row.sourceName}”.`);
    const conflict = importConflict(expected ?? undefined, row.exerciseId);
    if (conflict && !row.conflict)
      throw new Error(
        `Escolha como tratar os dados existentes de ${exercise.name}.`,
      );
    if (conflict && row.conflict === 'keep') continue;
    if (!row.sets.length || !row.sets.every(isImportSetValid))
      throw new Error(
        `Confira as séries de ${exercise.name}. Carga e repetições são obrigatórias; RIR é opcional.`,
      );
    let entry = value.exercises.find((e) => e.exercise.id === exercise.id);
    if (!entry) {
      entry = {
        id: id(),
        exercise: structuredClone(exercise),
        notes: '',
        sets: [],
      };
      value.exercises.push(entry);
    }
    importedIds.push(exercise.id);
    const incoming = row.sets.map((set) => ({
      kind: set.kind,
      weight: set.weight,
      reps: set.reps,
      rir: set.rir,
      id: id(),
      completed: true,
    }));
    if (conflict && row.conflict === 'append') {
      entry.sets.push(...onlyNewSets(entry.sets, incoming));
    } else {
      // Reuse IDs of the selected existing slots when replacing their values.
      entry.sets = incoming.map((set, i) => ({
        ...set,
        id: entry.sets[i]?.id ?? set.id,
      }));
    }
    if (entry.sets.length > 100)
      throw new Error('O limite é de 100 séries por exercício.');
  }
  if (!expected) {
    value.exercises = [
      ...importedIds.flatMap((exerciseId) =>
        value.exercises.filter((e) => e.exercise.id === exerciseId),
      ),
      ...value.exercises.filter((e) => !importedIds.includes(e.exercise.id)),
    ];
  }
  if (value.exercises.length > 100)
    throw new Error('O limite é de 100 exercícios por sessão.');
  return {
    type: 'importSession',
    value,
    expected: expected ? structuredClone(expected) : null,
  };
}
