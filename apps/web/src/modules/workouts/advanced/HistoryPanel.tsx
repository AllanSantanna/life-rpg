import { displayDate } from '../../records/dates';
import { consideredSets, number, sessionVolume } from './calculations';
import { DeleteAction } from './Controls';
import type { AdvancedCommandHandler, AdvancedWorkoutState } from './types';
import { plural } from '../../../shared/lib/plural';
export function HistoryPanel({
  state,
  onCommand,
  onOpen,
}: {
  state: AdvancedWorkoutState;
  onCommand: AdvancedCommandHandler;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="strength-stack">
      <h3>Histórico</h3>
      {!state.sessions.length && (
        <p className="record-empty">Suas sessões aparecerão aqui.</p>
      )}
      {[...state.sessions]
        .reverse()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((session) => (
          <article className="strength-exercise" key={session.id}>
            <div className="strength-heading">
              <div>
                <h4>{session.planName}</h4>
                <p>
                  {displayDate(session.date)} ·{' '}
                  {session.status === 'completed'
                    ? 'Concluída'
                    : 'Em andamento'}
                </p>
              </div>
              <strong>{number(sessionVolume(session))} kg·rep</strong>
            </div>
            <details>
              <summary>Exercícios, séries e RIR</summary>
              {session.exercises.map((ex) => (
                <div key={ex.id} className="strength-history-exercise">
                  <h5>{ex.exercise.name}</h5>
                  <p>
                    {plural(
                      consideredSets(ex).length,
                      'série válida concluída',
                      'séries válidas concluídas',
                    )}
                  </p>
                  <ul>
                    {ex.sets.map((set, i) => (
                      <li key={set.id}>
                        Série {i + 1} ·{' '}
                        {set.kind === 'working' ? 'Válida' : 'Aquecimento'} ·{' '}
                        {set.weight === null
                          ? 'Carga pendente'
                          : `${number(set.weight)} kg`}{' '}
                        × {set.reps ?? '—'} rep · RIR {set.rir ?? '—'} ·{' '}
                        {set.completed ? 'Concluída' : 'Pendente'}
                      </li>
                    ))}
                  </ul>
                  {ex.notes && <p>{ex.notes}</p>}
                </div>
              ))}
              {session.notes && <p>{session.notes}</p>}
            </details>
            <div className="record-actions">
              <button
                type="button"
                className="filter-button"
                onClick={() => onOpen(session.id)}
              >
                Corrigir sessão
              </button>
              <DeleteAction
                label="Excluir sessão"
                detail="Excluir a sessão e suas séries? O registro diário Sim/Não será preservado."
                onConfirm={() =>
                  onCommand({
                    type: 'deleteSession',
                    id: session.id,
                    confirmed: true,
                  })
                }
              />
            </div>
          </article>
        ))}
    </div>
  );
}
