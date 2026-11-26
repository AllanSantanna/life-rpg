import { useRef, useState } from 'react';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { plural } from '../../shared/lib/plural';
import { displayDate } from '../records/dates';
import { newId } from '../records/form';
import {
  Actions,
  DateField,
  Empty,
  Field,
  RecordForm,
} from '../records/RecordUI';
import type { RecordCommand, RecordPageProps } from '../records/types';
import { money } from './calculations';
import type { PendingDeletion } from './DeleteConfirmation';
import { Disclosure } from '../../shared/components/Disclosure';
import { InlineForm } from './FinanceLayout';
import { movementFromForm } from './financeForms';
import {
  ALL,
  filterMovements,
  HISTORY_PAGE_SIZE,
  movementCategories,
  type MovementFilters,
} from './historyFilters';
import { MoneyInput } from './MoneyInput';
import type { MoneyMovement } from './types';

/** Rascunho do formulário: `id` nulo cria; texto edita a movimentação. */
export interface MovementDraft {
  id: string | null;
  kind: MoneyMovement['kind'];
}

/**
 * Formulário de receita/despesa. Não há escolha de conta: registros novos ficam
 * sem `accountId`, isto é, na carteira interna única; a edição mantém o
 * `accountId` de registros anteriores para não mudar saldos já calculados.
 */
export function MovementForm({
  records,
  today,
  draft,
  run,
  onClose,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  draft: MovementDraft;
  run: (command: RecordCommand) => string | null;
  onClose: () => void;
}) {
  const saved = useRef(false);
  const movement = records.movements.find((item) => item.id === draft.id);
  return (
    <InlineForm>
      <RecordForm
        title={movement ? 'Editar movimentação' : 'Nova movimentação'}
        onSubmit={(data) => {
          // Evita gravar duas vezes por cliques repetidos antes de fechar.
          if (saved.current) return null;
          const error = run({
            type: 'saveMovement',
            value: movementFromForm(data, movement?.id ?? newId()),
          });
          if (!error) {
            saved.current = true;
            onClose();
          }
          return error;
        }}
      >
        <div className="record-fields">
          <Field label="Tipo de movimentação">
            <CustomSelect
              label="Tipo de movimentação"
              name="kind"
              defaultValue={movement?.kind ?? draft.kind}
              options={[
                { value: 'income', label: 'Receita' },
                { value: 'expense', label: 'Despesa' },
              ]}
            />
          </Field>
          <Field label="Descrição">
            <input
              name="description"
              maxLength={200}
              required
              defaultValue={movement?.description}
            />
          </Field>
          <Field label="Valor (R$)">
            <MoneyInput
              name="amount"
              required
              defaultValue={
                movement ? (movement.amountCents / 100).toFixed(2) : ''
              }
            />
          </Field>
          <Field label="Categoria da movimentação">
            <input
              name="category"
              required
              maxLength={200}
              defaultValue={movement?.category ?? 'Geral'}
            />
          </Field>
          <DateField today={today} value={movement?.date} />
          {movement?.accountId !== undefined && (
            <input type="hidden" name="accountId" value={movement.accountId} />
          )}
        </div>
        <Actions
          submit={movement ? 'Salvar movimentação' : 'Adicionar movimentação'}
          cancel={movement ? 'Cancelar edição' : 'Cancelar'}
          onCancel={onClose}
        />
      </RecordForm>
    </InlineForm>
  );
}

/** Histórico de receitas e despesas; reutiliza os comandos de movimentação. */
export function MovementsPanel({
  records,
  today,
  month,
  onMonthChange,
  onEdit,
  run,
  onDelete,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  month: string;
  onMonthChange: (month: string) => void;
  onEdit: (draft: MovementDraft) => void;
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
}) {
  return (
    <div className="finance-area">
      <p className="record-hint">
        Receitas aumentam e despesas diminuem o saldo disponível.
      </p>
      <Disclosure title="Histórico de movimentações">
        <MovementHistory
          records={records}
          today={today}
          month={month}
          onMonthChange={onMonthChange}
          onEdit={(id) => {
            const item = records.movements.find((value) => value.id === id);
            if (item) onEdit({ id, kind: item.kind });
          }}
          run={run}
          onDelete={onDelete}
        />
      </Disclosure>
    </div>
  );
}

function MovementHistory({
  records,
  today,
  month,
  onMonthChange,
  onEdit,
  run,
  onDelete,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  month: string;
  onMonthChange: (month: string) => void;
  onEdit: (id: string) => void;
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
}) {
  const [filters, setFilters] = useState<Omit<MovementFilters, 'month'>>({
    kind: ALL,
    accountId: ALL,
    category: ALL,
  });
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const update = (next: Partial<Omit<MovementFilters, 'month'>>) => {
    setFilters((value) => ({ ...value, ...next }));
    setLimit(HISTORY_PAGE_SIZE);
  };
  const items = filterMovements(records.movements, { ...filters, month });
  return (
    <>
      <div
        className="finance-filters"
        role="group"
        aria-label="Filtros de movimentações"
      >
        <Field label="Mês do histórico">
          <CustomDatePicker
            label="Mês do histórico"
            mode="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={(value) => {
              onMonthChange(value);
              setLimit(HISTORY_PAGE_SIZE);
            }}
          />
        </Field>
        <Field label="Tipo">
          <CustomSelect
            label="Tipo"
            value={filters.kind}
            onChange={(kind) => update({ kind })}
            options={[
              { value: ALL, label: 'Receitas e despesas' },
              { value: 'income', label: 'Receitas' },
              { value: 'expense', label: 'Despesas' },
            ]}
          />
        </Field>
        <Field label="Categoria">
          <CustomSelect
            label="Categoria"
            value={filters.category}
            onChange={(category) => update({ category })}
            options={[
              { value: ALL, label: 'Todas as categorias' },
              ...movementCategories(records.movements).map((category) => ({
                value: category,
                label: category,
              })),
            ]}
          />
        </Field>
      </div>
      <p className="record-hint" aria-live="polite">
        {plural(items.length, 'movimentação', 'movimentações')} em{' '}
        {displayMonth(month)}.
      </p>
      <ul className="record-list">
        {items.slice(0, limit).map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.description}</strong>
              <p>
                {displayDate(item.date)} · {item.category} ·{' '}
                {item.kind === 'income' ? 'Receita' : 'Despesa'} ·{' '}
                {money(item.amountCents)}
              </p>
            </div>
            <div className="record-actions">
              <button
                type="button"
                onClick={() => onEdit(item.id)}
                aria-label={`Editar ${item.description}`}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() =>
                  onDelete({
                    title: 'Excluir movimentação',
                    description: `${item.description} · ${displayDate(item.date)} · ${money(item.amountCents)}. A exclusão recalcula saldos, resultado mensal e progresso.`,
                    confirm: 'Confirmar exclusão',
                    run: () => run({ type: 'deleteMovement', id: item.id }),
                  })
                }
                aria-label={`Excluir ${item.description}`}
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!items.length && (
        <Empty>
          {records.movements.some((item) => item.date.startsWith(`${month}-`))
            ? 'Nenhuma movimentação com os filtros selecionados.'
            : 'Nenhuma movimentação neste mês.'}
        </Empty>
      )}
      {items.length > limit && (
        <button
          type="button"
          className="filter-button finance-more"
          onClick={() => setLimit((value) => value + HISTORY_PAGE_SIZE)}
        >
          Mostrar mais movimentações
        </button>
      )}
    </>
  );
}

function displayMonth(month: string) {
  const [year, value] = month.split('-');
  return `${value}/${year}`;
}
