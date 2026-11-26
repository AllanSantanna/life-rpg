import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { Icon } from '../../shared/components/Icon';
import { DEFAULT_CATEGORY } from '../finances/categories';
import { formatCurrency, unitsToDecimal } from '../finances/monetary';
import { MoneyInput } from '../finances/MoneyInput';
import { MovementForm } from '../finances/MovementsPanel';
import { ReadingForm } from '../knowledge/KnowledgeForms';
import { formText } from '../records/form';
import { Actions, DateField, RecordForm } from '../records/RecordUI';
import type { LifeRecords, RecordCommand } from '../records/types';
import { SleepForm } from '../rest/SleepForm';
import type { DraftIssue } from './commands';
import { dateLabel } from './labels';
import type {
  ParseContext,
  ParseResult,
  VoiceDraft,
  VoiceField,
  VoiceIntent,
} from './types';

export type VoiceStatus =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'preview'
  | 'editing'
  | 'error'
  | 'unavailable';

/** Alteração feita no cartão; `undefined` limpa o campo. */
export type DraftPatch = {
  [Key in keyof VoiceDraft]?: VoiceDraft[Key] | undefined;
};

const fieldLabels: Record<VoiceField, string> = {
  kind: 'tipo de movimentação',
  amount: 'valor',
  description: 'descrição',
  category: 'categoria',
  hours: 'horas dormidas',
  pages: 'páginas',
  book: 'livro',
  date: 'data',
};
const titles: Record<VoiceIntent, string> = {
  'finance.expense': 'Confirmar despesa',
  'finance.income': 'Confirmar receita',
  'rest.sleep': 'Confirmar sono',
  'knowledge.reading': 'Confirmar leitura',
  'workout.simple': 'Confirmar treino',
};
/** Pilar e ação reconhecida, exibidos no topo do cartão. */
const actions: Record<VoiceIntent, { pillar: string; action: string }> = {
  'finance.expense': { pillar: 'Finanças', action: 'Registrar despesa' },
  'finance.income': { pillar: 'Finanças', action: 'Registrar receita' },
  'rest.sleep': { pillar: 'Descanso', action: 'Registrar horas de sono' },
  'knowledge.reading': {
    pillar: 'Conhecimento',
    action: 'Registrar páginas lidas',
  },
  'workout.simple': { pillar: 'Treinos', action: 'Registrar treino realizado' },
};
const pillarChoices: { type: VoiceIntent; label: string }[] = [
  { type: 'finance.expense', label: 'Despesa' },
  { type: 'finance.income', label: 'Receita' },
  { type: 'rest.sleep', label: 'Sono' },
  { type: 'knowledge.reading', label: 'Leitura' },
  { type: 'workout.simple', label: 'Treino' },
];
const decimalText = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/**
 * Janela do comando por voz: modal nativo (top layer), sem disputar camadas
 * com a navegação, as ajudas “?” ou os avisos. Mostra o estado da escuta, a
 * frase reconhecida (editável) e o cartão de confirmação, que também permite
 * corrigir os campos. Nada é gravado aqui: “Confirmar” e os formulários de
 * edição chamam o dono do estado.
 */
