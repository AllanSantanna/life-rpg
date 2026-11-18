import { useState } from 'react';
import { Field } from '../../records/RecordUI';
import { divisionPlans, parseSequence, planLetter } from './rotation';
import { PlanEditor } from './PlanEditor';
import { Icon as WorkoutIcon } from '../../../shared/components/Icon';
import {
  muscleLabels,
  type AdvancedWorkoutState,
  type AdvancedCommandHandler,
  type WorkoutPlan,
} from './types';
import { plural } from '../../../shared/lib/plural';
export function PlanWizard({
  state,
  onCommand,
  onClose,
}: {
  state: AdvancedWorkoutState;
  onCommand: AdvancedCommandHandler;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [division, setDivision] = useState('3');
  const [count, setCount] = useState(3);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sequence, setSequence] = useState('A → B → C');
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const changeCount = (n: number) => {
    setCount(n);
    setSequence(
      Array.from({ length: Math.min(26, Math.max(0, n)) }, (_, i) =>
        planLetter(i),
      ).join(' → '),
    );
  };
  function next() {
    setError('');
    if (step === 1) {
      if (!Number.isInteger(count) || count < 1 || count > 26) {
        setError('Escolha entre 1 e 26 fichas.');
        return;
      }
      const draft = plans.length === count ? plans : divisionPlans(count);
      if (!parseSequence(sequence, draft)) {
        setError('Use as letras das fichas, como A → B → A → C.');
        return;
      }
      setPlans(draft);
      setActive(0);
      setStep(2);
    } else {
      if (plans.some((p) => !p.name.trim())) {
        setError('Dê um nome a cada ficha.');
        return;
      }
      setStep(3);
    }
  }
  function save() {
    const ids = parseSequence(sequence, plans);
    if (!ids) return;
    const message = onCommand({ type: 'createDivision', plans, sequence: ids });
    if (message) setError(message);
    else onClose();
  }
  return (
    <div className="strength-stack workout-flow workout-wizard">
      <div className="strength-heading">
        <button
          type="button"
          className="filter-button"
          onClick={step === 1 ? onClose : () => setStep(step - 1)}
        >
          <WorkoutIcon name="back" /> Voltar
        </button>
        <h3>Criar ficha</h3>
        <button type="button" className="text-action" onClick={onClose}>
          Cancelar criação
        </button>
      </div>
      <ol className="workout-steps" aria-label="Etapas da criação">
        {['Divisão', 'Personalização', 'Exercícios'].map((label, i) => (
          <li
            key={label}
            aria-current={step === i + 1 ? 'step' : undefined}
            className={step >= i + 1 ? 'is-current' : ''}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="strength-stack">
        {step === 1 && (
          <>
            <div>
              <h4>Escolha a divisão de treinos</h4>
              <p className="record-hint">
                As letras são suas fichas. Treine na sua sequência, sem prender
                a dias da semana.
              </p>
            </div>
            <fieldset className="division-options">
              <legend className="sr-only">Divisão de treinos</legend>
              {[
                'Treino único',
                'Dois treinos',
                'Três treinos',
                'Quatro treinos',
                'Cinco treinos',
                'Personalizada',
              ].map((label, i) => {
                const value = i === 5 ? 'custom' : String(i + 1);
                return (
                  <label
                    className={division === value ? 'is-selected' : ''}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="division"
                      value={value}
                      checked={division === value}
                      onChange={() => {
                        setDivision(value);
                        if (value !== 'custom') changeCount(i + 1);
                      }}
                    />
                    <span>
                      <strong>
                        {i === 5
                          ? label
                          : `${Array.from({ length: i + 1 }, (_, n) => planLetter(n)).join('/')} — ${label}`}
                      </strong>
                      <small>
                        {i === 5
                          ? 'Defina livremente a quantidade e a sequência'
                          : `${i + 1} ${i === 0 ? 'ficha' : 'fichas'} de treino`}
                      </small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {division === 'custom' && (
              <Field label="Quantidade de fichas">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={26}
                  required
                  value={count}
                  onChange={(e) => changeCount(Number(e.target.value))}
                />
              </Field>
            )}
            <Field label="Sequência de utilização">
              <input
                required
                maxLength={1000}
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
              />
            </Field>
            <p className="record-hint">
              Você pode repetir letras. A sequência recomeça ao chegar ao fim.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div>
              <h4>Deixe as fichas com a sua cara</h4>
              <p className="record-hint">
                Escolha os nomes e os músculos. Você pode mudar tudo depois.
              </p>
            </div>
            {plans.map((plan, index) => (
              <section className="strength-exercise" key={plan.id}>
                <div className="exercise-title">
                  <span className="plan-letter">{planLetter(index)}</span>
                  <Field label={`Nome da ficha ${planLetter(index)}`}>
                    <input
                      required
                      maxLength={200}
                      value={plan.name}
                      onChange={(e) =>
                        setPlans(
                          plans.map((p) =>
                            p.id === plan.id
                              ? { ...p, name: e.target.value }
                              : p,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field
                  label={`Músculos ou descrição da ficha ${planLetter(index)}`}
                >
                  <input
                    maxLength={1000}
                    placeholder="Escolher músculos ou escrever livremente"
                    value={plan.description}
                    onChange={(e) =>
                      setPlans(
                        plans.map((p) =>
                          p.id === plan.id
                            ? { ...p, description: e.target.value }
                            : p,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="muscle-chips">
                  {Object.values(muscleLabels).map((label) => {
                    const chosen = plan.description.split(', ').includes(label);
                    return (
                      <button
                        type="button"
                        className="filter-button"
                        key={label}
                        aria-pressed={chosen}
                        onClick={() =>
                          setPlans(
                            plans.map((p) =>
                              p.id === plan.id
                                ? {
                                    ...p,
                                    description: chosen
                                      ? p.description
                                          .split(', ')
                                          .filter((m) => m !== label)
                                          .join(', ')
                                      : [p.description, label]
                                          .filter(Boolean)
                                          .join(', '),
                                  }
                                : p,
                            ),
                          )
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
        {step === 3 && (
          <>
            <div>
              <h4>Adicione os exercícios</h4>
              <p className="record-hint">
                Selecione uma ficha e monte o treino. Também é possível salvar
                fichas vazias e completar depois.
              </p>
            </div>
            <div className="plan-selector" aria-label="Ficha em personalização">
              {plans.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className="filter-button"
                  aria-pressed={active === i}
                  onClick={() => setActive(i)}
                >
                  {planLetter(i)}{' '}
                  <small>
                    {plural(p.exercises.length, 'exercício', 'exercícios')}
                  </small>
                </button>
              ))}
            </div>
            <PlanEditor
              key={plans[active]!.id}
              plan={plans[active]!}
              state={state}
              onCommand={onCommand}
              onChange={(value) =>
                setPlans(plans.map((p) => (p.id === value.id ? value : p)))
              }
            />
          </>
        )}
        {error && (
          <p role="alert" className="record-error">
            {error}
          </p>
        )}
      </div>
      <div className="workout-sticky-actions">
        <small>Etapa {step} de 3</small>
        <button
          type="button"
          className="record-primary"
          onClick={step === 3 ? save : next}
        >
          {step === 3 ? 'Salvar fichas' : 'Avançar'}{' '}
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
