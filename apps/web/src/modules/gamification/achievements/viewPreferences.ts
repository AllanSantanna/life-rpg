import { useCallback, useState } from 'react';
import {
  createLocalStateStorage,
  type StateStorage,
  type StorageAccess,
} from '../../../shared/storage/localStateStorage';

/**
 * Preferência somente visual da galeria de conquistas. Chave própria, como as
 * preferências de Estatísticas: não altera `PlayerState`, IndexedDB ou backup.
 */
export interface AchievementsView {
  /** Oculta a galeria completa; o Perfil mostra só as medalhas em destaque. */
  featuredOnly: boolean;
}
export const ACHIEVEMENTS_VIEW_KEY = 'life-rpg:achievements-view';
export const ACHIEVEMENTS_VIEW_VERSION = 1;

export function isAchievementsView(value: unknown): value is AchievementsView {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { featuredOnly?: unknown }).featuredOnly === 'boolean'
  );
}

export function createAchievementsViewStorage(
  access?: StorageAccess,
): StateStorage<AchievementsView> {
  return createLocalStateStorage(
    ACHIEVEMENTS_VIEW_KEY,
    ACHIEVEMENTS_VIEW_VERSION,
    isAchievementsView,
    access,
    undefined,
    // Preferência apenas visual: um valor inválido pode ser substituído.
    { overwriteInvalid: true },
  );
}

/** Lê na montagem (sem gravar) e grava apenas quando o usuário alterna. */
export function useAchievementsView(given?: StateStorage<AchievementsView>) {
  const [storage] = useState(() => given ?? createAchievementsViewStorage());
  const [view, setView] = useState<AchievementsView>(() => {
    const result = storage.load();
    return result.status === 'loaded' ? result.data : { featuredOnly: false };
  });
  const update = useCallback(
    (next: AchievementsView) => {
      setView(next);
      storage.save(next);
    },
    [storage],
  );
  return [view, update] as const;
}
