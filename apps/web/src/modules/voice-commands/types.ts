/**
 * Tipos do comando por voz. O interpretador só produz rascunhos: nada aqui
 * grava dados. A gravação acontece depois da confirmação, pelos comandos
 * existentes dos módulos (`RecordCommand`).
 */
export type VoiceIntent =
  | 'finance.expense'
  | 'finance.income'
  | 'rest.sleep'
  | 'knowledge.reading'
  | 'workout.simple';

/** Comando completo, pronto para a confirmação. */
export type VoiceCommand =
  | {
      type: 'finance.expense' | 'finance.income';
      amountCents: number;
      description: string;
      category: string;
      date: string;
    }
  | { type: 'rest.sleep'; hours: number; date: string }
  | { type: 'knowledge.reading'; pages: number; bookId: string; date: string }
  | { type: 'workout.simple'; date: string };

/** Dados extraídos da frase; campos ausentes ficam `undefined`. */
export interface VoiceDraft {
  type: VoiceIntent;
  date: string;
  /** Data dita na frase (`false` quando assumiu hoje). */
  dateSpoken: boolean;
  amountCents?: number;
  /** Explicação de um valor composto, ex.: “3 × R$ 10,00”. */
  amountDetail?: string;
  description?: string;
  category?: string;
  hours?: number;
  pages?: number;
  bookId?: string;
  /** Título falado que não identificou um único livro. */
  bookSpoken?: string;
  /** Livros possíveis quando a escolha é manual. */
  bookCandidates?: string[];
}

export type VoiceField =
  'amount' | 'description' | 'category' | 'hours' | 'pages' | 'book';

export interface ParseResult {
  /** Texto original, sem alterações. */
  text: string;
  draft: VoiceDraft | null;
  /** Campos obrigatórios que a frase não informou. */
  missing: VoiceField[];
  /** Pontos que exigem escolha do usuário (nada é escolhido ao acaso). */
  ambiguities: string[];
  /** Impedem a confirmação (ex.: data futura, páginas acima do total). */
  errors: string[];
  /** Informações para a revisão (ex.: registro existente na data). */
  notes: string[];
}

/** Dados do aplicativo usados para interpretar (somente leitura). */
export interface ParseContext {
  today: string;
  books: readonly {
    id: string;
    title: string;
    remaining: number;
    completed: boolean;
  }[];
  /** Categorias existentes por tipo (derivadas do histórico). */
  categories: { income: readonly string[]; expense: readonly string[] };
  sleep: readonly { date: string; hours: number }[];
  workouts: readonly { date: string; trained: boolean }[];
  /** Datas com sessão avançada concluída. */
  completedSessionDates: readonly string[];
}
