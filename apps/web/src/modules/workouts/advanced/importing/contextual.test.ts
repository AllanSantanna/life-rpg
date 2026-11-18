import { describe, expect, it } from 'vitest';
import { exerciseCatalog } from '../catalog';
import { applyAdvancedWorkoutCommand, sessionFromPlan } from '../commands';
import { testDate as today } from '../testFixtures';
import { isAdvancedWorkoutState } from '../validation';
import type { ExerciseAlias } from '../types';
import { createExerciseMatcher } from './matcher';
import { parseWorkoutText } from './parser';
import {
  importCatalog,
  preferredExerciseIds,
  prepareWorkoutImport,
} from './sessionIntegration';
import { aliasIssue, confirmedAliases } from './aliases';
import { chestState, chestNotes, whatsappNotes } from './contextFixtures';
import { importSetErrors } from './validation';
import { brazilianDate } from './metadata';
import { suggestedPlans } from './suggestedPlans';
import {
  createInitialPlayerState,
  isPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../../../app/playerState';
import { createLocalStateStorage } from '../../../../shared/storage/localStateStorage';
import { applyRecordCommand } from '../../../records/commands';
import { projectCharacter } from '../../../profile/character';

function parse(text: string, state = chestState()) {
  const target = { planId: 'chest', date: today };
  return parseWorkoutText(
    text,
    importCatalog(state, target),
    preferredExerciseIds(state, target),
    { planId: 'chest', aliases: state.importSettings?.aliases ?? [] },
  );
}
const alias = (
  name = 'Meu aparelho',
  exerciseId = 'library:bench-machine',
  planId: string | null = 'chest',
): ExerciseAlias => ({ id: 'alias', name, exerciseId, planId });

describe('ficha como fonte prioritária', () => {
  it('reconhece o exemplo real por IDs da ficha mesmo existindo Crucifixo exato no catálogo', () => {
    const result = parse(chestNotes);
    expect(result.exercises.map((r) => r.exerciseId)).toEqual([
      'library:pec-deck',
      'my-cross',
      'library:bench-machine',
    ]);
    expect(result.exercises.map((r) => r.source)).toEqual([
      'plan',
      'plan',
      'plan',
    ]);
    expect(result.exercises.map((r) => r.sets.length)).toEqual([3, 3, 3]);
  });
  it.each([
    ['Sup máquina', 'library:bench-machine'],
    ['Elev lateral', 'raise'],
    ['Desenv', 'press'],
    ['Crucifxo máquina', 'library:pec-deck'],
    ['Cross', 'my-cross'],
  ])('reconhece abreviações/erros sem criar IDs: %s', (name, id) => {
    expect(parse(`${name}:40x10`).exercises[0]!.exerciseId).toBe(id);
  });
  it('não usa a posição do catálogo para desempatar dois crucifixos da ficha', () => {
    const state = chestState();
    state.plans[0]!.exercises.push({
      id: 'another',
      exerciseId: 'library:incline-fly',
      sets: 3,
      reps: 10,
      notes: '',
    });
    const result = parse('Crucifixo:40x10', state).exercises[0]!;
    expect(result.exerciseId).toBeNull();
    expect(result.alternatives).toEqual(
      expect.arrayContaining(['library:pec-deck', 'library:incline-fly']),
    );
  });
  it('exige escolha para duas remadas, mesmo com correspondência mais curta/exata', () => {
    const catalog = exerciseCatalog(chestState());
    const result = createExerciseMatcher(catalog, ['row', 'library:cable-row'])(
      'Remada',
    );
    expect(result.exerciseId).toBeNull();
    expect(result.source).toBe('manual');
  });
  it('recorre ao catálogo para exercícios fora da ficha e mantém a ficha intacta', () => {
    const state = chestState();
    const before = structuredClone(state);
    const parsed = parse('Agachamento livre:60x10', state);
    expect(parsed.exercises[0]).toMatchObject({
      exerciseId: 'squat',
      source: 'catalog',
    });
    const command = prepareWorkoutImport(
      state,
      { planId: 'chest', date: today },
      parsed.exercises,
    );
    const next = applyAdvancedWorkoutCommand(state, command, today);
    expect(next.plans).toEqual(before.plans);
    expect(next.sessions.at(-1)!.exercises[0]!.exercise.id).toBe('squat');
  });
  it('usa a ficha vinculada à sessão e preserva snapshots e IDs dos slots', () => {
    const state = chestState();
    const session = sessionFromPlan(state.plans[0]!, state, 'active', today);
    state.sessions.push(session);
    const target = { sessionId: 'active' };
    const rows = parseWorkoutText(
      'Crucifixo:40x13',
      importCatalog(state, target),
      preferredExerciseIds(state, target),
    ).exercises;
    rows[0]!.conflict = 'replace';
    const command = prepareWorkoutImport(state, target, rows);
    expect(command.value.exercises[0]!.exercise.id).toBe('library:pec-deck');
    expect(command.value.exercises[0]!.id).toBe(session.exercises[0]!.id);
    expect(command.value.exercises[0]!.sets[0]!.id).toBe(
      session.exercises[0]!.sets[0]!.id,
    );
  });
  it('não aceita aproximação fraca só porque há um exercício na ficha', () => {
    expect(parse('Sequência xyz:40x10').exercises[0]!.exerciseId).toBeNull();
  });
});

describe('aprendizado local confirmado', () => {
  it('só prepara apelidos marcados e confirmados manualmente', () => {
    const state = chestState();
    const rows = parse('Meu aparelho:40x10').exercises;
    rows[0]!.exerciseId = 'library:bench-machine';
    rows[0]!.rememberName = true;
    expect(
      confirmedAliases(state, { planId: 'chest', date: today }, rows),
    ).toEqual([]);
    rows[0]!.manuallyConfirmed = true;
    expect(
      confirmedAliases(state, { planId: 'chest', date: today }, rows)[0],
    ).toMatchObject({
      name: 'Meu aparelho',
      exerciseId: 'library:bench-machine',
      planId: 'chest',
    });
  });
  it('salva associação com a sessão em uma operação, sem alterar fontes RPG/rotação/histórico', () => {
    const player = createInitialPlayerState();
    const state = chestState();
    player.records.advancedWorkouts = state;
    const facts = projectCharacter(player, today);
    const rows = parse('Sup máquina:40x10', state).exercises;
    const command = {
      ...prepareWorkoutImport(state, { planId: 'chest', date: today }, rows),
      aliases: [alias()],
      inputOrder: 'reps-weight' as const,
    };
    const records = applyRecordCommand(
      player.records,
      { type: 'advancedWorkout', command },
      today,
    );
    expect(projectCharacter({ ...player, records }, today)).toEqual(facts);
    expect(records.workouts).toEqual(player.records.workouts);
    expect(records.advancedWorkouts!.rotation).toEqual(state.rotation);
    expect(records.advancedWorkouts!.sessions[0]).toEqual(state.sessions[0]);
    const storage = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      PLAYER_STORAGE_VERSION,
      isPlayerState,
    );
    expect(storage.save({ ...player, records })).toBe(true);
    const loaded = storage.load();
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') throw new Error('Recarga falhou');
    const reloaded = loaded.data.records.advancedWorkouts!;
    expect(parse('Meu aparelho:40x10', reloaded).exercises[0]).toMatchObject({
      exerciseId: 'library:bench-machine',
      source: 'alias',
    });
    expect(reloaded.importSettings!.inputOrder).toBe('reps-weight');
    expect(applyAdvancedWorkoutCommand(reloaded, command, today)).toEqual(
      reloaded,
    );
  });
  it('não grava a sessão se houver erro ao salvar o apelido', () => {
    const state = chestState();
    const command = {
      ...prepareWorkoutImport(
        state,
        { planId: null, date: today },
        parse('Sup máquina:40x10').exercises,
      ),
      aliases: [alias('Inválido', 'deleted')],
    };
    expect(() => applyAdvancedWorkoutCommand(state, command, today)).toThrow(
      /excluído/,
    );
    expect(state.sessions).toHaveLength(1);
  });
  it('separa o mesmo apelido em fichas diferentes e usa associações gerais no treino livre', () => {
    const state = chestState();
    state.plans.push({ ...state.plans[0]!, id: 'other', name: 'Outra ficha' });
    let next = applyAdvancedWorkoutCommand(
      state,
      { type: 'saveImportAlias', value: alias() },
      today,
    );
    next = applyAdvancedWorkoutCommand(
      next,
      {
        type: 'saveImportAlias',
        value: { ...alias('Meu aparelho', 'raise', 'other'), id: 'other' },
      },
      today,
    );
    next = applyAdvancedWorkoutCommand(
      next,
      {
        type: 'saveImportAlias',
        value: { ...alias('Meu aparelho', 'curl', null), id: 'general' },
      },
      today,
    );
    const match = (planId: string | null) =>
      createExerciseMatcher(exerciseCatalog(next), [], {
        planId,
        aliases: next.importSettings!.aliases,
      })('Meu aparelho');
    expect(match('chest').exerciseId).toBe('library:bench-machine');
    expect(match('other').exerciseId).toBe('raise');
    expect(match(null).exerciseId).toBe('curl');
  });
  it('apelido confirmado resolve ambiguidade da ficha e conflito com nome oficial exige escolha', () => {
    const state = chestState();
    const matcher = createExerciseMatcher(
      exerciseCatalog(state),
      ['row', 'library:cable-row'],
      { planId: 'chest', aliases: [alias('Remada', 'row')] },
    );
    expect(matcher('Remada')).toMatchObject({
      exerciseId: 'row',
      source: 'alias',
    });
    const conflict = createExerciseMatcher(exerciseCatalog(state), ['raise'], {
      planId: 'chest',
      aliases: [alias('Elevação lateral', 'curl')],
    });
    expect(conflict('Elevação lateral').exerciseId).toBeNull();
  });
  it('IDs continuam válidos após renomear exercício; associações órfãs não são usadas', () => {
    const state = chestState();
    const custom = state.exercises[0]!;
    state.importSettings = {
      inputOrder: 'auto',
      aliases: [alias('Minha polia', custom.id)],
    };
    custom.name = 'Nome oficial novo';
    expect(parse('Minha polia:40x10', state).exercises[0]!.exerciseId).toBe(
      custom.id,
    );
    state.plans[0]!.exercises = state.plans[0]!.exercises.filter(
      (e) => e.exerciseId !== custom.id,
    );
    state.exercises = [];
    expect(aliasIssue(state, state.importSettings.aliases[0]!)).toMatch(
      /excluído/,
    );
    expect(
      parse('Minha polia:40x10', state).exercises[0]!.exerciseId,
    ).toBeNull();
    expect(isAdvancedWorkoutState(state)).toBe(true);
  });
  it('permite editar/excluir e bloqueia dois destinos para o mesmo apelido/contexto', () => {
    const state = applyAdvancedWorkoutCommand(
      chestState(),
      { type: 'saveImportAlias', value: alias() },
      today,
    );
    expect(() =>
      applyAdvancedWorkoutCommand(
        state,
        {
          type: 'saveImportAlias',
          value: { ...alias('Meu aparelho', 'raise'), id: 'collision' },
        },
        today,
      ),
    ).toThrow(/já aponta/);
    const edited = applyAdvancedWorkoutCommand(
      state,
      { type: 'saveImportAlias', value: alias('Meu aparelho', 'raise') },
      today,
    );
    expect(edited.importSettings!.aliases[0]!.exerciseId).toBe('raise');
    expect(
      applyAdvancedWorkoutCommand(
        edited,
        { type: 'deleteImportAlias', id: 'alias' },
        today,
      ).importSettings!.aliases,
    ).toEqual([]);
  });
});

