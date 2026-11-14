import type { MissionCategory } from '../missions/types';
export const goalPillars = [
  'Finanças',
  'Treinos',
  'Descanso',
  'Conhecimento',
  'Geral',
] as const;
export type GoalPillar = MissionCategory | 'Geral';
export const metrics = {
  workouts: { label: 'Dias treinados', pillar: 'Treinos', unit: 'dias' },
  pages: { label: 'Páginas lidas', pillar: 'Conhecimento', unit: 'páginas' },
  sleep: {
    label: 'Horas de sono registradas (soma)',
    pillar: 'Descanso',
    unit: 'horas',
  },
  contributions: {
    label: 'Aportes reais em investimentos',
    pillar: 'Finanças',
    unit: 'reais',
  },
  income: { label: 'Receitas registradas', pillar: 'Finanças', unit: 'reais' },
  expenses: {
    label: 'Despesas registradas',
    pillar: 'Finanças',
    unit: 'reais',
  },
  net: {
    label: 'Resultado: receitas menos despesas',
    pillar: 'Finanças',
    unit: 'reais',
  },
  cash: {
    label: 'Dinheiro disponível nas contas',
    pillar: 'Finanças',
    unit: 'reais',
  },
  wealth: {
    label: 'Patrimônio financeiro total',
    pillar: 'Finanças',
    unit: 'reais',
  },
  investments: {
    label: 'Valor dos investimentos',
    pillar: 'Finanças',
    unit: 'reais',
  },
} as const;
export type GoalMetric = keyof typeof metrics;
export type GoalCadence = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
export interface GoalDefinition {
  title: string;
  description: string;
  pillar: GoalPillar;
  kind: 'quantity' | 'completion';
  target: number;
  unit: string;
  startDate: string;
  deadline: string | null;
  cadence: GoalCadence;
  customDays: number;
  tracking: 'manual' | 'automatic';
  metric: GoalMetric | null;
  difficulty: 'easy' | 'medium' | 'hard';
}
export interface Goal extends GoalDefinition {
  id: string;
  createdDate: string;
  deletedOn: string | null;
  pauses: { from: string; to: string | null }[];
  revisions: { date: string; definition: GoalDefinition }[];
}
/** Valores quantitativos em milésimos da unidade, sem acumular recompensas. */
export interface GoalUpdate {
  unit?: string;
  scope?: string;
  id: string;
  goalId: string;
  date: string;
  value: number;
}
export interface GoalState {
  items: Goal[];
  updates: GoalUpdate[];
}
export const emptyGoals = (): GoalState => ({ items: [], updates: [] });
export type GoalCommand =
  | { type: 'save'; id: string; definition: GoalDefinition }
  | { type: 'delete'; id: string; confirmed: boolean }
  | { type: 'pause' | 'resume'; id: string }
  | { type: 'update'; value: GoalUpdate }
  | { type: 'deleteUpdate'; id: string };
export const difficultyXP = { easy: 10, medium: 25, hard: 50 } as const;
