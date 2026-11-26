import { useMemo, useRef, useState } from 'react';
import { ActionButton } from '../../shared/components/ActionButton';
import { HelpHeading } from '../../shared/components/ContextHelp';
import { FinanceHelp, FormHelp } from './FinanceHelp';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { Disclosure } from '../../shared/components/Disclosure';
import { plural } from '../../shared/lib/plural';
import { displayDate, shiftDate } from '../records/dates';
import { formCents, formText, newId } from '../records/form';
import { Actions, Empty, Field, RecordForm } from '../records/RecordUI';
import type { RecordCommand, RecordPageProps } from '../records/types';
import { money } from './calculations';
import { CategoryField } from './CategoryField';
import type { PendingDeletion } from './DeleteConfirmation';
import { InlineForm } from './FinanceLayout';
import { MoneyInput } from './MoneyInput';
import { unitsToDecimal } from './monetary';
import { MovementForm, type MovementDraft } from './MovementsPanel';
import {
  confirmationDraft,
  confirmedOccurrences,
  frequencyLabels,
  nextOccurrence,
  upcomingOccurrences,
  type Occurrence,
} from './recurrence';
import type { RecurrenceFrequency, RecurringRule } from './types';

const VISIBLE_OCCURRENCES = 4;
const statusLabels: Record<RecurringRule['status'], string> = {
  active: 'Ativa',
  paused: 'Pausada',
  ended: 'Encerrada',
};

/** “vence em”, “previsto para” ou “vencida em”, conforme tipo e data. */
function dueText(item: Occurrence, today: string) {
  const date = displayDate(item.date).slice(0, 5);
  if (item.overdue)
    return item.rule.kind === 'income'
      ? `previsto para ${date} · atrasado`
      : `venceu em ${date}`;
  if (item.date === today)
    return item.rule.kind === 'income' ? 'previsto para hoje' : 'vence hoje';
  return item.rule.kind === 'income'
    ? `previsto para ${date}`
    : `vence em ${date}`;
}

/**
 * Próximas movimentações recorrentes da Carteira. Mostra as ocorrências
 * pendentes (vencidas e dos próximos dias), que são apenas previsões: não
 * alteram saldo, orçamento ou XP. “Confirmar” abre o formulário de
 * movimentação já preenchido; só a gravação cria a movimentação real.
 */
