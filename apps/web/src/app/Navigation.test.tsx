import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';
import { viewFromPath } from './useUrlNavigation';

afterEach(cleanup);
function navigation() {
  return within(
    screen.getByRole('navigation', { name: 'Navegação principal' }),
  );
}
const routes = [
  { path: '/', label: 'Início', heading: 'Visão geral' },
  { path: '/quests', label: 'Quests', heading: 'Quests' },
  { path: '/estatisticas', label: 'Estatísticas', heading: 'Sua evolução' },
  { path: '/perfil', label: 'Perfil', heading: 'Seu personagem' },
];

describe('Navegação baseada na URL', () => {
  it.each(routes)(
    'abre diretamente $path e mantém a página após recarregar',
    ({ path, label, heading }) => {
      window.history.replaceState(null, '', path);
      const app = render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(navigation().getByRole('button', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      );
      app.unmount();
      render(<App />);
      expect(window.location.pathname).toBe(path);
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(navigation().getByRole('button', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      );
    },
  );
  it('atualiza a URL pelos botões e não cria histórico duplicado para a página atual', () => {
    render(<App />);
    const push = vi.spyOn(window.history, 'pushState');
    for (const { path, label, heading } of [...routes.slice(1), routes[0]!]) {
      fireEvent.click(navigation().getByRole('button', { name: label }));
      expect(window.location.pathname).toBe(path);
      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
    }
    expect(push).toHaveBeenCalledTimes(4);
    fireEvent.click(navigation().getByRole('button', { name: 'Início' }));
    expect(push).toHaveBeenCalledTimes(4);
  });
  it('o atalho do radar usa a mesma rota de Estatísticas e sobrevive à recarga', () => {
    const app = render(<App />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver Radar de Evolução em Estatísticas',
      }),
    );
    expect(window.location.pathname).toBe('/estatisticas');
    expect(
      screen.getByRole('region', { name: 'Radar de Evolução' }),
    ).toBeInTheDocument();
    app.unmount();
    render(<App />);
    expect(
      screen.getByRole('region', { name: 'Radar de Evolução' }),
    ).toBeInTheDocument();
  });
  it('acompanha Voltar e Avançar sem perder progresso nem modificar o salvamento', async () => {
    const state = createInitialPlayerState();
    state.records.workouts = [{ date: '2026-11-13', trained: true }];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
    render(<App />);
    const saved = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(navigation().getByRole('button', { name: 'Quests' }));
    fireEvent.click(navigation().getByRole('button', { name: 'Perfil' }));
    act(() => window.history.back());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Quests' }),
      ).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe('/quests');
    expect(
      navigation().getByRole('button', { name: 'Quests' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.queryByRole('checkbox', { name: /Concluir missão/ }),
    ).not.toBeInTheDocument();
    act(() => window.history.back());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Visão geral' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '150');
    act(() => window.history.forward());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Quests' }),
      ).toBeInTheDocument(),
    );
    act(() => window.history.forward());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Seu personagem' }),
      ).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe('/perfil');
    expect(window.localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
    expect(writes).not.toHaveBeenCalled();
  });
  it('ignora query e âncora na seleção da página e aceita barra final', () => {
    window.history.replaceState(null, '', '/quests/?origem=teste#main');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument();
    expect(window.location.search).toBe('?origem=teste');
    expect(window.location.hash).toBe('#main');
    expect(viewFromPath('/perfil/')).toBe('profile');
    expect(viewFromPath('/desconhecida')).toBe('home');
  });
  it.each(['/missoes', '/metas'])(
    'redireciona %s para Quests sem oferecer recompensas',
    (path) => {
      window.history.replaceState(null, '', `${path}/?origem=antiga`);
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      render(<App />);
      expect(window.location.pathname).toBe('/quests');
      expect(
        screen.getByRole('heading', { name: 'Quests' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Missões' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(writes).not.toHaveBeenCalled();
    },
  );
  it('caminhos desconhecidos mostram Início e permitem continuar pela navegação', () => {
    window.history.replaceState(null, '', '/desconhecida');
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Visão geral' }),
    ).toBeInTheDocument();
    fireEvent.click(navigation().getByRole('button', { name: 'Quests' }));
    expect(window.location.pathname).toBe('/quests');
  });
});
