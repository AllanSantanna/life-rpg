import { useCallback, useState } from 'react';
import {
  createLocalStateStorage,
  type StateStorage,
  type StorageAccess,
} from '../../shared/storage/localStateStorage';

/**
 * Preferência somente de apresentação das Ações rápidas: se a explicação da
 * primeira utilização já foi vista neste navegador. Fica em chave própria,
 * como `life-rpg:statistics-view`, para não alterar o esquema, a validação,
 * as migrações ou os backups de `PlayerState`.
 */
export interface QuickActionsPreference {
  introSeen: boolean;
}
export const QUICK_ACTIONS_KEY = 'life-rpg:quick-actions';
export const QUICK_ACTIONS_VERSION = 1;

function isPreference(value: unknown): value is QuickActionsPreference {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>).introSeen === 'boolean'
  );
}

export function createQuickActionsStorage(
  access?: StorageAccess,
): StateStorage<QuickActionsPreference> {
  return createLocalStateStorage(
    QUICK_ACTIONS_KEY,
    QUICK_ACTIONS_VERSION,
    isPreference,
    access,
    undefined,
    // Preferência descartável: um valor inválido pode ser substituído.
    { overwriteInvalid: true },
  );
}

/**
 * Lê uma vez na montagem. Sem armazenamento disponível, a explicação aparece
 * e pode ser dispensada nesta sessão; nada além da preferência é gravado.
 */
export function useQuickActionsIntro(
  given?: StateStorage<QuickActionsPreference>,
) {
  const [storage] = useState(() => {
    try {
      return given ?? createQuickActionsStorage();
    } catch {
      return null;
    }
  });
  const [seen, setSeen] = useState(() => {
    try {
      const result = storage?.load();
      return result?.status === 'loaded' && result.data.introSeen;
    } catch {
      return false;
    }
  });
  const dismiss = useCallback(() => {
    setSeen(true);
    try {
      storage?.save({ introSeen: true });
    } catch {
      // Sem armazenamento: vale apenas para esta sessão.
    }
  }, [storage]);
  return [seen, dismiss] as const;
}
