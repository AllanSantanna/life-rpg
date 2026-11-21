import {
  createLocalStateStorage,
  type LoadResult,
  type WriteResult,
} from './localStateStorage';
import { listBackups, type StorageBackup } from './backups';

export const PLAYER_DATABASE = 'life-rpg:records';
export type MaybePromise<T> = T | Promise<T>;
export type LegacyChange = {
  raw: string | null;
  preserved?: boolean;
  pending?: (string | null)[];
};
export type RepositoryLoad<T> = LoadResult<T> & {
  token?: string | null;
  legacy?: LegacyChange;
};
export type RepositoryWrite = WriteResult & { token?: string };
export interface CopyRepository {
  listCopies(): MaybePromise<StorageBackup[]>;
  readCopy(key: string): MaybePromise<string | null>;
}
export interface PlayerRepository<T> {
  load(): MaybePromise<RepositoryLoad<T>>;
  readRaw(): MaybePromise<string | null>;
  write(
    data: T,
    expected: string | null,
    options?: { replaceProtected?: boolean },
  ): MaybePromise<RepositoryWrite>;
  copies?: CopyRepository;
  restore?(key: string, expected: string | null): MaybePromise<RepositoryWrite>;
  observeLegacy?(raw: string | null): Promise<void>;
  acknowledgeLegacy?(): Promise<void>;
  subscribe?(listener: () => void): () => void;
}
export const isPromise = <T>(value: MaybePromise<T>): value is Promise<T> =>
  typeof (value as Promise<T> | null)?.then === 'function';

interface Snapshot {
  schema: 1;
  revision: number;
  raw: string;
  importedRaw: string | null;
  observedRaw: string | null;
  acknowledgedRaw: string | null;
}
interface Copy {
  id?: number;
  raw: string;
  reason: string;
  createdAt: string;
}
const copyLabels: Record<string, string> = {
  'migration-original': 'Original preservado na atualização',
  'protected-original': 'Original com leitura protegida',
  'legacy-change': 'Alteração de uma versão antiga',
  'conflict-draft': 'Alteração não salva de outra aba',
  'before-recovery': 'Antes de uma recuperação',
};
const snapshot = (value: unknown): value is Snapshot => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Snapshot;
  return (
    v.schema === 1 &&
    Number.isSafeInteger(v.revision) &&
    v.revision > 0 &&
    typeof v.raw === 'string' &&
    [v.importedRaw, v.observedRaw, v.acknowledgedRaw].every(
      (raw) => raw === null || typeof raw === 'string',
    )
  );
};
const token = (value: unknown): string | null =>
  value === undefined
    ? null
    : snapshot(value)
      ? `idb:${value.revision}`
      : `protected:${JSON.stringify(value)}`;

/**
 * IndexedDB is authoritative. The legacy localStorage key is NEVER written or
 * removed. Import, verified original copy and activation commit together.
 * Every mutation compares a revision INSIDE the readwrite transaction, across
 * connections/tabs. Notifications only refresh views; they do not grant locks.
 */
