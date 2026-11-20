import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRecordCommand } from '../modules/records/commands';
import {
  projectCharacter,
  reconcileCharacter,
} from '../modules/profile/character';
import { createLocalStateStorage } from '../shared/storage/localStateStorage';
import { listBackups } from '../shared/storage/backups';
import { App } from './App';
import {
  createInitialPlayerState,
  isPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from './playerState';
import { createPlayerStorage, usePlayerState } from './usePlayerState';

// Ambiente jsdom isolado: o localStorage daqui nunca é o do navegador real.
afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.setSystemTime(new Date('2026-11-20T12:00:00'));
});
const today = '2026-11-20';
const envelope = (data: unknown, version = PLAYER_STORAGE_VERSION) =>
  JSON.stringify({ version, data });
const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function withSleep(state: PlayerState, date: string, hours: number) {
  const next = {
    ...state,
    records: applyRecordCommand(
      state.records,
      { type: 'saveSleep', value: { date, hours } },
      today,
    ),
  };
  // Já reconciliado: a reconciliação de classe (gravada uma vez na abertura,
  // por desenho) não interfere nos testes de gravação.
  return reconcileCharacter(next, projectCharacter(next, today));
}
function train(name: 'Sim' | 'Não' = 'Sim') {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name: 'Pilares' }),
  );
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Quatro pilares' }),
    ).getByRole('button', { name: /Treinos/ }),
  );
  fireEvent.click(
    within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
      'button',
      { name },
    ),
  );
}
/** Outra aba grava e o navegador dispara o evento `storage` nesta. */
function otherTabWrites(raw: string) {
  localStorage.setItem(PLAYER_STORAGE_KEY, raw);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key: PLAYER_STORAGE_KEY, newValue: raw }),
    );
  });
}

