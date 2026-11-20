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
import { shiftDate } from '../../../records/dates';
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
    const trace = within(details).getByRole('button', {
      name: 'Exercícios que estimularam este músculo (0)',
    });
    fireEvent.click(trace);
    expect(
      within(details).getByText(
        'Nenhum estímulo contabilizado para este músculo no período selecionado.',
      ),
    ).toBeInTheDocument();
  });
  it('rastreia exercícios em seções recolhíveis, independentes e paginadas de 5 em 5', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem');
    // 18 sessões de agachamento (uma por dia): 18 registros em Quadríceps e
    // 18 participações estabilizadoras em Abdômen no período de 30 dias.
    const squats = Array.from({ length: 18 }, (_, i) =>
      testSession(
        `sq${i}`,
        shiftDate(today, -(17 - i)),
        [testSet('a', 60, 8, 'working', 2), testSet('b', 60, 8)],
        'squat',
      ),
    );
    const { rerender } = render(
      <MuscleMap sessions={squats} today={today} period="month" />,
    );
    const details = () =>
      screen.getByLabelText('Detalhes do músculo selecionado');
    const header = (name: RegExp) =>
      within(details()).getByRole('button', { name });
    const main = () => header(/^Exercícios que estimularam este músculo/);
    const stab = () => header(/^Participação estabilizadora/);
    const items = (label: string) =>
      within(within(details()).getByRole('list', { name: label })).getAllByRole(
        'listitem',
      );
    fireEvent.click(screen.getByRole('button', { name: /^Quadríceps/ }));
    // Fechada por padrão, com título, contagem e controle acessível.
    expect(main()).toHaveAccessibleName(
      'Exercícios que estimularam este músculo (18)',
    );
    expect(main()).toHaveAttribute('aria-expanded', 'false');
    expect(main()).toHaveAttribute('type', 'button');
    expect(
      document.getElementById(main().getAttribute('aria-controls')!),
    ).not.toBeVisible();
    expect(within(details()).getByText('Mostrar detalhes')).toBeInTheDocument();
    expect(
      within(details()).queryByRole('list', { name: 'Estímulo contabilizado' }),
    ).toBeNull();
    fireEvent.click(main());
    expect(main()).toHaveAttribute('aria-expanded', 'true');
    expect(within(details()).getByText('Ocultar detalhes')).toBeInTheDocument();
    // Mais recentes primeiro, 5 por vez.
    expect(items('Estímulo contabilizado')).toHaveLength(5);
    expect(items('Estímulo contabilizado')[0]).toHaveTextContent('20/11/2026');
    expect(items('Estímulo contabilizado')[4]).toHaveTextContent('16/11/2026');
    for (const [label, total] of [
      ['Mostrar mais 5', 10],
      ['Mostrar mais 5', 15],
      ['Mostrar mais 3', 18],
    ] as const) {
      const more = within(details()).getByRole('button', { name: label });
      more.focus();
      fireEvent.click(more);
      expect(items('Estímulo contabilizado')).toHaveLength(total);
      expect(
        within(details()).getByText(`Exibindo ${total} de 18 registros.`),
      ).toBeInTheDocument();
    }
    expect(
      within(details()).queryByRole('button', { name: /^Mostrar mais/ }),
    ).toBeNull();
    const less = within(details()).getByRole('button', {
      name: 'Mostrar menos',
    });
    // O botão clicado sumiu; o foco foi para o controle restante.
    expect(less).toHaveFocus();
    fireEvent.click(less);
    expect(items('Estímulo contabilizado')).toHaveLength(5);
    expect(
      within(details()).getByRole('button', { name: 'Mostrar mais 5' }),
    ).toHaveFocus();
    // Recolher e reabrir mantém o músculo selecionado.
    fireEvent.click(main());
    expect(main()).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: /^Quadríceps/, pressed: true }),
    ).toBeInTheDocument();

    // Abdômen: nenhum estímulo contabilizado, 18 estabilizações.
    fireEvent.click(screen.getByRole('button', { name: /^Abdômen/ }));
    expect(main()).toHaveAccessibleName(
      'Exercícios que estimularam este músculo (0)',
    );
    expect(stab()).toHaveAccessibleName(
      'Participação estabilizadora · não contabilizada (18)',
    );
    expect(main()).toHaveAttribute('aria-expanded', 'false');
    expect(stab()).toHaveAttribute('aria-expanded', 'false');
    // Seções independentes.
    fireEvent.click(stab());
    expect(stab()).toHaveAttribute('aria-expanded', 'true');
    expect(main()).toHaveAttribute('aria-expanded', 'false');
    expect(items('Participação estabilizadora')).toHaveLength(5);
    expect(
      within(details()).getAllByText(
        'Não entra no cálculo: participação estabilizadora.',
      ),
    ).toHaveLength(5);
    expect(
      within(details()).getByText(/estabilização não equivale a estímulo/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(details()).getByRole('button', { name: 'Mostrar mais 5' }),
    );
    expect(items('Participação estabilizadora')).toHaveLength(10);
    fireEvent.click(main());
    expect(
      within(details()).getByText(
        'Nenhum estímulo contabilizado para este músculo no período selecionado.',
      ),
    ).toBeInTheDocument();

    // Trocar o período recolhe tudo, volta a 5 e atualiza contagens.
    rerender(<MuscleMap sessions={squats} today={today} period="week" />);
    expect(main()).toHaveAttribute('aria-expanded', 'false');
    expect(stab()).toHaveAttribute('aria-expanded', 'false');
    expect(stab()).toHaveAccessibleName(
      'Participação estabilizadora · não contabilizada (7)',
    );
    fireEvent.click(stab());
    expect(items('Participação estabilizadora')).toHaveLength(5);

    // Trocar de músculo também recolhe e não mantém dados do anterior.
    fireEvent.click(screen.getByRole('button', { name: /^Peito/ }));
    expect(main()).toHaveAccessibleName(
      'Exercícios que estimularam este músculo (0)',
    );
    expect(main()).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(details()).queryByRole('button', {
        name: /^Participação estabilizadora/,
      }),
    ).toBeNull();

    // Recuperação usa a janela fixa de 14 dias, mesmo com o filtro semanal.
    fireEvent.click(screen.getByRole('button', { name: /^Quadríceps/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    expect(main()).toHaveAccessibleName(
      'Exercícios que estimularam este músculo (14)',
    );
    fireEvent.click(main());
    expect(items('Estímulo contabilizado')[0]).toHaveTextContent(
      /Carga residual atual:/,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
