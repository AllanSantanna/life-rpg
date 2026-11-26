import { useState } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { Field } from '../records/RecordUI';
import { FinanceHelp } from './FinanceHelp';
import {
  DEFAULT_CATEGORY,
  otherCategories,
  recentCategories,
} from './categories';
import type { MoneyMovement } from './types';

/**
 * Categoria de receita/despesa: texto livre (preserva categorias
 * personalizadas), com atalhos para as até cinco categorias recentes do tipo e
 * a lista das demais categorias existentes, sem repetição entre as duas.
 * As listas são derivadas do histórico; nada é gravado além do texto escolhido.
 */
export function CategoryField({
  movements,
  kind,
  defaultValue,
  label = 'Categoria da movimentação',
}: {
  movements: readonly MoneyMovement[];
  kind: MoneyMovement['kind'];
  defaultValue?: string | undefined;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? DEFAULT_CATEGORY);
  const recent = recentCategories(movements, kind);
  const others = otherCategories(movements, recent, [DEFAULT_CATEGORY]);
  const current = value.trim();
  return (
    <div className="finance-category">
      <Field label={label}>
        <input
          name="category"
          required
          maxLength={200}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      {recent.length > 0 && (
        <div className="finance-category__recent">
          <span className="finance-category__title" aria-hidden="true">
            Recentes
          </span>
          <FinanceHelp topic="categories" />
          <div
            className="finance-category__chips"
            role="group"
            aria-label={`Categorias recentes de ${kind === 'income' ? 'receitas' : 'despesas'}`}
          >
            {recent.map((category) => (
              <button
                type="button"
                key={category}
                className={`filter-button${current === category ? ' active' : ''}`}
                aria-pressed={current === category}
                onClick={() => setValue(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <Field label="Todas as categorias">
          <CustomSelect
            label="Todas as categorias"
            value={others.includes(current) ? current : ''}
            onChange={(next) => {
              if (next) setValue(next);
            }}
            options={[
              { value: '', label: 'Escolher outra categoria' },
              ...others.map((category) => ({
                value: category,
                label: category,
              })),
            ]}
          />
        </Field>
      )}
    </div>
  );
}
