import { describe, expect, it } from 'vitest';
import { applyRecordCommand } from '../records/commands';
import { recordReward } from '../records/progression';
import { emptyRecords, type LifeRecords } from '../records/types';
import { monthlyBalance } from './calculations';
import { financialSummary } from './ledger';
import {
  confirmationDraft,
  confirmedOccurrences,
  nextOccurrence,
  occurrenceAt,
  occurrenceMovementId,
  pendingOccurrences,
  scheduledDates,
  upcomingOccurrences,
} from './recurrence';
import type { MoneyMovement, RecurringRule } from './types';

/** Dados sintéticos; nenhuma informação pessoal real. */
const today = '2026-11-26';
const rule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r-internet',
  kind: 'expense',
  description: 'Internet',
  amountCents: 12000,
  category: 'Contas fixas',
  frequency: 'monthly',
  startDate: '2026-11-05',
  status: 'active',
  ...overrides,
});
function apply(
  records: LifeRecords,
  ...commands: Parameters<typeof applyRecordCommand>[1][]
) {
  return commands.reduce(
    (state, command) => applyRecordCommand(state, command, today),
    records,
  );
}
const withRule = (value = rule()) =>
  apply(emptyRecords(), { type: 'saveRecurrence', rule: value });
function confirm(
  records: LifeRecords,
  value: RecurringRule,
  date: string,
  changes: Partial<MoneyMovement> = {},
) {
  return applyRecordCommand(
    records,
    {
      type: 'confirmRecurrence',
      value: {
        ...confirmationDraft(value, date, today),
        id: occurrenceMovementId(value.id, date),
        ...changes,
      },
    },
    today,
  );
}

