import { describe, expect, it } from 'vitest';
import {
  entryFromForm,
  investmentCommand,
  movementFromForm,
} from './financeForms';
import {
  ALL,
  entryOperation,
  filterInvestmentEntries,
  filterMovements,
  movementCategories,
} from './historyFilters';
import { actionAccessibleName, investmentActions } from './investmentActions';
import { investmentCategories } from './types';
import type { Investment, InvestmentEntry, MoneyMovement } from './types';

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe('ações contextuais da carteira', () => {
  it('define ações por categoria, todas apoiadas nas operações existentes', () => {
    const labels = (category: (typeof investmentCategories)[number]) =>
      investmentActions(category).map((item) => item.label);
    expect(labels('Caixinhas bancárias')).toEqual([
      'Aportar',
      'Retirar',
      'Atualizar saldo',
      'Editar',
    ]);
    expect(labels('Bitcoin')).toEqual([
      'Comprar mais',
      'Vender',
      'Atualizar cotação',
      'Editar',
    ]);
    expect(labels('Ações')).toEqual(['Comprar mais', 'Vender', 'Editar']);
    expect(labels('Fundos imobiliários')).toEqual([
      'Comprar mais',
      'Vender',
      'Editar',
    ]);
    expect(labels('Renda fixa')).toEqual(['Aportar', 'Resgatar', 'Editar']);
    expect(labels('Dólar (USD)')).toEqual([
      'Comprar',
      'Vender',
      'Atualizar cotação',
      'Editar',
    ]);
    expect(labels('Outros')).toEqual(['Aportar', 'Retirar', 'Editar']);
    for (const category of investmentCategories) {
      const actions = investmentActions(category);
      expect(actions.find((item) => item.id === 'contribute')?.kind).toBe(
        'contribution',
      );
      expect(actions.find((item) => item.id === 'withdraw')?.kind).toBe(
        'withdrawal',
      );
      // Somente BTC e USD possuem integração de cotação existente.
      expect(actions.some((item) => item.id === 'quote')).toBe(
        category === 'Bitcoin' || category === 'Dólar (USD)',
      );
    }
  });
  it('usa nomes acessíveis que começam pelo texto visível', () => {
    const [aportar, retirar, saldo, editar] = investmentActions(
      'Caixinhas bancárias',
    );
    expect(actionAccessibleName(aportar!, 'Caixa Itaú')).toBe(
      'Aportar em Caixa Itaú',
    );
    expect(actionAccessibleName(retirar!, 'Caixa Itaú')).toBe(
      'Retirar de Caixa Itaú',
    );
    expect(actionAccessibleName(saldo!, 'Caixa Itaú')).toBe(
      'Atualizar saldo de Caixa Itaú',
    );
    expect(actionAccessibleName(editar!, 'Caixa Itaú')).toBe(
      'Editar investimento Caixa Itaú',
    );
    expect(
      actionAccessibleName(investmentActions('Bitcoin')[0]!, 'Bitcoin (BTC)'),
    ).toBe('Comprar mais Bitcoin (BTC)');
  });
});

