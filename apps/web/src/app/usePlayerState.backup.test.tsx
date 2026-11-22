import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { syntheticPlayer } from '../test/backupFixtures';
import { createInitialPlayerState, type PlayerState } from './playerState';
import { usePlayerState } from './usePlayerState';
import type {
  PlayerRepository,
  RepositoryLoad,
  RepositoryWrite,
} from '../shared/storage/transactionalStateStorage';

// Repositório assíncrono em memória com a mesma semântica de revisão do
// IndexedDB: importação compara a revisão esperada e guarda o anterior.
afterEach(cleanup);
const today = '2026-11-21';
const pack = (data: PlayerState) => JSON.stringify({ version: 8, data });
function memoryRepository(initial: PlayerState | null) {
  const db = {
    revision: initial ? 1 : 0,
    raw: initial ? pack(initial) : null,
    copies: [] as string[],
    failNextImport: false,
  };
  const token = () => (db.revision ? `idb:${db.revision}` : null);
  const load = (): RepositoryLoad<PlayerState> =>
    db.raw === null
      ? { status: 'missing', token: null }
      : {
          status: 'loaded',
          data: JSON.parse(db.raw).data,
          raw: db.raw,
          token: token(),
        };
  const commit = (raw: string): RepositoryWrite => {
    db.revision += 1;
    db.raw = raw;
    return { status: 'saved', raw, token: token()! };
  };
  const repo: PlayerRepository<PlayerState> = {
    load: () => Promise.resolve(load()),
    readRaw: () => Promise.resolve(db.raw),
    subscribe: () => () => {},
    write: (data, expected) =>
      Promise.resolve(
        expected !== token() ? { status: 'conflict' } : commit(pack(data)),
      ),
    importBackup: (data, expected) => {
      if (expected !== token())
        return Promise.resolve({ status: 'conflict' as const });
      if (db.failNextImport) {
        db.failNextImport = false;
        // Transação abortada: nem cópia nem substituição.
        return Promise.resolve({ status: 'failed' as const });
      }
      if (db.raw !== null) db.copies.push(db.raw);
      return Promise.resolve(commit(pack(data)));
    },
  };
  /** Simula a gravação de outra aba/conexão. */
  const otherTab = (data: PlayerState) => commit(pack(data));
  return { db, repo, otherTab };
}
async function mount(repo: PlayerRepository<PlayerState>) {
  const hook = renderHook(() => usePlayerState(today, repo));
  await act(async () => {
    await Promise.resolve();
  });
  return hook;
}

describe('backup no hook transacional', () => {
  it('exporta somente o texto confirmado no armazenamento', async () => {
    const original = createInitialPlayerState();
    const { repo, db } = memoryRepository(original);
    const { result } = await mount(repo);
    await expect(result.current.readBackupSource()).resolves.toBe(db.raw);
  });

  it('recusa exportar sem registros confirmados', async () => {
    const { repo } = memoryRepository(null);
    const { result } = await mount(repo);
    await expect(result.current.readBackupSource()).rejects.toThrow(
      /Ainda não há registros confirmados/,
    );
  });

  it('importa com a revisão da prévia, guarda o anterior e relê o canônico', async () => {
    const { repo, db } = memoryRepository(createInitialPlayerState());
    const { result } = await mount(repo);
    const previous = db.raw;
    const { expected } = result.current.beginBackupImport();
    const incoming = syntheticPlayer();
    let outcome = '';
    await act(async () => {
      outcome = await result.current.importBackup(incoming, expected);
    });
    expect(outcome).toBe('saved');
    expect(db.copies).toEqual([previous]);
    expect(result.current.state.records).toEqual(incoming.records);
    expect(result.current.persistence.kind).toBe('saved');
  });

  it('gravação de outra aba entre a prévia e a confirmação gera conflito', async () => {
    const { repo, db, otherTab } = memoryRepository(createInitialPlayerState());
    const { result } = await mount(repo);
    const { expected } = result.current.beginBackupImport();
    const other = createInitialPlayerState();
    other.profile.name = 'Outra aba';
    otherTab(other);
    const before = db.raw;
    let outcome = '';
    await act(async () => {
      outcome = await result.current.importBackup(syntheticPlayer(), expected);
    });
    expect(outcome).toBe('conflict');
    expect(db.raw).toBe(before);
    expect(db.copies).toHaveLength(0);
  });

  it('falha da transação mantém o estado anterior e não anuncia sucesso', async () => {
    const original = createInitialPlayerState();
    const { repo, db } = memoryRepository(original);
    const { result } = await mount(repo);
    const before = db.raw;
    db.failNextImport = true;
    const { expected } = result.current.beginBackupImport();
    let outcome = '';
    await act(async () => {
      outcome = await result.current.importBackup(syntheticPlayer(), expected);
    });
    expect(outcome).toBe('failed');
    expect(db.raw).toBe(before);
    expect(result.current.state.profile).toEqual(original.profile);
  });

  it('bloqueia backup enquanto uma gravação local aguarda confirmação', async () => {
    const { repo } = memoryRepository(createInitialPlayerState());
    let release!: (value: RepositoryWrite) => void;
    repo.write = () =>
      new Promise((done) => {
        release = done;
      });
    const { result } = await mount(repo);
    act(() =>
      result.current.setState((state) => ({
        ...state,
        profile: { ...state.profile, name: 'Em gravação' },
      })),
    );
    expect(() => result.current.beginBackupImport()).toThrow(
      /Aguarde a confirmação/,
    );
    await expect(result.current.readBackupSource()).rejects.toThrow(
      /Aguarde a confirmação/,
    );
    await act(async () => {
      release({ status: 'failed' });
      await Promise.resolve();
    });
  });
});
