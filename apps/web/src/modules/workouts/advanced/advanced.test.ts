import { describe, expect, it } from 'vitest';
import { applyAdvancedWorkoutCommand, sessionFromPlan } from './commands';
import { exerciseCatalog, starterExercises } from './catalog';
import { isAdvancedWorkoutState } from './validation';
import {
  emptyAdvancedWorkouts,
  type WorkoutPlan,
  type AdvancedWorkoutCommand,
} from './types';
import {
  completedSessions,
  exerciseHistory,
  exerciseVolume,
  muscleActivity,
  personalRecords,
  previousPerformance,
  sessionVolume,
  volumeForDays,
} from './calculations';
import {
  testDate as today,
  testSession,
  testSet,
  testState,
} from './testFixtures';
import { emptyRecords } from '../../records/types';
import { applyRecordCommand, isLifeRecords } from '../../records/commands';
import { projectCharacter } from '../../profile/character';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../../app/playerState';
import { createLocalStateStorage } from '../../../shared/storage/localStateStorage';
const apply = (
  command: AdvancedWorkoutCommand,
  state = emptyAdvancedWorkouts(),
) => applyAdvancedWorkoutCommand(state, command, today);
const plan = (): WorkoutPlan => ({
  id: 'a',
  name: 'Treino A',
  description: 'Peito',
  notes: 'Minha ficha',
  exercises: [
    { id: 'e1', exerciseId: 'bench', sets: 3, reps: 10, notes: 'Com controle' },
    { id: 'e2', exerciseId: 'row', sets: 2, reps: null, notes: '' },
  ],
});

