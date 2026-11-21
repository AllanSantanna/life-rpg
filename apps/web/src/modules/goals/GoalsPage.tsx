import { ActionButton } from '../../shared/components/ActionButton';
import { useRef, useState } from 'react';
import type { LifeRecords } from '../records/types';
import {
  goalPillars,
  type GoalDefinition,
  type GoalState,
  type GoalCommand,
} from './types';
import { blankGoal, goalTemplates } from './templates';
import { GoalForm } from './GoalForm';
import { GoalCard } from './GoalCard';
import { QuestFilters } from './QuestFilters';
import { defaultQuestFilters, pillarIcons, selectQuests } from './questList';
import { definitionOf } from './commands';
import { newId } from '../records/form';
import { Icon } from '../../shared/components/Icon';

export function GoalsPage({
  state,
  records,
  today,
  onCommand,
  rewards,
  selectedGoalId,
  onShowAll,
}: {
  selectedGoalId?: string | null;
  onShowAll?: () => void;
  state: GoalState;
  records: LifeRecords;
  today: string;
  onCommand: (c: GoalCommand) => string | null;
  rewards: { goalId: string; date: string; xp: number }[];
}) {
  const [draft, setDraft] = useState<{
    id: string;
    value: GoalDefinition;
    editing: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState(defaultQuestFilters);
  const formArea = useRef<HTMLDivElement>(null);
  function open(value: GoalDefinition, id: string = newId(), editing = false) {
    setDraft({ id, value, editing });
    setRevision((n) => n + 1);
    requestAnimationFrame(() => {
      formArea.current?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
      formArea.current
        ?.querySelector<HTMLInputElement>('input[name="title"]')
        ?.focus();
    });
  }
  const selectedGoal = selectedGoalId
    ? state.items.find((g) => g.id === selectedGoalId)
    : null;
  const visible = selectedGoalId
    ? selectedGoal
      ? [selectedGoal]
      : []
    : selectQuests(state, records, today, filters).map(({ goal }) => goal);
  const liveCount = state.items.filter((goal) => !goal.deletedOn).length;
  const archivedCount = state.items.length - liveCount;
  const hasFilters =
    filters.pillar !== 'all' || filters.status !== 'all' || !!filters.search;
  const templates = goalTemplates(today);
  const create = () => open(blankGoal(today));
  return (
    <div
      className={`pillar-page goals-page${selectedGoalId ? ' goals-page--detail' : ''}`}
    >
      {selectedGoalId && (
        <div className="goal-toolbar quest-page-heading">
          <h2>
            {selectedGoal ? 'Detalhes da quest' : 'Quest não encontrada.'}
          </h2>
          <button type="button" className="text-action" onClick={onShowAll}>
            Ver todas as quests
            <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
      {!selectedGoalId && (
        <header className="goal-toolbar quest-page-heading">
          <div>
            <p className="eyebrow">Sua jornada, suas escolhas</p>
            <h2>{filters.archived ? 'Quests excluídas' : 'Minhas Quests'}</h2>
            <p>Transforme seus próximos passos em conquistas reais.</p>
          </div>
          {(liveCount > 0 || filters.archived) && (
            <ActionButton icon="plus" onClick={create}>
              Criar minha quest
            </ActionButton>
          )}
        </header>
      )}
      <div ref={formArea} hidden={!draft}>
        {draft && (
          <GoalForm
            key={revision}
            value={draft.value}
            today={today}
            editing={draft.editing}
            onCancel={() => setDraft(null)}
            onSave={(definition) => {
              const error = onCommand({
                type: 'save',
                id: draft.id,
                definition,
              });
              if (!error) {
                setDraft(null);
                if (!draft.editing) setFilters(defaultQuestFilters);
              }
              return error;
            }}
          />
        )}
      </div>
      <section
        className="quest-collection"
        aria-label={
          selectedGoalId
            ? 'Detalhes da quest'
            : filters.archived
              ? 'Quests excluídas'
              : 'Minhas Quests'
        }
      >
        {!selectedGoalId && (liveCount > 0 || filters.archived) && (
          <QuestFilters value={filters} onChange={setFilters} />
        )}
        {!selectedGoalId && (
          <div className="quest-results-heading">
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Quantidade de quests encontradas"
            >
              <strong>{visible.length}</strong>{' '}
              {visible.length === 1 ? 'quest encontrada' : 'quests encontradas'}
            </p>
            {filters.archived ? (
              <button
                type="button"
                className="text-action"
                onClick={() => setFilters(defaultQuestFilters)}
              >
                Voltar às minhas quests
              </button>
            ) : (
              archivedCount > 0 && (
                <button
                  type="button"
                  className="text-action"
                  onClick={() =>
                    setFilters({ ...defaultQuestFilters, archived: true })
                  }
                >
                  <Icon name="trash" size={14} />
                  Ver quests excluídas ({archivedCount})
                </button>
              )
            )}
          </div>
        )}
        <div className="goal-grid">
          {visible.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              state={state}
              records={records}
              today={today}
              onCommand={onCommand}
              onEdit={() => open(definitionOf(goal), goal.id, true)}
              rewards={rewards.filter((r) => r.goalId === goal.id)}
            />
          ))}
        </div>
        {!selectedGoalId && !visible.length && (
          <div className="panel quest-empty">
            <span className="quest-empty__icon">
              <Icon
                name={
                  liveCount === 0 && !filters.archived ? 'target' : 'search'
                }
                size={30}
              />
            </span>
            <h3>
              {liveCount === 0 && !filters.archived
                ? 'Sua próxima conquista começa aqui'
                : 'Nenhuma quest encontrada'}
            </h3>
            <p>
              {liveCount === 0 && !filters.archived
                ? 'Crie uma quest do seu jeito ou adapte uma sugestão. Você escolhe o próximo passo.'
                : filters.archived
                  ? 'Nenhuma quest excluída corresponde à busca.'
                  : 'Experimente outro pilar, status ou termo de busca.'}
            </p>
            {liveCount === 0 && !filters.archived ? (
              <ActionButton icon="plus" onClick={create}>
                Criar minha quest
              </ActionButton>
            ) : (
              hasFilters && (
                <button
                  type="button"
                  className="text-action"
                  onClick={() =>
                    setFilters({
                      ...defaultQuestFilters,
                      archived: filters.archived,
                    })
                  }
                >
                  Limpar filtros e busca
                </button>
              )
            )}
          </div>
        )}
      </section>
      {!selectedGoalId && (
        <details className="panel quest-suggestions">
          <summary>
            <Icon name="sparkle" size={20} />
            <span>
              Quests sugeridas<small>Inspiração para o seu próximo passo</small>
            </span>
            <Icon name="chevron" size={17} />
          </summary>
          <p className="record-hint">
            Modelos opcionais e totalmente editáveis. A quest só será criada
            após sua confirmação.
          </p>
          <div className="goal-template-grid">
            {goalPillars.map((pillar) => (
              <section key={pillar} data-area={pillar}>
                <h3>
                  <Icon name={pillarIcons[pillar]} size={16} />
                  {pillar}
                </h3>
                {templates
                  .filter((t) => t.pillar === pillar)
                  .map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      onClick={() => open({ ...template })}
                    >
                      <span className="sr-only">Usar modelo: </span>
                      {template.title}
                      <Icon name="plus" size={14} />
                    </button>
                  ))}
              </section>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
