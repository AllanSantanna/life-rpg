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
import { createLocalStateStorage } from '../shared/storage/localStateStorage';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';

const storage = createLocalStateStorage(
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  isPlayerState,
  undefined,
  migratePlayerState,
);

export function usePlayerState(today: string) {
  const [initial] = useState(() => {
    const loaded = storage.load();
    const original =
      loaded.status === 'loaded' ? loaded.data : createInitialPlayerState();
    const data = reconcileCharacter(
      original,
      projectCharacter(original, today),
    );
    return {
      data,
      needsMigration:
        loaded.status === 'loaded' &&
        (loaded.migrated === true || data !== original),
      available:
        loaded.status !== 'unavailable' && loaded.status !== 'incompatible',
    };
  });
  const [state, setRawState] = useState(initial.data);
  const setState = useCallback(
    (action: SetStateAction<PlayerState>) => {
      setRawState((previous) => {
        const next = typeof action === 'function' ? action(previous) : action;
        return reconcileCharacter(next, projectCharacter(next, today));
      });
    },
    [today],
  );
  const facts = useMemo(() => projectCharacter(state, today), [state, today]);
  useEffect(() => {
    setState((previous) => previous);
  }, [setState]);
  const [storageAvailable, setStorageAvailable] = useState(initial.available);
  const lastSaved = useRef(initial.needsMigration ? null : initial.data);
  useEffect(() => {
    // Não gravar o fallback ou sobrescrever o conteúdo na montagem/StrictMode.
    if (state === lastSaved.current) return;
    const saved = storage.save(state);
    setStorageAvailable(saved);
    if (saved) lastSaved.current = state;
  }, [state]);
  return { state, setState, storageAvailable, facts };
}
