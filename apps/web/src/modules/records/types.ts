import type {
  Investment,
  InvestmentEntry,
  MoneyMovement,
} from '../finances/types';
import type { WorkoutDay } from '../workouts/types';
import type { SleepDay } from '../rest/types';
import type { Book, ReadingEntry } from '../knowledge/types';
export interface LifeRecords {
  movements: MoneyMovement[];
  investments: Investment[];
  investmentEntries: InvestmentEntry[];
  workouts: WorkoutDay[];
  sleep: SleepDay[];
  sleepGoalHours: number;
  books: Book[];
  readings: ReadingEntry[];
}
export type RecordCommand =
  | { type: 'saveMovement'; value: MoneyMovement }
  | { type: 'deleteMovement'; id: string }
  | {
      type: 'saveInvestment';
      value: Investment;
      initialEntry?: InvestmentEntry;
    }
  | { type: 'deleteInvestment'; id: string }
  | { type: 'saveInvestmentEntry'; value: InvestmentEntry }
  | { type: 'deleteInvestmentEntry'; id: string }
  | { type: 'saveWorkout'; value: WorkoutDay }
  | { type: 'deleteWorkout'; date: string }
  | { type: 'saveSleep'; value: SleepDay }
  | { type: 'deleteSleep'; date: string }
  | { type: 'setSleepGoal'; hours: number }
  | { type: 'saveBook'; value: Book }
  | { type: 'deleteBook'; id: string }
  | { type: 'saveReading'; value: ReadingEntry }
  | { type: 'deleteReading'; id: string }
  | { type: 'finishBook'; id: string; date: string; entryId: string };
export interface RecordPageProps {
  records: LifeRecords;
  today: string;
  onCommand: (command: RecordCommand) => string | null;
}
export function emptyRecords(): LifeRecords {
  return {
    movements: [],
    investments: [],
    investmentEntries: [],
    workouts: [],
    sleep: [],
    sleepGoalHours: 8,
    books: [],
    readings: [],
  };
}
