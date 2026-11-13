import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProgressFeedback } from './useProgressFeedback';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Feedback visual de progressão', () => {
  it('não celebra valores iniciais e ignora a reversão de progresso', () => {
    const { result, rerender } = renderHook(useProgressFeedback, {
      initialProps: 1640,
    });
    expect(result.current.delta).toBe(0);
    rerender(1790);
    expect(result.current.delta).toBe(150);
    rerender(1640);
    expect(result.current.delta).toBe(0);
  });

  it('reinicia a duração para ganhos consecutivos e limpa o feedback', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(useProgressFeedback, {
      initialProps: 1640,
    });
    rerender(1790);
    act(() => vi.advanceTimersByTime(1000));
    rerender(1890);
    expect(result.current).toEqual({ delta: 100, sequence: 2 });
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.delta).toBe(100);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.delta).toBe(0);
  });

  it('celebra somente a transição de conquista bloqueada para desbloqueada', () => {
    const { result, rerender } = renderHook(useProgressFeedback, {
      initialProps: 0,
    });
    expect(result.current.delta).toBe(0);
    rerender(1);
    expect(result.current.delta).toBe(1);
    rerender(1);
    expect(result.current.sequence).toBe(1);
    rerender(0);
    expect(result.current.delta).toBe(0);
  });

  it('cancela o temporizador ao desmontar o componente', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(useProgressFeedback, {
      initialProps: 12,
    });
    rerender(13);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
