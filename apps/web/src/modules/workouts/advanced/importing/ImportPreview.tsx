import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { Field } from '../../../records/RecordUI';
import type { Exercise, WorkoutSession } from '../types';
import { blankSet } from '../commands';
import { importConflict, onlyNewSets } from './sessionIntegration';
import { importSetErrors } from './validation';
import type { ImportExercise, ImportSet } from './types';
import { interpretNumbers } from './inputOrder';

export function ImportPreview({
  rows,
  catalog,
  session,
  preferred,
  onChange,
}: {
  rows: ImportExercise[];
  catalog: Exercise[];
  session: WorkoutSession | undefined;
  preferred: string[];
  onChange: (rows: ImportExercise[]) => void;
}) {
  function patch(id: string, value: Partial<ImportExercise>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...value } : row)));
  }
  return (
    <div className="strength-stack">
      {rows.map((row, exerciseIndex) => {
        const selected = catalog.find((e) => e.id === row.exerciseId);
        const conflict = importConflict(session, row.exerciseId);
        const ignored = !!conflict && row.conflict === 'keep';
        const options = [
          ...new Set([
            ...row.alternatives,
            ...preferred,
            ...catalog.map((e) => e.id),
          ]),
        ].flatMap((id) => {
          const ex = catalog.find((e) => e.id === id);
          return ex
            ? [
                {
                  value: id,
                  label: `${ex.name}${preferred.includes(id) ? ' · no destino' : ''}`,
                },
              ]
            : [];
        });
        return (
          <section
            key={row.id}
            className="strength-exercise strength-stack"
            aria-label={`Prévia do exercício ${exerciseIndex + 1}`}
          >
            <div className="strength-heading">
              <h4>{selected?.name ?? row.sourceName}</h4>
              <button
                type="button"
                className="text-action"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
              >
                Remover exercício {exerciseIndex + 1}
              </button>
            </div>
            <p className="record-hint">Nome escrito: {row.sourceName}</p>
            <p className="record-hint">
              Exercício correspondente:{' '}
              {selected?.name ?? 'Selecione uma alternativa'}
            </p>
            <small className="record-hint">
              Origem:{' '}
              {!selected
                ? 'Seleção manual necessária'
                : row.manuallyConfirmed
                  ? 'Seleção manual'
                  : row.source === 'plan'
                    ? 'Ficha selecionada'
                    : row.source === 'alias'
                      ? 'Apelido salvo'
                      : 'Catálogo geral'}
            </small>
            {!selected && (
              <p className="record-error">
                {row.alternatives.length
                  ? 'Nome ambíguo ou aproximação incerta. Escolha uma das alternativas.'
                  : 'Exercício não reconhecido. Escolha no catálogo ou corrija o texto.'}
              </p>
            )}
            <Field label={`Exercício ${exerciseIndex + 1}`}>
              <CustomSelect
                label={`Exercício ${exerciseIndex + 1}`}
                value={row.exerciseId ?? ''}
                options={[
                  { value: '', label: 'Escolha o exercício' },
                  ...options,
                ]}
                onChange={(exerciseId) =>
                  patch(row.id, {
                    exerciseId: exerciseId || null,
                    conflict: '',
                    manuallyConfirmed: !!exerciseId,
                    rememberName: false,
                    source: 'manual',
                  })
                }
              />
            </Field>
            {selected && row.manuallyConfirmed && (
              <label className="strength-check">
                <input
                  type="checkbox"
                  checked={row.rememberName ?? false}
                  aria-label={`Lembrar este nome para próximas importações · exercício ${exerciseIndex + 1}`}
                  onChange={(e) =>
                    patch(row.id, { rememberName: e.target.checked })
                  }
                />
                Lembrar este nome para próximas importações
              </label>
            )}
            {selected && !preferred.includes(selected.id) && (
              <p className="record-hint">
                Será adicionado somente à sessão. A ficha permanente será
                preservada.
              </p>
            )}
            {conflict && (
              <div className="strength-confirm strength-stack">
                <p>
                  Este exercício já possui {conflict.sets.length} série(s) no
                  destino. Escolha como importar.
                </p>
                <CustomSelect
                  label={`Conflito · exercício ${exerciseIndex + 1}`}
                  value={row.conflict}
                  options={[
                    {
                      value: '',
                      label: 'Escolha como tratar os dados existentes',
                    },
                    { value: 'keep', label: 'Manter os dados existentes' },
                    {
                      value: 'replace',
                      label: 'Substituir as séries deste exercício',
                    },
                    {
                      value: 'append',
                      label: 'Acrescentar apenas as novas séries',
                    },
                  ]}
                  onChange={(choice) => patch(row.id, { conflict: choice })}
                />
                {row.conflict === 'replace' && (
                  <p className="record-hint">
                    Somente as séries deste exercício serão substituídas após a
                    confirmação.
                  </p>
                )}
                {row.conflict === 'append' && (
                  <p className="record-hint">
                    {onlyNewSets(conflict.sets, row.sets).length} série(s)
                    nova(s). Comparamos carga, repetições, RIR e tipo, incluindo
                    a quantidade de séries iguais.
                  </p>
                )}
              </div>
            )}
            {row.sets.map((set, index) => {
              const errors = ignored ? [] : importSetErrors(set);
              const label = `prévia, exercício ${exerciseIndex + 1}, série ${index + 1}`;
              function changeSet(value: Partial<ImportSet>) {
                patch(row.id, {
                  sets: row.sets.map((s) =>
                    s.id === set.id ? { ...s, ...value } : s,
                  ),
                });
              }
              return (
                <fieldset
                  key={set.id}
                  className="strength-set import-set"
                  disabled={ignored}
                >
                  <legend>Série {index + 1}</legend>
                  {set.needsOrder && (
                    <div className="import-set-errors strength-stack">
                      <p className="record-error">
                        Ordem indefinida: {set.needsOrder.first ?? '—'} ×{' '}
                        {set.needsOrder.second ?? '—'}. Escolha como interpretar
                        estes números.
                      </p>
                      <CustomSelect
                        label={`Ordem · ${label}`}
                        value=""
                        options={[
                          { value: '', label: 'Escolha a ordem dos números' },
                          { value: 'weight-reps', label: 'Carga × repetições' },
                          { value: 'reps-weight', label: 'Repetições × carga' },
                        ]}
                        onChange={(order) => {
                          if (order)
                            changeSet({
                              ...interpretNumbers(
                                set.needsOrder!.first,
                                set.needsOrder!.second,
                                false,
                                false,
                                order,
                              ),
                              needsOrder: undefined,
                            });
                        }}
                      />
                    </div>
                  )}
                  <Field label="Tipo">
                    <CustomSelect
                      label={`Tipo · ${label}`}
                      value={set.kind}
                      disabled={ignored}
                      options={[
                        { value: 'working', label: 'Válida' },
                        { value: 'warmup', label: 'Aquecimento' },
                      ]}
                      onChange={(kind) => changeSet({ kind })}
                    />
                  </Field>
                  {(
                    [
                      ['weight', 'Carga (kg)', 0, 2000, '0.01'],
                      ['reps', 'Repetições', 1, 1000, '1'],
                      ['rir', 'RIR', 0, 10, '1'],
                    ] as const
                  ).map(([field, name, min, max, step]) => (
                    <Field label={name} key={field}>
                      <input
                        type="number"
                        inputMode={field === 'weight' ? 'decimal' : 'numeric'}
                        min={min}
                        max={max}
                        step={step}
                        value={set[field] ?? ''}
                        aria-label={`${name} · ${label}`}
                        placeholder={field === 'rir' ? 'Opcional' : '—'}
                        onChange={(e) =>
                          changeSet({
                            [field]:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  ))}
                  {errors.length > 0 && (
                    <p className="record-error import-set-errors">
                      {errors.join(' ')}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-action"
                    onClick={() =>
                      patch(row.id, {
                        sets: row.sets.filter((s) => s.id !== set.id),
                      })
                    }
                  >
                    Remover série {index + 1} do exercício {exerciseIndex + 1}
                  </button>
                </fieldset>
              );
            })}
            {!ignored && !row.sets.length && (
              <p className="record-error">
                Adicione ao menos uma série ou remova este exercício.
              </p>
            )}
            <button
              type="button"
              className="filter-button"
              disabled={ignored || row.sets.length >= 100}
              onClick={() =>
                patch(row.id, {
                  sets: [...row.sets, blankSet(crypto.randomUUID())],
                })
              }
            >
              Adicionar série ao exercício {exerciseIndex + 1}
            </button>
          </section>
        );
      })}
    </div>
  );
}
