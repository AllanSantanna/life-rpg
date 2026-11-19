import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { projectCharacter } from '../profile/character';
import { projectEffortActivities } from '../records/progression';
import { emptyRecords } from '../records/types';
import { StatisticsPage } from './StatisticsPage';
import {
  defaultStatisticsView,
  isStatisticsView,
  STATISTICS_VIEW_KEY,
  STATISTICS_VIEW_VERSION,
  type StatisticsView,
} from './viewPreferences';

// Registra quando o renderer WebGL é realmente solicitado pelo React.lazy.
const sceneLoads = vi.hoisted(() => ({ count: 0 }));
vi.mock('./LandscapeScene', () => {
  sceneLoads.count += 1;
  return { LandscapeScene: () => <div data-testid="webgl-scene" /> };
});

afterEach(cleanup);
const today = '2026-11-13';
function records() {
  const value = emptyRecords();
  value.workouts = [{ date: today, trained: true }];
  value.sleep = [{ date: today, hours: 7.5 }];
  return value;
}
function renderPage() {
  const data = records();
  return render(
    <StatisticsPage
      records={data}
      activities={projectEffortActivities([], [], data, today)}
      today={today}
      radar={<section aria-label="Radar de Evolução">Radar original</section>}
      achievements={<section aria-label="Conquistas">Conquistas</section>}
      onNavigate={() => undefined}
    />,
  );
}
function store(view: StatisticsView) {
  localStorage.setItem(
    STATISTICS_VIEW_KEY,
    JSON.stringify({ version: STATISTICS_VIEW_VERSION, data: view }),
  );
}
function saved() {
  return JSON.parse(localStorage.getItem(STATISTICS_VIEW_KEY)!) as {
    version: number;
    data: StatisticsView;
  };
}
function openPanel() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Personalizar visualização' }),
  );
  return screen.getByRole('region', { name: 'Personalizar visualização' });
}
function toggle(name: string) {
  fireEvent.click(screen.getByRole('switch', { name }));
}
const region = (name: string) => screen.queryByRole('region', { name });

