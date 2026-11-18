import { exerciseAliases, libraryExercises } from './library';
import { muscleLabels, type Muscle } from './types';
import type { AdvancedWorkoutState, Exercise } from './types';
/** Catálogo próprio; exercícios podem ser complementados pelo usuário. */
export const starterExercises: readonly Exercise[] = [
  {
    id: 'bench',
    name: 'Supino reto',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'Barra',
  },
  {
    id: 'incline',
    name: 'Supino inclinado',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'Halteres',
  },
  {
    id: 'fly',
    name: 'Crucifixo',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'Halteres',
  },
  {
    id: 'row',
    name: 'Remada curvada',
    primary: 'back',
    secondary: ['biceps', 'forearms'],
    equipment: 'Barra',
  },
  {
    id: 'pulldown',
    name: 'Puxada frontal',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'Polia',
  },
  {
    id: 'press',
    name: 'Desenvolvimento',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'Halteres',
  },
  {
    id: 'raise',
    name: 'Elevação lateral',
    primary: 'shoulders',
    secondary: [],
    equipment: 'Halteres',
  },
  {
    id: 'curl',
    name: 'Rosca direta',
    primary: 'biceps',
    secondary: ['forearms'],
    equipment: 'Barra',
  },
  {
    id: 'triceps',
    name: 'Tríceps na polia',
    primary: 'triceps',
    secondary: [],
    equipment: 'Polia',
  },
  {
    id: 'squat',
    name: 'Agachamento livre',
    primary: 'quadriceps',
    secondary: ['glutes', 'core'],
    equipment: 'Barra',
  },
  {
    id: 'legpress',
    name: 'Leg press',
    primary: 'quadriceps',
    secondary: ['glutes'],
    equipment: 'Máquina',
  },
  {
    id: 'extension',
    name: 'Cadeira extensora',
    primary: 'quadriceps',
    secondary: [],
    equipment: 'Máquina',
  },
  {
    id: 'legcurl',
    name: 'Mesa flexora',
    primary: 'hamstrings',
    secondary: [],
    equipment: 'Máquina',
  },
  {
    id: 'deadlift',
    name: 'Levantamento terra',
    primary: 'hamstrings',
    secondary: ['glutes', 'back', 'forearms'],
    equipment: 'Barra',
  },
  {
    id: 'hipthrust',
    name: 'Elevação pélvica',
    primary: 'glutes',
    secondary: ['hamstrings'],
    equipment: 'Barra',
  },
  {
    id: 'calf',
    name: 'Elevação de panturrilhas',
    primary: 'calves',
    secondary: [],
    equipment: 'Máquina',
  },
  {
    id: 'crunch',
    name: 'Abdominal',
    primary: 'core',
    secondary: [],
    equipment: 'Peso corporal',
  },
];
export const exerciseCatalog = (state: AdvancedWorkoutState) => [
  ...starterExercises,
  ...libraryExercises.filter(
    (e) =>
      !state.exercises.some(
        (custom) =>
          custom.id === e.id ||
          normalizedName(custom.name) === normalizedName(e.name),
      ),
  ),
  ...state.exercises,
];
export const normalizedName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');

export function searchExercises(
  catalog: readonly Exercise[],
  query: string,
  muscle = '',
  equipment = '',
) {
  const words = normalizedName(query).split(' ').filter(Boolean);
  return catalog.filter(
    (e) =>
      (!muscle || e.primary === muscle) &&
      (!equipment || e.equipment === equipment) &&
      words.every((word) =>
        normalizedName(
          `${e.name} ${exerciseAliases[e.id] ?? ''} ${muscleLabels[e.primary as Muscle]} ${e.equipment}`,
        ).includes(word),
      ),
  );
}
export function recentExercises(state: AdvancedWorkoutState) {
  const catalog = exerciseCatalog(state);
  const ids = [
    ...new Set(
      [...state.sessions]
        .reverse()
        .sort((a, b) => b.date.localeCompare(a.date))
        .flatMap((s) => s.exercises.map((e) => e.exercise.id)),
    ),
  ];
  return ids
    .flatMap((id) => {
      const e = catalog.find((e) => e.id === id);
      return e ? [e] : [];
    })
    .slice(0, 6);
}
