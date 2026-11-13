import type { Book, ReadingEntry } from './types';
import { inLastDays } from '../records/dates';
export function bookProgress(book: Book, readings: readonly ReadingEntry[]) {
  const pages = readings
    .filter((item) => item.bookId === book.id)
    .reduce((sum, item) => sum + item.pages, 0);
  return {
    pages,
    remaining: book.totalPages - pages,
    percent: Math.round((pages / book.totalPages) * 100),
    completed: pages === book.totalPages,
  };
}
export function readingStats(
  books: readonly Book[],
  readings: readonly ReadingEntry[],
  today: string,
) {
  return {
    total: readings.reduce((sum, entry) => sum + entry.pages, 0),
    weekly: readings
      .filter((entry) => inLastDays(entry.date, today, 7))
      .reduce((sum, entry) => sum + entry.pages, 0),
    monthly: readings
      .filter(
        (entry) =>
          entry.date.startsWith(today.slice(0, 7)) && entry.date <= today,
      )
      .reduce((sum, entry) => sum + entry.pages, 0),
    completed: books.filter((book) => bookProgress(book, readings).completed)
      .length,
  };
}
