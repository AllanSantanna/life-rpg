import type { MissionCategory } from '../missions/types';
import type { Scores } from '../evolution/scoring';

export type Pillar = MissionCategory;
export type Intensity = 0 | 1 | 2 | 3 | 4;
export interface PillarActivity {
  intensity: Intensity;
  details: string[];
}
export interface ActivityDay {
  date: string;
  trained: boolean;
  pillars: Record<Pillar, PillarActivity>;
}
export type ActivityIndex = ReadonlyMap<string, ActivityDay>;
export interface EvolutionPoint {
  date: string;
  scores: Scores;
  previous: Scores;
  comparable: Record<Pillar, boolean>;
}
export type LandscapeMode = 'landscape' | 'bars' | 'surface';
export interface PillarSummary {
  area: Pillar;
  score: number;
  previous: number;
  comparable: boolean;
  hasEffort: boolean;
  days: number;
  trainedDays: number;
  consistency: number;
}
