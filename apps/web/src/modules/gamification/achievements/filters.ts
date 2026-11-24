import type { AchievementGroup, AchievementRarity } from './catalog';
import type { AchievementStatus } from './evaluate';

export interface AchievementFilters {
  group: AchievementGroup | 'all';
  rarity: AchievementRarity | 'all';
  state: 'all' | 'unlocked' | 'locked';
}
export const defaultAchievementFilters: AchievementFilters = {
  group: 'all',
  rarity: 'all',
  state: 'all',
};

export function filterAchievements(
  statuses: readonly AchievementStatus[],
  filters: AchievementFilters,
) {
  return statuses.filter(
    (status) =>
      (filters.group === 'all' || status.group === filters.group) &&
      (filters.rarity === 'all' || status.rarity === filters.rarity) &&
      (filters.state === 'all' ||
        (filters.state === 'unlocked') === status.unlocked),
  );
}
