import { describe, expect, it } from 'vitest';
import { projectMuscles } from './model';
import { testSession, testSet } from '../testFixtures';
import type { WorkoutSession } from '../types';
const at = (time: string) => Date.parse(time);
const now = at('2026-11-20T12:00:00-03:00');
function session(
  id = 'recent',
  date = '2026-11-20',
  time = '10:00',
  count = 9,
  rir: number | null = 0,
): WorkoutSession {
  return {
    ...testSession(
      id,
      date,
      Array.from({ length: count }, (_, i) =>
        testSet(`s${i}`, 40, 10, 'working', rir),
      ),
      'legpress',
    ),
    startedAt: `${date}T${time}:00-03:00`,
  };
}
const summary = (sessions: WorkoutSession[], reference = now) =>
  projectMuscles(sessions, reference, 'month').summaries.quadriceps;
describe('recuperação em tempo contínuo, sem normalização global', () => {
  it('diferencia horas no mesmo dia e evolui sem saltar à meia-noite', () => {
    const recent = session('recent', '2026-11-19', '23:30');
    const early = summary([recent], at('2026-11-20T00:30:00-03:00'));
    const late = summary([recent], at('2026-11-20T11:30:00-03:00'));
    expect(early.recoveryTiming?.minElapsedHours).toBe(1);
    expect(late.recovery!).toBeGreaterThan(early.recovery!);
    const before = summary(
      [recent],
      at('2026-11-19T23:59:00-03:00'),
    ).residualBurden;
    const after = summary(
      [recent],
      at('2026-11-20T00:01:00-03:00'),
    ).residualBurden;
    expect(Math.abs(before - after) / before).toBeLessThan(0.001);
  });
  it('treino equivalente há 2 horas deixa mais carga residual que há 26 horas', () => {
    const twoHours = summary([session('a', '2026-11-20', '10:00')]);
    const dayAgo = summary([session('b', '2026-11-19', '10:00')]);
    expect(twoHours.recoveryTiming?.minElapsedHours).toBe(2);
    expect(dayAgo.recoveryTiming?.minElapsedHours).toBe(26);
    expect(twoHours.residualBurden).toBeGreaterThan(dayAgo.residualBurden);
    expect(twoHours.recovery!).toBeLessThan(dayAgo.recovery!);
    // Same burden and decay 2^(-h/48): 24 h of difference multiplies it by 2^(-0.5).
    expect(dayAgo.residualBurden / twoHours.residualBurden).toBeCloseTo(
      2 ** -0.5,
      10,
    );
  });
  it('reproduz os exemplos simulados documentados no README', () => {
    const start = at('2026-11-20T10:00:00-03:00');
    const recovery = (rir: number | null, hours: number) =>
      summary(
        [session('x', '2026-11-20', '10:00', 9, rir)],
        start + hours * 36e5,
      ).recovery;
    expect([2, 26, 50, 98].map((h) => recovery(0, h))).toEqual([
      42, 54, 65, 80,
    ]);
    expect([recovery(null, 2), recovery(null, 26)]).toEqual([48, 60]);
    const consecutive = summary([
      session('d1', '2026-11-19', '10:00'),
      session('d2', '2026-11-20', '10:00'),
    ]);
    expect(consecutive.recovery).toBe(22);
  });
  it('evolui de forma monotônica, hora a hora, durante 72 horas', () => {
    const recent = session('r', '2026-11-19', '15:30');
    const start = at('2026-11-19T15:30:00-03:00');
    const values = Array.from(
      { length: 73 },
      (_, h) => summary([recent], start + h * 3600000).residualBurden,
    );
    for (let h = 1; h < values.length; h += 1)
      expect(values[h]!).toBeLessThan(values[h - 1]!);
  });
  it('trata RIR ausente como desconhecido: não equivale a falha nem ganha peso extra', () => {
    const unknown = summary([session('u', '2026-11-20', '10:00', 9, null)]);
    const rir0 = summary([session('z', '2026-11-20', '10:00', 9, 0)]);
    const rir4 = summary([session('f', '2026-11-20', '10:00', 9, 4)]);
    expect(unknown.rirCount).toBe(0);
    expect(rir0.rirCount).toBe(9);
    expect(unknown.residualBurden).toBe(rir4.residualBurden);
    expect(unknown.residualBurden).toBeLessThan(rir0.residualBurden);
  });
  it('recalcula após exclusão de uma sessão do mesmo grupo', () => {
    const recent = session();
    const yesterday = session('yesterday', '2026-11-19', '18:00');
    const both = summary([recent, yesterday]);
    const afterDelete = summary([recent]);
    expect(afterDelete.recovery!).toBeGreaterThan(both.recovery!);
    expect(afterDelete.residualBurden).toBeLessThan(both.residualBurden);
    expect(summary([yesterday]).recoveryTiming?.startedAt).toBe(
      yesterday.startedAt,
    );
  });
  it('treino intenso recente exige maior carga de recuperação que sessão leve', () => {
    const intense = summary([session()]);
    const light = summary([session('light', '2026-11-20', '10:00', 2, 4)]);
    expect(intense.recovery!).toBeLessThan(50);
    expect(light.recovery!).toBeGreaterThan(intense.recovery!);
    expect(
      summary([session('near', '2026-11-20', '10:00', 9, 0)]).recovery!,
    ).toBeLessThan(
      summary([session('far', '2026-11-20', '10:00', 9, 4)]).recovery!,
    );
  });
  it('não dilui treino recente com histórico anterior ou máximos de outros músculos', () => {
    const recent = session();
    const base = summary([recent]).recovery;
    const other = testSession(
      'other',
      '2026-11-20',
      Array.from({ length: 80 }, (_, i) => testSet(`s${i}`, 100, 10)),
      'bench',
    );
    expect(summary([recent, other]).recovery).toBe(base);
    const old = session('old', '2026-11-01', '12:00', 80, 0);
    expect(summary([old, recent]).recovery!).toBeLessThanOrEqual(base!);
    expect(
      projectMuscles([recent], now, 'week').summaries.quadriceps.recovery,
    ).toBe(projectMuscles([recent], now, 'year').summaries.quadriceps.recovery);
  });
  it('acumula sessões consecutivas e sessões sobrepostas no mesmo dia', () => {
    const recent = session();
    const base = summary([recent]);
    const yesterday = session('yesterday', '2026-11-19', '18:00');
    const morning = session('morning', '2026-11-20', '08:00');
    expect(summary([recent, yesterday]).recovery!).toBeLessThan(base.recovery!);
    expect(summary([recent, morning]).recovery!).toBeLessThan(base.recovery!);
    expect(summary([recent, yesterday]).recoveryTiming?.startedAt).toBe(
      recent.startedAt,
    );
  });
  it('usa o limite conservador do intervalo antigo, não converte ausência em meia-noite', () => {
    const legacy = testSession(
      'old',
      '2026-11-19',
      Array.from({ length: 9 }, (_, i) =>
        testSet(`s${i}`, 40, 10, 'working', 0),
      ),
      'legpress',
    );
    const localNow = new Date('2026-11-20T12:00:00').getTime();
    const data = summary([legacy], localNow);
    expect(data.recoveryTiming?.startedAt).toBeNull();
    expect(data.recoveryTiming?.minElapsedHours).toBe(12);
    expect(data.recovery).toBe(
      Math.round(100 * Math.exp(-(10.8 * 2 ** (-12 / 48)) / 12)),
    );
    expect(legacy.startedAt).toBeUndefined();
  });
  it('recalcula horário, data, exclusão e séries sem duplicação ou mutação', () => {
    const recent = session();
    const snapshot = structuredClone(recent);
    const later = { ...recent, startedAt: '2026-11-20T11:30:00-03:00' };
    expect(summary([later]).recoveryTiming?.minElapsedHours).toBe(0.5);
    expect(summary([later]).residualBurden).toBeGreaterThan(
      summary([recent]).residualBurden,
    );
    const older = {
      ...recent,
      date: '2026-11-18',
      startedAt: '2026-11-18T10:00:00-03:00',
    };
    expect(summary([older]).recovery!).toBeGreaterThan(
      summary([recent]).recovery!,
    );
    expect(summary([]).recovery).toBeNull();
    expect(recent).toEqual(snapshot);
  });
  it('não usa estímulo futuro, compara instantes com fuso e nunca concede 100% medido', () => {
    const future = session('future', '2026-11-20', '13:00');
    expect(summary([future]).recovery).toBeNull();
    expect(summary([future]).sets).toBe(0);
    const utc = { ...session(), startedAt: '2026-11-20T13:00:00+00:00' };
    expect(summary([utc]).recovery).toBe(summary([session()]).recovery);
    expect(
      summary([session('old', '2026-11-07', '12:00', 1, 4)]).recovery!,
    ).toBeLessThan(100);
  });
});
