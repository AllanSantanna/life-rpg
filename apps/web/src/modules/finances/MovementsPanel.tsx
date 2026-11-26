import { useDeferredValue, useMemo, useRef, useState } from 'react';
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
import { CategoryField } from './CategoryField';
import { InlineForm, SwitchField } from './FinanceLayout';
import { movementFromForm } from './financeForms';
import {
  ALL,
  filterMovements,
  HISTORY_PAGE_SIZE,
  matchesSearch,
  movementCategories,
  type MovementFilters,
} from './historyFilters';
import { MoneyInput } from './MoneyInput';
import { unitsToDecimal } from './monetary';
import { frequencyLabels, occurrenceMovementId } from './recurrence';
import type { MoneyMovement, RecurrenceFrequency } from './types';
import { walletOperations } from './walletLink';

/** Rascunho do formulário: `id` nulo cria; texto edita a movimentação. */
export interface MovementDraft {
  id: string | null;
  kind: MoneyMovement['kind'];
  /**
   * Valores iniciais de uma nova movimentação (Repetir ou confirmação de
   * recorrência). Não inclui IDs, conta ou vínculos do registro de origem.
   */
  prefill?: Pick<MoneyMovement, 'description' | 'amountCents' | 'category'> & {
    date?: string;
  };
  /** Ocorrência de recorrência confirmada ao salvar. */
  occurrence?: { ruleId: string; date: string };
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
  const occurrence = movement ? undefined : draft.occurrence;
  const initial = movement ?? draft.prefill;
  const [kind, setKind] = useState(movement?.kind ?? draft.kind);
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const confirmLabel =
    draft.kind === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento';
  return (
    <InlineForm>
      <RecordForm
        title={
          movement
            ? 'Editar movimentação'
            : occurrence
              ? confirmLabel
              : 'Nova movimentação'
        }
        onSubmit={(data) => {
          // Evita gravar duas vezes por cliques repetidos antes de fechar.
          if (saved.current) return null;
          let command: RecordCommand;
          if (occurrence) {
            const id = occurrenceMovementId(occurrence.ruleId, occurrence.date);
            command = {
              type: 'confirmRecurrence',
              value: { ...movementFromForm(data, id), recurrence: occurrence },
            };
          } else if (!movement && repeat) {
            const ruleId = newId();
            const first = movementFromForm(data, '');
            const link = { ruleId, date: first.date };
            command = {
              type: 'saveRecurrence',
              rule: {
                id: ruleId,
                kind: first.kind,
                description: first.description,
                amountCents: first.amountCents,
                category: first.category,
                frequency,
                startDate: first.date,
                status: 'active',
              },
              firstMovement: {
                ...first,
                id: occurrenceMovementId(ruleId, first.date),
                recurrence: link,
              },
            };
          } else {
            const value = movementFromForm(data, movement?.id ?? newId());
            command = {
              type: 'saveMovement',
              // A edição preserva o vínculo de uma ocorrência confirmada.
              value: movement?.recurrence
                ? { ...value, recurrence: movement.recurrence }
                : value,
            };
          }
          const error = run(command);
          if (!error) {
            saved.current = true;
            onClose();
          }
          return error;
        }}
      >
        <div className="record-fields">
          {occurrence ? (
            <input type="hidden" name="kind" value={draft.kind} />
          ) : (
            <Field label="Tipo de movimentação">
              <CustomSelect
                label="Tipo de movimentação"
                name="kind"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'income', label: 'Receita' },
                  { value: 'expense', label: 'Despesa' },
                ]}
              />
            </Field>
          )}
          <Field label="Descrição">
            <input
              name="description"
              maxLength={200}
              required
              defaultValue={initial?.description}
            />
          </Field>
          <Field label="Valor (R$)">
            <MoneyInput
              name="amount"
              required
              defaultValue={
                initial ? unitsToDecimal(initial.amountCents, 2) : ''
              }
            />
          </Field>
          <CategoryField
            movements={records.movements}
            kind={kind}
            defaultValue={initial?.category}
          />
          <DateField
            today={today}
            value={movement?.date ?? draft.prefill?.date}
            label={occurrence ? 'Data do pagamento ou recebimento' : 'Data'}
          />
          {movement?.accountId !== undefined && (
            <input type="hidden" name="accountId" value={movement.accountId} />
          )}
        </div>
        {occurrence && (
          <p className="record-hint">
            Ocorrência prevista para {displayDate(occurrence.date)}. Ao
            confirmar, a movimentação real entra no saldo, no histórico e no
            orçamento; confirmar de novo não a duplica.
          </p>
        )}
        {!movement && !occurrence && (
          <div className="finance-repeat">
            <SwitchField
              label="Repetir periodicamente"
              description="Registra esta movimentação e prevê as próximas, sem alterar o saldo até a confirmação."
              checked={repeat}
              onChange={setRepeat}
            />
            {repeat && (
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
            )}
          </div>
        )}
        <Actions
          submit={
            movement
              ? 'Salvar movimentação'
              : occurrence
                ? confirmLabel
                : 'Adicionar movimentação'
          }
          cancel={movement ? 'Cancelar edição' : 'Cancelar'}
          onCancel={onClose}
        />
      </RecordForm>
    </InlineForm>
  );
}

