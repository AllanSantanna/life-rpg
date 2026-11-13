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
import { createDemoPlayerState, PLAYER_STORAGE_KEY } from './playerState';

afterEach(cleanup);
const xp = () =>
  screen.getByRole('progressbar', { name: 'Experiência do jogador' });
const workout = () =>
  screen.getByRole('checkbox', {
    name: 'Concluir missão: Um passo mais forte',
  });
const workoutScore = () =>
  screen
    .getByRole('progressbar', { name: 'Treinos: Dedicação · 7 dias' })
    .getAttribute('aria-valuenow');
function navigate(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
function saved() {
  return localStorage.getItem(PLAYER_STORAGE_KEY);
}

describe('Persistência automática do jogador', () => {
  it('carrega o demo na primeira utilização sem gravações de inicialização, inclusive em StrictMode', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(xp()).toHaveAttribute('aria-valuenow', '1640');
    expect(workout()).not.toBeChecked();
    expect(saved()).toBeNull();
    expect(writes).not.toHaveBeenCalled();
    fireEvent.click(workout());
    expect(writes).toHaveBeenCalledTimes(1);
    expect(saved()).not.toBeNull();
  });
  it('recupera subida de nível, missões e radar; desfaz e salva sem acumular XP duplicado', () => {
    let app = render(<App />);
    const initialScore = workoutScore();
    for (const mission of screen.getAllByRole('checkbox')) {
      if (!(mission as HTMLInputElement).checked) fireEvent.click(mission);
    }
    const completedScore = workoutScore();
    expect(completedScore).not.toBe(initialScore);
    expect(xp()).toHaveAttribute('aria-valuenow', '90');
    const raw = saved();
    app.unmount();
    app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(saved()).toBe(raw);
    expect(workout()).toBeChecked();
    expect(xp()).toHaveAttribute('aria-valuenow', '90');
    expect(screen.getByText('Explorador', { exact: false })).toHaveTextContent(
      'Nível 13',
    );
    expect(workoutScore()).toBe(completedScore);
    const radar = screen.getByRole('figure', {
      name: 'Radar de Evolução · 7 dias',
    });
    expect(within(radar).getByRole('img')).toHaveAccessibleDescription(
      expect.stringContaining(`Treinos: ${completedScore} de 100`),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver Radar de Evolução em Estatísticas',
      }),
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Radar de Evolução' }),
      ).getByRole('img'),
    ).toHaveAccessibleDescription(
      expect.stringContaining(`Treinos: ${completedScore} de 100`),
    );
    navigate('Início');
    fireEvent.click(workout());
    expect(xp()).toHaveAttribute('aria-valuenow', '1940');
    expect(workoutScore()).toBe(initialScore);
    app.unmount();
    app = render(<App />);
    expect(workout()).not.toBeChecked();
    expect(xp()).toHaveAttribute('aria-valuenow', '1940');
    expect(screen.getByText('Explorador', { exact: false })).toHaveTextContent(
      'Nível 12',
    );
    expect(workoutScore()).toBe(initialScore);
    fireEvent.click(workout());
    expect(xp()).toHaveAttribute('aria-valuenow', '90');
    app.unmount();
    render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '90');
  });
  it('recupera perfil, origem de XP, conquistas e atividades salvas sem repor mocks', () => {
    const state = createDemoPlayerState();
    state.profile.name = 'Lia';
    state.profile.title = 'Guardiã';
    state.progressOrigin = { level: 4, xp: 1000, xpPerLevel: 2000 };
    state.unlockedAchievementIds.push('reader');
    state.activityHistory = [];
    const raw = JSON.stringify({ version: 2, data: state });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    expect(
      screen.getByRole('img', { name: 'Avatar de Lia' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Guardiã', { exact: false })).toHaveTextContent(
      'Nível 4',
    );
    expect(xp()).toHaveAttribute('aria-valuenow', '1000');
    expect(workoutScore()).toBe('0');
    expect(
      screen.getByRole('heading', { name: 'Mente curiosa' }).closest('article'),
    ).toHaveClass('is-unlocked');
    expect(saved()).toBe(raw);
    fireEvent.click(workout());
    expect(xp()).toHaveAttribute('aria-valuenow', '1150');
    expect(workoutScore()).toBe('25');
    expect(JSON.parse(saved()!).data.activityHistory).toEqual([]);
  });
  it('preserva os filtros existentes após recarregar, mantendo o radar pequeno em 7 dias', () => {
    const app = render(<App />);
    navigate('Missões');
    fireEvent.click(screen.getByRole('button', { name: 'Pendentes' }));
    navigate('Estatísticas');
    fireEvent.click(screen.getByRole('button', { name: '30 dias' }));
    app.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    navigate('Início');
    expect(
      screen.getByRole('figure', { name: 'Radar de Evolução · 7 dias' }),
    ).toBeInTheDocument();
    navigate('Missões');
    expect(screen.getByRole('button', { name: 'Pendentes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    navigate('Estatísticas');
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it.each(['{', '{"version":2,"data":{}}'])(
    'continua funcionando com dados inválidos: %s',
    (raw) => {
      localStorage.setItem(PLAYER_STORAGE_KEY, raw);
      const app = render(<App />);
      expect(xp()).toHaveAttribute('aria-valuenow', '1640');
      expect(saved()).toBe(raw);
      fireEvent.click(workout());
      expect(xp()).toHaveAttribute('aria-valuenow', '1790');
      expect(JSON.parse(saved()!).version).toBe(2);
      app.unmount();
      render(<App />);
      expect(workout()).toBeChecked();
      expect(xp()).toHaveAttribute('aria-valuenow', '1790');
    },
  );
  it('não sobrescreve uma versão incompatível e permite continuar apenas na sessão', () => {
    const raw = JSON.stringify({ version: 999, data: createDemoPlayerState() });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    fireEvent.click(workout());
    expect(xp()).toHaveAttribute('aria-valuenow', '1790');
    expect(saved()).toBe(raw);
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
  });
  it('falha de gravação não interrompe missões, XP ou radar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    render(<App />);
    const initial = workoutScore();
    fireEvent.click(workout());
    expect(workout()).toBeChecked();
    expect(xp()).toHaveAttribute('aria-valuenow', '1790');
    expect(workoutScore()).not.toBe(initial);
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
    fireEvent.click(workout());
    expect(xp()).toHaveAttribute('aria-valuenow', '1640');
    expect(workoutScore()).toBe(initial);
  });
  it('acesso ao localStorage bloqueado não impede a abertura ou as interações', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '1640');
    fireEvent.click(workout());
    expect(xp()).toHaveAttribute('aria-valuenow', '1790');
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
  });
});
