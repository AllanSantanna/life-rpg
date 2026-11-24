import type { CSSProperties } from 'react';
import type { AchievementStatus } from './evaluate';
import { achievementAsset } from './format';
import './achievements.css';

const sizes = { sm: 44, md: 72, lg: 96, xl: 112 } as const;
export type MedalSize = keyof typeof sizes;

/**
 * Medalha original (WebP sem reamostragem) com o tratamento do estado:
 * bloqueada fica dessaturada, escura e com cadeado; desbloqueada recebe brilho
 * da raridade. Épicas e lendárias ganham aura, reflexo e partículas, animados
 * apenas quando `animated` (destaques e apresentação) ou em hover/foco do card.
 * É decorativa: nome, raridade e estado pertencem ao texto ao redor.
 */
export function AchievementMedal({
  status,
  size = 'md',
  animated = false,
  eager = false,
}: {
  status: Pick<AchievementStatus, 'medal' | 'rarity' | 'unlocked'>;
  size?: MedalSize;
  animated?: boolean;
  /** Carrega sem `lazy`: só para a apresentação de desbloqueio. */
  eager?: boolean;
}) {
  const art = achievementAsset(status.medal);
  const pixels = sizes[size];
  const special =
    status.unlocked &&
    (status.rarity === 'epic' || status.rarity === 'legendary');
  return (
    <span
      className="achievement-medal"
      data-rarity={status.rarity}
      data-state={status.unlocked ? 'unlocked' : 'locked'}
      data-animated={animated || undefined}
      aria-hidden="true"
      style={
        {
          '--medal-size': `${pixels}px`,
          '--medal-art': `url("${art}")`,
        } as CSSProperties
      }
    >
      {status.unlocked && status.rarity === 'legendary' && (
        <img
          className="achievement-medal__shine"
          src={achievementAsset('effects/effect-shine.webp')}
          alt=""
          width={pixels}
          height={pixels}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
      <img
        className="achievement-medal__art"
        src={art}
        alt=""
        width={pixels}
        height={pixels}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
      {status.unlocked && status.rarity !== 'common' && (
        <span className="achievement-medal__sheen" />
      )}
      {special && (
        <img
          className="achievement-medal__particles"
          src={achievementAsset('effects/effect-particles.webp')}
          alt=""
          width={pixels}
          height={pixels}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
      {!status.unlocked && (
        <img
          className="achievement-medal__lock"
          src={achievementAsset('ui/ui-locked.webp')}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
        />
      )}
    </span>
  );
}
