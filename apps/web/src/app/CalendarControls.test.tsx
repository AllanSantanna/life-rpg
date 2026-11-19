import { movementHistory, newMovementForm } from '../test/finances';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { PLAYER_STORAGE_KEY } from './playerState';
import { selectDate, selectOption } from '../test/selectOption';
afterEach(cleanup);
const stored = () => JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
describe('Calendários em todos os módulos', () => {
  it('salva a data civil da movimentação e filtra o mês sem alterar registros ou armazenamento', () => {
    window.history.replaceState(null, '', '/financas');
    render(<App />);
    expect(
      document.querySelector('input[type="date"], input[type="month"]'),
    ).toBeNull();
    const form = newMovementForm();
    selectOption(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
      'Receita',
    );
    input(form, 'Descrição', 'Registro de outubro');
    input(form, 'Valor (R$)', '10000');
    selectDate(
      within(form).getByRole('combobox', { name: 'Data' }),
      '2026-10-31',
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    expect(stored().records.movements[0]).toMatchObject({
      date: '2026-10-31',
      amountCents: 10000,
    });
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    const history = () => within(movementHistory());
    expect(
      history().queryByText('Registro de outubro'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Mês financeiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'outubro de 2026' }));
    expect(
      screen.getByRole('combobox', { name: 'Mês financeiro' }),
    ).toHaveTextContent('10/2026');
    expect(history().getByText('Registro de outubro')).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
  it('seleciona o dia do treino e o mês do calendário sem perder a marcação real', () => {
    window.history.replaceState(null, '', '/treinos');
    render(<App />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Dia do treino' }));
    expect(
      screen.getByRole('button', { name: '14 de novembro de 2026' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: '12 de novembro de 2026' }),
    );
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
        'button',
        { name: 'Sim' },
      ),
    );
    expect(stored().records.workouts).toEqual([
      { date: '2026-11-12', trained: true },
    ]);
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Mês do calendário' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'outubro de 2026' }));
    expect(
      screen.queryByRole('button', { name: '12/11/2026: treinou' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Mês do calendário' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'novembro de 2026' }));
    expect(
      screen.getByRole('button', { name: '12/11/2026: treinou' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Dia do treino' }),
    ).toHaveTextContent('12/11/2026');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
  it('preserva início, prazo e limites ao registrar progresso retroativo de Quests', () => {
    window.history.replaceState(null, '', '/quests');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha quest' }));
    const form = screen.getByRole('form', { name: 'Criar minha quest' });
    input(form, 'Título da quest', 'Diário de desenho');
    selectDate(
      within(form).getByRole('combobox', { name: 'Data de início' }),
      '2026-11-10',
    );
    selectDate(
      within(form).getByRole('combobox', { name: 'Prazo (opcional)' }),
      '2026-11-12',
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Confirmar criação da quest' }),
    );
    expect(stored().goals.items[0]).toMatchObject({
      startDate: '2026-11-10',
      deadline: '2026-11-12',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Atualizar progresso' }),
    );
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Data do progresso' }),
    );
    expect(
      screen.getByRole('button', { name: '9 de novembro de 2026' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '13 de novembro de 2026' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hoje' })).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: '11 de novembro de 2026' }),
    );
    const progress = screen.getByRole('form', {
      name: 'Atualizar progresso de Diário de desenho',
    });
    input(progress, 'Progresso total do ciclo (vezes)', '3');
    fireEvent.click(
      within(progress).getByRole('button', { name: 'Salvar progresso' }),
    );
    expect(stored().goals.updates[0]).toMatchObject({
      date: '2026-11-11',
      value: 3000,
    });
    expect(stored().records.workouts).toEqual([]);
    expect(stored().records.movements).toEqual([]);
    expect(
      document.querySelector('input[type="date"], input[type="month"]'),
    ).toBeNull();
  });
});
