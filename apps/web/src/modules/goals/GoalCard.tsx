import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { useState } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import type { LifeRecords } from '../records/types';
import type { Goal, GoalCommand, GoalState } from './types';
import { difficultyXP } from './types';
import { pillarIcons, questStatus } from './questList';
import { Icon } from '../../shared/components/Icon';
import { goalCycles, goalStatusLabel } from './progress';
import { openPause } from './cycles';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { Actions, Field, RecordForm } from '../records/RecordUI';
import { formText, newId } from '../records/form';
import { decimalToUnits } from '../finances/monetary';
import { MoneyInput } from '../finances/MoneyInput';
import { displayDate } from '../records/dates';
import { FinancialConfirmation } from '../finances/FinancialConfirmation';
import { formatGoalValue, cadenceLabel } from './format';
export function GoalCard({
  goal,
  state,
  records,
  today,
  onCommand,
  onEdit,
  rewards,
}: {
  goal: Goal;
  state: GoalState;
  records: LifeRecords;
  today: string;
  onCommand: (c: GoalCommand) => string | null;
  onEdit: () => void;
  rewards: { date: string; xp: number }[];
}) {
  const [updating, setUpdating] = useState(false),
    [deleting, setDeleting] = useState(false),
    [completion, setCompletion] = useState<'yes' | 'no'>('yes'),
    [message, setMessage] = useState(''),
    [historySize, setHistorySize] = useState(12);
  const cycles = goalCycles(goal, state, records, today),
    cycle = cycles.at(-1)!;
  const status = questStatus(goal, cycle);
  const earnedXP = rewards.reduce((sum, reward) => sum + reward.xp, 0);
  const paused = !!openPause(goal),
    deleted = !!goal.deletedOn;
  const updates = state.updates
    .filter((u) => u.goalId === goal.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const run = (c: GoalCommand) => {
    const error = onCommand(c);
    setMessage(error ?? 'Quest atualizada.');
    return error;
  };
  const noXp =
    goal.tracking === 'automatic' &&
    ['cash', 'wealth', 'investments'].includes(goal.metric ?? '');
  return (
    <article
      className="panel goal-card"
      data-area={goal.pillar}
      data-status={status}
      aria-label={`Quest ${goal.title}`}
    >
      <div className="goal-card__heading">
        <span className="quest-pillar">
          <span className="quest-pillar__icon">
            <Icon name={pillarIcons[goal.pillar]} size={18} />
          </span>
          {goal.pillar}
        </span>
        <span className="quest-status" data-status={status}>
          {deleted
            ? 'Excluída'
            : paused
              ? 'Pausada'
              : goalStatusLabel(cycle.status)}
        </span>
      </div>
      <h3 className="goal-card__title">{goal.title}</h3>
      {goal.description && (
        <p className="goal-card__description">{goal.description}</p>
      )}
      <div className="goal-card__progress">
        <div>
          <span className="quest-overline">Progresso do ciclo</span>
          <strong>
            {goal.kind === 'completion'
              ? cycle.completed
                ? 'Concluída'
                : 'A concluir'
              : `${formatGoalValue(cycle.value, goal.unit)} / ${formatGoalValue(goal.target, goal.unit)}`}
          </strong>
        </div>
        <span className="quest-percent">
          {Math.round(cycle.percent)}
          <small>%</small>
        </span>
      </div>
      <ProgressBar
        label={`Progresso de ${goal.title}`}
        value={cycle.percent}
        max={100}
      />
      <dl className="quest-schedule">
        <div>
          <dt>
            <Icon name="calendar" size={13} />
            Prazo
          </dt>
          <dd>
            {goal.deadline ? (
              <time dateTime={goal.deadline}>{displayDate(goal.deadline)}</time>
            ) : (
              'Sem prazo'
            )}
          </dd>
        </div>
        <div>
          <dt>Frequência</dt>
          <dd>{cadenceLabel(goal.cadence, goal.customDays)}</dd>
        </div>
        <div>
          <dt>Acompanhamento</dt>
          <dd>{goal.tracking === 'manual' ? 'Manual' : 'Automático'}</dd>
        </div>
      </dl>
      <div className="quest-reward">
        <span>
          <Icon name="sparkle" size={15} />
          {noXp ? 'Sem XP' : `Até ${difficultyXP[goal.difficulty]} XP / ciclo`}
        </span>
        {!noXp && <span>{earnedXP} XP conquistados</span>}
      </div>
      {!deleted && (
        <div className="quest-card-actions">
          {goal.tracking === 'manual' && (
            <button
              type="button"
              className="record-primary quest-progress-action"
              disabled={paused || goal.startDate > today}
              onClick={() => {
                setCompletion(cycle.completed ? 'no' : 'yes');
                setUpdating(true);
              }}
            >
              <Icon name={cycle.completed ? 'edit' : 'check'} size={16} />
              {goal.kind === 'completion'
                ? cycle.completed
                  ? 'Desfazer conclusão'
                  : 'Concluir quest'
                : 'Atualizar progresso'}
            </button>
          )}
          <div className="quest-card-tools">
            <button
              type="button"
              className="quest-icon-button"
              aria-label="Editar quest"
              title="Editar quest"
              onClick={onEdit}
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              type="button"
              className="quest-pause-button"
              onClick={() =>
                run({ type: paused ? 'resume' : 'pause', id: goal.id })
              }
            >
              <Icon name={paused ? 'play' : 'pause'} size={14} />
              {paused ? 'Retomar' : 'Pausar'}
            </button>
            <button
              type="button"
              className="quest-icon-button financial-danger"
              aria-label="Excluir quest"
              title="Excluir quest"
              onClick={() => setDeleting(true)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>
      )}
      {updating && !deleted && (
        <RecordForm
          title={`Atualizar progresso de ${goal.title}`}
          onSubmit={(data) => {
            const error = run({
              type: 'update',
              value: {
                id: newId(),
                goalId: goal.id,
                date: formText(data, 'date'),
                value:
                  goal.kind === 'completion'
                    ? formText(data, 'done') === 'yes'
                      ? 1000
                      : 0
                    : decimalToUnits(formText(data, 'value'), 3),
              },
            });
            if (!error) setUpdating(false);
            return error;
          }}
        >
          <div className="record-fields">
            {goal.kind === 'completion' ? (
              <Field label="Conclusão manual">
                <CustomSelect
                  label="Conclusão manual"
                  name="done"
                  value={completion}
                  onChange={setCompletion}
                  options={[
                    { value: 'yes', label: 'Concluí esta quest' },
                    { value: 'no', label: 'Ainda não concluí / desfazer' },
                  ]}
                />
              </Field>
            ) : (
              <Field label={`Progresso total do ciclo (${goal.unit})`}>
                {goal.unit === 'reais' ? (
                  <MoneyInput
                    name="value"
                    required
                    defaultValue={((cycle.value ?? 0) / 1000).toFixed(2)}
                  />
                ) : (
                  <input
                    name="value"
                    required
                    inputMode="decimal"
                    defaultValue={((cycle.value ?? 0) / 1000).toLocaleString(
                      'pt-BR',
                      { useGrouping: false, maximumFractionDigits: 3 },
                    )}
                  />
                )}
              </Field>
            )}
            <Field label="Data do progresso">
              <CustomDatePicker
                label="Data do progresso"
                name="date"
                required
                min={goal.startDate}
                max={
                  goal.deadline && goal.deadline < today ? goal.deadline : today
                }
                defaultValue={
                  goal.deadline && goal.deadline < today ? goal.deadline : today
                }
              />
            </Field>
          </div>
          <p className="record-hint">
            Informe o progresso total, não um acréscimo. Há uma atualização por
            quest/data; salvar de novo substitui o valor desse dia. Datas
            passadas podem corrigir ciclos anteriores.
          </p>
          <Actions
            submit="Salvar progresso"
            onCancel={() => setUpdating(false)}
          />
        </RecordForm>
      )}
      <details className="goal-history">
        <summary>Histórico de ciclos e atualizações</summary>
        <p className="record-hint">
          Ciclo atual: {displayDate(cycle.start)} a {displayDate(cycle.end)}.
        </p>
        <ul>
          {[...cycles]
            .reverse()
            .slice(0, historySize)
            .map((c) => (
              <li key={c.start}>
                {displayDate(c.start)} – {displayDate(c.end)} ·{' '}
                {goalStatusLabel(c.status)} ·{' '}
                {formatGoalValue(c.value, goal.unit)}
                {c.completedOn
                  ? ` · concluída em ${displayDate(c.completedOn)}`
                  : ''}
              </li>
            ))}
        </ul>
        {cycles.length > historySize && (
          <button type="button" onClick={() => setHistorySize((n) => n + 24)}>
            Ver ciclos anteriores
          </button>
        )}
        {updates.length > 0 && (
          <>
            <h3>Valores manuais informados</h3>
            <ul>
              {updates.map((u) => (
                <li key={u.id}>
                  {displayDate(u.date)} ·{' '}
                  {formatGoalValue(u.value, u.unit ?? goal.unit)}{' '}
                  {!deleted && (
                    <button
                      type="button"
                      onClick={() => run({ type: 'deleteUpdate', id: u.id })}
                    >
                      Excluir progresso de {displayDate(u.date)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {goal.pauses.length > 0 && (
          <>
            <h3>Pausas</h3>
            <ul>
              {goal.pauses.map((p, i) => (
                <li key={i}>
                  {displayDate(p.from)} –{' '}
                  {p.to ? displayDate(p.to) : 'em pausa'}
                </li>
              ))}
            </ul>
          </>
        )}
        {goal.revisions.length > 0 && (
          <>
            <h3>Configurações anteriores</h3>
            <ul>
              {goal.revisions.map((r, i) => (
                <li key={i}>
                  {displayDate(r.date)} · {r.definition.title} · alvo{' '}
                  {formatGoalValue(r.definition.target, r.definition.unit)} ·{' '}
                  {cadenceLabel(r.definition.cadence, r.definition.customDays)}
                  <RevisionCycles
                    goal={{ ...goal, ...r.definition }}
                    state={state}
                    records={records}
                    until={r.date}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        <h4>Sobre o acompanhamento</h4>
        <p className="record-hint">
          {noXp
            ? 'Posições patrimoniais não concedem XP.'
            : `Até ${difficultyXP[goal.difficulty]} XP por ciclo elegível, respeitando os limites diários e semanais. Atividades já premiadas não recebem XP novamente.`}{' '}
          Nenhum registro é criado nos pilares ao atualizar esta quest.
        </p>
        {goal.tracking === 'automatic' &&
          ['wealth', 'investments'].includes(goal.metric ?? '') && (
            <p className="record-hint">
              Usa as últimas avaliações e cotações conhecidas. Investimentos sem
              avaliação podem usar o custo como referência; confira as
              limitações em Finanças.
            </p>
          )}
      </details>
      {deleting && (
        <FinancialConfirmation
          title={`Excluir quest ${goal.title}`}
          onCancel={() => setDeleting(false)}
        >
          <p>
            A quest sairá da lista ativa e deixará de conceder XP. Seu histórico
            continuará em Quests excluídas. Nenhum registro dos pilares será
            apagado.
          </p>
          <button
            type="button"
            className="financial-danger"
            onClick={() => {
              if (!run({ type: 'delete', id: goal.id, confirmed: true }))
                setDeleting(false);
            }}
          >
            Confirmar exclusão da quest
          </button>
        </FinancialConfirmation>
      )}
      {message && (
        <p role="status" className="record-feedback">
          {message}
        </p>
      )}
    </article>
  );
}

function RevisionCycles({
  goal,
  state,
  records,
  until,
}: {
  goal: Goal;
  state: GoalState;
  records: LifeRecords;
  until: string;
}) {
  const [opened, setOpened] = useState(false),
    [limit, setLimit] = useState(12);
  const cycles = opened
    ? goalCycles(goal, state, records, until).reverse()
    : [];
  return (
    <details onToggle={(event) => setOpened(event.currentTarget.open)}>
      <summary>Ciclos desta configuração</summary>
      {opened && (
        <>
          <ul>
            {cycles.slice(0, limit).map((c) => (
              <li key={c.start}>
                {displayDate(c.start)} – {displayDate(c.end)} ·{' '}
                {goalStatusLabel(c.status)} ·{' '}
                {formatGoalValue(c.value, goal.unit)}
              </li>
            ))}
          </ul>
          {cycles.length > limit && (
            <button type="button" onClick={() => setLimit((n) => n + 24)}>
              Ver ciclos anteriores desta configuração
            </button>
          )}
        </>
      )}
    </details>
  );
}
