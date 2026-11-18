import type { WorkoutPlan } from '../types';
import { normalizeExerciseName } from './normalize';
import type { WorkoutMetadata } from './types';

export function suggestedPlans(
  metadata: WorkoutMetadata,
  plans: WorkoutPlan[],
): WorkoutPlan[] {
  const words = normalizeExerciseName(metadata.title ?? metadata.division ?? '')
    .split(' ')
    .filter((w) => w && !['treino', 'ficha', 'divisao'].includes(w));
  if (!words.length) return [];
  return plans.filter((p) =>
    words.every((word) =>
      normalizeExerciseName(`${p.name} ${p.description}`)
        .split(' ')
        .includes(word),
    ),
  );
}
