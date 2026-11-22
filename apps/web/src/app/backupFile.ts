import {
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from './playerState';

/**
 * Arquivo de backup manual do Life RPG. Embute o payload canônico lido do
 * IndexedDB (`{ version, data }`), sem interpretação nem recálculo. XP, nível,
 * Radar, classe e conquistas são projeções desses registros e não são gravados
 * à parte. Contrato e limites: docs/architecture/data-backup.md.
 */
export const BACKUP_FORMAT = 'life-rpg-backup';
export const BACKUP_FORMAT_VERSION = 1;
/** Acima disso a leitura do arquivo é recusada antes do parse. */
export const BACKUP_MAX_BYTES = 25 * 1024 * 1024;

export interface BackupCounts {
  movements: number;
  investments: number;
  investmentEntries: number;
  accounts: number;
  transfers: number;
  valuations: number;
  quotes: number;
  workouts: number;
  workoutExercises: number;
  workoutPlans: number;
  workoutSessions: number;
  sleep: number;
  books: number;
  readings: number;
  goals: number;
  goalUpdates: number;
  missionEvents: number;
}
export interface BackupFileV1 {
  format: typeof BACKUP_FORMAT;
  formatVersion: 1;
  /** Metadado transitório: instante ISO da exportação. */
  exportedAt: string;
  /** Contagens usadas para detectar arquivo incompleto e para a prévia. */
  summary: BackupCounts;
  integrity: { algorithm: 'fnv1a-32'; value: string };
  payload: { version: number; data: unknown };
}
export interface BackupPreview {
  /** `storage-copy`: envelope bruto baixado das cópias de segurança. */
  source: 'backup' | 'storage-copy';
  exportedAt: string | null;
  storageVersion: number;
  migrated: boolean;
  profileName: string;
  counts: BackupCounts;
  bytes: number;
}
export type BackupProblem =
  | 'empty'
  | 'too-large'
  | 'corrupted'
  | 'unknown-format'
  | 'future-format'
  | 'future-version'
  | 'integrity'
  | 'invalid';
export type ParsedBackup =
  | { ok: true; data: PlayerState; preview: BackupPreview }
  | { ok: false; problem: BackupProblem; message: string };

export const backupProblemMessages: Record<BackupProblem, string> = {
  empty: 'O arquivo selecionado está vazio.',
  'too-large':
    'O arquivo é maior que o limite aceito para backups do Life RPG (25 MB).',
  corrupted:
    'O arquivo não contém um JSON legível. Ele pode estar corrompido ou incompleto.',
  'unknown-format': 'O arquivo não é um backup do Life RPG.',
  'future-format':
    'Este backup foi criado por uma versão mais nova do Life RPG. Atualize o aplicativo antes de importar.',
  'future-version':
    'Os registros deste backup usam um formato mais novo que o deste aplicativo. Atualize o Life RPG antes de importar.',
  integrity:
    'O conteúdo do backup não confere com o resumo gravado na exportação. O arquivo pode estar incompleto ou ter sido alterado.',
  invalid:
    'Os registros do backup não passaram na validação. Nenhum dado foi alterado.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** FNV-1a 32 bits: detecta corrupção/edição acidental; não é assinatura. */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function countBackupRecords(state: PlayerState): BackupCounts {
  const { records } = state;
  const advanced = records.advancedWorkouts;
  return {
    movements: records.movements.length,
    investments: records.investments.length,
    investmentEntries: records.investmentEntries.length,
    accounts: records.finance?.accounts.length ?? 0,
    transfers: records.finance?.transfers.length ?? 0,
    valuations: records.finance?.valuations.length ?? 0,
    quotes:
      (records.finance?.quotes.length ?? 0) +
      (records.finance?.usdQuotes?.length ?? 0) +
      (records.finance?.marketQuotes?.length ?? 0),
    workouts: records.workouts.length,
    workoutExercises: advanced?.exercises.length ?? 0,
    workoutPlans: advanced?.plans.length ?? 0,
    workoutSessions: advanced?.sessions.length ?? 0,
    sleep: records.sleep.length,
    books: records.books.length,
    readings: records.readings.length,
    goals: state.goals.items.length,
    goalUpdates: state.goals.updates.length,
    missionEvents: state.missionEvents.length,
  };
}
/** `Blob.text()` com alternativa para navegadores móveis sem esse método. */
export function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () =>
      reject(reader.error ?? new Error('Falha de leitura'));
    reader.readAsText(file);
  });
}
const integrityOf = (payload: BackupFileV1['payload']) =>
  checksum(JSON.stringify(payload));

/** `life-rpg-backup-AAAA-MM-DD.json`, na data civil local da exportação. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `life-rpg-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/**
 * Converte o texto canônico confirmado (`{ version, data }`) em arquivo de
 * backup. Recusa conteúdo que não seja um jogador válido na versão atual.
 */
