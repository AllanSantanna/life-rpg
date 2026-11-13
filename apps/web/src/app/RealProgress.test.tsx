import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { App } from './App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';
import { shiftDate } from '../modules/records/dates';
afterEach(cleanup);
const xp = () =>
  screen.getByRole('progressbar', { name: 'Experiência do jogador' });
describe('Nível e progresso reais na interface', () => {
  it('calcula nível 2 com 2100 XP reais e recalcula após excluir um treino', () => {
    const state = createInitialPlayerState();
    state.records.workouts = Array.from({ length: 14 }, (_, i) => ({
      date: shiftDate('2026-11-13', -i),
      trained: true,
    }));
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
    const app = render(<App />);
    expect(screen.getByText('Nível 2')).toBeInTheDocument();
    expect(xp()).toHaveAttribute('aria-valuenow', '100');
    app.unmount();
    state.records.workouts.pop();
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 3, data: state }),
    );
    render(<App />);
    expect(screen.getByText('Nível 1')).toBeInTheDocument();
    expect(xp()).toHaveAttribute('aria-valuenow', '1950');
  });
  it('editar e excluir atividades na aplicação recalcula XP, atributos e conquistas após recarga', () => {
    const state = createInitialPlayerState();
    state.records.workouts = [{ date: '2026-11-13', trained: true }];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 3, data: state }),
    );
    window.history.replaceState(null, '', '/treinos');
    const app = render(<App />);
    const form = screen.getByRole('form', { name: 'Treinou hoje?' });
    fireEvent.click(within(form).getByRole('button', { name: 'Não' }));
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Início' }),
    );
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: 'Força' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(
      screen
        .getByRole('heading', { name: 'Primeiro passo' })
        .closest('article'),
    ).toHaveClass('is-locked');
    app.unmount();
    render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
  });
});
