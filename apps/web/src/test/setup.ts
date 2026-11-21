import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach, vi } from 'vitest';

// Component suites use a synchronous storage boundary, not a hook mock.
// Native transactions, async hydration and cross-tab races have separate
// Chromium integration coverage in the persistence/PWA audit.
vi.mock('../app/playerRepository', async () => {
  const { createLocalStateStorage } =
    await import('../shared/storage/localStateStorage');
  const {
    PLAYER_STORAGE_KEY,
    PLAYER_STORAGE_VERSION,
    isPlayerState,
    migratePlayerState,
  } = await import('../app/playerState');
  const { createBackup, listBackups } =
    await import('../shared/storage/backups');
  const base = createLocalStateStorage(
    PLAYER_STORAGE_KEY,
    PLAYER_STORAGE_VERSION,
    isPlayerState,
    undefined,
    migratePlayerState,
  );
  return {
    browserPlayerStorage: {
      ...base,
      copies: {
        listCopies: () => listBackups(localStorage, PLAYER_STORAGE_KEY),
        readCopy: (key: string) => localStorage.getItem(key),
      },
      write: (
        data: Parameters<typeof base.write>[0],
        expected: string | null,
        options?: { replaceProtected?: boolean },
      ) => {
        if (
          options?.replaceProtected &&
          localStorage.getItem(PLAYER_STORAGE_KEY) === expected &&
          expected !== null
        )
          createBackup(localStorage, PLAYER_STORAGE_KEY, expected);
        return base.write(data, expected, options);
      },
      restore: (key: string, expected: string | null) => {
        const raw = localStorage.getItem(key),
          current = localStorage.getItem(PLAYER_STORAGE_KEY);
        if (current !== expected) return { status: 'conflict' as const };
        if (raw === null) return { status: 'failed' as const };
        if (current !== null)
          createBackup(localStorage, PLAYER_STORAGE_KEY, current);
        localStorage.setItem(PLAYER_STORAGE_KEY, raw);
        return { status: 'saved' as const, raw };
      },
    },
  };
});

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 10, 13, 12));
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
