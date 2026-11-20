import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { investmentCard } from '../../test/finances';
import { emptyLedger, type InvestmentEntry } from './types';

afterEach(cleanup);
const stored = () =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data.records;

/** Venda de ações gravada por versão anterior, com custo resgatado informado. */
function seedLegacySale() {
  const state = createInitialPlayerState();
  const base = {
    investmentId: 'vale',
    positionInitial: false,
    accountId: 'principal',
  };
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta',
        initialCents: 100000,
        date: '2026-01-01',
      },
    ],
  };
  state.records.investments = [{ id: 'vale', name: 'Vale', category: 'Ações' }];
  state.records.investmentEntries = [
    {
      ...base,
      id: 'c',
      kind: 'contribution',
      date: '2026-02-01',
      amountCents: 100000,
      quantity: 10,
    },
    {
      ...base,
      id: 's',
      kind: 'withdrawal',
      date: '2026-03-01',
      amountCents: 120000,
      quantity: 10,
      costBasisCents: 50000,
    },
  ] as InvestmentEntry[];
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
}

describe('diagnóstico de custo de vendas antigas (A-03)', () => {
  it('mostra o custo a revisar sem alterar dados e só recalcula após confirmação', () => {
    seedLegacySale();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    render(<App />);
    const card = investmentCard('Investimento Vale');
    const note = within(card).getByRole('note');
    expect(note).toHaveTextContent(/uma venda com quantidade/);
    expect(note).toHaveTextContent(/quantidade zero/);
    expect(note).toHaveTextContent(/Nada foi alterado automaticamente/);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    const trigger = within(note).getByRole('button', {
      name: 'Recalcular custo de Vale pelo preço médio',
    });
    fireEvent.click(trigger);
    fireEvent.click(within(note).getByRole('button', { name: 'Cancelar' }));
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
    fireEvent.click(
      within(note).getByRole('button', {
        name: 'Recalcular custo de Vale pelo preço médio',
      }),
    );
    fireEvent.click(
      within(note).getByRole('button', { name: 'Recalcular custo' }),
    );
    const sale = stored().investmentEntries.find(
      (item: InvestmentEntry) => item.id === 's',
    );
    expect(sale).not.toHaveProperty('costBasisCents');
    expect(sale).toMatchObject({
      amountCents: 120000,
      quantity: 10,
      date: '2026-03-01',
    });
    expect(
      within(investmentCard('Investimento Vale')).queryByRole('note'),
    ).toBeNull();
  });
});
