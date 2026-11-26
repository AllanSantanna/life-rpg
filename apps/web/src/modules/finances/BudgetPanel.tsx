import { useMemo, useRef, useState } from 'react';
import { ActionButton } from '../../shared/components/ActionButton';
import { HelpHeading } from '../../shared/components/ContextHelp';
import { FinanceHelp } from './FinanceHelp';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { formCents, formText, newId } from '../records/form';
import { Actions, Empty, Field, RecordForm } from '../records/RecordUI';
import type { RecordCommand, RecordPageProps } from '../records/types';
import { budgetProgress, type BudgetProgress } from './budget';
import { money } from './calculations';
import { CategoryField } from './CategoryField';
import type { PendingDeletion } from './DeleteConfirmation';
import { InlineForm } from './FinanceLayout';
import { MoneyInput } from './MoneyInput';
import { unitsToDecimal } from './monetary';

const levelText: Record<BudgetProgress['level'], string> = {
  normal: 'Dentro do limite',
  attention: 'Atenção: 80% ou mais do limite',
  exceeded: 'Limite atingido ou ultrapassado',
};

function displayMonth(month: string) {
  const [year, value] = month.split('-');
  return `${value}/${year}`;
}

/**
 * Orçamento mensal por categoria de despesa, no mês do Período da Carteira.
 * O limite é recorrente e vale do mês configurado em diante; meses anteriores
 * são consultados como foram configurados (somente leitura). Ultrapassar o
 * limite apenas muda o estado visual: nenhuma despesa é bloqueada.
 */
export function BudgetPanel({
  records,
  today,
  month,
  run,
  onDelete,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  month: string;
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
}) {
  const [editing, setEditing] = useState<{ category: string | null } | null>(
    null,
  );
  const budgets = records.finance?.budgets;
  const progress = useMemo(
    () => budgetProgress(budgets ?? [], records.movements, month),
    [budgets, records.movements, month],
  );
  // Configuração a partir do mês atual; meses passados ficam preservados.
  const editable = month >= today.slice(0, 7);
  const current = progress.find(
    (item) => item.budget.category === editing?.category,
  );
  return (
    <section
      className="panel record-section finance-budget"
      aria-labelledby="finance-budget-title"
    >
      <div className="finance-section-head">
        <HelpHeading
          id="finance-budget-title"
          title={`Orçamento mensal · ${displayMonth(month)}`}
          help={<FinanceHelp topic="budget" />}
        />
        {editable && (
          <ActionButton
            icon="plus"
            onClick={() => setEditing({ category: null })}
          >
            Definir limite
          </ActionButton>
        )}
      </div>
      {!editable && (
        <p className="record-hint">
          Mês anterior: limites exibidos como estavam configurados, somente
          leitura.
        </p>
      )}
      {editing && editable && (
        <BudgetForm
          key={editing.category ?? 'new'}
          records={records}
          month={month}
          category={editing.category}
          limitCents={current?.budget.limitCents}
          run={run}
          onClose={() => setEditing(null)}
        />
      )}
      {progress.length ? (
        <ul className="finance-budget__list">
          {progress.map((item) => (
            <li
              key={item.budget.id}
              className="finance-budget__item"
              data-level={item.level}
            >
              <div className="finance-budget__head">
                <strong>{item.budget.category}</strong>
                <span>
                  {money(item.spentCents)} de {money(item.budget.limitCents)}{' '}
                  utilizados · {item.percent}%
                </span>
              </div>
              <ProgressBar
                label={`Orçamento de ${item.budget.category}: ${item.percent}% utilizado`}
                value={Math.min(item.spentCents, item.budget.limitCents)}
                max={item.budget.limitCents}
              />
              <p className="finance-budget__status">
                <span className="finance-budget__level">
                  {levelText[item.level]}
                </span>{' '}
                ·{' '}
                {item.remainingCents >= 0
                  ? `Restam ${money(item.remainingCents)}`
                  : `Excedido em ${money(-item.remainingCents)}`}
              </p>
              {editable && (
                <div className="record-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ category: item.budget.category })
                    }
                    aria-label={`Editar limite de ${item.budget.category}`}
                  >
                    Editar limite
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDelete({
                        title: 'Remover limite',
                        description: `${item.budget.category}: o limite deixa de valer a partir de ${displayMonth(month)}. Meses anteriores e as despesas registradas não mudam.`,
                        confirm: 'Confirmar remoção',
                        run: () => {
                          const error = run({
                            type: 'removeBudget',
                            category: item.budget.category,
                            month,
                          });
                          if (
                            !error &&
                            editing?.category === item.budget.category
                          )
                            setEditing(null);
                          return error;
                        },
                      })
                    }
                    aria-label={`Remover limite de ${item.budget.category}`}
                  >
                    Remover
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          {editable
            ? 'Nenhum limite definido. Use “Definir limite” para acompanhar uma categoria de despesa.'
            : 'Nenhum limite configurado neste mês.'}
        </Empty>
      )}
    </section>
  );
}

function BudgetForm({
  records,
  month,
  category,
  limitCents,
  run,
  onClose,
}: Pick<RecordPageProps, 'records'> & {
  month: string;
  category: string | null;
  limitCents?: number | undefined;
  run: (command: RecordCommand) => string | null;
  onClose: () => void;
}) {
  const saved = useRef(false);
  return (
    <InlineForm>
      <RecordForm
        title={category ? `Editar limite · ${category}` : 'Definir limite'}
        onSubmit={(data) => {
          if (saved.current) return null;
          const error = run({
            type: 'setBudget',
            id: newId(),
            category: category ?? formText(data, 'category'),
            limitCents: formCents(data, 'limit'),
            month,
          });
          if (!error) {
            saved.current = true;
            onClose();
          }
          return error;
        }}
      >
        <div className="record-fields">
          {!category && (
            <CategoryField
              movements={records.movements}
              kind="expense"
              label="Categoria de despesa"
            />
          )}
          <Field label="Limite mensal (R$)">
            <MoneyInput
              name="limit"
              required
              defaultValue={
                limitCents !== undefined ? unitsToDecimal(limitCents, 2) : ''
              }
            />
          </Field>
        </div>
        <p className="record-hint">
          Vale a partir de {displayMonth(month)}; meses anteriores mantêm o
          limite que tinham.
        </p>
        <Actions
          submit={category ? 'Salvar limite' : 'Adicionar limite'}
          cancel="Cancelar"
          onCancel={onClose}
        />
      </RecordForm>
    </InlineForm>
  );
}