describe('Personalização das Estatísticas', () => {
  it('mostra todas as seções por padrão sem gravar nada ao abrir', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    renderPage();
    expect(region('Radar de Evolução')).toBeInTheDocument();
    expect(region('Paisagem da Evolução 3D')).toBeInTheDocument();
    expect(region('Calendário de Atividades')).toBeInTheDocument();
    expect(region('Estatísticas individuais')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Seus quatro pilares' }),
    ).toBeInTheDocument();
    const panel = openPanel();
    const switches = within(panel).getAllByRole('switch');
    expect(switches).toHaveLength(7);
    for (const item of switches) expect(item).toBeChecked();
    expect(
      within(panel).getByRole('button', { name: 'Mostrar todas as seções' }),
    ).toBeDisabled();
    expect(writes).not.toHaveBeenCalled();
  });

  it('oculta e reativa cada seção individualmente', () => {
    renderPage();
    openPanel();
    for (const [name, label] of [
      ['Radar de Evolução', 'Radar de Evolução'],
      ['Paisagem da Evolução 3D', 'Paisagem da Evolução 3D'],
      ['Calendário de Atividades', 'Calendário de Atividades'],
    ] as const) {
      toggle(label);
      expect(screen.getByRole('switch', { name: label })).not.toBeChecked();
      expect(region(name)).not.toBeInTheDocument();
      toggle(label);
      expect(region(name)).toBeInTheDocument();
    }
    for (const area of ['Finanças', 'Treinos', 'Descanso', 'Conhecimento']) {
      const cards = () =>
        within(region('Estatísticas individuais')!).getAllByRole('article');
      toggle(`Cartão de ${area}`);
      expect(cards()).toHaveLength(3);
      expect(
        within(region('Estatísticas individuais')!).queryByText(area, {
          selector: 'h3, h2, strong, span',
        }),
      ).toBeNull();
      toggle(`Cartão de ${area}`);
      expect(cards()).toHaveLength(4);
    }
  });

  it('reorganiza o layout, oculta filtros sem uso e indica quando nada está visível', () => {
    const { container } = renderPage();
    openPanel();
    toggle('Radar de Evolução');
    const overview = container.querySelector('.statistics-overview')!;
    expect(overview.children).toHaveLength(1);
    toggle('Paisagem da Evolução 3D');
    expect(container.querySelector('.statistics-overview')).toBeNull();
    toggle('Cartão de Finanças');
    toggle('Cartão de Treinos');
    const grid = container.querySelector('.statistics-pillar-grid')!;
    expect(grid).toHaveAttribute('data-count', '2');
    expect(
      screen.getByRole('heading', { name: 'Seus pilares' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Período dos novos gráficos' }),
    ).toBeInTheDocument();
    toggle('Cartão de Descanso');
    toggle('Cartão de Conhecimento');
    expect(region('Estatísticas individuais')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Período dos novos gráficos' }),
    ).toBeNull();
    toggle('Calendário de Atividades');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Todas as seções estão ocultas',
    );
    expect(region('Conquistas')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar todas as seções' }),
    );
    expect(saved().data).toEqual(defaultStatisticsView());
    expect(region('Radar de Evolução')).toBeInTheDocument();
    expect(container.querySelector('.statistics-pillar-grid')).toHaveAttribute(
      'data-count',
      '4',
    );
  });

  it('salva automaticamente e restaura as preferências após recarregar', () => {
    const first = renderPage();
    openPanel();
    toggle('Calendário de Atividades');
    toggle('Cartão de Descanso');
    expect(saved()).toEqual({
      version: STATISTICS_VIEW_VERSION,
      data: {
        ...defaultStatisticsView(),
        calendar: false,
        cards: { ...defaultStatisticsView().cards, Descanso: false },
      },
    });
    first.unmount();
    renderPage();
    expect(region('Calendário de Atividades')).not.toBeInTheDocument();
    expect(
      within(region('Estatísticas individuais')!).getAllByRole('article'),
    ).toHaveLength(3);
    openPanel();
    expect(
      screen.getByRole('switch', { name: 'Calendário de Atividades' }),
    ).not.toBeChecked();
  });

  it('usa o padrão quando a preferência salva é inválida, sem sobrescrevê-la ao abrir', () => {
    const raw = JSON.stringify({ version: 1, data: { radar: 'não' } });
    localStorage.setItem(STATISTICS_VIEW_KEY, raw);
    renderPage();
    expect(region('Radar de Evolução')).toBeInTheDocument();
    expect(localStorage.getItem(STATISTICS_VIEW_KEY)).toBe(raw);
    expect(isStatisticsView({ ...defaultStatisticsView(), extra: 1 })).toBe(
      false,
    );
    expect(
      isStatisticsView({
        ...defaultStatisticsView(),
        cards: { Finanças: true },
      }),
    ).toBe(false);
  });

  it('tem interruptores acessíveis, fecha com Escape e devolve o foco', () => {
    renderPage();
    const trigger = screen.getByRole('button', {
      name: 'Personalizar visualização',
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const panel = openPanel();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
    expect(within(panel).getByRole('group', { name: 'Seções' })).toBeVisible();
    expect(
      within(panel).getByRole('group', { name: 'Cartões dos pilares' }),
    ).toBeVisible();
    const radar = within(panel).getByRole('switch', {
      name: 'Radar de Evolução',
    });
    radar.focus();
    fireEvent.keyDown(radar, { key: 'Escape' });
    expect(
      screen.queryByRole('region', { name: 'Personalizar visualização' }),
    ).toBeNull();
    expect(trigger).toHaveFocus();
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(trigger).toHaveFocus();
  });

  it('não solicita o renderer WebGL enquanto a paisagem estiver oculta', async () => {
    const original = window.WebGL2RenderingContext;
    window.WebGL2RenderingContext = class {} as typeof WebGL2RenderingContext;
    try {
      store({ ...defaultStatisticsView(), landscape: false });
      sceneLoads.count = 0;
      renderPage();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(sceneLoads.count).toBe(0);
      expect(screen.queryByTestId('webgl-scene')).toBeNull();
      openPanel();
      toggle('Paisagem da Evolução 3D');
      expect(await screen.findByTestId('webgl-scene')).toBeInTheDocument();
      expect(sceneLoads.count).toBe(1);
    } finally {
      window.WebGL2RenderingContext = original;
    }
  });
});

describe('Preferências visuais e dados do jogador', () => {
  it('não altera registros, XP nem o Radar ao ocultar e reativar seções', () => {
    const state = createInitialPlayerState();
    state.records = records();
    state.character.classification = projectCharacter(
      state,
      today,
    ).classification.state;
    const raw = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    window.history.replaceState(null, '', '/estatisticas');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const app = render(<App />);
    // Ao remontar, somente os ids gerados por useId mudam.
    const markup = () =>
      screen
        .getByRole('region', { name: 'Radar de Evolução' })
        .innerHTML.replace(/_r_\w+_/g, 'id');
    const before = markup();
    const level = document.body.textContent?.match(/Nível \d+/)?.[0];
    openPanel();
    toggle('Radar de Evolução');
    expect(region('Radar de Evolução')).not.toBeInTheDocument();
    toggle('Radar de Evolução');
    toggle('Cartão de Treinos');
    expect(markup()).toBe(before);
    expect(document.body.textContent?.match(/Nível \d+/)?.[0]).toBe(level);
    // Somente a chave visual foi gravada; registros e XP permanecem idênticos.
    expect(
      writes.mock.calls.every(([key]) => key === STATISTICS_VIEW_KEY),
    ).toBe(true);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    app.unmount();
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByRole('region', { name: 'Radar de Evolução' }),
    ).toHaveTextContent('25/100');
  });
});
