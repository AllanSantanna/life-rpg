import type { IconName } from '../../shared/components/Icon';
export type MissionCategory =
  'Treinos' | 'Conhecimento' | 'Finanças' | 'Descanso';
export interface Mission {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  icon: IconName;
  xp: number;
  completed: boolean;
}
export type MissionFilter = 'all' | 'pending' | 'done';
