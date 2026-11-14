import type {
  GoalDefinition,
  GoalState,
  GoalCommand,
  GoalUpdate,
  Goal,
} from './types';
import { goalPillars, metrics } from './types';
import { daysBetween, isDate } from '../records/dates';
import { openPause, pausedDate, manualScope } from './cycles';
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const amount = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1e12;
export function isGoalDefinition(v: unknown): v is GoalDefinition {
  if (
    !obj(v) ||
    !text(v.title, 200) ||
    typeof v.description !== 'string' ||
    v.description.length > 1000 ||
    !goalPillars.some((p) => p === v.pillar) ||
    !['quantity', 'completion'].includes(String(v.kind)) ||
    !amount(v.target) ||
    Number(v.target) <= 0 ||
    !text(v.unit, 40) ||
    !isDate(v.startDate) ||
    (v.deadline !== null &&
      (!isDate(v.deadline) ||
        v.deadline < v.startDate ||
        daysBetween(v.deadline, v.startDate) > 36525)) ||
    !['once', 'daily', 'weekly', 'monthly', 'custom'].includes(
      String(v.cadence),
    ) ||
    !Number.isInteger(v.customDays) ||
    Number(v.customDays) < 1 ||
    Number(v.customDays) > 3650 ||
    !['manual', 'automatic'].includes(String(v.tracking)) ||
    !['easy', 'medium', 'hard'].includes(String(v.difficulty))
  )
    return false;
  if (v.unit === 'reais' && Number(v.target) % 10 !== 0) return false;
  if (v.kind === 'completion' && (v.target !== 1000 || v.tracking !== 'manual'))
    return false;
  if (v.tracking === 'manual') return v.metric === null;
  if (typeof v.metric !== 'string' || !(v.metric in metrics)) return false;
  const metric = metrics[v.metric as keyof typeof metrics];
  return (
    metric.pillar === v.pillar &&
    metric.unit === v.unit &&
    v.kind === 'quantity'
  );
}
export function isGoalState(v: unknown): v is GoalState {
  if (
    !obj(v) ||
    !Array.isArray(v.items) ||
    v.items.length > 200 ||
    !Array.isArray(v.updates) ||
    v.updates.length > 10000
  )
    return false;
  if (
    !v.items.every(
      (g: unknown) =>
        obj(g) &&
        isGoalDefinition(g) &&
        text(g.id, 200) &&
        isDate(g.createdDate) &&
        (g.deletedOn === null || isDate(g.deletedOn)) &&
        Array.isArray(g.pauses) &&
        g.pauses.length <= 1000 &&
        g.pauses.every(
          (p: unknown) =>
            obj(p) &&
            isDate(p.from) &&
            p.from >= String(g.createdDate) &&
            (p.to === null || (isDate(p.to) && p.to >= p.from)),
        ) &&
        g.pauses.filter((p: { to: string | null }) => p.to === null).length <=
          1 &&
        Array.isArray(g.revisions) &&
        g.revisions.length <= 1000 &&
        g.revisions.every(
          (r: unknown) =>
            obj(r) && isDate(r.date) && isGoalDefinition(r.definition),
        ),
    )
  )
    return false;
  const items = v.items as Goal[];
  if (new Set(items.map((g) => g.id)).size !== items.length) return false;
  if (
    !v.updates.every(
      (u: unknown) =>
        obj(u) &&
        text(u.id, 200) &&
        items.some((g) => g.id === u.goalId) &&
        isDate(u.date) &&
        amount(u.value) &&
        (u.unit === undefined || text(u.unit, 40)) &&
        (u.scope === undefined || text(u.scope, 500)),
    )
  )
    return false;
  const updates = v.updates as GoalUpdate[];
  return (
    new Set(updates.map((u) => u.id)).size === updates.length &&
    new Set(
      updates.map((u) => u.goalId + ':' + u.date + ':' + (u.scope ?? 'legacy')),
    ).size === updates.length
  );
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function definitionOf(goal: Goal): GoalDefinition {
  const {
    title,
    description,
    pillar,
    kind,
    target,
    unit,
    startDate,
    deadline,
    cadence,
    customDays,
    tracking,
    metric,
    difficulty,
  } = goal;
  return {
    title,
    description,
    pillar,
    kind,
    target,
    unit,
    startDate,
    deadline,
    cadence,
    customDays,
    tracking,
    metric,
    difficulty,
  };
}
export function applyGoalCommand(
  state: GoalState,
  command: GoalCommand,
  today: string,
): GoalState {
  let next: GoalState = state;
  const goal =
    'id' in command ? state.items.find((g) => g.id === command.id) : undefined;
  if (command.type === 'save') {
    assert(
      isGoalDefinition(command.definition),
      'Confira título, alvo, unidade, indicador, datas e frequência da quest.',
    );
    assert(
      daysBetween(today, command.definition.startDate) <= 36525,
      'Use uma data de início nos últimos 100 anos.',
    );
    assert(!goal?.deletedOn, 'Uma quest excluída não pode ser editada.');
    const value: Goal = goal
      ? {
          ...goal,
          ...command.definition,
          revisions: [
            ...goal.revisions,
            { date: today, definition: definitionOf(goal) },
          ],
        }
      : {
          ...command.definition,
          id: command.id,
          createdDate: today,
          deletedOn: null,
          pauses: [],
          revisions: [],
        };
    next = {
      ...state,
      items: goal
        ? state.items.map((g) => (g.id === value.id ? value : g))
        : [...state.items, value],
    };
  } else if (command.type === 'delete') {
    assert(
      goal && !goal.deletedOn && command.confirmed,
      'Confirme a exclusão da quest.',
    );
    next = {
      ...state,
      items: state.items.map((g) =>
        g.id === command.id ? { ...g, deletedOn: today } : g,
      ),
    };
  } else if (command.type === 'pause' || command.type === 'resume') {
    assert(goal && !goal.deletedOn, 'Quest não encontrada.');
    const pauses = goal.pauses;
    if (command.type === 'pause') {
      assert(!openPause(goal), 'A quest já está pausada.');
      next = {
        ...state,
        items: state.items.map((g) =>
          g.id === goal.id
            ? { ...g, pauses: [...pauses, { from: today, to: null }] }
            : g,
        ),
      };
    } else {
      assert(openPause(goal), 'A quest já está ativa.');
      next = {
        ...state,
        items: state.items.map((g) =>
          g.id === goal.id
            ? {
                ...g,
                pauses: pauses.map((p) =>
                  p.to === null ? { ...p, to: today } : p,
                ),
              }
            : g,
        ),
      };
    }
  } else if (command.type === 'update') {
    const value = command.value,
      g = state.items.find((item) => item.id === value.goalId);
    assert(
      g && !g.deletedOn && !openPause(g) && g.tracking === 'manual',
      'Atualize somente quests manuais ativas.',
    );
    assert(
      isDate(value.date) &&
        value.date >= g.startDate &&
        value.date <= today &&
        (!g.deadline || value.date <= g.deadline) &&
        !pausedDate(g, value.date),
      'Informe uma data válida dentro da quest e fora da pausa.',
    );
    assert(
      (g.unit !== 'reais' || value.value % 10 === 0) &&
        amount(value.value) &&
        (g.kind !== 'completion' || value.value === 0 || value.value === 1000),
      'Informe um progresso válido.',
    );
    assert(
      !state.updates.some(
        (u) => u.id === value.id && u.goalId !== value.goalId,
      ),
      'Identificador já utilizado por outra quest.',
    );
    const scope = manualScope(g);
    assert(
      !state.updates.some(
        (u) => u.id === value.id && u.scope && u.scope !== scope,
      ),
      'Nova unidade ou frequência exige um novo registro de progresso.',
    );
    const same = state.updates.find(
      (u) =>
        u.goalId === value.goalId &&
        u.date === value.date &&
        (u.scope ?? scope) === scope,
    );
    const update = { ...value, id: same?.id ?? value.id, unit: g.unit, scope };
    next = {
      ...state,
      updates: [
        ...state.updates.filter((u) => u.id !== update.id && u.id !== value.id),
        update,
      ],
    };
  } else {
    const update = state.updates.find((u) => u.id === command.id);
    assert(update, 'Progresso não encontrado.');
    next = {
      ...state,
      updates: state.updates.filter((u) => u.id !== command.id),
    };
  }
  assert(
    isGoalState(next),
    'Limite de quests/histórico atingido ou configuração inválida.',
  );
  return next;
}
