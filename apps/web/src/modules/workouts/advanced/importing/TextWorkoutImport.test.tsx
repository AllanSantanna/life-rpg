import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { App } from '../../../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../../../app/playerState';
import { selectOption } from '../../../../test/selectOption';
import { projectCharacter } from '../../../profile/character';
import { testDate as today, testSession, testState } from '../testFixtures';
import type { AdvancedCommandHandler } from '../types';
import { TextWorkoutImport } from './TextWorkoutImport';

afterEach(cleanup);
const button = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value },
  });
}
function choose(label: string, option: string) {
  selectOption(screen.getByRole('combobox', { name: label }), option);
}
function saved(): PlayerState {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
const advanced = () => saved().records.advancedWorkouts!;
function seeded() {
  const player = createInitialPlayerState();
  player.records.advancedWorkouts = {
    ...testState(),
    plans: [
      {
        id: 'a',
        name: 'Treino A',
        description: '',
        notes: '',
        exercises: [
          { id: 'pe', exerciseId: 'bench', sets: 3, reps: 10, notes: '' },
        ],
      },
    ],
  };
  return player;
}
function open(player?: PlayerState) {
  if (player)
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: player }),
    );
  window.history.replaceState(null, '', '/treinos');
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
function interpret(text: string) {
  change('Texto do treino', text);
  button('Interpretar Treino');
}

