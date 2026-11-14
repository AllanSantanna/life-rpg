import type { IconName } from '../../shared/components/Icon';
import type { LifeRecords } from '../records/types';
import type { Goal, GoalPillar, GoalState } from './types';
import { openPause } from './cycles';
import { currentGoalCycle, type GoalCycle } from './progress';

export const pillarIcons: Record<GoalPillar, IconName> = {
  Finanças: 'wallet',
  Treinos: 'dumbbell',
  Descanso: 'moon',
  Conhecimento: 'book',
  Geral: 'target',
};
export const questStatuses = [
  ['all', 'Todas'],
  ['active', 'Ativas'],
  ['completed', 'Concluídas'],
  ['paused', 'Pausadas'],
  ['overdue', 'Vencidas'],
] as const;
export const questOrders = {
  deadline: 'Prazo mais próximo',
  progressDesc: 'Maior progresso',
  progressAsc: 'Menor progresso',
  newest: 'Mais recentes',
  alphabetical: 'Ordem alfabética',
} as const;
export type QuestOrder = keyof typeof questOrders;
export interface QuestFilters {
  pillar: GoalPillar | 'all';
  status: (typeof questStatuses)[number][0];
  search: string;
  order: QuestOrder;
  archived: boolean;
}
export const defaultQuestFilters: QuestFilters = {
  pillar: 'all',
  status: 'all',
  search: '',
  order: 'deadline',
  archived: false,
};
export function questStatus(goal: Goal, cycle: GoalCycle) {
  return goal.deletedOn ? 'deleted' : openPause(goal) ? 'paused' : cycle.status;
}
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
const collator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

/** Projeção de apresentação: não modifica quests, registros nem recompensas. */
export function selectQuests(
  state: GoalState,
  records: LifeRecords,
  today: string,
  filters: QuestFilters,
) {
  const search = normalize(filters.search);
  const rows = state.items
    .map((goal, index) => ({ goal, index }))
    .filter(({ goal }) => !!goal.deletedOn === filters.archived)
    .filter(
      ({ goal }) => filters.pillar === 'all' || goal.pillar === filters.pillar,
    )
    .filter(
      ({ goal }) =>
        !search ||
        normalize(goal.title + ' ' + goal.description).includes(search),
    )
    .map(({ goal, index }) => ({
      goal,
      index,
      cycle: currentGoalCycle(goal, state, records, today),
    }))
    .filter(
      ({ goal, cycle }) =>
        filters.archived ||
        filters.status === 'all' ||
        questStatus(goal, cycle) === filters.status,
    );
  const due = ({ goal, cycle }: (typeof rows)[number]) =>
    goal.deadline ?? (goal.cadence === 'once' ? '9999-12-31' : cycle.end);
  return rows.sort((a, b) => {
    let comparison = 0;
    if (filters.order === 'deadline') comparison = due(a).localeCompare(due(b));
    if (filters.order === 'alphabetical')
      comparison = collator.compare(a.goal.title, b.goal.title);
    if (filters.order === 'newest')
      comparison =
        b.goal.createdDate.localeCompare(a.goal.createdDate) ||
        b.index - a.index;
    if (filters.order === 'progressDesc' || filters.order === 'progressAsc') {
      if (a.cycle.value === null || b.cycle.value === null)
        comparison =
          Number(a.cycle.value === null) - Number(b.cycle.value === null);
      else
        comparison =
          (a.cycle.percent - b.cycle.percent) *
          (filters.order === 'progressAsc' ? 1 : -1);
    }
    return comparison || a.index - b.index;
  });
}
