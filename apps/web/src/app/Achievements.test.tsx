import {
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
  type PlayerState,
} from './playerState';
import { createBackupFile } from './backupFile';
import { shiftDate } from '../modules/records/dates';
import {
  projectCharacter,
  reconcileCharacter,
} from '../modules/profile/character';
import { syntheticPlayer } from '../test/backupFixtures';
import { achievementState, openProfile } from '../test/achievements';
import { selectOption } from '../test/selectOption';
import { ACHIEVEMENT_PRESENTATION_KEY } from '../modules/gamification/achievements/presentation';

const today = '2026-11-13';
afterEach(cleanup);

function store(state: PlayerState) {
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
}
function withWorkouts(count: number) {
  const state = createInitialPlayerState();
  state.records.workouts = Array.from({ length: count }, (_, i) => ({
    date: shiftDate(today, -i),
    trained: true,
  }));
  state.character.classification = projectCharacter(
    state,
    today,
  ).classification.state;
  return state;
}
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
function train() {
  nav('Pilares');
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Quatro pilares' }),
    ).getByRole('button', { name: /Treinos/ }),
  );
  fireEvent.click(
    within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
      'button',
      { name: 'Sim' },
    ),
  );
}
const summary = () => screen.getByRole('region', { name: 'Conquistas' });
const notice = () =>
  screen.queryByRole('region', { name: 'Conquista desbloqueada' });
const gallery = () =>
  screen.getByRole('region', { name: 'Galeria de conquistas' });
const galleryCards = () => within(gallery()).queryAllByRole('article');

describe('Resumo de conquistas no Início', () => {
  it('conta vazia: totais reais, sem conquistas inventadas e sem "mais próxima"', () => {
    render(<App />);
    const region = summary();
    expect(within(region).getByText('0/42')).toBeInTheDocument();
    expect(within(region).getByText('0%')).toBeInTheDocument();
    expect(
      within(region).getByRole('progressbar', {
        name: 'Conclusão das conquistas',
      }),
    ).toHaveAttribute('aria-valuenow', '0');
    expect(
      within(region).getByText(/Nenhuma conquista ainda/),
    ).toBeInTheDocument();
    expect(within(region).queryByText('Mais próxima')).not.toBeInTheDocument();
  });

  it('mostra até três recentes, a mais próxima e o acesso ao Perfil', async () => {
    store(withWorkouts(12));
    render(<App />);
    const region = summary();
    const recent = within(region).getByRole('list', {
      name: 'Conquistas recentes',
    });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
    expect(within(region).getByText('Mais próxima')).toBeInTheDocument();
    expect(
      within(region).getAllByRole('progressbar').length,
    ).toBeGreaterThanOrEqual(2);
    // Medalhas são decorativas: o nome está no texto.
    for (const image of region.querySelectorAll('img'))
      expect(image).toHaveAttribute('alt', '');
    fireEvent.click(
      within(region).getByRole('button', { name: 'Ver conquistas' }),
    );
    expect(window.location.pathname).toBe('/perfil');
    expect(window.location.hash).toBe('#conquistas');
    expect(
      screen.getByRole('heading', { name: 'Seu personagem' }),
    ).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Conquistas' });
    expect(section).toHaveClass('is-highlighted');
    await waitFor(() => expect(section).toHaveFocus());
  });

  it('não cria rota nem item de menu novos', () => {
    render(<App />);
    const menu = screen.getByRole('navigation', {
      name: 'Navegação principal',
    });
    expect(
      within(menu).queryByRole('button', { name: /Conquistas/ }),
    ).not.toBeInTheDocument();
    window.history.replaceState(null, '', '/conquistas');
    cleanup();
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Visão geral' }),
    ).toBeInTheDocument();
  });
});

