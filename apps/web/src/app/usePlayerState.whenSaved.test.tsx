import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialPlayerState, type PlayerState } from './playerState';
import { usePlayerState } from './usePlayerState';
import type {
  PlayerRepository,
  RepositoryWrite,
} from '../shared/storage/transactionalStateStorage';
import type { SaveOutcome } from '../modules/records/types';

afterEach(cleanup);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const raw = (data: PlayerState) => JSON.stringify({ version: 8, data });

/** Repositório cujas escritas só terminam quando o teste decide. */
function controlledRepo(original = createInitialPlayerState()) {
  const writes: {
    data: PlayerState;
    pending: ReturnType<typeof deferred<RepositoryWrite>>;
  }[] = [];
  const repo: PlayerRepository<PlayerState> = {
    load: () =>
      Promise.resolve({
        status: 'loaded',
        data: original,
        raw: raw(original),
        token: 'idb:1',
      }),
    readRaw: () => Promise.resolve(raw(original)),
    subscribe: () => () => {},
    write(data) {
      const pending = deferred<RepositoryWrite>();
      writes.push({ data, pending });
      return pending.promise;
    },
  };
  return { repo, writes };
}
async function ready(repo: PlayerRepository<PlayerState>) {
  const hook = renderHook(() => usePlayerState('2026-11-21', repo));
  await act(async () => {
    await Promise.resolve();
  });
  return hook;
}
function rename(
  result: { current: ReturnType<typeof usePlayerState> },
  name: string,
) {
  act(() =>
    result.current.setState((before) => ({
      ...before,
      profile: { ...before.profile, name },
    })),
  );
}
function track(promise: Promise<SaveOutcome>) {
  const seen: { outcome?: SaveOutcome } = {};
  void promise.then((outcome) => {
    seen.outcome = outcome;
  });
  return seen;
}

describe('whenSaved: confirmação da gravação do estado atual', () => {
  it('resolve imediatamente quando não há alteração pendente', async () => {
    const { repo } = controlledRepo();
    const { result } = await ready(repo);
    await expect(result.current.whenSaved()).resolves.toBe('saved');
  });

  it('só confirma depois do commit, não durante a gravação', async () => {
    const { repo, writes } = controlledRepo();
    const { result } = await ready(repo);
    rename(result, 'Importado');
    const seen = track(result.current.whenSaved());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.persistence.kind).toBe('saving');
    expect(seen.outcome).toBeUndefined();
    await act(async () => {
      writes[0]!.pending.resolve({
        status: 'saved',
        raw: raw(writes[0]!.data),
        token: 'idb:2',
      });
      await Promise.resolve();
    });
    expect(seen.outcome).toBe('saved');
    expect(writes[0]!.data.profile.name).toBe('Importado');
  });

  it('com uma gravação anterior em andamento, espera o commit que inclui o comando', async () => {
    const { repo, writes } = controlledRepo();
    const { result } = await ready(repo);
    rename(result, 'Primeira');
    rename(result, 'Segunda');
    const seen = track(result.current.whenSaved());
    await act(async () => {
      writes[0]!.pending.resolve({
        status: 'saved',
        raw: raw(writes[0]!.data),
        token: 'idb:2',
      });
      await Promise.resolve();
    });
    // O primeiro commit não contém "Segunda": ainda não há confirmação.
    expect(writes[0]!.data.profile.name).toBe('Primeira');
    expect(seen.outcome).toBeUndefined();
    expect(writes).toHaveLength(2);
    await act(async () => {
      writes[1]!.pending.resolve({
        status: 'saved',
        raw: raw(writes[1]!.data),
        token: 'idb:3',
      });
      await Promise.resolve();
    });
    expect(seen.outcome).toBe('saved');
  });

  it('informa conflito e falha sem anunciar sucesso', async () => {
    for (const [status, expected] of [
      ['conflict', 'conflict'],
      ['failed', 'failed'],
    ] as const) {
      const { repo, writes } = controlledRepo();
      const { result, unmount } = await ready(repo);
      rename(result, 'Não confirmado');
      const seen = track(result.current.whenSaved());
      await act(async () => {
        writes[0]!.pending.resolve({ status });
        await Promise.resolve();
      });
      expect(seen.outcome).toBe(expected);
      // A proposta continua em memória, como antes.
      expect(result.current.state.profile.name).toBe('Não confirmado');
      unmount();
    }
  });

  it('em conflito já declarado, não espera uma gravação que não ocorrerá', async () => {
    const { repo, writes } = controlledRepo();
    const { result } = await ready(repo);
    rename(result, 'Primeira');
    await act(async () => {
      writes[0]!.pending.resolve({ status: 'conflict' });
      await Promise.resolve();
    });
    rename(result, 'Depois do conflito');
    await expect(result.current.whenSaved()).resolves.toBe('conflict');
    expect(writes).toHaveLength(1);
  });
});
