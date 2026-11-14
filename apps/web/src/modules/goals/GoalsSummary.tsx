import type { DashboardGoal } from './dashboardGoals';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { SectionHeading } from '../../shared/components/SectionHeading';
import { displayDate } from '../records/dates';
import { formatGoalValue } from './format';

export function GoalsSummary({
  items,
  onOpen,
  onOpenGoal,
}: {
  items: readonly DashboardGoal[];
  onOpen: () => void;
  onOpenGoal: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="panel goals-summary" aria-label="Minhas Quests">
      <SectionHeading title="Minhas Quests" eyebrow="Objetivos personalizados">
        <button type="button" className="text-action" onClick={onOpen}>
          Ver todas
        </button>
      </SectionHeading>
      <ul>
        {items.slice(0, 5).map(({ goal, cycle, due }) => (
          <li key={goal.id} data-area={goal.pillar}>
            <a
              className="goal-summary-link"
              href={`/quests?quest=${encodeURIComponent(goal.id)}`}
              aria-label={`Abrir detalhes da quest ${goal.title}`}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                onOpenGoal(goal.id);
              }}
            >
              <div className="goal-summary-heading">
                <strong>{goal.title}</strong>
                <span>{Math.round(cycle.percent)}%</span>
              </div>
              <div className="goal-summary-meta">
                <span className="goal-summary-pillar">{goal.pillar}</span>
                {due && (
                  <span>
                    {cycle.status === 'overdue'
                      ? 'Prazo vencido: '
                      : goal.deadline
                        ? 'Prazo: '
                        : 'Ciclo até: '}
                    <time dateTime={due}>{displayDate(due)}</time>
                  </span>
                )}
              </div>
              <ProgressBar
                label={`Resumo da quest ${goal.title}`}
                value={cycle.percent}
                max={100}
              />
              <p className="record-hint">
                {goal.kind === 'completion'
                  ? 'A concluir'
                  : `${formatGoalValue(cycle.value, goal.unit)} / ${formatGoalValue(goal.target, goal.unit)}`}
              </p>
            </a>
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <p className="record-hint">
          Mais {items.length - 5} {items.length === 6 ? 'quest' : 'quests'} na
          página de Quests.
        </p>
      )}
    </section>
  );
}