describe('conversão dos formulários extraídos', () => {
  it('preserva compra de BTC, venda e posição inicial como antes', () => {
    expect(
      entryFromForm(
        form({
          kind: 'contribution',
          positionType: 'purchase',
          amount: '50.00',
          quantity: '0.00012821',
          date: '2026-11-13',
          accountId: 'principal',
        }),
        'e1',
        'btc',
        'Bitcoin',
        '2026-11-13',
      ),
    ).toEqual({
      id: 'e1',
      investmentId: 'btc',
      accountId: 'principal',
      kind: 'contribution',
      date: '2026-11-13',
      positionInitial: false,
      amountCents: 5000,
      quantity: 0.00012821,
    });
    expect(
      entryFromForm(
        form({
          kind: 'withdrawal',
          amount: '150.00',
          quantity: '0.001',
          date: '2026-11-13',
        }),
        'e2',
        'btc',
        'Bitcoin',
      ),
    ).toMatchObject({
      kind: 'withdrawal',
      amountCents: 15000,
      quantity: 0.001,
    });
    expect(
      entryFromForm(
        form({ positionType: 'initial' }),
        'e3',
        'box',
        'Caixinhas bancárias',
        '2026-11-13',
      ),
    ).toMatchObject({
      positionInitial: true,
      costUnknown: true,
      acquisitionDateUnknown: true,
      amountCents: 0,
      date: '2026-11-13',
    });
  });
  it('mantém as validações de quantidade/preço e de retiradas sem unidades', () => {
    for (const category of ['Renda fixa', 'Outros'] as const) {
      expect(() =>
        entryFromForm(
          form({
            kind: 'contribution',
            positionType: 'purchase',
            quantity: '3',
          }),
          'x',
          'a',
          category,
        ),
      ).toThrow('Informe quantidade e preço de compra juntos.');
      expect(() =>
        entryFromForm(
          form({ kind: 'withdrawal', quantity: '3', price: '10.00' }),
          'x',
          'a',
          category,
        ),
      ).toThrow('Retiradas usam o valor retirado');
    }
  });
  it('aceita compra com quantidade e valor pago e venda por quantidade em ações e FIIs', () => {
    for (const category of ['Ações', 'Fundos imobiliários'] as const) {
      expect(
        entryFromForm(
          form({
            kind: 'contribution',
            positionType: 'purchase',
            quantity: '3',
            amount: '183.60',
            date: '2026-11-10',
          }),
          'buy',
          'a',
          category,
        ),
      ).toMatchObject({ quantity: 3, amountCents: 18360 });
      expect(
        entryFromForm(
          form({
            kind: 'withdrawal',
            quantity: '1',
            amount: '65.00',
            date: '2026-11-11',
          }),
          'sell',
          'a',
          category,
        ),
      ).toMatchObject({ kind: 'withdrawal', quantity: 1, amountCents: 6500 });
      expect(() =>
        entryFromForm(
          form({ kind: 'withdrawal', quantity: '1', price: '10.00' }),
          'x',
          'a',
          category,
        ),
      ).toThrow('Vendas usam a quantidade vendida');
      expect(() =>
        entryFromForm(
          form({
            kind: 'contribution',
            positionType: 'purchase',
            price: '10.00',
          }),
          'x',
          'a',
          category,
        ),
      ).toThrow('Informe a quantidade junto com o preço de compra.');
    }
  });
  it('gera os mesmos comandos de movimentação e cadastro', () => {
    expect(
      movementFromForm(
        form({
          kind: 'income',
          description: ' Salário ',
          amount: '10.50',
          category: 'Trabalho',
          date: '2026-11-01',
          accountId: '',
        }),
        'm1',
      ),
    ).toEqual({
      id: 'm1',
      kind: 'income',
      description: 'Salário',
      amountCents: 1050,
      category: 'Trabalho',
      date: '2026-11-01',
    });
    let ids = 0;
    const command = investmentCommand(
      form({
        name: 'Caixa Itaú',
        category: 'Caixinhas bancárias',
        institution: 'Itaú',
        cdiPercent: '100',
        positionType: 'initial',
        amount: '800.00',
        boxBalance: '810.78',
        balanceDate: '2026-11-10',
      }),
      undefined,
      '2026-11-13',
      () => `id-${++ids}`,
    );
    expect(command).toMatchObject({
      type: 'saveInvestment',
      value: {
        id: 'id-1',
        institution: 'Itaú',
        cdiPercentBasisPoints: 10000,
      },
      initialEntry: {
        investmentId: 'id-1',
        positionInitial: true,
        amountCents: 80000,
      },
      initialValuation: {
        investmentId: 'id-1',
        amountCents: 81078,
        movementsComplete: false,
      },
    });
    const existing: Investment = { id: 'a', name: 'Antigo', category: 'Ações' };
    expect(
      investmentCommand(
        form({ name: 'Novo nome', category: 'Ações' }),
        existing,
        '2026-11-13',
        () => 'nunca',
      ),
    ).toEqual({
      type: 'saveInvestment',
      value: { id: 'a', name: 'Novo nome', category: 'Ações' },
    });
  });
});

