import { describe, expect, it } from 'vitest';
import { exerciseCatalog } from '../catalog';
import { applyAdvancedWorkoutCommand, sessionFromPlan } from '../commands';
import { emptyAdvancedWorkouts, type WorkoutPlan } from '../types';
import { isAdvancedWorkoutState } from '../validation';
import {
  testDate as today,
  testSession,
  testSet,
  testState,
} from '../testFixtures';
import { personalRecords } from '../calculations';
import { applyRecordCommand } from '../../../records/commands';
import {
  createInitialPlayerState,
  isPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../../../app/playerState';
import { projectCharacter } from '../../../profile/character';
import { createLocalStateStorage } from '../../../../shared/storage/localStateStorage';
import { createExerciseMatcher } from './matcher';
import { parseWorkoutText } from './parser';
import {
  importCatalog,
  onlyNewSets,
  prepareWorkoutImport,
} from './sessionIntegration';
import { importSetErrors } from './validation';

const catalog = exerciseCatalog(emptyAdvancedWorkouts());
const parse = (text: string) => parseWorkoutText(text, catalog);
const plan: WorkoutPlan = {
  id: 'a',
  name: 'Treino A · Peito',
  description: '',
  notes: 'Notas da ficha',
  exercises: [
    { id: 'pe', exerciseId: 'bench', sets: 3, reps: 10, notes: 'Controle' },
  ],
};
const apply = (
  state: ReturnType<typeof testState>,
  command: ReturnType<typeof prepareWorkoutImport>,
) => applyAdvancedWorkoutCommand(state, command, today);

describe('interpretação local do treino', () => {
  it('importa um exercício em linhas e preserva a ordem das séries', () => {
    const result = parse('Supino reto\n60x10\n65x8\n65x7');
    expect(result.warnings).toEqual([]);
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0]!.exerciseId).toBe('bench');
    expect(
      result.exercises[0]!.sets.map((s) => [s.weight, s.reps, s.rir]),
    ).toEqual([
      [60, 10, null],
      [65, 8, null],
      [65, 7, null],
    ]);
  });
  it('interpreta todo o exemplo multilinha, RIR e cabeçalho sem criar exercício fictício', () => {
    const result = parse(
      'Treino A - Peito\n\nSupino reto\n60x10\n65x8\n65x7\n\nSupino inclinado\n30kg x 12\n32kg x 10\n\nCrucifixo máquina\n35x12 rir 2\n40x10 rir 1',
    );
    expect(result.exercises.map((r) => r.exerciseId)).toEqual([
      'bench',
      'incline',
      'library:pec-deck',
    ]);
    expect(result.exercises.map((r) => r.sets.length)).toEqual([3, 2, 2]);
    expect(result.exercises[2]!.sets.map((s) => s.rir)).toEqual([2, 1]);
    expect(result.warnings).toHaveLength(1);
  });
  it.each([
    'Supino reto: 60x10, 65x8, 65x7',
    'Supino reto:60x10,65x8,65x7',
    'SUPINO RETO: 60 KG X 10;65 × 8|65x7',
  ])('aceita separadores e espaçamentos: %s', (text) => {
    expect(
      parse(text).exercises[0]!.sets.map((s) => [s.weight, s.reps]),
    ).toEqual([
      [60, 10],
      [65, 8],
      [65, 7],
    ]);
  });
  it('distingue vírgula decimal de separador entre séries e preserva RIR zero', () => {
    const result = parse(
      'Elevação lateral:12,5kg x12 rir0,14,5kg x10 rir2\nRosca diréta:20.25kg x12,22kg x10',
    );
    expect(result.exercises.map((r) => r.exerciseId)).toEqual([
      'raise',
      'curl',
    ]);
    expect(
      result.exercises[0]!.sets.map((s) => [s.weight, s.reps, s.rir]),
    ).toEqual([
      [12.5, 12, 0],
      [14.5, 10, 2],
    ]);
    expect(result.exercises[1]!.sets[0]!.weight).toBe(20.25);
  });
  it('reconhece aquecimento e válidas em cada série e rótulos de série', () => {
    const sets = parse(
      'Supino reto\nAquecimento:20x12;40x10 válida\nSérie 3: 60x8 rir 1\n65x6 warm-up',
    ).exercises[0]!.sets;
    expect(sets.map((s) => s.kind)).toEqual([
      'warmup',
      'working',
      'working',
      'warmup',
    ]);
  });
  it('reúne blocos do mesmo exercício sem perder séries iguais', () => {
    expect(
      parse('Supino reto: 60x10\nSupno reto: 60x10').exercises[0]!.sets,
    ).toHaveLength(2);
  });
  it('não inventa carga, repetições nem RIR e avisa sobre trechos não reconhecidos', () => {
    const result = parse('60x10\nSupino reto\nx10\n60x\n60x10 rir ?\n60kg');
    const sets = result.exercises[0]!.sets;
    expect(sets.map((s) => [s.weight, s.reps, s.rir])).toEqual([
      [null, 10, null],
      [60, null, null],
      [60, 10, null],
    ]);
    expect(result.warnings.join(' ')).toMatch(/sem exercício/);
    expect(result.warnings.join(' ')).toMatch(/não reconhecido/);
    expect(importSetErrors(sets[0]!)).toHaveLength(1);
  });
  it.each([
    '-1x10',
    '2001x10',
    '60x0',
    '60x1.5',
    '60x10 rir 11',
    '60x10 rir -1',
    '60x10 rir 1.5',
  ])('bloqueia valores inválidos sem truncar: %s', (text) => {
    const set = parse(`Supino reto: ${text}`).exercises[0]!.sets[0]!;
    expect(importSetErrors(set).length).toBeGreaterThan(0);
  });
  it('aceita zero de carga e texto vazio sem preencher nada', () => {
    expect(
      importSetErrors(parse('Abdominal:0x10').exercises[0]!.sets[0]!),
    ).toEqual([]);
    expect(parse('')).toEqual({ exercises: [], warnings: [] });
  });
});

