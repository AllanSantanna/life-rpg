import { describe, expect, it } from 'vitest';
import { testSession, testSet } from '../testFixtures';
import type { Muscle } from '../types';
import {
  dailyHistory,
  defaultRecoveryConfig,
  metricTone,
  projectMuscles,
} from './model';
import { anatomicalGroups, diagrams } from './anatomy';
const today = '2026-11-20';
const session = (id = 'one', date = today, count = 4) =>
  testSession(
    id,
    date,
    Array.from({ length: count }, (_, i) => testSet(`s${i}`, 20, 10)),
  );
const projected = (sessions = [session()], date = today) =>
  projectMuscles(sessions, date, 'week').summaries;
describe('projeções do mapa: dados reais, sem alterar registros', () => {
  it('pondera séries diretas e secundárias, normaliza e não conta duas vezes', () => {
    const s = session();
    s.exercises[0]!.exercise.secondary = ['chest', 'triceps', 'triceps'];
    const { chest, triceps, biceps } = projected([s]);
    expect(chest).toMatchObject({
      sets: 4,
      direct: 4,
      secondary: 0,
      units: 4,
      volume: 800,
      effort: 100,
      sessions: 1,
    });
    expect(triceps).toMatchObject({
      sets: 4,
      direct: 0,
      secondary: 4,
      units: 2,
      effort: 50,
    });
    expect(biceps.effort).toBeNull();
    expect(biceps.recovery).toBeNull();
  });
  it('não modifica os snapshots, mesmo ao interpretar encolhimentos antigos', () => {
    const s = session();
    s.exercises[0]!.exercise = {
      id: 'shrug',
      name: 'Encolhimento',
      primary: 'back',
      secondary: [],
      equipment: '',
    };
    const copy = structuredClone(s);
    const data = projected([s]);
    expect(data.trapezius.direct).toBe(4);
    expect(data.back.sets).toBe(0);
    expect(s).toEqual(copy);
  });
  it('exclui aquecimento, séries pendentes/incompletas, sessões em andamento e datas futuras/inválidas', () => {
    const s = session();
    s.exercises[0]!.sets = [
      testSet('ok', 0, 10),
      testSet('warm', 20, 10, 'warmup'),
      { ...testSet('pending'), completed: false },
      { ...testSet('missing'), weight: null },
      { ...testSet('bad'), weight: NaN },
    ];
    const result = projected([
      s,
      { ...session('draft'), status: 'in_progress' },
      session('future', '2026-11-21'),
      session('bad', '2026-02-30'),
    ]);
    expect(result.chest.sets).toBe(1);
    expect(result.chest.volume).toBe(0);
  });
  it('inclui o primeiro dia da janela, exclui o anterior e respeita viradas de mês/ano', () => {
    expect(
      projected([session('a', '2026-11-14'), session('b', '2026-11-13')]).chest
        .sets,
    ).toBe(4);
    expect(
      projected([session('a', '2025-12-31')], '2026-01-01').chest.sets,
    ).toBe(4);
    expect(() => projected([], '2026-02-30')).toThrow();
  });
  it('a estimativa aumenta com o tempo e piora com estímulos sobrepostos', () => {
    const s = session('one', '2026-11-15');
    const early = projected([s], '2026-11-15').chest.recovery!;
    const later = projected([s]).chest.recovery!;
    expect(later).toBeGreaterThan(early);
    expect(later).toBeLessThan(100);
    expect(projected([s, session('two')]).chest.recovery!).toBeLessThan(later);
  });
  it('usa 14 dias para recuperação, independentemente da janela de esforço', () => {
    const s = session('old', '2026-11-10');
    const week = projected([s]).chest;
    expect(week.effort).toBeNull();
    expect(week.recovery).not.toBeNull();
    expect(projectMuscles([s], today, 'year').summaries.chest.recovery).toBe(
      week.recovery,
    );
    expect(
      projected([session('older', '2026-11-06')]).chest.recovery,
    ).toBeNull();
  });
  it('não presume RIR zero quando o dado está ausente', () => {
    const missing = session();
    const failure = structuredClone(missing);
    failure.exercises[0]!.sets.forEach((s) => {
      s.rir = 0;
    });
    expect(projected([missing]).chest.rirCount).toBe(0);
    expect(projected([failure]).chest.rirCount).toBe(4);
    expect(projected([failure]).chest.recovery!).toBeLessThan(
      projected([missing]).chest.recovery!,
    );
  });
  it('volume aumenta a carga residual somente com histórico comparável do mesmo exercício', () => {
    const prior = [session('a', '2026-10-30'), session('b', '2026-11-02')];
    const high = session();
    high.exercises[0]!.sets.forEach((s) => {
      s.weight = 80;
    });
    const normal = projected([...prior, session()]).chest.recovery!;
    expect(projected([...prior, high]).chest.recovery!).toBeLessThan(normal);
    expect(projected([high]).chest.recovery).toBe(
      projected([session()]).chest.recovery,
    );
    const different = prior.map((s) => ({
      ...s,
      exercises: s.exercises.map((e) => ({
        ...e,
        exercise: { ...e.exercise, id: 'different' },
      })),
    }));
    expect(projected([...different, high]).chest.recovery).toBe(normal);
  });
  it('recalcula após alteração/exclusão sem totais persistidos', () => {
    const s = session();
    expect(projected([s]).chest.volume).toBe(800);
    s.exercises[0]!.sets.pop();
    expect(projected([s]).chest.volume).toBe(600);
    expect(projected([]).chest).toMatchObject({
      sets: 0,
      effort: null,
      recovery: null,
      volume: 0,
    });
  });
  it('indica exercício sem grupo mapeado', () => {
    const s = session();
    s.exercises[0]!.exercise.primary = 'unknown' as Muscle;
    s.exercises[0]!.exercise.secondary = [];
    expect(projectMuscles([s], today, 'week').unmappedSets).toBe(4);
  });
  it('mantém configuração determinística, valida limites e não divide por zero', () => {
    expect(() =>
      projectMuscles([], today, 'week', {
        ...defaultRecoveryConfig,
        halfLifeDays: 0,
      }),
    ).toThrow();
    expect(() =>
      projectMuscles([], today, 'week', {
        ...defaultRecoveryConfig,
        secondaryWeight: 2,
      }),
    ).toThrow();
    const s = session();
    expect(projected([s])).toEqual(projected([s]));
    const base = projectMuscles([s], today, 'week').summaries.chest.recovery;
    expect(
      projectMuscles([s], today, 'week', {
        ...defaultRecoveryConfig,
        capacity: 24,
      }).summaries.chest.recovery!,
    ).toBeGreaterThan(base!);
  });
  it('classifica os limiares e mantém ausência distinta de zero', () => {
    expect(metricTone(null, 'effort')).toBe('unknown');
    expect(metricTone(0, 'recovery')).toBe('fatigued');
    expect([24, 25, 50, 75].map((v) => metricTone(v, 'effort'))).toEqual([
      'low',
      'moderate',
      'high',
      'very-high',
    ]);
    expect([49, 50, 70, 90].map((v) => metricTone(v, 'recovery'))).toEqual([
      'fatigued',
      'tired',
      'recovering',
      'ready',
    ]);
    expect(metricTone(NaN, 'effort')).toBe('unknown');
  });
  it('gera histórico de datas reais, com ausência explícita nos dias não registrados', () => {
    const history = dailyHistory(projected().chest, today, 'week');
    expect(history).toHaveLength(7);
    expect(history[0]).toEqual({ date: '2026-11-14', units: null });
    expect(history.at(-1)).toEqual({ date: today, units: 4 });
  });
  it('tem IDs únicos, mapeamento explícito para cada vetor e não inventa grupos do domínio', () => {
    expect(
      Object.values(diagrams).reduce(
        (sum, diagram) => sum + diagram.surfaces.length,
        0,
      ),
    ).toBe(58);
    for (const diagram of Object.values(diagrams)) {
      expect(new Set(diagram.surfaces.map((s) => s.id)).size).toBe(
        diagram.surfaces.length,
      );
      for (const s of diagram.surfaces) {
        expect(s.d.startsWith('M')).toBe(true);
        expect(s.group in anatomicalGroups).toBe(true);
      }
    }
    expect(anatomicalGroups.BACK_LOWER).toBe('back');
    expect(anatomicalGroups.OBLIQUES).toBe('core');
    expect(anatomicalGroups.ADDUCTORS).toBeNull();
  });
});
