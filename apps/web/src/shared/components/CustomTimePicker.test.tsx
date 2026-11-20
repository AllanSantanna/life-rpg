import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomTimePicker } from './CustomTimePicker';
import { maskTimeText, parseTimeText } from '../dates/time';
const width = window.innerWidth,
  height = window.innerHeight;
afterEach(() => {
  cleanup();
  window.innerWidth = width;
  window.innerHeight = height;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const control = () => screen.getByRole('combobox', { name: 'Horário' });
const open = () => {
  fireEvent.click(control());
  return screen.getByRole('dialog');
};
function Harness({
  initial = '',
  required = false,
  onChange = () => {},
}: {
  initial?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CustomTimePicker
      label="Horário"
      value={value}
      required={required}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}
const option = (panel: HTMLElement, name: string) =>
  within(panel).getByRole('option', { name });

describe('CustomTimePicker', () => {
  it('não usa input nativo e seleciona hora e minuto com dois toques', () => {
    const change = vi.fn();
    render(<Harness initial="08:15" onChange={change} />);
    expect(document.querySelector('input[type="time"]')).toBeNull();
    expect(control()).toHaveTextContent('08:15');
    const panel = open();
    expect(option(panel, '08 horas')).toHaveAttribute('aria-selected', 'true');
    expect(within(panel).getAllByRole('option')).toHaveLength(24 + 60);
    fireEvent.click(option(panel, '15 horas'));
    expect(change).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(option(panel, '15 minutos'));
    fireEvent.click(option(panel, '30 minutos'));
    expect(change).toHaveBeenCalledWith('15:30');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(control()).toHaveTextContent('15:30');
    expect(document.activeElement).toBe(control());
  });

  it('leva o foco à hora selecionada mesmo quando showModal foca o primeiro botão', () => {
    // Navegadores reais focam o primeiro controle do diálogo modal; o jsdom não.
    const original = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
      this.querySelector<HTMLElement>('button')?.focus();
    };
    try {
      render(<Harness initial="08:15" />);
      const panel = open();
      expect(document.activeElement).toBe(option(panel, '08 horas'));
      const typed = within(panel).getByRole('textbox', {
        name: 'Digitar horário',
      });
      typed.focus();
      fireEvent.change(typed, { target: { value: '09' } });
      expect(document.activeElement).toBe(typed);
    } finally {
      HTMLDialogElement.prototype.showModal = original;
    }
  });

  it('aceita digitação manual com máscara e rejeita horários inválidos', () => {
    const change = vi.fn();
    render(<Harness initial="10:00" onChange={change} />);
    const panel = open();
    const typed = within(panel).getByRole('textbox', {
      name: 'Digitar horário',
    });
    for (const invalid of ['2400', '1260', '9']) {
      fireEvent.change(typed, { target: { value: invalid } });
      fireEvent.keyDown(typed, { key: 'Enter' });
      expect(within(panel).getByRole('alert')).toHaveTextContent(/HH:mm/);
      expect(change).not.toHaveBeenCalled();
    }
    fireEvent.change(typed, { target: { value: '9:05' } });
    expect(typed).toHaveValue('9:05');
    fireEvent.keyDown(typed, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith('09:05');
    open();
    const reopened = screen.getByRole('textbox', { name: 'Digitar horário' });
    fireEvent.change(reopened, { target: { value: '0745' } });
    expect(reopened).toHaveValue('07:45');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(change).toHaveBeenCalledWith('07:45');
    expect(control()).toHaveTextContent('07:45');
  });

  it('navega por teclado entre colunas e confirma sem mouse', () => {
    const change = vi.fn();
    render(<Harness initial="23:58" onChange={change} />);
    fireEvent.keyDown(control(), { key: 'Enter' });
    const panel = screen.getByRole('dialog');
    const hoursList = within(panel).getByRole('listbox', { name: 'Horas' });
    expect(document.activeElement).toBe(option(panel, '23 horas'));
    fireEvent.keyDown(hoursList, { key: 'ArrowDown' });
    expect(option(panel, '23 horas')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(hoursList, { key: 'Home' });
    fireEvent.keyDown(hoursList, { key: 'PageDown' });
    expect(document.activeElement).toBe(option(panel, '05 horas'));
    fireEvent.keyDown(hoursList, { key: 'ArrowRight' });
    const minutesList = within(panel).getByRole('listbox', { name: 'Minutos' });
    expect(document.activeElement).toBe(option(panel, '58 minutos'));
    fireEvent.keyDown(minutesList, { key: 'ArrowDown' });
    fireEvent.keyDown(minutesList, { key: 'ArrowDown' });
    fireEvent.keyDown(minutesList, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith('05:59');
  });

  it('Escape e clique fora fecham sem alterar; Agora, Limpar e Confirmar seguem o contrato', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T14:07:00'));
    const change = vi.fn();
    render(
      <>
        <Harness initial="09:00" onChange={change} />
        <button type="button">Fora</button>
      </>,
    );
    let panel = open();
    fireEvent.click(option(panel, '11 horas'));
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    open();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(change).not.toHaveBeenCalled();
    expect(control()).toHaveTextContent('09:00');
    panel = open();
    fireEvent.click(option(panel, '11 horas'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Confirmar' }));
    expect(change).toHaveBeenLastCalledWith('11:00');
    panel = open();
    fireEvent.click(within(panel).getByRole('button', { name: 'Agora' }));
    expect(change).toHaveBeenLastCalledWith('14:07');
    panel = open();
    fireEvent.click(within(panel).getByRole('button', { name: 'Limpar' }));
    expect(change).toHaveBeenLastCalledWith('');
    expect(control()).toHaveTextContent('Não informado');
  });

  it('obrigatório não oferece Limpar e recusa digitação vazia', () => {
    const change = vi.fn();
    render(<Harness initial="06:00" required onChange={change} />);
    const panel = open();
    expect(within(panel).queryByRole('button', { name: 'Limpar' })).toBeNull();
    const typed = within(panel).getByRole('textbox', {
      name: 'Digitar horário',
    });
    fireEvent.change(typed, { target: { value: '' } });
    fireEvent.keyDown(typed, { key: 'Enter' });
    expect(within(panel).getByRole('alert')).toHaveTextContent(
      'Escolha um horário.',
    );
    expect(change).not.toHaveBeenCalled();
  });

  it('cabe no viewport móvel, abre acima do campo baixo e respeita movimento reduzido', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    window.innerWidth = 320;
    window.innerHeight = 640;
    render(<Harness initial="12:00" />);
    vi.spyOn(control(), 'getBoundingClientRect').mockReturnValue({
      x: 200,
      y: 550,
      left: 200,
      right: 480,
      top: 550,
      bottom: 594,
      width: 280,
      height: 44,
      toJSON: () => ({}),
    });
    const dialog = open();
    expect(parseFloat(dialog.style.width)).toBeLessThanOrEqual(304);
    expect(parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(8);
    expect(
      parseFloat(dialog.style.left) + parseFloat(dialog.style.width),
    ).toBeLessThanOrEqual(312);
    expect(dialog.style.top).toBe('');
    expect(dialog.style.bottom).toBe('96px');
    expect(parseFloat(dialog.style.maxHeight)).toBeLessThanOrEqual(536);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('interpreta e mascara textos de horário', () => {
    expect(maskTimeText('15h30')).toBe('15:30');
    expect(maskTimeText('123456')).toBe('12:34');
    expect(maskTimeText('9:05')).toBe('9:05');
    expect(maskTimeText('15:')).toBe('15:');
    expect(maskTimeText('1:2:3')).toBe('1:23');
    expect(parseTimeText('9:05')).toBe('09:05');
    expect(parseTimeText('1530')).toBe('15:30');
    expect(parseTimeText('23:59')).toBe('23:59');
    for (const text of ['24:00', '12:60', '1:2', 'abc', ''])
      expect(parseTimeText(text)).toBeNull();
  });
});
