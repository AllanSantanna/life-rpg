import { describe, expect, it } from 'vitest';
import { starterExercises } from '../catalog';
import { libraryExercises } from '../library';
import { testSet } from '../testFixtures';
import type { Exercise, WorkoutSession } from '../types';
import { projectMuscles } from './model';
import {
  exerciseParticipation,
  isMapGroup,
  mapGroups,
  reviewedParticipation,
  type MapGroup,
} from './participation';

const catalog = [...starterExercises, ...libraryExercises];
const exercise = (id: string) =>
  structuredClone(catalog.find((e) => e.id === id)!);
const now = Date.parse('2026-11-20T12:00:00-03:00');
function session(
  id: string,
  entries: [Exercise | string, number][],
  date = '2026-11-20',
  time = '10:00',
): WorkoutSession {
  return {
    id,
    date,
    startedAt: `${date}T${time}:00-03:00`,
    planId: null,
    planName: 'Treino',
    status: 'completed',
    notes: '',
    exercises: entries.map(([e, count], i) => ({
      id: `${id}:${i}`,
      exercise: typeof e === 'string' ? exercise(e) : e,
      notes: '',
      sets: Array.from({ length: count }, (_, j) =>
        testSet(`${id}-${i}-${j}`, 40, 10, 'working', 2),
      ),
    })),
  };
}
const project = (sessions: WorkoutSession[], period = 'month' as const) =>
  projectMuscles(sessions, now, period).summaries;
const role = (id: string, group: MapGroup) =>
  exerciseParticipation(exercise(id)).find((p) => p.group === group)?.role;

