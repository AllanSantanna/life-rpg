import { describe, expect, it } from 'vitest';
import {
  exerciseCatalog,
  normalizedName,
  recentExercises,
  searchExercises,
} from './catalog';
import { divisionPlans, parseSequence, suggestedPlan } from './rotation';
import { applyAdvancedWorkoutCommand as apply } from './commands';
import { isAdvancedWorkoutState } from './validation';
import { emptyAdvancedWorkouts } from './types';
import { testDate as today, testSession, testSet } from './testFixtures';

describe('catálogo ampliado e pesquisa local', () => {
  const catalog = exerciseCatalog(emptyAdvancedWorkouts());
  it('oferece mais de 100 exercícios únicos, com todos os grupos e equipamentos', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(100);
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
    expect(new Set(catalog.map((e) => normalizedName(e.name))).size).toBe(
      catalog.length,
    );
    expect(new Set(catalog.map((e) => e.primary)).size).toBe(11);
    for (const equipment of [
      'Máquina',
      'Halteres',
      'Barra',
      'Polia',
      'Peso corporal',
    ])
      expect(catalog.some((e) => e.equipment === equipment)).toBe(true);
  });
  it('busca sem acentos, em qualquer caixa e com nomes alternativos, combinando filtros', () => {
    expect(searchExercises(catalog, '  TRICEPS  ').length).toBeGreaterThan(5);
    expect(searchExercises(catalog, 'peck deck')[0]?.name).toBe(
      'Crucifixo na máquina',
    );
    expect(searchExercises(catalog, 'serrote')[0]?.name).toBe(
      'Remada unilateral',
    );
    expect(
      searchExercises(catalog, 'SUPINO inclinado', 'chest', 'Barra').map(
        (e) => e.name,
      ),
    ).toEqual(['Supino inclinado com barra']);
    expect(searchExercises(catalog, 'supino', 'calves')).toEqual([]);
  });
  it('preserva exercícios personalizados antigos quando a biblioteca ganha um nome equivalente', () => {
    const state = emptyAdvancedWorkouts();
    const machine = catalog.find((e) => e.name === 'Supino na máquina')!;
    state.exercises = [
      { ...machine, id: 'meu-supino', name: 'Súpino na máquina' },
    ];
    state.plans = [
      {
        id: 'a',
        name: 'Existente',
        description: '',
        notes: '',
        exercises: [
          { id: 'e', exerciseId: 'meu-supino', sets: 3, reps: null, notes: '' },
        ],
      },
    ];
    expect(isAdvancedWorkoutState(state)).toBe(true);
    expect(
      exerciseCatalog(state)
        .filter((e) => normalizedName(e.name) === 'supino na maquina')
        .map((e) => e.id),
    ).toEqual(['meu-supino']);
    const session = apply(
      state,
      { type: 'startSession', id: 's', planId: 'a', date: today },
      today,
    ).sessions[0]!;
    expect(session.exercises[0]!.exercise.id).toBe('meu-supino');
  });
  it('ordena recentes pela data e pela última inclusão no mesmo dia, sem inventar exercícios', () => {
    const state = emptyAdvancedWorkouts();
    state.sessions = [
      testSession('old'),
      {
        ...testSession('new'),
        exercises: [
          {
            ...testSession('fixture').exercises[0]!,
            exercise: catalog.find((e) => e.id === 'row')!,
          },
        ],
      },
    ];
    expect(recentExercises(state).map((e) => e.id)).toEqual(['row', 'bench']);
  });
});

describe('divisões e sequência rotativa compatíveis com a persistência', () => {
  for (const count of [1, 2, 3, 4, 5, 8])
    it(`cria ${count} fichas vazias sem substituir fichas e sessões antigas`, () => {
      let i = 0;
      const plans = divisionPlans(count, () => `new-${i++}`);
      const old = {
        ...emptyAdvancedWorkouts(),
        plans: divisionPlans(1, () => 'old'),
        sessions: [testSession('fixture')],
      };
      const next = apply(
        old,
        { type: 'createDivision', plans, sequence: plans.map((p) => p.id) },
        today,
      );
      expect(next.plans).toHaveLength(count + 1);
      expect(next.plans[1]!.name).toBe('Treino A');
      expect(plans.every((p) => p.exercises.length === 0)).toBe(true);
      expect(next.sessions).toEqual(old.sessions);
      expect(isAdvancedWorkoutState(JSON.parse(JSON.stringify(next)))).toBe(
        true,
      );
    });
  it('aceita repetições e rejeita letras que não existem e sequências malformadas', () => {
    let i = 0;
    const plans = divisionPlans(3, () => String(i++));
    expect(parseSequence('a → b → a → c', plans)).toEqual(['0', '1', '0', '2']);
    for (const value of ['', 'ABC', 'A → D', 'A1', 'A → 2'])
      expect(parseSequence(value, plans)).toBeNull();
  });
  it('avança ao concluir, aceita início manual e não avança ao confirmar a mesma sessão novamente', () => {
    let i = 0;
    const plans = divisionPlans(3, () => String(i++));
    let state = apply(
      undefined,
      { type: 'createDivision', plans, sequence: ['0', '1', '0', '2'] },
      today,
    );
    expect(suggestedPlan(state)?.id).toBe('0');
    state = {
      ...state,
      sessions: [
        {
          ...testSession('manual', today, [testSet('set')]),
          planId: '1',
          status: 'in_progress',
        },
      ],
    };
    state = apply(
      state,
      { type: 'finishSession', id: 'manual', markDay: false },
      today,
    );
    expect(state.rotation?.cursor).toBe(2);
    expect(suggestedPlan(state)?.id).toBe('0');
    const again = apply(
      state,
      { type: 'finishSession', id: 'manual', markDay: false },
      today,
    );
    expect(again.rotation).toEqual(state.rotation);
    const renamed = apply(
      again,
      { type: 'savePlan', value: { ...plans[0]!, name: 'Renomeada' } },
      today,
    );
    expect(suggestedPlan(renamed)?.name).toBe('Renomeada');
    const edited = apply(
      renamed,
      { type: 'setRotation', sequence: ['2', '0'] },
      today,
    );
    expect(suggestedPlan(edited)?.id).toBe('2');
    const removed = apply(
      edited,
      { type: 'deletePlan', id: '2', confirmed: true },
      today,
    );
    expect(removed.rotation).toEqual({ sequence: ['0'], cursor: 0 });
    expect(removed.sessions).toEqual(edited.sessions);
    expect(isAdvancedWorkoutState(removed)).toBe(true);
  });
  it('rejeita referências inválidas e índices fora da sequência', () => {
    const state = {
      ...emptyAdvancedWorkouts(),
      plans: divisionPlans(1, () => 'a'),
    };
    expect(() =>
      apply(state, { type: 'setRotation', sequence: ['missing'] }, today),
    ).toThrow();
    expect(
      isAdvancedWorkoutState({
        ...state,
        rotation: { sequence: ['a'], cursor: 1 },
      }),
    ).toBe(false);
    expect(
      isAdvancedWorkoutState({
        ...state,
        rotation: { sequence: ['a'], cursor: 0.5 },
      }),
    ).toBe(false);
  });
});