describe('importação de treinos na interface real', () => {
  it('só grava após confirmação e permite cancelar sem modificar qualquer registro', () => {
    open(seeded());
    const before = saved();
    button('Importar Treino');
    interpret('Supno reto:60x10,65x8');
    expect(
      screen.getByRole('heading', { name: 'Prévia do treino' }),
    ).toBeInTheDocument();
    expect(saved()).toEqual(before);
    button('Cancelar importação');
    expect(saved()).toEqual(before);
    expect(
      screen.getByRole('button', { name: 'Importar Treino' }),
    ).toBeInTheDocument();
  });
  it('edita exercícios, carga, repetições, RIR e tipo na prévia, salva a ficha escolhida e recarrega', () => {
    const player = seeded();
    const beforeFacts = projectCharacter(player, today);
    const app = open(player);
    button('Importar Treino');
    choose('Destino da importação', 'Nova sessão · Treino A');
    interpret('Supno reto:60x10 rir2\nElevação lateral:12,5kg x12');
    change('Carga (kg) · prévia, exercício 1, série 1', '62.5');
    change('Repetições · prévia, exercício 1, série 1', '9');
    change('RIR · prévia, exercício 1, série 1', '0');
    choose('Tipo · prévia, exercício 1, série 1', 'Aquecimento');
    choose('Exercício 2', 'Rosca direta');
    button('Adicionar série ao exercício 2');
    change('Carga (kg) · prévia, exercício 2, série 2', '15');
    change('Repetições · prévia, exercício 2, série 2', '10');
    button('Confirmar Importação');
    const session = advanced().sessions[1]!;
    expect(session.planId).toBe('a');
    expect(session.exercises.map((e) => e.exercise.id)).toEqual([
      'bench',
      'curl',
    ]);
    expect(session.exercises[0]!.sets[0]).toMatchObject({
      weight: 62.5,
      reps: 9,
      rir: 0,
      kind: 'warmup',
      completed: true,
    });
    expect(session.exercises[1]!.sets.map((s) => s.weight)).toEqual([12.5, 15]);
    expect(advanced().plans).toEqual(player.records.advancedWorkouts!.plans);
    expect(advanced().sessions[0]).toEqual(
      player.records.advancedWorkouts!.sessions[0],
    );
    expect(saved().records.workouts).toEqual([]);
    expect(projectCharacter(saved(), today)).toEqual(beforeFacts);
    const persisted = advanced();
    app.unmount();
    open();
    expect(advanced()).toEqual(persisted);
    expect(
      screen.getByRole('heading', { name: 'Registrar Treino' }),
    ).toBeInTheDocument();
  });
  it('exige escolha manual para um nome ambíguo e bloqueia valores ausentes/fora dos limites', () => {
    open(seeded());
    button('Importar Treino');
    interpret('Supino:60x10\nRosca direta:x12');
    expect(screen.getByText(/Nome ambíguo/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirmar Importação' }),
    ).toBeDisabled();
    choose('Exercício 1', 'Supino reto');
    change('Carga (kg) · prévia, exercício 2, série 1', '20');
    change('RIR · prévia, exercício 2, série 1', '11');
    expect(
      screen.getByRole('button', { name: 'Confirmar Importação' }),
    ).toBeDisabled();
    change('RIR · prévia, exercício 2, série 1', '');
    button('Confirmar Importação');
    expect(advanced().sessions[1]!.exercises[1]!.sets[0]!.rir).toBeNull();
  });
  it.each([
    ['Manter os dados existentes', [20]],
    ['Substituir as séries deste exercício', [20, 30]],
    ['Acrescentar apenas as novas séries', [20, 30]],
  ] as const)('resolve conflitos explicitamente: %s', (choice, weights) => {
    open(seeded());
    button('Importar Treino');
    choose('Destino da importação', `Treino A · 13/11/2026 · concluída`);
    interpret('Supino reto:20x10,30x8');
    expect(
      screen.getByRole('button', { name: 'Confirmar Importação' }),
    ).toBeDisabled();
    choose('Conflito · exercício 1', choice);
    button('Confirmar Importação');
    expect(advanced().sessions).toHaveLength(1);
    expect(
      advanced().sessions[0]!.exercises[0]!.sets.map((s) => s.weight),
    ).toEqual(weights);
    expect(saved().records.workouts).toEqual([]);
  });
  it('reiniciar a importação para a mesma sessão encontra duplicatas e acrescenta zero séries', () => {
    const player = seeded();
    player.records.advancedWorkouts!.sessions[0]!.status = 'in_progress';
    open(player);
    button('Importar Treino');
    interpret('Supino reto:20x10');
    choose('Conflito · exercício 1', 'Acrescentar apenas as novas séries');
    expect(screen.getByText(/0 série\(s\) nova/)).toBeInTheDocument();
    button('Confirmar Importação');
    button('Importar Treino');
    interpret('Supino reto:20x10');
    choose('Conflito · exercício 1', 'Acrescentar apenas as novas séries');
    button('Confirmar Importação');
    expect(advanced().sessions).toHaveLength(1);
    expect(advanced().sessions[0]!.exercises[0]!.sets).toHaveLength(1);
  });
  it('remove linhas inválidas e séries, mantendo a ordem do restante', () => {
    open(seeded());
    button('Importar Treino');
    interpret('Supino reto:60x10,65x8\nNome desconhecido\nRosca direta:20x12');
    button('Remover exercício 2');
    button('Remover série 1 do exercício 1');
    button('Confirmar Importação');
    expect(advanced().sessions[1]!.exercises.map((e) => e.exercise.id)).toEqual(
      ['bench', 'curl'],
    );
    expect(
      advanced().sessions[1]!.exercises[0]!.sets.map((s) => s.weight),
    ).toEqual([65]);
  });
  it('reinterpreta ao alterar texto/destino e não grava a prévia anterior', () => {
    open(seeded());
    button('Importar Treino');
    interpret('Supino reto:60x10');
    choose('Destino da importação', 'Nova sessão · Treino A');
    expect(
      screen.queryByRole('button', { name: 'Confirmar Importação' }),
    ).not.toBeInTheDocument();
    button('Interpretar Treino');
    change('Texto do treino', 'Rosca direta:20x10');
    expect(
      screen.queryByRole('button', { name: 'Confirmar Importação' }),
    ).not.toBeInTheDocument();
    button('Interpretar Treino');
    button('Confirmar Importação');
    expect(advanced().sessions[1]!.exercises[0]!.exercise.id).toBe('curl');
  });
  it('protege contra dois cliques e exibe erros do comando sem perder a prévia', () => {
    const onCommand = vi.fn(() => null);
    const onSaved = vi.fn();
    const view = render(
      <TextWorkoutImport
        state={testState()}
        today={today}
        selectedId={null}
        onCommand={onCommand}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );
    interpret('Supino reto:60x10');
    button('Confirmar Importação');
    button('Confirmar Importação');
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    view.unmount();
    render(
      <TextWorkoutImport
        state={testState()}
        today={today}
        selectedId={null}
        onCommand={() => 'Falha na sessão'}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );
    interpret('Supino reto:60x10');
    button('Confirmar Importação');
    expect(screen.getByRole('alert')).toHaveTextContent('Falha na sessão');
    expect(
      screen.getByLabelText('Carga (kg) · prévia, exercício 1, série 1'),
    ).toHaveValue(60);
  });
  it('não sobrescreve uma sessão que mudou enquanto o usuário revisava', () => {
    const state = testState();
    const onCommand = vi.fn<AdvancedCommandHandler>(
      () =>
        'A sessão mudou desde a prévia. Confira o destino e interprete novamente.',
    );
    const view = render(
      <TextWorkoutImport
        state={state}
        today={today}
        selectedId="one"
        onCommand={onCommand}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
    interpret('Supino reto:60x10');
    choose('Conflito · exercício 1', 'Substituir as séries deste exercício');
    const changed = { ...state, sessions: [testSession('one', today, [])] };
    view.rerender(
      <TextWorkoutImport
        state={changed}
        today={today}
        selectedId="one"
        onCommand={onCommand}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
    button('Confirmar Importação');
    expect(onCommand.mock.calls[0]![0]).toMatchObject({
      expected: state.sessions[0],
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/mudou/);
  });
  it('resolve exercícios personalizados existentes sem modificar seu cadastro', () => {
    const player = seeded();
    player.records.advancedWorkouts!.exercises.push({
      id: 'custom',
      name: 'Puxada pessoal',
      primary: 'back',
      secondary: [],
      equipment: 'Polia',
    });
    open(player);
    button('Importar Treino');
    interpret('Puxda pessoal:30x10');
    const preview = screen.getByRole('region', {
      name: 'Prévia do exercício 1',
    });
    expect(
      within(preview).getByRole('heading', { name: 'Puxada pessoal' }),
    ).toBeInTheDocument();
    button('Confirmar Importação');
    expect(advanced().sessions[1]!.exercises[0]!.exercise.id).toBe('custom');
    expect(advanced().exercises).toEqual(
      player.records.advancedWorkouts!.exercises,
    );
  });
});