describe('fichas, catálogo e sessões detalhadas', () => {
  it('começa desativado; alternar preserva todos os dados e não altera progressão', () => {
    expect(emptyAdvancedWorkouts().enabled).toBe(false);
    const state = testState();
    const disabled = apply({ type: 'setEnabled', enabled: false }, state);
    expect(disabled).toEqual({ ...state, enabled: false });
    expect(apply({ type: 'setEnabled', enabled: true }, disabled)).toEqual(
      state,
    );
    const player = createInitialPlayerState();
    const before = projectCharacter(player, today);
    const after = projectCharacter(
      { ...player, records: { ...player.records, advancedWorkouts: state } },
      today,
    );
    expect(after.progress).toEqual(before.progress);
    expect(after.dedication).toEqual(before.dedication);
    expect(after.classification).toEqual(before.classification);
    expect(after.achievements).toEqual(before.achievements);
  });
  it('cria, edita, reordena, duplica e exclui fichas somente com confirmação', () => {
    const original = apply({ type: 'savePlan', value: plan() });
    const edited = apply(
      {
        type: 'savePlan',
        value: {
          ...plan(),
          name: 'Puxar',
          exercises: [...plan().exercises].reverse(),
        },
      },
      original,
    );
    expect(edited.plans).toHaveLength(1);
    expect(edited.plans[0]!.exercises[0]!.exerciseId).toBe('row');
    const duplicate = apply(
      { type: 'duplicatePlan', id: 'a', newId: 'b' },
      edited,
    );
    expect(duplicate.plans[1]!.name).toBe('Puxar (cópia)');
    expect(duplicate.plans[1]!.exercises).not.toBe(edited.plans[0]!.exercises);
    expect(() =>
      apply({ type: 'deletePlan', id: 'a', confirmed: false }, duplicate),
    ).toThrow(/Confirme/);
    expect(
      apply(
        { type: 'deletePlan', id: 'a', confirmed: true },
        duplicate,
      ).plans.map((p) => p.id),
    ).toEqual(['b']);
    expect(() =>
      apply({
        type: 'savePlan',
        value: {
          ...plan(),
          exercises: [{ ...plan().exercises[0]!, exerciseId: 'missing' }],
        },
      }),
    ).toThrow();
  });
  it('cria e edita exercício personalizado, evitando duplicatas e preservando o catálogo inicial', () => {
    const custom = {
      ...starterExercises[0]!,
      id: 'custom',
      name: 'Supino personalizado na máquina',
      equipment: 'Máquina',
    };
    const state = apply({ type: 'saveExercise', value: custom });
    expect(exerciseCatalog(state)).toHaveLength(
      exerciseCatalog(emptyAdvancedWorkouts()).length + 1,
    );
    const edited = apply(
      { type: 'saveExercise', value: { ...custom, name: 'Supino articulado' } },
      state,
    );
    expect(edited.exercises[0]!.name).toBe('Supino articulado');
    expect(() =>
      apply(
        {
          type: 'saveExercise',
          value: { ...custom, id: 'second', name: '  SÚPINO   ARTICULADO ' },
        },
        edited,
      ),
    ).toThrow(/Já existe/);
    expect(() =>
      apply({
        type: 'saveExercise',
        value: { ...custom, name: 'Supino reto' },
      }),
    ).toThrow(/Já existe/);
    expect(() =>
      apply({ type: 'saveExercise', value: starterExercises[0]! }),
    ).toThrow(/catálogo/);
  });
  it('reutiliza fichas por snapshot sem alterar sessões ao editar ou excluir a ficha', () => {
    let state = apply({ type: 'savePlan', value: plan() });
    state = apply(
      { type: 'startSession', id: 'first', planId: 'a', date: today },
      state,
    );
    expect(state.sessions[0]!.notes).toBe('Minha ficha');
    expect(state.sessions[0]!.exercises[0]!.sets).toHaveLength(3);
    expect(state.sessions[0]!.exercises[0]!.sets[0]!.reps).toBe(10);
    const original = structuredClone(state.sessions[0]!);
    state = apply(
      {
        type: 'savePlan',
        value: { ...plan(), name: 'Renomeada', exercises: [] },
      },
      state,
    );
    state = apply(
      { type: 'startSession', id: 'second', planId: 'a', date: today },
      state,
    );
    state = apply({ type: 'deletePlan', id: 'a', confirmed: true }, state);
    expect(state.sessions[0]).toEqual(original);
    expect(state.sessions[1]!.planName).toBe('Renomeada');
    expect(state.sessions).toHaveLength(2);
  });
  it('preserva o snapshot de grupos musculares de exercícios personalizados', () => {
    const custom = {
      ...starterExercises[0]!,
      id: 'custom',
      name: 'Exercício pessoal',
    };
    let state = apply({ type: 'saveExercise', value: custom });
    const customPlan = {
      ...plan(),
      exercises: [{ ...plan().exercises[0]!, exerciseId: 'custom' }],
    };
    state = apply({ type: 'savePlan', value: customPlan }, state);
    state = apply(
      { type: 'startSession', id: 'first', planId: 'a', date: today },
      state,
    );
    state = apply(
      {
        type: 'saveExercise',
        value: { ...custom, primary: 'back', secondary: [] },
      },
      state,
    );
    expect(state.sessions[0]!.exercises[0]!.exercise.primary).toBe('chest');
  });
  it('edita, adiciona e remove séries, com cargas diferentes e RIR vazio ou zero', () => {
    let state = testState();
    const session = structuredClone(state.sessions[0]!);
    session.exercises[0]!.sets = [
      testSet('one', 10, 12, 'warmup', 0),
      testSet('two', 30, 6, 'working', 2),
      testSet('three', 25, 10),
    ];
    state = apply({ type: 'saveSession', value: session }, state);
    expect(state.sessions[0]!.exercises[0]!.sets.map((s) => s.rir)).toEqual([
      0,
      2,
      null,
    ]);
    expect(sessionVolume(state.sessions[0]!)).toBe(430);
    session.exercises[0]!.sets.splice(1, 1);
    expect(
      apply({ type: 'saveSession', value: session }, state).sessions[0]!
        .exercises[0]!.sets,
    ).toHaveLength(2);
  });
  it('rejeita RIR inválido, cargas negativas, frações de repetições e séries concluídas incompletas', () => {
    expect(
      isAdvancedWorkoutState({
        ...testState(),
        sessions: [
          testSession('one', today, [
            { ...testSet('s'), kind: ['working'] } as unknown as ReturnType<
              typeof testSet
            >,
          ]),
        ],
      }),
    ).toBe(false);
    for (const patch of [
      { rir: -1 },
      { rir: 11 },
      { rir: 1.5 },
      { weight: -1 },
      { weight: NaN },
      { reps: 1.5 },
      { reps: 0 },
      { weight: null },
      { reps: null },
    ]) {
      const session = testSession('one', today, [
        { ...testSet('s'), ...patch },
      ]);
      expect(() =>
        apply({ type: 'saveSession', value: session }, testState()),
      ).toThrow();
    }
    expect(
      isAdvancedWorkoutState({
        ...testState(),
        sessions: [
          testSession('one', today, [testSet('s', 0, 10, 'working', 10)]),
        ],
      }),
    ).toBe(true);
  });
  it('conclui sessões e exige ao menos uma série concluída; exclui com confirmação', () => {
    let state = apply({
      type: 'startSession',
      id: 'one',
      planId: null,
      date: today,
    });
    expect(() =>
      apply({ type: 'finishSession', id: 'one', markDay: false }, state),
    ).toThrow(/série/);
    const session = { ...testSession('one'), status: 'in_progress' as const };
    state = apply({ type: 'saveSession', value: session }, state);
    state = apply({ type: 'finishSession', id: 'one', markDay: false }, state);
    expect(state.sessions[0]!.status).toBe('completed');
    expect(() =>
      apply({ type: 'deleteSession', id: 'one', confirmed: false }, state),
    ).toThrow(/Confirme/);
    expect(
      apply({ type: 'deleteSession', id: 'one', confirmed: true }, state)
        .sessions,
    ).toEqual([]);
    expect(() =>
      apply({
        type: 'startSession',
        id: 'future',
        planId: null,
        date: '2027-01-01',
      }),
    ).toThrow(/data/);
  });
});

