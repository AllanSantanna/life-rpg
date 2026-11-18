import { starterExercises } from './catalog';
import {
  emptyAdvancedWorkouts,
  type AdvancedWorkoutState,
  type WorkoutSession,
  type WorkoutSet,
} from './types';
export const testDate = '2026-11-13';
export function testSet(
  id: string,
  weight = 20,
  reps = 10,
  kind: WorkoutSet['kind'] = 'working',
  rir: number | null = null,
): WorkoutSet {
  return { id, weight, reps, kind, rir, completed: true };
}
export function testSession(
  id: string,
  date = testDate,
  sets = [testSet('s1')],
  exerciseId = 'bench',
): WorkoutSession {
  return {
    id,
    date,
    planId: null,
    planName: 'Treino A',
    status: 'completed',
    notes: 'Observação',
    exercises: [
      {
        id: `${id}:exercise`,
        exercise: structuredClone(
          starterExercises.find((e) => e.id === exerciseId)!,
        ),
        notes: '',
        sets,
      },
    ],
  };
}
export function testState(): AdvancedWorkoutState {
  return {
    ...emptyAdvancedWorkouts(),
    enabled: true,
    sessions: [testSession('one')],
  };
}
