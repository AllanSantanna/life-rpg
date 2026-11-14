import { useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomSelect, type SelectOption } from './CustomSelect';
const options: SelectOption<string>[] = [
  { value: 'finance', label: 'Finanças', icon: 'wallet', area: 'Finanças' },
  { value: 'workouts', label: 'Treinos', icon: 'dumbbell', area: 'Treinos' },
  { value: 'blocked', label: 'Indisponível', disabled: true },
  {
    value: 'knowledge',
    label: 'Conhecimento',
    icon: 'book',
    area: 'Conhecimento',
  },
  { value: 'album', label: 'Álbum pessoal' },
];
const initialWidth = window.innerWidth,
  initialHeight = window.innerHeight;
afterEach(() => {
  cleanup();
  window.innerWidth = initialWidth;
  window.innerHeight = initialHeight;
  vi.unstubAllGlobals();
});
function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('finance');
  return (
    <form
      aria-label="Escolha de exemplo"
      onSubmit={(event) => event.preventDefault()}
    >
      <label>
        Pilar da quest
        <CustomSelect
          label="Pilar da quest"
          name="pillar"
          value={value}
          onChange={setValue}
          options={options}
          disabled={disabled}
        />
      </label>
      <button type="button">Fora do seletor</button>
    </form>
  );
}
const trigger = () => screen.getByRole('combobox', { name: 'Pilar da quest' });
const data = () =>
  new FormData(screen.getByRole('form') as HTMLFormElement).get('pillar');
function activeName() {
  return document.getElementById(
    trigger().getAttribute('aria-activedescendant')!,
  )?.textContent;
}
describe('Seleção customizada acessível', () => {
  it('preserva escolhas não controladas, padrões e fallback quando opções são removidas', () => {
    const changed = vi.fn();
    const content = (
      items: SelectOption<string>[],
      defaultValue = 'inexistente',
    ) => (
      <form aria-label="Cadastro">
        <label>
          Categoria
          <CustomSelect
            label="Categoria"
            name="category"
            defaultValue={defaultValue}
            options={items}
            onChange={changed}
          />
        </label>
      </form>
    );
    const app = render(content(options));
    const selected = () =>
      new FormData(screen.getByRole('form') as HTMLFormElement).get('category');
    expect(selected()).toBe('finance');
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Treinos' }));
    expect(selected()).toBe('workouts');
    app.rerender(content(options, 'finance'));
    expect(selected()).toBe('workouts');
    app.rerender(
      content(options.filter((option) => option.value !== 'workouts')),
    );
    expect(selected()).toBe('finance');
    app.rerender(content(options));
    expect(selected()).toBe('finance');
    expect(changed).toHaveBeenCalledTimes(1);
    app.rerender(content([]));
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(selected()).toBeNull();
  });
  it('abre sem select nativo, anuncia seleção, escolhe por clique e envia o valor no formulário', () => {
    render(<Harness />);
    expect(document.querySelector('select')).toBeNull();
    expect(screen.getByLabelText('Pilar da quest')).toBe(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger());
    const list = screen.getByRole('listbox', { name: 'Pilar da quest' });
    expect(trigger()).toHaveAttribute('aria-controls', list.id);
    expect(screen.getByRole('option', { name: 'Finanças' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('option', { name: 'Indisponível' }),
    ).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Indisponível' }));
    expect(data()).toBe('finance');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Treinos' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent('Treinos');
    expect(trigger()).toHaveFocus();
    expect(data()).toBe('workouts');
  });
  it('navega com setas, Home e End, ignora opções desabilitadas e confirma apenas com Enter', () => {
    render(<Harness />);
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(activeName()).toBe('Finanças');
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(activeName()).toBe('Treinos');
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(activeName()).toBe('Conhecimento');
    expect(data()).toBe('finance');
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(activeName()).toBe('Treinos');
    fireEvent.keyDown(trigger(), { key: 'End' });
    expect(activeName()).toBe('Álbum pessoal');
    fireEvent.keyDown(trigger(), { key: 'Home' });
    expect(activeName()).toBe('Finanças');
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(activeName()).toBe('Álbum pessoal');
    fireEvent.keyDown(trigger(), { key: 'Enter' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(data()).toBe('album');
    expect(trigger()).toHaveFocus();
  });
  it('abre com Espaço, permite busca por letras sem acento e cancela sem mudar o valor', () => {
    render(<Harness />);
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: ' ' });
    fireEvent.keyDown(trigger(), { key: 'a' });
    expect(activeName()).toBe('Álbum pessoal');
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(trigger()).toHaveFocus();
    expect(data()).toBe('finance');
    fireEvent.keyDown(trigger(), { key: 't' });
    expect(activeName()).toBe('Treinos');
    fireEvent.keyDown(trigger(), { key: ' ' });
    expect(data()).toBe('workouts');
  });
  it('fecha por clique fora, perda de foco, Tab e clique no próprio controle', () => {
    render(<Harness />);
    const outside = screen.getByRole('button', { name: 'Fora do seletor' });
    fireEvent.click(trigger());
    fireEvent.pointerDown(outside);
    outside.focus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(outside).toHaveFocus();
    fireEvent.click(trigger());
    fireEvent.click(outside);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger());
    act(() => {
      trigger().focus();
      outside.focus();
    });
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger());
    expect(fireEvent.keyDown(trigger(), { key: 'Tab' })).toBe(true);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(data()).toBe('finance');
  });
  it('respeita desabilitação e limpa a animação de saída ao desmontar', () => {
    const app = render(<Harness disabled />);
    expect(trigger()).toBeDisabled();
    fireEvent.click(trigger());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    app.rerender(<Harness />);
    vi.useFakeTimers();
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    const closing = screen.getByRole('listbox', { hidden: true });
    expect(closing).toHaveAttribute('aria-hidden', 'true');
    expect(closing).toHaveAttribute('inert');
    act(() => vi.advanceTimersByTime(120));
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    app.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('mantém a lista dentro do viewport móvel e abre acima quando falta espaço abaixo', () => {
    window.innerWidth = 320;
    window.innerHeight = 640;
    render(<Harness />);
    vi.spyOn(trigger(), 'getBoundingClientRect').mockReturnValue({
      left: 260,
      right: 500,
      top: 550,
      bottom: 594,
      width: 240,
      height: 44,
      x: 260,
      y: 550,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger());
    const list = screen.getByRole('listbox');
    expect(parseFloat(list.style.left)).toBeGreaterThanOrEqual(8);
    expect(
      parseFloat(list.style.left) + parseFloat(list.style.width),
    ).toBeLessThanOrEqual(312);
    expect(list.style.bottom).toBe('96px');
    expect(parseFloat(list.style.maxHeight)).toBeLessThanOrEqual(300);
    window.innerWidth = 768;
    window.innerHeight = 1000;
    fireEvent(window, new Event('resize'));
    expect(list.style.top).toBe('600px');
    expect(list.style.bottom).toBe('');
  });
  it('respeita movimento reduzido ao fechar sem manter a animação pendente', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });
});
