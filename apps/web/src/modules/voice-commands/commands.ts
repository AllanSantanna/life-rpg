import { DEFAULT_CATEGORY } from '../finances/categories';
import { bookProgress } from '../knowledge/calculations';
import type { LifeRecords, RecordCommand } from '../records/types';
import type {
  ParseContext,
  ParseResult,
  VoiceCommand,
  VoiceDraft,
} from './types';

/** Dados que o interpretador consulta, extraídos dos registros (só leitura). */
export function voiceContext(
  records: LifeRecords,
  today: string,
): ParseContext {
  const byKind = (kind: 'income' | 'expense') => [
    ...new Set([
      ...records.movements
        .filter((item) => item.kind === kind)
        .map((item) => item.category),
      DEFAULT_CATEGORY,
    ]),
  ];
  return {
    today,
    books: records.books.map((book) => {
      const progress = bookProgress(book, records.readings);
      return {
        id: book.id,
        title: book.title,
        remaining: progress.remaining,
        completed: progress.completed,
      };
    }),
    categories: { income: byKind('income'), expense: byKind('expense') },
    sleep: records.sleep,
    workouts: records.workouts,
    completedSessionDates: (records.advancedWorkouts?.sessions ?? [])
      .filter((session) => session.status === 'completed')
      .map((session) => session.date),
  };
}

/** Comando completo, ou `null` enquanto faltar algo ou houver impedimento. */
export function completeCommand(
  result: ParseResult,
  draft: VoiceDraft | null = result.draft,
): VoiceCommand | null {
  if (!draft || result.errors.length) return null;
  const { date } = draft;
  switch (draft.type) {
    case 'finance.expense':
    case 'finance.income':
      return draft.amountCents && draft.description && draft.category
        ? {
            type: draft.type,
            amountCents: draft.amountCents,
            description: draft.description,
            category: draft.category,
            date,
          }
        : null;
    case 'rest.sleep':
      return draft.hours
        ? { type: 'rest.sleep', hours: draft.hours, date }
        : null;
    case 'knowledge.reading':
      return draft.pages && draft.bookId
        ? {
            type: 'knowledge.reading',
            pages: draft.pages,
            bookId: draft.bookId,
            date,
          }
        : null;
    case 'workout.simple':
      return { type: 'workout.simple', date };
  }
}

/**
 * Comando existente do aplicativo para a confirmação. Mesmas regras das
 * páginas: movimentação na carteira única (sem `accountId`), sono por data,
 * leitura com validação de páginas e treino simples por dia.
 */
export function recordCommandFor(
  command: VoiceCommand,
  newId: () => string,
): RecordCommand {
  switch (command.type) {
    case 'finance.expense':
    case 'finance.income':
      return {
        type: 'saveMovement',
        value: {
          id: newId(),
          kind: command.type === 'finance.income' ? 'income' : 'expense',
          description: command.description,
          amountCents: command.amountCents,
          category: command.category,
          date: command.date,
        },
      };
    case 'rest.sleep':
      return {
        type: 'saveSleep',
        value: { date: command.date, hours: command.hours },
      };
    case 'knowledge.reading':
      return {
        type: 'saveReading',
        value: {
          id: newId(),
          bookId: command.bookId,
          pages: command.pages,
          date: command.date,
        },
      };
    case 'workout.simple':
      return {
        type: 'saveWorkout',
        value: { date: command.date, trained: true },
      };
  }
}
