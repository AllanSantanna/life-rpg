import {
  projectCharacter,
  reconcileCharacter,
} from '../modules/profile/character';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import {
  createLocalStateStorage,
  type StateStorage,
} from '../shared/storage/localStateStorage';
import {
  isPromise,
  type PlayerRepository,
  type RepositoryLoad,
  type LegacyChange,
  type MaybePromise,
  type RepositoryWrite,
} from '../shared/storage/transactionalStateStorage';
import { browserPlayerStorage } from './playerRepository';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from './playerState';

/** Resultado de uma importação de backup confirmada pelo usuário. */
export type BackupImportOutcome =
  /** Commit confirmado e registros relidos do IndexedDB. */
  | 'saved'
  /** Outra aba gravou depois da prévia; nada foi alterado. */
  | 'conflict'
  /** Transação abortada ou recusada; o estado anterior permanece. */
  | 'failed'
  /** Commit confirmado, mas a releitura falhou; recarregar a página. */
  | 'reload';
const backupBlocked: Record<Exclude<Persistence['kind'], 'saved'>, string> = {
  loading: 'Aguarde o carregamento dos registros.',
  saving: 'Aguarde a confirmação da gravação atual.',
  session:
    'O armazenamento local está indisponível. Nenhum backup pode ser lido ou restaurado agora.',
  protected:
    'Os registros salvos estão protegidos. Baixe-os em “Cópias de segurança dos registros”.',
  conflict:
    'Há uma alteração em conflito com outra aba. Carregue os registros atuais antes de continuar.',
};

export type Persistence =
  | { kind: 'loading' | 'saving' | 'saved' | 'session' }
  | { kind: 'protected'; reason: 'invalid' | 'incompatible'; raw: string }
  | { kind: 'conflict' };

/** Synchronous adapter retained for isolated tests and old exports.
 * The production default is exclusively transactional IndexedDB. */
export function createPlayerStorage(
  access?: () => Pick<Storage, 'getItem' | 'setItem'>,
): StateStorage<PlayerState> {
  return createLocalStateStorage(
    PLAYER_STORAGE_KEY,
    PLAYER_STORAGE_VERSION,
    isPlayerState,
    access,
    migratePlayerState,
  );
}
const project = (data: PlayerState, today: string) =>
  reconcileCharacter(data, projectCharacter(data, today));
