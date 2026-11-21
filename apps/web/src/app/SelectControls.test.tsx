import { cardAction, movementHistory, newMovementForm } from '../test/finances';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from './playerState';
import { selectOption } from '../test/selectOption';
import { accountBalance } from '../modules/finances/ledger';
const today = '2026-11-13';
afterEach(cleanup);
function initial() {
  const state = createInitialPlayerState();
  state.records.finance = {
    accounts: [
      {
        id: 'other',
        name: 'Conta secundária',
        initialCents: 50000,
        date: '2026-01-01',
      },
      {
        id: 'principal',
        name: 'Conta principal',
        initialCents: 100000,
        date: '2026-01-01',
      },
    ],
    transfers: [],
    valuations: [],
    quotes: [],
  };
  state.records.investments = [
    { id: 'fixed', name: 'Tesouro', category: 'Renda fixa' },
    { id: 'stock', name: 'Carteira de ações', category: 'Ações' },
  ];
  state.records.books = [
    { id: 'a', title: 'O começo', totalPages: 100 },
    { id: 'b', title: 'Próxima aventura', totalPages: 200 },
  ];
  state.records.workouts = [{ date: today, trained: true }];
  state.records.sleep = [{ date: today, hours: 8 }];
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  return state;
}
const stored = () => JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function choose(form: HTMLElement, label: string, option: string) {
  selectOption(within(form).getByRole('combobox', { name: label }), option);
}
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
function submit(form: HTMLElement, name: string) {
  fireEvent.click(within(form).getByRole('button', { name }));
}
describe('Seletores customizados nos módulos do aplicativo', () => {
  it('preserva contas, tipos de movimentação, transferências e avaliações ao escolher e editar', () => {
    const state = initial();
    window.history.replaceState(null, '', '/financas');
    const app = render(<App />);
    expect(document.querySelector('select')).toBeNull();
    let form = newMovementForm();
    expect(
      within(form).getByRole('combobox', { name: 'Conta' }),
    ).toHaveTextContent('Conta principal');
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveTextContent('Despesa');
    choose(form, 'Tipo de movimentação', 'Receita');
    choose(form, 'Conta', 'Conta secundária');
    input(form, 'Descrição', 'Recebimento');
    input(form, 'Valor (R$)', '10000');
    submit(form, 'Adicionar movimentação');
    expect(stored().records.movements[0]).toMatchObject({
      kind: 'income',
      accountId: 'other',
      amountCents: 10000,
    });
    movementHistory();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Recebimento' }));
    form = screen.getByRole('form', { name: 'Editar movimentação' });
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveTextContent('Receita');
    expect(
      within(form).getByRole('combobox', { name: 'Conta' }),
    ).toHaveTextContent('Conta secundária');
    choose(form, 'Tipo de movimentação', 'Despesa');
    choose(form, 'Conta', 'Conta principal');
    submit(form, 'Salvar movimentação');
    expect(stored().records.movements).toHaveLength(1);
    expect(stored().records.movements[0]).toMatchObject({
      kind: 'expense',
      accountId: 'principal',
      amountCents: 10000,
    });
    fireEvent.click(
      screen.getByText('Contas, transferências e avaliações manuais'),
    );
    form = screen.getByRole('form', { name: 'Transferir entre contas' });
    choose(form, 'Conta de origem', 'Conta secundária');
    choose(form, 'Conta de destino', 'Conta principal');
    input(form, 'Valor da transferência (R$)', '5000');
    submit(form, 'Salvar transferência');
    expect(stored().records.finance.transfers[0]).toMatchObject({
      fromId: 'other',
      toId: 'principal',
      amountCents: 5000,
    });
    expect(accountBalance(stored().records, 'principal', today)).toBe(95000);
    expect(accountBalance(stored().records, 'other', today)).toBe(45000);
    form = screen.getByRole('form', {
      name: 'Atualizar valor de investimento',
    });
    choose(form, 'Investimento avaliado', 'Carteira de ações');
    input(form, 'Valor atual manual (R$)', '12500');
    submit(form, 'Salvar avaliação');
    expect(stored().records.finance.valuations[0]).toMatchObject({
      investmentId: 'stock',
      amountCents: 12500,
    });
    form = cardAction(
      'Investimento Carteira de ações',
      'Comprar mais Carteira de ações',
    );
    input(form, 'Valor da operação (R$)', '10000');
    submit(form, 'Registrar operação');
    expect(stored().records.investmentEntries[0]).toMatchObject({
      investmentId: 'stock',
      kind: 'contribution',
      amountCents: 10000,
    });
    expect(stored().records.books).toEqual(state.records.books);
    expect(stored().records.workouts).toEqual(state.records.workouts);
    const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
    // Após recarregar, a seção recolhível volta fechada, como no navegador.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Contas, transferências e avaliações manuais',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar avaliação' }));
    form = screen.getByRole('form', { name: 'Editar avaliação' });
    expect(
      within(form).getByRole('combobox', { name: 'Investimento avaliado' }),
    ).toHaveTextContent('Carteira de ações');
    expect(document.querySelector('select')).toBeNull();
  });
  it('registra e corrige a leitura no livro escolhido, mantendo o padrão após salvar e a persistência', () => {
    const state = initial();
    window.history.replaceState(null, '', '/conhecimento');
    const app = render(<App />);
    expect(document.querySelector('select')).toBeNull();
    let form = screen.getByRole('form', { name: 'Registrar leitura' });
    expect(
      within(form).getByRole('combobox', { name: 'Livro da leitura' }),
    ).toHaveTextContent('O começo');
    choose(form, 'Livro da leitura', 'Próxima aventura');
    input(form, 'Páginas lidas neste registro', '5');
    submit(form, 'Adicionar leitura');
    expect(stored().records.readings[0]).toMatchObject({
      bookId: 'b',
      pages: 5,
    });
    form = screen.getByRole('form', { name: 'Registrar leitura' });
    expect(
      within(form).getByRole('combobox', { name: 'Livro da leitura' }),
    ).toHaveTextContent('O começo');
    fireEvent.click(screen.getByRole('button', { name: /Editar leitura/ }));
    form = screen.getByRole('form', { name: 'Corrigir leitura' });
    expect(
      within(form).getByRole('combobox', { name: 'Livro da leitura' }),
    ).toHaveTextContent('Próxima aventura');
    choose(form, 'Livro da leitura', 'O começo');
    input(form, 'Páginas lidas neste registro', '7');
    submit(form, 'Salvar leitura');
    expect(stored().records.readings).toHaveLength(1);
    expect(stored().records.readings[0]).toMatchObject({
      bookId: 'a',
      pages: 7,
    });
    expect(stored().records.finance).toEqual(state.records.finance);
    expect(stored().records.sleep).toEqual(state.records.sleep);
    const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(saved);
    expect(document.querySelector('select')).toBeNull();
  });
});
