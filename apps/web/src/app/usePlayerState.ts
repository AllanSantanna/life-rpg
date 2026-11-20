import {
  projectCharacter,
  reconcileCharacter,
} from '../modules/profile/character';
import type { PlayerState } from './playerState';
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
  type LoadResult,
  type StateStorage,
} from '../shared/storage/localStateStorage';
import { createBackup, type BackupAccess } from '../shared/storage/backups';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';

/**
 * Situação real da persistência, exibida ao usuário:
 * - `saved`: gravação ativa;
 * - `session`: armazenamento indisponível ou gravação falhou; nada é perdido do
 *   que já estava salvo, mas as alterações valem só nesta sessão;
 * - `protected`: há conteúdo salvo que não pôde ser lido (inválido ou de versão
 *   desconhecida). Ele é preservado e nada é gravado até uma decisão explícita;
 * - `conflict`: outra aba alterou os registros antes desta gravar.
 */
export type Persistence =
  | { kind: 'saved' }
  | { kind: 'session' }
  | { kind: 'protected'; reason: 'invalid' | 'incompatible'; raw: string }
  | { kind: 'conflict' };

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
const defaultStorage = createPlayerStorage();
const browserStorage = (): BackupAccess => window.localStorage;

function project(original: PlayerState, today: string) {
  return reconcileCharacter(original, projectCharacter(original, today));
}

/** Estado inicial a partir de uma leitura, sem nunca descartar conteúdo salvo. */
function fromLoad(loaded: LoadResult<PlayerState>, today: string) {
  const original =
    loaded.status === 'loaded' ? loaded.data : createInitialPlayerState();
  const data = project(original, today);
  const persistence: Persistence =
    loaded.status === 'invalid' || loaded.status === 'incompatible'
      ? { kind: 'protected', reason: loaded.status, raw: loaded.raw }
      : loaded.status === 'unavailable'
        ? { kind: 'session' }
        : { kind: 'saved' };
  return {
    data,
    persistence,
    raw: loaded.status === 'loaded' ? loaded.raw : null,
    // Migrações estruturais (v1–v6) e reconciliação de classe gravam uma vez.
    // A troca de envelope v7 → v8 não altera dados: grava na próxima ação real.
    needsWrite:
      loaded.status === 'loaded' &&
      ((loaded.migrated === true && (loaded.fromVersion ?? 0) < 7) ||
        data !== original),
  };
}

