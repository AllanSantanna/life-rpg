import { DEFAULT_CATEGORY } from '../finances/categories';
import { bookProgress } from '../knowledge/calculations';
import type { LifeRecords, RecordCommand } from '../records/types';
import { displayDate } from '../../shared/dates/calendar';
import type {
  ParseContext,
  VoiceCommand,
  VoiceDraft,
  VoiceField,
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

export interface DraftIssue {
  field: VoiceField;
  message: string;
}

/**
 * Validação do rascunho antes da confirmação, com as mesmas regras dos
 * módulos (o comando existente valida de novo ao gravar). Cada pendência
 * aponta o campo, para o cartão destacá-lo e levar o foco até ele.
 */
export function validateDraft(
  draft: VoiceDraft,
  context: ParseContext,
): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (field: VoiceField, message: string) =>
    issues.push({ field, message });
  if (draft.date > context.today)
    add('date', `A data ${displayDate(draft.date)} está no futuro.`);
  switch (draft.type) {
    case 'finance.expense':
    case 'finance.income':
      if (draft.kindPending) add('kind', 'Escolha se é despesa ou receita.');
      if (!draft.description?.trim())
        add('description', 'Informe a descrição.');
      if (!draft.amountCents || draft.amountCents <= 0)
        add('amount', 'Informe um valor maior que zero.');
      if (!draft.category?.trim()) add('category', 'Escolha a categoria.');
      break;
    case 'rest.sleep':
      if (draft.hours === undefined) add('hours', 'Informe as horas dormidas.');
      else if (!(draft.hours > 0 && draft.hours <= 24))
        add('hours', 'As horas dormidas devem estar entre 0 e 24.');
      break;
    case 'knowledge.reading': {
      if (!context.books.some((book) => !book.completed))
        add(
          'book',
          'Nenhum livro em andamento. Cadastre um livro em Ações rápidas › Leitura.',
        );
      else if (!draft.bookId) add('book', 'Escolha o livro.');
      const book = context.books.find((item) => item.id === draft.bookId);
      if (book?.completed)
        add('book', `O livro “${book.title}” já foi concluído.`);
      if (draft.pages === undefined) add('pages', 'Informe as páginas lidas.');
      else if (!Number.isInteger(draft.pages) || draft.pages <= 0)
        add('pages', 'Informe uma quantidade de páginas maior que zero.');
      else if (book && !book.completed && draft.pages > book.remaining)
        add(
          'pages',
          `A leitura ultrapassa o total de páginas do livro (restam ${book.remaining}).`,
        );
      break;
    }
    case 'workout.simple':
      if (
        context.workouts.some(
          (item) => item.date === draft.date && item.trained,
        )
      )
        add(
          'date',
          `O treino de ${displayDate(draft.date)} já está registrado. Escolha outra data ou cancele.`,
        );
      break;
  }
  return issues;
}

/** Comando completo, ou `null` enquanto houver pendências. */
export function completeCommand(
  draft: VoiceDraft | null,
  context: ParseContext,
): VoiceCommand | null {
  if (!draft || validateDraft(draft, context).length) return null;
  const { date } = draft;
  switch (draft.type) {
    case 'finance.expense':
    case 'finance.income':
      return {
        type: draft.type,
        amountCents: draft.amountCents!,
        description: draft.description!.trim(),
        category: draft.category!.trim(),
        date,
      };
    case 'rest.sleep':
      return { type: 'rest.sleep', hours: draft.hours!, date };
    case 'knowledge.reading':
      return {
        type: 'knowledge.reading',
        pages: draft.pages!,
        bookId: draft.bookId!,
        date,
      };
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
