import { useEffect, useRef, useState } from 'react';
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

export function usePlayerState() {
  const [initial] = useState(() => {
    const loaded = storage.load();
    return {
      data:
        loaded.status === 'loaded' ? loaded.data : createInitialPlayerState(),
      needsMigration: loaded.status === 'loaded' && loaded.migrated === true,
      available:
        loaded.status !== 'unavailable' && loaded.status !== 'incompatible',
    };
  });
  const [state, setState] = useState(initial.data);
  const [storageAvailable, setStorageAvailable] = useState(initial.available);
  const lastSaved = useRef(initial.needsMigration ? null : initial.data);
  useEffect(() => {
    // Não gravar o fallback ou sobrescrever o conteúdo na montagem/StrictMode.
    if (state === lastSaved.current) return;
    const saved = storage.save(state);
    setStorageAvailable(saved);
    if (saved) lastSaved.current = state;
  }, [state]);
  return { state, setState, storageAvailable };
}
