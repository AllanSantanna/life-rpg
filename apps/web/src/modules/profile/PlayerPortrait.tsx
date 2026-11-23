import { useId } from 'react';
import type { ClassId } from './classes';
import { playerPortrait, portraitStages } from './portraits';
import './playerPortrait.css';

export function PlayerPortrait({
  classId,
  level,
  name,
}: {
  classId: ClassId | null;
  level: number;
  name: string;
}) {
  const portrait = playerPortrait(classId, level);
  const descriptionId = useId();
  return (
    <figure
      className="player-portrait"
      data-portrait-class={portrait.character}
      data-portrait-stage={portrait.stage}
    >
      <img
        src={portrait.src}
        width={portrait.width}
        height={portrait.height}
        alt={`Avatar de ${name}`}
        aria-describedby={descriptionId}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      <figcaption id={descriptionId} className="sr-only">
        {portrait.className} · estágio {portrait.stage},{' '}
        {portraitStages[portrait.stage]}
      </figcaption>
    </figure>
  );
}
