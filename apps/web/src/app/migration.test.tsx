import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { App } from './App';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';
import {
  initialMissions,
  initialProgress,
  achievements,
} from './mocks/dashboard';
import { effortHistory } from './mocks/effort';
import {
  recordReward,
  projectEffortActivities,
} from '../modules/records/progression';
import { realMissionHistory } from '../modules/missions/catalog';
import { createLocalStateStorage } from '../shared/storage/localStateStorage';
import { emptyRecords } from '../modules/records/types';
import { achievementState, openProfile } from '../test/achievements';
afterEach(cleanup);
function legacy(version = 2) {
  const state = createInitialPlayerState();
  state.profile.name = 'Veterana';
  state.profile.focus = 'Meu foco pessoal';
  state.progressOrigin = { ...initialProgress };
  state.missionCompletion = initialMissions.map((m) => ({
    id: m.id,
    completed: m.id === 'workout' ? true : m.completed,
  }));
  state.unlockedAchievementIds = achievements
    .filter((a) => a.unlocked)
    .map((a) => a.id);
  state.activityHistory = effortHistory;
  state.records = {
    ...emptyRecords(),
    movements: [
      {
        id: 'salary',
        kind: 'income',
        description: 'Salário',
        amountCents: 100000,
        category: 'Trabalho',
        date: '2026-11-13',
      },
    ],
    workouts: [{ date: '2026-11-13', trained: true }],
    sleep: [{ date: '2026-11-13', hours: 8 }],
    books: [{ id: 'book', title: 'Meu livro', totalPages: 100 }],
    readings: [
      { id: 'reading', bookId: 'book', pages: 20, date: '2026-11-13' },
    ],
  };
  const value: Record<string, unknown> = { ...state };
  delete value.missionEvents;
  if (version === 1) delete value.records;
  return value;
}
describe('Migração única para evolução real v3', () => {
  it.each([1, 2])(
    'migra v%s sem alterar o conteúdo antigo até gravar com segurança',
    (version) => {
      const old = legacy(version),
        raw = JSON.stringify({ version, data: old });
      localStorage.setItem(PLAYER_STORAGE_KEY, raw);
      const storage = createLocalStateStorage(
        PLAYER_STORAGE_KEY,
        PLAYER_STORAGE_VERSION,
        isPlayerState,
        () => localStorage,
        migratePlayerState,
      );
      const result = storage.load();
      expect(result.status).toBe('loaded');
      expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
      if (result.status !== 'loaded') throw new Error('Migração esperada');
      expect(result.data.profile).toEqual(old.profile);
      expect(result.data.progressOrigin).toEqual({
        level: 1,
        xp: 0,
        xpPerLevel: 2000,
      });
      expect(result.data.activityHistory).toEqual([]);
      expect(result.data.unlockedAchievementIds).toEqual([]);
      expect(result.data.records).toEqual(
        version === 1 ? emptyRecords() : old.records,
      );
      expect(result.data.missionEvents).toEqual([
        {
          missionId: 'workout',
          date: '2026-11-13',
          source: 'user',
          completed: true,
        },
      ]);
      expect(
        recordReward(
          result.data.records,
          realMissionHistory(result.data.missionEvents),
          '2026-11-13',
        ),
      ).toBe(version === 1 ? 150 : 450);
      expect(storage.save(result.data)).toBe(true);
      expect(storage.load()).toEqual({
        status: 'loaded',
        data: result.data,
        raw: localStorage.getItem(PLAYER_STORAGE_KEY),
      });
      expect(
        JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).version,
      ).toBe(PLAYER_STORAGE_VERSION);
      expect(
        migratePlayerState(PLAYER_STORAGE_VERSION, result.data),
      ).toBeNull();
    },
  );
  it('elimina apenas demonstração e conserva missões marcadas pelo usuário, registros e perfil em StrictMode', () => {
    const old = legacy();
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 2, data: old }),
    );
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(
      screen.getByRole('img', { name: 'Avatar de Veterana' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '450');
    expect(
      screen.queryByRole('checkbox', { name: /Concluir missão/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Missões' }),
    ).not.toBeInTheDocument();
    openProfile();
    expect(achievementState('Em chamas')).toBe('locked');
    const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
    expect(writes).toHaveBeenCalledTimes(1);
    app.unmount();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
    expect(writes).toHaveBeenCalledTimes(1);
    const data = JSON.parse(saved!).data;
    expect(data.records).toEqual(old.records);
    expect(data.profile).toEqual(old.profile);
    expect(
      projectEffortActivities(
        data.activityHistory,
        realMissionHistory(data.missionEvents),
        data.records,
        '2026-11-13',
      ),
    ).toHaveLength(4);
  });
  it('conserva o original se a gravação falhar e exibe o progresso real em memória', () => {
    const raw = JSON.stringify({ version: 2, data: legacy() });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '450');
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
  });
  it('não migra dados inválidos ou versões desconhecidas', () => {
    expect(migratePlayerState(2, { ...legacy(), records: {} })).toBeNull();
    expect(migratePlayerState(1, { profile: {} })).toBeNull();
    expect(migratePlayerState(999, legacy())).toBeNull();
  });
});
