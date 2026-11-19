import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyRecords } from '../records/types';
import { ActivityCalendar } from './ActivityCalendar';
import { indexActivities } from './aggregation';
import { DRAG_THRESHOLD } from './useDragScroll';

afterEach(cleanup);
const today = '2026-11-13';

function setup() {
  const records = emptyRecords();
  records.workouts = [{ date: today, trained: true }];
  records.sleep = [{ date: '2026-11-10', hours: 8 }];
  render(<ActivityCalendar index={indexActivities(records)} today={today} />);
  const area = screen.getByRole('region', {
    name: /Dias e pilares do mês/,
  });
  return { area };
}
/** jsdom não implementa PointerEvent; os campos usados pelo hook são definidos. */
function pointer(
  target: Element,
  type: string,
  {
    x,
    y = 100,
    pointerType = 'mouse',
    id = 1,
  }: { x: number; y?: number; pointerType?: string; id?: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: id },
  });
  target.dispatchEvent(event);
  return event;
}
function cell(name: string) {
  return screen.getByRole('button', { name });
}
function selectedDetails() {
  return screen.getByRole('region', { name: 'Atividades do dia' });
}

describe('Arraste do Calendário de Atividades', () => {
  it('arrasta horizontalmente com o mouse sem selecionar o dia sob o ponteiro', () => {
    const { area } = setup();
    area.scrollLeft = 120;
    const target = cell('Descanso, 10/11/2026: Muito alta');
    pointer(target, 'pointerdown', { x: 300 });
    const move = pointer(target, 'pointermove', { x: 240 });
    expect(area.scrollLeft).toBe(180);
    expect(area).toHaveClass('is-dragging');
    expect(move.defaultPrevented).toBe(true);
    pointer(target, 'pointermove', { x: 320 });
    expect(area.scrollLeft).toBe(100);
    pointer(target, 'pointerup', { x: 320 });
    expect(area).not.toHaveClass('is-dragging');
    fireEvent.click(target);
    expect(target).toHaveAttribute('aria-pressed', 'false');
    expect(selectedDetails()).toHaveTextContent('13/11/2026');
  });

  it('trata movimentos curtos como clique e seleciona o dia', () => {
    const { area } = setup();
    const target = cell('Descanso, 10/11/2026: Muito alta');
    pointer(target, 'pointerdown', { x: 300 });
    pointer(target, 'pointermove', { x: 300 - (DRAG_THRESHOLD - 2) });
    expect(area.scrollLeft).toBe(0);
    expect(area).not.toHaveClass('is-dragging');
    pointer(target, 'pointerup', { x: 300 - (DRAG_THRESHOLD - 2) });
    fireEvent.click(target);
    expect(target).toHaveAttribute('aria-pressed', 'true');
    expect(selectedDetails()).toHaveTextContent('10/11/2026');
  });

  it('deixa o toque para a rolagem nativa e mantém o toque simples como seleção', () => {
    const { area } = setup();
    area.scrollLeft = 40;
    const target = cell('Treinos, 13/11/2026: Média');
    pointer(target, 'pointerdown', { x: 200, pointerType: 'touch' });
    const move = pointer(target, 'pointermove', {
      x: 120,
      pointerType: 'touch',
    });
    // Sem preventDefault: o navegador desliza com inércia e libera o vertical.
    expect(move.defaultPrevented).toBe(false);
    expect(area.scrollLeft).toBe(40);
    expect(area).not.toHaveClass('is-dragging');
    pointer(target, 'pointerup', { x: 120, pointerType: 'touch' });
    const other = cell('Descanso, 10/11/2026: Muito alta');
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
  });

  it('não captura gestos predominantemente verticais do mouse', () => {
    const { area } = setup();
    const target = cell('Finanças, 05/11/2026: Nenhuma atividade');
    pointer(target, 'pointerdown', { x: 200, y: 100 });
    const move = pointer(target, 'pointermove', { x: 203, y: 140 });
    expect(move.defaultPrevented).toBe(false);
    expect(area.scrollLeft).toBe(0);
    pointer(target, 'pointerup', { x: 203, y: 140 });
    fireEvent.click(target);
    expect(target).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignora o botão secundário e libera o clique após um arraste concluído', () => {
    const { area } = setup();
    const target = cell('Finanças, 05/11/2026: Nenhuma atividade');
    const secondary = new MouseEvent('pointerdown', {
      bubbles: true,
      clientX: 300,
      button: 2,
    });
    Object.defineProperties(secondary, {
      pointerType: { value: 'mouse' },
      pointerId: { value: 1 },
    });
    target.dispatchEvent(secondary);
    pointer(target, 'pointermove', { x: 200 });
    expect(area.scrollLeft).toBe(0);
    vi.useFakeTimers();
    pointer(target, 'pointerdown', { x: 300 });
    pointer(target, 'pointermove', { x: 250 });
    pointer(target, 'pointerup', { x: 250 });
    // Sem clique após o arraste (soltou fora da célula), o próximo clique vale.
    vi.runAllTimers();
    fireEvent.click(target);
    expect(target).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Navegação temporal do calendário', () => {
  it('rola somente a área do calendário ao abrir um mês e suavemente ao tocar em Hoje', () => {
    const { area } = setup();
    const scrollTo = vi.fn();
    area.scrollTo = scrollTo as unknown as typeof area.scrollTo;
    const page = vi.spyOn(window, 'scrollTo');
    fireEvent.click(
      screen.getByRole('button', { name: 'Mês anterior de atividades' }),
    );
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' });
    expect(selectedDetails()).toHaveTextContent('01/10/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    expect(selectedDetails()).toHaveTextContent('13/11/2026');
    expect(cell('Treinos, 13/11/2026: Média')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Hoje no mês atual também volta à data, mesmo sem trocar de mês.
    fireEvent.click(cell('Finanças, 02/11/2026: Nenhuma atividade'));
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(selectedDetails()).toHaveTextContent('13/11/2026');
    expect(page).not.toHaveBeenCalled();
  });

  it('respeita movimento reduzido ao voltar para Hoje', () => {
    const original = window.matchMedia;
    window.matchMedia = (query: string) =>
      ({ matches: query.includes('reduce') }) as MediaQueryList;
    try {
      const { area } = setup();
      const scrollTo = vi.fn();
      area.scrollTo = scrollTo as unknown as typeof area.scrollTo;
      fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ behavior: 'auto' }),
      );
    } finally {
      window.matchMedia = original;
    }
  });

  it('não reposiciona o calendário enquanto o usuário arrasta', () => {
    const { area } = setup();
    const scrollTo = vi.fn();
    area.scrollTo = scrollTo as unknown as typeof area.scrollTo;
    const target = cell('Finanças, 05/11/2026: Nenhuma atividade');
    pointer(target, 'pointerdown', { x: 300 });
    pointer(target, 'pointermove', { x: 200 });
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(scrollTo).not.toHaveBeenCalled();
    pointer(target, 'pointerup', { x: 200 });
  });

  it('mantém a navegação por teclado e revela a célula focada sem rolar a página', () => {
    const { area } = setup();
    const page = vi.spyOn(window, 'scrollTo');
    const start = cell('Finanças, 13/11/2026: Nenhuma atividade');
    start.focus();
    fireEvent.keyDown(start, { key: 'End' });
    const last = cell('Finanças, 30/11/2026: Nenhuma atividade');
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(cell('Treinos, 30/11/2026: Nenhuma atividade')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(cell('Treinos, 01/11/2026: Nenhuma atividade')).toHaveFocus();
    expect(area.scrollLeft).toBe(0);
    expect(page).not.toHaveBeenCalled();
  });

  it('informa ao CSS a quantidade de dias do mês para a grade compacta', () => {
    setup();
    const table = screen.getByRole('table');
    expect(table.style.getPropertyValue('--heat-days')).toBe('30');
    fireEvent.click(
      screen.getByRole('button', { name: 'Mês anterior de atividades' }),
    );
    expect(table.style.getPropertyValue('--heat-days')).toBe('31');
    expect(screen.getAllByRole('columnheader')).toHaveLength(32);
  });
});
