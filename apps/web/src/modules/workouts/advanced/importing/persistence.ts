import { isDate } from '../../../records/dates';
import type {
  AdvancedWorkoutState,
  ExerciseAlias,
  InputOrder,
  WorkoutSession,
} from '../types';
import { saveImportAlias } from './aliases';
import { assertStartNotFuture, sessionTime } from '../sessionTiming';

/** Atomic commit through the existing command/storage path. No daily/RPG command. */
export function commitWorkoutImport(
  state: AdvancedWorkoutState,
  value: WorkoutSession,
  expected: WorkoutSession | null,
  today: string,
  aliases: ExerciseAlias[] = [],
  inputOrder?: InputOrder,
): AdvancedWorkoutState {
  if (!isDate(value.date) || value.date > today)
    throw new Error('Informe uma data válida até hoje.');
  const actual = state.sessions.find((s) => s.id === value.id) ?? null;
  // M-01: a importação segue a regra do registro manual. Mudar a data de uma
  // sessão com horário pode levar o início ao futuro; nesse caso, recusar.
  if (value.startedAt !== undefined && value.startedAt !== actual?.startedAt)
    try {
      assertStartNotFuture(value.startedAt);
    } catch {
      throw new Error(
        `Com esta data, o início registrado (${sessionTime(value)}) ficaria no futuro. Escolha outra data ou corrija o horário da sessão antes de importar.`,
      );
    }
  // Retrying the same confirmed command is a no-op, including after a reload.
  const alreadyApplied = JSON.stringify(actual) === JSON.stringify(value);
  if (!alreadyApplied && JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      'A sessão mudou desde a prévia. Confira o destino e interprete novamente.',
    );
  }
  let next: AdvancedWorkoutState = alreadyApplied
    ? state
    : {
        ...state,
        sessions: actual
          ? state.sessions.map((session) =>
              session.id === value.id ? value : session,
            )
          : [...state.sessions, value],
      };
  for (const alias of aliases) next = saveImportAlias(next, alias);
  if (inputOrder)
    next = {
      ...next,
      importSettings: {
        aliases: next.importSettings?.aliases ?? [],
        inputOrder,
      },
    };
  return next;
}
