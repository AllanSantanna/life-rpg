import { front } from './anatomy/front';
import { back } from './anatomy/back';
import frontImage from './anatomy/front.webp';
import backImage from './anatomy/back.webp';
import type { Muscle } from '../types';

/** Broad domain groups remain unchanged. Never invent a more specific training record. */
export const anatomicalGroups = {
  CHEST: 'chest',
  SHOULDERS_FRONT: 'shoulders',
  SHOULDERS_SIDE: 'shoulders',
  SHOULDERS_REAR: 'shoulders',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  TRAPEZIUS: 'trapezius',
  LATS: 'back',
  RHOMBOIDS: 'back',
  BACK_LOWER: 'back',
  CORE: 'core',
  OBLIQUES: 'core',
  GLUTES: 'glutes',
  QUADS: 'quadriceps',
  HAMSTRINGS: 'hamstrings',
  CALVES: 'calves',
  ADDUCTORS: null,
  ABDUCTORS: null,
} satisfies Record<string, Muscle | null>;
export const anatomicalLabels: Record<keyof typeof anatomicalGroups, string> = {
  CHEST: 'Peitoral',
  SHOULDERS_FRONT: 'Deltoide anterior',
  SHOULDERS_SIDE: 'Deltoide lateral',
  SHOULDERS_REAR: 'Deltoide posterior',
  BICEPS: 'Bíceps',
  TRICEPS: 'Tríceps',
  FOREARMS: 'Antebraço',
  TRAPEZIUS: 'Trapézio',
  LATS: 'Dorsal',
  RHOMBOIDS: 'Romboides',
  BACK_LOWER: 'Lombar',
  CORE: 'Abdômen',
  OBLIQUES: 'Oblíquos',
  GLUTES: 'Glúteo',
  QUADS: 'Quadríceps',
  HAMSTRINGS: 'Posterior de coxa',
  CALVES: 'Panturrilha',
  ADDUCTORS: 'Adutores',
  ABDUCTORS: 'Abdutores',
};
export const diagrams = {
  front: { ...front, image: frontImage, label: 'Frontal' },
  back: { ...back, image: backImage, label: 'Traseira' },
};
export type MapView = keyof typeof diagrams;
export type Surface =
  (typeof front.surfaces)[number] | (typeof back.surfaces)[number];
export interface Selection {
  view: MapView;
  id: string;
}
export function findSurface(selection: Selection): Surface {
  return (
    diagrams[selection.view].surfaces.find((s) => s.id === selection.id) ??
    front.surfaces[2]
  );
}