describe('volume, evolução, RIR, recordes e mapa muscular', () => {
  it('preserva precisão de cargas decimais e empates de volume', () => {
    const entries = [
      testSession('first', '2026-11-10', [testSet('s', 0.1, 3)]),
      testSession('second', today, [testSet('s', 0.3, 1)]),
    ];
    expect(sessionVolume(entries[0]!)).toBe(0.3);
    expect(volumeForDays(entries, today, 7)).toBe(0.6);
    expect(personalRecords(entries, 'bench', today).setVolume?.date).toBe(
      '2026-11-10',
    );
  });
  const sessions = [
    testSession('old', '2026-10-01', [testSet('a', 10, 5)]),
    testSession('two', '2026-11-11', [
      testSet('warmup', 100, 20, 'warmup'),
      testSet('b', 20, 8, 'working', 0),
      testSet('c', 20, 10, 'working', 2),
      { ...testSet('pending', 200, 30), completed: false },
    ]),
    testSession('three', today, [
      testSet('d', 30, 6, 'working', 3),
      testSet('e', 20, 12),
    ]),
  ];
  it('calcula volumes por exercício, sessão, semana e mês sem contar aquecimento ou séries pendentes por padrão', () => {
    expect(exerciseVolume(sessions[1]!.exercises[0]!)).toBe(360);
    expect(sessionVolume(sessions[1]!, true)).toBe(2360);
    expect(volumeForDays(sessions, today, 7)).toBe(780);
    expect(volumeForDays(sessions, today, 30, true)).toBe(2780);
    expect(
      sessionVolume({
        ...sessions[0]!,
        exercises: [
          ...sessions[0]!.exercises,
          {
            ...sessions[0]!.exercises[0]!,
            id: 'row',
            exercise: starterExercises.find((e) => e.id === 'row')!,
          },
        ],
      }),
    ).toBe(100);
  });
  it('gera somente os pontos reais do exercício e período, com médias de RIR que preservam zero', () => {
    const history = exerciseHistory(sessions, 'bench', today, 'week');
    expect(history.map((p) => [p.date, p.load, p.volume, p.rir])).toEqual([
      ['2026-11-11', 20, 360, 1],
      [today, 30, 420, 3],
    ]);
    expect(exerciseHistory(sessions, 'row', today, 'year')).toEqual([]);
    expect(exerciseHistory(sessions, 'bench', today, 'year')).toHaveLength(3);
    expect(
      exerciseHistory(sessions, 'bench', today, 'year')[0]!.rir,
    ).toBeNull();
    expect(previousPerformance(sessions, 'bench', 'three', today)).toEqual({
      weight: 20,
      reps: 10,
      date: '2026-11-11',
    });
    expect(
      completedSessions(
        [
          ...sessions,
          { ...sessions[0]!, id: 'draft', status: 'in_progress' },
          testSession('future', '2027-01-01'),
        ],
        today,
        'month',
      ),
    ).toHaveLength(2);
  });
  it('calcula recordes por exercício e os recalcula após edição e exclusão', () => {
    const records = personalRecords(sessions, 'bench', today);
    expect(records.load).toMatchObject({ weight: 30, date: today });
    expect(records.setVolume).toMatchObject({
      weight: 20,
      reps: 12,
      volume: 240,
      date: today,
    });
    expect(records.bestSession).toMatchObject({ volume: 420, date: today });
    expect(records.byLoad.find((s) => s.weight === 20)).toMatchObject({
      reps: 12,
      date: today,
    });
    const corrected = [
      ...sessions.slice(0, 2),
      testSession('three', today, [testSet('d', 15, 2)]),
    ];
    expect(personalRecords(corrected, 'bench', today).load?.weight).toBe(20);
    expect(
      personalRecords(sessions.slice(0, 1), 'bench', today).load?.weight,
    ).toBe(10);
    expect(personalRecords(sessions, 'row', today).load).toBeNull();
  });
  it('conta séries válidas por grupos principais e secundários sem duplicar nem incluir aquecimento', () => {
    const counts = muscleActivity(sessions, today, 'week');
    expect(counts.chest).toBe(4);
    expect(counts.triceps).toBe(4);
    expect(counts.shoulders).toBe(4);
    expect(counts.back).toBe(0);
    expect(muscleActivity(sessions, today, 'year').chest).toBe(5);
    expect(muscleActivity([], today, 'month').chest).toBe(0);
  });
  it('conta encolhimentos registrados antes do grupo Trapézio no trapézio, sem regravar a sessão', () => {
    const old = testSession('shrug-old');
    old.exercises[0]!.exercise = {
      id: 'shrug',
      name: 'Encolhimento com halteres',
      primary: 'back',
      secondary: ['forearms'],
      equipment: 'Halteres',
    };
    const snapshot = structuredClone(old);
    const counts = muscleActivity([old], today, 'week');
    expect(counts.trapezius).toBe(1);
    expect(counts.forearms).toBe(1);
    expect(counts.back).toBe(0);
    expect(old).toEqual(snapshot);
  });
  it('reconhece encolhimento próprio com o mesmo nome do catálogo', () => {
    const custom = testSession('shrug-custom');
    custom.exercises[0]!.exercise = {
      id: 'custom-shrug',
      name: 'Encolhimento com barra',
      primary: 'back',
      secondary: [],
      equipment: 'Barra',
    };
    const counts = muscleActivity([custom], today, 'week');
    expect(counts.trapezius).toBe(1);
    expect(counts.back).toBe(0);
  });
});

