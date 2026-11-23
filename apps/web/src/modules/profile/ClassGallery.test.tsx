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
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { shiftDate } from '../records/dates';
import { ClassGallery } from './ClassGallery';
import { visualClasses } from './classCards';
import { CLASS_RULES, type ClassId } from './classes';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

const slugs = [
  'aventureiro',
  'guerreiro',
  'estrategista',
  'guardiao',
  'sabio',
  'mestre',
] as const;
const pillars = {
  aventureiro: 'Sem classe definida',
  guerreiro: 'Treinos',
  estrategista: 'Finanças',
  guardiao: 'Descanso',
  sabio: 'Conhecimento',
  mestre: 'Equilíbrio entre os quatro pilares',
};
function gallery(
  props: Partial<Parameters<typeof ClassGallery>[0]> = {},
): Parameters<typeof ClassGallery>[0] {
  return {
    classId: null,
    level: 1,
    selected: null,
    onOpen: vi.fn(),
    onShowAll: vi.fn(),
    onBack: vi.fn(),
    ...props,
  };
}
const tiles = () =>
  within(
    screen.getByRole('list', { name: 'Classes do Life RPG' }),
  ).getAllByRole('listitem');
const evolutions = () =>
  within(screen.getByRole('region', { name: /^Evoluções de / })).getAllByRole(
    'button',
  );

