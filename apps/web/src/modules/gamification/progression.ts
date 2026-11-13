import type { PlayerProgress } from './types';

// Projeção pura: conserva a fórmula de nível e o XP excedente, sem gravar recompensas.
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
