import { projectCharacter } from '../profile/character';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { applyGoalCommand } from './commands';
import { blankGoal } from './templates';
import { dashboardGoals } from './dashboardGoals';
import type { GoalDefinition } from './types';
import { achievementState, openProfile } from '../../test/achievements';
const today = '2026-11-13';
afterEach(cleanup);
function add(
  state: PlayerState,
  id: string,
  definition: Partial<GoalDefinition> = {},
) {
  state.goals = applyGoalCommand(
    state.goals,
    {
      type: 'save',
      id,
      definition: {
        ...blankGoal(today),
        title: `Objetivo ${id}`,
        ...definition,
      },
    },
    today,
  );
}
function store(state: PlayerState, version = PLAYER_STORAGE_VERSION) {
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version, data: state }),
  );
}
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
const summary = () => screen.getByRole('region', { name: 'Minhas Quests' });
const xp = () =>
  screen.getByRole('progressbar', { name: 'Experiência do jogador' });
function recordWorkout(trained: boolean) {
  nav('Pilares');
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Quatro pilares' }),
    ).getByRole('button', { name: /Treinos/ }),
  );
  fireEvent.click(
    within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
      'button',
      { name: trained ? 'Sim' : 'Não' },
    ),
  );
  nav('Início');
}
describe('Quests do usuário no dashboard', () => {
  it('mantém links antigos e dados cadastrados ao trocar o nome para Quests', () => {
    const state = createInitialPlayerState();
    add(state, 'projeto / pessoal', {
      title: 'Minha meta original',
      kind: 'completion',
      target: 1000,
    });
    store(state);
    const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
    window.history.replaceState(
      null,
      '',
      '/metas?meta=projeto%20%2F%20pessoal#main',
    );
    render(<App />);
    expect(window.location.pathname).toBe('/quests');
    expect(new URLSearchParams(window.location.search).get('quest')).toBe(
      'projeto / pessoal',
    );
    expect(window.location.hash).toBe('#main');
    expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Quest Minha meta original' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
  });
  it('prioriza prazos e ciclos e exibe até cinco quests, sem pausadas, concluídas, excluídas ou futuras', () => {
    const state = createInitialPlayerState();
    for (const [id, deadline] of [
      ['sem-prazo', null],
      ['distante', '2026-12-30'],
      ['amanha', '2026-11-14'],
      ['hoje', today],
      ['depois', '2026-11-16'],
      ['proxima', '2026-11-15'],
    ] as const)
      add(state, id, { deadline });
    add(state, 'concluida', { kind: 'completion', target: 1000 });
    state.goals = applyGoalCommand(
      state.goals,
      {
        type: 'update',
        value: {
          id: 'conclusao',
          goalId: 'concluida',
          date: today,
          value: 1000,
        },
      },
      today,
    );
    add(state, 'pausada', { deadline: today });
    state.goals = applyGoalCommand(
      state.goals,
      { type: 'pause', id: 'pausada' },
      today,
    );
    add(state, 'excluida');
    state.goals = applyGoalCommand(
      state.goals,
      { type: 'delete', id: 'excluida', confirmed: true },
      today,
    );
    add(state, 'futura', { startDate: '2027-01-01' });
    store(state);
    render(<App />);
    const links = within(summary()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      ['hoje', 'amanha', 'proxima', 'depois', 'distante'].map(
        (id) => `/quests?quest=${id}`,
      ),
    );
    expect(within(summary()).getAllByRole('progressbar')).toHaveLength(5);
    expect(summary()).toHaveTextContent('Geral');
    expect(summary()).toHaveTextContent('13/11/2026');
    expect(summary()).toHaveTextContent('Mais 1 quest');
    expect(summary().parentElement).toHaveClass(
      'dashboard-secondary--with-goals',
    );
    fireEvent.click(
      within(summary()).getByRole('button', { name: 'Ver todas' }),
    );
    expect(window.location.pathname).toBe('/quests');
    expect(window.location.search).toBe('');
    expect(
      screen.getByRole('button', { name: 'Criar minha quest' }),
    ).toBeInTheDocument();
  });
  it.each(['completed', 'paused', 'empty'] as const)(
    'oculta todo o painel em %s e libera espaço às conquistas',
    (kind) => {
      const state = createInitialPlayerState();
      if (kind !== 'empty') {
        add(state, 'unica', { kind: 'completion', target: 1000 });
        state.goals = applyGoalCommand(
          state.goals,
          kind === 'paused'
            ? { type: 'pause', id: 'unica' }
            : {
                type: 'update',
                value: {
                  id: 'done',
                  goalId: 'unica',
                  date: today,
                  value: 1000,
                },
              },
          today,
        );
      }
      store(state);
      render(<App />);
      expect(
        screen.queryByRole('region', { name: 'Minhas Quests' }),
      ).not.toBeInTheDocument();
      const container = screen.getByRole('region', {
        name: 'Conquistas',
      }).parentElement;
      expect(container?.children).toHaveLength(1);
      expect(container).not.toHaveClass('dashboard-secondary--with-goals');
      expect(
        screen.getByRole('region', { name: 'Pilares da jornada' }),
      ).toBeInTheDocument();
      expect(xp()).toBeInTheDocument();
    },
  );
  it('abre detalhes da quest selecionada, conclui manualmente, persiste e permite desfazer sem duplicar XP', () => {
    const state = createInitialPlayerState();
    add(state, 'projeto / pessoal', {
      kind: 'completion',
      target: 1000,
      title: 'Meu projeto',
    });
    add(state, 'outra');
    store(state);
    let app = render(<App />);
    fireEvent.click(
      within(summary()).getByRole('link', {
        name: 'Abrir detalhes da quest Meu projeto',
      }),
    );
    expect(new URLSearchParams(window.location.search).get('quest')).toBe(
      'projeto / pessoal',
    );
    expect(screen.getAllByRole('article', { name: /^Quest / })).toHaveLength(1);
    let card = screen.getByRole('article', { name: 'Quest Meu projeto' });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Concluir quest' }),
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Salvar progresso' }),
    );
    const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(screen.getByText('Detalhes da quest')).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
    nav('Início');
    expect(summary()).not.toHaveTextContent('Meu projeto');
    expect(xp()).toHaveAttribute('aria-valuenow', '25');
    nav('Quests');
    card = screen.getByRole('article', { name: 'Quest Meu projeto' });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Desfazer conclusão' }),
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Salvar progresso' }),
    );
    nav('Início');
    expect(summary()).toHaveTextContent('Meu projeto');
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
  });
  it('atualiza quests automáticas ao registrar e corrigir atividades, sem um segundo prêmio por quest', () => {
    const state = createInitialPlayerState();
    add(state, 'treino', {
      pillar: 'Treinos',
      tracking: 'automatic',
      metric: 'workouts',
      unit: 'dias',
      target: 4000,
    });
    add(state, 'treino-unico', {
      pillar: 'Treinos',
      tracking: 'automatic',
      metric: 'workouts',
      unit: 'dias',
      target: 1000,
    });
    store(state);
    render(<App />);
    expect(
      within(summary()).getByRole('progressbar', {
        name: 'Resumo da quest Objetivo treino',
      }),
    ).toHaveAttribute('aria-valuenow', '0');
    recordWorkout(true);
    expect(
      within(summary()).getByRole('progressbar', {
        name: 'Resumo da quest Objetivo treino',
      }),
    ).toHaveAttribute('aria-valuenow', '25');
    expect(summary()).not.toHaveTextContent('Objetivo treino-unico');
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    recordWorkout(true);
    expect(xp()).toHaveAttribute('aria-valuenow', '150');
    recordWorkout(false);
    expect(
      within(summary()).getByRole('progressbar', {
        name: 'Resumo da quest Objetivo treino',
      }),
    ).toHaveAttribute('aria-valuenow', '0');
    expect(summary()).toHaveTextContent('Objetivo treino-unico');
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
  });
  it('preserva XP, conquistas e dados existentes sem regravar ou conceder recompensas por navegar', () => {
    const state = createInitialPlayerState();
    state.profile.name = 'Lia';
    state.records.workouts = [{ date: today, trained: true }];
    state.missionEvents = [
      { missionId: 'workout', date: today, completed: true, source: 'user' },
      { missionId: 'water', date: today, completed: true, source: 'user' },
    ];
    add(state, 'legitima');
    state.character.classification = projectCharacter(
      state,
      today,
    ).classification.state;
    store(state);
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(xp()).toHaveAttribute('aria-valuenow', '270');
    expect(
      screen.getByRole('img', { name: 'Avatar de Lia' }),
    ).toBeInTheDocument();
    openProfile();
    expect(achievementState('Primeiro passo')).toBe('unlocked');
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Início' }),
    );
    fireEvent.click(within(summary()).getByRole('link'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver todas as quests' }),
    );
    nav('Início');
    expect(xp()).toHaveAttribute('aria-valuenow', '270');
    app.unmount();
    render(<App />);
    expect(xp()).toHaveAttribute('aria-valuenow', '270');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });
  it('mantém quests vencidas acionáveis e prioriza o fim dos ciclos recorrentes', () => {
    const state = createInitialPlayerState();
    add(state, 'vencida', { startDate: '2026-11-01', deadline: '2026-11-12' });
    add(state, 'semanal', { cadence: 'weekly', target: 10000 });
    expect(
      dashboardGoals(state.goals, state.records, today).map(({ goal, due }) => [
        goal.id,
        due,
      ]),
    ).toEqual([
      ['vencida', '2026-11-12'],
      ['semanal', '2026-11-15'],
    ]);
    store(state);
    render(<App />);
    expect(summary()).toHaveTextContent('Prazo vencido: 12/11/2026');
    expect(summary()).toHaveTextContent('Ciclo até: 15/11/2026');
  });
  it('um link de quest desconhecida mantém o acesso à página sem inventar dados', () => {
    window.history.replaceState(null, '', '/quests?quest=inexistente');
    render(<App />);
    expect(screen.getByText('Quest não encontrada.')).toBeInTheDocument();
    expect(
      screen.queryByRole('article', { name: /^Quest / }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver todas as quests' }),
    );
    expect(window.location.search).toBe('');
    expect(
      screen.getByRole('button', { name: 'Criar minha quest' }),
    ).toBeInTheDocument();
  });
});
