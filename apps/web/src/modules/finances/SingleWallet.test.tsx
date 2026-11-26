import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import {
  checksum,
  createBackupFile,
  parseBackupFile,
  type BackupFileV1,
} from '../../app/backupFile';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { confirmDeletion, movementHistory } from '../../test/finances';
import { scorePeriod } from '../evolution/scoring';
import { indexActivities } from '../statistics/aggregation';
import { applyRecordCommand } from '../records/commands';
import { projectEffortActivities, recordReward } from '../records/progression';
import { emptyRecords, type LifeRecords } from '../records/types';
import { money, monthlyBalance } from './calculations';
import { accountBalance, cashAccounts, financialSummary } from './ledger';
import { emptyLedger, type MoneyMovement } from './types';

/**
 * Carteira interna única: dados sintéticos de usuário novo e de registros
 * anteriores à remoção do gerenciamento de contas.
 */
afterEach(cleanup);
const today = '2026-11-13';

const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function save(state: PlayerState) {
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
}
function open() {
  window.history.replaceState(null, '', '/financas');
  return render(<App />);
}
function figure(label: string) {
  const overview = screen.getByRole('region', {
    name: 'Visão geral financeira',
  });
  return within(overview).getByText(label).nextElementSibling?.textContent;
}
function fill(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
function add(kind: 'receita' | 'despesa', description: string, cents: string) {
  fireEvent.click(
    screen.getByRole('button', {
      name: kind === 'receita' ? 'Adicionar receita' : 'Adicionar despesa',
    }),
  );
  const form = screen.getByRole('form', { name: 'Nova movimentação' });
  fill(form, 'Descrição', description);
  fill(form, 'Valor (R$)', cents);
  fireEvent.click(
    within(form).getByRole('button', { name: 'Adicionar movimentação' }),
  );
}
/** Usuário com registros criados antes da carteira única. */
function legacyState() {
  const state = createInitialPlayerState();
  state.records.finance = {
    ...emptyLedger(),
    accounts: [
      {
        id: 'principal',
        name: 'Conta antiga',
        initialCents: 50000,
        date: '2026-10-01',
      },
    ],
  };
  state.records.movements = [
    {
      id: 'legacy-income',
      kind: 'income',
      description: 'Salário antigo',
      category: 'Trabalho',
      amountCents: 200000,
      date: '2026-11-05',
    },
    {
      id: 'legacy-expense',
      kind: 'expense',
      description: 'Aluguel antigo',
      category: 'Casa',
      amountCents: 80000,
      date: '2026-11-06',
      accountId: 'principal',
    },
  ];
  state.records.investments = [
    { id: 'fixed', name: 'Tesouro sintético', category: 'Renda fixa' },
  ];
  state.records.investmentEntries = [
    {
      id: 'fixed-buy',
      investmentId: 'fixed',
      kind: 'contribution',
      amountCents: 30000,
      quantity: 3,
      purchasePriceCents: 10000,
      date: '2026-11-07',
    },
  ];
  return state;
}

describe('Carteira interna única: usuário novo', () => {
  it('registra receita e despesa imediatamente, sem configurar carteira', () => {
    save(createInitialPlayerState());
    const app = open();
    expect(figure('Saldo disponível')).toBe(money(0));
    for (const name of [/saldo inicial/i, /conta/i, /carteira/i])
      expect(screen.queryByRole('form', { name })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Conta' }),
    ).not.toBeInTheDocument();
    // Um clique abre o formulário com o tipo escolhido e o foco no início.
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar receita' }));
    const form = screen.getByRole('form', { name: 'Nova movimentação' });
    const kind = within(form).getByRole('combobox', {
      name: 'Tipo de movimentação',
    });
    expect(kind).toHaveTextContent('Receita');
    expect(kind).toHaveFocus();
    expect(
      within(form).queryByRole('combobox', { name: 'Conta' }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    add('receita', 'Projeto', '500000');
    expect(figure('Saldo disponível')).toBe(money(500000));
    expect(figure('Receitas do mês')).toBe(money(500000));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar despesa' }));
    expect(
      within(screen.getByRole('form', { name: 'Nova movimentação' })).getByRole(
        'combobox',
        { name: 'Tipo de movimentação' },
      ),
    ).toHaveTextContent('Despesa');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    add('despesa', 'Mercado', '120000');
    expect(figure('Saldo disponível')).toBe(money(380000));
    expect(figure('Despesas do mês')).toBe(money(120000));
    expect(figure('Resultado mensal')).toBe(money(380000));
    const records = stored().records;
    expect(records.movements).toHaveLength(2);
    for (const item of records.movements) {
      expect(item).not.toHaveProperty('accountId');
      expect(item.date).toBe(today);
    }
    // A carteira é implícita: nenhum registro de conta é gravado.
    expect(records.finance?.accounts ?? []).toEqual([]);
    app.unmount();
    open();
    expect(figure('Saldo disponível')).toBe(money(380000));
    expect(stored().records.finance?.accounts ?? []).toEqual([]);
    expect(stored().records.movements).toHaveLength(2);
  });

  it('edita receita e despesa e exclui movimentação recalculando o saldo', () => {
    save(createInitialPlayerState());
    open();
    add('receita', 'Bônus', '100000');
    add('despesa', 'Luz', '20000');
    movementHistory();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Bônus' }));
    let form = screen.getByRole('form', { name: 'Editar movimentação' });
    fill(form, 'Valor (R$)', '150000');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar movimentação' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar Luz' }));
    form = screen.getByRole('form', { name: 'Editar movimentação' });
    fill(form, 'Descrição', 'Energia');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar movimentação' }),
    );
    const ids = stored().records.movements.map((item) => item.id);
    expect(stored().records.movements).toMatchObject([
      { kind: 'income', amountCents: 150000, description: 'Bônus' },
      { kind: 'expense', amountCents: 20000, description: 'Energia' },
    ]);
    expect(figure('Saldo disponível')).toBe(money(130000));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Energia' }));
    confirmDeletion();
    expect(stored().records.movements.map((item) => item.id)).toEqual([ids[0]]);
    expect(figure('Saldo disponível')).toBe(money(150000));
    expect(figure('Despesas do mês')).toBe(money(0));
  });
});