export function usePlayerState(
  today: string,
  storage: StateStorage<PlayerState> = defaultStorage,
  backups: () => BackupAccess = browserStorage,
) {
  const [initial] = useState(() => fromLoad(storage.load(), today));
  const [state, setRawState] = useState(initial.data);
  const [persistence, setPersistence] = useState<Persistence>(
    initial.persistence,
  );
  const stateRef = useRef(initial.data);
  const persistenceRef = useRef<Persistence>(initial.persistence);
  /** Texto bruto que esta aba sabe estar gravado (lido ou gravado por ela). */
  const knownRaw = useRef(initial.raw);
  /** Último estado gravado/lido; diferente de `state` = alteração pendente. */
  const lastSaved = useRef(initial.needsWrite ? null : initial.data);
  const todayRef = useRef(today);
  todayRef.current = today;

  const commit = useCallback((next: PlayerState) => {
    stateRef.current = next;
    setRawState(next);
  }, []);
  const changePersistence = useCallback((next: Persistence) => {
    persistenceRef.current = next;
    setPersistence(next);
  }, []);
  /** Adota o conteúdo atual do armazenamento (outra aba ou recuperação). */
  const adopt = useCallback(() => {
    const loaded = storage.load();
    const next = fromLoad(loaded, todayRef.current);
    knownRaw.current = next.raw;
    lastSaved.current = next.data;
    changePersistence(next.persistence);
    commit(next.data);
    return next;
  }, [storage, commit, changePersistence]);

  /**
   * Antes de aplicar uma ação, confere se outra aba gravou algo. Sem alteração
   * local pendente, a ação é aplicada sobre os dados mais recentes, para não
   * sobrescrever registros alheios; os comandos revalidam tudo.
   */
  const latestBase = useCallback(() => {
    if (persistenceRef.current.kind !== 'saved') return stateRef.current;
    let raw: string | null;
    try {
      raw = storage.readRaw();
    } catch {
      return stateRef.current;
    }
    if (raw === knownRaw.current) return stateRef.current;
    if (stateRef.current !== lastSaved.current) {
      changePersistence({ kind: 'conflict' });
      return stateRef.current;
    }
    return adopt().data;
  }, [storage, adopt, changePersistence]);

  /** Aplica uma ação de forma síncrona: erros de comando chegam ao chamador. */
  const setState = useCallback(
    (action: SetStateAction<PlayerState>) => {
      const base = latestBase();
      const next = typeof action === 'function' ? action(base) : action;
      commit(project(next, todayRef.current));
    },
    [latestBase, commit],
  );

  useEffect(() => {
    commit(project(stateRef.current, today));
  }, [today, commit]);

  useEffect(() => {
    if (state === lastSaved.current) return;
    const kind = persistenceRef.current.kind;
    // Conteúdo protegido ou conflito: nada é gravado até decisão explícita.
    if (kind === 'protected' || kind === 'conflict') return;
    const result = storage.write(state, knownRaw.current);
    if (result.status === 'saved') {
      knownRaw.current = result.raw;
      lastSaved.current = state;
      if (kind !== 'saved') changePersistence({ kind: 'saved' });
    } else if (result.status === 'conflict') {
      changePersistence({ kind: 'conflict' });
    } else if (result.status === 'protected') {
      adopt();
    } else if (kind !== 'session') {
      changePersistence({ kind: 'session' });
    }
  }, [state, storage, adopt, changePersistence]);

  // Outra aba gravou: sem alteração local pendente, adotar os dados novos.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== PLAYER_STORAGE_KEY) return;
      if (event.newValue === knownRaw.current) return;
      const kind = persistenceRef.current.kind;
      if (kind === 'conflict') return;
      if (stateRef.current !== lastSaved.current) {
        changePersistence({ kind: 'conflict' });
        return;
      }
      adopt();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [adopt, changePersistence]);

  /** Conflito: descarta a alteração local não salva e carrega a versão atual. */
  const reloadStored = useCallback(() => {
    adopt();
  }, [adopt]);

  /**
   * Conteúdo protegido: guarda uma cópia verificada do texto bruto e só então
   * permite começar do zero. Retorna a chave da cópia ou lança erro.
   */
  const startFreshKeepingCopy = useCallback(() => {
    const current = persistenceRef.current;
    if (current.kind !== 'protected')
      throw new Error('Não há conteúdo protegido para substituir.');
    const backupKey = createBackup(backups(), PLAYER_STORAGE_KEY, current.raw);
    const fresh = project(createInitialPlayerState(), todayRef.current);
    const result = storage.write(fresh, current.raw, {
      replaceProtected: true,
    });
    if (result.status !== 'saved')
      throw new Error(
        'A cópia foi guardada, mas não foi possível começar um novo registro. Nada foi apagado.',
      );
    knownRaw.current = result.raw;
    lastSaved.current = fresh;
    changePersistence({ kind: 'saved' });
    commit(fresh);
    return backupKey;
  }, [backups, storage, commit, changePersistence]);

  /**
   * Restaura uma cópia: o conteúdo atual também vira cópia antes, então a
   * operação é reversível. Se a cópia não puder ser lida, volta a ser protegida.
   */
  const restoreBackup = useCallback(
    (backupKey: string) => {
      const access = backups();
      const copy = access.getItem(backupKey);
      if (copy === null) throw new Error('Cópia de segurança não encontrada.');
      const current = access.getItem(PLAYER_STORAGE_KEY);
      if (
        current !== knownRaw.current &&
        persistenceRef.current.kind !== 'protected'
      )
        throw new Error(
          'Os registros mudaram em outra aba. Recarregue antes de restaurar.',
        );
      if (current !== null) createBackup(access, PLAYER_STORAGE_KEY, current);
      access.setItem(PLAYER_STORAGE_KEY, copy);
      if (access.getItem(PLAYER_STORAGE_KEY) !== copy)
        throw new Error('Não foi possível restaurar a cópia.');
      adopt();
    },
    [backups, adopt],
  );

  const facts = useMemo(() => projectCharacter(state, today), [state, today]);
  return {
    state,
    setState,
    persistence,
    storageAvailable: persistence.kind === 'saved',
    facts,
    reloadStored,
    startFreshKeepingCopy,
    restoreBackup,
  };
}
