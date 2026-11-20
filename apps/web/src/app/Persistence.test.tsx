import { projectCharacter } from '../modules/profile/character';
import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { App } from './App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';
afterEach(cleanup);
const xp = () =>
  screen.getByRole('progressbar', { name: 'Experiência do jogador' });
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
function train(yes = true) {
  nav('Pilares');
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Quatro pilares' }),
    ).getByRole('button', { name: /Treinos/ }),
  );
  const form = screen.getByRole('form', { name: 'Treinou hoje?' });
  fireEvent.click(
    within(form).getByRole('button', { name: yes ? 'Sim' : 'Não' }),
  );
  nav('Início');
}
describe('Persistência da evolução real', () => {
  it('começa em nível 1/0 XP sem gravar na montagem ou oferecer missões', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Nível 1')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Concluir missão/ }),
    ).not.toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    train();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).version).toBe(
      PLAYER_STORAGE_VERSION,
    );
  });
  it('conserva atividade real, XP e Radar na recarga e desfaz sem duplicar', () => {
    let app = render(<App />);
    train();
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByRole('progressbar', { name: 'Treinos: Dedicação · 7 dias' }),
    ).toHaveAttribute('aria-valuenow', '25');
    train(false);
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
    app.unmount();
    render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
  });
  it('mantém informações pessoais e progresso real sem desbloqueios artificiais', () => {
    const state = createInitialPlayerState();
    state.profile.name = 'Lia';
    state.profile.title = 'Guardiã';
    state.records.workouts = [{ date: '2026-11-13', trained: true }];
    state.character.classification = projectCharacter(
      state,
      '2026-11-13',
    ).classification.state;
    const raw = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    expect(
      screen.getByRole('img', { name: 'Avatar de Lia' }),
    ).toBeInTheDocument();
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    expect(
      screen.getByRole('heading', { name: 'Mente curiosa' }).closest('article'),
    ).toHaveClass('is-locked');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    train();
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
  });
  it('preserva confirmações históricas e preferências sem criar novas missões', () => {
    const state = createInitialPlayerState();
    state.preferences.missionFilter = 'pending';
    state.missionEvents = [
      {
        missionId: 'workout',
        date: '2026-11-12',
        completed: true,
        source: 'user',
      },
    ];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
    const app = render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    nav('Estatísticas');
    fireEvent.click(screen.getByRole('button', { name: '30 dias' }));
    app.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const saved = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
    expect(saved.missionEvents).toEqual(state.missionEvents);
    expect(saved.preferences.missionFilter).toBe('pending');
    nav('Início');
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    expect(
      screen.queryByRole('checkbox', { name: /Concluir missão/ }),
    ).not.toBeInTheDocument();
  });
  it.each(['{', JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: {} })])(
    'protege o conteúdo inválido: sessão possível, nada é gravado por cima (%s)',
    (raw) => {
      localStorage.setItem(PLAYER_STORAGE_KEY, raw);
      render(<App />);
      expect(
        screen.getByRole('heading', { name: 'Registros salvos protegidos' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/formato inválido/)).toBeInTheDocument();
      expect(xp()).toHaveAttribute('aria-valuenow', '0');
      train();
      expect(xp()).toHaveAttribute('aria-valuenow', '150');
      // C-01: a ação vale na sessão, mas o conteúdo original continua intacto.
      expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
      expect(
        screen.getByText(/Registros salvos protegidos · nada é gravado/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Registros salvos neste navegador/),
      ).not.toBeInTheDocument();
    },
  );
  it('preserva uma versão desconhecida e funciona sem sobrescrevê-la', () => {
    const raw = JSON.stringify({
      version: 999,
      data: createInitialPlayerState(),
    });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    render(<App />);
    expect(
      screen.getByText(/versão diferente do Life RPG/),
    ).toBeInTheDocument();
    train();
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByText(/Registros salvos protegidos · nada é gravado/),
    ).toBeInTheDocument();
  });
  it('falha de escrita não impede evolução na sessão e mantém o arquivo anterior', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    train();
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
    train(false);
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
  });
  it('acesso ao armazenamento bloqueado não impede ações reais', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
    train();
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
  });
});
