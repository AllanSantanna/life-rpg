import type { Attribute, PlayerProgress } from './types';
import type { Scores } from '../evolution/scoring';
import type { AchievementSources } from './achievements/metrics';
import {
  projectAchievements,
  type AchievementStatus,
} from './achievements/evaluate';
export const startingProgress: PlayerProgress = {
  level: 1,
  xp: 0,
  xpPerLevel: 2000,
};
export function realAttributes(scores: Scores): Attribute[] {
  return [
    { name: 'Força', value: scores.Treinos, icon: 'dumbbell' },
    {
      name: 'Disciplina',
      value: Math.round(
        Object.values(scores).reduce((sum, n) => sum + n, 0) / 4,
      ),
      icon: 'flame',
    },
    { name: 'Conhecimento', value: scores.Conhecimento, icon: 'book' },
    { name: 'Riqueza', value: scores.Finanças, icon: 'wallet' },
  ].map((item) => ({
    ...item,
    icon: item.icon as Attribute['icon'],
    max: 100,
    description: 'Dedicação real nos últimos 7 dias',
  }));
}
/**
 * Conquistas como projeção reversível dos registros, missões e quests: sem
 * bônus de XP, sem estado salvo e sem flags artificiais. Ver `achievements/`.
 */
export function realAchievements(
  sources: AchievementSources,
): AchievementStatus[] {
  return projectAchievements(sources);
}
