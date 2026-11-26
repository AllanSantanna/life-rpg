import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyRecordCommand } from '../modules/records/commands';
import { App } from './App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';
import { latestRelease } from './whats-new/releases';
import { WHATS_NEW_KEY } from './whats-new/whatsNewPreference';

/**
 * Fluxo completo das Novidades da versão no App, com perfis sintéticos.
 * A janela abre após uma breve espera (800 ms), então os casos usam timers
 * reais e `findBy` com folga.
 */
const current = latestRelease()!.id;
const WAIT = { timeout: 4000 };
const seen = () =>
  (
    JSON.parse(localStorage.getItem(WHATS_NEW_KEY) ?? 'null') as {
      data?: { seen?: string };
    } | null
  )?.data?.seen ?? null;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const newsDialog = () =>
  screen.queryByRole('dialog', { name: 'Novidades da versão' });

/** Jogador existente sintético: um sono, uma despesa e um livro. */
function seedExistingPlayer() {
  const state = createInitialPlayerState();
  let records = applyRecordCommand(
    state.records,
    { type: 'saveSleep', value: { date: '2026-11-12', hours: 7.5 } },
    '2026-11-13',
  );
  records = applyRecordCommand(
    records,
    {
      type: 'saveMovement',
      value: {
        id: 'mov-1',
        kind: 'expense',
        description: 'Mercado',
        amountCents: 4200,
        category: 'Alimentação',
        date: '2026-11-12',
      },
    },
    '2026-11-13',
  );
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: { ...state, records },
    }),
  );
}
/** Instantâneo de tudo o que não é a preferência de novidades. */
function personalData() {
  const entries: [string, string | null][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key !== WHATS_NEW_KEY) entries.push([key, localStorage.getItem(key)]);
  }
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

beforeEach(() => {
  // O setup semeia uma versão posterior; aqui o cenário define a preferência.
  localStorage.removeItem(WHATS_NEW_KEY);
});
afterEach(cleanup);

describe('Novidades da versão no App', () => {
  it('usuário existente vê a janela uma vez; fechar pelo × registra a versão', async () => {
    seedExistingPlayer();
    render(<App />);
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Novidades da versão' },
      WAIT,
    );
    expect(within(dialog).getByText('Ações rápidas')).toBeVisible();
    expect(within(dialog).getByText('Comandos por voz')).toBeVisible();
    // Exibida, ainda não fechada: nada registrado.
    expect(seen()).toBeNull();
    const before = personalData();
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Fechar novidades da versão',
      }),
    );
    expect(newsDialog()).toBeNull();
    expect(seen()).toBe(current);
    // Nenhum registro, XP, Quest ou backup foi alterado pela janela.
    expect(personalData()).toEqual(before);

    // Reabrir o aplicativo (recarregar) não mostra a mesma versão.
    cleanup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await pause(1500);
    expect(newsDialog()).toBeNull();
    expect(seen()).toBe(current);
  });

  it('fechar por Escape registra a versão', async () => {
    seedExistingPlayer();
    render(<App />);
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Novidades da versão' },
      WAIT,
    );
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(newsDialog()).toBeNull();
    expect(seen()).toBe(current);
  });

  it('“Começar a usar” fecha na hora, registra a versão e devolve o foco à página', async () => {
    seedExistingPlayer();
    render(<App />);
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Novidades da versão' },
      WAIT,
    );
    const start = within(dialog).getByRole('button', {
      name: 'Começar a usar',
    });
    expect(start).toHaveFocus();
    fireEvent.click(start);
    expect(newsDialog()).toBeNull();
    expect(seen()).toBe(current);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('instalação nova não vê a janela e já registra a versão atual', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(seen()).toBe(current));
    await pause(1500);
    expect(newsDialog()).toBeNull();
  });

  it('preferência antiga sem registros (usuário que já usava) recebe a versão nova', async () => {
    localStorage.setItem(
      WHATS_NEW_KEY,
      JSON.stringify({ version: 1, data: { seen: '2026-01-01' } }),
    );
    render(<App />);
    expect(
      await screen.findByRole('dialog', { name: 'Novidades da versão' }, WAIT),
    ).toBeInTheDocument();
  });

  it('versão já apresentada não abre automaticamente', async () => {
    seedExistingPlayer();
    localStorage.setItem(
      WHATS_NEW_KEY,
      JSON.stringify({ version: 1, data: { seen: current } }),
    );
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    await pause(1500);
    expect(newsDialog()).toBeNull();
  });

  it('não abre sobre outro diálogo: espera o comando por voz fechar', async () => {
    seedExistingPlayer();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Comando por voz' }));
    const voice = screen.getByRole('dialog', { name: 'Comando por voz' });
    await pause(1500);
    expect(newsDialog()).toBeNull();
    expect(seen()).toBeNull();
    fireEvent.click(
      within(voice).getByRole('button', { name: 'Fechar comando por voz' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Novidades da versão' }, WAIT),
    ).toBeInTheDocument();
  });

  it('abre manualmente pelo Perfil sem alterar a preferência nem os registros', async () => {
    seedExistingPlayer();
    localStorage.setItem(
      WHATS_NEW_KEY,
      JSON.stringify({ version: 1, data: { seen: '9999-12-31' } }),
    );
    window.history.replaceState(null, '', '/perfil');
    render(<App />);
    const open = await screen.findByRole('button', { name: 'Ver novidades' });
    const before = personalData();
    // No navegador o clique foca o botão; o jsdom precisa do foco explícito.
    open.focus();
    fireEvent.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Novidades da versão' });
    expect(within(dialog).getByText('Finanças reorganizadas')).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Começar a usar' }),
    );
    expect(newsDialog()).toBeNull();
    expect(open).toHaveFocus();
    expect(seen()).toBe('9999-12-31');
    expect(personalData()).toEqual(before);
  });
});