describe('Carteira interna única: registros anteriores', () => {
  it('preserva IDs, conta, saldos e investimentos ao registrar novas movimentações', () => {
    const state = legacyState();
    save(state);
    const app = open();
    // 500 + 2.000 − 800 − 300 (aporte); o investimento fica fora do saldo.
    expect(figure('Saldo disponível')).toBe(money(140000));
    expect(stored().records).toEqual(state.records);
    add('despesa', 'Farmácia', '5000');
    const records = stored().records;
    expect(records.finance).toEqual(state.records.finance);
    expect(records.investments).toEqual(state.records.investments);
    expect(records.investmentEntries).toEqual(state.records.investmentEntries);
    expect(records.movements.slice(0, 2)).toEqual(state.records.movements);
    expect(records.movements[2]).not.toHaveProperty('accountId');
    expect(financialSummary(records, today)).toMatchObject({
      cash: 135000,
      investments: 30000,
    });
    expect(figure('Saldo disponível')).toBe(money(135000));
    app.unmount();
    open();
    expect(figure('Saldo disponível')).toBe(money(135000));
    expect(stored().records.finance?.accounts).toHaveLength(1);
  });

  it('mantém a abertura antiga sem duplicar a carteira nem incluir registros anteriores a ela', () => {
    const records: LifeRecords = {
      ...legacyState().records,
      movements: [
        {
          id: 'before-opening',
          kind: 'income',
          description: 'Já incluída na abertura',
          category: 'Geral',
          amountCents: 99900,
          date: '2026-09-30',
        },
      ],
      investmentEntries: [],
    };
    const ledger = records.finance!;
    expect(cashAccounts(ledger)).toBe(ledger.accounts);
    expect(accountBalance(records, 'principal', today)).toBe(50000);
    expect(financialSummary(records, today).cash).toBe(50000);
  });

  it('soma contas legadas e transferências sem consolidar nem alterar registros', () => {
    const records: LifeRecords = {
      ...emptyRecords(),
      finance: {
        ...emptyLedger(),
        accounts: [
          { id: 'principal', name: 'A', initialCents: 10000, date: today },
          { id: 'b', name: 'B', initialCents: 5000, date: today },
        ],
        transfers: [
          {
            id: 't',
            fromId: 'principal',
            toId: 'b',
            amountCents: 2000,
            date: today,
          },
        ],
      },
    };
    const snapshot = structuredClone(records);
    expect(financialSummary(records, today).cash).toBe(15000);
    expect(accountBalance(records, 'b', today)).toBe(7000);
    expect(records).toEqual(snapshot);
  });

  it('usa a carteira implícita quando há registros sem conta e nenhuma abertura', () => {
    const ledger = emptyLedger();
    expect(cashAccounts(ledger)).toEqual([
      { id: 'principal', name: 'Carteira', initialCents: 0, date: '' },
    ]);
    // A lista persistida não é alterada.
    expect(ledger.accounts).toEqual([]);
    const records: LifeRecords = {
      ...emptyRecords(),
      movements: [
        {
          id: 'm',
          kind: 'expense',
          description: 'Sem conta',
          category: 'Geral',
          amountCents: 1500,
          date: '2020-01-01',
        },
      ],
    };
    expect(financialSummary(records, today)).toMatchObject({
      cash: -1500,
      wealth: -1500,
    });
  });
});

