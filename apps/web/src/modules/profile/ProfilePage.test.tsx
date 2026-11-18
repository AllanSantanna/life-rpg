import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
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
import { usePlayerState } from '../../app/usePlayerState';
import { shiftDate } from '../records/dates';
import { applyRecordCommand } from '../records/commands';
import type { RecordCommand } from '../records/types';
import { projectCharacter } from './character';

const today = '2026-11-13';
afterEach(cleanup);
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
function saved(): PlayerState {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
function store(state: PlayerState) {
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
}
function train() {
  fireEvent.click(screen.getByRole('button', { name: 'Registrar Treinos' }));
  fireEvent.click(
    within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
      'button',
      { name: 'Sim' },
    ),
  );
}
const currentClass = () => screen.getByLabelText('Classe automática');
const xp = () =>
  screen.getByRole('progressbar', { name: 'Experiência do jogador' });

describe('perfil simples integrado', () => {
  it('associa o erro de nome ao campo e preserva os dados ao rejeitar a edição', () => {
    store(createInitialPlayerState());
    render(<App />);
    nav('Perfil');
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    const input = screen.getByRole('textbox', { name: 'Nome do jogador' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use um nome entre 1 e 40 caracteres.',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Use um nome entre 1 e 40 caracteres.',
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    fireEvent.change(input, { target: { value: 'Lia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(saved().profile.name).toBe('Lia');
  });
  it('mostra Mestre no Perfil e dashboard com dedicação real nos quatro pilares', () => {
    const state = createInitialPlayerState();
    state.records.books = [{ id: 'b', title: 'Livro', totalPages: 1000 }];
    for (let i = 0; i < 30; i++) {
      const date = shiftDate(today, -i);
      state.records.workouts.push({ date, trained: true });
      state.records.sleep.push({ date, hours: 8 });
      state.records.readings.push({ id: `r${i}`, bookId: 'b', date, pages: 1 });
      state.records.movements.push({
        id: `m${i}`,
        date,
        kind: 'income',
        amountCents: 100,
        category: 'Outros',
        description: 'Registro',
      });
    }
    const progress = projectCharacter(state, today).progress;
    store(state);
    render(<App />);
    expect(currentClass()).toHaveTextContent('Mestre');
    expect(xp()).toHaveAttribute('aria-valuenow', String(progress.xp));
    nav('Perfil');
    expect(currentClass()).toHaveTextContent('Mestre');
    expect(screen.getByText(`Nível ${progress.level}`)).toBeInTheDocument();
    expect(saved().records).toEqual(state.records);
  });
  it('edita o nome e mantém avatar, classe, XP e dashboard sincronizados após recarregar', () => {
    const state = createInitialPlayerState();
    state.character.avatar = 'mage';
    store(state);
    const app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    nav('Perfil');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do jogador' }), {
      target: { value: '  Lia da Lua  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nome salvo');
    expect(
      screen.getByRole('img', { name: 'Avatar de Lia da Lua' }),
    ).toHaveAttribute('data-avatar', 'mage');
    expect(saved().profile.name).toBe('Lia da Lua');
    expect(currentClass()).toHaveTextContent('Sem classe definida');
    expect(xp()).toHaveAttribute('aria-valuenow', '0');
    nav('Início');
    expect(currentClass()).toHaveTextContent('Sem classe definida');
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    render(<App />);
    expect(
      screen.getByRole('img', { name: 'Avatar de Lia da Lua' }),
    ).toHaveAttribute('data-avatar', 'mage');
    nav('Perfil');
    expect(
      screen.getByRole('textbox', { name: 'Nome do jogador' }),
    ).toHaveValue('Lia da Lua');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });

  it('mostra apenas identidade, classe, nível, XP e Radar, com conquistas preservadas em Estatísticas', () => {
    render(<App />);
    nav('Perfil');
    expect(currentClass()).toHaveTextContent('Sem classe definida');
    expect(screen.getByText('Nível 1')).toBeInTheDocument();
    expect(
      screen.getByText('Classe automática · últimos 30 dias'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('figure', { name: 'Radar de Evolução · 7 dias' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Personalização|Moldura|Título:|Coleção|Histórico de evolução|XP acumulado|XP recente|Desbloqueado|Como as classes/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Avatar|Fundo|Moldura|Título/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /Classe/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver Radar de Evolução em Estatísticas',
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'Sua evolução' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Primeiro passo' }),
    ).toBeInTheDocument();
  });

  it('a classe usa sempre 30 dias, independentemente do filtro do Radar, e persiste sem duplicar XP', () => {
    const state = createInitialPlayerState();
    state.records.workouts = Array.from({ length: 12 }, (_, i) => ({
      date: shiftDate(today, -8 - i),
      trained: true,
    }));
    state.preferences.radarPeriod = 7;
    store(state);
    const app = render(<App />);
    expect(currentClass()).toHaveTextContent('Guerreiro');
    const progress = xp().getAttribute('aria-valuenow');
    const classification = saved().character.classification;
    nav('Estatísticas');
    const radar = within(
      screen.getByRole('region', { name: 'Radar de Evolução' }),
    );
    for (const days of [90, 30, 7]) {
      fireEvent.click(radar.getByRole('button', { name: `${days} dias` }));
      expect(saved().character.classification).toEqual(classification);
    }
    nav('Perfil');
    expect(currentClass()).toHaveTextContent('Guerreiro');
    expect(xp()).toHaveAttribute('aria-valuenow', progress);
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    render(<App />);
    expect(currentClass()).toHaveTextContent('Guerreiro');
    expect(xp()).toHaveAttribute('aria-valuenow', progress);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    expect(saved().records).toEqual(state.records);
  });

  it('classifica ao registrar treino, mantém sincronização e estabilidade após editar e excluir', () => {
    const state = createInitialPlayerState();
    state.records.workouts = [2, 4, 6, 8, 10].map((days) => ({
      date: shiftDate(today, -days),
      trained: true,
    }));
    store(state);
    const app = render(<App />);
    expect(currentClass()).toHaveTextContent('Guerreiro');
    train();
    nav('Perfil');
    expect(currentClass()).toHaveTextContent('Guerreiro');
    nav('Início');
    expect(currentClass()).toHaveTextContent('Guerreiro');
    expect(xp()).toHaveAttribute('aria-valuenow', '900');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Treinos' }));
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
        'button',
        { name: 'Não' },
      ),
    );
    expect(saved().character.classification.pending).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover registro do dia' }),
    );
    expect(saved().records.workouts).toEqual(state.records.workouts);
    nav('Perfil');
    expect(currentClass()).toHaveTextContent('Guerreiro');
    expect(xp()).toHaveAttribute('aria-valuenow', '750');
    app.unmount();
    render(<App />);
    expect(currentClass()).toHaveTextContent('Guerreiro');
    expect(xp()).toHaveAttribute('aria-valuenow', '750');
  });

  it('reavalia a classe ao expirar um registro na virada do dia e preserva os dados', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 40));
    const state = createInitialPlayerState();
    state.records.workouts = [{ date: shiftDate(today, -29), trained: true }];
    state.records.sleep = [{ date: today, hours: 8 }];
    store(state);
    render(<App />);
    expect(currentClass()).toHaveTextContent('Guerreiro');
    const progress = xp().getAttribute('aria-valuenow');
    vi.setSystemTime(new Date(2026, 10, 14, 0, 0, 40));
    fireEvent(document, new Event('visibilitychange'));
    expect(currentClass()).toHaveTextContent('Guardião');
    expect(xp()).toHaveAttribute('aria-valuenow', progress);
    expect(saved().records).toEqual(state.records);
    expect(saved().goals).toEqual(state.goals);
    nav('Perfil');
    expect(currentClass()).toHaveTextContent('Guardião');
  });

  it('migra cosméticos de v5 em StrictMode uma única vez e mantém o avatar atual', () => {
    const state = createInitialPlayerState();
    state.character.avatar = 'ranger';
    state.records.workouts = Array.from({ length: 30 }, (_, i) => ({
      date: shiftDate(today, -i),
      trained: true,
    }));
    const progress = projectCharacter(state, today).progress;
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({
        version: 5,
        data: {
          ...state,
          character: {
            ...state.character,
            frame: 'gold',
            background: 'sanctuary',
            title: 'veteran',
            unlocked: [],
            events: [],
          },
        },
      }),
    );
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const app = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(writes).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('img', { name: 'Avatar de Jogador' }),
    ).toHaveAttribute('data-avatar', 'ranger');
    expect(screen.getByText(`Nível ${progress.level}`)).toBeInTheDocument();
    expect(xp()).toHaveAttribute('aria-valuenow', String(progress.xp));
    expect(saved().records).toEqual(state.records);
    expect(Object.keys(saved().character).sort()).toEqual([
      'avatar',
      'classification',
    ]);
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it('falha ao salvar a migração preserva o original e a edição do nome funciona na sessão', () => {
    const state = createInitialPlayerState();
    const raw = JSON.stringify({
      version: 5,
      data: { ...state, character: { ...state.character, frame: 'gold' } },
    });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    nav('Perfil');
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do jogador' }), {
      target: { value: 'Lia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    expect(
      screen.getByRole('img', { name: 'Avatar de Lia' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
});

const scenarios = [
  { area: 'Treinos', className: 'warrior', count: 1 },
  { area: 'Finanças', className: 'strategist', count: 1 },
  { area: 'Descanso', className: 'guardian', count: 1 },
  { area: 'Conhecimento', className: 'sage', count: 1 },
] as const;
function commands(
  area: (typeof scenarios)[number]['area'],
  index: number,
): { save: RecordCommand; edit: RecordCommand; remove: RecordCommand } {
  const date = shiftDate(today, -index * 2);
  const older = shiftDate(today, -40);
  switch (area) {
    case 'Treinos':
      return {
        save: { type: 'saveWorkout', value: { date, trained: true } },
        edit: { type: 'saveWorkout', value: { date, trained: false } },
        remove: { type: 'deleteWorkout', date },
      };
    case 'Descanso':
      return {
        save: { type: 'saveSleep', value: { date, hours: 8 } },
        edit: { type: 'saveSleep', value: { date, hours: 0 } },
        remove: { type: 'deleteSleep', date },
      };
    case 'Finanças': {
      const value = {
        id: `m${index}`,
        date,
        amountCents: 100,
        kind: 'income' as const,
        category: 'Outros',
        description: 'Registro',
      };
      return {
        save: { type: 'saveMovement', value },
        edit: { type: 'saveMovement', value: { ...value, date: older } },
        remove: { type: 'deleteMovement', id: value.id },
      };
    }
    case 'Conhecimento': {
      const value = { id: `r${index}`, bookId: 'b', date, pages: 1 };
      return {
        save: { type: 'saveReading', value },
        edit: { type: 'saveReading', value: { ...value, date: older } },
        remove: { type: 'deleteReading', id: value.id },
      };
    }
  }
}

describe('atualização automática dos quatro pilares no estado persistido', () => {
  it.each(scenarios)(
    '$area recalcula ao criar, editar, excluir e recarregar',
    ({ area, className, count }) => {
      const state = createInitialPlayerState();
      state.records.books = [{ id: 'b', title: 'Livro', totalPages: 1000 }];
      for (let i = 0; i < count - 1; i++)
        state.records = applyRecordCommand(
          state.records,
          commands(area, i).save,
          today,
        );
      store(state);
      const { result, unmount } = renderHook(() => usePlayerState(today));
      expect(result.current.state.character.classification.current).toBeNull();
      function run(command: RecordCommand) {
        act(() =>
          result.current.setState((previous) => ({
            ...previous,
            records: applyRecordCommand(previous.records, command, today),
          })),
        );
      }
      const command = commands(area, count - 1);
      run(command.save);
      expect(result.current.state.character.classification.current).toBe(
        className,
      );
      expect(saved().character.classification.current).toBe(className);
      const score = result.current.facts.classification.scores[area];
      run(command.edit);
      expect(result.current.facts.classification.scores[area]).toBeLessThan(
        score,
      );
      expect(result.current.facts.classification.candidate).toBeNull();
      expect(result.current.state.character.classification.current).toBeNull();
      run(command.remove);
      expect(result.current.facts.classification.activeDays).toBe(count - 1);
      expect(result.current.state.records).toEqual(state.records);
      const progress = result.current.facts.progress;
      const before = localStorage.getItem(PLAYER_STORAGE_KEY);
      unmount();
      const reloaded = renderHook(() => usePlayerState(today));
      expect(
        reloaded.result.current.state.character.classification.current,
      ).toBeNull();
      expect(reloaded.result.current.facts.progress).toEqual(progress);
      expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    },
  );
});
