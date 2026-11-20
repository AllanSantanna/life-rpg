import { describe, expect, it } from 'vitest';
import { applyRecordCommand, isLifeRecords } from '../records/commands';
import {
  emptyRecords,
  type LifeRecords,
  type RecordCommand,
} from '../records/types';
import { shareCostIssue, withoutCostBasis } from './costDiagnostics';
import { financialSummary, investmentValue } from './ledger';
import { quantityTimesPriceCents } from './monetary';
import type { InvestmentEntry } from './types';

const today = '2026-11-20';
const base: LifeRecords = {
  ...emptyRecords(),
  finance: {
    accounts: [
      {
        id: 'principal',
        name: 'Conta',
        initialCents: 100000,
        date: '2026-01-01',
      },
      { id: 'reserva', name: 'Reserva', initialCents: 0, date: '2026-06-01' },
    ],
    transfers: [],
    valuations: [],
    quotes: [],
  },
} as LifeRecords;
const apply = (state: LifeRecords, command: RecordCommand) =>
  applyRecordCommand(state, command, today);
const entry = (
  value: Partial<InvestmentEntry> & Pick<InvestmentEntry, 'id' | 'kind'>,
): InvestmentEntry =>
  ({
    investmentId: 'a',
    date: value.kind === 'contribution' ? '2026-02-01' : '2026-03-01',
    positionInitial: false,
    accountId: 'principal',
    amountCents: 0,
    ...value,
  }) as InvestmentEntry;
function withShares(state = base) {
  return apply(state, {
    type: 'saveInvestment',
    value: { id: 'a', name: 'VALE', category: 'Ações' },
    initialEntry: entry({
      id: 'e1',
      kind: 'contribution',
      amountCents: 100000,
      quantity: 10,
    }),
  } as RecordCommand);
}
const reason = (state: LifeRecords, command: RecordCommand) => {
  try {
    apply(state, command);
    return 'aceito';
  } catch (error) {
    return (error as Error).message;
  }
};

describe('A-03: vendas de ações e FIIs pelo preço médio', () => {
  it('nova venda com quantidade recusa custo informado e explica o motivo', () => {
    expect(
      reason(withShares(), {
        type: 'saveInvestmentEntry',
        value: entry({
          id: 'e2',
          kind: 'withdrawal',
          amountCents: 120000,
          quantity: 10,
          costBasisCents: 50000,
        }),
      }),
    ).toMatch(/preço médio/);
  });

  it('venda total zera quantidade e custo; parcial mantém custo pelo preço médio', () => {
    const total = apply(withShares(), {
      type: 'saveInvestmentEntry',
      value: entry({
        id: 'e2',
        kind: 'withdrawal',
        amountCents: 120000,
        quantity: 10,
      }),
    });
    expect(investmentValue(total, 'a', today)).toMatchObject({
      units: 0,
      cost: 0,
    });
    // Sem patrimônio inflado: caixa 100.000 − 100.000 + 120.000.
    expect(financialSummary(total, today)).toMatchObject({
      investments: 0,
      wealth: 120000,
    });
    const partial = apply(withShares(), {
      type: 'saveInvestmentEntry',
      value: entry({
        id: 'e3',
        kind: 'withdrawal',
        amountCents: 60000,
        quantity: 5,
      }),
    });
    expect(investmentValue(partial, 'a', today).cost).toBe(50000);
  });

  it('registro antigo com custo informado não é reinterpretado; o diagnóstico propõe a correção', () => {
    const legacySale = entry({
      id: 'e2',
      kind: 'withdrawal',
      amountCents: 120000,
      quantity: 10,
      costBasisCents: 50000,
    });
    // Gravado por versão anterior: entra direto no estado, sem o comando novo.
    const legacy: LifeRecords = {
      ...withShares(),
      investmentEntries: [...withShares().investmentEntries, legacySale],
    };
    expect(isLifeRecords(legacy)).toBe(true);
    expect(investmentValue(legacy, 'a', today)).toMatchObject({
      units: 0,
      cost: 50000,
    });
    const issue = shareCostIssue('Ações', legacy.investmentEntries);
    expect(issue).toMatchObject({
      currentCost: 50000,
      averageCost: 0,
      units: 0,
    });
    expect(issue?.entries.map((item) => item.id)).toEqual(['e2']);
    // Correção somente por ação explícita, preservando valor, data e quantidade.
    const fixed = apply(legacy, {
      type: 'saveInvestmentEntry',
      value: withoutCostBasis(legacySale),
    });
    const saved = fixed.investmentEntries.find((item) => item.id === 'e2')!;
    expect(saved).toEqual(withoutCostBasis(legacySale));
    expect(saved).not.toHaveProperty('costBasisCents');
    expect(investmentValue(fixed, 'a', today).cost).toBe(0);
    expect(shareCostIssue('Ações', fixed.investmentEntries)).toBeNull();
    // Custo informado igual ao do preço médio não gera alerta; outras classes, nunca.
    const harmless = [
      ...withShares().investmentEntries,
      { ...legacySale, quantity: 5, amountCents: 60000, costBasisCents: 50000 },
    ];
    expect(shareCostIssue('Ações', harmless)).toBeNull();
    expect(shareCostIssue('Renda fixa', legacy.investmentEntries)).toBeNull();
  });
});