export function createBackupFile(
  canonicalRaw: string,
  now = new Date(),
): { fileName: string; content: string; counts: BackupCounts } {
  const envelope: unknown = JSON.parse(canonicalRaw);
  if (
    !isRecord(envelope) ||
    envelope.version !== PLAYER_STORAGE_VERSION ||
    !isPlayerState(envelope.data)
  )
    throw new Error(
      'Os registros confirmados não passaram na validação. Use as cópias de segurança do Perfil.',
    );
  const payload = { version: envelope.version, data: envelope.data };
  const counts = countBackupRecords(envelope.data);
  const file: BackupFileV1 = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    summary: counts,
    integrity: { algorithm: 'fnv1a-32', value: integrityOf(payload) },
    payload,
  };
  return {
    fileName: backupFileName(now),
    content: JSON.stringify(file, null, 2) + '\n',
    counts,
  };
}

/** Valida e, se necessário, migra o payload com as migrações oficiais. */
function readPayload(
  version: unknown,
  data: unknown,
):
  | { ok: true; data: PlayerState; migrated: boolean }
  | { ok: false; problem: BackupProblem } {
  if (typeof version !== 'number' || !Number.isSafeInteger(version))
    return { ok: false, problem: 'invalid' };
  if (version > PLAYER_STORAGE_VERSION)
    return { ok: false, problem: 'future-version' };
  if (version === PLAYER_STORAGE_VERSION)
    return isPlayerState(data)
      ? { ok: true, data, migrated: false }
      : { ok: false, problem: 'invalid' };
  let migrated: PlayerState | null = null;
  try {
    migrated = migratePlayerState(version, structuredClone(data));
  } catch {
    migrated = null;
  }
  return migrated !== null && isPlayerState(migrated)
    ? { ok: true, data: migrated, migrated: true }
    : { ok: false, problem: 'invalid' };
}

const fail = (problem: BackupProblem): ParsedBackup => ({
  ok: false,
  problem,
  message: backupProblemMessages[problem],
});

/**
 * Verifica identificador, versão, integridade e registros antes de qualquer
 * gravação. Formatos desconhecidos e versões futuras são recusados.
 */
export function parseBackupFile(
  text: string,
  bytes = text.length,
): ParsedBackup {
  if (bytes > BACKUP_MAX_BYTES) return fail('too-large');
  if (!text.trim()) return fail('empty');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('corrupted');
  }
  if (!isRecord(parsed)) return fail('unknown-format');
  let source: BackupPreview['source'];
  let exportedAt: string | null = null;
  let payload: { version: unknown; data: unknown };
  if ('format' in parsed) {
    if (parsed.format !== BACKUP_FORMAT) return fail('unknown-format');
    const formatVersion = parsed.formatVersion;
    if (
      typeof formatVersion !== 'number' ||
      !Number.isSafeInteger(formatVersion) ||
      formatVersion < 1
    )
      return fail('invalid');
    if (formatVersion > BACKUP_FORMAT_VERSION) return fail('future-format');
    if (
      !isRecord(parsed.payload) ||
      !isRecord(parsed.summary) ||
      !isRecord(parsed.integrity) ||
      typeof parsed.exportedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.exportedAt))
    )
      return fail('invalid');
    if (
      parsed.integrity.algorithm !== 'fnv1a-32' ||
      parsed.integrity.value !==
        integrityOf({
          version: parsed.payload.version as number,
          data: parsed.payload.data,
        })
    )
      return fail('integrity');
    source = 'backup';
    exportedAt = parsed.exportedAt;
    payload = { version: parsed.payload.version, data: parsed.payload.data };
  } else if ('version' in parsed && 'data' in parsed) {
    // Envelope bruto do armazenamento (cópias baixadas do Perfil): formato
    // conhecido, sem metadados de exportação; passa pela mesma validação.
    source = 'storage-copy';
    payload = { version: parsed.version, data: parsed.data };
  } else return fail('unknown-format');
  const read = readPayload(payload.version, payload.data);
  if (!read.ok) return fail(read.problem);
  const counts = countBackupRecords(read.data);
  if (source === 'backup') {
    // O resumo descreve o payload como exportado. Uma migração oficial pode
    // mudar contagens (v1/v2 → missões); nesse caso vale só a soma de
    // verificação, que já cobriu o payload original acima.
    const summary = (parsed as Record<string, unknown>).summary as Record<
      string,
      unknown
    >;
    const keys = Object.keys(counts) as (keyof BackupCounts)[];
    if (
      !read.migrated &&
      (Object.keys(summary).length !== keys.length ||
        keys.some((key) => summary[key] !== counts[key]))
    )
      return fail('integrity');
  }
  return {
    ok: true,
    data: read.data,
    preview: {
      source,
      exportedAt,
      storageVersion: payload.version as number,
      migrated: read.migrated,
      profileName: read.data.profile.name,
      counts,
      bytes,
    },
  };
}
