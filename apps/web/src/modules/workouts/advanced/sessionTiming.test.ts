import { createLocalStateStorage } from '../../../shared/storage/localStateStorage';
import { describe, expect, it, vi } from 'vitest';
import {
  assertStartNotFuture,
  createSessionStart,
  currentSessionStart,
  displaySessionDate,
  elapsedLabel,
  isSessionStart,
  isWorkoutTime,
  sessionTime,
  timingAt,
  withSessionTiming,
} from './sessionTiming';
import { applyAdvancedWorkoutCommand } from './commands';
import { testSession, testSet } from './testFixtures';
import { isSession } from './validation';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_VERSION,
  PLAYER_STORAGE_KEY,
} from '../../../app/playerState';
import { emptyAdvancedWorkouts } from './types';
const today = '2026-11-20';
describe('data, início e compatibilidade de sessões', () => {
  it('aceita HH:mm de 24 horas e rejeita horários/datas/offsets inválidos', () => {
    for (const time of ['00:00', '15:30', '23:59'])
      expect(isWorkoutTime(time)).toBe(true);
    for (const time of ['24:00', '15:60', '9:30', '15:3', '12:00 PM', ''])
      expect(isWorkoutTime(time)).toBe(false);
    const session = testSession('s', today);
    for (const value of [
      '2026-11-20T25:00:00-03:00',
      '2026-11-20T15:30:00+14:01',
      '2026-11-20T15:30:00+15:00',
      '2026-11-19T15:30:00-03:00',
      '2026-11-20T15:30:00',
      'invalid',
    ])
      expect(isSession({ ...session, startedAt: value })).toBe(false);
    expect(() => createSessionStart('2026-02-30', '15:30')).toThrow();
    expect(() => createSessionStart(today, '24:00')).toThrow();
  });
  it('cria início com offset local histórico, sem duplicar a sessão', () => {
    const startedAt = createSessionStart(today, '15:30');
    const state = applyAdvancedWorkoutCommand(
      emptyAdvancedWorkouts(),
      { type: 'startSession', id: 's', planId: null, date: today, startedAt },
      today,
    );
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]?.startedAt).toBe(startedAt);
    expect(sessionTime(state.sessions[0]!)).toBe('15:30');
    expect(isSessionStart(startedAt, today)).toBe(true);
    expect(() =>
      applyAdvancedWorkoutCommand(
        state,
        { type: 'startSession', id: 's', planId: null, date: today, startedAt },
        today,
      ),
    ).toThrow(/já utilizado/);
  });
  it('corrige horário e data atomicamente, preservando IDs, séries e RIR', () => {
    const original = testSession('s', '2026-11-19', [
      testSet('a', 40, 12, 'working', 0),
      testSet('b', 45, 8, 'working', 2),
    ]);
    const snapshot = structuredClone(original);
    let state = { ...emptyAdvancedWorkouts(), sessions: [original] };
    const corrected = withSessionTiming(original, '2026-11-18', '15:30');
    state = applyAdvancedWorkoutCommand(
      state,
      { type: 'saveSession', value: corrected },
      today,
    );
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.date).toBe('2026-11-18');
    expect(sessionTime(state.sessions[0]!)).toBe('15:30');
    expect(state.sessions[0]!.exercises).toEqual(snapshot.exercises);
    expect(original).toEqual(snapshot);
    const onlyTime = withSessionTiming(
      state.sessions[0]!,
      '2026-11-18',
      '18:45',
    );
    state = applyAdvancedWorkoutCommand(
      state,
      { type: 'saveSession', value: onlyTime },
      today,
    );
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.exercises).toEqual(snapshot.exercises);
  });
  it('mantém sessões antigas sem horário e não preenche nem regrava timestamps na leitura', () => {
    const player = createInitialPlayerState();
    const session = testSession('legacy', '2026-10-01');
    player.records.advancedWorkouts = {
      ...emptyAdvancedWorkouts(),
      sessions: [session],
    };
    const snapshot = JSON.stringify(player);
    expect(isSession(session)).toBe(true);
    expect(isPlayerState(player)).toBe(true);
    const raw = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: player,
    });
    const write = vi.fn();
    const storage = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      PLAYER_STORAGE_VERSION,
      isPlayerState,
      () => ({ getItem: () => raw, setItem: write }),
      migratePlayerState,
    );
    expect(storage.load()).toEqual({ status: 'loaded', data: player });
    expect(storage.load()).toEqual({ status: 'loaded', data: player });
    expect(write).not.toHaveBeenCalled();
    expect(JSON.stringify(player)).toBe(snapshot);
    expect(
      withSessionTiming(session, '2026-10-02', '').startedAt,
    ).toBeUndefined();
    expect(sessionTime(session)).toBe('');
    expect(displaySessionDate(session)).toBe('01/10/2026');
  });
  it('preserva um timestamp conhecido ao salvar campos não temporais ou confirmar a mesma data/hora', () => {
    const original = {
      ...testSession('s', '2026-11-19'),
      startedAt: '2026-11-19T15:30:00-03:00',
    };
    expect(withSessionTiming(original, original.date, '15:30')).toBe(original);
    const state = applyAdvancedWorkoutCommand(
      { ...emptyAdvancedWorkouts(), sessions: [original] },
      { type: 'saveSession', value: { ...original, notes: 'editado' } },
      today,
    );
    expect(state.sessions[0]?.startedAt).toBe(original.startedAt);
    expect(
      isPlayerState({
        ...createInitialPlayerState(),
        records: {
          ...createInitialPlayerState().records,
          advancedWorkouts: state,
        },
      }),
    ).toBe(true);
  });
  it('calcula o mesmo tempo absoluto com offsets diferentes, atravessando meia-noite', () => {
    const now = Date.parse('2026-11-20T00:30:00-03:00');
    const a = timingAt(
      { date: '2026-11-19', startedAt: '2026-11-19T23:30:00-03:00' },
      now,
    )!;
    const b = timingAt(
      { date: '2026-11-20', startedAt: '2026-11-20T02:30:00+00:00' },
      now,
    )!;
    expect(a.minElapsedHours).toBe(1);
    expect(b.minElapsedHours).toBe(1);
    expect(elapsedLabel(a)).toBe('1h');
    expect(
      timingAt({ date: today, startedAt: '2026-11-20T12:00:00-03:00' }, now),
    ).toBeNull();
  });
  it('respeita offsets explícitos na transição de horário de verão', () => {
    const before = {
      date: '2026-03-08',
      startedAt: '2026-03-08T01:30:00-05:00',
    };
    const after = Date.parse('2026-03-08T03:30:00-04:00');
    expect(timingAt(before, after)?.minElapsedHours).toBe(1);
    const first = {
      date: '2026-11-01',
      startedAt: '2026-11-01T01:30:00-04:00',
    };
    expect(
      timingAt(first, Date.parse('2026-11-01T01:30:00-05:00'))?.minElapsedHours,
    ).toBe(1);
  });
  it('preenche o início atual apenas para a data local corrente e rejeita início futuro', () => {
    const now = new Date('2026-11-20T15:30:00');
    expect(currentSessionStart(today, now)).toBe(
      createSessionStart(today, '15:30'),
    );
    expect(currentSessionStart('2026-11-19', now)).toBeUndefined();
    const future = createSessionStart(today, '16:00');
    expect(() => assertStartNotFuture(future, now.getTime())).toThrow(/futuro/);
    expect(() =>
      assertStartNotFuture(createSessionStart(today, '15:30'), now.getTime()),
    ).not.toThrow();
    expect(() => assertStartNotFuture(undefined, now.getTime())).not.toThrow();
  });
  it('calcula intervalo para horário desconhecido sem persistir nem inventar um início', () => {
    const date = '2026-11-19';
    const start = new Date(`${date}T00:00:00`);
    const now = new Date('2026-11-20T12:00:00').getTime();
    const session = testSession('s', date);
    const timing = timingAt(session, now)!;
    expect(timing.startedAt).toBeNull();
    expect(timing.minElapsedHours).toBe(12);
    expect(timing.maxElapsedHours).toBe((now - start.getTime()) / 3600000);
    expect(session.startedAt).toBeUndefined();
    expect(elapsedLabel(timing)).toMatch(/^Entre 12h e /);
  });
});
