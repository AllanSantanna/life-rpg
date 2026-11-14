import { useRef } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { Icon } from '../../shared/components/Icon';
import { goalPillars } from './types';
import {
  pillarIcons,
  questOrders,
  questStatuses,
  type QuestFilters as Filters,
} from './questList';

export function QuestFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  return (
    <div className="quest-controls">
      <div className="quest-controls__top">
        <label className="quest-search">
          <Icon name="search" size={18} />
          <span className="sr-only">Buscar quests por título ou descrição</span>
          <input
            ref={search}
            type="search"
            placeholder="Buscar quest..."
            value={value.search}
            onChange={(event) =>
              onChange({ ...value, search: event.target.value })
            }
          />
        </label>
        {value.search && (
          <button
            type="button"
            className="quest-clear-search"
            aria-label="Limpar busca"
            onClick={() => {
              onChange({ ...value, search: '' });
              search.current?.focus();
            }}
          >
            <Icon name="close" size={16} />
            <span>Limpar</span>
          </button>
        )}
        <CustomSelect
          label="Ordenar quests"
          value={value.order}
          compact
          icon="sort"
          options={(
            Object.entries(questOrders) as [Filters['order'], string][]
          ).map(([order, label]) => ({ value: order, label }))}
          onChange={(order) => onChange({ ...value, order })}
        />
      </div>
      <fieldset className="quest-filter" aria-label="Filtrar quests por pilar">
        <legend>Pilar</legend>
        <div className="quest-chips">
          <button
            type="button"
            className="quest-chip"
            aria-pressed={value.pillar === 'all'}
            onClick={() => onChange({ ...value, pillar: 'all' })}
          >
            Todos
          </button>
          {goalPillars.map((pillar) => (
            <button
              type="button"
              key={pillar}
              data-area={pillar}
              className="quest-chip"
              aria-pressed={value.pillar === pillar}
              onClick={() => onChange({ ...value, pillar })}
            >
              <Icon name={pillarIcons[pillar]} size={14} />
              {pillar}
            </button>
          ))}
        </div>
      </fieldset>
      {!value.archived && (
        <fieldset
          className="quest-filter"
          aria-label="Filtrar quests por status"
        >
          <legend>Status</legend>
          <div className="quest-chips">
            {questStatuses.map(([status, label]) => (
              <button
                type="button"
                key={status}
                className="quest-chip quest-chip--status"
                aria-pressed={value.status === status}
                onClick={() => onChange({ ...value, status })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