export function RecurrencesPanel({
  records,
  today,
  run,
  onDelete,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
}) {
  const [confirming, setConfirming] = useState<
    MovementDraft & { key: string }
  >();
  const [ruleForm, setRuleForm] = useState<{ id: string | null } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const rules = records.finance?.recurrences ?? [];
  const pending = useMemo(
    () => upcomingOccurrences(records, today),
    [records, today],
  );
  const visible = showAll ? pending : pending.slice(0, VISIBLE_OCCURRENCES);
  const overdue = pending.filter((item) => item.overdue).length;
  const confirm = (item: Occurrence) => {
    setRuleForm(null);
    const draft = confirmationDraft(item.rule, item.date, today);
    setConfirming({
      key: item.key,
      id: null,
      kind: item.rule.kind,
      prefill: {
        description: draft.description,
        amountCents: draft.amountCents,
        category: draft.category,
        date: draft.date,
      },
      occurrence: draft.recurrence!,
    });
  };
  return (
    <section
      className="panel record-section finance-upcoming"
      aria-labelledby="finance-upcoming-title"
    >
      <div className="finance-section-head">
        <HelpHeading
          id="finance-upcoming-title"
          title="Próximas movimentações"
          help={<FinanceHelp topic="upcoming" />}
        />
        <ActionButton
          icon="plus"
          onClick={() => {
            setConfirming(undefined);
            setRuleForm({ id: null });
          }}
        >
          Nova recorrência
        </ActionButton>
      </div>
      {overdue > 0 && (
        <p className="record-hint" role="status">
          {plural(
            overdue,
            'ocorrência pendente vencida',
            'ocorrências pendentes vencidas',
          )}
          .
        </p>
      )}
      {ruleForm && (
        <RecurrenceForm
          key={ruleForm.id ?? 'new'}
          records={records}
          today={today}
          rule={rules.find((item) => item.id === ruleForm.id)}
          run={run}
          onClose={() => setRuleForm(null)}
        />
      )}
      {confirming && (
        <MovementForm
          key={confirming.key}
          records={records}
          today={today}
          draft={confirming}
          run={run}
          onClose={() => setConfirming(undefined)}
        />
      )}
      {pending.length ? (
        <ul className="record-list finance-upcoming__list">
          {visible.map((item) => (
            <li key={item.key} data-overdue={item.overdue || undefined}>
              <div>
                <strong>{item.rule.description}</strong>
                <p>
                  {money(item.rule.amountCents)} · {dueText(item, today)} ·{' '}
                  {item.rule.kind === 'income' ? 'Receita' : 'Despesa'} ·{' '}
                  {item.rule.category}
                </p>
              </div>
              <div className="record-actions">
                <button
                  type="button"
                  onClick={() => confirm(item)}
                  aria-label={`${item.rule.kind === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento'} de ${item.rule.description}, ${displayDate(item.date)}`}
                >
                  {item.rule.kind === 'income'
                    ? 'Confirmar recebimento'
                    : 'Confirmar pagamento'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onDelete({
                      title: 'Dispensar ocorrência',
                      description: `${item.rule.description} · ${displayDate(item.date)} · ${money(item.rule.amountCents)}. A ocorrência deixa de ficar pendente, sem criar movimentação. A regra continua valendo para as próximas datas.`,
                      confirm: 'Confirmar dispensa',
                      run: () =>
                        run({
                          type: 'skipRecurrence',
                          id: item.rule.id,
                          date: item.date,
                        }),
                    })
                  }
                  aria-label={`Dispensar ${item.rule.description}, ${displayDate(item.date)}`}
                >
                  Dispensar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          {rules.length
            ? 'Nenhuma ocorrência pendente nos próximos dias.'
            : 'Nenhuma recorrência cadastrada. Ative “Repetir periodicamente” ao adicionar uma receita ou despesa, ou use “Nova recorrência”.'}
        </Empty>
      )}
      {pending.length > VISIBLE_OCCURRENCES && (
        <button
          type="button"
          className="filter-button finance-more"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Mostrar menos' : `Mostrar todas (${pending.length})`}
        </button>
      )}
      {rules.length > 0 && (
        <Disclosure
          title="Gerenciar recorrências"
          level={3}
          variant="text"
          count={rules.length}
          className="finance-recurrence-rules"
        >
          <ul className="record-list">
            {rules.map((rule) => {
              const next = nextOccurrence(rule, records.movements, today);
              const confirmed = confirmedOccurrences(
                records.movements,
                rule.id,
              ).length;
              return (
                <li key={rule.id}>
                  <div>
                    <strong>{rule.description}</strong>
                    <p>
                      {money(rule.amountCents)} ·{' '}
                      {frequencyLabels[rule.frequency]} ·{' '}
                      {rule.kind === 'income' ? 'Receita' : 'Despesa'} ·{' '}
                      {statusLabels[rule.status]}
                      {rule.status === 'ended' && rule.endDate
                        ? ` em ${displayDate(rule.endDate)}`
                        : ''}
                      {next ? ` · Próxima: ${displayDate(next)}` : ''} ·{' '}
                      {plural(confirmed, 'confirmada', 'confirmadas')}
                    </p>
                  </div>
                  <div className="record-actions">
                    {rule.status !== 'ended' && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(undefined);
                          setRuleForm({ id: rule.id });
                        }}
                        aria-label={`Editar recorrência ${rule.description}`}
                      >
                        Editar
                      </button>
                    )}
                    {rule.status === 'active' && (
                      <button
                        type="button"
                        onClick={() =>
                          run({
                            type: 'setRecurrenceStatus',
                            id: rule.id,
                            status: 'paused',
                          })
                        }
                        aria-label={`Pausar recorrência ${rule.description}`}
                      >
                        Pausar
                      </button>
                    )}
                    {rule.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() =>
                          run({
                            type: 'setRecurrenceStatus',
                            id: rule.id,
                            status: 'active',
                          })
                        }
                        aria-label={`Reativar recorrência ${rule.description}`}
                      >
                        Reativar
                      </button>
                    )}
                    {rule.status !== 'ended' && (
                      <button
                        type="button"
                        onClick={() =>
                          onDelete({
                            title: 'Encerrar recorrência',
                            description: `${rule.description}: a série termina hoje e deixa de gerar previsões. As ${plural(confirmed, 'movimentação confirmada permanece', 'movimentações confirmadas permanecem')} no histórico.`,
                            confirm: 'Confirmar encerramento',
                            run: () =>
                              run({
                                type: 'setRecurrenceStatus',
                                id: rule.id,
                                status: 'ended',
                              }),
                          })
                        }
                        aria-label={`Encerrar recorrência ${rule.description}`}
                      >
                        Encerrar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onDelete({
                          title: 'Excluir recorrência',
                          description: `${rule.description}: a regra e suas previsões serão removidas. ${plural(confirmed, 'A movimentação confirmada permanece', 'As movimentações confirmadas permanecem')} no histórico, no saldo e no orçamento.`,
                          confirm: 'Confirmar exclusão',
                          run: () => {
                            const error = run({
                              type: 'deleteRecurrence',
                              id: rule.id,
                            });
                            if (!error && ruleForm?.id === rule.id)
                              setRuleForm(null);
                            return error;
                          },
                        })
                      }
                      aria-label={`Excluir recorrência ${rule.description}`}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Disclosure>
      )}
    </section>
  );
}

/**
 * Cadastro/edição de regra sem movimentação imediata (por exemplo, um salário
 * que começa no próximo mês). Editar vale para as ocorrências ainda não
 * confirmadas; movimentações já confirmadas não mudam.
 */
function RecurrenceForm({
  records,
  today,
  rule,
  run,
  onClose,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  rule?: RecurringRule | undefined;
  run: (command: RecordCommand) => string | null;
  onClose: () => void;
}) {
  const saved = useRef(false);
  const [kind, setKind] = useState<RecurringRule['kind']>(
    rule?.kind ?? 'expense',
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    rule?.frequency ?? 'monthly',
  );
  return (
    <InlineForm>
      <RecordForm
        title={rule ? 'Editar recorrência' : 'Nova recorrência'}
        onSubmit={(data) => {
          if (saved.current) return null;
          const value: RecurringRule = {
            id: rule?.id ?? newId(),
            kind: rule?.kind ?? kind,
            description: formText(data, 'description'),
            amountCents: formCents(data, 'amount'),
            category: formText(data, 'category'),
            frequency,
            startDate: formText(data, 'startDate'),
            status: 'active',
          };
          const error = run({ type: 'saveRecurrence', rule: value });
          if (!error) {
            saved.current = true;
            onClose();
          }
          return error;
        }}
      >
        <div className="record-fields">
          {rule ? (
            <p className="record-hint">
              {rule.kind === 'income' ? 'Receita' : 'Despesa'} recorrente.
            </p>
          ) : (
            <Field label="Tipo da recorrência">
              <CustomSelect<RecurringRule['kind']>
                label="Tipo da recorrência"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'expense', label: 'Despesa' },
                  { value: 'income', label: 'Receita' },
                ]}
              />
            </Field>
          )}
          <Field label="Descrição">
            <input
              name="description"
              maxLength={200}
              required
              defaultValue={rule?.description}
            />
          </Field>
          <Field label="Valor (R$)">
            <MoneyInput
              name="amount"
              required
              defaultValue={rule ? unitsToDecimal(rule.amountCents, 2) : ''}
            />
          </Field>
          <CategoryField
            movements={records.movements}
            kind={rule?.kind ?? kind}
            defaultValue={rule?.category}
          />
          <Field label="Frequência">
            <CustomSelect<RecurrenceFrequency>
              label="Frequência"
              value={frequency}
              onChange={setFrequency}
              options={(['weekly', 'monthly', 'yearly'] as const).map(
                (value) => ({ value, label: frequencyLabels[value] }),
              )}
            />
          </Field>
          <Field label="Primeira ocorrência">
            <CustomDatePicker
              label="Primeira ocorrência"
              name="startDate"
              required
              max={shiftDate(today, 3660)}
              defaultValue={rule?.startDate ?? today}
            />
          </Field>
        </div>
        <FormHelp topic="recurrenceForm" />
        <Actions
          submit={rule ? 'Salvar recorrência' : 'Adicionar recorrência'}
          cancel={rule ? 'Cancelar edição' : 'Cancelar'}
          onCancel={onClose}
        />
      </RecordForm>
    </InlineForm>
  );
}
