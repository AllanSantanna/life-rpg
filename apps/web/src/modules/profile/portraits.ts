import type { ClassId } from './classes';

// Vite emits hashed local URLs and applies the production base (/life-rpg/).
// Uma única arte por classe e estágio: a carta de fantasia sombria (com moldura)
// serve ao retrato do Início/Perfil e à galeria. A arte pixelada anterior fica em
// assets/legacy/, fora deste glob e do bundle.
const images = import.meta.glob<string>('./assets/cards/*/*.webp', {
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
export const characterNames = {
  aventureiro: 'Aventureiro',
  guerreiro: 'Guerreiro',
  estrategista: 'Estrategista',
  guardiao: 'Guardião',
  sabio: 'Sábio',
  mestre: 'Mestre',
} as const;
/** Visual slug: the five real classes plus the Aventureiro art for `null`. */
export type PortraitCharacter = keyof typeof characterNames;
export const portraitStages = {
  1: 'Inicial',
  2: 'Experiente',
  3: 'Avançado',
  4: 'Elite',
} as const;
export type PortraitStage = keyof typeof portraitStages;
/** Inclusive level ranges of each visual stage; `max: null` means no limit. */
export const stageLevels = {
  1: { min: 1, max: 4 },
  2: { min: 5, max: 9 },
  3: { min: 10, max: 19 },
  4: { min: 20, max: null },
} as const satisfies Record<PortraitStage, { min: number; max: number | null }>;
export const stageNumerals = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' } as const;
export const allStages = [1, 2, 3, 4] as const satisfies PortraitStage[];

/** Presentation only: consumes the projected level, never computes XP or class. */
export function portraitStage(level: number): PortraitStage {
  if (level >= stageLevels[4].min) return 4;
  if (level >= stageLevels[3].min) return 3;
  if (level >= stageLevels[2].min) return 2;
  return 1;
}
/** Aventureiro is a visual fallback for null, not a new domain class. */
export function portraitCharacter(classId: ClassId | null): PortraitCharacter {
  return classId === null ? 'aventureiro' : portraitClasses[classId];
}

// Dimensões intrínsecas das cartas extraídas (sem reamostragem); ver
// assets/previews/characters-report.json.
const cardDimensions = {
  aventureiro: [
    [191, 267],
    [183, 267],
    [179, 267],
    [175, 267],
  ],
  guerreiro: [
    [180, 267],
    [179, 267],
    [180, 267],
    [184, 267],
  ],
  estrategista: [
    [191, 267],
    [181, 267],
    [178, 267],
    [175, 267],
  ],
  guardiao: [
    [178, 267],
    [177, 267],
    [180, 267],
    [184, 267],
  ],
  sabio: [
    [193, 264],
    [183, 264],
    [178, 264],
    [177, 264],
  ],
  mestre: [
    [177, 264],
    [177, 264],
    [178, 264],
    [180, 264],
  ],
} as const satisfies Record<
  PortraitCharacter,
  readonly (readonly [number, number])[]
>;

/** Carta de uma classe e estágio: URL e dimensões intrínsecas. */
export function characterCard(
  character: PortraitCharacter,
  stage: PortraitStage,
) {
  const source = `./assets/cards/${character}/${character}-nivel-${stage}.webp`;
  const src = images[source];
  if (!src) throw new Error(`Carta local ausente: ${source}`);
  const [width, height] = cardDimensions[character][stage - 1]!;
  return { src, width, height };
}

export function playerPortrait(classId: ClassId | null, level: number) {
  const character = portraitCharacter(classId);
  const stage = portraitStage(level);
  return {
    ...characterCard(character, stage),
    character,
    stage,
    className: characterNames[character],
  };
}
