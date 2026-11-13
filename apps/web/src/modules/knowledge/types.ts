export interface Book {
  id: string;
  title: string;
  totalPages: number;
}
export interface ReadingEntry {
  id: string;
  bookId: string;
  date: string;
  pages: number;
}