export function VoiceCommandDialog({
  status,
  records,
  context,
  transcript,
  result,
  draft,
  issues,
  attempt,
  error,
  saveError,
  saving,
  canListen,
  onChange,
  onChoosePillar,
  onListen,
  onCancelListening,
  onInterpret,
  onEdit,
  onBackToPreview,
  onConfirm,
  onRetrySave,
  onQuickActions,
  onClose,
  run,
  onFormSaved,
}: {
  status: VoiceStatus;
  records: LifeRecords;
  context: ParseContext;
  transcript: string;
  result: ParseResult | null;
  /** Rascunho com as correções feitas no cartão. */
  draft: VoiceDraft | null;
  /** Pendências atuais do rascunho (`validateDraft`). */
  issues: readonly DraftIssue[];
  /** Muda a cada tentativa de confirmar com pendências. */
  attempt: number;
  error: string;
  saveError: string;
  saving: boolean;
  canListen: boolean;
  onChange: (patch: DraftPatch) => void;
  onChoosePillar: (type: VoiceIntent) => void;
  onListen: () => void;
  onCancelListening: () => void;
  onInterpret: (text: string) => void;
  onEdit: () => void;
  onBackToPreview: () => void;
  onConfirm: () => void;
  onRetrySave: () => void;
  onQuickActions: () => void;
  onClose: () => void;
  run: (command: RecordCommand) => string | null;
  onFormSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [text, setText] = useState(transcript);
  useEffect(() => setText(transcript), [transcript]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') {
      if (!element.open) element.showModal();
    } else element.setAttribute('open', '');
    return () => {
      if (typeof element.close === 'function' && element.open) element.close();
      else element.removeAttribute('open');
    };
  }, []);
  // Foco: ação principal de cada estado (o formulário de edição cuida do seu).
  useEffect(() => {
    if (status === 'editing') return;
    dialog.current
      ?.querySelector<HTMLElement>('[data-voice-focus]')
      ?.focus({ preventScroll: true });
  }, [status, result]);
  // Confirmar com pendências: foco no primeiro campo a corrigir.
  useEffect(() => {
    if (!attempt) return;
    dialog.current
      ?.querySelector<HTMLElement>(
        '.voice-field[data-pending] :is(input:not([type="hidden"]), button)',
      )
      ?.focus();
  }, [attempt]);

  const busy = saving;
  const editor = (
    <form
      className="record-field voice-text"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) onInterpret(text.trim());
      }}
    >
      <label htmlFor={`${id}-text`}>
        {status === 'preview' ? 'Corrigir a frase' : 'Ou digite o comando'}
      </label>
      <div className="voice-text__row">
        <input
          id={`${id}-text`}
          value={text}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="go"
          placeholder="Ex.: Gastei 10 reais com chocolate"
          onChange={(event) => setText(event.target.value)}
          {...(status === 'unavailable' ? { 'data-voice-focus': true } : {})}
        />
        <button type="submit" className="filter-button" disabled={!text.trim()}>
          Interpretar
        </button>
      </div>
    </form>
  );
  const saveFeedback = (
    <>
      {saving && (
        <p className="record-hint" role="status">
          Salvando…
        </p>
      )}
      {saveError && (
        <div className="record-error" role="alert">
          <p>{saveError}</p>
          <button
            type="button"
            className="filter-button"
            disabled={busy}
            onClick={onRetrySave}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </>
  );

  let body: ReactNode;
  if (status === 'requesting' || status === 'listening')
    body = (
      <div className="voice-listening" aria-live="polite">
        <span
          className="voice-listening__pulse"
          data-active={status === 'listening' || undefined}
          aria-hidden="true"
        >
          <Icon name="mic" size={26} />
        </span>
        <p className="voice-listening__state">
          {status === 'listening'
            ? 'Ouvindo...'
            : 'Solicitando acesso ao microfone…'}
        </p>
        <p className="record-hint">Fale o que deseja registrar.</p>
        <button
          type="button"
          className="filter-button"
          data-voice-focus
          onClick={onCancelListening}
        >
          Cancelar
        </button>
      </div>
    );
  else if (status === 'processing')
    body = (
      <p className="voice-listening__state" aria-live="polite">
        Interpretando…
      </p>
    );
  else if (status === 'editing' && draft)
    body = (
      <>
        <EditForm
          draft={draft}
          records={records}
          today={context.today}
          run={run}
          onSaved={onFormSaved}
          onCancel={onBackToPreview}
        />
        {saveFeedback}
      </>
    );
  else if (status === 'preview' && result && !draft)
    body = (
      <>
        <Heard text={result.text} />
        <div className="voice-card" role="alert">
          <p className="voice-card__title">Não consegui identificar a ação.</p>
          {[...result.ambiguities, ...result.errors]
            .filter((item) => item !== 'Não consegui identificar a ação.')
            .map((item) => (
              <p key={item} className="record-hint">
                {item}
              </p>
            ))}
        </div>
        <div
          className="voice-chips"
          role="group"
          aria-label="Escolher o que registrar"
        >
          <span className="voice-field__label">O que deseja registrar?</span>
          {pillarChoices.map((choice) => (
            <button
              key={choice.type}
              type="button"
              className="voice-chip"
              onClick={() => onChoosePillar(choice.type)}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <div className="record-actions voice-actions">
          {canListen && (
            <button
              type="button"
              className="filter-button"
              data-voice-focus
              onClick={onListen}
            >
              <Icon name="mic" size={16} /> Falar de novo
            </button>
          )}
          <button
            type="button"
            className="filter-button"
            {...(canListen ? {} : { 'data-voice-focus': true })}
            onClick={onQuickActions}
          >
            Abrir ações rápidas
          </button>
        </div>
        {editor}
      </>
    );
  else if (status === 'preview' && result && draft) {
    const existingSleep =
      draft.type === 'rest.sleep'
        ? records.sleep.find((day) => day.date === draft.date)
        : undefined;
    body = (
      <>
        <Heard text={result.text} />
        <Card
          key={result.text}
          draft={draft}
          result={result}
          context={context}
          issues={issues}
          attempt={attempt}
          existingSleep={existingSleep?.hours}
          onChange={onChange}
        />
        {saveFeedback}
        {error && (
          <p className="record-error" role="alert">
            {error}
          </p>
        )}
        <div className="record-actions voice-actions" inert={busy}>
          <button type="button" className="filter-button" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="filter-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="record-primary"
            data-voice-focus
            data-pending={issues.length > 0 || undefined}
            disabled={busy}
            aria-busy={busy || undefined}
            aria-describedby={issues.length ? `${id}-pending` : undefined}
            onClick={onConfirm}
          >
            {busy
              ? 'Salvando…'
              : existingSleep
                ? 'Substituir registro'
                : 'Confirmar'}
          </button>
        </div>
        {issues.length > 0 && (
          <p id={`${id}-pending`} className="sr-only">
            Pendente:{' '}
            {issues.map((issue) => fieldLabels[issue.field]).join(', ')}.
          </p>
        )}
        {editor}
      </>
    );
  } else
    body = (
      <>
        {error ? (
          <p className="record-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="voice-intro">Fale o que deseja registrar.</p>
        )}
        <ul className="voice-examples" aria-label="Exemplos">
          <li>“Gastei 10 reais com chocolate.”</li>
          <li>“Dormi 7 horas e meia.”</li>
          <li>“Li 20 páginas de Meditações.”</li>
          <li>“Treinei hoje.”</li>
        </ul>
        {canListen && (
          <div className="record-actions">
            <button
              type="button"
              className="record-primary voice-start"
              data-voice-focus
              onClick={onListen}
            >
              <Icon name="mic" size={18} /> Falar
            </button>
          </div>
        )}
        {editor}
      </>
    );

  return (
    <dialog
      ref={dialog}
      className="voice-dialog"
      aria-labelledby={`${id}-title`}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="panel voice-panel" data-status={status}>
        <div className="voice-panel__header">
          <h2 id={`${id}-title`}>
            {status === 'preview' && draft
              ? titles[draft.type]
              : 'Comando por voz'}
          </h2>
          <button
            type="button"
            className="quick-dialog__close voice-close"
            aria-label="Fechar comando por voz"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {status === 'unavailable' && (
          <p className="record-hint" role="status">
            O reconhecimento de voz não está disponível neste navegador. Digite
            o comando ou use o ditado do teclado.
          </p>
        )}
        {body}
        {status !== 'editing' && (
          <p className="voice-privacy">
            O reconhecimento usa o serviço de fala do navegador, que pode
            processar o áudio fora do aparelho. O Life RPG não grava áudio nem
            guarda a frase.
          </p>
        )}
      </div>
    </dialog>
  );
}

function Heard({ text }: { text: string }) {
  return (
    <p className="voice-heard">
      <span>Frase reconhecida</span>“{text}”
    </p>
  );
}

/**
 * Cartão de confirmação editável. Os controles mostram exatamente o rascunho
 * validado: nenhum valor aparece como escolhido sem estar no rascunho.
 */
function Card({
  draft,
  result,
  context,
  issues,
  attempt,
  existingSleep,
  onChange,
}: {
  draft: VoiceDraft;
  result: ParseResult;
  context: ParseContext;
  issues: readonly DraftIssue[];
  attempt: number;
  existingSleep: number | undefined;
  onChange: (patch: DraftPatch) => void;
}) {
  const id = useId();
  const issueFor = (name: VoiceField) =>
    issues.find((issue) => issue.field === name);
  const invalid = (name: VoiceField) =>
    issueFor(name)
      ? ({
          'aria-invalid': true,
          'aria-describedby': `${id}-${name}-issue`,
        } as const)
      : {};
  const field = (
    name: VoiceField,
    label: string,
    content: ReactNode,
    labelFor = true,
  ) => {
    const issue = issueFor(name);
    return (
      <div
        key={name}
        className="record-field voice-field"
        data-field={name}
        data-pending={issue ? true : undefined}
      >
        {labelFor ? (
          <label className="voice-field__label" htmlFor={`${id}-${name}`}>
            {label}
          </label>
        ) : (
          <span className="voice-field__label" id={`${id}-${name}-label`}>
            {label}
          </span>
        )}
        {content}
        {issue && (
          <p id={`${id}-${name}-issue`} className="voice-field__issue">
            {issue.message}
          </p>
        )}
      </div>
    );
  };
  const { pillar, action } = actions[draft.type];
  const finance =
    draft.type === 'finance.expense' || draft.type === 'finance.income';
  const tone = draft.kindPending
    ? 'pending'
    : draft.type === 'finance.income'
      ? 'income'
      : draft.type === 'finance.expense'
        ? 'expense'
        : 'neutral';
  const fields: ReactNode[] = [];

  if (finance) {
    const kind = draft.type === 'finance.income' ? 'income' : 'expense';
    const categories = [
      ...new Set([
        ...(kind === 'income'
          ? context.categories.income
          : context.categories.expense),
        DEFAULT_CATEGORY,
      ]),
    ];
    fields.push(
      field(
        'kind',
        'Tipo de movimentação',
        <div
          className="voice-segment"
          role="group"
          aria-labelledby={`${id}-kind-label`}
        >
          {(['finance.expense', 'finance.income'] as const).map(
            (type, index) => (
              <button
                key={type}
                type="button"
                className="voice-chip"
                data-kind={type === 'finance.income' ? 'income' : 'expense'}
                aria-pressed={!draft.kindPending && draft.type === type}
                {...(index === 0 ? invalid('kind') : {})}
                onClick={() =>
                  onChange({
                    type,
                    kindPending: undefined,
                    // Categoria escolhida para o outro tipo deixa de valer.
                    ...(type !== draft.type ? { category: undefined } : {}),
                  })
                }
              >
                {type === 'finance.income' ? 'Receita' : 'Despesa'}
              </button>
            ),
          )}
        </div>,
        false,
      ),
      field(
        'description',
        'Descrição',
        <input
          id={`${id}-description`}
          {...invalid('description')}
          value={draft.description ?? ''}
          maxLength={200}
          autoComplete="off"
          onChange={(event) =>
            onChange({ description: event.target.value || undefined })
          }
        />,
      ),
      field(
        'amount',
        'Valor (R$)',
        <label className="voice-money">
          <span className="sr-only">Valor (R$)</span>
          <MoneyInput
            name="voiceAmount"
            defaultValue={
              draft.amountCents ? unitsToDecimal(draft.amountCents, 2) : ''
            }
            onValueChange={(cents) =>
              onChange({ amountCents: cents && cents > 0 ? cents : undefined })
            }
          />
        </label>,
        false,
      ),
    );
    if (draft.amountDetail)
      fields.push(
        <p key="detail" className="record-hint">
          Cálculo reconhecido: {draft.amountDetail} ={' '}
          {formatCurrency(draft.amountCents ?? 0)}.
        </p>,
      );
    fields.push(
      field(
        'category',
        'Categoria',
        <div
          className="voice-chips"
          role="group"
          aria-labelledby={`${id}-category-label`}
        >
          {categories.map((category, index) => (
            <button
              key={category}
              type="button"
              className="voice-chip"
              aria-pressed={draft.category === category}
              {...(index === 0 ? invalid('category') : {})}
              onClick={() => onChange({ category })}
            >
              {category}
            </button>
          ))}
        </div>,
        false,
      ),
    );
  } else if (draft.type === 'rest.sleep')
    fields.push(
      field(
        'hours',
        'Horas dormidas',
        <NumberField
          id={`${id}-hours`}
          invalid={invalid('hours')}
          value={draft.hours}
          decimal
          onChange={(hours) => onChange({ hours })}
        />,
      ),
    );
  else if (draft.type === 'knowledge.reading') {
    const active = context.books.filter((book) => !book.completed);
    const book = context.books.find((item) => item.id === draft.bookId);
    fields.push(
      field(
        'book',
        'Livro',
        active.length > 1 || !book ? (
          <div
            className="voice-chips"
            role="group"
            aria-labelledby={`${id}-book-label`}
          >
            {active.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="voice-chip"
                aria-pressed={draft.bookId === item.id}
                {...(index === 0 ? invalid('book') : {})}
                onClick={() => onChange({ bookId: item.id })}
              >
                {item.title}
              </button>
            ))}
          </div>
        ) : (
          <strong className="voice-field__value">{book.title}</strong>
        ),
        false,
      ),
      field(
        'pages',
        'Páginas lidas',
        <NumberField
          id={`${id}-pages`}
          invalid={invalid('pages')}
          value={draft.pages}
          onChange={(pages) => onChange({ pages })}
        />,
      ),
    );
    if (book && !book.completed)
      fields.push(
        <p key="remaining" className="record-hint">
          Restam {book.remaining} páginas em “{book.title}”.
        </p>,
      );
  } else
    fields.push(
      <div key="record" className="voice-field">
        <span className="voice-field__label">Registro</span>
        <strong className="voice-field__value">
          Treinou{' '}
          {dateLabel(draft.date, context.today).toLocaleLowerCase('pt-BR')}
        </strong>
      </div>,
      <div key="simple" className="voice-field">
        <span className="voice-field__label">Tipo</span>
        <strong className="voice-field__value">Registro simples</strong>
      </div>,
    );
  fields.push(
    field(
      'date',
      'Data',
      <div className="voice-date">
        <span className="voice-date__control">
          <CustomDatePicker
            label="Data"
            value={draft.date}
            max={context.today}
            required
            onChange={(date) => onChange({ date })}
          />
        </span>
        <span className="voice-date__label">
          {dateLabel(draft.date, context.today)}
        </span>
      </div>,
      false,
    ),
  );

  const parsedNotes = [
    ...result.ambiguities,
    ...result.notes.filter((note) => !/Já existe registro/.test(note)),
  ];
  return (
    <div className="voice-card" data-tone={tone}>
      <p className="voice-card__pillar">
        <span className="voice-card__dot" aria-hidden="true" />
        <span>
          {pillar} · {action}
        </span>
      </p>
      {issues.length > 0 && (
        <p
          key={attempt}
          className="voice-card__pending"
          role={attempt ? 'alert' : 'status'}
        >
          Preciso confirmar algumas informações:{' '}
          {issues.map((issue) => fieldLabels[issue.field]).join(', ')}.
        </p>
      )}
      {parsedNotes.map((note) => (
        <p key={note} className="record-hint">
          {note}
        </p>
      ))}
      {existingSleep !== undefined && (
        <p className="voice-card__warning" role="status">
          Já existe um registro de sono nesta data ({decimalText(existingSleep)}{' '}
          h). Deseja substituí-lo?
        </p>
      )}
      <div className="voice-card__fields">{fields}</div>
    </div>
  );
}

/** Campo numérico do cartão; texto inválido deixa o valor pendente. */
function NumberField({
  id,
  invalid,
  value,
  decimal = false,
  onChange,
}: {
  id: string;
  invalid: object;
  value: number | undefined;
  decimal?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(
    value === undefined ? '' : decimal ? decimalText(value) : String(value),
  );
  return (
    <input
      id={id}
      {...invalid}
      value={text}
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      placeholder={decimal ? 'Ex.: 7,5' : 'Ex.: 20'}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        const normalized = raw.trim().replace(',', '.');
        const pattern = decimal ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/;
        onChange(pattern.test(normalized) ? Number(normalized) : undefined);
      }}
    />
  );
}

/** Edição completa com os formulários e validações existentes de cada pilar. */
function EditForm({
  draft,
  records,
  today,
  run,
  onSaved,
  onCancel,
}: {
  draft: VoiceDraft;
  records: LifeRecords;
  today: string;
  run: (command: RecordCommand) => string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  if (draft.type === 'finance.expense' || draft.type === 'finance.income')
    return (
      <MovementForm
        records={records}
        today={today}
        draft={{
          id: null,
          kind: draft.type === 'finance.income' ? 'income' : 'expense',
          prefill: {
            description: draft.description ?? '',
            amountCents: draft.amountCents ?? 0,
            category: draft.category ?? DEFAULT_CATEGORY,
            date: draft.date,
          },
        }}
        run={run}
        onClose={onSaved}
      />
    );
  if (draft.type === 'rest.sleep')
    return (
      <SleepForm
        records={records}
        today={today}
        initial={{ date: draft.date, hours: draft.hours }}
        run={run}
        onSaved={onSaved}
        onCancel={onCancel}
        cancelLabel="Voltar"
      />
    );
  if (draft.type === 'knowledge.reading')
    return (
      <ReadingForm
        books={records.books}
        readings={records.readings}
        defaultBookId={draft.bookId}
        defaultPages={draft.pages}
        defaultDate={draft.date}
        today={today}
        run={run}
        onSaved={onSaved}
        onCancel={onCancel}
        cancelLabel="Voltar"
      />
    );
  return (
    <RecordForm
      title="Registrar treino"
      onSubmit={(data) => {
        const error = run({
          type: 'saveWorkout',
          value: { date: formText(data, 'date'), trained: true },
        });
        if (!error) onSaved();
        return error;
      }}
    >
      <DateField today={today} value={draft.date} label="Dia do treino" />
      <p className="record-hint">
        Registro simples: marca o dia como treinado, sem sessão avançada.
      </p>
      <Actions submit="Registrar treino" onCancel={onCancel} cancel="Voltar" />
    </RecordForm>
  );
}
