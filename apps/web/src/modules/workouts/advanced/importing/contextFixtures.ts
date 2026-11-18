import { exerciseCatalog } from '../catalog';
import { testState } from '../testFixtures';
import type { AdvancedWorkoutState } from '../types';

export function chestState(): AdvancedWorkoutState {
  const state = testState();
  state.exercises = [
    {
      id: 'my-cross',
      name: 'Crossover na polia alta',
      primary: 'chest',
      secondary: [],
      equipment: 'Polia',
    },
  ];
  state.plans = [
    {
      id: 'chest',
      name: 'Peito',
      description: 'Treino A',
      notes: 'Ficha permanente',
      exercises: [
        'library:pec-deck',
        'my-cross',
        'library:bench-machine',
        'raise',
        'triceps',
        'press',
      ].map((exerciseId, index) => ({
        id: `slot-${index}`,
        exerciseId,
        sets: 3,
        reps: 10,
        notes: '',
      })),
    },
  ];
  state.rotation = { sequence: ['chest'], cursor: 0 };
  return state;
}
export const chestNotes =
  'Crucifixo\n40x13\n40x6\n50x8\n\nCross\n40x8\n50x6\n60x6\n\nSupino máquina\n40x8\n60x6\n84x5';
export const whatsappNotes =
  '[17/11, 14:43] Allan Paulo: Peito\n[17/11, 14:43] Allan Paulo: Crucifixo\n[17/11, 14:45] Allan Paulo: 13 x 40 kg\n[17/11, 14:46] Allan Paulo: 6 x 40\n[17/11, 14:48] Allan Paulo: 8 x 50\n[17/11, 14:48] Allan Paulo: Cross\n[17/11, 14:49] Allan Paulo: 8 x 40\n[17/11, 14:50] Allan Paulo: 6 x 50\n[17/11, 14:52] Allan Paulo: 6 x 60';
export const chestCatalog = () => exerciseCatalog(chestState());
