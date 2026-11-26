import { describe, expect, it } from 'vitest';
import { emptyRecords, type LifeRecords } from '../records/types';
import { emptyLedger } from './types';
import { wealthChartModel, smoothWealthPath } from './chartModel';
const today = '2026-11-13';
function chartRecords(): LifeRecords {
  return {
    ...emptyRecords(),
    finance: {
      ...emptyLedger(),
      accounts: [
        {
          id: 'principal',
          name: 'Conta',
          initialCents: 100000,
          date: '2026-01-01',
        },
      ],
    },
    movements: [
      {
        id: 'oct',
        kind: 'income',
        description: 'Receita',
        category: 'Geral',
        amountCents: 10000,
        date: '2026-10-20',
      },
      {
        id: 'nov',
        kind: 'expense',
        description: 'Despesa',
        category: 'Geral',
        amountCents: 5000,
        date: '2026-11-10',
      },
      {
        id: 'last',
        kind: 'income',
        description: 'Receita',
        category: 'Geral',
        amountCents: 15000,
        date: today,
      },
    ],
  };
}
describe('Projeção do gráfico de patrimônio', () => {
  it('filtra 7/30/365 dias sem adicionar datas ou usar resultado mensal como patrimônio', () => {
    const records = chartRecords();
    const month = wealthChartModel(records, today, 30);
    expect(month.points.map((p) => p.date)).toEqual([
      '2026-10-20',
      '2026-11-10',
      today,
    ]);
    expect(month.current.wealth).toBe(120000);
    expect(month.change).toBe(10000);
    expect(month.percent).toBeCloseTo((10000 / 110000) * 100);
    expect(wealthChartModel(records, today, 7).points).toHaveLength(2);
    expect(wealthChartModel(records, today, 365).points).toHaveLength(4);
    expect(wealthChartModel(records, today, 365).change).toBe(20000);
  });
  it('usa a carteira interna com saldo zero quando não há abertura gravada', () => {
    const records = chartRecords();
    delete records.finance;
    // Sem abertura, receitas e despesas partem de zero; nada é inventado.
    const model = wealthChartModel(records, today, 30, 'cash');
    expect(model.points.map((p) => [p.date, p.value])).toEqual([
      ['2026-10-20', 10000],
      ['2026-11-10', 5000],
      [today, 20000],
    ]);
    expect(model.current).toMatchObject({ cash: 20000, wealth: 20000 });
    expect(model.change).toBe(10000);
  });
  it('não usa transferências para investimentos como queda ou aumento artificial', () => {
    const records = chartRecords();
    records.investments = [
      { id: 'a', name: 'Caixinha', category: 'Caixinhas bancárias' },
    ];
    records.investmentEntries = [
      {
        id: 'buy',
        investmentId: 'a',
        kind: 'contribution',
        amountCents: 20000,
        date: today,
      },
    ];
    const model = wealthChartModel(records, today, 30);
    expect(model.current).toMatchObject({
      cash: 100000,
      investments: 20000,
      wealth: 120000,
    });
    expect(model.change).toBe(10000);
  });
  it('agrega datas iguais e mantém um único ponto sem linha nem comparação inventada', () => {
    const records = chartRecords();
    records.finance!.accounts[0]!.date = today;
    records.movements = records.movements.map((m) => ({ ...m, date: today }));
    expect(wealthChartModel(records, today, 30)).toMatchObject({
      change: null,
      percent: null,
      trend: 'neutral',
    });
    expect(wealthChartModel(records, today, 30).points).toHaveLength(1);
    expect(smoothWealthPath([{ x: 100, y: 50 }])).toBe('');
  });
  it.each([
    [10000, -5000, 'down', -50],
    [10000, 0, 'neutral', 0],
    [0, 1000, 'up', null],
    [-10000, 1000, 'up', null],
  ] as const)(
    'calcula direção e percentual com base %s e mudança %s',
    (initial, delta, trend, percent) => {
      const records = chartRecords();
      records.finance!.accounts[0]!.initialCents = initial;
      records.movements =
        delta === 0
          ? []
          : [
              {
                id: 'change',
                kind: delta > 0 ? 'income' : 'expense',
                description: 'Alteração',
                category: 'Geral',
                amountCents: Math.abs(delta),
                date: today,
              },
            ];
      if (!delta)
        records.movements = [
          {
            id: 'income',
            kind: 'income',
            description: 'Entrada',
            category: 'Geral',
            amountCents: 100,
            date: today,
          },
          {
            id: 'expense',
            kind: 'expense',
            description: 'Saída',
            category: 'Geral',
            amountCents: 100,
            date: today,
          },
        ];
      const model = wealthChartModel(records, today, 365);
      expect(model).toMatchObject({ change: delta, trend, percent });
    },
  );
  it('usa controles dentro dos segmentos, sem ultrapassar os valores observados', () => {
    expect(
      smoothWealthPath([
        { x: 0, y: 100 },
        { x: 90, y: 20 },
        { x: 180, y: 80 },
      ]),
    ).toBe('M 0 100 C 30 100, 60 20, 90 20 C 120 20, 150 80, 180 80');
  });
});
