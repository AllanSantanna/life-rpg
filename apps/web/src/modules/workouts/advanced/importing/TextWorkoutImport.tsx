import { useEffect, useRef, useState } from 'react';
import { CustomDatePicker } from '../../../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { Field } from '../../../records/RecordUI';
import { displayDate } from '../../../records/dates';
import type { SaveOutcome } from '../../../records/types';
import type {
  AdvancedCommandHandler,
  AdvancedWorkoutState,
  InputOrder,
} from '../types';
import { ImportPreview } from './ImportPreview';
import { parseWorkoutText } from './parser';
import {
  importCatalog,
  importConflict,
  preferredExerciseIds,
  prepareWorkoutImport,
} from './sessionIntegration';
import { isImportSetValid } from './validation';
import type { ImportTarget, ParsedWorkout } from './types';
import './importing.css';
import { AliasManager } from './AliasManager';
import { aliasIssue, confirmedAliases, importPlanId } from './aliases';
import { MetadataReview } from './MetadataReview';
import { importReceipt, importSaveErrors, type ImportReceipt } from './receipt';

export function TextWorkoutImport({
  state,
  today,
  selectedId,
  onCommand,
  whenSaved,
  onCancel,
  onSaved,
}: {
  state: AdvancedWorkoutState;
  today: string;
  selectedId: string | null;
  onCommand: AdvancedCommandHandler;
  /** Confirmação da gravação local; ausente quando o comando é síncrono. */
  whenSaved?: () => Promise<SaveOutcome>;
  onCancel: () => void;
  /** Chamado somente depois que a importação foi gravada. */
  onSaved: (receipt: ImportReceipt) => void;
}) {
  const [destination, setDestination] = useState(
    selectedId && state.sessions.some((s) => s.id === selectedId)
      ? `session:${selectedId}`
      : 'free',
  );
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [inputOrder, setInputOrder] = useState<InputOrder>(
    state.importSettings?.inputOrder ?? 'weight-reps',
  );
  const [preview, setPreview] = useState<{
    parsed: ParsedWorkout;
    base: AdvancedWorkoutState;
    selectedDate: string;
    dateChoice: string;
  } | null>(null);
  const [error, setError] = useState('');
  const confirming = useRef(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const target: ImportTarget = destination.startsWith('session:')
    ? { sessionId: destination.slice('session:'.length) }
    : {
        planId:
          destination === 'free' ? null : destination.slice('plan:'.length),
        date,
      };
  const base = preview?.base ?? state;
  const planId = importPlanId(base, target);
  const catalog = importCatalog(base, target);
  const preferred = preferredExerciseIds(base, target);
  const session =
    'sessionId' in target
      ? base.sessions.find((s) => s.id === target.sessionId)
      : undefined;
  const rows = preview?.parsed.exercises ?? [];
  const dateConflict =
    preview?.parsed.metadata?.dates.some(
      (date) => date !== preview.selectedDate,
    ) && !preview.dateChoice;
  const selectedExerciseIds = rows.flatMap((row) =>
    row.exerciseId ? [row.exerciseId] : [],
  );
  const repeated =
    new Set(selectedExerciseIds).size !== selectedExerciseIds.length;
  const invalid =
    !!dateConflict ||
    !rows.length ||
    repeated ||
    rows.some((row) => {
      const conflict = importConflict(session, row.exerciseId);
      return (
        !row.exerciseId ||
        (!!conflict && !row.conflict) ||
        (!(conflict && row.conflict === 'keep') &&
          (!row.sets.length || !row.sets.every(isImportSetValid)))
      );
    });
  function resetPreview() {
    setPreview(null);
    setError('');
  }
  function interpret() {
    setError('');
    setPreview({
      base: structuredClone(state),
      selectedDate:
        'sessionId' in target
          ? (state.sessions.find((s) => s.id === target.sessionId)?.date ??
            date)
          : date,
      dateChoice: '',
      parsed: parseWorkoutText(
        text,
        importCatalog(state, target),
        preferredExerciseIds(state, target),
        {
          inputOrder,
          planId: importPlanId(state, target),
          aliases:
            state.importSettings?.aliases.filter(
              (a) => !aliasIssue(state, a),
            ) ?? [],
          titles: state.plans.map((p) => p.name),
        },
      ),
    });
    requestAnimationFrame(() => previewHeading.current?.focus());
  }
  function release(message: string) {
    confirming.current = false;
    if (!mounted.current) return;
    setSaving(false);
    setError(message);
  }
  async function confirm() {
    // Trava síncrona: cliques repetidos e importações simultâneas são ignorados.
    if (confirming.current || !preview || invalid) return;
    confirming.current = true;
    setError('');
    let receipt: ImportReceipt;
    try {
      const finalTarget =
        preview.dateChoice && preview.dateChoice !== 'selected'
          ? { ...target, date: preview.dateChoice }
          : target;
      const prepared = prepareWorkoutImport(preview.base, finalTarget, rows);
      receipt = importReceipt(prepared, rows);
      // Nada a gravar (ex.: todos mantidos ou séries já registradas): não há sucesso.
      if (receipt.sets === 0) {
        release(
          'Nenhuma série nova seria importada: os exercícios mantêm os dados existentes ou as séries já estão registradas. Nada foi alterado.',
        );
        return;
      }
      const message = onCommand({
        ...prepared,
        aliases: confirmedAliases(preview.base, finalTarget, rows),
        inputOrder,
      });
      if (message) {
        release(message);
        return;
      }
    } catch (cause) {
      release(cause instanceof Error ? cause.message : 'Confira a prévia.');
      return;
    }
    setSaving(true);
    const outcome = whenSaved ? await whenSaved() : 'saved';
    if (outcome !== 'saved') {
      release(importSaveErrors[outcome]);
      return;
    }
    // A trava permanece: uma importação concluída não é repetida por outro clique.
    if (!mounted.current) return;
    setSaving(false);
    onSaved(receipt);
  }
  return (
    <section
      className="strength-stack workout-import"
      aria-label="Importação Rápida de Treinos"
    >
      <div className="strength-heading">
        <h3>Importação Rápida de Treinos</h3>
        <button
          type="button"
          className="filter-button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
      {planId !== null && (
        <p className="record-hint">
          Os exercícios desta ficha terão prioridade no reconhecimento.
        </p>
      )}
      <Field label="Formato dos números">
        <CustomSelect
          label="Formato dos números"
          value={inputOrder}
          options={[
            { value: 'weight-reps', label: 'Carga × repetições' },
            { value: 'reps-weight', label: 'Repetições × carga' },
            { value: 'auto', label: 'Automático · exigir ordem inequívoca' },
          ]}
          onChange={(value) => {
            setInputOrder(value);
            resetPreview();
          }}
        />
      </Field>
      <p className="record-hint">
        A unidade kg indica a carga, mesmo quando aparece no segundo número. Em
        Automático, pares sem unidade que aceitam as duas ordens exigem uma
        escolha. O formato escolhido será lembrado ao confirmar a importação.
      </p>
      <AliasManager state={state} planId={planId} onCommand={onCommand} />
      <p className="record-hint">
        Cole suas anotações e confira as séries antes de salvar.
      </p>
      <div className="strength-fields">
        <Field label="Destino da importação">
          <CustomSelect
            label="Destino da importação"
            value={destination}
            options={[
              { value: 'free', label: 'Nova sessão · Treino livre' },
              ...state.plans.map((p) => ({
                value: `plan:${p.id}`,
                label: `Nova sessão · ${p.name}`,
              })),
              ...state.sessions.map((s) => ({
                value: `session:${s.id}`,
                label: `${s.planName} · ${displayDate(s.date)} · ${s.status === 'completed' ? 'concluída' : 'em andamento'}`,
              })),
            ]}
            onChange={(value) => {
              setDestination(value);
              resetPreview();
            }}
          />
        </Field>
        {'date' in target && (
          <Field label="Data do treino importado">
            <CustomDatePicker
              label="Data do treino importado"
              value={date}
              max={today}
              onChange={(value) => {
                setDate(value);
                resetPreview();
              }}
            />
          </Field>
        )}
      </div>
      {session?.status === 'completed' && (
        <p className="record-hint">
          Você está corrigindo uma sessão concluída. Os indicadores avançados
          serão recalculados após salvar.
        </p>
      )}
      <Field label="Texto do treino">
        <textarea
          autoFocus
          rows={10}
          maxLength={50000}
          readOnly={saving}
          value={text}
          placeholder={
            'Treino A - Peito\n\nSupino reto\n60x10\n65x8 rir 2\n\nElevação lateral: 12,5kg x 12'
          }
          onChange={(e) => {
            setText(e.target.value);
            resetPreview();
          }}
        />
      </Field>
      <p className="record-hint">
        Use carga × repetições; RIR é opcional. Ex.: 20kg x 12 rir 2. Acrescente
        “aquecimento” ou “válida” para indicar o tipo. Sem indicação, a série
        será válida.
      </p>
      <button
        type="button"
        className="record-primary"
        disabled={!text.trim() || saving}
        onClick={interpret}
      >
        Interpretar treino
      </button>
      {preview && (
        <>
          <h4 ref={previewHeading} tabIndex={-1}>
            Prévia do treino
          </h4>
          <p role="status" className="record-hint">
            {rows.length} exercício(s) ·{' '}
            {rows.reduce((n, r) => n + r.sets.length, 0)} série(s). Confira
            nomes e números.
          </p>
          {preview.parsed.metadata && (
            <MetadataReview
              metadata={preview.parsed.metadata}
              plans={state.plans}
              selectedDate={preview.selectedDate}
              choice={preview.dateChoice}
              today={today}
              onDateChoice={(dateChoice) =>
                setPreview({ ...preview, dateChoice })
              }
              onPlan={(id) => {
                setDestination(`plan:${id}`);
                resetPreview();
              }}
            />
          )}
          {preview.dateChoice && preview.dateChoice !== 'selected' && (
            <p className="record-hint">
              Data confirmada para a importação:{' '}
              {displayDate(preview.dateChoice)}
            </p>
          )}
          {preview.parsed.warnings.length > 0 && (
            <details className="import-warnings" open>
              <summary>
                Avisos da interpretação ({preview.parsed.warnings.length})
              </summary>
              <ul>
                {preview.parsed.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
              <p className="record-hint">
                Os avisos descrevem o texto original. Corrija os campos abaixo
                ou edite o texto e interprete novamente.
              </p>
            </details>
          )}
          <ImportPreview
            rows={rows}
            catalog={catalog}
            preferred={preferred}
            session={session}
            onChange={(exercises) => {
              setPreview({
                ...preview,
                parsed: { ...preview.parsed, exercises },
              });
              setError('');
            }}
          />
          {repeated && (
            <p className="record-error" id="import-repeated-error">
              Há exercícios repetidos. Reúna as séries em um único exercício e
              remova a repetição.
            </p>
          )}
          {!rows.length && (
            <p className="record-error" id="import-empty-error">
              Nenhum exercício identificado. Confira o texto e interprete
              novamente.
            </p>
          )}
          <p className="record-hint">
            Ao confirmar, as séries serão registradas como realizadas. Novas
            sessões ficam em andamento para sua revisão. A importação não marca
            o registro diário nem concede XP.
          </p>
          {invalid && rows.length > 0 && (
            <p className="record-error" id="import-pending-error">
              Resolva os exercícios, séries e conflitos indicados para
              confirmar.
            </p>
          )}
          <div className="record-actions">
            <button
              type="button"
              className="record-primary"
              disabled={invalid || saving}
              aria-busy={saving || undefined}
              aria-describedby={
                [
                  repeated && 'import-repeated-error',
                  !rows.length && 'import-empty-error',
                  invalid && rows.length > 0 && 'import-pending-error',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onClick={() => void confirm()}
            >
              {saving ? 'Importando…' : 'Confirmar importação'}
            </button>
            <button
              type="button"
              className="filter-button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancelar importação
            </button>
          </div>
        </>
      )}
      {saving && (
        <p role="status" className="record-hint">
          Importando e gravando o treino…
        </p>
      )}
      {error && (
        <p role="alert" className="record-error">
          {error}
        </p>
      )}
    </section>
  );
}
