export const muscleLabels = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quadriceps: 'Quadríceps',
  hamstrings: 'Posteriores de coxa',
  glutes: 'Glúteos',
  calves: 'Panturrilhas',
  core: 'Abdômen',
  forearms: 'Antebraços',
} as const;
export type Muscle = keyof typeof muscleLabels;
export interface Exercise {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  equipment: string;
}
export interface PlanExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: number | null;
  notes: string;
}
export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  notes: string;
  exercises: PlanExercise[];
}
export interface WorkoutSet {
  id: string;
  kind: 'warmup' | 'working';
  weight: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
}
export interface SessionExercise {
  id: string;
  exercise: Exercise;
  notes: string;
  sets: WorkoutSet[];
}
export interface WorkoutSession {
  id: string;
  date: string;
  planId: string | null;
  planName: string;
  exercises: SessionExercise[];
  notes: string;
  status: 'in_progress' | 'completed';
}
export interface AdvancedWorkoutState {
  version: 1;
  enabled: boolean;
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  rotation?: { sequence: string[]; cursor: number };
  importSettings?: { inputOrder: InputOrder; aliases: ExerciseAlias[] };
}
export type InputOrder = 'weight-reps' | 'reps-weight' | 'auto';
export interface ExerciseAlias {
  id: string;
  name: string;
  exerciseId: string;
  planId: string | null;
}
export type AdvancedWorkoutCommand =
  | { type: 'setEnabled'; enabled: boolean }
  | { type: 'saveExercise'; value: Exercise }
  | { type: 'savePlan'; value: WorkoutPlan }
  | { type: 'createDivision'; plans: WorkoutPlan[]; sequence: string[] }
  | { type: 'setRotation'; sequence: string[] }
  | { type: 'duplicatePlan'; id: string; newId: string }
  | { type: 'deletePlan'; id: string; confirmed: boolean }
  | { type: 'startSession'; id: string; planId: string | null; date: string }
  | { type: 'saveSession'; value: WorkoutSession }
  | {
      type: 'importSession';
      value: WorkoutSession;
      expected: WorkoutSession | null;
      aliases?: ExerciseAlias[];
      inputOrder?: InputOrder;
    }
  | { type: 'saveImportAlias'; value: ExerciseAlias }
  | { type: 'deleteImportAlias'; id: string }
  | { type: 'finishSession'; id: string; markDay: boolean }
  | { type: 'deleteSession'; id: string; confirmed: boolean };
export const emptyAdvancedWorkouts = (): AdvancedWorkoutState => ({
  version: 1,
  enabled: false,
  exercises: [],
  plans: [],
  sessions: [],
});
export type AdvancedCommandHandler = (
  command: AdvancedWorkoutCommand,
) => string | null;
