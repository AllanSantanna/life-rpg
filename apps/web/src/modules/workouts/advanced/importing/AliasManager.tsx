import { useState } from 'react';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { Field } from '../../../records/RecordUI';
import { exerciseCatalog } from '../catalog';
import type {
  AdvancedCommandHandler,
  AdvancedWorkoutState,
  ExerciseAlias,
} from '../types';
import { aliasIssue } from './aliases';

export function AliasManager({
  state,
  planId,
  onCommand,
}: {
  state: AdvancedWorkoutState;
  planId: string | null;
  onCommand: AdvancedCommandHandler;
}) {
  const [editing, setEditing] = useState<ExerciseAlias | null>(null);
  const [error, setError] = useState('');
  const catalog = exerciseCatalog(state);
  const aliases = state.importSettings?.aliases ?? [];
  function edit(alias: ExerciseAlias) {
    setEditing({ ...alias });
    setError('');
  }
  return (
    <details className="strength-stack import-aliases">
      <summary>Nomes lembrados ({aliases.length})</summary>
      <p className="record-hint">
        As associações usam o ID do exercício. Cada ficha pode ter apelidos
        próprios; associações gerais são usadas em treinos livres.
      </p>
      {aliases.map((alias) => (
        <div key={alias.id} className="strength-exercise">
          <p>
            <strong>{alias.name}</strong> →{' '}
            {catalog.find((e) => e.id === alias.exerciseId)?.name ??
              alias.exerciseId}
          </p>
          <small>
            {alias.planId === null
              ? 'Geral · treino livre'
              : (state.plans.find((p) => p.id === alias.planId)?.name ??
                'Ficha excluída')}
          </small>
          {aliasIssue(state, alias) && (
            <p className="record-error">
              {aliasIssue(state, alias)} Associação inativa; edite ou exclua.
            </p>
          )}
          <div className="record-actions">
            <button
              type="button"
              className="filter-button"
              onClick={() => edit(alias)}
            >
              Editar apelido {alias.name}
            </button>
            <button
              type="button"
              className="text-action"
              onClick={() => {
                const message = onCommand({
                  type: 'deleteImportAlias',
                  id: alias.id,
                });
                setError(message ?? '');
                if (!message && editing?.id === alias.id) setEditing(null);
              }}
            >
              Excluir apelido {alias.name}
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="filter-button"
        onClick={() =>
          edit({ id: crypto.randomUUID(), name: '', exerciseId: '', planId })
        }
      >
        Nova associação
      </button>
      {editing && (
        <div
          className="strength-exercise strength-stack"
          role="group"
          aria-label="Editar associação de nome"
        >
          <Field label="Nome alternativo">
            <input
              value={editing.name}
              maxLength={200}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </Field>
          <Field label="Contexto do apelido">
            <CustomSelect
              label="Contexto do apelido"
              value={editing.planId ?? ''}
              options={[
                { value: '', label: 'Geral · treino livre' },
                ...state.plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(value) =>
                setEditing({ ...editing, planId: value || null })
              }
            />
          </Field>
          <Field label="Exercício do apelido">
            <CustomSelect
              label="Exercício do apelido"
              value={editing.exerciseId}
              options={[
                { value: '', label: 'Selecione o exercício' },
                ...catalog.map((e) => ({ value: e.id, label: e.name })),
              ]}
              onChange={(exerciseId) => setEditing({ ...editing, exerciseId })}
            />
          </Field>
          <div className="record-actions">
            <button
              type="button"
              className="record-primary"
              disabled={!editing.name.trim() || !editing.exerciseId}
              onClick={() => {
                const message = onCommand({
                  type: 'saveImportAlias',
                  value: editing,
                });
                setError(message ?? '');
                if (!message) setEditing(null);
              }}
            >
              Salvar associação
            </button>
            <button
              type="button"
              className="filter-button"
              onClick={() => setEditing(null)}
            >
              Cancelar edição do apelido
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="record-error">
          {error}
        </p>
      )}
    </details>
  );
}
