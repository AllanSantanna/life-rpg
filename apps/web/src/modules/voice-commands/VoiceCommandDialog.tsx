import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../shared/components/Icon';
import { DEFAULT_CATEGORY } from '../finances/categories';
import { formatCurrency } from '../finances/monetary';
import { MovementForm } from '../finances/MovementsPanel';
import { ReadingForm } from '../knowledge/KnowledgeForms';
import { formText } from '../records/form';
import { Actions, DateField, RecordForm } from '../records/RecordUI';
import type { LifeRecords, RecordCommand } from '../records/types';
import { SleepForm } from '../rest/SleepForm';
import { dateLabel } from './labels';
import type { ParseResult, VoiceDraft, VoiceField } from './types';

export type VoiceStatus =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'preview'
  | 'editing'
  | 'error'
  | 'unavailable';

const fieldLabels: Record<VoiceField, string> = {
  amount: 'valor',
  description: 'descrição',
  category: 'categoria',
  hours: 'horas dormidas',
  pages: 'páginas',
  book: 'livro',
};
const titles: Record<VoiceDraft['type'], string> = {
  'finance.expense': 'Confirmar despesa',
  'finance.income': 'Confirmar receita',
  'rest.sleep': 'Confirmar sono',
  'knowledge.reading': 'Confirmar leitura',
  'workout.simple': 'Registrar treino?',
};

const hoursText = (hours: number) =>
  `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;

/**
 * Janela do comando por voz: modal nativo (top layer), sem disputar camadas
 * com a navegação, as ajudas “?” ou os avisos. Mostra o estado da escuta, a
 * frase reconhecida (editável) e o cartão de confirmação. Nada é gravado
 * aqui: “Confirmar” e os formulários de edição chamam `run`.
 */
export function VoiceCommandDialog({
  status,
  records,
  today,
  transcript,
  result,
  draft,
  error,
  saveError,
  saving,
  canListen,
  onChoose,
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
  today: string;
  transcript: string;
  result: ParseResult | null;
  /** Rascunho com as escolhas feitas no cartão (categoria, livro). */
  draft: VoiceDraft | null;
  error: string;
  saveError: string;
  saving: boolean;
  canListen: boolean;
  /** Pode confirmar (comando completo, sem impedimentos). */
  onChoose: (choice: Partial<VoiceDraft>) => void;
  onListen: () => void;
  onCancelListening: () => void;
  onInterpret: (text: string) => void;
  onEdit: () => void;
  onBackToPreview: () => void;
  onConfirm: (() => void) | null;
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
  // Foco: ação principal de cada estado (sem roubar durante a digitação).
  useEffect(() => {
    // Na edição, o formulário reaproveitado gerencia o próprio foco.
    if (status === 'editing') return;
    dialog.current
      ?.querySelector<HTMLElement>('[data-voice-focus]')
      ?.focus({ preventScroll: true });
  }, [status, result]);

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
      <EditForm
        draft={draft}
        records={records}
        today={today}
        run={run}
        onSaved={onFormSaved}
        onCancel={onBackToPreview}
      />
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
  else if (status === 'preview' && result && draft)
    body = (
      <>
        <Heard text={result.text} />
        <Preview
          draft={draft}
          result={result}
          records={records}
          today={today}
          onChoose={onChoose}
        />
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
            disabled={!onConfirm || busy}
            aria-busy={busy || undefined}
            onClick={onConfirm ?? undefined}
          >
            {busy ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
        {editor}
      </>
    );
  else
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
        {status === 'editing' && saving && (
          <p className="record-hint" role="status">
            Salvando…
          </p>
        )}
        {status === 'editing' && saveError && (
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

function Preview({
  draft,
  result,
  records,
  today,
  onChoose,
}: {
  draft: VoiceDraft;
  result: ParseResult;
  records: LifeRecords;
  today: string;
  onChoose: (choice: Partial<VoiceDraft>) => void;
}) {
  const missing = new Set(
    result.missing.filter((field) => {
      if (field === 'category') return !draft.category;
      if (field === 'book') return !draft.bookId;
      return true;
    }),
  );
  const pending = (field: VoiceField) => (
    <span className="voice-card__missing">
      Não informado · use Editar
      <span className="sr-only"> para informar {fieldLabels[field]}</span>
    </span>
  );
  const rows: { label: string; value: ReactNode }[] = [];
  if (draft.type === 'finance.expense' || draft.type === 'finance.income') {
    rows.push(
      {
        label: 'Descrição',
        value: draft.description ?? pending('description'),
      },
      {
        label: 'Valor',
        value:
          draft.amountCents !== undefined
            ? `${formatCurrency(draft.amountCents)}${draft.amountDetail ? ` (${draft.amountDetail})` : ''}`
            : pending('amount'),
      },
    );
    const kind = draft.type === 'finance.income' ? 'income' : 'expense';
    const options = [
      ...new Set([
        ...records.movements
          .filter((item) => item.kind === kind)
          .map((item) => item.category)
          .reverse(),
        DEFAULT_CATEGORY,
      ]),
    ].slice(0, 6);
    rows.push({
      label: 'Categoria',
      value: (
        <Chips
          label="Escolha a categoria"
          options={options.map((value) => ({ value, label: value }))}
          selected={draft.category}
          onSelect={(category) => onChoose({ category })}
        />
      ),
    });
  } else if (draft.type === 'rest.sleep')
    rows.push({
      label: 'Horas dormidas',
      value:
        draft.hours !== undefined ? hoursText(draft.hours) : pending('hours'),
    });
  else if (draft.type === 'knowledge.reading') {
    const candidates = draft.bookCandidates ?? [];
    const book = records.books.find((item) => item.id === draft.bookId);
    rows.push({
      label: 'Livro',
      value:
        candidates.length > 0 ? (
          <Chips
            label="Escolha o livro"
            options={candidates
              .map((id) => records.books.find((item) => item.id === id))
              .filter((item) => item !== undefined)
              .map((item) => ({ value: item.id, label: item.title }))}
            selected={draft.bookId}
            onSelect={(bookId) => onChoose({ bookId })}
          />
        ) : (
          (book?.title ?? pending('book'))
        ),
    });
    rows.push({
      label: 'Páginas',
      value: draft.pages !== undefined ? String(draft.pages) : pending('pages'),
    });
  } else rows.push({ label: 'Tipo', value: 'Registro simples' });
  rows.push({ label: 'Data', value: dateLabel(draft.date, today) });
  const messages = [...result.errors, ...result.ambiguities];
  return (
    <div className="voice-card">
      <dl className="voice-card__fields">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {missing.size > 0 && (
        <p className="record-hint">
          Falta informar:{' '}
          {[...missing].map((field) => fieldLabels[field]).join(', ')}.
        </p>
      )}
      {messages.map((message) => (
        <p key={message} className="record-error">
          {message}
        </p>
      ))}
      {result.notes.map((note) => (
        <p key={note} className="record-hint">
          {note}
        </p>
      ))}
    </div>
  );
}

function Chips({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string | undefined;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="voice-chips" role="group" aria-label={label}>
      {!selected && <span className="voice-card__missing">{label}:</span>}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="voice-chip"
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Edição com os formulários e validações existentes de cada pilar. */
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
