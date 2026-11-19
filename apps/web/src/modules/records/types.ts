import type {
  AdvancedWorkoutState,
  AdvancedWorkoutCommand,
} from '../workouts/advanced/types';
import type {
  FinanceLedger,
  CashAccount,
  AccountTransfer,
  InvestmentValuation,
  BitcoinQuote,
  UsdQuote,
  MarketQuote,
  Investment,
  InvestmentEntry,
  MoneyMovement,
} from '../finances/types';
import type { WorkoutDay } from '../workouts/types';
import type { SleepDay } from '../rest/types';
import type { Book, ReadingEntry } from '../knowledge/types';
export interface LifeRecords {
  advancedWorkouts?: AdvancedWorkoutState;
  finance?: FinanceLedger;
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
  | { type: 'advancedWorkout'; command: AdvancedWorkoutCommand }
  | { type: 'deleteAccount'; id: string; confirmed: boolean }
  | { type: 'resetFinances'; confirmation: string }
  | { type: 'saveAccount'; value: CashAccount }
  | { type: 'saveTransfer'; value: AccountTransfer }
  | { type: 'deleteTransfer'; id: string }
  | { type: 'saveValuation'; value: InvestmentValuation }
  | { type: 'deleteValuation'; id: string }
  | { type: 'saveQuote'; value: BitcoinQuote }
  | { type: 'saveUsdQuote'; value: UsdQuote }
  | { type: 'saveMarketQuote'; value: MarketQuote }
  | { type: 'saveMovement'; value: MoneyMovement }
  | { type: 'deleteMovement'; id: string }
  | {
      type: 'saveInvestment';
      value: Investment;
      initialEntry?: InvestmentEntry;
      initialValuation?: InvestmentValuation;
    }
  | { type: 'deleteInvestment'; id: string }
  | {
      type: 'saveInvestmentEntry';
      value: InvestmentEntry;
      confirmInitial?: boolean;
    }
  | { type: 'convertToInitialPosition'; id: string; confirmed: boolean }
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