describe('Galeria das seis classes', () => {
  it('exibe as seis classes com carta, nome, pilar e acesso aos detalhes', () => {
    const props = gallery({ level: 12 });
    render(<ClassGallery {...props} />);
    expect(tiles()).toHaveLength(6);
    tiles().forEach((tile, index) => {
      const slug = slugs[index]!;
      const entry = visualClasses[index]!;
      expect(within(tile).getByRole('heading', { level: 3 })).toHaveTextContent(
        entry.name,
      );
      expect(tile).toHaveTextContent(pillars[slug]);
      // Carta completa (não o retrato) do estágio do nível atual: 12 → III.
      expect(within(tile).getByRole('img')).toHaveAttribute(
        'src',
        expect.stringContaining(`cards/${slug}/${slug}-nivel-3.webp`),
      );
      fireEvent.click(
        within(tile).getByRole('button', {
          name: `Ver detalhes de ${entry.name}`,
        }),
      );
      expect(props.onOpen).toHaveBeenLastCalledWith(slug);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Perfil' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('usa Aventureiro como alternativa visual sem classe e não oferece escolha manual', () => {
    render(<ClassGallery {...gallery()} />);
    const current = tiles().filter((tile) => tile.dataset.current);
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Aventureiro');
    expect(current[0]).toHaveTextContent('Atual · sem classe definida');
    expect(
      screen.queryByRole('button', { name: /selecionar|escolher|definir/i }),
    ).toBeNull();
    // Apenas “Voltar” e os seis “Ver detalhes”.
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('acompanha a mudança automática da classe atual recebida por props', () => {
    const props = gallery({ classId: 'warrior', level: 5 });
    const view = render(<ClassGallery {...props} />);
    const currentName = () =>
      tiles()
        .filter((tile) => tile.dataset.current)
        .map((tile) => within(tile).getByRole('heading').textContent);
    expect(currentName()).toEqual(['Guerreiro']);
    expect(screen.getByText('Classe atual')).toBeInTheDocument();
    view.rerender(<ClassGallery {...props} classId="sage" />);
    expect(currentName()).toEqual(['Sábio']);
    view.rerender(<ClassGallery {...props} classId="master" />);
    expect(currentName()).toEqual(['Mestre']);
  });
});

describe('Detalhes e evoluções de cada classe', () => {
  it.each(visualClasses.map((entry) => [entry.character, entry] as const))(
    'mostra descrição, pilar, regras e as quatro cartas de %s',
    (slug, entry) => {
      render(<ClassGallery {...gallery({ selected: slug, level: 1 })} />);
      expect(
        screen.getByRole('heading', { level: 2, name: entry.name }),
      ).toBeInTheDocument();
      expect(screen.getByText(entry.description)).toBeInTheDocument();
      expect(screen.getByText(pillars[slug])).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: 'Como o sistema determina esta classe',
        }),
      ).toBeInTheDocument();
      entry.rules.forEach((rule) =>
        expect(screen.getByText(rule)).toBeInTheDocument(),
      );
      const cards = evolutions();
      expect(cards).toHaveLength(4);
      cards.forEach((card, index) =>
        expect(card.querySelector('img')).toHaveAttribute(
          'src',
          expect.stringContaining(
            `cards/${slug}/${slug}-nivel-${index + 1}.webp`,
          ),
        ),
      );
    },
  );

  it('explica as regras reais do código, com os limites de CLASS_RULES', () => {
    render(<ClassGallery {...gallery({ selected: 'mestre' })} />);
    const rules = document.querySelector('.class-rules')?.textContent ?? '';
    expect(rules).toContain(`${CLASS_RULES.masterScore}/100 em cada pilar`);
    expect(rules).toContain(`${CLASS_RULES.masterSpread} pontos`);
    expect(rules).toContain(`${CLASS_RULES.masterDays} dias com atividade`);
    expect(rules).toContain(`${CLASS_RULES.masterSpan} dias ou mais`);
    expect(rules).toContain(`${CLASS_RULES.masterPillarDays} dias`);
    expect(rules).toContain(`${CLASS_RULES.masterPillarWeeks} blocos semanais`);
    cleanup();
    render(<ClassGallery {...gallery({ selected: 'guerreiro' })} />);
    expect(
      screen.getByText(
        `Treinos precisa ter a maior pontuação do Radar nos últimos ${CLASS_RULES.period} dias (hoje e os ${CLASS_RULES.period - 1} anteriores).`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /vale a ordem Guerreiro, Sábio, Estrategista, Guardião\./,
      ),
    ).toBeInTheDocument();
  });

  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [9, 2],
    [10, 3],
    [19, 3],
    [20, 4],
    [37, 4],
  ])(
    'no nível %i destaca o estágio %i, mantém os anteriores e bloqueia os futuros',
    (level, stage) => {
      render(<ClassGallery {...gallery({ selected: 'guerreiro', level })} />);
      evolutions().forEach((card, index) => {
        const cardStage = index + 1;
        const expected =
          cardStage === stage
            ? ['current', 'Estágio atual']
            : cardStage < stage
              ? ['reached', 'Alcançado']
              : ['locked', 'Bloqueado'];
        expect(card).toHaveAttribute('data-status', expected[0]);
        expect(card).toHaveTextContent(expected[1]!);
        // A arte de todos os estágios permanece visível.
        expect(card.querySelector('img')).toBeVisible();
      });
      expect(
        evolutions().find((card) => card.dataset.status === 'current'),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByText(`Nível ${level} · estágio`, { exact: false }),
      ).toBeInTheDocument();
    },
  );

  it('selecionar uma carta futura só mostra nome, estágio e requisito', () => {
    const props = gallery({ selected: 'estrategista', level: 6 });
    render(<ClassGallery {...props} />);
    const elite = evolutions()[3]!;
    expect(elite).toHaveAccessibleName(
      'Estrategista, estágio IV · Elite, Nível 20 ou superior, Bloqueado',
    );
    fireEvent.click(elite);
    expect(elite).toHaveAttribute('aria-pressed', 'true');
    expect(elite).toHaveAttribute('data-status', 'locked');
    const info = document.getElementById(elite.getAttribute('aria-controls')!)!;
    expect(info).toHaveTextContent('Estrategista · Elite');
    expect(info).toHaveTextContent('IV · Elite');
    expect(info).toHaveTextContent('Nível 20 ou superior');
    expect(info).toHaveTextContent('Bloqueado');
    fireEvent.click(evolutions()[0]!);
    expect(info).toHaveTextContent('Nível 1 a 4');
    expect(info).toHaveTextContent('Alcançado');
    expect(props.onOpen).not.toHaveBeenCalled();
    expect(props.onShowAll).not.toHaveBeenCalled();
  });

  it('navega entre classes pela lista de outras classes e volta à galeria', () => {
    const props = gallery({ selected: 'guerreiro' });
    render(<ClassGallery {...props} />);
    const others = within(
      screen.getByRole('navigation', { name: 'Outras classes' }),
    );
    expect(others.getAllByRole('button')).toHaveLength(6);
    expect(others.getByRole('button', { name: 'Guerreiro' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.click(others.getByRole('button', { name: 'Mestre' }));
    expect(props.onOpen).toHaveBeenCalledWith('mestre');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar às classes' }));
    expect(props.onShowAll).toHaveBeenCalledTimes(1);
  });

  it('classe desconhecida na URL mostra a galeria', () => {
    render(<ClassGallery {...gallery({ selected: 'necromante' })} />);
    expect(tiles()).toHaveLength(6);
  });
});

function store(state: PlayerState) {
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
}
const nav = () =>
  within(screen.getByRole('navigation', { name: 'Navegação principal' }));

describe('Integração com o Perfil e a URL', () => {
  it('abre pelo Perfil, navega no histórico e não altera dados nem a classe', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 12));
    const state = createInitialPlayerState();
    state.character.avatar = 'knight';
    state.records.workouts = [{ date: '2026-11-13', trained: true }];
    store(state);
    window.history.replaceState(null, '', '/perfil');
    render(<App />);
    const sheet = screen.getByRole('region', { name: 'Resumo do jogador' });
    expect(
      within(sheet).getByRole('img', { name: /^Avatar de / }),
    ).toHaveAttribute(
      'src',
      expect.stringContaining('portraits/guerreiro/guerreiro-nivel-1'),
    );
    expect(sheet.querySelector('[data-avatar]')).toBeNull();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);

    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Explorar classes' }),
    );
    expect(window.location.pathname).toBe('/perfil/classes');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Classes do Life RPG' }),
    ).toBeInTheDocument();
    expect(nav().getByRole('button', { name: 'Perfil' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const current = tiles().filter((tile) => tile.dataset.current);
    expect(current.map((tile) => tile.dataset.class)).toEqual(['guerreiro']);

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalhes de Estrategista' }),
    );
    expect(window.location.pathname).toBe('/perfil/classes/estrategista');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Estrategista' }),
    ).toBeInTheDocument();
    // Visualizar cartas não troca a classe nem grava nada.
    evolutions().forEach((card) => fireEvent.click(card));

    act(() => window.history.back());
    await waitFor(() =>
      expect(window.location.pathname).toBe('/perfil/classes'),
    );
    expect(tiles()).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Perfil' }));
    expect(window.location.pathname).toBe('/perfil');
    expect(screen.getByLabelText('Classe automática')).toHaveTextContent(
      'Guerreiro',
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    const saved = JSON.parse(before!).data as PlayerState;
    expect(saved.character.avatar).toBe('knight');
    expect(
      saved.character.classification.current satisfies ClassId | null,
    ).toBe('warrior');
  });

  it('abre diretamente o detalhe de uma classe e mantém a rota ao recarregar', () => {
    window.history.replaceState(null, '', '/perfil/classes/mestre');
    const app = render(<App />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Mestre' }),
    ).toBeInTheDocument();
    app.unmount();
    render(<App />);
    expect(window.location.pathname).toBe('/perfil/classes/mestre');
    expect(evolutions()).toHaveLength(4);
  });

  it('o estágio exibido acompanha o nível real do jogador', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 12));
    const state = createInitialPlayerState();
    for (let i = 0; i < 29; i++)
      state.records.workouts.push({
        date: shiftDate('2026-11-13', -i),
        trained: true,
      });
    store(state);
    window.history.replaceState(null, '', '/perfil/classes/guerreiro');
    render(<App />);
    const level = Number(
      /Nível (\d+)/.exec(
        screen.getByText(/Nível \d+ · estágio/).textContent ?? '',
      )![1],
    );
    expect(level).toBeGreaterThan(1);
    const stage = level >= 20 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1;
    expect(evolutions().find((card) => card.dataset.status === 'current')).toBe(
      evolutions()[stage - 1],
    );
  });
});
