import type { InputOrder } from '../types';
import type { ImportSet } from './types';

const weight = (v: number | null) =>
  v !== null && Number.isFinite(v) && v >= 0 && v <= 2000;
const reps = (v: number | null) =>
  v !== null && Number.isInteger(v) && v >= 1 && v <= 1000;
export function interpretNumbers(
  first: number | null,
  second: number | null,
  firstKg: boolean,
  secondKg: boolean,
  order: InputOrder,
): Pick<ImportSet, 'weight' | 'reps' | 'needsOrder'> {
  if (firstKg && !secondKg) return { weight: first, reps: second };
  if (secondKg && !firstKg) return { weight: second, reps: first };
  if (!firstKg && !secondKg) {
    if (order === 'weight-reps') return { weight: first, reps: second };
    if (order === 'reps-weight') return { weight: second, reps: first };
    const forward = weight(first) && reps(second);
    const reverse = weight(second) && reps(first);
    if (forward !== reverse)
      return forward
        ? { weight: first, reps: second }
        : { weight: second, reps: first };
  }
  return { weight: null, reps: null, needsOrder: { first, second } };
}
