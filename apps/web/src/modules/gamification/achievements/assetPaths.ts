/**
 * Assets de conquistas usados pela interface, relativos a `public/`.
 *
 * Módulo sem dependências: o `vite.config.ts` também o importa para colocar no
 * precache da PWA **somente** estes WebP (a prancha, a pré-visualização, os PNG
 * e os assets não usados ficam fora). Consulte o manifesto em
 * `public/assets/achievements/manifest.json` para dimensões e estados.
 */
export const ACHIEVEMENT_ASSET_ROOT = 'assets/achievements/';

export const achievementMedalAssets = [
  'specific/achievement-training-01.webp',
  'specific/achievement-training-02.webp',
  'specific/achievement-training-03.webp',
  'specific/achievement-training-04.webp',
  'specific/achievement-training-05.webp',
  'specific/achievement-knowledge-01.webp',
  'specific/achievement-knowledge-02.webp',
  'specific/achievement-knowledge-03.webp',
  'specific/achievement-knowledge-04.webp',
  'specific/achievement-knowledge-05.webp',
  'specific/achievement-finances-01.webp',
  'specific/achievement-finances-03.webp',
  'specific/achievement-finances-04.webp',
  'specific/achievement-finances-05.webp',
  'specific/achievement-rest-01.webp',
  'specific/achievement-rest-02.webp',
  'specific/achievement-rest-03.webp',
  'specific/achievement-rest-04.webp',
  'specific/achievement-rest-05.webp',
  'icons/icon-training.webp',
  'icons/icon-finances.webp',
  'icons/icon-rest.webp',
  'icons/icon-quests.webp',
  'icons/icon-milestone.webp',
  'icons/icon-achievement.webp',
  'badges/badge-common.webp',
  'badges/badge-uncommon.webp',
  'badges/badge-rare.webp',
  'badges/badge-epic.webp',
  'badges/badge-legendary.webp',
] as const;
export type AchievementMedalAsset = (typeof achievementMedalAssets)[number];

/** Peças de apresentação: cadeado, efeitos, molduras e etiquetas de raridade. */
export const achievementDecorAssets = [
  'ui/ui-locked.webp',
  'effects/effect-particles.webp',
  'effects/effect-shine.webp',
  'effects/effect-unlock.webp',
  'frames/frame-common.webp',
  'frames/frame-uncommon.webp',
  'frames/frame-rare.webp',
  'frames/frame-epic.webp',
  'frames/frame-legendary.webp',
  'labels/label-common.webp',
  'labels/label-uncommon.webp',
  'labels/label-rare.webp',
  'labels/label-epic.webp',
  'labels/label-legendary.webp',
] as const;
export type AchievementDecorAsset = (typeof achievementDecorAssets)[number];

export const achievementAssetPaths: readonly string[] = [
  ...achievementMedalAssets,
  ...achievementDecorAssets,
].map((path) => ACHIEVEMENT_ASSET_ROOT + path);