describe('Seção Conquistas no Perfil', () => {
  it('mostra totais, destaques e todas as 42 conquistas, bloqueadas inclusive', () => {
    store(withWorkouts(12));
    render(<App />);
    openProfile();
    const section = screen.getByRole('region', { name: 'Conquistas' });
    const totals = within(section).getByText('Desbloqueadas').closest('div')!;
    const unlocked = Number(within(totals).getByRole('definition').textContent);
    expect(unlocked).toBeGreaterThan(0);
    expect(
      within(section).getByRole('region', { name: 'Medalhas em destaque' }),
    ).toBeInTheDocument();
    expect(galleryCards()).toHaveLength(42);
    expect(achievementState('Corpo em movimento')).toBe('unlocked');
    expect(achievementState('Força constante')).toBe('locked');
    expect(
      within(gallery()).getByRole('progressbar', {
        name: 'Progresso de Força constante',
      }),
    ).toHaveAttribute('aria-valuenow', '12');
    expect(
      within(gallery()).getAllByText('12 de 30 dias treinados'),
    ).not.toHaveLength(0);
  });

  it('filtra por pilar, raridade e estado e limpa os filtros', () => {
    store(withWorkouts(12));
    render(<App />);
    openProfile();
    selectOption(
      within(gallery()).getByRole('combobox', { name: 'Pilar' }),
      'Treinos',
    );
    expect(galleryCards()).toHaveLength(9);
    selectOption(
      within(gallery()).getByRole('combobox', { name: 'Raridade' }),
      'Lendária',
    );
    expect(galleryCards()).toHaveLength(1);
    selectOption(
      within(gallery()).getByRole('combobox', { name: 'Estado' }),
      'Desbloqueadas',
    );
    expect(galleryCards()).toHaveLength(0);
    expect(
      within(gallery()).getByText(
        'Nenhuma conquista corresponde aos filtros escolhidos.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(gallery()).getByRole('button', { name: 'Limpar filtros' }),
    );
    expect(galleryCards()).toHaveLength(42);
    expect(
      within(gallery()).getByText('Mostrando 42 conquistas de 42'),
    ).toBeInTheDocument();
  });

  it('"Ocultar galeria" esconde conquistadas e bloqueadas, mantém os destaques e é lembrado', () => {
    store(withWorkouts(12));
    const app = render(<App />);
    openProfile();
    const toggle = within(gallery()).getByRole('switch', {
      name: 'Ocultar galeria de conquistas',
    });
    expect(toggle).not.toBeChecked();
    expect(galleryCards()).toHaveLength(42);
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(galleryCards()).toHaveLength(0);
    expect(
      within(gallery()).queryByRole('combobox', { name: 'Estado' }),
    ).not.toBeInTheDocument();
    expect(within(gallery()).getByText(/Galeria oculta/)).toBeInTheDocument();
    const featured = screen.getByRole('region', {
      name: 'Medalhas em destaque',
    });
    expect(within(featured).getAllByRole('listitem').length).toBeGreaterThan(0);
    app.unmount();
    render(<App />);
    openProfile();
    expect(
      within(gallery()).getByRole('switch', {
        name: 'Ocultar galeria de conquistas',
      }),
    ).toBeChecked();
    expect(galleryCards()).toHaveLength(0);
    fireEvent.click(
      within(gallery()).getByRole('switch', {
        name: 'Ocultar galeria de conquistas',
      }),
    );
    expect(galleryCards()).toHaveLength(42);
  });
});

describe('Notificação de desbloqueio', () => {
  it('aparece ao desbloquear por um registro, sem roubar o foco, e pode ser dispensada', () => {
    render(<App />);
    train();
    const form = screen.getByRole('form', { name: 'Treinou hoje?' });
    const active = document.activeElement;
    const region = notice()!;
    expect(region).toBeInTheDocument();
    expect(region.tagName).not.toBe('DIALOG');
    expect(document.activeElement).toBe(active);
    expect(form).toBeInTheDocument();
    expect(within(region).getByRole('status')).toHaveTextContent(
      'Conquista desbloqueada: Primeiro treino, raridade Comum.',
    );
    expect(
      within(region).getByRole('heading', { name: 'Primeiro treino' }),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole('img', { name: 'Raridade Comum' }),
    ).toBeInTheDocument();
    expect(
      within(region).getByText('Mais 1 conquista desbloqueada'),
    ).toBeInTheDocument();
    fireEvent.click(within(region).getByRole('button', { name: 'Próxima' }));
    expect(
      within(notice()!).getByRole('heading', { name: 'Primeiro passo' }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(notice()!).getByRole('button', {
        name: 'Fechar notificação de Primeiro passo',
      }),
    );
    expect(notice()).not.toBeInTheDocument();
    expect(localStorage.getItem(ACHIEVEMENT_PRESENTATION_KEY)).toContain(
      'training-first',
    );
  });

  it('Escape dispensa e "Ver no Perfil" leva à galeria', () => {
    render(<App />);
    train();
    fireEvent.keyDown(notice()!, { key: 'Escape' });
    expect(notice()).not.toBeInTheDocument();
    cleanup();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    render(<App />);
    train();
    fireEvent.click(within(notice()!).getByRole('button', { name: 'Próxima' }));
    fireEvent.click(
      within(notice()!).getByRole('button', { name: 'Ver no Perfil' }),
    );
    expect(window.location.hash).toBe('#conquistas');
    expect(notice()).not.toBeInTheDocument();
  });

  it('não reaparece ao reabrir o app nem para conquistas históricas', () => {
    store(withWorkouts(40));
    const app = render(<App />);
    expect(notice()).not.toBeInTheDocument();
    app.unmount();
    render(<App />);
    expect(notice()).not.toBeInTheDocument();
  });

  it('restaurar um backup com muitos registros não dispara notificações', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );
    render(<App />);
    openProfile();
    const raw = syntheticPlayer(4);
    const incoming = reconcileCharacter(raw, projectCharacter(raw, today));
    const text = createBackupFile(
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: incoming }),
      new Date(2026, 10, 12, 9),
    ).content;
    const backup = screen.getByRole('region', { name: 'Backup de dados' });
    fireEvent.change(
      backup.querySelector<HTMLInputElement>('input[type="file"]')!,
      {
        target: {
          files: [
            new File([text], 'backup.json', { type: 'application/json' }),
          ],
        },
      },
    );
    const preview = await screen.findByRole('group', {
      name: 'Prévia do backup',
    });
    fireEvent.click(
      within(preview).getByRole('button', { name: 'Restaurar backup' }),
    );
    expect(
      await within(
        screen.getByRole('region', { name: 'Backup de dados' }),
      ).findByRole('status'),
    ).toHaveTextContent('Backup restaurado');
    // As conquistas foram recalculadas a partir do backup, sem apresentação.
    expect(
      galleryCards().some(
        (card) => card.getAttribute('data-state') === 'unlocked',
      ),
    ).toBe(true);
    expect(notice()).not.toBeInTheDocument();
  });
});
