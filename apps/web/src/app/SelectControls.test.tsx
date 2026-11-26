import {
  cardAction,
  financeTab,
  movementHistory,
  newMovementForm,
} from '../test/finances';
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
  it('preserva tipos de movimentação, contas legadas e avaliações ao escolher e editar', () => {
    const state = initial();
    // Registro anterior à carteira única, vinculado a uma conta secundária.
    const legacy = {
      id: 'legacy',
      kind: 'income' as const,
      description: 'Antiga',
      category: 'Geral',
      amountCents: 2000,
      date: '2026-11-01',
      accountId: 'other',
    };
    state.records.movements = [legacy];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
    window.history.replaceState(null, '', '/financas');
    const app = render(<App />);
    expect(document.querySelector('select')).toBeNull();
    let form = newMovementForm();
    expect(
      within(form).queryByRole('combobox', { name: 'Conta' }),
    ).not.toBeInTheDocument();
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveTextContent('Despesa');
    choose(form, 'Tipo de movimentação', 'Receita');
    input(form, 'Descrição', 'Recebimento');
    input(form, 'Valor (R$)', '10000');
    submit(form, 'Adicionar movimentação');
    expect(stored().records.movements[1]).toMatchObject({
      kind: 'income',
      amountCents: 10000,
    });
    expect(stored().records.movements[1]).not.toHaveProperty('accountId');
    movementHistory();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Recebimento' }));
    form = screen.getByRole('form', { name: 'Editar movimentação' });
    expect(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
    ).toHaveTextContent('Receita');
    choose(form, 'Tipo de movimentação', 'Despesa');
    submit(form, 'Salvar movimentação');
    expect(stored().records.movements).toHaveLength(2);
    expect(stored().records.movements[1]).toMatchObject({
      kind: 'expense',
      amountCents: 10000,
    });
    // Editar o registro antigo mantém o ID e a conta de origem.
    fireEvent.click(screen.getByRole('button', { name: 'Editar Antiga' }));
    form = screen.getByRole('form', { name: 'Editar movimentação' });
    input(form, 'Valor (R$)', '3000');
    submit(form, 'Salvar movimentação');
    expect(stored().records.movements[0]).toEqual({
      ...legacy,
      amountCents: 3000,
    });
    expect(accountBalance(stored().records, 'principal', today)).toBe(90000);
    expect(accountBalance(stored().records, 'other', today)).toBe(53000);
    financeTab('Investimentos');
    fireEvent.click(screen.getByRole('button', { name: 'Avaliações manuais' }));
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
    financeTab('Investimentos');
    fireEvent.click(screen.getByRole('button', { name: 'Avaliações manuais' }));
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