describe('Carteira interna única: integrações', () => {
  const movement = (
    id: string,
    kind: MoneyMovement['kind'],
    amountCents: number,
  ): MoneyMovement => ({
    id,
    kind,
    description: id,
    category: 'Geral',
    amountCents,
    date: today,
  });

  it('atualiza estatísticas, XP e Radar pelos mecanismos existentes', () => {
    const before = emptyRecords();
    let records = applyRecordCommand(
      before,
      { type: 'saveMovement', value: movement('in', 'income', 70000) },
      today,
    );
    records = applyRecordCommand(
      records,
      { type: 'saveMovement', value: movement('out', 'expense', 20000) },
      today,
    );
    expect(monthlyBalance(records.movements, today.slice(0, 7))).toEqual({
      income: 70000,
      expense: 20000,
      balance: 50000,
    });
    expect(financialSummary(records, today).cash).toBe(50000);
    const day = indexActivities(records).get(today);
    expect(day?.pillars['Finanças'].details).toHaveLength(2);
    expect(recordReward(records, [], today)).toBeGreaterThan(
      recordReward(before, [], today),
    );
    const radar = (value: LifeRecords) =>
      scorePeriod(projectEffortActivities([], [], value, today), 7);
    expect(radar(records)).not.toEqual(radar(before));
  });

  it('exporta e restaura backups sem perder a carteira nem os vínculos antigos', () => {
    const state = legacyState();
    const canonical = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    const file = createBackupFile(canonical, new Date(2026, 10, 13, 9));
    const restored = parseBackupFile(file.content);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.data.records).toEqual(state.records);
    expect(financialSummary(restored.data.records, today).cash).toBe(140000);
    // Backup antigo (payload v4, antes de `character`).
    const old: BackupFileV1 = JSON.parse(file.content);
    const v4: Partial<PlayerState> = structuredClone(state);
    delete v4.character;
    old.payload = { version: 4, data: v4 };
    old.integrity.value = checksum(JSON.stringify(old.payload));
    const migrated = parseBackupFile(JSON.stringify(old));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.data.records.finance).toEqual(state.records.finance);
    expect(migrated.data.records.movements).toEqual(state.records.movements);
    expect(financialSummary(migrated.data.records, today).cash).toBe(140000);
  });
});
