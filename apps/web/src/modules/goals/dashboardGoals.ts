import type { LifeRecords } from '../records/types';
import type { Goal, GoalState } from './types';
import { openPause } from './cycles';
import { currentGoalCycle, type GoalCycle } from './progress';

export interface DashboardGoal {
  goal: Goal;
  cycle: GoalCycle;
  due: string | null;
}

/** Pendências reais: vencidas continuam acionáveis; futuras/pausadas não ocupam o dashboard. */
export function dashboardGoals(
  state: GoalState,
  records: LifeRecords,
  today: string,
): DashboardGoal[] {
  return state.items
    .filter((goal) => !goal.deletedOn && !openPause(goal))
    .map((goal) => {
      const cycle = currentGoalCycle(goal, state, records, today);
      return {
        goal,
        cycle,
        due: goal.deadline ?? (goal.cadence === 'once' ? null : cycle.end),
      };
    })
    .filter(
      ({ cycle }) => cycle.status === 'active' || cycle.status === 'overdue',
    )
    .sort(
      (a, b) =>
        (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31') ||
        a.goal.createdDate.localeCompare(b.goal.createdDate) ||
        a.goal.id.localeCompare(b.goal.id),
    );
}