export function createTransactionalStateStorage<T>({
  key,
  version,
  validate,
  migrate,
  factory = () => window.indexedDB,
  legacy = () => window.localStorage,
}: {
  key: string;
  version: number;
  validate: (data: unknown) => data is T;
  migrate: (version: number, data: unknown) => T | null;
  factory?: () => IDBFactory;
  legacy?: () => Pick<Storage, 'getItem' | 'key' | 'length'>;
}): PlayerRepository<T> {
  const classify = (raw: string | null) =>
    createLocalStateStorage(
      key,
      version,
      validate,
      () => ({
        getItem: () => raw,
        setItem: () => {
          throw new Error('Read only');
        },
      }),
      migrate,
    ).load();
  const pack = (data: T) => JSON.stringify({ version, data });
  const legacyToken = (raw: string | null) =>
    raw === null ? null : `legacy:${raw}`;
  const notify = () => {
    try {
      const channel = new BroadcastChannel(PLAYER_DATABASE);
      channel.postMessage('changed');
      channel.close();
    } catch {
      /* A failed hint cannot invalidate an already committed transaction. */
    }
  };
  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const api = factory();
      if (!api) {
        reject(new Error('IndexedDB indisponível'));
        return;
      }
      const request = api.open(PLAYER_DATABASE, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state');
        request.result.createObjectStore('copies', {
          keyPath: 'id',
          autoIncrement: true,
        });
      };
      request.onerror = () =>
        reject(new Error('Não foi possível abrir os registros protegidos.'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Feche a versão antiga para acessar os registros.'));
      };
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        }
      };
    });
  }
  async function transaction<R>(
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction, done: (value: R) => void) => void,
  ): Promise<R> {
    const db = await open();
    try {
      return await new Promise<R>((resolve, reject) => {
        const tx = db.transaction(
          ['state', 'copies'],
          mode,
          mode === 'readwrite' ? { durability: 'strict' } : undefined,
        );
        let value: R;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () =>
          reject(
            new Error(
              'A transação não foi confirmada. Os registros anteriores foram preservados.',
            ),
          );
        tx.onerror = () => {}; // onabort is the single failure path; never report request success as commit.
        try {
          work(tx, (result) => {
            value = result;
          });
        } catch {
          tx.abort();
        }
      });
    } finally {
      db.close();
    }
  }
  /**
   * A failed add may abort the transaction synchronously. Callers make copy()
   * the LAST synchronous use of `tx` in their handler (follow-up work goes in
   * `after`), so an abort surfaces only through onabort, never as an uncaught
   * InvalidStateError. All writes still share the same atomic transaction.
   */
  function copy(
    tx: IDBTransaction,
    raw: string,
    reason: string,
    after: (id: number) => void = () => {},
  ) {
    const store = tx.objectStore('copies');
    const request = store.add({
      raw,
      reason,
      createdAt: new Date().toISOString(),
    } satisfies Copy);
    request.onsuccess = () => {
      const id = Number(request.result);
      const check = store.get(id);
      check.onsuccess = () => {
        if ((check.result as Copy | undefined)?.raw !== raw) tx.abort();
        else after(id);
      };
    };
  }
  function observe(tx: IDBTransaction, current: Snapshot, raw: string | null) {
    if (current.observedRaw === raw) return;
    // Deletion has no payload, but the canonical state and imported copy remain.
    current.observedRaw = raw;
    tx.objectStore('state').put(current, 'current');
    if (raw !== null) copy(tx, raw, 'legacy-change');
  }
  function observeProtected(
    tx: IDBTransaction,
    original: string,
    raw: string | null,
  ) {
    if (raw === null || raw === original) return;
    const state = tx.objectStore('state');
    const observed = state.get('protected-observed');
    observed.onsuccess = () => {
      if (observed.result !== raw) {
        state.put(raw, 'protected-observed');
        copy(tx, raw, 'legacy-change');
      }
    };
  }
  const load = async (): Promise<RepositoryLoad<T>> => {
    try {
      const raw = legacy().getItem(key);
      return await transaction<RepositoryLoad<T>>('readwrite', (tx, done) => {
        const state = tx.objectStore('state');
        const request = state.get('current');
        request.onsuccess = () => {
          const current: unknown = request.result;
          if (current !== undefined) {
            if (!snapshot(current)) {
              done({
                status: 'incompatible',
                raw: JSON.stringify(current),
                token: token(current),
              });
              return;
            }
            observe(tx, current, raw);
            done({
              ...classify(current.raw),
              token: token(current),
              ...(raw !== current.acknowledgedRaw ? { legacy: { raw } } : {}),
            });
            return;
          }
          const protectedSource = state.get('protected-source');
          protectedSource.onsuccess = () => {
            if (
              protectedSource.result !== undefined &&
              typeof protectedSource.result !== 'string'
            ) {
              done({
                status: 'incompatible',
                raw: JSON.stringify(protectedSource.result),
                token: legacyToken(raw),
              });
              return;
            }
            // An invalid/future source remains protected even if a legacy app
            // later writes a valid empty fallback. Only explicit recovery can
            // replace it; no invalid payload is activated as a player.
            const original =
              typeof protectedSource.result === 'string'
                ? protectedSource.result
                : raw;
            const loaded = classify(original);
            if (loaded.status !== 'loaded') {
              if ('raw' in loaded) {
                observeProtected(tx, loaded.raw, raw);
                if (protectedSource.result === undefined)
                  copy(tx, loaded.raw, 'protected-original', () =>
                    state.put(loaded.raw, 'protected-source'),
                  );
              }
              done({
                ...loaded,
                token: legacyToken(raw),
                ...(raw !== original ? { legacy: { raw } } : {}),
              });
              return;
            }
            // Preserve exact bytes, including unknown fields/whitespace, BEFORE
            // making the validated/migrated payload authoritative. Both writes
            // are atomic and idempotent when StrictMode/two tabs import at once.
            copy(tx, loaded.raw, 'migration-original', () => {
              const current: Snapshot = {
                schema: 1,
                revision: 1,
                raw: pack(loaded.data),
                importedRaw: raw,
                observedRaw: raw,
                acknowledgedRaw: raw,
              };
              state.put(current, 'current');
              done({ ...classify(current.raw), token: token(current) });
            });
          };
        };
      });
    } catch {
      return { status: 'unavailable' };
    }
  };
  async function replace(
    raw: string,
    expected: string | null,
    replaceProtected: boolean,
    restore = false,
  ): Promise<RepositoryWrite> {
    try {
      const legacyRaw = legacy().getItem(key);
      const result = await transaction<RepositoryWrite>(
        'readwrite',
        (tx, done) => {
          const state = tx.objectStore('state');
          const request = state.get('current');
          request.onsuccess = () => {
            const current: unknown = request.result;
            const currentToken =
              current === undefined ? legacyToken(legacyRaw) : token(current);
            if (currentToken !== expected) {
              // The unsaved proposal is recoverable even after closing/reloading
              // the losing tab. Never merge finance or resurrect deleted rows.
              copy(tx, raw, 'conflict-draft');
              done({ status: 'conflict' });
              return;
            }
            const previous = snapshot(current)
              ? current.raw
              : current === undefined
                ? legacyRaw
                : JSON.stringify(current);
            const loaded = classify(previous);
            if (
              !replaceProtected &&
              (loaded.status === 'invalid' || loaded.status === 'incompatible')
            ) {
              done({ status: 'protected' });
              return;
            }
            // A legacy record appeared after an empty load. Import it first;
            // never initialize an empty/new player over existing legacy records.
            if (
              current === undefined &&
              legacyRaw !== null &&
              !replaceProtected
            ) {
              copy(tx, raw, 'conflict-draft');
              done({ status: 'conflict' });
              return;
            }
            const commit = () => {
              if (
                snapshot(current) &&
                current.revision === Number.MAX_SAFE_INTEGER
              ) {
                done({ status: 'failed' });
                return;
              }
              const next: Snapshot = {
                schema: 1,
                revision: snapshot(current) ? current.revision + 1 : 1,
                raw,
                importedRaw: snapshot(current)
                  ? current.importedRaw
                  : legacyRaw,
                observedRaw: snapshot(current)
                  ? current.observedRaw
                  : legacyRaw,
                acknowledgedRaw: snapshot(current)
                  ? current.acknowledgedRaw
                  : legacyRaw,
              };
              state.put(next, 'current');
              if (snapshot(current)) observe(tx, next, legacyRaw);
              done({ status: 'saved', raw, token: token(next)! });
            };
            if ((restore || replaceProtected) && previous !== null)
              copy(tx, previous, 'before-recovery', commit);
            else commit();
          };
        },
      );
      if (result.status === 'saved') notify();
      return result;
    } catch {
      return { status: 'failed' };
    }
  }
  const copies: CopyRepository = {
    async listCopies() {
      const oldCopies = listBackups(legacy(), key);
      return transaction<StorageBackup[]>('readonly', (tx, done) => {
        const request = tx.objectStore('copies').getAll();
        request.onsuccess = () =>
          done(
            oldCopies.concat(
              (request.result as Copy[]).reverse().map((value) => ({
                key: `idb:${value.id}`,
                createdAt: value.createdAt,
                size: value.raw.length,
                label: copyLabels[value.reason] ?? 'Cópia preservada',
              })),
            ),
          );
      });
    },
    async readCopy(id) {
      if (!/^idb:\d+$/.test(id))
        return id.startsWith(`${key}:backup:`) ? legacy().getItem(id) : null;
      return transaction<string | null>('readonly', (tx, done) => {
        const request = tx.objectStore('copies').get(Number(id.slice(4)));
        request.onsuccess = () =>
          done((request.result as Copy | undefined)?.raw ?? null);
      });
    },
  };
  return {
    load,
    copies,
    async readRaw() {
      return transaction<string | null>('readonly', (tx, done) => {
        const request = tx.objectStore('state').get('current');
        request.onsuccess = () =>
          done(snapshot(request.result) ? request.result.raw : null);
      });
    },
    write(data, expected, options) {
      return validate(data)
        ? replace(pack(data), expected, options?.replaceProtected === true)
        : Promise.resolve({ status: 'failed' });
    },
    async restore(id, expected) {
      const raw = await copies.readCopy(id);
      if (raw === null) return { status: 'failed' };
      const loaded = classify(raw);
      // An explicit restore of invalid/future raw is allowed only in protected
      // mode, with a transactionally retained prior canonical snapshot.
      return replace(
        loaded.status === 'loaded' ? pack(loaded.data) : raw,
        expected,
        true,
        true,
      );
    },
    async observeLegacy(raw) {
      await transaction<void>('readwrite', (tx, done) => {
        const request = tx.objectStore('state').get('current');
        request.onsuccess = () => {
          if (snapshot(request.result)) observe(tx, request.result, raw);
          else {
            const source = tx.objectStore('state').get('protected-source');
            source.onsuccess = () => {
              if (typeof source.result === 'string')
                observeProtected(tx, source.result, raw);
            };
          }
          done();
        };
      });
    },
    async acknowledgeLegacy() {
      const raw = legacy().getItem(key);
      await transaction<void>('readwrite', (tx, done) => {
        const store = tx.objectStore('state');
        const request = store.get('current');
        request.onsuccess = () => {
          if (snapshot(request.result)) {
            const current = request.result;
            current.acknowledgedRaw = raw;
            store.put(current, 'current');
            observe(tx, current, raw);
          }
          done();
        };
      });
    },
    subscribe(listener) {
      let channel: BroadcastChannel | undefined;
      try {
        channel = new BroadcastChannel(PLAYER_DATABASE);
        channel.onmessage = listener;
      } catch {
        /* Refresh on focus remains available. */
      }
      window.addEventListener('focus', listener);
      return () => {
        channel?.close();
        window.removeEventListener('focus', listener);
      };
    },
  };
}