const map = <T, R>(
  value: MaybePromise<T>,
  apply: (value: T) => R,
): MaybePromise<R> => (isPromise(value) ? value.then(apply) : apply(value));
function fromLoad(loaded: RepositoryLoad<PlayerState>, today: string) {
  const original =
    loaded.status === 'loaded' ? loaded.data : createInitialPlayerState();
  const data = project(original, today);
  const persistence: Persistence =
    loaded.status === 'invalid' || loaded.status === 'incompatible'
      ? { kind: 'protected', reason: loaded.status, raw: loaded.raw }
      : loaded.status === 'unavailable'
        ? { kind: 'session' }
        : { kind: 'saved' };
  const raw = 'raw' in loaded ? loaded.raw : null;
  return {
    data,
    persistence,
    raw,
    token: loaded.token ?? raw,
    legacy: loaded.legacy,
    needsWrite:
      loaded.status === 'loaded' &&
      ((loaded.migrated === true && (loaded.fromVersion ?? 0) < 7) ||
        data !== original),
  };
}
export function usePlayerState(
  today: string,
  storage: PlayerRepository<PlayerState> = browserPlayerStorage,
) {
  const [first] = useState(() => {
    const load = storage.load();
    return { load, initial: isPromise(load) ? null : fromLoad(load, today) };
  });
  const [state, setRawState] = useState(
    first.initial?.data ?? createInitialPlayerState,
  );
  const [ready, setReady] = useState(first.initial !== null);
  const [persistence, setPersistence] = useState<Persistence>(
    first.initial?.persistence ?? { kind: 'loading' },
  );
  const [legacyChange, setLegacyChange] = useState<LegacyChange | undefined>(
    first.initial?.legacy,
  );
  const stateRef = useRef(state);
  const readyRef = useRef(ready);
  const persistenceRef = useRef(persistence);
  const knownToken = useRef<string | null>(first.initial?.token ?? null);
  const knownRaw = useRef(first.initial?.raw ?? null);
  const pendingLegacy = useRef<{ raw: string | null }[]>([]);
  const withPendingLegacy = useCallback(
    (change?: LegacyChange): LegacyChange | undefined => {
      const pending = pendingLegacy.current.map((entry) => entry.raw);
      return pending.length
        ? { raw: pending[pending.length - 1]!, pending, preserved: false }
        : change;
    },
    [],
  );
  const lastSaved = useRef<PlayerState | null>(
    first.initial?.needsWrite ? null : (first.initial?.data ?? null),
  );
  const writing = useRef(false);
  const mounted = useRef(true);
  const todayRef = useRef(today);
  todayRef.current = today;
  const flush = useRef<() => void>(() => {});
  const commit = useCallback((next: PlayerState) => {
    stateRef.current = next;
    setRawState(next);
  }, []);
  const changePersistence = useCallback((next: Persistence) => {
    persistenceRef.current = next;
    setPersistence(next);
  }, []);
  const applyLoad = useCallback(
    (loaded: RepositoryLoad<PlayerState>) => {
      if (!mounted.current) return;
      if (loaded.status === 'unavailable') {
        changePersistence({ kind: 'session' });
        return;
      }
      const next = fromLoad(loaded, todayRef.current);
      knownToken.current = next.token;
      knownRaw.current = next.raw;
      lastSaved.current = next.needsWrite ? null : next.data;
      readyRef.current = true;
      setReady(true);
      setLegacyChange(withPendingLegacy(next.legacy));
      changePersistence(
        pendingLegacy.current.length ? { kind: 'session' } : next.persistence,
      );
      commit(next.data);
    },
    [commit, changePersistence, withPendingLegacy],
  );
  const adopt = useCallback(
    () => map(storage.load(), applyLoad),
    [storage, applyLoad],
  );
  const failed = useCallback(() => {
    if (mounted.current) changePersistence({ kind: 'session' });
  }, [changePersistence]);
  useEffect(() => {
    mounted.current = true;
    if (isPromise(first.load)) void first.load.then(applyLoad, failed);
    return () => {
      mounted.current = false;
    };
  }, [first, applyLoad, failed]);
  const setState = useCallback(
    (action: SetStateAction<PlayerState>) => {
      if (!readyRef.current)
        throw new Error(
          'Os registros ainda não foram carregados. Nenhuma alteração foi gravada.',
        );
      // Sync adapters refresh directly. The browser rejects stale proposals by
      // revision inside its transaction; never merge finance after an async read.
      if (!storage.subscribe && persistenceRef.current.kind === 'saved') {
        const raw = storage.readRaw();
        if (
          !isPromise(raw) &&
          raw !== knownRaw.current &&
          stateRef.current === lastSaved.current
        ) {
          const loaded = storage.load();
          if (!isPromise(loaded)) applyLoad(loaded);
        }
      }
      const next =
        typeof action === 'function' ? action(stateRef.current) : action;
      commit(project(next, todayRef.current));
    },
    [storage, applyLoad, commit],
  );
  flush.current = () => {
    if (
      !readyRef.current ||
      writing.current ||
      stateRef.current === lastSaved.current
    )
      return;
    const kind = persistenceRef.current.kind;
    if (kind === 'protected' || kind === 'conflict') return;
    const proposed = stateRef.current;
    writing.current = true;
    if (storage.subscribe) changePersistence({ kind: 'saving' });
    const complete = (result: RepositoryWrite) => {
      writing.current = false;
      if (!mounted.current) return;
      if (result.status === 'saved') {
        knownToken.current = result.token ?? result.raw;
        knownRaw.current = result.raw;
        lastSaved.current = proposed;
        changePersistence(
          pendingLegacy.current.length
            ? { kind: 'session' }
            : { kind: 'saved' },
        );
        flush.current();
      } else if (result.status === 'conflict')
        changePersistence({ kind: 'conflict' });
      else if (result.status === 'protected') {
        const next = adopt();
        if (isPromise(next)) void next.catch(failed);
      } else failed();
    };
    try {
      const result = storage.write(proposed, knownToken.current);
      if (isPromise(result))
        void result.then(complete, () => {
          writing.current = false;
          failed();
        });
      else complete(result);
    } catch {
      writing.current = false;
      failed();
    }
  };
  useEffect(() => {
    flush.current();
  }, [state, ready]);
  useEffect(() => {
    if (readyRef.current) commit(project(stateRef.current, today));
  }, [today, commit]);
  useEffect(() => {
    const refresh = () => {
      if (
        writing.current ||
        stateRef.current !== lastSaved.current ||
        persistenceRef.current.kind === 'conflict'
      )
        return;
      try {
        const baseline = stateRef.current;
        const expected = knownToken.current;
        const next = map(storage.load(), (loaded) => {
          // Do not replace a newer local command/commit with a delayed read.
          if (
            writing.current ||
            stateRef.current !== baseline ||
            knownToken.current !== expected
          )
            return;
          applyLoad(loaded);
        });
        if (isPromise(next)) void next.catch(failed);
      } catch {
        failed();
      }
    };
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== PLAYER_STORAGE_KEY) return;
      if (storage.observeLegacy) {
        const entry = { raw: event.newValue };
        pendingLegacy.current.push(entry);
        void storage.observeLegacy(entry.raw).then(
          () => {
            pendingLegacy.current = pendingLegacy.current.filter(
              (value) => value !== entry,
            );
            if (!mounted.current) return;
            setLegacyChange(withPendingLegacy({ raw: entry.raw }));
            refresh();
          },
          () => {
            if (!mounted.current) return;
            setLegacyChange(withPendingLegacy());
            failed();
          },
        );
      } else if (event.newValue !== knownRaw.current) {
        if (stateRef.current !== lastSaved.current)
          changePersistence({ kind: 'conflict' });
        else refresh();
      }
    }
    // Closing the tab before the transaction commits would drop the latest
    // command silently. Warn only while a confirmation is still expected;
    // session/protected/conflict states are already announced in the UI.
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const kind = persistenceRef.current.kind;
      const unconfirmed =
        writing.current ||
        (readyRef.current &&
          stateRef.current !== lastSaved.current &&
          (kind === 'saved' || kind === 'saving'));
      if (!unconfirmed) return;
      event.preventDefault();
      event.returnValue = '';
    }
    const unsubscribe = storage.subscribe?.(refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      unsubscribe?.();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [storage, applyLoad, failed, changePersistence, withPendingLegacy]);
  const reloadStored = useCallback(() => {
    if (writing.current) return;
    readyRef.current = false;
    setReady(false);
    changePersistence({ kind: 'loading' });
    const next = adopt();
    if (isPromise(next)) return next.catch(failed);
  }, [adopt, failed, changePersistence]);
  const startFreshKeepingCopy = useCallback((): MaybePromise<void> => {
    const current = persistenceRef.current;
    if (current.kind !== 'protected' || writing.current)
      throw new Error('Aguarde a leitura dos registros protegidos.');
    const fresh = project(createInitialPlayerState(), todayRef.current);
    return map(
      storage.write(fresh, knownToken.current, { replaceProtected: true }),
      (result) => {
        if (result.status !== 'saved')
          throw new Error(
            'Não foi possível confirmar a recuperação. Os registros anteriores foram preservados.',
          );
        knownToken.current = result.token ?? result.raw;
        knownRaw.current = result.raw;
        lastSaved.current = fresh;
        changePersistence({ kind: 'saved' });
        commit(fresh);
        return;
      },
    );
  }, [storage, commit, changePersistence]);
  const restoreBackup = useCallback(
    (backupKey: string): MaybePromise<void> => {
      if (writing.current)
        throw new Error('Aguarde a gravação atual antes de restaurar.');
      if (!storage.restore)
        throw new Error(
          'Este armazenamento não oferece restauração protegida.',
        );
      const apply = (result: RepositoryWrite): MaybePromise<void> => {
        if (result.status !== 'saved')
          throw new Error(
            'A restauração não foi confirmada. Recarregue os registros atuais antes de tentar novamente.',
          );
        return adopt();
      };
      const result = storage.restore(backupKey, knownToken.current);
      return isPromise(result) ? result.then(apply) : apply(result);
    },
    [storage, adopt],
  );
  const acknowledgeLegacy = useCallback(async () => {
    if (writing.current || stateRef.current !== lastSaved.current)
      throw new Error('Aguarde a confirmação da gravação atual.');
    const baseline = stateRef.current,
      expected = knownToken.current;
    for (const entry of [...pendingLegacy.current]) {
      await storage.observeLegacy?.(entry.raw);
      pendingLegacy.current = pendingLegacy.current.filter(
        (value) => value !== entry,
      );
    }
    await storage.acknowledgeLegacy?.();
    const loaded = await storage.load();
    if (
      stateRef.current === baseline &&
      knownToken.current === expected &&
      !writing.current
    )
      applyLoad(loaded);
  }, [storage, applyLoad]);
  const assertSettled = useCallback(() => {
    if (!readyRef.current) throw new Error(backupBlocked.loading);
    if (writing.current || stateRef.current !== lastSaved.current)
      throw new Error(backupBlocked.saving);
  }, []);
  /** Texto canônico CONFIRMADO no armazenamento, nunca o estado em memória. */
  const readBackupSource = useCallback(async (): Promise<string> => {
    const kind = persistenceRef.current.kind;
    if (kind !== 'saved') throw new Error(backupBlocked[kind]);
    assertSettled();
    const raw = await storage.readRaw();
    if (raw === null)
      throw new Error(
        'Ainda não há registros confirmados neste dispositivo para exportar.',
      );
    return raw;
  }, [storage, assertSettled]);
  /**
   * Revisão conhecida no momento da prévia. A importação só é confirmada se o
   * armazenamento ainda estiver nela: gravações de outra aba durante a
   * confirmação viram conflito, nunca sobrescrita silenciosa.
   */
  const beginBackupImport = useCallback((): { expected: string | null } => {
    const kind = persistenceRef.current.kind;
    // Registros protegidos podem ser substituídos explicitamente: o original
    // continua nas cópias e o canônico anterior é guardado na transação.
    if (kind !== 'saved' && kind !== 'protected')
      throw new Error(backupBlocked[kind]);
    if (!storage.importBackup)
      throw new Error('Este armazenamento não oferece importação protegida.');
    assertSettled();
    return { expected: knownToken.current };
  }, [storage, assertSettled]);
  const importBackup = useCallback(
    async (
      data: PlayerState,
      expected: string | null,
    ): Promise<BackupImportOutcome> => {
      assertSettled();
      if (!storage.importBackup)
        throw new Error('Este armazenamento não oferece importação protegida.');
      let result: RepositoryWrite;
      try {
        result = await storage.importBackup(data, expected);
      } catch {
        return 'failed';
      }
      if (result.status === 'conflict') return 'conflict';
      if (result.status !== 'saved') return 'failed';
      try {
        await adopt();
        return 'saved';
      } catch {
        failed();
        return 'reload';
      }
    },
    [storage, assertSettled, adopt, failed],
  );
  const draftRaw = () =>
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: stateRef.current });
  const facts = useMemo(() => projectCharacter(state, today), [state, today]);
  return {
    state,
    setState,
    ready,
    persistence,
    legacyChange,
    acknowledgeLegacy,
    copies: storage.copies,
    draftRaw,
    storageAvailable: persistence.kind === 'saved',
    facts,
    reloadStored,
    startFreshKeepingCopy,
    restoreBackup,
    readBackupSource,
    beginBackupImport,
    importBackup,
  };
}
