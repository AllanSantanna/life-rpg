import { describe, expect, it } from 'vitest';
import { createBackupFile, parseBackupFile } from '../../app/backupFile';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { applyRecordCommand } from '../records/commands';
import { recordReward } from '../records/progression';
import { emptyRecords, type LifeRecords } from '../records/types';
import { budgetProgress } from './budget';
import { monthlyBalance } from './calculations';
import { wealthChartModel } from './chartModel';
import { entryFromForm } from './financeForms';
import { financialHistory, financialSummary, investmentValue } from './ledger';
import type { InvestmentEntry } from './types';
import { movesWallet, walletOperations, walletShortfall } from './walletLink';

/** Dados sintéticos; nenhuma informação pessoal real. */
const today = '2026-11-26';
type Command = Parameters<typeof applyRecordCommand>[1];
const apply = (records: LifeRecords, ...commands: Command[]) =>
  commands.reduce(
    (state, command) => applyRecordCommand(state, command, today),
    records,
  );

/** Carteira com R$ 1.000 e investimento de R$ 2.000 já existente. */
function base(): LifeRecords {
  return apply(
    emptyRecords(),
    {
      type: 'saveMovement',
      value: {
        id: 'salario',
        kind: 'income',
        description: 'Salário',
        amountCents: 100000,
        category: 'Salário',
        date: '2026-11-01',
      },
    },
    {
      type: 'saveInvestment',
      value: { id: 'cdb', name: 'CDB', category: 'Renda fixa' },
      initialEntry: {
        id: 'inicial',
        investmentId: 'cdb',
        kind: 'contribution',
        amountCents: 200000,
        date: '2026-10-01',
        positionInitial: true,
      },
    },
  );
}
const entry = (overrides: Partial<InvestmentEntry> = {}): InvestmentEntry => ({
  id: 'aporte',
  investmentId: 'cdb',
  kind: 'contribution',
  amountCents: 20000,
  date: '2026-11-10',
  positionInitial: false,
  walletLinked: true,
  ...overrides,
});
/** Registro anterior às novas funcionalidades: sem `walletLinked`. */
function legacyEntry(overrides: Partial<InvestmentEntry> = {}) {
  const value = entry(overrides);
  delete value.walletLinked;
  return value;
}
const save = (records: LifeRecords, value: InvestmentEntry) =>
  apply(records, { type: 'saveInvestmentEntry', value });

