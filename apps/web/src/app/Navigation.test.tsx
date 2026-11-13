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
import { PLAYER_STORAGE_KEY } from './playerState';
import { viewFromPath } from './useUrlNavigation';

afterEach(cleanup);
function navigation() {
  return within(
    screen.getByRole('navigation', { name: 'Navegação principal' }),
  );
}
const routes = [
  { path: '/', label: 'Início', heading: 'Visão geral' },
  { path: '/missoes', label: 'Missões', heading: 'Suas missões' },
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
    render(<App />);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    );
    const saved = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(navigation().getByRole('button', { name: 'Missões' }));
    fireEvent.click(navigation().getByRole('button', { name: 'Perfil' }));
    act(() => window.history.back());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Suas missões' }),
      ).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe('/missoes');
    expect(
      navigation().getByRole('button', { name: 'Missões' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('checkbox', {
        name: 'Concluir missão: Um passo mais forte',
      }),
    ).toBeChecked();
    act(() => window.history.back());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Visão geral' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '1790');
    act(() => window.history.forward());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Suas missões' }),
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
    window.history.replaceState(null, '', '/missoes/?origem=teste#main');
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Suas missões' }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe('?origem=teste');
    expect(window.location.hash).toBe('#main');
    expect(viewFromPath('/perfil/')).toBe('profile');
    expect(viewFromPath('/desconhecida')).toBe('home');
  });
  it('caminhos desconhecidos mostram Início e permitem continuar pela navegação', () => {
    window.history.replaceState(null, '', '/desconhecida');
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Visão geral' }),
    ).toBeInTheDocument();
    fireEvent.click(navigation().getByRole('button', { name: 'Missões' }));
    expect(window.location.pathname).toBe('/missoes');
  });
});
