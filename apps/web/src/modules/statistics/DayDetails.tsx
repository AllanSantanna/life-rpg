import { areas } from '../evolution/scoring';
import { displayDate } from '../records/dates';
import { emptyActivityDay, intensityLabels } from './aggregation';
import type { ActivityIndex } from './types';

export function DayDetails({
  index,
  date,
}: {
  index: ActivityIndex;
  date: string;
}) {
  const day = index.get(date) ?? emptyActivityDay(date);
  const recorded = areas.filter((area) => day.pillars[area].details.length > 0);
  return (
    <section
      className="statistics-day"
      aria-label="Atividades do dia"
      aria-live="polite"
    >
      <div className="statistics-heading">
        <h3>Atividades do dia</h3>
        <time dateTime={date}>{displayDate(date)}</time>
      </div>
      {recorded.length === 0 ? (
        <p className="record-empty">Nenhum registro nesta data.</p>
      ) : (
        <div className="statistics-day-grid">
          {recorded.map((area) => (
            <div key={area} data-area={area} className="statistics-day-pillar">
              <h4>
                {area}{' '}
                <span>· {intensityLabels[day.pillars[area].intensity]}</span>
              </h4>
              <ul>
                {day.pillars[area].details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
