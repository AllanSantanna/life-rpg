import type { WorkoutPlan } from '../types';
import { displayDate } from '../../../records/dates';
import { suggestedPlans } from './suggestedPlans';
import type { WorkoutMetadata } from './types';

export function MetadataReview({
  metadata,
  plans,
  selectedDate,
  choice,
  today,
  onDateChoice,
  onPlan,
}: {
  metadata: WorkoutMetadata;
  plans: WorkoutPlan[];
  selectedDate: string;
  choice: string;
  today: string;
  onDateChoice: (value: string) => void;
  onPlan: (id: string) => void;
}) {
  const conflicts = metadata.dates.some((date) => date !== selectedDate);
  return (
    <div
      className="strength-stack import-metadata"
      role="group"
      aria-label="Metadados do texto"
    >
      {metadata.title && (
        <p className="record-hint">Nome do treino no texto: {metadata.title}</p>
      )}
      {metadata.division && (
        <p className="record-hint">Divisão informada: {metadata.division}</p>
      )}
      {suggestedPlans(metadata, plans).map((p) => (
        <button
          key={p.id}
          type="button"
          className="filter-button"
          onClick={() => onPlan(p.id)}
        >
          Usar ficha sugerida: {p.name}
        </button>
      ))}
      {metadata.partialDates.length > 0 && (
        <p className="record-hint">
          WhatsApp: {metadata.partialDates.join(', ')} sem ano. Confira a data
          selecionada; o ano não foi presumido.
        </p>
      )}
      {metadata.dates.length > 0 && (
        <p className="record-hint">
          Data(s) no texto: {metadata.dates.map(displayDate).join(', ')}.
        </p>
      )}
      {conflicts && (
        <div className="strength-confirm strength-stack">
          <p>
            A data do texto difere da data selecionada (
            {displayDate(selectedDate)}). Confirme qual deseja usar.
          </p>
          <button
            type="button"
            className="filter-button"
            aria-pressed={choice === 'selected'}
            aria-describedby={choice ? undefined : 'import-date-choice-error'}
            onClick={() => onDateChoice('selected')}
          >
            Manter data selecionada: {displayDate(selectedDate)}
          </button>
          {metadata.dates.map((date) => (
            <button
              key={date}
              type="button"
              className="filter-button"
              aria-pressed={choice === date}
              disabled={date > today}
              onClick={() => onDateChoice(date)}
            >
              Usar data do texto: {displayDate(date)}
              {date > today ? ' (futura)' : ''}
            </button>
          ))}
          {!choice && (
            <p className="record-error" id="import-date-choice-error">
              Escolha uma data para continuar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
