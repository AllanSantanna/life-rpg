import { useRef, useState } from 'react';
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

const kindFilters = [
  { value: ALL, label: 'Todas' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
] as const;

/**
 * Histórico de receitas e despesas na aba Carteira, recolhido por padrão. O período é
 * o mesmo mês dos indicadores mensais; tipo fica à vista e categoria em
 * “Filtros avançados”. Reutiliza os comandos de movimentação.
 */
export function MovementsPanel({
  records,
  month,
  onEdit,
  run,
  onDelete,
}: Pick<RecordPageProps, 'records'> & {
  month: string;
  onEdit: (draft: MovementDraft) => void;
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
}) {
  const [filters, setFilters] = useState<Omit<MovementFilters, 'month'>>({
    kind: ALL,
    accountId: ALL,
    category: ALL,
  });
  // A paginação recomeça ao trocar de mês ou de filtro.
  const [page, setPage] = useState({ month, limit: HISTORY_PAGE_SIZE });
  const limit = page.month === month ? page.limit : HISTORY_PAGE_SIZE;
  const update = (next: Partial<Omit<MovementFilters, 'month'>>) => {
    setFilters((value) => ({ ...value, ...next }));
    setPage({ month, limit: HISTORY_PAGE_SIZE });
  };
  const items = filterMovements(records.movements, { ...filters, month });
  const edit = (id: string) => {
    const item = records.movements.find((value) => value.id === id);
    if (item) onEdit({ id, kind: item.kind });
  };
  return (
    // Começa recolhido; o usuário abre quando quiser. Filtros e paginação ficam
    // neste componente e sobrevivem ao recolher/expandir.
    <Disclosure
      title="Histórico de movimentações"
      className="panel record-section finance-history"
    >
      <div
        className="finance-filters finance-filters--compact"
        role="group"
        aria-label="Filtros de movimentações"
      >
        <div
          className="finance-segmented"
          role="group"
          aria-label="Tipo de movimentação do histórico"
        >
          {kindFilters.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`filter-button${filters.kind === option.value ? ' active' : ''}`}
              aria-pressed={filters.kind === option.value}
              onClick={() => update({ kind: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Disclosure
          title="Filtros avançados"
          level={3}
          variant="text"
          className="finance-advanced-filters"
        >
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
        </Disclosure>
      </div>
      <p className="record-hint" aria-live="polite">
        {plural(items.length, 'movimentação', 'movimentações')} em{' '}
        {displayMonth(month)}
        {filters.category !== ALL ? ` · categoria ${filters.category}` : ''}.
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
                onClick={() => edit(item.id)}
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
            : 'Nenhuma movimentação neste mês. Use “Adicionar receita” ou “Adicionar despesa”.'}
        </Empty>
      )}
      {items.length > limit && (
        <button
          type="button"
          className="filter-button finance-more"
          onClick={() => setPage({ month, limit: limit + HISTORY_PAGE_SIZE })}
        >
          Mostrar mais movimentações
        </button>
      )}
    </Disclosure>
  );
}

function displayMonth(month: string) {
  const [year, value] = month.split('-');
  return `${value}/${year}`;
}
