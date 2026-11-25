import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../../app/playerState';
import type { SaveOutcome } from '../../records/types';
import { SessionPanel } from './SessionPanel';
import {
  testDate as today,
  testSession,
  testSet,
  testState,
} from './testFixtures';
import type {
  AdvancedCommandHandler,
  AdvancedWorkoutState,
  WorkoutSession,
} from './types';

afterEach(cleanup);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
/** Sessão em andamento: supino com 1 válida concluída, 1 aquecimento e 1 pendente; rosca sem séries concluídas. */
function inProgress(): WorkoutSession {
  const session = testSession('live', today, [
    testSet('w', 20, 10, 'warmup'),
    testSet('v', 60, 10),
    { ...testSet('p', 60, 8), completed: false },
  ]);
  session.status = 'in_progress';
  session.exercises.push({
    ...testSession(
      'x',
      today,
      [{ ...testSet('c', 15, 12), completed: false }],
      'curl',
    ).exercises[0]!,
    id: 'live:curl',
  });
  return session;
}
function stateWith(session: WorkoutSession): AdvancedWorkoutState {
  return { ...testState(), sessions: [session] };
}
function renderPanel(
  options: {
    session?: WorkoutSession;
    onCommand?: AdvancedCommandHandler;
    whenSaved?: () => Promise<SaveOutcome>;
  } = {},
) {
  const session = options.session ?? inProgress();
  const onCommand = vi.fn<AdvancedCommandHandler>(
    options.onCommand ?? (() => null),
  );
  render(
    <SessionPanel
      state={stateWith(session)}
      today={today}
      selectedId={session.id}
      onSelect={() => {}}
      onCommand={onCommand}
      {...(options.whenSaved ? { whenSaved: options.whenSaved } : {})}
    />,
  );
  return { onCommand, session };
}
const trigger = () => screen.getByRole('button', { name: /Concluir sessão/ });
const review = () => screen.getByRole('dialog', { name: 'Finalizar treino?' });
function summary(dialog: HTMLElement) {
  return Object.fromEntries(
    [...dialog.querySelectorAll('dt')].map((dt) => [
      dt.textContent,
      dt.nextElementSibling!.textContent,
    ]),
  );
}

