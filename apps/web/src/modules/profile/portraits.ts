import type { ClassId } from './classes';

// Vite emits hashed local URLs and applies the production base (/life-rpg/).
const images = import.meta.glob<string>('./assets/portraits/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const portraitClasses = {
  warrior: 'guerreiro',
  strategist: 'estrategista',
  guardian: 'guardiao',
  sage: 'sabio',
  master: 'mestre',
} as const satisfies Record<ClassId, string>;
const classNames = {
  aventureiro: 'Aventureiro',
  guerreiro: 'Guerreiro',
  estrategista: 'Estrategista',
  guardiao: 'Guardião',
  sabio: 'Sábio',
  mestre: 'Mestre',
} as const;
export const portraitStages = {
  1: 'Inicial',
  2: 'Experiente',
  3: 'Avançado',
  4: 'Elite',
} as const;
export type PortraitStage = keyof typeof portraitStages;

/** Presentation only: consumes the projected level, never computes XP or class. */
export function portraitStage(level: number): PortraitStage {
  if (level >= 20) return 4;
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

// Original intrinsic dimensions; no resizing or re-encoding of the supplied art.
const dimensions = {
  aventureiro: [
    [180, 172],
    [178, 172],
    [180, 172],
    [175, 172],
  ],
  guerreiro: [
    [183, 172],
    [181, 172],
    [181, 172],
    [193, 172],
  ],
  estrategista: [
    [180, 168],
    [178, 168],
    [180, 168],
    [175, 168],
  ],
  guardiao: [
    [183, 168],
    [181, 168],
    [181, 168],
    [193, 168],
  ],
  sabio: [
    [180, 173],
    [178, 173],
    [180, 173],
    [175, 173],
  ],
  mestre: [
    [183, 173],
    [181, 173],
    [181, 173],
    [193, 173],
  ],
} as const;

export function playerPortrait(classId: ClassId | null, level: number) {
  // Aventureiro is a visual fallback for null, not a new domain class.
  const character = classId === null ? 'aventureiro' : portraitClasses[classId];
  const stage = portraitStage(level);
  const source = `./assets/portraits/${character}/${character}-nivel-${stage}.webp`;
  const src = images[source];
  if (!src) throw new Error(`Retrato local ausente: ${source}`);
  const [width, height] = dimensions[character][(stage - 1) as 0 | 1 | 2 | 3];
  return {
    src,
    width,
    height,
    character,
    stage,
    className: classNames[character],
  };
}
