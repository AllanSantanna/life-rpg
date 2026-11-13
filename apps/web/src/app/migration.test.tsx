import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import {
  createDemoPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
} from './playerState';
import { createLocalStateStorage } from '../shared/storage/localStateStorage';
import { emptyRecords } from '../modules/records/types';

afterEach(cleanup);
function legacyData() {
  const initial = createDemoPlayerState();
  const legacy: Record<string, unknown> = { ...initial };
  delete legacy.records;
  legacy.profile = { ...initial.profile, name: 'Veterana' };
  legacy.missionCompletion = initial.missionCompletion.map((item) =>
    item.id === 'workout' ? { ...item, completed: true } : item,
  );
  return legacy;
}

describe('Migração segura de v1 para v2', () => {
  it('migra em memória preservando o conteúdo antigo até uma gravação válida', () => {
    const legacy = legacyData();
    const raw = JSON.stringify({ version: 1, data: legacy });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    const store = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      2,
      isPlayerState,
      undefined,
      migratePlayerState,
    );
    const loaded = store.load();
    expect(loaded).toEqual({
      status: 'loaded',
      migrated: true,
      data: { ...legacy, records: emptyRecords() },
    });
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    if (loaded.status !== 'loaded')
      throw new Error('A migração deve ser válida');
    expect(store.save(loaded.data)).toBe(true);
    expect(JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).version).toBe(
      2,
    );
  });
  it('preserva perfil, XP, missões, conquistas e radar ao atualizar a aplicação', () => {
    const legacy = legacyData();
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 1, data: legacy }),
    );
    const app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(
      screen.getByRole('img', { name: 'Avatar de Veterana' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '1790');
    const saved = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.data).toEqual({ ...legacy, records: emptyRecords() });
    const radar = screen.getByRole('figure', {
      name: 'Radar de Evolução · 7 dias',
    }).textContent;
    app.unmount();
    render(<App />);
    expect(
      screen.getByRole('figure', { name: 'Radar de Evolução · 7 dias' })
        .textContent,
    ).toBe(radar);
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Pilares' }),
    );
    expect(
      JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data.records,
    ).toEqual(emptyRecords());
  });
  it('falha de escrita durante a migração mantém os dados v1 intactos e utilizáveis', () => {
    const raw = JSON.stringify({ version: 1, data: legacyData() });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByRole('img', { name: 'Avatar de Veterana' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
  });
  it('não migra estruturas inválidas ou versões desconhecidas', () => {
    expect(migratePlayerState(1, { profile: {} })).toBeNull();
    expect(migratePlayerState(99, legacyData())).toBeNull();
  });
});
