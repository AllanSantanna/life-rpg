import type { AdvancedWorkoutState, WorkoutPlan } from './types';

export function planLetter(index: number): string {
  if (index < 0) return '?';
  let letter = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    letter = String.fromCharCode(65 + ((value - 1) % 26)) + letter;
  }
  return letter;
}
export function divisionPlans(
  count: number,
  makeId: () => string = () => crypto.randomUUID(),
): WorkoutPlan[] {
  return Array.from({ length: count }, (_, index) => ({
    id: makeId(),
    name: `Treino ${planLetter(index)}`,
    description: '',
    notes: '',
    exercises: [],
  }));
}
export function suggestedPlan(state: AdvancedWorkoutState) {
  const rotation = state.rotation;
  return (
    state.plans.find((p) => p.id === rotation?.sequence[rotation.cursor]) ??
    state.plans[0]
  );
}
/** A sequência usa IDs, portanto renomear fichas não muda a rotação. */
export function advanceRotation(
  state: AdvancedWorkoutState,
  planId: string | null,
) {
  if (!state.rotation || !planId) return state.rotation;
  const { sequence, cursor } = state.rotation;
  for (let offset = 0; offset < sequence.length; offset++) {
    const index = (cursor + offset) % sequence.length;
    if (sequence[index] === planId)
      return { sequence, cursor: (index + 1) % sequence.length };
  }
  return state.rotation;
}

export function parseSequence(value: string, plans: WorkoutPlan[]) {
  const letters = value
    .toUpperCase()
    .split(/[\s,;/→>-]+/)
    .filter(Boolean);
  if (!letters.length || letters.length > 200) return null;
  const sequence = letters.map(
    (letter) => plans.find((_, index) => planLetter(index) === letter)?.id,
  );
  return sequence.every((id): id is string => !!id) ? sequence : null;
}
export const sequenceText = (sequence: string[], plans: WorkoutPlan[]) =>
  sequence
    .map((id) => planLetter(plans.findIndex((p) => p.id === id)))
    .join(' → ');
