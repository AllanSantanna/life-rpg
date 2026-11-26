import { CustomSelect } from '../../shared/components/CustomSelect';
import { plural } from '../../shared/lib/plural';
import { formNumber, formText, newId } from '../records/form';
import { Actions, DateField, Field, RecordForm } from '../records/RecordUI';
import type { RecordCommand } from '../records/types';
import { bookProgress } from './calculations';
import type { Book, ReadingEntry } from './types';

/**
 * Formulários de livro e leitura compartilhados pela página Conhecimento e
 * pelas Ações rápidas: mesmos comandos (`saveBook`, `saveReading`) e mesmas
 * validações (o comando recusa leituras acima do total de páginas).
 */
export function BookForm({
  book,
  run,
  onSaved,
  onCancel,
  cancelLabel,
}: {
  book?: Book | undefined;
  run: (command: RecordCommand) => string | null;
  /** Recebe o ID do livro salvo (novo ou editado). */
  onSaved?: (id: string) => void;
  onCancel?: (() => void) | undefined;
  cancelLabel?: string;
}) {
  return (
    <RecordForm
      title={book ? 'Editar livro' : 'Cadastrar livro'}
      onSubmit={(data) => {
        const id = book?.id ?? newId();
        const error = run({
          type: 'saveBook',
          value: {
            id,
            title: formText(data, 'title'),
            totalPages: formNumber(data, 'totalPages'),
          },
        });
        if (!error) onSaved?.(id);
        return error;
      }}
    >
      <Field label="Título do livro">
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={book?.title}
        />
      </Field>
      <Field label="Total de páginas">
        <input
          name="totalPages"
          type="number"
          min="1"
          max="1000000"
          step="1"
          required
          defaultValue={book?.totalPages}
        />
      </Field>
      <Actions
        submit={book ? 'Salvar livro' : 'Adicionar livro'}
        onCancel={onCancel}
        {...(cancelLabel ? { cancel: cancelLabel } : {})}
      />
    </RecordForm>
  );
}

export function ReadingForm({
  books,
  readings,
  reading,
  defaultBookId,
  defaultPages,
  defaultDate,
  today,
  run,
  onSaved,
  onCancel,
  cancelLabel,
  singleAsText = false,
}: {
  /** Livros oferecidos na escolha. */
  books: readonly Book[];
  readings: readonly ReadingEntry[];
  reading?: ReadingEntry | undefined;
  defaultBookId?: string | undefined;
  defaultPages?: number | undefined;
  defaultDate?: string | undefined;
  today: string;
  run: (command: RecordCommand) => string | null;
  onSaved?: () => void;
  onCancel?: (() => void) | undefined;
  cancelLabel?: string;
  /** Com um único livro, mostra o título em vez da seleção. */
  singleAsText?: boolean;
}) {
  const single = singleAsText && books.length === 1 ? books[0] : undefined;
  const remaining = single
    ? bookProgress(single, [...readings]).remaining
    : undefined;
  return (
    <RecordForm
      title={reading ? 'Corrigir leitura' : 'Registrar leitura'}
      onSubmit={(data) => {
        const error = run({
          type: 'saveReading',
          value: {
            id: reading?.id ?? newId(),
            bookId: formText(data, 'bookId'),
            pages: formNumber(data, 'pages'),
            date: formText(data, 'date'),
          },
        });
        if (!error) onSaved?.();
        return error;
      }}
    >
      {single ? (
        <div className="record-field">
          <span>Livro da leitura</span>
          <strong className="reading-book-title">{single.title}</strong>
          <input type="hidden" name="bookId" value={single.id} />
        </div>
      ) : (
        <Field label="Livro da leitura">
          <CustomSelect
            label="Livro da leitura"
            name="bookId"
            defaultValue={reading?.bookId ?? defaultBookId}
            options={books.map((item) => ({
              value: item.id,
              label: item.title,
              icon: 'book',
              area: 'Conhecimento',
            }))}
          />
        </Field>
      )}
      <Field label="Páginas lidas neste registro">
        <input
          name="pages"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={reading?.pages ?? defaultPages}
        />
      </Field>
      <DateField today={today} value={reading?.date ?? defaultDate} />
      <p className="record-hint">
        Informe as páginas lidas nesta sessão, não a página atual do livro.
        {remaining !== undefined &&
          ` Restam ${plural(remaining, 'página', 'páginas')}.`}
      </p>
      <Actions
        submit={reading ? 'Salvar leitura' : 'Adicionar leitura'}
        onCancel={onCancel}
        {...(cancelLabel ? { cancel: cancelLabel } : {})}
      />
    </RecordForm>
  );
}