describe('integração Carteira–Investimentos', () => {
  it('aporte vinculado transfere da Carteira sem mudar o patrimônio', () => {
    const before = financialSummary(base(), today);
    expect(before).toMatchObject({
      cash: 100000,
      investments: 200000,
      wealth: 300000,
    });
    const records = save(base(), entry());
    const after = financialSummary(records, today);
    expect(after).toMatchObject({
      cash: 80000,
      investments: 220000,
      wealth: 300000,
    });
    expect(investmentValue(records, 'cdb', today)).toMatchObject({
      cost: 220000,
      contributed: 20000,
    });
    // Não é despesa mensal, não consome orçamento.
    expect(monthlyBalance(records.movements, '2026-11')).toEqual({
      income: 100000,
      expense: 0,
      balance: 100000,
    });
    const budgets = apply(records, {
      type: 'setBudget',
      id: 'b',
      category: 'Investimentos',
      limitCents: 1000,
      month: '2026-11',
    }).finance!.budgets!;
    expect(
      budgetProgress(budgets, records.movements, '2026-11')[0]!.spentCents,
    ).toBe(0);
  });

  it('aporte desvinculado usa dinheiro externo e não mexe na Carteira', () => {
    const records = save(base(), entry({ walletLinked: false }));
    expect(financialSummary(records, today)).toMatchObject({
      cash: 100000,
      investments: 220000,
      wealth: 320000,
    });
    expect(walletOperations(records)).toEqual([]);
  });

  it('registros anteriores mantêm a regra histórica e permanecem intactos', () => {
    const legacy = legacyEntry();
    const records = save(base(), legacy);
    expect(
      records.investmentEntries.find((item) => item.id === 'aporte'),
    ).toEqual(legacy);
    expect(movesWallet(legacy)).toBe(true);
    expect(financialSummary(records, today).cash).toBe(80000);
    // Sem saldo, o registro antigo segue a política anterior (saldo negativo).
    expect(
      walletShortfall(records, { ...legacy, amountCents: 999999 }, today),
    ).toBeNull();
    // Editar mantendo a Carteira ligada não acrescenta o campo ao registro.
    const form = new FormData();
    form.set('kind', 'contribution');
    form.set('positionType', 'purchase');
    form.set('amount', '200.00');
    form.set('date', '2026-11-10');
    form.set('walletChoice', '1');
    form.set('walletLegacy', '1');
    form.set('wallet', 'on');
    expect(
      entryFromForm(form, 'aporte', 'cdb', 'Renda fixa', today),
    ).not.toHaveProperty('walletLinked');
    form.delete('wallet');
    expect(
      entryFromForm(form, 'aporte', 'cdb', 'Renda fixa', today),
    ).toMatchObject({
      walletLinked: false,
    });
  });

  it('retirada vinculada credita a Carteira sem virar receita', () => {
    const records = save(
      base(),
      entry({ id: 'resgate', kind: 'withdrawal', amountCents: 30000 }),
    );
    expect(financialSummary(records, today)).toMatchObject({
      cash: 130000,
      investments: 170000,
      wealth: 300000,
    });
    expect(monthlyBalance(records.movements, '2026-11').income).toBe(100000);
    const external = save(
      base(),
      entry({
        id: 'resgate',
        kind: 'withdrawal',
        amountCents: 30000,
        walletLinked: false,
      }),
    );
    expect(financialSummary(external, today)).toMatchObject({
      cash: 100000,
      wealth: 270000,
    });
  });

  it('separa o valor recebido do custo baixado na retirada', () => {
    const records = save(
      base(),
      entry({
        id: 'resgate',
        kind: 'withdrawal',
        amountCents: 31000,
        costBasisCents: 30000,
      }),
    );
    expect(financialSummary(records, today).cash).toBe(131000);
    expect(investmentValue(records, 'cdb', today).cost).toBe(170000);
  });

  it('não gera XP de receita/despesa nem duplica a atividade do dia', () => {
    const linked = save(base(), entry({ date: '2026-11-20' }));
    const legacy = save(base(), legacyEntry({ date: '2026-11-20' }));
    // Uma operação real = um dia de atividade financeira (regra existente).
    expect(recordReward(linked, [], today)).toBe(
      recordReward(legacy, [], today),
    );
    expect(
      recordReward(linked, [], today) - recordReward(base(), [], today),
    ).toBe(80);
    const sameDay = save(
      linked,
      entry({ id: 'aporte2', date: '2026-11-20', amountCents: 100 }),
    );
    expect(recordReward(sameDay, [], today)).toBe(
      recordReward(linked, [], today),
    );
  });

  it('recusa integralmente aporte vinculado sem saldo suficiente', () => {
    const records = base();
    expect(() => save(records, entry({ amountCents: 100001 }))).toThrow(
      'Saldo insuficiente na Carteira',
    );
    // Nada foi gravado: o estado anterior continua igual.
    expect(records.investmentEntries).toHaveLength(1);
    // Saldo exatamente suficiente é aceito.
    expect(
      financialSummary(save(records, entry({ amountCents: 100000 })), today)
        .cash,
    ).toBe(0);
    // Aporte retroativo não pode usar dinheiro que só entrou depois.
    expect(() => save(records, entry({ date: '2026-10-15' }))).toThrow(
      'Saldo insuficiente',
    );
    // Nem consumir um saldo que foi gasto depois da data do aporte.
    const spent = apply(records, {
      type: 'saveMovement',
      value: {
        id: 'gasto',
        kind: 'expense',
        description: 'Gasto',
        amountCents: 90000,
        category: 'Geral',
        date: '2026-11-20',
      },
    });
    expect(() => save(spent, entry({ amountCents: 20000 }))).toThrow(
      'considerando 20/11/2026',
    );
    // O cadastro de investimento com compra vinculada segue a mesma regra.
    expect(() =>
      apply(records, {
        type: 'saveInvestment',
        value: { id: 'btc', name: 'BTC', category: 'Bitcoin' },
        initialEntry: {
          id: 'btc1',
          investmentId: 'btc',
          kind: 'contribution',
          amountCents: 500000,
          quantity: 0.01,
          date: '2026-11-10',
          positionInitial: false,
          walletLinked: true,
        },
      }),
    ).toThrow('Saldo insuficiente');
  });

  it('edição e exclusão atualizam os dois lados juntos (mesmo registro)', () => {
    let records = save(base(), entry());
    records = save(records, entry({ amountCents: 50000 }));
    expect(
      records.investmentEntries.filter((item) => item.id === 'aporte'),
    ).toHaveLength(1);
    expect(financialSummary(records, today)).toMatchObject({
      cash: 50000,
      investments: 250000,
      wealth: 300000,
    });
    expect(walletOperations(records)).toEqual([
      expect.objectContaining({ id: 'aporte', amountCents: 50000 }),
    ]);
    // Editar sem saldo suficiente é recusado sem perder a versão anterior.
    expect(() => save(records, entry({ amountCents: 100001 }))).toThrow();
    // Reduzir o próprio aporte é sempre possível.
    expect(
      financialSummary(save(records, entry({ amountCents: 1000 })), today).cash,
    ).toBe(99000);
    records = apply(records, { type: 'deleteInvestmentEntry', id: 'aporte' });
    expect(financialSummary(records, today)).toMatchObject({
      cash: 100000,
      investments: 200000,
    });
    expect(walletOperations(records)).toEqual([]);
  });

  it('clique duplo e reenvio não duplicam a operação', () => {
    const once = save(base(), entry());
    const twice = save(once, entry());
    expect(twice.investmentEntries).toEqual(once.investmentEntries);
    expect(financialSummary(twice, today).cash).toBe(80000);
  });

  it('falha de validação não deixa operação parcial', () => {
    const records = save(base(), entry());
    // Retirada acima da posição: comando inteiro recusado.
    expect(() =>
      save(
        records,
        entry({ id: 'excesso', kind: 'withdrawal', amountCents: 9999999 }),
      ),
    ).toThrow();
    expect(financialSummary(records, today).cash).toBe(80000);
    // Combinação inválida (posição inicial vinculada) também é recusada.
    expect(() =>
      save(
        records,
        entry({ id: 'x', positionInitial: true, walletLinked: true }),
      ),
    ).toThrow();
  });

  it('atualiza histórico e gráficos sem crescimento artificial', () => {
    const records = save(base(), entry());
    const history = financialHistory(records, today);
    const day = history.find((item) => item.date === '2026-11-10')!;
    expect(day).toMatchObject({ cash: 80000, wealth: 300000 });
    const wealth = wealthChartModel(records, today, 365, 'wealth');
    expect(wealth.points.at(-1)?.value).toBe(300000);
    expect(wealth.currentValue).toBe(300000);
    const cash = wealthChartModel(records, today, 365, 'cash');
    expect(cash.currentValue).toBe(80000);
  });

  it('trata valores fracionários em inteiros, sem erro de ponto flutuante', () => {
    let records = apply(base(), {
      type: 'saveInvestment',
      value: { id: 'acao', name: 'Ação', category: 'Ações' },
    });
    // 0,1 + 0,2 em reais e 3 × R$ 33,33 sem resíduos.
    records = save(
      records,
      entry({ id: 'f1', investmentId: 'acao', amountCents: 10 }),
    );
    records = save(
      records,
      entry({ id: 'f2', investmentId: 'acao', amountCents: 20 }),
    );
    expect(financialSummary(records, today).cash).toBe(99970);
    records = save(
      records,
      entry({
        id: 'f3',
        investmentId: 'acao',
        amountCents: 9999,
        quantity: 3,
        purchasePriceCents: 3333,
      }),
    );
    expect(financialSummary(records, today).cash).toBe(89971);
    // Quantidade fracionária de BTC com compra vinculada.
    records = apply(records, {
      type: 'saveInvestment',
      value: { id: 'btc', name: 'BTC', category: 'Bitcoin' },
      initialEntry: {
        id: 'b1',
        investmentId: 'btc',
        kind: 'contribution',
        amountCents: 33333,
        quantity: 0.00061258,
        date: '2026-11-12',
        positionInitial: false,
        walletLinked: true,
      },
    });
    expect(financialSummary(records, today).cash).toBe(56638);
    expect(Number.isSafeInteger(financialSummary(records, today).cash)).toBe(
      true,
    );
  });

  it('backup e restauração preservam vínculos, recorrências e orçamentos', () => {
    const state = createInitialPlayerState();
    state.records = apply(
      save(base(), entry()),
      {
        type: 'saveRecurrence',
        rule: {
          id: 'r1',
          kind: 'expense',
          description: 'Internet',
          amountCents: 12000,
          category: 'Contas',
          frequency: 'monthly',
          startDate: '2026-11-05',
          status: 'active',
        },
      },
      {
        type: 'setBudget',
        id: 'b1',
        category: 'Contas',
        limitCents: 50000,
        month: '2026-11',
      },
    );
    const canonical = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    const file = createBackupFile(canonical, new Date(2026, 10, 26, 9));
    const restored = parseBackupFile(file.content);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.data.records).toEqual(state.records);
    expect(financialSummary(restored.data.records, today).cash).toBe(80000);
    // Recarregar (novo parse) conserva os resultados.
    const again = parseBackupFile(file.content);
    expect(again.ok && again.data.records).toEqual(state.records);
  });

  it('backup anterior às novas funcionalidades continua restaurável', () => {
    const state = createInitialPlayerState();
    state.records = save(base(), legacyEntry());
    const canonical = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    const file = createBackupFile(canonical, new Date(2026, 10, 26, 9));
    const parsed = JSON.parse(file.content);
    expect(parsed.payload.data.records.finance?.recurrences).toBeUndefined();
    expect(parsed.payload.data.records.finance?.budgets).toBeUndefined();
    const restored = parseBackupFile(file.content);
    expect(restored.ok && restored.data.records).toEqual(state.records);
    expect(
      restored.ok && financialSummary(restored.data.records, today).cash,
    ).toBe(80000);
  });
});
