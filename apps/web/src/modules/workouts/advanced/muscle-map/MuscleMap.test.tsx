import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MuscleMap } from '../MuscleMap';
import { testSession, testSet } from '../testFixtures';
afterEach(cleanup);
const today = '2026-11-20';
const sessions = [testSession('one', today, [testSet('a'), testSet('b')])];
describe('mapa anatômico integrado', () => {
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
      ).getByText('Grupo: Costas'),
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
  it('explica regiões sem correspondência em vez de atribuir a músculos vizinhos', () => {
    render(<MuscleMap sessions={sessions} today={today} period="week" />);
    fireEvent.click(
      screen.getAllByRole('button', { name: /Adutores · esquerda/ })[0]!,
    );
    expect(
      screen.getByText('Grupo: Não registrado separadamente'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Não atribuímos séries ou percentuais/),
    ).toBeInTheDocument();
  });
});
