import { describe, expect, it } from 'vitest';
import { emptyRecords } from '../records/types';
import { emptyGoals, type GoalDefinition, type GoalState } from './types';
import { applyGoalCommand } from './commands';
import { blankGoal } from './templates';
import {
  defaultQuestFilters,
  selectQuests,
  type QuestFilters,
} from './questList';
const today = '2026-11-13';
function add(
  state: GoalState,
  id: string,
  definition: Partial<GoalDefinition> = {},
  date = today,
) {
  return applyGoalCommand(
    state,
    {
      type: 'save',
      id,
      definition: { ...blankGoal(date), title: id, ...definition },
    },
    date,
  );
}
function progress(state: GoalState, id: string, value: number) {
  return applyGoalCommand(
    state,
    {
      type: 'update',
      value: { id: `${id}-progress`, goalId: id, date: today, value },
    },
    today,
  );
}
function ids(state: GoalState, filters: Partial<QuestFilters> = {}) {
  return selectQuests(state, emptyRecords(), today, {
    ...defaultQuestFilters,
    ...filters,
  }).map(({ goal }) => goal.id);
}
describe('Consulta de quests sem alterar as fontes', () => {
  it('combina título/descrição sem acentos e caixa, pilar e status', () => {
    let state = add(emptyGoals(), 'Coração em forma', {
      description: 'Continuar exercícios ao ar livre',
      pillar: 'Treinos',
    });
    state = add(state, 'Outro', {
      description: 'Exercícios de memória',
      pillar: 'Conhecimento',
    });
    expect(ids(state, { search: ' CORACAO ' })).toEqual(['Coração em forma']);
    expect(
      ids(state, {
        search: 'EXERCICIOS',
        pillar: 'Conhecimento',
        status: 'active',
      }),
    ).toEqual(['Outro']);
    expect(ids(state, { search: 'EXERCICIOS', pillar: 'Finanças' })).toEqual(
      [],
    );
    expect(ids(state, { search: 'inexistente' })).toEqual([]);
  });
  it('separa estados de ciclo, pausa e arquivo, mantendo quests futuras consultáveis', () => {
    let state = add(emptyGoals(), 'ativa');
    state = add(state, 'concluida');
    state = progress(state, 'concluida', 10000);
    state = add(state, 'pausada');
    state = progress(state, 'pausada', 10000);
    state = applyGoalCommand(state, { type: 'pause', id: 'pausada' }, today);
    state = add(state, 'vencida', {
      startDate: '2026-11-01',
      deadline: '2026-11-12',
    });
    state = add(state, 'futura', { startDate: '2026-12-01' });
    state = add(state, 'excluida');
    state = applyGoalCommand(
      state,
      { type: 'delete', id: 'excluida', confirmed: true },
      today,
    );
    expect(ids(state, { status: 'active' })).toEqual(['ativa']);
    expect(ids(state, { status: 'completed' })).toEqual(['concluida']);
    expect(ids(state, { status: 'paused' })).toEqual(['pausada']);
    expect(ids(state, { status: 'overdue' })).toEqual(['vencida']);
    expect(ids(state)).toContain('futura');
    expect(ids(state)).not.toContain('excluida');
    expect(ids(state, { archived: true })).toEqual(['excluida']);
  });
  it('ordena por prazo, progresso em ambas direções, recência e alfabeto com desempates estáveis', () => {
    let state = add(emptyGoals(), 'c', {
      title: 'Correr',
      deadline: '2026-12-01',
    });
    state = add(state, 'a', { title: 'Álbum', deadline: '2026-11-14' });
    state = add(state, 'b', { title: 'Bicicleta' });
    state = progress(state, 'c', 5000);
    state = progress(state, 'a', 8000);
    const original = JSON.stringify(state);
    expect(ids(state)).toEqual(['a', 'c', 'b']);
    expect(ids(state, { order: 'progressDesc' })).toEqual(['a', 'c', 'b']);
    expect(ids(state, { order: 'progressAsc' })).toEqual(['b', 'c', 'a']);
    expect(ids(state, { order: 'alphabetical' })).toEqual(['a', 'b', 'c']);
    expect(ids(state, { order: 'newest' })).toEqual(['b', 'a', 'c']);
    expect(JSON.stringify(state)).toBe(original);
  });
  it('recalcula a lista a partir dos registros reais e do ciclo vigente', () => {
    const state = add(emptyGoals(), 'Treinar', {
      pillar: 'Treinos',
      metric: 'workouts',
      unit: 'dias',
      tracking: 'automatic',
      cadence: 'daily',
      target: 1000,
    });
    const records = {
      ...emptyRecords(),
      workouts: [{ date: today, trained: true }],
    };
    expect(
      selectQuests(state, records, today, {
        ...defaultQuestFilters,
        status: 'completed',
      }),
    ).toHaveLength(1);
    expect(
      selectQuests(state, emptyRecords(), today, {
        ...defaultQuestFilters,
        status: 'active',
      }),
    ).toHaveLength(1);
    expect(
      selectQuests(state, records, '2026-11-14', defaultQuestFilters)[0]?.cycle
        .percent,
    ).toBe(0);
  });
});
