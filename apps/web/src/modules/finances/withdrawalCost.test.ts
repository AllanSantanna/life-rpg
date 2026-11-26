import { describe, expect, it } from 'vitest';
import { createBackupFile, parseBackupFile } from '../../app/backupFile';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { FieldError } from '../records/form';
import { applyRecordCommand } from '../records/commands';
import { recordReward } from '../records/progression';
import { emptyRecords, type LifeRecords } from '../records/types';
import { monthlyBalance } from './calculations';
import { entryFromForm } from './financeForms';
import { financialSummary, investmentValue, valuationBasis } from './ledger';
import type { InvestmentEntry } from './types';

/** Resgates sem custo informado. Dados sintéticos; nenhum dado real. */
const today = '2026-11-26';
type Command = Parameters<typeof applyRecordCommand>[1];
const apply = (records: LifeRecords, ...commands: Command[]) =>
  commands.reduce(
    (state, command) => applyRecordCommand(state, command, today),
    records,
  );
const income = (cents: number): Command => ({
  type: 'saveMovement',
  value: {
    id: 'salario',
    kind: 'income',
    description: 'Salário',
    amountCents: cents,
    category: 'Salário',
    date: '2026-11-01',
  },
});
/** Caixinha com custo `cost` e saldo informado pelo banco `balance`. */
function box(cost: number, balance?: number): LifeRecords {
  let records = apply(emptyRecords(), income(100000), {
    type: 'saveInvestment',
    value: { id: 'cx', name: 'Reserva', category: 'Caixinhas bancárias' },
    initialEntry: {
      id: 'cx-inicial',
      investmentId: 'cx',
      kind: 'contribution',
      amountCents: cost,
      date: '2026-10-01',
      positionInitial: true,
    },
  });
  if (balance !== undefined)
    records = apply(records, {
      type: 'saveValuation',
      value: {
        id: 'cx-saldo',
        investmentId: 'cx',
        amountCents: balance,
        date: '2026-11-02',
        movementsComplete: true,
        basis: valuationBasis(records.investmentEntries, 'cx', '2026-11-02'),
      },
    });
  return records;
}
const withdrawal = (
  amountCents: number,
  overrides: Partial<InvestmentEntry> = {},
): InvestmentEntry => ({
  id: 'resgate',
  investmentId: 'cx',
  kind: 'withdrawal',
  amountCents,
  date: '2026-11-10',
  walletLinked: true,
  ...overrides,
});
const redeem = (records: LifeRecords, value: InvestmentEntry) =>
  apply(records, { type: 'saveInvestmentEntry', value });
const balanceOf = (records: LifeRecords, id = 'cx') =>
  investmentValue(records, id, today).current;