describe('agenda das recorrências', () => {
  it('cria séries semanal, mensal e anual a partir da data inicial', () => {
    expect(
      scheduledDates(
        { frequency: 'weekly', startDate: '2026-11-02' },
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
    expect(
      scheduledDates(
        { frequency: 'monthly', startDate: '2026-10-10' },
        '2026-10-01',
        '2027-01-31',
      ),
    ).toEqual(['2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10']);
    expect(
      scheduledDates(
        { frequency: 'yearly', startDate: '2025-03-15' },
        '2025-01-01',
        '2028-12-31',
      ),
    ).toEqual(['2025-03-15', '2026-03-15', '2027-03-15', '2028-03-15']);
  });

  it('ajusta o dia 31 ao último dia de meses menores e volta ao 31', () => {
    const series = { frequency: 'monthly' as const, startDate: '2027-01-31' };
    expect([0, 1, 2, 3, 4].map((n) => occurrenceAt(series, n))).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
    ]);
    // Ano bissexto: fevereiro tem 29 dias.
    expect(
      occurrenceAt({ frequency: 'monthly', startDate: '2028-01-31' }, 1),
    ).toBe('2028-02-29');
    // Virada de ano.
    expect(
      occurrenceAt({ frequency: 'monthly', startDate: '2026-12-31' }, 2),
    ).toBe('2027-02-28');
  });

  it('trata 29/02 anual em anos não bissextos sem desvio acumulado', () => {
    const series = { frequency: 'yearly' as const, startDate: '2024-02-29' };
    expect([0, 1, 2, 3, 4].map((n) => occurrenceAt(series, n))).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('não depende do fuso horário do ambiente (datas civis)', () => {
    const previous = process.env.TZ;
    try {
      for (const zone of ['America/Sao_Paulo', 'Pacific/Kiritimati', 'UTC']) {
        process.env.TZ = zone;
        expect(
          scheduledDates(
            { frequency: 'weekly', startDate: '2026-10-25' },
            '2026-10-25',
            '2026-11-08',
          ),
        ).toEqual(['2026-10-25', '2026-11-01', '2026-11-08']);
      }
    } finally {
      process.env.TZ = previous;
    }
  });

  it('materializa somente a janela consultada, com limite de iterações', () => {
    const weekly = rule({ frequency: 'weekly', startDate: '2000-01-03' });
    const pending = pendingOccurrences(weekly, [], today, '2026-12-26');
    expect(pending.at(-1)!.date <= '2026-12-26').toBe(true);
    expect(pending.length).toBeLessThan(5000);
    // Uma janela distante não percorre a série inteira desde o início.
    expect(scheduledDates(weekly, '2026-11-20', '2026-11-30')).toEqual([
      '2026-11-23',
      '2026-11-30',
    ]);
  });
});

describe('regras e confirmações', () => {
  it('previsão não altera saldo, resultado, orçamento nem XP', () => {
    const records = withRule();
    expect(records.movements).toEqual([]);
    expect(financialSummary(records, today).cash).toBe(0);
    expect(monthlyBalance(records.movements, '2026-11').expense).toBe(0);
    expect(recordReward(records, [], today)).toBe(0);
    const pending = upcomingOccurrences(records, today);
    expect(pending.map((item) => [item.date, item.overdue])).toEqual([
      ['2026-11-05', true],
      ['2026-12-05', false],
    ]);
  });

  it('confirma despesa vencida criando uma movimentação real vinculada', () => {
    const value = rule();
    const records = confirm(withRule(value), value, '2026-11-05');
    expect(records.movements).toEqual([
      {
        id: 'recorrencia:r-internet:2026-11-05',
        kind: 'expense',
        description: 'Internet',
        amountCents: 12000,
        category: 'Contas fixas',
        date: '2026-11-05',
        recurrence: { ruleId: 'r-internet', date: '2026-11-05' },
      },
    ]);
    expect(financialSummary(records, today).cash).toBe(-12000);
    expect(monthlyBalance(records.movements, '2026-11').expense).toBe(12000);
    // Segue a regra existente de movimentação real (80 XP por dia de Finanças).
    expect(recordReward(records, [], today)).toBe(80);
    expect(pendingOccurrences(value, records.movements, today)[0]!.date).toBe(
      '2026-12-05',
    );
  });

  it('confirma receita prevista para o futuro com a data de hoje', () => {
    const salary = rule({
      id: 'r-salario',
      kind: 'income',
      description: 'Salário',
      amountCents: 300000,
      category: 'Salário',
      startDate: '2026-11-30',
    });
    const draft = confirmationDraft(salary, '2026-11-30', today);
    expect(draft.date).toBe(today);
    const records = confirm(withRule(salary), salary, '2026-11-30');
    expect(records.movements[0]).toMatchObject({
      kind: 'income',
      date: today,
      recurrence: { ruleId: 'r-salario', date: '2026-11-30' },
    });
    expect(financialSummary(records, today).cash).toBe(300000);
    expect(monthlyBalance(records.movements, '2026-11').income).toBe(300000);
  });

  it('confirmar duas vezes a mesma ocorrência não duplica (idempotente)', () => {
    const value = rule();
    const once = confirm(withRule(value), value, '2026-11-05');
    const twice = confirm(once, value, '2026-11-05', {
      id: 'outro-id',
      amountCents: 99999,
    });
    expect(twice).toBe(once);
    expect(twice.movements).toHaveLength(1);
    expect(recordReward(twice, [], today)).toBe(80);
    // Duas abas aplicando a mesma confirmação sobre o estado mais recente.
    const concurrent = confirm(
      confirm(once, value, '2026-11-05'),
      value,
      '2026-11-05',
    );
    expect(concurrent.movements).toHaveLength(1);
    // Mesmo um registro forjado com o mesmo vínculo é recusado na validação.
    expect(() =>
      applyRecordCommand(
        once,
        {
          type: 'saveMovement',
          value: { ...once.movements[0]!, id: 'clone' },
        },
        today,
      ),
    ).toThrow();
  });

  it('recusa datas fora da série e confirmações de regras encerradas', () => {
    const value = rule();
    const records = withRule(value);
    expect(() => confirm(records, value, '2026-11-06')).toThrow(
      'não está disponível',
    );
    const ended = apply(records, {
      type: 'setRecurrenceStatus',
      id: value.id,
      status: 'ended',
    });
    expect(() => confirm(ended, value, '2026-11-05')).toThrow();
    expect(upcomingOccurrences(ended, today)).toEqual([]);
  });

  it('pausa e reativa sem gerar pendências no intervalo pausado', () => {
    const weekly = rule({ frequency: 'weekly', startDate: '2026-11-02' });
    const records = withRule(weekly);
    const pausedToday = apply(records, {
      type: 'setRecurrenceStatus',
      id: weekly.id,
      status: 'paused',
    });
    const paused = pausedToday.finance!.recurrences![0]!;
    expect(paused.status).toBe('paused');
    expect(paused.pauses).toEqual([{ from: today }]);
    expect(nextOccurrence(paused, [], today)).toBeNull();
    // Vencidas antes da pausa continuam pendentes; as futuras, não.
    expect(
      upcomingOccurrences(pausedToday, today).map((item) => item.date),
    ).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    // Reativar no mesmo dia descarta a pausa vazia.
    const resumed = applyRecordCommand(
      pausedToday,
      { type: 'setRecurrenceStatus', id: weekly.id, status: 'active' },
      today,
    );
    expect(resumed.finance!.recurrences![0]).toEqual({
      ...weekly,
      status: 'active',
    });
    // Pausa de uma semana: a ocorrência de 30/11 fica fora; a de 07/12 volta.
    const later = applyRecordCommand(
      pausedToday,
      { type: 'setRecurrenceStatus', id: weekly.id, status: 'active' },
      '2026-12-03',
    );
    const reactivated = later.finance!.recurrences![0]!;
    expect(reactivated.pauses).toEqual([{ from: today, to: '2026-12-03' }]);
    expect(
      pendingOccurrences(reactivated, [], '2026-12-03').map(
        (item) => item.date,
      ),
    ).not.toContain('2026-11-30');
    expect(nextOccurrence(reactivated, [], '2026-12-03')).toBe('2026-12-07');
  });

  it('editar vale para as próximas ocorrências e preserva as confirmadas', () => {
    const value = rule();
    const confirmed = confirm(withRule(value), value, '2026-11-05');
    const edited = apply(confirmed, {
      type: 'saveRecurrence',
      rule: { ...value, amountCents: 15000, description: 'Internet fibra' },
    });
    expect(edited.movements).toEqual(confirmed.movements);
    expect(edited.movements[0]!.amountCents).toBe(12000);
    const next = upcomingOccurrences(edited, today)[0]!;
    expect(next.rule.amountCents).toBe(15000);
    expect(next.date).toBe('2026-12-05');
    // A edição não reativa nem apaga o estado da regra.
    const paused = apply(edited, {
      type: 'setRecurrenceStatus',
      id: value.id,
      status: 'paused',
    });
    const again = apply(paused, {
      type: 'saveRecurrence',
      rule: { ...value, status: 'active' },
    });
    expect(again.finance!.recurrences![0]!.status).toBe('paused');
  });

  it('cria a regra e a primeira ocorrência confirmada na mesma operação', () => {
    const value = rule({ startDate: '2026-11-20' });
    const first: MoneyMovement = {
      ...confirmationDraft(value, '2026-11-20', today),
      id: occurrenceMovementId(value.id, '2026-11-20'),
    };
    const records = apply(emptyRecords(), {
      type: 'saveRecurrence',
      rule: value,
      firstMovement: first,
    });
    expect(records.movements).toEqual([first]);
    expect(confirmedOccurrences(records.movements, value.id)).toHaveLength(1);
    expect(
      upcomingOccurrences(records, today).map((item) => item.date),
    ).toEqual(['2026-12-20']);
    // Primeira ocorrência inconsistente: nada é gravado.
    expect(() =>
      apply(emptyRecords(), {
        type: 'saveRecurrence',
        rule: value,
        firstMovement: { ...first, date: '2026-11-21' },
      }),
    ).toThrow('primeira ocorrência');
  });

  it('dispensa uma ocorrência sem criar movimentação', () => {
    const value = rule();
    const records = apply(withRule(value), {
      type: 'skipRecurrence',
      id: value.id,
      date: '2026-11-05',
    });
    expect(records.movements).toEqual([]);
    expect(
      upcomingOccurrences(records, today).map((item) => item.date),
    ).toEqual(['2026-12-05']);
    expect(() => confirm(records, value, '2026-11-05')).toThrow();
  });

  it('encerra e exclui a regra preservando o histórico confirmado', () => {
    const value = rule();
    const confirmed = confirm(withRule(value), value, '2026-11-05');
    const ended = apply(confirmed, {
      type: 'setRecurrenceStatus',
      id: value.id,
      status: 'ended',
    });
    expect(ended.finance!.recurrences![0]).toMatchObject({
      status: 'ended',
      endDate: today,
    });
    expect(ended.movements).toEqual(confirmed.movements);
    const removed = apply(ended, { type: 'deleteRecurrence', id: value.id });
    expect(removed.finance!.recurrences).toEqual([]);
    expect(removed.movements).toEqual(confirmed.movements);
    expect(financialSummary(removed, today).cash).toBe(-12000);
  });

  it('excluir a movimentação confirmada devolve a ocorrência às pendências', () => {
    const value = rule();
    const confirmed = confirm(withRule(value), value, '2026-11-05');
    const deleted = apply(confirmed, {
      type: 'deleteMovement',
      id: confirmed.movements[0]!.id,
    });
    expect(upcomingOccurrences(deleted, today)[0]!.date).toBe('2026-11-05');
  });

  it('editar a movimentação confirmada mantém o vínculo; não é possível trocá-lo', () => {
    const value = rule();
    const confirmed = confirm(withRule(value), value, '2026-11-05');
    const movement = confirmed.movements[0]!;
    const edited = apply(confirmed, {
      type: 'saveMovement',
      value: { ...movement, amountCents: 12500 },
    });
    expect(edited.movements[0]).toMatchObject({
      amountCents: 12500,
      recurrence: movement.recurrence,
    });
    const unlinked: MoneyMovement = { ...movement };
    delete unlinked.recurrence;
    expect(() =>
      apply(confirmed, { type: 'saveMovement', value: unlinked }),
    ).toThrow('Confirmar');
  });

  it('valida estruturas inválidas de regras importadas', () => {
    const records = withRule();
    const bad = (changes: Partial<RecurringRule>) => ({
      ...records,
      finance: {
        ...records.finance!,
        recurrences: [{ ...records.finance!.recurrences![0]!, ...changes }],
      },
    });
    for (const changes of [
      { frequency: 'daily' as never },
      { startDate: '2026-02-30' },
      { status: 'ended' as const },
      { status: 'paused' as const },
      { amountCents: 0 },
    ])
      expect(() =>
        applyRecordCommand(
          bad(changes),
          { type: 'setSleepGoal', hours: 8 },
          today,
        ),
      ).toThrow();
  });
});
