export interface StateStorage<T> {
  load(): LoadResult<T>;
  save(data: T): boolean;
}
export type LoadResult<T> =
  | { status: 'loaded'; data: T; migrated?: boolean }
  | { status: 'missing' | 'invalid' | 'incompatible' | 'unavailable' };
export type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Adaptador síncrono substituível; nenhuma dependência de React ou dos mocks. */
export function createLocalStateStorage<T>(
  key: string,
  version: number,
  validate: (data: unknown) => data is T,
  access: StorageAccess = () => window.localStorage,
  migrate?: (version: number, data: unknown) => T | null,
): StateStorage<T> {
  function load(): LoadResult<T> {
    try {
      const raw = access().getItem(key);
      if (raw === null) return { status: 'missing' };
      let envelope: unknown;
      try {
        envelope = JSON.parse(raw);
      } catch {
        return { status: 'invalid' };
      }
      if (!isRecord(envelope)) return { status: 'invalid' };
      if (envelope.version !== version) {
        if (typeof envelope.version !== 'number') return { status: 'invalid' };
        const data = migrate?.(envelope.version, envelope.data);
        if (data && validate(data))
          return { status: 'loaded', data, migrated: true };
        return { status: 'incompatible' };
      }
      if (!validate(envelope.data)) return { status: 'invalid' };
      return { status: 'loaded', data: envelope.data };
    } catch {
      return { status: 'unavailable' };
    }
  }
  return {
    load,
    save(data) {
      try {
        if (!validate(data)) return false;
        // Uma versão desconhecida pode pertencer a uma versão mais nova do app.
        // Também não gravamos quando a leitura falha: pode haver dados válidos.
        const existing = load();
        if (
          existing.status === 'incompatible' ||
          existing.status === 'unavailable'
        )
          return false;
        access().setItem(key, JSON.stringify({ version, data }));
        return true;
      } catch {
        return false;
      }
    },
  };
}
