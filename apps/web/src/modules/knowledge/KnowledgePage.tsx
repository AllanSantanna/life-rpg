import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { useCommand } from '../records/useCommand';
import { newId } from '../records/form';
import { useState } from 'react';
import type { RecordPageProps } from '../records/types';
import { Empty, Summary, RecordFeedback } from '../records/RecordUI';
import { BookForm, ReadingForm } from './KnowledgeForms';
import { displayDate } from '../records/dates';
import { bookProgress, readingStats } from './calculations';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { plural } from '../../shared/lib/plural';
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
        <BookForm
          key={`book:${bookId}:${revision}`}
          book={book}
          run={run}
          onSaved={() => {
            setBookId(null);
            setRevision((value) => value + 1);
          }}
          onCancel={book ? () => setBookId(null) : undefined}
        />
        {records.books.length > 0 && (
          <ReadingForm
            key={`reading:${readingId}:${revision}`}
            books={records.books}
            readings={records.readings}
            reading={reading}
            today={today}
            run={run}
            onSaved={() => {
              setReadingId(null);
              setRevision((value) => value + 1);
            }}
            onCancel={reading ? () => setReadingId(null) : undefined}
          />
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
                        {plural(
                          item.totalPages,
                          'página',
                          'páginas',
                          `${progress.pages} / ${item.totalPages}`,
                        )}{' '}
                        · {progress.remaining} restantes · {progress.percent}%
                      </p>
                      <ProgressBar
                        label={`Leitura de ${item.title}`}
                        value={progress.pages}
                        max={item.totalPages}
                      />
                    </div>
                    <div className="record-actions">
                      <button
                        type="button"
                        onClick={() => setBookId(item.id)}
                        aria-label={`Editar livro ${item.title}`}
                      >
                        Editar livro
                      </button>
                      {!completed && (
                        <button
                          type="button"
                          onClick={() =>
                            run({
                              type: 'finishBook',
                              id: item.id,
                              date: today,
                              entryId: newId(),
                            })
                          }
                          aria-label={`Concluir ${item.title}`}
                        >
                          Concluir
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
                      {displayDate(item.date)} ·{' '}
                      {plural(item.pages, 'página', 'páginas')}
                    </p>
                  </div>
                  <div className="record-actions">
                    <button
                      type="button"
                      onClick={() => setReadingId(item.id)}
                      aria-label={`Editar leitura de ${title}, ${displayDate(item.date)}, ${item.pages} páginas`}
                    >
                      Editar leitura
                    </button>
                    <ConfirmAction
                      label="Excluir leitura"
                      ariaLabel={`Excluir leitura de ${title}, ${displayDate(item.date)}, ${item.pages} páginas`}
                      className=""
                      detail={`A leitura de ${item.pages} páginas em ${displayDate(item.date)} será excluída; o progresso do livro e o XP são recalculados.`}
                      onConfirm={() =>
                        run({ type: 'deleteReading', id: item.id })
                      }
                    />
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
