import type { IconName } from '../../shared/components/Icon';
export interface PlayerProgress {
  level: number;
  xp: number;
  xpPerLevel: number;
}
export interface Attribute {
  name: string;
  value: number;
  max: number;
  icon: IconName;
  description: string;
}
export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: string;
  icon: IconName;
  unlocked: boolean;
  progress: string;
}
