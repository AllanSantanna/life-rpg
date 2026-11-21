import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialPlayerState, type PlayerState } from './playerState';
import { usePlayerState } from './usePlayerState';
import type {
  PlayerRepository,
  RepositoryLoad,
  RepositoryWrite,
} from '../shared/storage/transactionalStateStorage';
afterEach(cleanup);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const raw = (data: PlayerState) => JSON.stringify({ version: 8, data });
const loaded = (
  data: PlayerState,
  token = 'idb:1',
): RepositoryLoad<PlayerState> => ({
  status: 'loaded',
  data,
  raw: raw(data),
  token,
});

describe('confirmação assíncrona dos registros', () => {
  it('aguarda hidratação e não permite ações antes de carregar os registros', async () => {
    const initial = deferred<RepositoryLoad<PlayerState>>();
    const repo: PlayerRepository<PlayerState> = {
      load: () => initial.promise,
      readRaw: () => Promise.resolve(null),
      write: () => Promise.resolve({ status: 'failed' }),
      subscribe: () => () => {},
    };
    const { result } = renderHook(() => usePlayerState('2026-11-21', repo));
    expect(result.current.ready).toBe(false);
    expect(() => result.current.setState(createInitialPlayerState())).toThrow(
      /ainda não foram carregados/,
    );
    const original = createInitialPlayerState();
    original.profile.name = 'Registros preservados';
    await act(async () => {
      initial.resolve(loaded(original));
      await initial.promise;
    });
    expect(result.current.ready).toBe(true);
    expect(result.current.state.profile.name).toBe('Registros preservados');
  });

  it('leitura indisponível não libera um jogador vazio para gravação', async () => {
    const repo: PlayerRepository<PlayerState> = {
      load: () => Promise.resolve({ status: 'unavailable' }),
      readRaw: () => Promise.resolve(null),
      write: () => {
        throw new Error('Não deve gravar');
      },
      subscribe: () => () => {},
    };
    const { result } = renderHook(() => usePlayerState('2026-11-21', repo));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.ready).toBe(false);
    expect(result.current.persistence.kind).toBe('session');
    expect(() => result.current.setState(createInitialPlayerState())).toThrow();
  });

  it('serializa alterações locais e só marca salvo depois do commit, sem perder o segundo comando', async () => {
    const original = createInitialPlayerState();
    const writes: {
      data: PlayerState;
      expected: string | null;
      pending: ReturnType<typeof deferred<RepositoryWrite>>;
    }[] = [];
    const repo: PlayerRepository<PlayerState> = {
      load: () => Promise.resolve(loaded(original)),
      readRaw: () => Promise.resolve(raw(original)),
      subscribe: () => () => {},
      write(data, expected) {
        const pending = deferred<RepositoryWrite>();
        writes.push({ data, expected, pending });
        return pending.promise;
      },
    };
    const { result } = renderHook(() => usePlayerState('2026-11-21', repo));
    await act(async () => {
      await Promise.resolve();
    });
    act(() =>
      result.current.setState((before) => ({
        ...before,
        profile: { ...before.profile, name: 'Primeira' },
      })),
    );
    expect(result.current.persistence.kind).toBe('saving');
    expect(writes).toHaveLength(1);
    act(() =>
      result.current.setState((before) => ({
        ...before,
        profile: { ...before.profile, focus: 'Segunda alteração' },
      })),
    );
    expect(writes).toHaveLength(1);
    await act(async () => {
      writes[0]!.pending.resolve({
        status: 'saved',
        raw: raw(writes[0]!.data),
        token: 'idb:2',
      });
      await Promise.resolve();
    });
    expect(writes).toHaveLength(2);
    expect(writes[1]!.expected).toBe('idb:2');
    expect(writes[1]!.data.profile).toMatchObject({
      name: 'Primeira',
      focus: 'Segunda alteração',
    });
    await act(async () => {
      writes[1]!.pending.resolve({
        status: 'saved',
        raw: raw(writes[1]!.data),
        token: 'idb:3',
      });
      await Promise.resolve();
    });
    expect(result.current.persistence.kind).toBe('saved');
  });

  it('uma leitura de notificação atrasada não substitui um comando ou commit mais recente', async () => {
    const original = createInitialPlayerState();
    const delayed = deferred<RepositoryLoad<PlayerState>>();
    let reads = 0;
    let notify = () => {};
    const repo: PlayerRepository<PlayerState> = {
      load: () =>
        ++reads === 1 ? Promise.resolve(loaded(original)) : delayed.promise,
      readRaw: () => Promise.resolve(raw(original)),
      subscribe(listener) {
        notify = listener;
        return () => {};
      },
      write: (data) =>
        Promise.resolve({ status: 'saved', raw: raw(data), token: 'idb:2' }),
    };
    const { result } = renderHook(() => usePlayerState('2026-11-21', repo));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => notify());
    await act(async () => {
      result.current.setState((before) => ({
        ...before,
        profile: { ...before.profile, name: 'Mais recente' },
      }));
      await Promise.resolve();
    });
    await act(async () => {
      delayed.resolve(loaded(original));
      await delayed.promise;
    });
    expect(result.current.state.profile.name).toBe('Mais recente');
  });

  it('mantém a proposta local no conflito ou falha de gravação sem anunciá-la como salva', async () => {
    for (const status of ['conflict', 'failed'] as const) {
      const original = createInitialPlayerState();
      const repo: PlayerRepository<PlayerState> = {
        load: () => Promise.resolve(loaded(original)),
        readRaw: () => Promise.resolve(raw(original)),
        subscribe: () => () => {},
        write: () => Promise.resolve({ status }),
      };
      const { result, unmount } = renderHook(() =>
        usePlayerState('2026-11-21', repo),
      );
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        result.current.setState((before) => ({
          ...before,
          profile: { ...before.profile, name: 'Não perder' },
        }));
        await Promise.resolve();
      });
      expect(result.current.state.profile.name).toBe('Não perder');
      expect(result.current.persistence.kind).toBe(
        status === 'conflict' ? 'conflict' : 'session',
      );
      expect(JSON.parse(result.current.draftRaw()).data.profile.name).toBe(
        'Não perder',
      );
      unmount();
    }
  });
  it('avisa ao fechar a aba somente enquanto uma gravação aguarda confirmação', async () => {
    const original = createInitialPlayerState();
    const pending = deferred<RepositoryWrite>();
    const repo: PlayerRepository<PlayerState> = {
      load: () => Promise.resolve(loaded(original)),
      readRaw: () => Promise.resolve(raw(original)),
      subscribe: () => () => {},
      write: () => pending.promise,
    };
    const { result } = renderHook(() => usePlayerState('2026-11-21', repo));
    await act(async () => {
      await Promise.resolve();
    });
    const close = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(close()).toBe(false);
    act(() =>
      result.current.setState((before) => ({
        ...before,
        profile: { ...before.profile, name: 'Comando rápido' },
      })),
    );
    expect(result.current.persistence.kind).toBe('saving');
    expect(close()).toBe(true);
    await act(async () => {
      pending.resolve({
        status: 'saved',
        raw: raw(result.current.state),
        token: 'idb:2',
      });
      await Promise.resolve();
    });
    expect(result.current.persistence.kind).toBe('saved');
    expect(close()).toBe(false);
  });
  it('falhas ao arquivar alterações antigas são explícitas e mantêm todos os brutos para exportação', async () => {
    const original = createInitialPlayerState();
    let failing = true;
    const captured: (string | null)[] = [];
    const repo: PlayerRepository<PlayerState> = {
      load: () => Promise.resolve(loaded(original)),
      readRaw: () => Promise.resolve(raw(original)),
      write: () => Promise.resolve({ status: 'failed' }),
      subscribe: () => () => {},
      observeLegacy: (value) => {
        if (failing) return Promise.reject(new Error('quota'));
        captured.push(value);
        return Promise.resolve();
      },
      acknowledgeLegacy: () => Promise.resolve(),
    };
    const { result } = renderHook(() => usePlayerState('2026-11-21', repo));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'life-rpg:player-state',
          newValue: 'original-antigo-1',
        }),
      );
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'life-rpg:player-state',
          newValue: 'original-antigo-2',
        }),
      );
      await Promise.resolve();
    });
    expect(result.current.persistence.kind).toBe('session');
    expect(result.current.legacyChange).toMatchObject({
      preserved: false,
      pending: ['original-antigo-1', 'original-antigo-2'],
    });
    expect(result.current.state).toEqual(original);
    failing = false;
    await act(async () => {
      await result.current.acknowledgeLegacy();
    });
    expect(captured).toEqual(['original-antigo-1', 'original-antigo-2']);
    expect(result.current.legacyChange).toBeUndefined();
  });
});
