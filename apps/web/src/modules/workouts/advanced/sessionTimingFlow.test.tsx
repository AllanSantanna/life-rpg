import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../../app/playerState';
import { testSession, testSet, testState } from './testFixtures';
import { selectDate, selectTime } from '../../../test/selectOption';
import {
  createSessionStart,
  localWorkoutTime,
  sessionTime,
} from './sessionTiming';
import { projectMuscles } from './muscle-map/model';
afterEach(cleanup);
beforeEach(() => vi.setSystemTime(new Date('2026-11-20T12:00:00')));
const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function open(sessions = testState().sessions) {
  const player = createInitialPlayerState();
  player.records.advancedWorkouts = { ...testState(), sessions };
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: player }),
  );
  window.history.replaceState(null, '', '/treinos');
  return render(<App />);
}
const tab = (name: string) =>
  fireEvent.click(screen.getByRole('tab', { name }));
const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
const timeControl = () =>
  screen.getByRole('combobox', { name: 'Horário do treino' });
const changeTime = (value: string) => selectTime(timeControl(), value);
const shownTime = () =>
  within(timeControl()).getByText(/^(\d{2}:\d{2}|Não informado)$/).textContent;
function correction() {
  tab('Histórico');
  click('Corrigir sessão');
  fireEvent.click(
    screen.getByText('Data, horário, observações e opções da sessão'),
  );
}
describe('horário na criação e correção real de sessões', () => {
  it('preenche o início local somente na nova sessão e retoma sem duplicar ou trocar o horário', () => {
    open([]);
    tab('Registrar treino');
    expect(shownTime()).toBe(localWorkoutTime());
    click('Iniciar sessão');
    const first = stored().records.advancedWorkouts!.sessions[0]!;
    expect(first.startedAt).toBe(
      createSessionStart('2026-11-20', localWorkoutTime()),
    );
    click('Nova sessão');
    changeTime('09:30');
    click('Iniciar sessão');
    const sessions = stored().records.advancedWorkouts!.sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.startedAt).toBe(first.startedAt);
  });
  it('permite escolher um horário manual no início', () => {
    open([]);
    tab('Registrar treino');
    changeTime('09:45');
    click('Iniciar sessão');
    expect(sessionTime(stored().records.advancedWorkouts!.sessions[0]!)).toBe(
      '09:45',
    );
  });
  it('corrige data e horário de sessão antiga, preserva séries/dados e atualiza o mapa sem recarga', () => {
    const legacy = testSession(
      'legacy',
      '2026-10-01',
      [testSet('a', 40, 10, 'working', 0), testSet('b', 45, 8, 'working', 2)],
      'legpress',
    );
    const { unmount } = open([legacy]);
    const before = stored();
    correction();
    expect(shownTime()).toBe('Não informado');
    selectDate(
      screen.getByRole('combobox', { name: 'Data da sessão' }),
      '2026-11-19',
    );
    changeTime('15:30');
    expect(stored().records.advancedWorkouts!.sessions[0]!.date).toBe(
      '2026-10-01',
    );
    click('Salvar data/hora');
    const sessions = stored().records.advancedWorkouts!.sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(legacy.id);
    expect(sessions[0]!.date).toBe('2026-11-19');
    expect(sessionTime(sessions[0]!)).toBe('15:30');
    expect(sessions[0]!.exercises).toEqual(legacy.exercises);
    expect(stored().records.workouts).toEqual(before.records.workouts);
    expect(stored().records.finance).toEqual(before.records.finance);
    tab('Histórico');
    expect(screen.getByText(/19\/11\/2026 às 15:30/)).toBeInTheDocument();
    tab('Mapa muscular');
    click('Quadríceps 2');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    const expected = projectMuscles(sessions, Date.now(), 'month').summaries
      .quadriceps.recovery;
    expect(
      screen.getByRole('img', { name: `Índice estimado: ${expected}%` }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByLabelText('Detalhes do músculo selecionado'),
      ).getByText('19/11/2026 às 15:30'),
    ).toBeInTheDocument();
    unmount();
    render(<App />);
    expect(stored().records.advancedWorkouts!.sessions).toEqual(sessions);
  });
  it('rejeita horário futuro na correção sem alterar o registro salvo', () => {
    const original = {
      ...testSession('recent', '2026-11-20'),
      startedAt: createSessionStart('2026-11-20', '08:00'),
    };
    open([original]);
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    correction();
    changeTime('18:00');
    click('Salvar data/hora');
    expect(screen.getByRole('alert')).toHaveTextContent(/futuro/);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });
  it('edita apenas o horário de sessão conhecida mantendo a data e o snapshot completo', () => {
    const original = {
      ...testSession('recent', '2026-11-19'),
      startedAt: createSessionStart('2026-11-19', '08:00'),
    };
    open([original]);
    correction();
    expect(shownTime()).toBe('08:00');
    changeTime('15:30');
    click('Salvar data/hora');
    const result = stored().records.advancedWorkouts!.sessions;
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ...original,
      startedAt: createSessionStart('2026-11-19', '15:30'),
    });
  });
});
