import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomDatePicker } from './CustomDatePicker';
const width = window.innerWidth,
  height = window.innerHeight;
afterEach(() => {
  cleanup();
  window.innerWidth = width;
  window.innerHeight = height;
  vi.unstubAllGlobals();
});
const control = () =>
  screen.getByRole('combobox', { name: 'Data do registro' });
const saved = () =>
  new FormData(screen.getByRole('form') as HTMLFormElement).get('date');
function open() {
  fireEvent.click(control());
  return screen.getByRole('dialog');
}
function picker(props: Partial<Parameters<typeof CustomDatePicker>[0]> = {}) {
  return render(
    <form aria-label="Registro">
      <label>
        Data do registro
        <CustomDatePicker
          label="Data do registro"
          name="date"
          defaultValue="2026-11-13"
          {...props}
        />
      </label>
      <button type="submit">Salvar</button>
    </form>,
  );
}
describe('Calendário customizado', () => {
  it('abre um calendário dark sem input nativo, seleciona dia e preserva ISO no formulário', () => {
    picker();
    expect(
      document.querySelector('input[type="date"], input[type="month"]'),
    ).toBeNull();
    expect(control()).toHaveTextContent('13/11/2026');
    expect(screen.getByLabelText('Data do registro')).toBe(control());
    const dialog = open();
    expect(control()).toHaveAttribute('aria-controls', dialog.id);
    expect(
      within(dialog).getByRole('button', { name: '13 de novembro de 2026' }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole('button', { name: '13 de novembro de 2026' }),
    ).toHaveAttribute('aria-current', 'date');
    fireEvent.click(
      within(dialog).getByRole('button', { name: '12 de novembro de 2026' }),
    );
    expect(saved()).toBe('2026-11-12');
    expect(control()).toHaveTextContent('12/11/2026');
    expect(control()).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('navega por teclado sem salvar até a confirmação, incluindo a virada do ano', () => {
    picker({ defaultValue: '2026-12-31', required: true });
    open();
    fireEvent.keyDown(
      screen.getByRole('button', { name: '31 de dezembro de 2026' }),
      { key: 'ArrowRight' },
    );
    expect(
      screen.getByRole('button', { name: '1 de janeiro de 2027' }),
    ).toHaveFocus();
    expect(saved()).toBe('2026-12-31');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(
      screen.getByRole('button', { name: '8 de janeiro de 2027' }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(
      screen.getByRole('button', { name: '3 de janeiro de 2027' }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(
      screen.getByRole('button', { name: '9 de janeiro de 2027' }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, {
      key: 'PageUp',
      shiftKey: true,
    });
    expect(
      screen.getByRole('button', { name: '9 de janeiro de 2026' }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(saved()).toBe('2026-12-31');
    expect(control()).toHaveFocus();
  });
  it('permite mês/ano por grades e trata fevereiro bissexto corretamente', () => {
    picker({ defaultValue: '2024-01-31' });
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(
      screen.getByRole('button', { name: '29 de fevereiro de 2024' }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher ano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ano 2025' }));
    fireEvent.click(screen.getByRole('button', { name: 'fevereiro de 2025' }));
    expect(
      screen.queryByRole('button', { name: '29 de fevereiro de 2025' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: '28 de fevereiro de 2025' }),
    );
    expect(saved()).toBe('2025-02-28');
  });
  it('limita datas pela faixa permitida e mantém o valor após digitação inválida', () => {
    picker({ min: '2026-11-10', max: '2026-11-13', required: true });
    open();
    expect(
      screen.getByRole('button', { name: '9 de novembro de 2026' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '14 de novembro de 2026' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Digitar data' }), {
      target: { value: '31/02/2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('data válida');
    expect(saved()).toBe('2026-11-13');
    fireEvent.change(screen.getByRole('textbox', { name: 'Digitar data' }), {
      target: { value: '2026-11-14' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('até 13/11/2026');
    fireEvent.change(screen.getByRole('textbox', { name: 'Digitar data' }), {
      target: { value: '11112026' },
    });
    expect(screen.getByRole('textbox', { name: 'Digitar data' })).toHaveValue(
      '11/11/2026',
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Digitar data' }), {
      key: 'Enter',
    });
    expect(saved()).toBe('2026-11-11');
  });
  it('seleciona meses com limites, permite limpeza opcional e mantém meses ISO', () => {
    picker({ mode: 'month', defaultValue: '2026-11', max: '2026-11' });
    expect(control()).toHaveTextContent('11/2026');
    open();
    expect(
      screen.getByRole('button', { name: 'dezembro de 2026' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'outubro de 2026' }));
    expect(saved()).toBe('2026-10');
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(saved()).toBe('');
    expect(control()).toHaveTextContent('Selecionar mês');
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Mês atual' }));
    expect(saved()).toBe('2026-11');
  });
  it('fecha por clique fora e mantém navegação de foco dentro do calendário até Escape', () => {
    picker();
    const dialog = open();
    const close = screen.getByRole('button', { name: 'Fechar calendário' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Limpar' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.click(dialog, { clientX: -100, clientY: -100 });
    expect(control()).toHaveAttribute('aria-expanded', 'false');
    expect(saved()).toBe('2026-11-13');
    expect(control()).toHaveFocus();
  });
  it('valida campos obrigatórios sem abrir mensagens nativas e respeita somente leitura', () => {
    const app = picker({ defaultValue: '', required: true });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma data');
    expect(
      screen.queryByRole('button', { name: 'Limpar' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: '13 de novembro de 2026' }),
    );
    expect((screen.getByRole('form') as HTMLFormElement).checkValidity()).toBe(
      true,
    );
    app.unmount();
    picker({ readOnly: true });
    fireEvent.click(control());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(control()).toHaveAttribute('aria-readonly', 'true');
    expect(saved()).toBe('2026-11-13');
  });
  it('mantém o painel acima do teclado quando o campo fica fora do viewport visual', () => {
    window.innerWidth = 320;
    window.innerHeight = 640;
    vi.stubGlobal('visualViewport', {
      width: 320,
      height: 300,
      offsetLeft: 0,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    picker();
    vi.spyOn(control(), 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 550,
      left: 20,
      right: 300,
      top: 550,
      bottom: 594,
      width: 280,
      height: 44,
      toJSON: () => ({}),
    });
    const dialog = open();
    expect(640 - parseFloat(dialog.style.bottom)).toBeLessThanOrEqual(300);
    expect(parseFloat(dialog.style.maxHeight)).toBeLessThanOrEqual(300);
  });
  it('cabe no viewport móvel, abre acima e respeita movimento reduzido', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    window.innerWidth = 320;
    window.innerHeight = 640;
    picker();
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
    expect(
      parseFloat(dialog.style.left) + parseFloat(dialog.style.width),
    ).toBeLessThanOrEqual(312);
    expect(dialog.style.bottom).toBe('96px');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(document.querySelector('dialog')).toBeNull();
  });
});
