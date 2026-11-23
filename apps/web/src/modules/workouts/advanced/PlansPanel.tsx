import { useState } from 'react';
import { ActionButton } from '../../../shared/components/ActionButton';
import { Field } from '../../records/RecordUI';
import { displayDate } from '../../records/dates';
import { exerciseCatalog } from './catalog';
import { DeleteAction } from './Controls';
import { ExerciseManager } from './ExerciseManager';
import { PlanEditor } from './PlanEditor';
import { PlanWizard } from './PlanWizard';
import {
  parseSequence,
  planLetter,
  sequenceText,
  suggestedPlan,
} from './rotation';
import { Icon as WorkoutIcon } from '../../../shared/components/Icon';
import type {
  AdvancedCommandHandler,
  AdvancedWorkoutState,
  WorkoutPlan,
} from './types';
import { plural } from '../../../shared/lib/plural';
export function PlansPanel({
  state,
  onCommand,
  onStart,
  today,
}: {
  state: AdvancedWorkoutState;
  onCommand: AdvancedCommandHandler;
  onStart: (planId: string) => void;
  today: string;
}) {
  const [creating, setCreating] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkoutPlan | null>(null);
  const [editingSequence, setEditingSequence] = useState(false);
  const [sequence, setSequence] = useState('');
  const [error, setError] = useState('');
  const catalog = exerciseCatalog(state);
  const opened = state.plans.find((p) => p.id === openedId);
  const next = suggestedPlan(state);
  const last = [...state.sessions]
    .reverse()
    .filter((s) => s.status === 'completed' && s.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .at(0);
  if (creating)
    return (
      <PlanWizard
        state={state}
        onCommand={onCommand}
        onClose={() => setCreating(false)}
      />
    );
  if (draft)
    return (
      <div className="strength-stack workout-flow" aria-label="Ficha de treino">
        <div className="strength-heading">
          <h3>Editar ficha</h3>
          <button
            type="button"
            className="filter-button"
            onClick={() => setDraft(null)}
          >
            Cancelar edição
          </button>
        </div>
        <PlanEditor
          plan={draft}
          state={state}
          onCommand={onCommand}
          onChange={setDraft}
        />
        <button
          type="button"
          className="record-primary workout-wide"
          onClick={() => {
            if (!onCommand({ type: 'savePlan', value: draft })) setDraft(null);
          }}
        >
          Salvar ficha
        </button>
      </div>
    );
  if (opened)
    return (
      <div className="strength-stack workout-flow">
        <div className="strength-heading">
          <button
            type="button"
            className="filter-button"
            onClick={() => setOpenedId(null)}
          >
            <WorkoutIcon name="back" /> Minhas fichas
          </button>
          <button
            type="button"
            className="filter-button"
            onClick={() => setDraft(structuredClone(opened))}
          >
            Editar ficha
          </button>
        </div>
        <div className="exercise-title">
          <span className="plan-letter plan-letter-large">
            {planLetter(state.plans.indexOf(opened))}
          </span>
          <div>
            <h3>{opened.name}</h3>
            {opened.description && <p>{opened.description}</p>}
            <small>
              {plural(opened.exercises.length, 'exercício', 'exercícios')}
            </small>
          </div>
        </div>
        <button
          type="button"
          className="record-primary workout-wide"
          onClick={() => onStart(opened.id)}
        >
          <WorkoutIcon name="play" /> Iniciar treino
        </button>
        <ol className="strength-stack plan-exercises">
          {opened.exercises.map((ex) => (
            <li key={ex.id} className="strength-exercise exercise-title">
              <span className="exercise-glyph">
                <WorkoutIcon name="dumbbell" size={28} />
              </span>
              <div>
                <strong>
                  {catalog.find((e) => e.id === ex.exerciseId)?.name}
                </strong>
                <small>
                  {plural(ex.sets, 'série', 'séries')}
                  {ex.reps
                    ? ` · ${plural(ex.reps, 'repetição', 'repetições')}`
                    : ''}
                </small>
                {ex.notes && <p className="record-hint">{ex.notes}</p>}
              </div>
            </li>
          ))}
        </ol>
        {!opened.exercises.length && (
          <p className="record-empty">
            Adicione exercícios em Editar ficha para montar este treino.
          </p>
        )}
        {opened.notes && <p className="record-hint">{opened.notes}</p>}
        <div className="record-actions">
          <button
            type="button"
            className="filter-button"
            onClick={() =>
              onCommand({
                type: 'duplicatePlan',
                id: opened.id,
                newId: crypto.randomUUID(),
              })
            }
          >
            Duplicar ficha
          </button>
          <DeleteAction
            label="Excluir ficha"
            detail={`Excluir “${opened.name}”? As sessões anteriores serão preservadas.`}
            onConfirm={() => {
              if (
                !onCommand({
                  type: 'deletePlan',
                  id: opened.id,
                  confirmed: true,
                })
              )
                setOpenedId(null);
            }}
          />
        </div>
      </div>
    );
  return (
    <div className="strength-stack">
      <div className="strength-heading">
        <div>
          <h3>Minhas fichas</h3>
        </div>
        <ActionButton icon="plus" onClick={() => setCreating(true)}>
          Nova ficha
        </ActionButton>
      </div>
      {next && (
        <article className="workout-next">
          <div className="exercise-title">
            <span className="plan-letter">
              {planLetter(state.plans.indexOf(next))}
            </span>
            <div>
              <small>PRÓXIMO NA SEQUÊNCIA</small>
              <h4>{next.name}</h4>
              <p>
                {next.description ||
                  plural(next.exercises.length, 'exercício', 'exercícios')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="record-primary"
            onClick={() => onStart(next.id)}
          >
            <WorkoutIcon name="play" size={18} /> Iniciar treino
          </button>
        </article>
      )}
      {!state.plans.length && (
        <div className="workout-empty">
          <span className="exercise-glyph">
            <WorkoutIcon name="dumbbell" size={32} />
          </span>
          <h4>Seu próximo treino começa aqui</h4>
          <p>
            Escolha uma divisão, monte suas fichas e acompanhe cada série no seu
            ritmo.
          </p>
          <button
            type="button"
            className="record-primary"
            onClick={() => setCreating(true)}
          >
            <WorkoutIcon name="plus" /> Criar minha primeira ficha
          </button>
        </div>
      )}
      <div className="strength-cards workout-plan-cards">
        {state.plans.map((plan, index) => (
          <article key={plan.id} className="workout-plan-card">
            <button
              type="button"
              className="workout-plan-open"
              aria-label={`Abrir ficha ${plan.name}`}
              onClick={() => setOpenedId(plan.id)}
            >
              <span className="plan-letter">{planLetter(index)}</span>
              <span>
                <strong>{plan.name}</strong>
                <small>
                  {plan.description ||
                    plural(plan.exercises.length, 'exercício', 'exercícios')}
                </small>
                {plan.description && (
                  <small>
                    {plural(plan.exercises.length, 'exercício', 'exercícios')}
                  </small>
                )}
              </span>
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              className="plan-start"
              aria-label={`Iniciar ${plan.name}`}
              title={`Iniciar ${plan.name}`}
              onClick={() => onStart(plan.id)}
            >
              <WorkoutIcon name="play" size={19} />
            </button>
          </article>
        ))}
      </div>
      {state.plans.length > 0 && (
        <details
          className="strength-catalog"
          open={editingSequence}
          onToggle={(e) => setEditingSequence(e.currentTarget.open)}
        >
          <summary
            onClick={() => {
              if (!editingSequence) {
                setSequence(
                  sequenceText(
                    state.rotation?.sequence ?? state.plans.map((p) => p.id),
                    state.plans,
                  ),
                );
                setError('');
              }
            }}
          >
            Sequência de utilização
          </summary>
          <div className="strength-stack">
            <p className="record-hint">
              {state.plans
                .map((p, i) => `${planLetter(i)}: ${p.name}`)
                .join(' · ')}
            </p>
            <Field label="Editar sequência">
              <input
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                placeholder="A → B → A → C"
              />
            </Field>
            {error && <p role="alert">{error}</p>}
            <button
              type="button"
              className="filter-button"
              onClick={() => {
                const ids = parseSequence(sequence, state.plans);
                if (!ids) {
                  setError('Use apenas letras das fichas existentes.');
                  return;
                }
                if (!onCommand({ type: 'setRotation', sequence: ids }))
                  setEditingSequence(false);
              }}
            >
              Salvar sequência
            </button>
          </div>
        </details>
      )}
      {last && (
        <p className="workout-last">
          <WorkoutIcon name="history" size={16} />
          <span>
            Último treino · <strong>{last.planName}</strong> ·{' '}
            {displayDate(last.date)}
          </span>
        </p>
      )}
      <ExerciseManager state={state} onCommand={onCommand} />
    </div>
  );
}
