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
import { App } from '../../../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../../../app/playerState';
import type { SaveOutcome } from '../../../records/types';
import { testDate as today, testSession, testState } from '../testFixtures';
import type { AdvancedWorkoutState } from '../types';
import { importReceipt, type ImportReceipt } from './receipt';
import { prepareWorkoutImport } from './sessionIntegration';
import { TextWorkoutImport } from './TextWorkoutImport';
import type { ImportExercise } from './types';

afterEach(cleanup);
const button = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
function interpret(text: string) {
  fireEvent.change(screen.getByLabelText('Texto do treino', { exact: true }), {
    target: { value: text },
  });
  button('Interpretar treino');
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const row = (
  exerciseId: string,
  sets: [number, number][],
  conflict: ImportExercise['conflict'] = '',
): ImportExercise => ({
  id: `row-${exerciseId}`,
  sourceName: exerciseId,
  exerciseId,
  alternatives: [],
  conflict,
  sets: sets.map(([weight, reps], i) => ({
    id: `${exerciseId}-${i}`,
    kind: 'working',
    weight,
    reps,
    rir: null,
    completed: true,
  })),
});
function stateWithPlan(): AdvancedWorkoutState {
  return {
    ...testState(),
    plans: [
      {
        id: 'a',
        name: 'Treino A',
        description: '',
        notes: '',
        exercises: [
          { id: 'pe', exerciseId: 'bench', sets: 3, reps: 10, notes: '' },
          { id: 'ro', exerciseId: 'curl', sets: 2, reps: 12, notes: '' },
        ],
      },
    ],
  };
}

describe('recibo da importação: reflete exatamente o comando', () => {
  it('nova sessão de ficha: exercícios, séries e séries planejadas pendentes', () => {
    const state = stateWithPlan();
    const rows = [
      row('bench', [
        [60, 10],
        [65, 8],
      ]),
    ];
    const command = prepareWorkoutImport(
      state,
      { planId: 'a', date: today },
      rows,
    );
    expect(importReceipt(command, rows)).toEqual({
      sessionId: command.value.id,
      name: 'Treino A',
      date: today,
      status: 'in_progress',
      exercises: 1,
      sets: 2,
      pendingSets: 2,
    });
  });

  it('manter não conta; acrescentar conta só as novas; substituir conta as resultantes', () => {
    const state = testState();
    state.sessions = [
      {
        ...testSession('one'),
        exercises: [
          ...testSession('one').exercises,
          {
            ...testSession('two', today, undefined, 'curl').exercises[0]!,
            id: 'one:curl',
          },
          {
            ...testSession('three', today, undefined, 'row').exercises[0]!,
            id: 'one:row',
          },
        ],
      },
    ];
    // Cada exercício existente tem uma série 20×10 concluída.
    const rows = [
      row(
        'bench',
        [
          [20, 10],
          [25, 8],
        ],
        'append',
      ),
      row('curl', [[12, 12]], 'keep'),
      row(
        'row',
        [
          [50, 10],
          [55, 8],
          [60, 6],
        ],
        'replace',
      ),
    ];
    const command = prepareWorkoutImport(state, { sessionId: 'one' }, rows);
    const receipt = importReceipt(command, rows);
    expect(receipt).toMatchObject({
      name: 'Treino A',
      status: 'completed',
      exercises: 2,
      sets: 4,
      pendingSets: 0,
    });
  });

  it('acrescentar somente séries já registradas resulta em zero séries', () => {
    const state = testState();
    const rows = [row('bench', [[20, 10]], 'append')];
    const command = prepareWorkoutImport(state, { sessionId: 'one' }, rows);
    expect(importReceipt(command, rows)).toMatchObject({
      exercises: 0,
      sets: 0,
    });
  });
});

describe('importação: sucesso só depois da gravação', () => {
  function renderImport(
    overrides: {
      onCommand?: () => string | null;
      whenSaved?: () => Promise<SaveOutcome>;
      onSaved?: (receipt: ImportReceipt) => void;
    } = {},
  ) {
    const onCommand = vi.fn(overrides.onCommand ?? (() => null));
    const onSaved = vi.fn(overrides.onSaved ?? (() => {}));
    render(
      <TextWorkoutImport
        state={testState()}
        today={today}
        selectedId={null}
        onCommand={onCommand}
        {...(overrides.whenSaved ? { whenSaved: overrides.whenSaved } : {})}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );
    return { onCommand, onSaved };
  }

  it('mostra carregamento, bloqueia cliques e só confirma após persistir', async () => {
    const save = deferred<SaveOutcome>();
    const { onCommand, onSaved } = renderImport({
      whenSaved: () => save.promise,
    });
    interpret('Supino reto:60x10,65x8');
    button('Confirmar importação');
    const busy = screen.getByRole('button', { name: 'Importando…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Importando e gravando o treino…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(
      screen.getByRole('button', { name: 'Cancelar importação' }),
    ).toBeDisabled();
    fireEvent.click(busy);
    fireEvent.click(busy);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => {
      save.resolve('saved');
      await save.promise;
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0]![0]).toMatchObject({
      name: 'Treino livre',
      exercises: 1,
      sets: 2,
    });
    // Botão restaurado, mas a mesma importação não é repetida.
    button('Confirmar importação');
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('erro de persistência: explica, não confirma e restaura o botão', async () => {
    for (const [outcome, text] of [
      ['failed', /Não foi possível confirmar a gravação/],
      ['conflict', /alterados em outra aba/],
    ] as const) {
      const { onSaved } = renderImport({
        whenSaved: () => Promise.resolve(outcome),
      });
      interpret('Supino reto:60x10');
      await act(async () => {
        button('Confirmar importação');
      });
      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(onSaved).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Confirmar importação' }),
      ).toBeEnabled();
      cleanup();
    }
  });

  it('erro de validação do comando não chama a gravação nem confirma', () => {
    const whenSaved = vi.fn(() => Promise.resolve<SaveOutcome>('saved'));
    const { onSaved } = renderImport({
      onCommand: () => 'A sessão mudou desde a prévia.',
      whenSaved,
    });
    interpret('Supino reto:60x10');
    button('Confirmar importação');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A sessão mudou desde a prévia.',
    );
    expect(whenSaved).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('exercício não reconhecido exige escolha antes de importar', () => {
    const { onCommand } = renderImport();
    interpret('Supino reto:60x10\nExercício inventado:10x10');
    expect(
      screen.getByRole('button', { name: 'Confirmar importação' }),
    ).toBeDisabled();
    expect(onCommand).not.toHaveBeenCalled();
  });
});

describe('diálogo “Treino importado!” no aplicativo', () => {
  function open() {
    const player: PlayerState = createInitialPlayerState();
    player.records.advancedWorkouts = testState();
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: player }),
    );
    window.history.replaceState(null, '', '/treinos');
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
  const stored = (): PlayerState =>
    JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;

  it('aparece uma única vez após gravar, com dados reais, e OK fecha', async () => {
    open();
    button('Importar treino');
    interpret('Supino reto:60x10,65x8\nRosca direta:20x12');
    button('Confirmar importação');
    const dialog = await screen.findByRole('dialog', {
      name: 'Treino importado!',
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // Já gravado quando a confirmação aparece.
    expect(stored().records.advancedWorkouts!.sessions).toHaveLength(2);
    expect(dialog).toHaveAccessibleDescription(
      'O treino foi adicionado com sucesso à sua biblioteca.',
    );
    const values = Object.fromEntries(
      [...dialog.querySelectorAll('dt')].map((dt) => [
        dt.textContent,
        dt.nextElementSibling!.textContent,
      ]),
    );
    expect(values).toMatchObject({
      Treino: 'Treino livre',
      'Exercícios importados': '2 exercícios',
      'Séries importadas': '3 séries',
    });
    expect(values['Séries planejadas pendentes']).toBeUndefined();
    expect(dialog).toHaveTextContent(
      'A sessão está em andamento: confira e conclua em Registrar treino.',
    );
    const ok = within(dialog).getByRole('button', { name: 'OK' });
    expect(ok).toHaveFocus();
    fireEvent.click(ok);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Importar treino' }),
      ).toHaveFocus(),
    );
  });

  it('cancelar não mostra confirmação nem altera registros', () => {
    open();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    button('Importar treino');
    interpret('Supino reto:60x10');
    button('Cancelar importação');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });
});
