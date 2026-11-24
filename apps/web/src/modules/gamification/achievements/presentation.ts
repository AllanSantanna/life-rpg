import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLocalStateStorage,
  type StateStorage,
  type StorageAccess,
} from '../../../shared/storage/localStateStorage';
import type { AchievementStatus } from './evaluate';

/**
 * Estado **apenas de apresentação**: ids de conquistas cuja animação de
 * desbloqueio já foi exibida (ou dispensada silenciosamente) neste navegador.
 *
 * Não é fonte de verdade: o desbloqueio vem sempre da projeção dos registros.
 * Fica em chave própria, fora do `PlayerState`, do IndexedDB e do backup, e só
 * é gravado quando o usuário dispensa uma apresentação. Conquistas já desbloqueadas ao abrir o
 * app nunca animam; a lista evita repetir a apresentação de uma conquista que
 * volte a ser desbloqueada por ação do usuário em outra sessão.
 */
export interface AchievementPresentation {
  seen: string[];
}
export const ACHIEVEMENT_PRESENTATION_KEY = 'life-rpg:achievement-presentation';
export const ACHIEVEMENT_PRESENTATION_VERSION = 1;
/** Janela em que uma mudança de estado é atribuída a uma ação do usuário. */
export const USER_ACTION_WINDOW_MS = 3000;

export function isAchievementPresentation(
  value: unknown,
): value is AchievementPresentation {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const seen = (value as { seen?: unknown }).seen;
  return (
    Object.keys(value).length === 1 &&
    Array.isArray(seen) &&
    seen.length <= 1000 &&
    seen.every(
      (id) => typeof id === 'string' && id.length > 0 && id.length <= 80,
    ) &&
    new Set(seen).size === seen.length
  );
}

export function createAchievementPresentationStorage(
  access?: StorageAccess,
): StateStorage<AchievementPresentation> {
  return createLocalStateStorage(
    ACHIEVEMENT_PRESENTATION_KEY,
    ACHIEVEMENT_PRESENTATION_VERSION,
    isAchievementPresentation,
    access,
    undefined,
    // Dado descartável de apresentação: um valor inválido pode ser substituído.
    { overwriteInvalid: true },
  );
}

/**
 * Enfileira a apresentação de conquistas desbloqueadas pela primeira vez **por
 * uma ação do usuário nesta sessão** (`markUserAction`). Abrir o app, restaurar
 * ou importar backup, recarregar dados de outra aba ou carregar registros
 * históricos marcam as conquistas como vistas sem animação.
 */
export function useAchievementUnlocks(
  statuses: readonly AchievementStatus[],
  given?: StateStorage<AchievementPresentation>,
) {
  const [storage] = useState(
    () => given ?? createAchievementPresentationStorage(),
  );
  const seen = useRef<Set<string> | null>(null);
  const userAction = useRef(0);
  const [queue, setQueue] = useState<AchievementStatus[]>([]);
  const latest = useRef(statuses);
  latest.current = statuses;
  const unlockedKey = statuses
    .filter((status) => status.unlocked)
    .map((status) => status.id)
    .join('|');

  useEffect(() => {
    const unlocked = latest.current.filter((status) => status.unlocked);
    if (seen.current === null) {
      const stored = storage.load();
      seen.current = new Set(
        stored.status === 'loaded' ? stored.data.seen : [],
      );
      userAction.current = 0;
    }
    const known = seen.current;
    const fresh = unlocked.filter((status) => !known.has(status.id));
    const byUser =
      userAction.current > 0 &&
      Date.now() - userAction.current <= USER_ACTION_WINDOW_MS;
    userAction.current = 0;
    if (!fresh.length) return;
    for (const status of fresh) known.add(status.id);
    // Abrir o app, importar ou sincronizar outra aba nunca escreve no
    // armazenamento (conquistas presentes na abertura já não animam). Após uma
    // ação do usuário, a lista é gravada quando ele dispensa a apresentação.
    if (!byUser) return;
    setQueue((current) => [...current, ...fresh]);
    // A identidade de `statuses` muda a cada render; o conjunto desbloqueado
    // (`unlockedKey`) é o que define uma nova avaliação.
  }, [unlockedKey, storage]);

  const markUserAction = useCallback(() => {
    userAction.current = Date.now();
  }, []);
  const persist = useCallback(() => {
    if (seen.current) storage.save({ seen: [...seen.current] });
  }, [storage]);
  const next = useCallback(() => {
    persist();
    setQueue((current) => current.slice(1));
  }, [persist]);
  const dismissAll = useCallback(() => {
    persist();
    setQueue([]);
  }, [persist]);
  return { queue, markUserAction, next, dismissAll };
}
