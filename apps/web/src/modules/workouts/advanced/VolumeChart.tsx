import { displayDate } from '../../records/dates';
import { number, sessionVolume } from './calculations';
import type { WorkoutSession } from './types';
export function VolumeChart({
  sessions,
  includeWarmup,
}: {
  sessions: WorkoutSession[];
  includeWarmup: boolean;
}) {
  const days = new Map<string, number>();
  for (const session of sessions)
    days.set(
      session.date,
      (days.get(session.date) ?? 0) + sessionVolume(session, includeWarmup),
    );
  const entries = [...days].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, volume]) => volume), 1);
  return (
    <figure className="volume-chart">
      <figcaption>
        Volume por dia de treino <small>kg × repetições</small>
      </figcaption>
      <div
        className="volume-bars"
        role="list"
        aria-label="Volume registrado por dia"
      >
        {entries.map(([date, volume]) => (
          <div
            role="listitem"
            className="volume-bar-column"
            key={date}
            tabIndex={0}
            aria-label={`${displayDate(date)}: ${number(volume)} kg·rep`}
            title={`${displayDate(date)} · ${number(volume)} kg·rep`}
          >
            <div className="volume-bar-space">
              <span style={{ height: `${(volume / max) * 100}%` }} />
            </div>
            <small>
              {date.slice(8)}/{date.slice(5, 7)}
            </small>
          </div>
        ))}
      </div>
    </figure>
  );
}
