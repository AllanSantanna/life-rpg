import type { PlayerProgress } from './types';

// Projeção visual da sessão; não representa as regras definitivas de progressão.
export function projectProgress(
  initial: PlayerProgress,
  xpDelta: number,
): PlayerProgress {
  const total = Math.max(0, initial.xp + xpDelta);
  return {
    ...initial,
    level: initial.level + Math.floor(total / initial.xpPerLevel),
    xp: total % initial.xpPerLevel,
  };
}
