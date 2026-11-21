export interface StateStorage<T> {
  load(): LoadResult<T>;
  /** Gravação simples para dados descartáveis (ex.: preferências visuais). */
  save(data: T): boolean;
  /**
   * Gravação condicional: só grava se o conteúdo atual ainda for `expected`
   * (o texto bruto lido ou gravado por esta instância). Nunca sobrescreve
   * conteúdo inválido ou de versão desconhecida, salvo `replaceProtected`.
   */
  write(
    data: T,
    expected: string | null,
    options?: { replaceProtected?: boolean },
  ): WriteResult;
  /** Texto bruto atual; lança erro se o armazenamento estiver inacessível. */
  readRaw(): string | null;
}
export type LoadResult<T> =
  | {
      status: 'loaded';
      data: T;
      raw: string;
      migrated?: boolean;
      /** Versão lida antes da migração em memória. */
      fromVersion?: number;
    }
  | { status: 'missing' }
  /** Conteúdo presente que não pôde ser interpretado: preservado. */
  | { status: 'invalid' | 'incompatible'; raw: string }
  | { status: 'unavailable' };
export type WriteResult =
  | { status: 'saved'; raw: string }
  | { status: 'conflict' | 'protected' | 'failed' };
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
  options: {
    /**
     * Permite que `save` substitua conteúdo inválido. Só para dados
     * descartáveis; o estado do jogador nunca usa esta opção.
     */
    overwriteInvalid?: boolean;
  } = {},
): StateStorage<T> {
  function classify(raw: string | null): LoadResult<T> {
    if (raw === null) return { status: 'missing' };
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return { status: 'invalid', raw };
    }
    if (!isRecord(envelope)) return { status: 'invalid', raw };
    if (envelope.version !== version) {
      if (typeof envelope.version !== 'number')
        return { status: 'invalid', raw };
      // Versão futura ou migração que falha/interrompe: preservar o conteúdo.
      let data: T | null = null;
      try {
        data = migrate?.(envelope.version, envelope.data) ?? null;
      } catch {
        data = null;
      }
      if (data !== null && validate(data))
        return {
          status: 'loaded',
          data,
          raw,
          migrated: true,
          fromVersion: envelope.version,
        };
      return { status: 'incompatible', raw };
    }
    if (!validate(envelope.data)) return { status: 'invalid', raw };
    return { status: 'loaded', data: envelope.data, raw };
  }
  function load(): LoadResult<T> {
    let raw: string | null;
    try {
      raw = access().getItem(key);
    } catch {
      return { status: 'unavailable' };
    }
    return classify(raw);
  }
  function write(
    data: T,
    expected: string | null,
    writeOptions: { replaceProtected?: boolean } = {},
  ): WriteResult {
    try {
      if (!validate(data)) return { status: 'failed' };
      const current = access().getItem(key);
      // Outra aba (ou versão do app) alterou o conteúdo: não sobrescrever.
      if (current !== expected) return { status: 'conflict' };
      const existing = classify(current);
      if (
        !writeOptions.replaceProtected &&
        (existing.status === 'invalid' || existing.status === 'incompatible')
      )
        return { status: 'protected' };
      const raw = JSON.stringify({ version, data });
      access().setItem(key, raw);
      return { status: 'saved', raw };
    } catch {
      return { status: 'failed' };
    }
  }
  return {
    load,
    write,
    readRaw: () => access().getItem(key),
    save(data) {
      try {
        if (!validate(data)) return false;
        const existing = load();
        // Versão desconhecida pode pertencer a uma versão mais nova do app;
        // leitura indisponível pode esconder dados válidos; conteúdo inválido
        // pode ser recuperável. Nenhum desses casos é sobrescrito por padrão.
        if (
          existing.status === 'incompatible' ||
          existing.status === 'unavailable' ||
          (existing.status === 'invalid' && !options.overwriteInvalid)
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
