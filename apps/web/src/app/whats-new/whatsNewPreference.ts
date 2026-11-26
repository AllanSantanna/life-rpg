import {
  createLocalStateStorage,
  type StateStorage,
  type StorageAccess,
} from '../../shared/storage/localStateStorage';
import { RELEASE_ID_PATTERN } from './releases';

/**
 * Preferência somente de apresentação: o identificador da última entrada de
 * Novidades da versão já apresentada neste navegador. Fica em chave própria,
 * como `life-rpg:quick-actions`, fora do `PlayerState`, da validação, das
 * migrações e dos backups. Nenhum outro dado é guardado aqui.
 */
export interface WhatsNewPreference {
  seen: string;
}
export const WHATS_NEW_KEY = 'life-rpg:whats-new';
export const WHATS_NEW_VERSION = 1;

function isPreference(value: unknown): value is WhatsNewPreference {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>).seen === 'string' &&
    RELEASE_ID_PATTERN.test((value as WhatsNewPreference).seen)
  );
}

export function createWhatsNewStorage(
  access?: StorageAccess,
): StateStorage<WhatsNewPreference> {
  return createLocalStateStorage(
    WHATS_NEW_KEY,
    WHATS_NEW_VERSION,
    isPreference,
    access,
    undefined,
    // Preferência descartável: um valor inválido pode ser substituído.
    { overwriteInvalid: true },
  );
}

/**
 * Identificadores `AAAA-MM-DD` crescem com o tempo, então a comparação de
 * texto equivale à cronológica.
 */
export const isNewerRelease = (candidate: string, than: string | null) =>
  than === null || candidate > than;