describe('persistência e isolamento do sistema RPG', () => {
  it('salva e recarrega todos os campos e continua aceitando os registros existentes sem migração destrutiva', () => {
    const old = createInitialPlayerState();
    old.records.workouts = [{ date: today, trained: true }];
    expect(isLifeRecords(old.records)).toBe(true);
    const raw = JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: old });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    const storage = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => localStorage,
      migratePlayerState,
    );
    expect(storage.load()).toEqual({ status: 'loaded', data: old });
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    const state = {
      ...old,
      records: {
        ...old.records,
        advancedWorkouts: {
          ...testState(),
          plans: [plan()],
          rotation: { sequence: ['a', 'a'], cursor: 1 },
        },
      },
    };
    expect(storage.save(state)).toBe(true);
    expect(storage.load()).toEqual({ status: 'loaded', data: state });
    expect(state.records.workouts).toBe(old.records.workouts);
    expect(
      isLifeRecords({
        ...state.records,
        advancedWorkouts: { ...testState(), version: 999 },
      }),
    ).toBe(false);
  });
  it('concluir com marcação diária é atômico e não duplica XP, Radar, quests ou classe', () => {
    const player = createInitialPlayerState();
    player.records.advancedWorkouts = testState();
    const finish = {
      type: 'advancedWorkout',
      command: { type: 'finishSession', id: 'one', markDay: true },
    } as const;
    const records = applyRecordCommand(player.records, finish, today);
    const again = applyRecordCommand(records, finish, today);
    expect(again.workouts).toEqual([{ date: today, trained: true }]);
    const dailyOnly = {
      ...player,
      records: {
        ...emptyRecords(),
        workouts: [{ date: today, trained: true }],
      },
    };
    const facts = projectCharacter({ ...player, records: again }, today);
    const dailyFacts = projectCharacter(dailyOnly, today);
    expect(facts.progress).toEqual(dailyFacts.progress);
    expect(facts.classification).toEqual(dailyFacts.classification);
    expect(facts.dedication).toEqual(dailyFacts.dedication);
    expect(facts.rewards).toEqual(dailyFacts.rewards);
    expect(facts.progress.xp).toBe(150);
    const deleted = applyRecordCommand(
      again,
      {
        type: 'advancedWorkout',
        command: { type: 'deleteSession', id: 'one', confirmed: true },
      },
      today,
    );
    expect(deleted.workouts).toEqual(again.workouts);
    expect(
      projectCharacter({ ...player, records: deleted }, today).progress,
    ).toEqual(facts.progress);
    const unmarked = applyRecordCommand(
      player.records,
      { ...finish, command: { ...finish.command, markDay: false } },
      today,
    );
    expect(unmarked.workouts).toEqual([]);
    expect(
      projectCharacter({ ...player, records: unmarked }, today).progress.xp,
    ).toBe(0);
  });
  it('construir uma sessão não modifica a ficha ou o catálogo original', () => {
    const original = plan();
    const snapshot = structuredClone(original);
    const session = sessionFromPlan(
      original,
      emptyAdvancedWorkouts(),
      'id',
      today,
    );
    session.exercises[0]!.exercise.name = 'Alterada';
    session.exercises[0]!.sets[0]!.weight = 90;
    expect(original).toEqual(snapshot);
    expect(starterExercises[0]!.name).toBe('Supino reto');
  });
});
