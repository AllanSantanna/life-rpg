/**
 * Cópias de segurança do conteúdo bruto de uma chave. Nunca são removidas
 * automaticamente: só o usuário decide restaurar ou baixar uma cópia.
 */
export type BackupAccess = Pick<
  Storage,
  'getItem' | 'setItem' | 'key' | 'length'
>;

export interface StorageBackup {
  key: string;
  /** Instante ISO em que a cópia foi criada. */
  createdAt: string;
  size: number;
}

export const backupPrefix = (key: string) => `${key}:backup:`;

/** Copia `raw` para uma nova chave e confirma a leitura antes de retornar. */
export function createBackup(
  access: BackupAccess,
  key: string,
  raw: string,
  now = new Date(),
): string {
  let backupKey = `${backupPrefix(key)}${now.toISOString()}`;
  // Duas cópias no mesmo milissegundo não se sobrescrevem.
  for (let i = 1; access.getItem(backupKey) !== null; i += 1)
    backupKey = `${backupPrefix(key)}${now.toISOString()}-${i}`;
  access.setItem(backupKey, raw);
  if (access.getItem(backupKey) !== raw)
    throw new Error('Não foi possível confirmar a cópia de segurança.');
  return backupKey;
}

export function listBackups(
  access: BackupAccess,
  key: string,
): StorageBackup[] {
  const prefix = backupPrefix(key);
  const result: StorageBackup[] = [];
  for (let i = 0; i < access.length; i += 1) {
    const item = access.key(i);
    if (!item?.startsWith(prefix)) continue;
    result.push({
      key: item,
      createdAt: item.slice(prefix.length).replace(/-\d+$/, ''),
      size: access.getItem(item)?.length ?? 0,
    });
  }
  return result.sort((a, b) => b.key.localeCompare(a.key));
}

/** Oferece o conteúdo bruto como arquivo, sem interpretá-lo. */
export function downloadRaw(raw: string, fileName: string) {
  const url = URL.createObjectURL(
    new Blob([raw], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