describe('participação muscular: principal, secundário e estabilizador', () => {
  it('a tabela revisada só referencia exercícios e grupos existentes', () => {
    for (const [id, review] of Object.entries(reviewedParticipation)) {
      expect(catalog.some((e) => e.id === id)).toBe(true);
      for (const group of [
        review.primary,
        ...(review.secondary ?? []),
        ...(review.stabilizers ?? []),
      ])
        expect(isMapGroup(group)).toBe(true);
    }
    for (const e of catalog) {
      const groups = exerciseParticipation(e).map((p) => p.group);
      expect(new Set(groups).size).toBe(groups.length);
      expect(exerciseParticipation(e)[0]?.role).toBe('primary');
    }
  });

  it('identifica principal e secundário e não ativa grupos sem relação', () => {
    expect(role('bench', 'chest')).toBe('primary');
    expect(role('bench', 'triceps')).toBe('secondary');
    const data = project([session('s', [['bench', 3]])]);
    expect(data.chest.units).toBe(3);
    expect(data.triceps.units).toBe(1.5);
    for (const group of [
      'core',
      'lowerBack',
      'adductors',
      'abductors',
      'quadriceps',
    ] as const) {
      expect(data[group].contributions).toEqual([]);
      expect(data[group].effort).toBeNull();
      expect(data[group].recovery).toBeNull();
    }
  });

  it('abdômen no agachamento é estabilizador: rastreado, sem estímulo nem recuperação', () => {
    expect(role('squat', 'core')).toBe('stabilizer');
    const data = project([session('s', [['squat', 4]])]);
    expect(data.core.units).toBe(0);
    expect(data.core.sets).toBe(0);
    expect(data.core.effort).toBeNull();
    expect(data.core.recovery).toBeNull();
    expect(data.core.contributions).toMatchObject([
      {
        exerciseName: 'Agachamento livre',
        role: 'stabilizer',
        sets: 4,
        units: 0,
        burden: 0,
        residual: 0,
        reason: 'Estabilização do tronco durante o movimento.',
      },
    ]);
    const crunch = project([session('c', [['crunch', 3]])]).core;
    expect(crunch.units).toBe(3);
    expect(crunch.contributions[0]?.role).toBe('primary');
  });

  it('agachamento livre conta o adutor magno como secundário (0,5)', () => {
    expect(role('squat', 'adductors')).toBe('secondary');
    expect(role('library:bodyweight-squat', 'adductors')).toBeUndefined();
    expect(role('legpress', 'adductors')).toBeUndefined();
    const data = project([session('s', [['squat', 4]])]);
    expect(data.adductors.units).toBe(2);
    expect(data.adductors.recovery).not.toBeNull();
    expect(data.adductors.contributions[0]?.reason).toMatch(/adutor magno/i);
  });

  it('exercícios unilaterais registram estabilização do quadril sem estímulo', () => {
    expect(role('library:bulgarian-squat', 'abductors')).toBe('stabilizer');
    expect(role('library:lunge', 'adductors')).toBe('stabilizer');
    const data = project([session('s', [['library:bulgarian-squat', 3]])]);
    expect(data.abductors.units).toBe(0);
    expect(data.abductors.effort).toBeNull();
    expect(data.abductors.contributions[0]?.reason).toMatch(/pelve/);
    expect(data.quadriceps.units).toBe(3);
    expect(data.glutes.units).toBe(1.5);
  });

  it('cadeiras adutora e abdutora pontuam os próprios grupos', () => {
    const data = project([
      session('s', [
        ['library:adductor', 3],
        ['library:abductor', 2],
      ]),
    ]);
    expect(data.adductors.units).toBe(3);
    expect(data.abductors.units).toBe(2);
    expect(data.glutes.units).toBe(1);
    // Cadeira adutora antes era classificada como quadríceps.
    expect(data.quadriceps.contributions).toEqual([]);
  });

  it('não conta em dobro: rastros somam exatamente esforço e carga residual', () => {
    const custom: Exercise = {
      id: 'custom-uuid',
      name: 'Exercício próprio',
      primary: 'glutes',
      secondary: ['glutes', 'hamstrings', 'hamstrings'],
      equipment: '',
    };
    expect(exerciseParticipation(custom)).toHaveLength(2);
    const data = project([
      session('a', [
        ['squat', 4],
        ['library:rdl', 3],
        [custom, 2],
      ]),
      session('b', [['library:sumo-deadlift', 2]], '2026-11-18'),
    ]);
    for (const group of mapGroups) {
      const s = data[group];
      const counted = s.contributions.filter((c) => c.inPeriod);
      expect(counted.reduce((n, c) => n + c.units, 0)).toBeCloseTo(s.units, 10);
      expect(s.contributions.reduce((n, c) => n + c.residual, 0)).toBeCloseTo(
        s.residualBurden,
        10,
      );
      expect(new Set(s.contributions.map((c) => c.key)).size).toBe(
        s.contributions.length,
      );
    }
    expect(data.glutes.units).toBe(4 * 0.5 + 3 * 0.5 + 2 + 2);
  });

  it('lista apenas o histórico real e acompanha edição e exclusão', () => {
    expect(project([]).quadriceps.contributions).toEqual([]);
    const a = session('a', [['squat', 4]], '2026-11-19', '18:30');
    const b = session('b', [['squat', 2]]);
    let data = project([a, b]).quadriceps;
    expect(data.contributions.map((c) => [c.sessionId, c.sets])).toEqual([
      ['b', 2],
      ['a', 4],
    ]);
    expect(data.contributions[1]?.startedAt).toBe('2026-11-19T18:30:00-03:00');
    const edited = structuredClone(a);
    edited.exercises[0]!.sets.pop();
    data = project([edited, b]).quadriceps;
    expect(data.contributions.find((c) => c.sessionId === 'a')?.sets).toBe(3);
    data = project([b]).quadriceps;
    expect(data.contributions.map((c) => c.sessionId)).toEqual(['b']);
    expect(data.units).toBe(2);
  });

  it('mantém sessões antigas: reinterpreta em memória sem regravar snapshots', () => {
    const legacyDeadlift = session('old', [['deadlift', 3]]);
    // Snapshot antigo: Costas como secundário do terra, sem Lombar.
    expect(legacyDeadlift.exercises[0]!.exercise.secondary).toContain('back');
    const snapshot = structuredClone(legacyDeadlift);
    const data = project([legacyDeadlift]);
    expect(data.lowerBack.units).toBe(1.5);
    expect(data.back.units).toBe(0);
    expect(data.back.contributions[0]?.role).toBe('stabilizer');
    expect(legacyDeadlift).toEqual(snapshot);
    const shrug: Exercise = {
      id: 'shrug',
      name: 'Encolhimento com halteres',
      primary: 'back',
      secondary: ['forearms'],
      equipment: 'Halteres',
    };
    expect(exerciseParticipation(shrug)[0]).toMatchObject({
      group: 'trapezius',
      role: 'primary',
      source: 'record',
    });
    const custom: Exercise = {
      id: 'mine',
      name: 'Agachamento livre',
      primary: 'quadriceps',
      secondary: ['core'],
      equipment: 'Barra',
    };
    // Exercício próprio mantém o papel salvo pelo usuário, mesmo com nome igual.
    expect(exerciseParticipation(custom)).toContainEqual(
      expect.objectContaining({ group: 'core', role: 'secondary' }),
    );
  });

  it('Esforço normaliza entre todos os grupos e Recuperação ignora estabilizadores', () => {
    const data = project([
      session('s', [
        ['library:adductor', 4],
        ['library:farmer-walk', 2],
      ]),
    ]);
    expect(data.adductors.effort).toBe(100);
    expect(data.forearms.effort).toBe(50);
    expect(data.core.effort).toBeNull();
    expect(data.trapezius.recovery).toBeNull();
    expect(data.core.contributions[0]?.reason).toMatch(/inclinação lateral/);
    const recovery = projectMuscles(
      [session('s', [['squat', 4]])],
      now + 20 * 86400000,
      'month',
    ).summaries.quadriceps;
    expect(recovery.contributions[0]).toMatchObject({
      inRecoveryWindow: false,
      residual: 0,
    });
  });
});
