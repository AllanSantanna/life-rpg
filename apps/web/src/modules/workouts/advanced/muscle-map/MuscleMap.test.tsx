import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MuscleMap } from '../MuscleMap';
import { testSession, testSet } from '../testFixtures';
afterEach(cleanup);
beforeEach(() => vi.setSystemTime(new Date('2026-11-20T12:00:00')));
const today = '2026-11-20';
const sessions = [testSession('one', today, [testSet('a'), testSet('b')])];
describe('mapa anatômico integrado', () => {
  it('atualiza a recuperação pelo relógio sem gravar storage e remove o timer ao sair', () => {
    vi.useFakeTimers();
    const startedAt = '2026-11-20T11:00:00+00:00';
    const reference = Date.parse('2026-11-20T12:00:00+00:00');
    vi.setSystemTime(reference);
    const timed = [
      {
        ...testSession(
          'timed',
          today,
          Array.from({ length: 9 }, (_, i) =>
            testSet(`s${i}`, 40, 10, 'working', 0),
          ),
        ),
        startedAt,
      },
    ];
    const save = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = render(
      <MuscleMap sessions={timed} today={today} period="week" />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    const initial = screen
      .getByRole('img', { name: /^Índice estimado:/ })
      .getAttribute('aria-label');
    act(() => {
      vi.setSystemTime(reference + 8 * 3600000);
      vi.advanceTimersByTime(60000);
    });
    expect(
      screen
        .getByRole('img', { name: /^Índice estimado:/ })
        .getAttribute('aria-label'),
    ).not.toBe(initial);
    expect(save).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('seleciona regiões individuais por teclado/toque e preserva a seleção entre modos', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem');
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    const front = screen.getByRole('group', {
      name: 'Mapa muscular · visão frontal',
    });
    const right = within(front).getByRole('button', {
      name: /Peitoral · direita/,
    });
    fireEvent.keyDown(right, { key: ' ' });
    expect(right).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    expect(right).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Índice estimado')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Legenda de recuperação estimada'),
    ).toBeInTheDocument();
    const back = screen.getByRole('group', {
      name: 'Mapa muscular · visão traseira',
    });
    const lumbar = within(back).getByRole('button', {
      name: /Lombar · esquerda/,
    });
    fireEvent.click(lumbar);
    expect(lumbar).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(
        screen.getByLabelText('Detalhes do músculo selecionado'),
      ).getByText('Grupo: Lombar'),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('não apresenta recuperação total ou esforço zero quando faltam registros', () => {
    render(<MuscleMap sessions={[]} today={today} period="week" />);
    expect(
      screen.getByRole('img', { name: 'Esforço relativo: indeterminado' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Esforço' }), {
      key: 'ArrowRight',
    });
    expect(screen.getByRole('tab', { name: 'Recuperação' })).toHaveFocus();
    expect(
      screen.getByRole('img', { name: 'Índice estimado: indeterminado' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });
  it('atualiza métricas após edição, remoção e registro sem escrever storage', () => {
    const { rerender } = render(
      <MuscleMap sessions={sessions} today={today} period="week" />,
    );
    expect(
      screen.getByText('Peito: 2 séries válidas no período.'),
    ).toBeInTheDocument();
    rerender(
      <MuscleMap
        sessions={[testSession('one', today, [testSet('s', 40, 10)])]}
        today={today}
        period="week"
      />,
    );
    expect(screen.getByText('400 kg·rep')).toBeInTheDocument();
    rerender(<MuscleMap sessions={[]} today={today} period="week" />);
    expect(
      screen.getByText('Peito: 0 séries válidas no período.'),
    ).toBeInTheDocument();
    rerender(<MuscleMap sessions={sessions} today={today} period="week" />);
    expect(
      screen.getByText('Peito: 2 séries válidas no período.'),
    ).toBeInTheDocument();
  });
  it('não atribui a adutores estímulo de exercícios vizinhos sem relação', () => {
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    fireEvent.click(
      screen.getAllByRole('button', { name: /Adutores · esquerda/ })[0]!,
    );
    const details = screen.getByLabelText('Detalhes do músculo selecionado');
    expect(within(details).getByText('Grupo: Adutores')).toBeInTheDocument();
    expect(
      within(details).getByRole('img', {
        name: 'Esforço relativo: indeterminado',
      }),
    ).toBeInTheDocument();
    expect(
      within(details).getByText(
        'Nenhum estímulo contabilizado para este músculo no período selecionado.',
      ),
    ).toBeInTheDocument();
  });
  it('rastreia exercícios reais por grupo, separando estabilizador de estímulo contabilizado', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem');
    const squats = Array.from({ length: 6 }, (_, i) =>
      testSession(
        `sq${i}`,
        `2026-11-${String(14 + i).padStart(2, '0')}`,
        [testSet('a', 60, 8, 'working', 2), testSet('b', 60, 8)],
        'squat',
      ),
    );
    render(<MuscleMap sessions={squats} today={today} period="month" />);
    fireEvent.click(screen.getByRole('button', { name: /^Abdômen/ }));
    const details = () =>
      screen.getByLabelText('Detalhes do músculo selecionado');
    const trace = () =>
      within(details()).getByRole('region', {
        name: 'Exercícios que estimularam este músculo',
      });
    expect(
      within(trace()).getByText(
        'Nenhum estímulo contabilizado para este músculo no período selecionado.',
      ),
    ).toBeInTheDocument();
    const stabilizers = within(trace()).getByRole('list', {
      name: 'Participação estabilizadora',
    });
    expect(within(stabilizers).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(stabilizers).getAllByLabelText('Papel: Estabilizador')[0],
    ).toBeInTheDocument();
    expect(
      within(stabilizers).getAllByText(
        'Não entra no cálculo: participação estabilizadora.',
      )[0],
    ).toBeInTheDocument();
    const more = within(trace()).getByRole('button', {
      name: 'Mostrar todos (6)',
    });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(within(stabilizers).getAllByRole('listitem')).toHaveLength(6);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    expect(
      within(trace()).getByText(
        'Nenhum estímulo contabilizado para este músculo nos últimos 14 dias.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Quadríceps/ }));
    const counted = within(trace()).getByRole('list', {
      name: 'Estímulo contabilizado',
    });
    const first = within(counted).getAllByRole('listitem')[0]!;
    expect(within(first).getByText('Agachamento livre')).toBeInTheDocument();
    expect(
      within(first).getByLabelText('Papel: Principal'),
    ).toBeInTheDocument();
    expect(
      within(first).getByText('19/11/2026 · 2 séries válidas'),
    ).toBeInTheDocument();
    expect(
      within(first).getByText(/^Carga residual atual:/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
    expect(
      within(trace()).getAllByText(
        'Contribuição: 2 séries equivalentes (2 × 1).',
      )[0],
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
