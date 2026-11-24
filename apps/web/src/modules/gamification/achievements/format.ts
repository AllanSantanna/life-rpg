import { displayDate } from '../../records/dates';
import { ACHIEVEMENT_ASSET_ROOT } from './assetPaths';
import type { AchievementStatus } from './evaluate';

/** URL pública de um asset de conquista, respeitando a base do GitHub Pages. */
export function achievementAsset(path: string) {
  return `${import.meta.env.BASE_URL}${ACHIEVEMENT_ASSET_ROOT}${path}`;
}

/** Data pelos registros; ausente quando não puder ser determinada. */
export function unlockedOnLabel(status: AchievementStatus) {
  return status.unlockedOn
    ? `Conquistada em ${displayDate(status.unlockedOn)}`
    : 'Conquistada · data não determinável pelos registros';
}