describe('proteção dos registros salvos', () => {
  it('estado válido: nada é gravado na abertura e a ação grava normalmente', () => {
    const base = withSleep(createInitialPlayerState(), '2026-11-19', 7);
    const raw = envelope(base);
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    train();
    expect(stored().records.sleep).toEqual(base.records.sleep);
    expect(stored().records.workouts).toEqual([{ date: today, trained: true }]);
    expect(
      screen.getByText('Registros salvos neste navegador · evolução real'),
    ).toBeInTheDocument();
  });

  it('dados parcialmente corrompidos ficam intactos; recuperação guarda cópia verificada e é reversível', () => {
    const valid = withSleep(createInitialPlayerState(), '2026-11-19', 7);
    const corrupted = structuredClone(valid);
    corrupted.records.sleep[0]!.hours = 24.5; // um único campo inválido
    const raw = envelope(corrupted);
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    const notice = screen.getByRole('alert', {
      name: 'Registros salvos protegidos',
    });
    expect(
      within(notice).getByRole('button', {
        name: 'Baixar cópia dos registros',
      }),
    ).toBeInTheDocument();
    train();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    // Começar do zero exige confirmação; Cancelar não altera nada.
    fireEvent.click(
      within(notice).getByRole('button', {
        name: 'Começar do zero guardando uma cópia',
      }),
    );
    fireEvent.click(within(notice).getByRole('button', { name: 'Cancelar' }));
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    fireEvent.click(
      within(notice).getByRole('button', {
        name: 'Começar do zero guardando uma cópia',
      }),
    );
    fireEvent.click(
      within(notice).getByRole('button', {
        name: 'Guardar cópia e começar do zero',
      }),
    );
    const [backup] = listBackups(localStorage, PLAYER_STORAGE_KEY);
    expect(localStorage.getItem(backup!.key)).toBe(raw);
    expect(isPlayerState(stored())).toBe(true);
    expect(
      screen.queryByRole('alert', { name: 'Registros salvos protegidos' }),
    ).not.toBeInTheDocument();
    // Reversível: restaurar devolve o bruto original (de novo protegido) e
    // guarda o estado novo como outra cópia.
    const fresh = localStorage.getItem(PLAYER_STORAGE_KEY)!;
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Perfil' }),
    );
    const copies = screen.getByRole('region', {
      name: 'Cópias de segurança dos registros',
    });
    fireEvent.click(
      within(copies).getByRole('button', { name: /^Restaurar cópia de/ }),
    );
    fireEvent.click(
      within(copies).getByRole('button', { name: 'Restaurar cópia' }),
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      listBackups(localStorage, PLAYER_STORAGE_KEY).map((b) =>
        localStorage.getItem(b.key),
      ),
    ).toEqual(expect.arrayContaining([raw, fresh]));
    expect(
      screen.getByRole('alert', { name: 'Registros salvos protegidos' }),
    ).toBeInTheDocument();
  });

  it('se a cópia de segurança falhar, nada é substituído', () => {
    const raw = envelope({ broken: true });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.includes(':backup:')) throw new Error('quota');
      original.call(this, key, value);
    });
    const notice = screen.getByRole('alert', {
      name: 'Registros salvos protegidos',
    });
    fireEvent.click(
      within(notice).getByRole('button', {
        name: 'Começar do zero guardando uma cópia',
      }),
    );
    fireEvent.click(
      within(notice).getByRole('button', {
        name: 'Guardar cópia e começar do zero',
      }),
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(within(notice).getByText(/Baixe uma cópia/)).toBeInTheDocument();
  });

  it('v7 → v8 sem regravar na abertura; a próxima ação grava v8 preservando o histórico', () => {
    const base = withSleep(createInitialPlayerState(), '2026-11-19', 6.5);
    const raw = envelope(base, 7);
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    train();
    const saved = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!);
    expect(saved.version).toBe(8);
    expect(saved.data.records.sleep).toEqual(base.records.sleep);
    expect(saved.data.profile).toEqual(base.profile);
  });

  it('versão antiga do app (v7) não grava por cima de dados v8', () => {
    const raw = envelope(createInitialPlayerState());
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    const oldApp = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      7,
      isPlayerState,
      undefined,
      () => null,
    );
    expect(oldApp.load()).toEqual({ status: 'incompatible', raw });
    expect(oldApp.save(createInitialPlayerState())).toBe(false);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });

  it('migração interrompida e campos desconhecidos não descartam dados', () => {
    const broken = envelope({ character: 'quebrado' }, 6);
    const storage = createPlayerStorage();
    localStorage.setItem(PLAYER_STORAGE_KEY, broken);
    expect(storage.load()).toEqual({ status: 'incompatible', raw: broken });
    // Campo desconhecido (ex.: de uma versão futura compatível): é aceito e
    // regravado junto, nunca descartado.
    const extra = { ...createInitialPlayerState(), futureField: { a: 1 } };
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(extra));
    const loaded = storage.load();
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.data).toHaveProperty('futureField', { a: 1 });
    expect(storage.write(loaded.data, loaded.raw).status).toBe('saved');
    expect(stored()).toHaveProperty('futureField', { a: 1 });
  });

  it('duas abas com registros diferentes: ambos são preservados', () => {
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      envelope(createInitialPlayerState()),
    );
    render(<App />);
    // Outra aba registra um sono, com evento de sincronização.
    otherTabWrites(
      envelope(withSleep(createInitialPlayerState(), '2026-11-18', 8)),
    );
    train();
    expect(stored().records.sleep).toEqual([{ date: '2026-11-18', hours: 8 }]);
    expect(stored().records.workouts).toEqual([{ date: today, trained: true }]);
    // Sem evento (corrida): a ação ainda parte dos dados mais recentes.
    const latest = stored();
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      envelope(withSleep(latest, '2026-11-17', 7)),
    );
    train('Não');
    expect(stored().records.sleep).toHaveLength(2);
    expect(stored().records.workouts).toEqual([
      { date: today, trained: false },
    ]);
  });

  it('duas abas no mesmo registro: corrida detectada vira conflito, sem sobrescrita', () => {
    const initial = createInitialPlayerState();
    localStorage.setItem(PLAYER_STORAGE_KEY, envelope(initial));
    const real = createPlayerStorage();
    let racing = false;
    // Outra aba grava entre a aplicação da ação e a gravação desta aba.
    const storage = {
      ...real,
      write: (...args: Parameters<typeof real.write>) => {
        if (racing)
          localStorage.setItem(
            PLAYER_STORAGE_KEY,
            envelope(withSleep(initial, '2026-11-19', 9)),
          );
        return real.write(...args);
      },
    };
    const { result } = renderHook(() => usePlayerState(today, storage));
    racing = true;
    act(() =>
      result.current.setState((previous) =>
        withSleep(previous, '2026-11-19', 5),
      ),
    );
    expect(result.current.persistence.kind).toBe('conflict');
    expect(stored().records.sleep).toEqual([{ date: '2026-11-19', hours: 9 }]);
    racing = false;
    // Nenhuma gravação até a decisão; recarregar adota a versão da outra aba.
    act(() => result.current.reloadStored());
    expect(result.current.persistence.kind).toBe('saved');
    expect(result.current.state.records.sleep).toEqual([
      { date: '2026-11-19', hours: 9 },
    ]);
  });

  it('o aviso de conflito explica e permite carregar os registros atuais', () => {
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      envelope(createInitialPlayerState()),
    );
    const real = createPlayerStorage();
    const storage = {
      ...real,
      write: () => ({ status: 'conflict' as const }),
    };
    const { result } = renderHook(() => usePlayerState(today, storage));
    act(() =>
      result.current.setState((previous) => withSleep(previous, today, 7)),
    );
    expect(result.current.persistence).toEqual({ kind: 'conflict' });
  });
});
