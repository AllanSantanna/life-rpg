import { useCommand } from '../records/useCommand';
import { formText, formNumber, newId } from '../records/form';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import {
  Actions,
  DateField,
  Empty,
  Field,
  RecordForm,
  Summary,
  RecordFeedback,
} from '../records/RecordUI';
import { displayDate } from '../records/dates';
import { bookProgress, readingStats } from './calculations';
import { ProgressBar } from '../../shared/components/ProgressBar';
export function KnowledgePage({ records, today, onCommand }: RecordPageProps) {
  const [bookId, setBookId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { run, message } = useCommand(onCommand);
  const book = records.books.find((item) => item.id === bookId);
  const reading = records.readings.find((item) => item.id === readingId);
  const stats = readingStats(records.books, records.readings, today);
  return (
    <div className="pillar-page" data-area="Conhecimento">
      <Summary
        values={[
          { label: 'Páginas lidas · total', value: stats.total },
          { label: 'Últimos 7 dias', value: stats.weekly },
          { label: 'Mês atual', value: stats.monthly },
          { label: 'Livros concluídos', value: stats.completed },
        ]}
      />
      <div className="record-columns">
        <RecordForm
          key={`book:${bookId}:${revision}`}
          title={book ? 'Editar livro' : 'Cadastrar livro'}
          onSubmit={(data) => {
            const error = run({
              type: 'saveBook',
              value: {
                id: book?.id ?? newId(),
                title: formText(data, 'title'),
                totalPages: formNumber(data, 'totalPages'),
              },
            });
            if (!error) {
              setBookId(null);
              setRevision((value) => value + 1);
            }
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
            onCancel={book ? () => setBookId(null) : undefined}
          />
        </RecordForm>
        {records.books.length > 0 && (
          <RecordForm
            key={`reading:${readingId}:${revision}`}
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
              if (!error) {
                setReadingId(null);
                setRevision((value) => value + 1);
              }
              return error;
            }}
          >
            <Field label="Livro da leitura">
              <select name="bookId" defaultValue={reading?.bookId}>
                {records.books.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Páginas lidas neste registro">
              <input
                name="pages"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={reading?.pages}
              />
            </Field>
            <DateField today={today} value={reading?.date} />
            <p className="record-hint">
              Informe as páginas lidas nesta sessão, não a página atual do
              livro.
            </p>
            <Actions
              submit={reading ? 'Salvar leitura' : 'Adicionar leitura'}
              onCancel={reading ? () => setReadingId(null) : undefined}
            />
          </RecordForm>
        )}
      </div>
      <RecordFeedback message={message} />
      {([false, true] as const).map((completed) => (
        <section
          className="panel record-section"
          key={String(completed)}
          aria-label={completed ? 'Livros concluídos' : 'Livros em andamento'}
        >
          <h2>{completed ? 'Livros concluídos' : 'Livros em andamento'}</h2>
          <ul className="record-list">
            {records.books
              .filter(
                (item) =>
                  bookProgress(item, records.readings).completed === completed,
              )
              .map((item) => {
                const progress = bookProgress(item, records.readings);
                return (
                  <li key={item.id} className="book-row">
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {progress.pages} / {item.totalPages} páginas ·{' '}
                        {progress.remaining} restantes · {progress.percent}%
                      </p>
                      <ProgressBar
                        label={`Leitura de ${item.title}`}
                        value={progress.pages}
                        max={item.totalPages}
                      />
                    </div>
                    <div className="record-actions">
                      <button onClick={() => setBookId(item.id)}>
                        Editar livro {item.title}
                      </button>
                      {!completed && (
                        <button
                          onClick={() =>
                            run({
                              type: 'finishBook',
                              id: item.id,
                              date: today,
                              entryId: newId(),
                            })
                          }
                        >
                          Concluir {item.title}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
          {!records.books.some(
            (item) =>
              bookProgress(item, records.readings).completed === completed,
          ) && (
            <Empty>
              {completed
                ? 'Os livros finalizados ficarão guardados aqui.'
                : 'Cadastre um livro para começar.'}
            </Empty>
          )}
        </section>
      ))}
      <section
        className="panel record-section"
        aria-label="Histórico de leitura"
      >
        <h2>Histórico de leitura</h2>
        <p className="record-hint">
          Concluir um livro registra as páginas restantes na data de hoje.
          Corrija essa entrada para ajustar ou desfazer a conclusão.
        </p>
        <ul className="record-list">
          {[...records.readings]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => {
              const title = records.books.find(
                (book) => book.id === item.bookId,
              )?.title;
              return (
                <li key={item.id}>
                  <div>
                    <strong>{title}</strong>
                    <p>
                      {displayDate(item.date)} · {item.pages} páginas
                    </p>
                  </div>
                  <div className="record-actions">
                    <button
                      onClick={() => setReadingId(item.id)}
                      aria-label={`Editar leitura de ${title}, ${displayDate(item.date)}, ${item.pages} páginas`}
                    >
                      Editar leitura
                    </button>
                    <button
                      onClick={() =>
                        run({ type: 'deleteReading', id: item.id })
                      }
                      aria-label={`Excluir leitura de ${title}, ${displayDate(item.date)}, ${item.pages} páginas`}
                    >
                      Excluir leitura
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
        {!records.readings.length && <Empty>Nenhuma leitura registrada.</Empty>}
      </section>
    </div>
  );
}