describe('resgate informando só o valor', () => {
  it('o formulário não lê custo de aquisição resgatado', () => {
    const form = new FormData();
    form.set('kind', 'withdrawal');
    form.set('amount', '100.00');
    form.set('date', '2026-11-10');
    form.set('costBasis', '50.00');
    const entry = entryFromForm(form, 'r', 'cx', 'Caixinhas bancárias', today);
    expect(entry).not.toHaveProperty('costBasisCents');
    expect(entry.amountCents).toBe(10000);
  });

  it('recusa valores monetários inválidos', () => {
    for (const amount of ['12,345', 'abc', '-10', '']) {
      const form = new FormData();
      form.set('kind', 'withdrawal');
      form.set('amount', amount);
      form.set('date', '2026-11-10');
      expect(() =>
        entryFromForm(form, 'r', 'cx', 'Caixinhas bancárias', today),
      ).toThrow(FieldError);
    }
    expect(() => redeem(box(50000), withdrawal(0))).toThrow();
  });

  it.each([
    [71312, 70000, 10000, 61312],
    [50000, 50000, 5025, 44975],
    [100000, 100000, 10001, 89999],
  ])(
    'caixinha com saldo %i e custo %i: resgate de %i deixa exatamente %i',
    (balance, cost, amount, expected) => {
      const records = redeem(box(cost, balance), withdrawal(amount));
      expect(balanceOf(records)).toBe(expected);
      // Carteira recebe exatamente o valor resgatado.
      expect(financialSummary(records, today).cash).toBe(100000 + amount);
      const saved = records.investmentEntries.find(
        (item) => item.id === 'resgate',
      )!;
      expect(saved.amountCents).toBe(amount);
    },
  );

  it('resgate integral zera o saldo e todo o custo', () => {
    const records = redeem(box(70000, 71312), withdrawal(71312));
    expect(investmentValue(records, 'cx', today)).toMatchObject({
      current: 0,
      cost: 0,
    });
    // Acima do custo: todo o custo restante é baixado e o excedente é
    // rendimento; o valor resgatado não muda.
    expect(
      records.investmentEntries.find((item) => item.id === 'resgate'),
    ).toMatchObject({ amountCents: 71312, costBasisCents: 70000 });
  });

  it('recusa resgate acima do saldo registrado, sem salvar nada', () => {
    const records = box(70000, 71312);
    expect(() => redeem(records, withdrawal(71313))).toThrow(
      'maior que o saldo registrado de R$\u00a0713,12',
    );
    // Sem saldo informado, o saldo registrado é o custo.
    const noBalance = box(70000);
    expect(() => redeem(noBalance, withdrawal(70001))).toThrow(
      /atualize o saldo ou a avaliação/,
    );
    expect(noBalance.investmentEntries).toHaveLength(1);
  });

  it('custo interno segue principal primeiro e preserva o rendimento', () => {
    const partial = redeem(box(70000, 71312), withdrawal(10000));
    expect(
      partial.investmentEntries.find((item) => item.id === 'resgate'),
    ).not.toHaveProperty('costBasisCents');
    expect(investmentValue(partial, 'cx', today)).toMatchObject({
      cost: 60000,
      current: 61312,
      gain: 1312,
      withdrawn: 10000,
    });
    // Renda fixa sem avaliação: saldo = custo, reduzido exatamente.
    const fixed = apply(emptyRecords(), {
      type: 'saveInvestment',
      value: { id: 'rf', name: 'CDB', category: 'Renda fixa' },
      initialEntry: {
        id: 'rf1',
        investmentId: 'rf',
        kind: 'contribution',
        amountCents: 100000,
        date: '2026-10-01',
        positionInitial: true,
      },
    });
    const after = redeem(
      fixed,
      withdrawal(10001, { investmentId: 'rf', walletLinked: false }),
    );
    expect(balanceOf(after, 'rf')).toBe(89999);
    expect(investmentValue(after, 'rf', today).cost).toBe(89999);
  });

  it('com dinheiro externo, o saldo da Carteira não muda e o patrimônio cai', () => {
    const before = box(70000, 71312);
    const records = redeem(before, withdrawal(10000, { walletLinked: false }));
    expect(financialSummary(records, today).cash).toBe(
      financialSummary(before, today).cash,
    );
    expect(financialSummary(records, today).wealth).toBe(
      financialSummary(before, today).wealth! - 10000,
    );
  });

  it('não vira receita, não duplica e não altera XP além da regra existente', () => {
    const before = box(70000, 71312);
    const once = redeem(before, withdrawal(10000));
    const twice = redeem(once, withdrawal(10000));
    expect(twice.investmentEntries).toEqual(once.investmentEntries);
    expect(monthlyBalance(once.movements, '2026-11').income).toBe(100000);
    // Um dia de atividade financeira a mais, como qualquer resgate antes.
    expect(
      recordReward(once, [], today) - recordReward(before, [], today),
    ).toBe(80);
  });

  it('edição e exclusão continuam funcionando', () => {
    let records = redeem(box(70000, 71312), withdrawal(10000));
    records = redeem(records, withdrawal(20000));
    expect(balanceOf(records)).toBe(51312);
    records = apply(records, { type: 'deleteInvestmentEntry', id: 'resgate' });
    expect(balanceOf(records)).toBe(71312);
  });

  it('preserva custos antigos gravados e registros sem custo', () => {
    const legacy = withdrawal(30000, { costBasisCents: 25000 });
    delete legacy.walletLinked;
    let records = redeem(box(70000), legacy);
    expect(investmentValue(records, 'cx', today).cost).toBe(45000);
    // Editar sem mudar valor nem data mantém o custo antigo.
    const edited: InvestmentEntry = { ...legacy };
    delete edited.costBasisCents;
    records = redeem(records, edited);
    expect(
      records.investmentEntries.find((item) => item.id === 'resgate'),
    ).toMatchObject({ costBasisCents: 25000 });
    // Registro antigo sem custo: mesma regra de antes (custo = valor).
    const plain = redeem(box(70000), withdrawal(30000));
    expect(investmentValue(plain, 'cx', today).cost).toBe(40000);
  });

  it('backups antigos com custo resgatado continuam compatíveis', () => {
    const state = createInitialPlayerState();
    const legacy = withdrawal(30000, { costBasisCents: 25000 });
    delete legacy.walletLinked;
    state.records = redeem(box(70000), legacy);
    const file = createBackupFile(
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
      new Date(2026, 10, 26, 9),
    );
    const restored = parseBackupFile(file.content);
    expect(restored.ok && restored.data.records).toEqual(state.records);
  });

  it('ativos por quantidade mantêm o custo pelo preço médio', () => {
    let records = apply(emptyRecords(), {
      type: 'saveInvestment',
      value: { id: 'btc', name: 'BTC', category: 'Bitcoin' },
      initialEntry: {
        id: 'b1',
        investmentId: 'btc',
        kind: 'contribution',
        amountCents: 30000,
        quantity: 0.003,
        date: '2026-10-01',
        positionInitial: true,
      },
    });
    records = redeem(records, {
      id: 'b2',
      investmentId: 'btc',
      kind: 'withdrawal',
      amountCents: 45000,
      quantity: 0.001,
      date: '2026-11-10',
      walletLinked: false,
    });
    expect(
      records.investmentEntries.find((item) => item.id === 'b2'),
    ).not.toHaveProperty('costBasisCents');
    expect(investmentValue(records, 'btc', today).cost).toBe(20000);
  });
});
