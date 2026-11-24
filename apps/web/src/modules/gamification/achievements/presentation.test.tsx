import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyRecords, type LifeRecords } from '../../records/types';
import { emptyGoals } from '../../goals/types';
import { projectAchievements } from './evaluate';
import {
  ACHIEVEMENT_PRESENTATION_KEY,
  createAchievementPresentationStorage,
  isAchievementPresentation,
  useAchievementUnlocks,
  USER_ACTION_WINDOW_MS,
} from './presentation';
import {
  ACHIEVEMENTS_VIEW_KEY,
  isAchievementsView,
  useAchievementsView,
} from './viewPreferences';

const today = '2026-11-13';
const statuses = (records: LifeRecords) =>
  projectAchievements({ records, missions: [], goals: emptyGoals(), today });
const empty = statuses(emptyRecords());
const oneWorkout = statuses({
  ...emptyRecords(),
  workouts: [{ date: today, trained: true }],
});
const twoPillars = statuses({
  ...emptyRecords(),
  workouts: [{ date: today, trained: true }],
  readings: [{ id: 'r', bookId: 'b', date: today, pages: 3 }],
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('Apresentação de desbloqueio', () => {
  it('não anima nem grava conquistas já desbloqueadas na abertura', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useAchievementUnlocks(oneWorkout));
    expect(result.current.queue).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
  });

  it('anima somente o que foi desbloqueado por uma ação do usuário', () => {
    const { result, rerender } = renderHook(
      ({ list }) => useAchievementUnlocks(list),
      { initialProps: { list: empty } },
    );
    act(() => result.current.markUserAction());
    rerender({ list: oneWorkout });
    expect(result.current.queue.map((item) => item.id)).toEqual([
      'training-first',
      'first',
    ]);
    // Grava apenas ao dispensar.
    expect(localStorage.getItem(ACHIEVEMENT_PRESENTATION_KEY)).toBeNull();
    act(() => result.current.next());
    expect(result.current.queue.map((item) => item.id)).toEqual(['first']);
    act(() => result.current.dismissAll());
    expect(result.current.queue).toEqual([]);
    const saved = JSON.parse(
      localStorage.getItem(ACHIEVEMENT_PRESENTATION_KEY)!,
    );
    expect(saved).toEqual({
      version: 1,
      data: { seen: ['training-first', 'first'] },
    });
  });

  it('importar, restaurar ou sincronizar outra aba (sem ação do usuário) não anima', () => {
    const { result, rerender } = renderHook(
      ({ list }) => useAchievementUnlocks(list),
      { initialProps: { list: empty } },
    );
    rerender({ list: twoPillars });
    expect(result.current.queue).toEqual([]);
  });

  it('a marca de ação expira e não é atribuída a uma mudança posterior', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ list }) => useAchievementUnlocks(list),
      { initialProps: { list: empty } },
    );
    act(() => result.current.markUserAction());
    vi.advanceTimersByTime(USER_ACTION_WINDOW_MS + 1);
    rerender({ list: oneWorkout });
    expect(result.current.queue).toEqual([]);
  });

  it('não repete a apresentação ao perder e reconquistar na mesma sessão', () => {
    const { result, rerender } = renderHook(
      ({ list }) => useAchievementUnlocks(list),
      { initialProps: { list: empty } },
    );
    act(() => result.current.markUserAction());
    rerender({ list: oneWorkout });
    act(() => result.current.dismissAll());
    act(() => result.current.markUserAction());
    rerender({ list: empty });
    act(() => result.current.markUserAction());
    rerender({ list: oneWorkout });
    expect(result.current.queue).toEqual([]);
  });

  it('não repete em outra sessão o que já foi apresentado', () => {
    localStorage.setItem(
      ACHIEVEMENT_PRESENTATION_KEY,
      JSON.stringify({ version: 1, data: { seen: ['training-first'] } }),
    );
    const { result, rerender } = renderHook(
      ({ list }) => useAchievementUnlocks(list),
      { initialProps: { list: empty } },
    );
    act(() => result.current.markUserAction());
    rerender({ list: oneWorkout });
    expect(result.current.queue.map((item) => item.id)).toEqual(['first']);
  });

  it('valor inválido não quebra: é tratado como vazio e substituído ao gravar', () => {
    localStorage.setItem(ACHIEVEMENT_PRESENTATION_KEY, '{corrompido');
    const { result, rerender } = renderHook(
      ({ list }) => useAchievementUnlocks(list),
      { initialProps: { list: empty } },
    );
    act(() => result.current.markUserAction());
    rerender({ list: oneWorkout });
    act(() => result.current.dismissAll());
    expect(createAchievementPresentationStorage().load()).toMatchObject({
      status: 'loaded',
    });
  });

  it('valida o formato do estado de apresentação', () => {
    expect(isAchievementPresentation({ seen: ['a', 'b'] })).toBe(true);
    expect(isAchievementPresentation({ seen: ['a', 'a'] })).toBe(false);
    expect(isAchievementPresentation({ seen: [1] })).toBe(false);
    expect(isAchievementPresentation({ seen: [], extra: true })).toBe(false);
    expect(isAchievementPresentation([])).toBe(false);
  });
});

describe('Preferência "Ocultar galeria"', () => {
  it('começa desativada, não grava na leitura e persiste ao alternar', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const { result, unmount } = renderHook(() => useAchievementsView());
    expect(result.current[0]).toEqual({ featuredOnly: false });
    expect(writes).not.toHaveBeenCalled();
    act(() => result.current[1]({ featuredOnly: true }));
    unmount();
    const again = renderHook(() => useAchievementsView());
    expect(again.result.current[0]).toEqual({ featuredOnly: true });
    expect(JSON.parse(localStorage.getItem(ACHIEVEMENTS_VIEW_KEY)!)).toEqual({
      version: 1,
      data: { featuredOnly: true },
    });
  });

  it('valida o formato', () => {
    expect(isAchievementsView({ featuredOnly: true })).toBe(true);
    expect(isAchievementsView({ featuredOnly: 'sim' })).toBe(false);
    expect(isAchievementsView({ featuredOnly: true, x: 1 })).toBe(false);
  });
});