describe('B-05: quantidade × preço sem ponto flutuante', () => {
  it('arredonda meio centavo para cima e mantém registros antigos válidos', () => {
    expect(quantityTimesPriceCents(1.005, 100)).toBe(101);
    expect(1.005 * 100).toBeLessThan(100.5); // origem do erro anterior
    expect(quantityTimesPriceCents(2.675, 100)).toBe(268);
    expect(quantityTimesPriceCents(0.00000001, 123456)).toBe(0);
    expect(quantityTimesPriceCents(3, 4999)).toBe(14997);
    const purchase = (amountCents: number) => ({
      ...withShares(),
      investmentEntries: [
        entry({
          id: 'e1',
          kind: 'contribution',
          quantity: 1.005,
          purchasePriceCents: 100,
          amountCents,
        }),
      ],
    });
    expect(isLifeRecords(purchase(101))).toBe(true); // cálculo exato
    expect(isLifeRecords(purchase(100))).toBe(true); // legado aceito
    expect(isLifeRecords(purchase(99))).toBe(false);
  });
});

describe('B-06: cotações sem referência', () => {
  const btc = (id: string, state: LifeRecords) =>
    apply(state, {
      type: 'saveInvestment',
      value: { id, name: id, category: 'Bitcoin' },
      initialEntry: entry({
        id: `${id}-1`,
        investmentId: id,
        kind: 'contribution',
        amountCents: 20000,
        quantity: 0.002,
      }),
    } as RecordCommand);
  const quote = {
    priceCents: 50000000,
    updatedAt: Date.parse('2026-11-19T10:00:00Z'),
    observedAt: Date.parse('2026-11-19T10:00:00Z'),
  };
  it('mantém a cotação enquanto houver BTC e a remove com o último', () => {
    let state = btc('b', btc('a', base));
    state = apply(state, { type: 'saveQuote', value: quote } as RecordCommand);
    state = apply(state, {
      type: 'deleteInvestment',
      id: 'a',
    } as RecordCommand);
    expect(state.finance!.quotes).toHaveLength(1);
    state = apply(state, {
      type: 'deleteInvestment',
      id: 'b',
    } as RecordCommand);
    expect(state.finance!.quotes).toEqual([]);
  });
  it('remove a cotação USD só ao excluir a última posição USD', () => {
    let state = apply(base, {
      type: 'saveInvestment',
      value: { id: 'u', name: 'USD', category: 'Dólar (USD)' },
      initialEntry: entry({
        id: 'u1',
        investmentId: 'u',
        kind: 'contribution',
        amountCents: 52000,
        quantity: 100,
      }),
    } as RecordCommand);
    state = apply(state, {
      type: 'saveUsdQuote',
      value: {
        rateUnits: 52000,
        updatedAt: quote.updatedAt,
        observedAt: quote.observedAt,
      },
    } as RecordCommand);
    state = btc('b', state);
    state = apply(state, {
      type: 'deleteInvestment',
      id: 'b',
    } as RecordCommand);
    expect(state.finance!.usdQuotes).toHaveLength(1);
    state = apply(state, {
      type: 'deleteInvestment',
      id: 'u',
    } as RecordCommand);
    expect(state.finance!.usdQuotes).toEqual([]);
  });
});

describe('B-08: motivo específico das recusas', () => {
  it('identifica transferência inválida, venda acima da posição e resgate com rendimento', () => {
    expect(
      reason(base, {
        type: 'saveTransfer',
        value: {
          id: 't',
          fromId: 'principal',
          toId: 'principal',
          amountCents: 100,
          date: '2026-07-01',
        },
      } as RecordCommand),
    ).toBe('A transferência precisa usar duas contas diferentes.');
    expect(
      reason(base, {
        type: 'saveTransfer',
        value: {
          id: 't',
          fromId: 'principal',
          toId: 'reserva',
          amountCents: 100,
          date: '2026-05-01',
        },
      } as RecordCommand),
    ).toMatch(/anterior à abertura/);
    expect(
      reason(withShares(), {
        type: 'saveInvestmentEntry',
        value: entry({
          id: 'e2',
          kind: 'withdrawal',
          amountCents: 1,
          quantity: 11,
        }),
      }),
    ).toBe(
      'VALE: Venda excede a quantidade de cotas ou ações disponível na data.',
    );
    const fixedIncome = apply(base, {
      type: 'saveInvestment',
      value: { id: 'rf', name: 'CDB', category: 'Renda fixa' },
      initialEntry: entry({
        id: 'r1',
        investmentId: 'rf',
        kind: 'contribution',
        amountCents: 100000,
      }),
    } as RecordCommand);
    expect(
      reason(fixedIncome, {
        type: 'saveInvestmentEntry',
        value: entry({
          id: 'r2',
          investmentId: 'rf',
          kind: 'withdrawal',
          amountCents: 110000,
        }),
      }),
    ).toMatch(
      /^CDB: Retirada excede o custo disponível\. Se o resgate inclui rendimento/,
    );
  });
});
