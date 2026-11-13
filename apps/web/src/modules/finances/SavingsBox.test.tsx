import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { App } from '../../app/App';
import {
  createDemoPlayerState,
  PLAYER_STORAGE_KEY,
} from '../../app/playerState';
import { emptyLedger } from './types';
afterEach(cleanup);
function seed() {
  const state = createDemoPlayerState();
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta',
        initialCents: 200000,
        date: '2026-01-01',
      },
    ],
  };
  state.records.workouts = [{ date: '2026-11-13', trained: true }];
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: 2, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  return state;
}
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
function register(name: string, checked = false) {
  const form = screen.getByRole('form', { name: 'Cadastrar investimento' });
  input(form, 'Nome do investimento', name);
  input(form, 'Categoria do investimento', 'Caixinhas bancárias');
  expect(
    within(form).queryByLabelText('Quantidade (opcional)'),
  ).not.toBeInTheDocument();
  input(form, 'Instituição financeira (opcional)', 'Itaú');
  input(form, 'Rentabilidade contratada (% do CDI, opcional)', '100');
  input(form, 'Custo de aquisição (R$, se conhecido)', '100000');
  input(form, 'Data original de aquisição (opcional)', '2026-11-01');
  input(form, 'Saldo atual da caixinha (R$, opcional)', '100800');
  if (checked) fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.click(
    within(form).getByRole('button', { name: 'Adicionar investimento' }),
  );
  return screen.getByRole('group', { name: `Caixinha ${name}` });
}
describe('Caixinhas pela interface', () => {
  it('cadastra múltiplas caixinhas existentes, sem débito ou rendimento presumido', () => {
    seed();
    render(<App />);
    const card = register('Reserva');
    expect(card).toHaveTextContent('Itaú');
    expect(card).toHaveTextContent('100% do CDI');
    expect(card).toHaveTextContent('R$ 1.008,00');
    expect(card).toHaveTextContent('Diferença saldo/custo');
    expect(card).toHaveTextContent('A diferença não comprova rendimento');
    register('Viagem', true);
    expect(
      screen.getByRole('group', { name: 'Caixinha Viagem' }),
    ).toHaveTextContent('Rendimento acumulado');
    expect(stored().records.investments).toHaveLength(2);
    expect(stored().records.movements).toEqual([]);
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toHaveTextContent('R$ 2.000,00');
  });
  it('atualiza saldo, preserva operações/XP, edita metadados e recupera após recarga', () => {
    const state = seed();
    const app = render(<App />);
    let card = register('Reserva', true);
    const before = structuredClone(stored());
    fireEvent.click(
      within(card).getByRole('button', { name: 'Atualizar saldo de Reserva' }),
    );
    let form = within(card).getByRole('form', {
      name: 'Atualizar saldo de Reserva',
    });
    input(form, 'Saldo atual exibido pelo banco (R$)', '101500');
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar saldo' }));
    expect(card).toHaveTextContent('R$ 1.015,00');
    expect(card).toHaveTextContent('R$ 15,00');
    expect(stored().records.investmentEntries).toEqual(
      before.records.investmentEntries,
    );
    expect(stored().records.movements).toEqual([]);
    expect(stored().records.workouts).toEqual(state.records.workouts);
    expect(stored().records.finance.valuations).toHaveLength(2);
    const chart = screen.getByRole('region', { name: 'Evolução financeira' });
    fireEvent.click(
      within(chart).getByRole('button', { name: 'Patrimônio total' }),
    );
    expect(chart).toHaveTextContent('R$ 3.015,00');
    fireEvent.click(
      screen.getByRole('button', { name: 'Editar investimento Reserva' }),
    );
    form = screen.getByRole('form', { name: 'Editar investimento' });
    input(form, 'Instituição financeira (opcional)', 'Banco diferente');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar investimento' }),
    );
    expect(card).toHaveTextContent('Banco diferente');
    expect(card).toHaveTextContent('R$ 1.015,00');
    app.unmount();
    render(<App />);
    card = screen.getByRole('group', { name: 'Caixinha Reserva' });
    expect(card).toHaveTextContent('Banco diferente');
    expect(card).toHaveTextContent('R$ 1.015,00');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Excluir investimento e operações de Reserva',
      }),
    );
    expect(stored().records.finance.valuations).toEqual([]);
    expect(stored().records.investmentEntries).toEqual([]);
  });
  it('permite cancelar a atualização sem mudar o saldo', () => {
    seed();
    render(<App />);
    const card = register('Reserva');
    const before = structuredClone(stored());
    fireEvent.click(
      within(card).getByRole('button', { name: 'Atualizar saldo de Reserva' }),
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Cancelar edição' }),
    );
    expect(stored()).toEqual(before);
  });
});
