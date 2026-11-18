import { advanceRotation } from './rotation';
import { isDate } from '../../records/dates';
import { exerciseCatalog, normalizedName, starterExercises } from './catalog';
import { isAdvancedWorkoutState } from './validation';
import { commitWorkoutImport } from './importing/persistence';
import { saveImportAlias } from './importing/aliases';
import {
  emptyAdvancedWorkouts,
  type AdvancedWorkoutCommand,
  type AdvancedWorkoutState,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSet,
} from './types';
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const upsert = <T extends { id: string }>(list: T[], value: T) =>
  list.some((e) => e.id === value.id)
    ? list.map((e) => (e.id === value.id ? value : e))
    : [...list, value];
export const blankSet = (
  id: string,
  reps: number | null = null,
): WorkoutSet => ({
  id,
  kind: 'working',
  weight: null,
  reps,
  rir: null,
  completed: false,
});
export function sessionFromPlan(
  plan: WorkoutPlan | null,
  state: AdvancedWorkoutState,
  id: string,
  date: string,
): WorkoutSession {
  const catalog = exerciseCatalog(state);
  return {
    id,
    date,
    planId: plan?.id ?? null,
    planName: plan?.name ?? 'Treino livre',
    notes: plan?.notes ?? '',
    status: 'in_progress',
    exercises:
      plan?.exercises.map((e) => ({
        id: `${id}:${e.id}`,
        exercise: structuredClone(
          catalog.find((ex) => ex.id === e.exerciseId)!,
        ),
        notes: e.notes,
        sets: Array.from({ length: e.sets }, (_, i) =>
          blankSet(`${id}:${e.id}:${i}`, e.reps),
        ),
      })) ?? [],
  };
}
export function applyAdvancedWorkoutCommand(
  current: AdvancedWorkoutState | undefined,
  command: AdvancedWorkoutCommand,
  today: string,
): AdvancedWorkoutState {
  const state = current ?? emptyAdvancedWorkouts();
  let next = state;
  switch (command.type) {
    case 'setEnabled':
      next = { ...state, enabled: command.enabled };
      break;
    case 'saveExercise': {
      assert(
        !starterExercises.some((e) => e.id === command.value.id),
        'O catálogo inicial não pode ser sobrescrito.',
      );
      assert(
        !exerciseCatalog(state).some(
          (e) =>
            e.id !== command.value.id &&
            normalizedName(e.name) === normalizedName(command.value.name),
        ),
        'Já existe um exercício com este nome. Selecione-o no catálogo.',
      );
      next = {
        ...state,
        exercises: upsert(state.exercises, {
          ...command.value,
          name: command.value.name.trim(),
        }),
      };
      break;
    }
    case 'createDivision':
      assert(
        command.plans.length > 0 && command.plans.length <= 26,
        'Escolha de 1 a 26 fichas.',
      );
      assert(
        command.plans.every(
          (p) => !state.plans.some((existing) => existing.id === p.id),
        ),
        'Identificador de ficha já utilizado.',
      );
      next = {
        ...state,
        plans: [...state.plans, ...command.plans],
        rotation: { sequence: command.sequence, cursor: 0 },
      };
      break;
    case 'setRotation':
      next = { ...state, rotation: { sequence: command.sequence, cursor: 0 } };
      break;
    case 'savePlan':
      next = {
        ...state,
        plans: upsert(state.plans, {
          ...command.value,
          name: command.value.name.trim(),
        }),
      };
      break;
    case 'duplicatePlan': {
      const plan = state.plans.find((p) => p.id === command.id);
      assert(plan, 'Ficha não encontrada.');
      assert(
        !state.plans.some((p) => p.id === command.newId),
        'Identificador de ficha já utilizado.',
      );
      next = {
        ...state,
        plans: [
          ...state.plans,
          {
            ...structuredClone(plan),
            id: command.newId,
            name: `${plan.name.slice(0, 192)} (cópia)`,
          },
        ],
      };
      break;
    }
    case 'deletePlan': {
      assert(command.confirmed, 'Confirme a exclusão da ficha.');
      next = {
        ...state,
        plans: state.plans.filter((p) => p.id !== command.id),
        ...(state.rotation
          ? {
              rotation: (() => {
                const { sequence, cursor } = state.rotation;
                const ordered = [
                  ...sequence.slice(cursor),
                  ...sequence.slice(0, cursor),
                ];
                return {
                  sequence: ordered.filter((id) => id !== command.id),
                  cursor: 0,
                };
              })(),
            }
          : {}),
      };
      break;
    }
    case 'startSession': {
      assert(
        isDate(command.date) && command.date <= today,
        'Informe uma data válida até hoje.',
      );
      assert(
        !state.sessions.some((s) => s.id === command.id),
        'Identificador de sessão já utilizado.',
      );
      const plan =
        command.planId === null
          ? null
          : state.plans.find((p) => p.id === command.planId);
      assert(plan !== undefined, 'Ficha não encontrada.');
      next = {
        ...state,
        sessions: [
          ...state.sessions,
          sessionFromPlan(plan, state, command.id, command.date),
        ],
      };
      break;
    }
    case 'saveSession': {
      assert(
        state.sessions.some((s) => s.id === command.value.id),
        'Sessão não encontrada.',
      );
      assert(
        isDate(command.value.date) && command.value.date <= today,
        'Informe uma data válida até hoje.',
      );
      next = { ...state, sessions: upsert(state.sessions, command.value) };
      break;
    }
    case 'importSession':
      next = commitWorkoutImport(
        state,
        command.value,
        command.expected,
        today,
        command.aliases,
        command.inputOrder,
      );
      break;
    case 'saveImportAlias':
      next = saveImportAlias(state, command.value);
      break;
    case 'deleteImportAlias':
      next = state.importSettings
        ? {
            ...state,
            importSettings: {
              ...state.importSettings,
              aliases: state.importSettings.aliases.filter(
                (a) => a.id !== command.id,
              ),
            },
          }
        : state;
      break;
    case 'finishSession': {
      const session = state.sessions.find((s) => s.id === command.id);
      assert(session, 'Sessão não encontrada.');
      assert(
        session.exercises.some((e) => e.sets.some((s) => s.completed)),
        'Conclua ao menos uma série antes de encerrar a sessão.',
      );
      assert(session.date <= today, 'A sessão não pode estar no futuro.');
      next = {
        ...state,
        sessions: upsert(state.sessions, { ...session, status: 'completed' }),
        ...(session.status !== 'completed' && state.rotation
          ? { rotation: advanceRotation(state, session.planId) }
          : {}),
      };
      break;
    }
    case 'deleteSession':
      assert(command.confirmed, 'Confirme a exclusão da sessão.');
      next = {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== command.id),
      };
      break;
  }
  assert(
    isAdvancedWorkoutState(next),
    'Verifique os campos: nome obrigatório, carga de 0 a 2.000 kg, repetições inteiras de 1 a 1.000 e RIR opcional de 0 a 10. Séries concluídas exigem carga e repetições.',
  );
  return next;
}