describe('revisão antes de finalizar', () => {
  it('abre a revisão com os dados reais, sem executar o comando', () => {
    const { onCommand } = renderPanel();
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(trigger());
    const dialog = review();
    expect(dialog).toHaveAccessibleDescription(
      'Confira os dados registrados antes de concluir.',
    );
    expect(summary(dialog)).toEqual({
      Treino: 'Treino A',
      Data: expect.stringContaining('13/11/2026'),
      'Exercícios realizados': '1 de 2',
      // Aquecimento e séries pendentes não são válidas concluídas.
      'Séries válidas concluídas': '1 série',
      'Volume das séries válidas': '600 kg·rep',
      'Séries não concluídas': '2 séries',
      'Marcar o dia como treinado': 'Sim',
    });
    // Sem horário de término registrado: nenhuma duração é inventada.
    expect(dialog).not.toHaveTextContent(/Duração/);
    expect(dialog).toHaveTextContent(
      'Existem séries que ainda não foram concluídas. Confira antes de finalizar.',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Revisar' }),
    ).toHaveFocus();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('Revisar e Escape fecham sem modificar a sessão e devolvem o foco', () => {
    const { onCommand } = renderPanel();
    trigger().focus();
    fireEvent.click(trigger());
    fireEvent.click(within(review()).getByRole('button', { name: 'Revisar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
    fireEvent.click(trigger());
    fireEvent(review(), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('sem pendências não mostra aviso; a opção de marcar o dia é refletida', () => {
    const session = testSession('done', today, [testSet('a', 50, 10)]);
    session.status = 'in_progress';
    renderPanel({ session });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Marcar o dia como treinado ao concluir',
      }),
    );
    fireEvent.click(trigger());
    expect(review()).not.toHaveTextContent(/ainda não foram concluídas/);
    expect(summary(review())).toMatchObject({
      'Exercícios realizados': '1 de 1',
      'Marcar o dia como treinado': 'Não',
    });
    expect(summary(review())['Séries não concluídas']).toBeUndefined();
  });
});

describe('finalização e confirmação de sucesso', () => {
  it('executa uma vez, mostra andamento e só confirma após gravar', async () => {
    const save = deferred<SaveOutcome>();
    const { onCommand, session } = renderPanel({
      whenSaved: () => save.promise,
    });
    fireEvent.click(trigger());
    const confirm = within(review()).getByRole('button', {
      name: 'Finalizar treino',
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({
      type: 'finishSession',
      id: session.id,
      markDay: true,
    });
    const busy = within(review()).getByRole('button', { name: 'Finalizando…' });
    expect(busy).toBeDisabled();
    expect(
      within(review()).getByRole('button', { name: 'Revisar' }),
    ).toBeDisabled();
    // Escape não interrompe a operação em andamento.
    fireEvent(review(), new Event('cancel', { cancelable: true }));
    expect(review()).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Treino finalizado!' }),
    ).toBeNull();
    await act(async () => {
      save.resolve('saved');
      await save.promise;
    });
    expect(
      screen.queryByRole('dialog', { name: 'Finalizar treino?' }),
    ).toBeNull();
    const done = screen.getByRole('dialog', { name: 'Treino finalizado!' });
    expect(done).toHaveAccessibleDescription(
      'Seu treino foi registrado com sucesso no histórico.',
    );
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const ok = within(done).getByRole('button', { name: 'Entendi' });
    expect(ok).toHaveFocus();
    fireEvent.click(ok);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('erro de gravação é informado no diálogo e permite tentar novamente', async () => {
    for (const [outcome, text] of [
      ['failed', /Não foi possível confirmar a gravação/],
      ['conflict', /alterados em outra aba/],
    ] as const) {
      const { onCommand } = renderPanel({
        whenSaved: () => Promise.resolve(outcome),
      });
      fireEvent.click(trigger());
      await act(async () => {
        fireEvent.click(
          within(review()).getByRole('button', { name: 'Finalizar treino' }),
        );
      });
      expect(within(review()).getByRole('alert')).toHaveTextContent(text);
      expect(
        screen.queryByRole('dialog', { name: 'Treino finalizado!' }),
      ).toBeNull();
      const retry = within(review()).getByRole('button', {
        name: 'Finalizar treino',
      });
      expect(retry).toBeEnabled();
      // O foco permanece no diálogo (navegadores o devolvem ao botão principal).
      expect(review()).toContainElement(document.activeElement as HTMLElement);
      expect(onCommand).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('mantém a validação existente: sem série concluída não finaliza', async () => {
    const whenSaved = vi.fn(() => Promise.resolve<SaveOutcome>('saved'));
    renderPanel({
      onCommand: () => 'Conclua ao menos uma série antes de encerrar a sessão.',
      whenSaved,
    });
    fireEvent.click(trigger());
    await act(async () => {
      fireEvent.click(
        within(review()).getByRole('button', { name: 'Finalizar treino' }),
      );
    });
    expect(within(review()).getByRole('alert')).toHaveTextContent(
      'Conclua ao menos uma série antes de encerrar a sessão.',
    );
    expect(whenSaved).not.toHaveBeenCalled();
  });
});

describe('finalização no aplicativo', () => {
  function open(player: PlayerState) {
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

  it('persiste antes da confirmação, preserva séries pendentes e aparece no histórico', async () => {
    const player = createInitialPlayerState();
    player.records.advancedWorkouts = stateWith(inProgress());
    open(player);
    const before = stored().records.advancedWorkouts!.sessions[0]!;
    fireEvent.click(trigger());
    fireEvent.click(
      within(review()).getByRole('button', { name: 'Finalizar treino' }),
    );
    const done = await screen.findByRole('dialog', {
      name: 'Treino finalizado!',
    });
    // Já gravado quando a confirmação aparece; nenhuma série foi alterada.
    const after = stored().records.advancedWorkouts!.sessions[0]!;
    expect(after.status).toBe('completed');
    expect(after.exercises).toEqual(before.exercises);
    expect(stored().records.workouts).toEqual([{ date: today, trained: true }]);
    fireEvent.click(within(done).getByRole('button', { name: 'Entendi' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('Treino A');
  });
});
