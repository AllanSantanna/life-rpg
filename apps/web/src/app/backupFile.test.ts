import { describe, expect, it } from 'vitest';
import { projectCharacter } from '../modules/profile/character';
import { syntheticPlayer } from '../test/backupFixtures';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_MAX_BYTES,
  checksum,
  countBackupRecords,
  createBackupFile,
  parseBackupFile,
  type BackupFileV1,
} from './backupFile';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from './playerState';

const now = new Date(2026, 10, 22, 10, 30);
const canonical = (data: unknown, version = PLAYER_STORAGE_VERSION) =>
  JSON.stringify({ version, data });
const exportOf = (data: PlayerState) => createBackupFile(canonical(data), now);
const fileOf = (data: PlayerState): BackupFileV1 =>
  JSON.parse(exportOf(data).content);
/** Reescreve o arquivo recalculando a soma de verificação (edição "válida"). */
function resign(file: BackupFileV1) {
  file.integrity.value = checksum(JSON.stringify(file.payload));
  return JSON.stringify(file);
}
function imported(text: string): PlayerState {
  const parsed = parseBackupFile(text);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.data;
}
/** Ignora apenas o metadado transitório documentado (`exportedAt`). */
const stable = (content: string) => {
  const file: Partial<BackupFileV1> = JSON.parse(content);
  delete file.exportedAt;
  return file;
};