describe('correspondência conservadora com Fuse.js', () => {
  it.each([
    ['Supno reto', 'bench'],
    ['Elevasão lateral', 'raise'],
    ['Puxda alta', 'pulldown'],
    ['Rosca diréta', 'curl'],
    ['Leg pres', 'legpress'],
    ['Voador', 'library:pec-deck'],
    ['bench press', 'bench'],
    ['remada serrote', 'library:dumbbell-row'],
  ])('preserva o ID ao reconhecer %s', (name, id) => {
    expect(createExerciseMatcher(catalog)(name).exerciseId).toBe(id);
  });
  it('mostra variantes sem escolher quando a ficha contém dois supinos', () => {
    const result = createExerciseMatcher(catalog, [
      'bench',
      'library:bench-machine',
    ])('Supino');
    expect(result.exerciseId).toBeNull();
    expect(result.alternatives.length).toBeGreaterThan(1);
    expect(result.alternatives[0]).toBe('bench');
  });
  it('prioriza a ficha para alternativas próximas sem resolver ambiguidade significativa', () => {
    const choices = [
      { ...catalog[0]!, id: 'one', name: 'Movimento alfa' },
      { ...catalog[0]!, id: 'two', name: 'Movimento alfo' },
    ];
    const result = createExerciseMatcher(choices, ['two', 'one'])(
      'Movimento alfe',
    );
    expect(result.alternatives).toContain('two');
    expect(result.exerciseId).toBeNull();
  });
  it('reconhece exercícios personalizados e mantém desconhecidos sem seleção', () => {
    const custom = { ...catalog[0]!, id: 'custom', name: 'Máquina pessoal' };
    const match = createExerciseMatcher([...catalog, custom]);
    expect(match('maquina pessol').exerciseId).toBe('custom');
    expect(match('qzj vvv kkk').exerciseId).toBeNull();
  });
});