type KindFilter = MovementFilters['kind'] | 'internal';
const kindFilters: readonly { value: KindFilter; label: string }[] = [
  { value: ALL, label: 'Todas' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'internal', label: 'Internas' },
];

/**
 * Histórico de receitas e despesas na aba Carteira, recolhido por padrão. O período é
 * o mesmo mês dos indicadores mensais; tipo fica à vista e categoria em
 * “Filtros avançados”. A pesquisa rápida fica acima do histórico e o abre ao
 * digitar. “Internas” lista, somente para consulta, os aportes e retiradas que
 * movimentaram a Carteira (gerenciados na aba Investimentos), sem misturá-los
 * às receitas e despesas. Reutiliza os comandos de movimentação.
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
  const [filters, setFilters] = useState<{
    kind: KindFilter;
    accountId: string;
    category: string;
  }>({
    kind: ALL,
    accountId: ALL,
    category: ALL,
  });
  const [query, setQuery] = useState('');
  // Ao começar uma pesquisa, o histórico recolhido é aberto (nova montagem).
  const [searchOpened, setSearchOpened] = useState(0);
  const deferredQuery = useDeferredValue(query);
  // A paginação recomeça ao trocar de mês ou de filtro.
  const [page, setPage] = useState({ month, limit: HISTORY_PAGE_SIZE });
  const limit = page.month === month ? page.limit : HISTORY_PAGE_SIZE;
  const update = (next: Partial<typeof filters>) => {
    setFilters((value) => ({ ...value, ...next }));
    setPage({ month, limit: HISTORY_PAGE_SIZE });
  };
  const search = (value: string) => {
    if (!query.trim() && value.trim()) setSearchOpened((n) => n + 1);
    setQuery(value);
    setPage({ month, limit: HISTORY_PAGE_SIZE });
  };
  const internal = filters.kind === 'internal';
  const items = useMemo(
    () =>
      internal
        ? []
        : filterMovements(records.movements, {
            ...filters,
            kind: filters.kind as MovementFilters['kind'],
            month,
            query: deferredQuery,
          }),
    [records.movements, filters, month, deferredQuery, internal],
  );
  const operations = useMemo(
    () =>
      internal && filters.category === ALL
        ? walletOperations(records)
            .filter(
              (item) =>
                item.date.startsWith(`${month}-`) &&
                matchesSearch(
                  { description: item.name, category: 'Investimentos' },
                  deferredQuery,
                ),
            )
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [records, internal, filters.category, month, deferredQuery],
  );
  const count = internal ? operations.length : items.length;
  const searching = deferredQuery.trim();
  const edit = (id: string) => {
    const item = records.movements.find((value) => value.id === id);
    if (item) onEdit({ id, kind: item.kind });
  };
  /** Repetir: nova movimentação com os dados de origem e a data de hoje. */
  const repeat = (item: MoneyMovement) =>
    onEdit({
      id: null,
      kind: item.kind,
      prefill: {
        description: item.description,
        amountCents: item.amountCents,
        category: item.category,
      },
    });
  return (
    <div className="finance-history-area">
      <div className="finance-search" role="search">
        <Field label="Pesquisar no histórico">
          <input
            type="search"
            name="movementSearch"
            placeholder="Buscar movimentações..."
            autoComplete="off"
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                search('');
              }
            }}
          />
        </Field>
        {query && (
          <button
            type="button"
            className="filter-button finance-search__clear"
            onClick={() => search('')}
            aria-label="Limpar pesquisa"
          >
            Limpar
          </button>
        )}
      </div>
      {/* Começa recolhido; o usuário abre quando quiser. Filtros e paginação
          ficam neste componente e sobrevivem ao recolher/expandir. */}
      <Disclosure
        key={searchOpened}
        defaultOpen={searchOpened > 0}
        title="Histórico de movimentações"
        className="panel record-section finance-history"
      >
        <div
          className="finance-filters finance-filters--compact"
          role="group"
          aria-label="Filtros de movimentações"
        >
          <div
            className="finance-segmented finance-segmented--four"
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
          {internal
            ? plural(count, 'movimento interno', 'movimentos internos')
            : plural(count, 'movimentação', 'movimentações')}{' '}
          em {displayMonth(month)}
          {filters.category !== ALL ? ` · categoria ${filters.category}` : ''}
          {searching ? ` · pesquisa “${searching}”` : ''}.
        </p>
        {internal && (
          <p className="record-hint">
            Aportes e retiradas vinculados à Carteira: não são receitas nem
            despesas e não entram no orçamento. Edite ou exclua pela aba
            Investimentos, que atualiza os dois lados juntos.
          </p>
        )}
        <ul className="record-list">
          {internal
            ? operations.slice(0, limit).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>
                      {item.kind === 'contribution'
                        ? `Aporte em ${item.name}`
                        : `Retirada de ${item.name}`}
                    </strong>
                    <p>
                      {displayDate(item.date)} ·{' '}
                      {item.kind === 'contribution'
                        ? 'Saída da Carteira'
                        : 'Entrada na Carteira'}{' '}
                      · {money(item.amountCents)}
                    </p>
                  </div>
                </li>
              ))
            : items.slice(0, limit).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.description}</strong>
                    <p>
                      {displayDate(item.date)} · {item.category} ·{' '}
                      {item.kind === 'income' ? 'Receita' : 'Despesa'} ·{' '}
                      {money(item.amountCents)}
                      {item.recurrence ? ' · Recorrente' : ''}
                    </p>
                  </div>
                  <div className="record-actions">
                    <button
                      type="button"
                      onClick={() => repeat(item)}
                      aria-label={`Repetir ${item.description}`}
                    >
                      Repetir
                    </button>
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
                          description: `${item.description} · ${displayDate(item.date)} · ${money(item.amountCents)}. A exclusão recalcula saldos, resultado mensal, orçamento e progresso.${item.recurrence ? ' A ocorrência da recorrência volta a ficar pendente.' : ''}`,
                          confirm: 'Confirmar exclusão',
                          run: () =>
                            run({ type: 'deleteMovement', id: item.id }),
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
        {!count && (
          <Empty>
            {searching
              ? `Nenhuma movimentação encontrada para “${searching}” com os filtros selecionados.`
              : internal
                ? 'Nenhum aporte ou retirada vinculado à Carteira neste mês.'
                : records.movements.some((item) =>
                      item.date.startsWith(`${month}-`),
                    )
                  ? 'Nenhuma movimentação com os filtros selecionados.'
                  : 'Nenhuma movimentação neste mês. Use “Adicionar receita” ou “Adicionar despesa”.'}
          </Empty>
        )}
        {count > limit && (
          <button
            type="button"
            className="filter-button finance-more"
            onClick={() => setPage({ month, limit: limit + HISTORY_PAGE_SIZE })}
          >
            Mostrar mais movimentações
          </button>
        )}
      </Disclosure>
    </div>
  );
}

function displayMonth(month: string) {
  const [year, value] = month.split('-');
  return `${value}/${year}`;
}