describe('Exportação de backup', () => {
  it('inclui todos os registros persistentes, versão do formato e data', () => {
    const player = syntheticPlayer();
    const file = exportOf(player);
    const content = JSON.parse(file.content) as BackupFileV1;
    expect(file.fileName).toBe('life-rpg-backup-2026-11-22.json');
    expect(Object.keys(content).sort()).toEqual(
      [
        'exportedAt',
        'format',
        'formatVersion',
        'integrity',
        'payload',
        'summary',
      ].sort(),
    );
    expect(content.format).toBe(BACKUP_FORMAT);
    expect(content.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(content.exportedAt).toBe(now.toISOString());
    expect(content.payload).toEqual({
      version: PLAYER_STORAGE_VERSION,
      data: player,
    });
    // Cada categoria de registro está presente no arquivo.
    for (const [key, count] of Object.entries(content.summary))
      expect(count, key).toBeGreaterThan(0);
    expect(content.summary).toEqual(countBackupRecords(player));
    const data = content.payload.data as PlayerState;
    expect(data.profile).toEqual(player.profile);
    expect(data.preferences).toEqual({
      radarPeriod: 30,
      missionFilter: 'pending',
    });
    expect(data.character).toEqual(player.character);
    expect(data.records.advancedWorkouts).toEqual(
      player.records.advancedWorkouts,
    );
  });

  it('exporta um jogador sem registros', () => {
    const empty = createInitialPlayerState();
    const file = exportOf(empty);
    const content = JSON.parse(file.content) as BackupFileV1;
    expect(Object.values(content.summary).every((n) => n === 0)).toBe(true);
    expect(imported(file.content)).toEqual(empty);
  });

  it('exporta e valida muitos registros', () => {
    const many = syntheticPlayer(1000);
    const started = performance.now();
    const file = exportOf(many);
    const back = imported(file.content);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(back.records.movements).toHaveLength(3000);
    expect(back.records.advancedWorkouts?.sessions).toHaveLength(1000);
    expect(back).toEqual(many);
    expect(file.content.length).toBeLessThan(BACKUP_MAX_BYTES);
  });

  it('recusa exportar um canônico inválido ou de outra versão', () => {
    expect(() => createBackupFile(canonical({ broken: true }), now)).toThrow(
      /validação/,
    );
    expect(() =>
      createBackupFile(canonical(createInitialPlayerState(), 7), now),
    ).toThrow(/validação/);
  });

  it('não inclui nada além do contrato persistido', () => {
    const content = exportOf(syntheticPlayer()).content;
    expect(content).not.toMatch(/token|password|senha|apiKey|BRAPI/i);
  });
});

describe('Importação de backup', () => {
  it('aceita um backup válido e mostra a prévia', () => {
    const player = syntheticPlayer();
    const parsed = parseBackupFile(exportOf(player).content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual(player);
    expect(parsed.preview).toMatchObject({
      source: 'backup',
      exportedAt: now.toISOString(),
      storageVersion: PLAYER_STORAGE_VERSION,
      migrated: false,
      profileName: 'Jogador Sintético',
      counts: countBackupRecords(player),
    });
  });

  it.each([
    ['vazio', '   ', 'empty'],
    ['JSON truncado', '{"format":"life-rpg-backup","payl', 'corrupted'],
    ['texto qualquer', 'não é json', 'corrupted'],
    ['lista', '[]', 'unknown-format'],
    ['objeto desconhecido', '{"foo":1}', 'unknown-format'],
    [
      'outro formato',
      '{"format":"outro-app","formatVersion":1}',
      'unknown-format',
    ],
    [
      'versão de formato inválida',
      '{"format":"life-rpg-backup","formatVersion":"1"}',
      'invalid',
    ],
    [
      'campos obrigatórios ausentes',
      '{"format":"life-rpg-backup","formatVersion":1}',
      'invalid',
    ],
  ])('recusa arquivo %s', (_name, text, problem) => {
    const parsed = parseBackupFile(text);
    expect(parsed).toMatchObject({ ok: false, problem });
  });

  it('detecta JSON corrompido de um backup real truncado', () => {
    const content = exportOf(syntheticPlayer()).content;
    expect(parseBackupFile(content.slice(0, content.length / 2))).toMatchObject(
      { ok: false, problem: 'corrupted' },
    );
  });

  it('bloqueia formato e versão de registros futuros', () => {
    const file = fileOf(syntheticPlayer());
    expect(
      parseBackupFile(JSON.stringify({ ...file, formatVersion: 2 })),
    ).toMatchObject({ ok: false, problem: 'future-format' });
    file.payload.version = PLAYER_STORAGE_VERSION + 1;
    expect(parseBackupFile(resign(file))).toMatchObject({
      ok: false,
      problem: 'future-version',
    });
    expect(
      parseBackupFile(canonical(syntheticPlayer(), PLAYER_STORAGE_VERSION + 1)),
    ).toMatchObject({ ok: false, problem: 'future-version' });
  });

  it('recusa arquivo acima do limite antes do parse', () => {
    expect(parseBackupFile('{}', BACKUP_MAX_BYTES + 1)).toMatchObject({
      ok: false,
      problem: 'too-large',
    });
  });

  it('detecta conteúdo alterado ou incompleto', () => {
    const edited = fileOf(syntheticPlayer());
    (edited.payload.data as PlayerState).records.movements[0]!.amountCents = 1;
    expect(parseBackupFile(JSON.stringify(edited))).toMatchObject({
      ok: false,
      problem: 'integrity',
    });
    // Registro removido com soma recalculada: o resumo não confere.
    const incomplete = fileOf(syntheticPlayer());
    (incomplete.payload.data as PlayerState).records.movements.pop();
    expect(parseBackupFile(resign(incomplete))).toMatchObject({
      ok: false,
      problem: 'integrity',
    });
  });

  it('recusa registros que não passam na validação do aplicativo', () => {
    const file = fileOf(syntheticPlayer());
    (file.payload.data as PlayerState).records.movements[0]!.amountCents = -5;
    file.summary = countBackupRecords(file.payload.data as PlayerState);
    expect(parseBackupFile(resign(file))).toMatchObject({
      ok: false,
      problem: 'invalid',
    });
    const duplicated = fileOf(syntheticPlayer());
    const data = duplicated.payload.data as PlayerState;
    data.records.investments.push({ ...data.records.investments[0]! });
    duplicated.summary = countBackupRecords(data);
    expect(parseBackupFile(resign(duplicated))).toMatchObject({
      ok: false,
      problem: 'invalid',
    });
  });

  it('migra formatos antigos suportados com as migrações oficiais', () => {
    const player = syntheticPlayer();
    // Cópia bruta v7 (envelope do armazenamento baixado do Perfil).
    const fromCopy = parseBackupFile(canonical(player, 7));
    expect(fromCopy).toMatchObject({
      ok: true,
      preview: { source: 'storage-copy', migrated: true, storageVersion: 7 },
    });
    if (fromCopy.ok) expect(fromCopy.data).toEqual(player);
    // Backup com payload v4 (antes de `character`).
    const file = fileOf(player);
    const v4: Partial<PlayerState> = structuredClone(player);
    delete v4.character;
    file.payload = { version: 4, data: v4 };
    const migrated = parseBackupFile(resign(file));
    expect(migrated).toMatchObject({ ok: true, preview: { migrated: true } });
    if (migrated.ok) {
      expect(migrated.data.records).toEqual(player.records);
      expect(migrated.data.goals).toEqual(player.goals);
      expect(migrated.data.character).toEqual(
        createInitialPlayerState().character,
      );
    }
  });
});

describe('Integridade do ciclo exportar → importar → exportar', () => {
  it('produz dados semanticamente equivalentes', () => {
    const player = syntheticPlayer(5);
    const first = exportOf(player);
    const restored = imported(first.content);
    const second = createBackupFile(
      canonical(restored),
      new Date(2026, 10, 23, 8),
    );
    expect(restored).toEqual(player);
    expect(stable(second.content)).toEqual(stable(first.content));
  });

  it('preserva valores e relações financeiras exatamente', () => {
    const player = syntheticPlayer(10);
    const restored = imported(exportOf(player).content);
    const cents = (state: PlayerState) =>
      [
        ...state.records.movements,
        ...state.records.investmentEntries,
        ...(state.records.finance?.transfers ?? []),
        ...(state.records.finance?.valuations ?? []),
      ].reduce((sum, item) => sum + item.amountCents, 0);
    expect(cents(restored)).toBe(cents(player));
    expect(restored.records.movements).toEqual(player.records.movements);
    expect(restored.records.investments).toEqual(player.records.investments);
    expect(restored.records.investmentEntries).toEqual(
      player.records.investmentEntries,
    );
    expect(restored.records.finance).toEqual(player.records.finance);
    // Nenhum registro duplicado após o ciclo.
    const ids = restored.records.investmentEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of restored.records.investmentEntries)
      expect(
        restored.records.investments.some((i) => i.id === entry.investmentId),
      ).toBe(true);
  });

  it('preserva XP, nível, Radar, classe, conquistas e Quests', () => {
    const player = syntheticPlayer(3);
    const restored = imported(exportOf(player).content);
    const today = '2026-11-22';
    expect(projectCharacter(restored, today)).toEqual(
      projectCharacter(player, today),
    );
    expect(restored.goals).toEqual(player.goals);
    expect(restored.missionEvents).toEqual(player.missionEvents);
    expect(restored.progressOrigin).toEqual(player.progressOrigin);
  });
});