describe('integração e persistência da importação', () => {
  it.each([
    'Treino A',
    'Treino B',
    'Treino C',
    'Treino D',
    'Treino E',
    'Minha divisão',
  ])('associa à ficha %s e adiciona exercício somente à sessão', (name) => {
    const state = { ...testState(), plans: [{ ...plan, name }] };
    const original = structuredClone(state);
    const command = prepareWorkoutImport(
      state,
      { planId: 'a', date: today },
      parse('Rosca direta:20x12\nSupino reto:60x10').exercises,
    );
    const next = apply(state, command);
    expect(next.plans).toEqual(original.plans);
    expect(next.sessions[0]).toEqual(original.sessions[0]);
    expect(command.value).toMatchObject({
      planId: 'a',
      planName: name,
      status: 'in_progress',
    });
    expect(command.value.exercises.map((e) => e.exercise.id)).toEqual([
      'curl',
      'bench',
    ]);
    expect(command.value.exercises[1]!.id).toContain(':pe');
    expect(command.value.exercises[1]!.sets[0]!.completed).toBe(true);
    expect(state).toEqual(original);
    expect(isAdvancedWorkoutState(next)).toBe(true);
  });
  it('exige uma decisão de conflito; manter preserva todos os dados', () => {
    const state = testState();
    const rows = parse('Supino reto:60x10').exercises;
    expect(() =>
      prepareWorkoutImport(state, { sessionId: 'one' }, rows),
    ).toThrow(/dados existentes/);
    rows[0]!.conflict = 'keep';
    expect(
      prepareWorkoutImport(state, { sessionId: 'one' }, rows).value,
    ).toEqual(state.sessions[0]);
  });
  it('substitui somente o exercício selecionado e preserva os IDs existentes', () => {
    const state = testState();
    state.sessions[0]!.exercises.push(
      testSession('other', today, [testSet('other-set')], 'curl').exercises[0]!,
    );
    const rows = parse('Supino reto:60x10 rir 0').exercises;
    rows[0]!.conflict = 'replace';
    const next = apply(
      state,
      prepareWorkoutImport(state, { sessionId: 'one' }, rows),
    );
    expect(next.sessions[0]!.exercises[0]!.sets[0]).toMatchObject({
      id: 's1',
      weight: 60,
      rir: 0,
    });
    expect(next.sessions[0]!.exercises[1]).toEqual(
      state.sessions[0]!.exercises[1],
    );
    expect(personalRecords(next.sessions, 'bench', today).load!.weight).toBe(
      60,
    );
  });
  it('acrescenta somente a diferença em séries, incluindo repetições idênticas', () => {
    const state = testState();
    const rows = parse('Supino reto:20x10,20x10,30x8').exercises;
    rows[0]!.conflict = 'append';
    const next = apply(
      state,
      prepareWorkoutImport(state, { sessionId: 'one' }, rows),
    );
    expect(next.sessions[0]!.exercises[0]!.sets.map((s) => s.weight)).toEqual([
      20, 20, 30,
    ]);
    const retry = apply(
      next,
      prepareWorkoutImport(next, { sessionId: 'one' }, rows),
    );
    expect(retry).toEqual(next);
    expect(
      onlyNewSets([testSet('a')], [testSet('b', 20, 10, 'warmup')]),
    ).toHaveLength(1);
  });
  it('trata cliques/comandos repetidos como uma única importação', () => {
    const state = testState();
    const command = prepareWorkoutImport(
      state,
      { planId: null, date: today },
      parse('Supino reto:60x10').exercises,
    );
    const next = apply(state, command);
    expect(apply(next, command)).toBe(next);
    expect(next.sessions).toHaveLength(2);
  });
  it('impede sobrescrita de uma sessão alterada ou removida após a prévia', () => {
    const state = testState();
    const rows = parse('Supino reto:60x10').exercises;
    rows[0]!.conflict = 'replace';
    const command = prepareWorkoutImport(state, { sessionId: 'one' }, rows);
    expect(() =>
      apply(
        { ...state, sessions: [{ ...state.sessions[0]!, notes: 'Mudou' }] },
        command,
      ),
    ).toThrow(/mudou/);
    expect(() => apply({ ...state, sessions: [] }, command)).toThrow(/mudou/);
  });
  it('preserva snapshots mesmo após alterações no catálogo personalizado', () => {
    const state = testState();
    const custom = { ...catalog[0]!, id: 'custom', name: 'Movimento antigo' };
    state.sessions[0]!.exercises[0]!.exercise = custom;
    state.exercises.push({ ...custom, name: 'Movimento novo' });
    const target = { sessionId: 'one' };
    const rows = parseWorkoutText(
      'Movimento antigo:30x8',
      importCatalog(state, target),
    ).exercises;
    rows[0]!.conflict = 'replace';
    const next = apply(state, prepareWorkoutImport(state, target, rows));
    expect(next.sessions[0]!.exercises[0]!.exercise).toEqual(custom);
    expect(next.exercises).toEqual(state.exercises);
  });
  it('recusa prévias não resolvidas, vazias, inválidas e datas futuras', () => {
    const state = testState();
    const target = { planId: null, date: today };
    for (const text of ['', 'Supino:60x10', 'Supino reto:x10', 'Supino reto']) {
      expect(() =>
        prepareWorkoutImport(state, target, parse(text).exercises),
      ).toThrow();
    }
    const rows = parse('Supino reto:60x10').exercises;
    expect(() =>
      apply(
        state,
        prepareWorkoutImport(state, { ...target, date: '2099-01-01' }, rows),
      ),
    ).toThrow(/data/);
  });
  it('preenche slots de uma nova ficha e mantém exercícios planejados não importados', () => {
    const state = { ...testState(), plans: [plan] };
    const pending = sessionFromPlan(plan, state, 'pending', today);
    state.sessions.push(pending);
    const rows = parse('Supino reto:60x10').exercises;
    rows[0]!.conflict = 'replace';
    const next = apply(
      state,
      prepareWorkoutImport(state, { sessionId: 'pending' }, rows),
    );
    expect(next.sessions[1]!.exercises[0]!.sets).toHaveLength(1);
    expect(next.sessions[1]!.exercises[0]!.sets[0]!.id).toBe('pending:pe:0');
  });
  it('salva e recarrega no armazenamento atual sem afetar histórico, usuário, XP ou Radar', () => {
    const player = createInitialPlayerState();
    player.records.advancedWorkouts = testState();
    const before = structuredClone(player);
    const facts = projectCharacter(player, today);
    const command = prepareWorkoutImport(
      player.records.advancedWorkouts,
      { planId: null, date: today },
      parse('Supino reto:60x10').exercises,
    );
    const records = applyRecordCommand(
      player.records,
      { type: 'advancedWorkout', command },
      today,
    );
    const next = { ...player, records };
    expect(projectCharacter(next, today)).toEqual(facts);
    expect({
      ...next.records,
      advancedWorkouts: before.records.advancedWorkouts,
    }).toEqual(before.records);
    expect(next.records.advancedWorkouts!.sessions[0]).toEqual(
      before.records.advancedWorkouts!.sessions[0],
    );
    const storage = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      PLAYER_STORAGE_VERSION,
      isPlayerState,
    );
    expect(storage.save(next)).toBe(true);
    expect(storage.load()).toMatchObject({ status: 'loaded', data: next });
    expect(apply(next.records.advancedWorkouts!, command)).toEqual(
      next.records.advancedWorkouts,
    );
  });
  it('continua aceitando dados antigos sem advancedWorkouts e sem migração do contrato v1', () => {
    const player = createInitialPlayerState();
    expect(player.records.advancedWorkouts).toBeUndefined();
    expect(isPlayerState(player)).toBe(true);
    const rows = parse('Supino reto:60x10').exercises;
    const command = prepareWorkoutImport(
      emptyAdvancedWorkouts(),
      { planId: null, date: today },
      rows,
    );
    const next = applyAdvancedWorkoutCommand(undefined, command, today);
    expect(next.version).toBe(1);
    expect(isAdvancedWorkoutState(next)).toBe(true);
    expect(
      isPlayerState({
        ...player,
        records: { ...player.records, advancedWorkouts: next },
      }),
    ).toBe(true);
  });
});
