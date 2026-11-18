import { isWorkoutSet } from '../validation';
import type { ImportSet } from './types';

export function importSetErrors(set: ImportSet): string[] {
  const errors: string[] = [];
  if (set.needsOrder) errors.push('Escolha a ordem dos números desta série.');
  if (set.weight === null)
    errors.push('Informe a carga; use 0 para ausência de carga externa.');
  else if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 2000)
    errors.push('Carga deve estar entre 0 e 2.000 kg.');
  if (set.reps === null) errors.push('Informe as repetições.');
  else if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > 1000)
    errors.push('Repetições devem ser inteiras de 1 a 1.000.');
  if (
    set.rir !== null &&
    (!Number.isInteger(set.rir) || set.rir < 0 || set.rir > 10)
  )
    errors.push('RIR deve ser inteiro de 0 a 10 ou ficar vazio.');
  return errors;
}
export const isImportSetValid = (set: ImportSet) =>
  isWorkoutSet(set) && importSetErrors(set).length === 0;
