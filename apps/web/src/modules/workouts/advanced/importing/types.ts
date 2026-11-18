import type { ExerciseAlias, InputOrder, WorkoutSet } from '../types';

export type MatchSource = 'plan' | 'alias' | 'catalog' | 'manual';
export interface ImportSet extends WorkoutSet {
  needsOrder?: { first: number | null; second: number | null } | undefined;
}
export interface MatchContext {
  aliases?: ExerciseAlias[];
  planId?: string | null;
}
export interface ParseOptions extends MatchContext {
  inputOrder?: InputOrder;
  titles?: string[];
}
export interface WorkoutMetadata {
  title: string | null;
  division: string | null;
  dates: string[];
  partialDates: string[];
}

export type ConflictChoice = '' | 'keep' | 'replace' | 'append';
export interface ImportExercise {
  id: string;
  sourceName: string;
  exerciseId: string | null;
  alternatives: string[];
  sets: ImportSet[];
  conflict: ConflictChoice;
  source?: MatchSource;
  manuallyConfirmed?: boolean;
  rememberName?: boolean;
}
export interface ParsedWorkout {
  exercises: ImportExercise[];
  warnings: string[];
  metadata?: WorkoutMetadata;
  originalText?: string;
}
export type ImportTarget =
  | { sessionId: string; date?: string }
  | { planId: string | null; date: string };
