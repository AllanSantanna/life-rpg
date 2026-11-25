import type { SaveOutcome } from '../../../records/types';
import type { AdvancedWorkoutCommand, WorkoutSession } from '../types';
import { importConflict } from './sessionIntegration';
import type { ImportExercise } from './types';

/** Resumo do que um comando de importação grava; nada é persistido aqui. */
export interface ImportReceipt {
  sessionId: string;
  name: string;
  date: string;
  status: WorkoutSession['status'];
  /** Exercícios que receberam séries nesta importação. */
  exercises: number;
  /** Séries escritas por esta importação (novas ou substituídas). */
  sets: number;
  /** Séries planejadas da sessão que continuam sem preenchimento. */
  pendingSets: number;
}

/**
 * Espelha as regras de `prepareWorkoutImport`: “manter” não escreve séries,
 * “acrescentar” conta só as séries novas e substituição/novo exercício contam
 * as séries resultantes. Assim a confirmação reflete exatamente o comando.
 */
export function importReceipt(
  command: Extract<AdvancedWorkoutCommand, { type: 'importSession' }>,
  rows: readonly ImportExercise[],
): ImportReceipt {
  const { value, expected } = command;
  let exercises = 0;
  let sets = 0;
  for (const row of rows) {
    const entry = value.exercises.find((e) => e.exercise.id === row.exerciseId);
    if (!entry) continue;
    const conflict = importConflict(expected ?? undefined, row.exerciseId);
    if (conflict && row.conflict === 'keep') continue;
    const written =
      conflict && row.conflict === 'append'
        ? entry.sets.length - conflict.sets.length
        : entry.sets.length;
    if (written <= 0) continue;
    exercises += 1;
    sets += written;
  }
  return {
    sessionId: value.id,
    name: value.planName,
    date: value.date,
    status: value.status,
    exercises,
    sets,
    pendingSets: value.exercises
      .flatMap((e) => e.sets)
      .filter((s) => !s.completed).length,
  };
}

/** Mensagens quando a importação foi aplicada, mas não confirmada no armazenamento. */
export const importSaveErrors: Record<Exclude<SaveOutcome, 'saved'>, string> = {
  failed:
    'Não foi possível confirmar a gravação neste navegador. O treino continua apenas nesta sessão; consulte o aviso de armazenamento antes de fechar a página.',
  conflict:
    'A importação não foi salva porque os registros foram alterados em outra aba. Siga o aviso de armazenamento para carregar os registros atuais.',
};
