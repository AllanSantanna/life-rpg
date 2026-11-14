import { selectOption } from '../../test/selectOption';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { MoneyInput } from './MoneyInput';
import { BitcoinQuantity } from './BitcoinQuantity';
import { decimalToUnits } from './monetary';
afterEach(cleanup);
describe('Máscaras e unidades de Bitcoin', () => {
  it('formata durante a digitação e separa apresentação e centavos canônicos', () => {
    const { container } = render(
      <form>
        <label>
          Valor
          <MoneyInput name="amount" />
        </label>
      </form>,
    );
    const input = screen.getByLabelText('Valor');
    for (const value of ['1', '12', '1250', '125050'])
      fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue('R$ 1.250,50');
    expect(new FormData(container.querySelector('form')!).get('amount')).toBe(
      '1250.50',
    );
    fireEvent.change(input, { target: { value: 'R$ 9.876,54' } });
    expect(new FormData(container.querySelector('form')!).get('amount')).toBe(
      '9876.54',
    );
    fireEvent.change(input, { target: { value: '12x' } });
    expect(input).toHaveValue('R$ 9.876,54');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    expect(new FormData(container.querySelector('form')!).get('amount')).toBe(
      '',
    );
  });
  it('permite seleção, substituição e edição no meio sem saltar o cursor para o fim', () => {
    render(
      <label>
        Valor
        <MoneyInput name="amount" defaultValue="1234.56" />
      </label>,
    );
    const input = screen.getByLabelText('Valor') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, {
      target: { value: 'R$ 1.934,56', selectionStart: 6 },
    });
    expect(input).toHaveValue('R$ 1.934,56');
    expect(input.selectionStart).toBe(6);
    input.setSelectionRange(0, input.value.length);
    fireEvent.change(input, { target: { value: '500' } });
    expect(input).toHaveValue('R$ 5,00');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
  });
  it('apaga um dígito ao atravessar separadores e aceita USD/saldo negativo', () => {
    render(
      <>
        <label>
          Valor
          <MoneyInput name="a" defaultValue="1234.56" />
        </label>
        <label>
          Dólares
          <MoneyInput currency="USD" name="usd" />
        </label>
        <label>
          Saldo
          <MoneyInput allowNegative name="s" />
        </label>
      </>,
    );
    const input = screen.getByLabelText('Valor') as HTMLInputElement;
    input.setSelectionRange(9, 9);
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(input).toHaveValue('R$ 123,56');
    fireEvent.change(screen.getByLabelText('Dólares'), {
      target: { value: '10000' },
    });
    expect(screen.getByLabelText('Dólares')).toHaveValue('US$ 100,00');
    fireEvent.change(screen.getByLabelText('Saldo'), {
      target: { value: '-125050' },
    });
    expect(screen.getByLabelText('Saldo')).toHaveValue('-R$ 1.250,50');
    expect(decimalToUnits('0.29', 2)).toBe(29);
    expect(() => decimalToUnits('0.001', 2)).toThrow();
  });
  it('alterna BTC/sats mantendo 1 satoshi e rejeita mais de oito casas', () => {
    const { container } = render(
      <form>
        <BitcoinQuantity quantity={0.00000001} />
      </form>,
    );
    expect(new FormData(container.querySelector('form')!).get('quantity')).toBe(
      '0.00000001',
    );
    selectOption(
      screen.getByRole('combobox', { name: 'Unidade de Bitcoin' }),
      'Satoshis (sats)',
    );
    expect(screen.getByLabelText('Quantidade em sats')).toHaveValue('1');
    fireEvent.change(screen.getByLabelText('Quantidade em sats'), {
      target: { value: '100000' },
    });
    expect(screen.getByLabelText('Quantidade em sats')).toHaveValue('100.000');
    expect(new FormData(container.querySelector('form')!).get('quantity')).toBe(
      '0.00100000',
    );
    selectOption(
      screen.getByRole('combobox', { name: 'Unidade de Bitcoin' }),
      'Bitcoin (BTC)',
    );
    expect(screen.getByLabelText('Quantidade em BTC')).toHaveValue(
      '0,00100000',
    );
    fireEvent.change(screen.getByLabelText('Quantidade em BTC'), {
      target: { value: '0,000000001' },
    });
    expect(screen.getByLabelText('Quantidade em BTC')).toHaveValue(
      '0,00100000',
    );
    fireEvent.change(screen.getByLabelText('Quantidade em BTC'), {
      target: { value: '0,00000001' },
    });
    expect(
      within(container).getByText(/1 sats = 0,00000001 BTC/),
    ).toBeInTheDocument();
  });
});