describe('metadados e WhatsApp sem inverter números', () => {
  it('reconhece títulos, datas brasileiras, divisão, separadores e pontuação', () => {
    const result = parse(
      'Treino: Peito\nData: 17/11/2026\nDivisão: A\n---\n...\n\nCrucifixo:40x13',
    );
    expect(result.exercises).toHaveLength(1);
    expect(result.metadata).toEqual({
      title: 'Peito',
      division: 'A',
      dates: ['2026-11-17'],
      partialDates: [],
    });
    expect(
      suggestedPlans(result.metadata!, chestState().plans).map((p) => p.id),
    ).toEqual(['chest']);
    expect(brazilianDate('31/02/2026')).toBeNull();
    expect(
      parse('Data: 31/02/2026\nCrucifixo:40x10').warnings.join(' '),
    ).toMatch(/data inválida/);
  });
  it('remove prefixos WhatsApp, mantém texto original e agrupa o exemplo', () => {
    const state = chestState();
    const result = parseWorkoutText(
      whatsappNotes,
      exerciseCatalog(state),
      state.plans[0]!.exercises.map((e) => e.exerciseId),
      { inputOrder: 'reps-weight' },
    );
    expect(result.originalText).toBe(whatsappNotes);
    expect(result.metadata).toMatchObject({
      title: 'Peito',
      dates: [],
      partialDates: ['17/11'],
    });
    expect(result.exercises.map((e) => e.exerciseId)).toEqual([
      'library:pec-deck',
      'my-cross',
    ]);
    expect(result.exercises[0]!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [40, 13],
      [40, 6],
      [50, 8],
    ]);
    expect(result.exercises[1]!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [40, 8],
      [50, 6],
      [60, 6],
    ]);
  });
  it.each([
    '[17/11/2026, 14:43] Allan: Crucifixo\n[17/11/2026, 14:44] Allan: 13x40kg',
    '17/11/2026, 14:43 - Allan: Crucifixo\n17/11/2026, 14:44 - Allan: 13x40kg',
  ])('aceita formatos WhatsApp com ano explícito: %s', (text) => {
    const result = parse(text);
    expect(result.metadata!.dates).toEqual(['2026-11-17']);
    expect(result.exercises[0]!.sets[0]).toMatchObject({
      weight: 40,
      reps: 13,
    });
  });
  it.each(['13 x 40 kg', '40kg x13'])(
    'unidade explícita tem prioridade sobre o formato selecionado: %s',
    (text) => {
      for (const inputOrder of [
        'weight-reps',
        'reps-weight',
        'auto',
      ] as const) {
        const set = parseWorkoutText(
          `Crucifixo:${text}`,
          exerciseCatalog(chestState()),
          [],
          { inputOrder },
        ).exercises[0]!.sets[0]!;
        expect(set).toMatchObject({ weight: 40, reps: 13 });
      }
    },
  );
  it('respeita formato explícito e exige decisão para pares plausíveis no automático', () => {
    const catalog = exerciseCatalog(chestState());
    const parseOrder = (inputOrder: 'auto' | 'weight-reps' | 'reps-weight') =>
      parseWorkoutText('Crucifixo:13x40', catalog, [], { inputOrder })
        .exercises[0]!.sets[0]!;
    expect(parseOrder('weight-reps')).toMatchObject({ weight: 13, reps: 40 });
    expect(parseOrder('reps-weight')).toMatchObject({ weight: 40, reps: 13 });
    expect(parseOrder('auto')).toMatchObject({
      weight: null,
      reps: null,
      needsOrder: { first: 13, second: 40 },
    });
    expect(importSetErrors(parseOrder('auto')).join(' ')).toMatch(/ordem/);
  });
  it('automático resolve somente quando apenas uma orientação respeita os limites', () => {
    const result = parseWorkoutText(
      'Crucifixo:12x12,5kg;12,5x12;1500x10',
      exerciseCatalog(chestState()),
      [],
      { inputOrder: 'auto' },
    );
    expect(result.exercises[0]!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [12.5, 12],
      [12.5, 12],
      [1500, 10],
    ]);
  });
  it('metadados e interpretação não modificam o estado nem a sequência rotativa', () => {
    const state = chestState();
    const before = structuredClone(state);
    parse('Treino:Peito\nData:17/11/2026\nCrucifixo:40x10', state);
    expect(state).toEqual(before);
  });
  it('contrato antigo sem importSettings continua válido e campos inválidos são rejeitados', () => {
    const state = chestState();
    expect(isAdvancedWorkoutState(state)).toBe(true);
    expect(
      isAdvancedWorkoutState({
        ...state,
        importSettings: { inputOrder: 'guess', aliases: [] },
      }),
    ).toBe(false);
    expect(
      isAdvancedWorkoutState({
        ...state,
        importSettings: {
          inputOrder: 'auto',
          aliases: [{ ...alias(), name: '...' }],
        },
      }),
    ).toBe(false);
  });
});
