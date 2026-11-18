import { useState } from 'react';
import { CustomDatePicker } from '../../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { Field } from '../../records/RecordUI';
import { displayDate } from '../../records/dates';
import { blankSet } from './commands';
import {
  exerciseHistory,
  exerciseVolume,
  sessionVolume,
  previousPerformance,
  number,
} from './calculations';
import { DeleteAction } from './Controls';
import { ExercisePicker } from './ExercisePicker';
import { Icon as WorkoutIcon } from '../../../shared/components/Icon';
import { suggestedPlan } from './rotation';
import type {
  AdvancedCommandHandler,
  AdvancedWorkoutState,
  WorkoutSession,
  WorkoutSet,
} from './types';
export function SessionPanel({
  state,
  today,
  selectedId,
  onSelect,
  onCommand,
}: {
  state: AdvancedWorkoutState;
  today: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommand: AdvancedCommandHandler;
}) {
  const [planId, setPlanId] = useState(suggestedPlan(state)?.id ?? 'free');
  const [date, setDate] = useState(today);
  const [markDay, setMarkDay] = useState(true);
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const session = state.sessions.find((s) => s.id === selectedId);
  const activeIndex = Math.min(
    active,
    Math.max(0, (session?.exercises.length ?? 1) - 1),
  );
  const done =
    session?.exercises.flatMap((e) => e.sets).filter((s) => s.completed)
      .length ?? 0;
  const total = session?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const completedExercises =
    session?.exercises.filter(
      (e) => e.sets.length && e.sets.every((s) => s.completed),
    ).length ?? 0;
  function start() {
    const existing = state.sessions.findLast(
      (s) =>
        s.status === 'in_progress' &&
        s.planId === (planId === 'free' ? null : planId),
    );
    if (existing) {
      onSelect(existing.id);
      setActive(0);
      return;
    }
    const id = crypto.randomUUID();
    if (
      !onCommand({
        type: 'startSession',
        id,
        planId: planId === 'free' ? null : planId,
        date,
      })
    ) {
      onSelect(id);
      setActive(0);
    }
  }
  function save(value: WorkoutSession) {
    const hasCompletedSet = value.exercises.some((e) =>
      e.sets.some((s) => s.completed),
    );
    onCommand({
      type: 'saveSession',
      value: hasCompletedSet ? value : { ...value, status: 'in_progress' },
    });
  }
  function changeSet(
    exerciseId: string,
    setId: string,
    patch: Partial<WorkoutSet>,
  ) {
    if (!session) return;
    save({
      ...session,
      exercises: session.exercises.map((ex) =>
        ex.id !== exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id !== setId
                  ? set
                  : {
                      ...set,
                      ...patch,
                      ...(patch.weight === null || patch.reps === null
                        ? { completed: false }
                        : {}),
                    },
              ),
            },
      ),
    });
  }
  if (session && picking)
    return (
      <ExercisePicker
        state={state}
        onCommand={onCommand}
        excluded={session.exercises.map((e) => e.exercise.id)}
        onClose={() => setPicking(false)}
        onAdd={(exercises) =>
          save({
            ...session,
            exercises: [
              ...session.exercises,
              ...exercises.map((exercise) => ({
                id: crypto.randomUUID(),
                exercise: structuredClone(exercise),
                notes: '',
                sets: [blankSet(crypto.randomUUID())],
              })),
            ],
          })
        }
      />
    );
  return (
    <div className="strength-stack workout-session">
      <h3>Registrar Treino</h3>
      {!session ? (
        <>
          <p className="record-hint">
            Escolha sua ficha ou comece um treino livre.
          </p>
          <div className="strength-fields">
            <Field label="Ficha para a sessão">
              <CustomSelect
                label="Ficha para a sessão"
                value={planId}
                options={[
                  { value: 'free', label: 'Treino livre' },
                  ...state.plans.map((p) => ({ value: p.id, label: p.name })),
                ]}
                onChange={setPlanId}
              />
            </Field>
            <Field label="Data da nova sessão">
              <CustomDatePicker
                label="Data da nova sessão"
                value={date}
                max={today}
                onChange={setDate}
              />
            </Field>
          </div>
          <button
            type="button"
            className="record-primary workout-wide"
            onClick={start}
          >
            <WorkoutIcon name="play" /> Iniciar sessão
          </button>
          {state.sessions.some((s) => s.status === 'in_progress') && (
            <div className="strength-stack">
              <h4>Sessões em andamento</h4>
              {state.sessions
                .filter((s) => s.status === 'in_progress')
                .map((s) => (
                  <button
                    type="button"
                    className="filter-button"
                    key={s.id}
                    onClick={() => {
                      onSelect(s.id);
                      setActive(0);
                    }}
                  >
                    Continuar {s.planName} · {displayDate(s.date)}
                  </button>
                ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="strength-heading">
            <div>
              <h4>{session.planName}</h4>
              <p className="record-hint">
                {session.status === 'completed'
                  ? 'Sessão concluída'
                  : 'Em andamento'}{' '}
                · salvo automaticamente
              </p>
            </div>
            <button
              type="button"
              className="filter-button"
              onClick={() => {
                onSelect(null);
                setActive(0);
              }}
            >
              Nova sessão
            </button>
          </div>
          <div className="session-progress">
            <div>
              <span>
                {session.exercises.length
                  ? `Exercício ${activeIndex + 1} de ${session.exercises.length}`
                  : 'Adicione seu primeiro exercício'}
              </span>
              <strong>{total ? Math.round((done / total) * 100) : 0}%</strong>
            </div>
            <progress
              aria-label="Progresso das séries"
              max={Math.max(1, total)}
              value={done}
            />
            <small>
              {completedExercises} exercícios concluídos · {done} de {total}{' '}
              séries
            </small>
          </div>
          {session.exercises.map((ex, exerciseIndex) => {
            if (exerciseIndex !== activeIndex) return null;
            const previous = previousPerformance(
              state.sessions,
              ex.exercise.id,
              session.id,
              session.date,
            );
            return (
              <section
                className="strength-stack"
                key={ex.id}
                aria-label={ex.exercise.name}
              >
                <div className="session-exercise-head">
                  <span className="exercise-glyph">
                    <WorkoutIcon name="dumbbell" size={32} />
                  </span>
                  <div>
                    <h4>{ex.exercise.name}</h4>
                    <p className="record-hint">
                      {previous
                        ? `Último treino: ${number(previous.weight)} kg × ${previous.reps} repetições · ${displayDate(previous.date)}`
                        : 'Seu primeiro registro neste exercício.'}
                    </p>
                  </div>
                </div>
                <div className="session-set-table">
                  <div className="session-set-header" aria-hidden="true">
                    <span>Série</span>
                    <span>kg</span>
                    <span>Reps</span>
                    <span>RIR</span>
                    <span>✓</span>
                    <span />
                  </div>
                  {ex.sets.map((set, index) => (
                    <div
                      className={`session-set-row ${set.completed ? 'is-completed' : ''} ${set.kind === 'warmup' ? 'is-warmup' : ''}`}
                      key={set.id}
                      role="group"
                      aria-label={`Série ${index + 1} · ${ex.exercise.name}`}
                    >
                      <label className="set-kind">
                        <span className="sr-only">{`Tipo · exercício ${exerciseIndex + 1}, série ${index + 1}`}</span>
                        <select
                          title="Válida ou aquecimento"
                          aria-label={`Tipo · exercício ${exerciseIndex + 1}, série ${index + 1}`}
                          value={set.kind}
                          onChange={(e) =>
                            changeSet(ex.id, set.id, {
                              kind: e.target.value as WorkoutSet['kind'],
                            })
                          }
                        >
                          <option value="working">{index + 1}</option>
                          <option value="warmup">A{index + 1}</option>
                        </select>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={2000}
                        step="0.01"
                        aria-label={`Carga (kg) · exercício ${exerciseIndex + 1}, série ${index + 1}`}
                        value={set.weight ?? ''}
                        placeholder="—"
                        onChange={(e) =>
                          changeSet(ex.id, set.id, {
                            weight:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={1000}
                        step={1}
                        aria-label={`Repetições · exercício ${exerciseIndex + 1}, série ${index + 1}`}
                        value={set.reps ?? ''}
                        placeholder="—"
                        onChange={(e) =>
                          changeSet(ex.id, set.id, {
                            reps:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10}
                        step={1}
                        aria-label={`RIR · exercício ${exerciseIndex + 1}, série ${index + 1}`}
                        value={set.rir ?? ''}
                        placeholder="—"
                        title="Repetições em reserva: 0 a 10, ou vazio"
                        onChange={(e) =>
                          changeSet(ex.id, set.id, {
                            rir:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                      <label className="set-completed">
                        <input
                          type="checkbox"
                          aria-label="Concluída"
                          checked={set.completed}
                          disabled={set.weight === null || set.reps === null}
                          onChange={(e) =>
                            changeSet(ex.id, set.id, {
                              completed: e.target.checked,
                            })
                          }
                        />
                        <span aria-hidden="true">
                          <WorkoutIcon name="check" size={16} />
                        </span>
                      </label>
                      <button
                        type="button"
                        className="set-remove"
                        aria-label={`Remover série ${index + 1} de ${ex.exercise.name}`}
                        onClick={() =>
                          save({
                            ...session,
                            exercises: session.exercises.map((e) =>
                              e.id !== ex.id
                                ? e
                                : {
                                    ...e,
                                    sets: e.sets.filter((s) => s.id !== set.id),
                                  },
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p className="record-hint set-legend">
                  A = aquecimento · Toque no número da série para alterar o
                  tipo. RIR é opcional.
                </p>
                <button
                  type="button"
                  className="filter-button workout-wide"
                  disabled={ex.sets.length >= 100}
                  onClick={() =>
                    save({
                      ...session,
                      exercises: session.exercises.map((e) =>
                        e.id !== ex.id
                          ? e
                          : {
                              ...e,
                              sets: [
                                ...e.sets,
                                {
                                  ...blankSet(crypto.randomUUID()),
                                  weight: e.sets.at(-1)?.weight ?? null,
                                  reps: e.sets.at(-1)?.reps ?? null,
                                },
                              ],
                            },
                      ),
                    })
                  }
                >
                  <WorkoutIcon name="plus" /> Adicionar série
                </button>
                <button
                  type="button"
                  className="filter-button workout-wide"
                  disabled={!previous}
                  onClick={() => {
                    const last = exerciseHistory(
                      state.sessions.filter((s) => s.id !== session.id),
                      ex.exercise.id,
                      session.date,
                    ).at(-1);
                    if (!last) return;
                    let index = 0;
                    save({
                      ...session,
                      exercises: session.exercises.map((e) =>
                        e.id !== ex.id
                          ? e
                          : {
                              ...e,
                              sets: e.sets.map((s) => {
                                if (s.kind === 'warmup') return s;
                                const source =
                                  last.sets[
                                    Math.min(index++, last.sets.length - 1)
                                  ]!;
                                return {
                                  ...s,
                                  weight: source.weight,
                                  reps: source.reps,
                                  rir: source.rir,
                                  completed: false,
                                };
                              }),
                            },
                      ),
                    });
                  }}
                >
                  <WorkoutIcon name="history" /> Copiar último treino
                </button>
                <details className="strength-catalog">
                  <summary>Detalhes do exercício</summary>
                  <div className="strength-stack">
                    <p className="record-hint">
                      Volume válido: {number(exerciseVolume(ex))} kg·rep · com
                      aquecimento: {number(exerciseVolume(ex, true))} kg·rep
                    </p>
                    <Field label={`Observações de ${ex.exercise.name}`}>
                      <input
                        maxLength={1000}
                        value={ex.notes}
                        onChange={(event) =>
                          save({
                            ...session,
                            exercises: session.exercises.map((e) =>
                              e.id !== ex.id
                                ? e
                                : { ...e, notes: event.target.value },
                            ),
                          })
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      className="text-action"
                      onClick={() =>
                        save({
                          ...session,
                          exercises: session.exercises.filter(
                            (e) => e.id !== ex.id,
                          ),
                        })
                      }
                    >
                      Remover exercício
                    </button>
                  </div>
                </details>
              </section>
            );
          })}
          {session.exercises.length > 1 && (
            <div className="session-navigation">
              <button
                type="button"
                className="filter-button"
                disabled={activeIndex === 0}
                onClick={() => setActive(activeIndex - 1)}
              >
                ‹ Anterior
              </button>
              <span>
                {activeIndex + 1} / {session.exercises.length}
              </span>
              <button
                type="button"
                className="record-primary"
                disabled={activeIndex === session.exercises.length - 1}
                onClick={() => setActive(activeIndex + 1)}
              >
                Próximo ›
              </button>
            </div>
          )}
          <button
            type="button"
            className="filter-button workout-wide"
            onClick={() => setPicking(true)}
          >
            <WorkoutIcon name="plus" /> Adicionar exercícios à sessão
          </button>
          <details className="strength-catalog">
            <summary>Data, observações e opções da sessão</summary>
            <div className="strength-stack">
              <Field label="Data da sessão">
                <CustomDatePicker
                  label="Data da sessão"
                  value={session.date}
                  max={today}
                  onChange={(date) => save({ ...session, date })}
                />
              </Field>
              <Field label="Observações da sessão">
                <textarea
                  maxLength={1000}
                  value={session.notes}
                  onChange={(e) => save({ ...session, notes: e.target.value })}
                />
              </Field>
              {session.status === 'completed' && (
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => save({ ...session, status: 'in_progress' })}
                >
                  Reabrir sessão
                </button>
              )}
              <DeleteAction
                label="Excluir sessão"
                detail="Excluir esta sessão e suas séries? O registro diário Sim/Não será preservado."
                onConfirm={() => {
                  if (
                    !onCommand({
                      type: 'deleteSession',
                      id: session.id,
                      confirmed: true,
                    })
                  )
                    onSelect(null);
                }}
              />
            </div>
          </details>
          <p className="record-hint">
            <strong>
              Volume da sessão: {number(sessionVolume(session))} kg·rep
            </strong>
          </p>
          <label className="strength-check">
            <input
              type="checkbox"
              checked={markDay}
              onChange={(e) => setMarkDay(e.target.checked)}
            />
            Marcar o dia como treinado ao concluir
          </label>
          <button
            type="button"
            className="record-primary workout-wide"
            onClick={() =>
              onCommand({ type: 'finishSession', id: session.id, markDay })
            }
          >
            {session.status === 'completed'
              ? 'Confirmar sessão'
              : 'Concluir sessão'}{' '}
            <WorkoutIcon name="check" />
          </button>
        </>
      )}
    </div>
  );
}