describe('filtros dos históricos', () => {
  const movements: MoneyMovement[] = [
    {
      id: '1',
      kind: 'income',
      description: 'Salário',
      amountCents: 1,
      category: 'Trabalho',
      date: '2026-11-05',
      accountId: 'principal',
    },
    {
      id: '2',
      kind: 'expense',
      description: 'Mercado',
      amountCents: 1,
      category: 'Casa',
      date: '2026-11-10',
    },
    {
      id: '3',
      kind: 'expense',
      description: 'Cinema',
      amountCents: 1,
      category: 'Lazer',
      date: '2026-11-12',
      accountId: 'other',
    },
    {
      id: '4',
      kind: 'expense',
      description: 'Outubro',
      amountCents: 1,
      category: 'Casa',
      date: '2026-10-30',
    },
  ];
  const base = {
    month: '2026-11',
    kind: ALL,
    accountId: ALL,
    category: ALL,
  } as const;
  it('filtra por mês, tipo, conta (legado na principal) e categoria, do mais recente', () => {
    const ids = (filters: Partial<Parameters<typeof filterMovements>[1]>) =>
      filterMovements(movements, { ...base, ...filters }).map(
        (item) => item.id,
      );
    expect(ids({})).toEqual(['3', '2', '1']);
    expect(ids({ month: '2026-10' })).toEqual(['4']);
    expect(ids({ kind: 'income' })).toEqual(['1']);
    expect(ids({ accountId: 'principal' })).toEqual(['2', '1']);
    expect(ids({ accountId: 'other' })).toEqual(['3']);
    expect(ids({ category: 'Casa' })).toEqual(['2']);
    expect(movementCategories(movements)).toEqual([
      'Casa',
      'Lazer',
      'Trabalho',
    ]);
  });
  it('filtra operações sem modificar os registros', () => {
    const investments: Investment[] = [
      { id: 'box', name: 'Caixa', category: 'Caixinhas bancárias' },
      { id: 'btc', name: 'BTC', category: 'Bitcoin' },
    ];
    const entries: InvestmentEntry[] = [
      {
        id: 'i',
        investmentId: 'box',
        kind: 'contribution',
        amountCents: 1,
        date: '2026-01-01',
        positionInitial: true,
      },
      {
        id: 'c',
        investmentId: 'btc',
        kind: 'contribution',
        amountCents: 1,
        date: '2026-06-01',
        quantity: 0.1,
      },
      {
        id: 'w',
        investmentId: 'btc',
        kind: 'withdrawal',
        amountCents: 1,
        date: '2026-09-01',
        quantity: 0.05,
      },
    ];
    const snapshot = structuredClone(entries);
    const ids = (
      filters: Partial<Parameters<typeof filterInvestmentEntries>[2]>,
    ) =>
      filterInvestmentEntries(entries, investments, {
        investmentId: ALL,
        category: ALL,
        operation: ALL,
        from: '',
        to: '',
        ...filters,
      }).map((item) => item.id);
    expect(ids({})).toEqual(['w', 'c', 'i']);
    expect(ids({ investmentId: 'box' })).toEqual(['i']);
    expect(ids({ category: 'Bitcoin' })).toEqual(['w', 'c']);
    expect(ids({ operation: 'initial' })).toEqual(['i']);
    expect(ids({ operation: 'contribution' })).toEqual(['c']);
    expect(ids({ operation: 'withdrawal' })).toEqual(['w']);
    expect(ids({ from: '2026-06-01', to: '2026-08-31' })).toEqual(['c']);
    expect(entryOperation(entries[0]!)).toBe('initial');
    expect(entries).toEqual(snapshot);
  });
});
