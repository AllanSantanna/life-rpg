import { Icon } from '../../../shared/components/Icon';
import { ProgressBar } from '../../../shared/components/ProgressBar';
import { AchievementMedal } from './AchievementMedal';
import { rarityLabels } from './catalog';
import type { AchievementStatus } from './evaluate';
import { unlockedOnLabel } from './format';

/** Card da galeria: medalha, nome, descrição, raridade, progresso e estado. */
export function AchievementCard({
  status,
  headingLevel = 4,
}: {
  status: AchievementStatus;
  headingLevel?: 3 | 4;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article
      className="achievement-card"
      data-rarity={status.rarity}
      data-state={status.unlocked ? 'unlocked' : 'locked'}
      data-group={status.group}
    >
      <AchievementMedal status={status} size="md" />
      <div className="achievement-card__body">
        <p className="achievement-card__meta">
          <span className="achievement-rarity" data-rarity={status.rarity}>
            {rarityLabels[status.rarity]}
          </span>
          <span>{status.group}</span>
        </p>
        <Heading className="achievement-card__title">{status.title}</Heading>
        <p className="achievement-card__description">{status.description}</p>
        {status.unlocked ? (
          <p className="achievement-card__state is-unlocked">
            <Icon name="check" size={12} />
            {unlockedOnLabel(status)}
          </p>
        ) : (
          <>
            <ProgressBar
              label={`Progresso de ${status.title}`}
              value={status.current}
              max={status.target}
              className="achievement-card__bar"
            />
            <p className="achievement-card__state">
              <Icon name="lock" size={12} />
              <span>
                <span className="sr-only">Bloqueada. </span>
                {status.progress}
              </span>
            </p>
          </>
        )}
      </div>
    </article>
  );
}
