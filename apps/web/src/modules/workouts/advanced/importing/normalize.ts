import { normalizedName } from '../catalog';

/** Reuse the catalog's accent/case normalization; omit only connecting words. */
export const normalizeExerciseName = (value: string) =>
  normalizedName(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) => word && !['de', 'da', 'do', 'na', 'no', 'com'].includes(word),
    )
    .join(' ');
