import type { ReactNode } from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import type { CharacterState } from './character';
import { classCatalog } from './classes';
import { EvolutionRadar } from '../evolution/EvolutionRadar';
import type { Scores } from '../evolution/scoring';
import { useProgressFeedback } from '../../shared/hooks/useProgressFeedback';
import { JourneyLandscape } from '../../shared/components/JourneyArt';
import { Icon } from '../../shared/components/Icon';
import { ProgressBar } from '../../shared/components/ProgressBar';
import type { PlayerProfile } from './types';
import type { PlayerProgress } from '../gamification/types';

export function PlayerHeader({
  player,
  character,
  progress,
  dedication,
  onOpenEvolution,
  portrait,
}: {
  player: PlayerProfile;
  character: CharacterState;
  progress: PlayerProgress;
  dedication: Scores;
  onOpenEvolution: () => void;
  portrait?: ReactNode;
}) {
  const currentClass = character.classification.current
    ? classCatalog[character.classification.current]
    : null;
  const xpFeedback = useProgressFeedback(
    (progress.level - 1) * progress.xpPerLevel + progress.xp,
  );
  const levelFeedback = useProgressFeedback(progress.level);
  return (
    <section
      aria-label="Resumo do jogador"
      className="player-banner panel relative mb-8 overflow-hidden p-5 sm:p-7"
    >
      <JourneyLandscape />
      {levelFeedback.delta > 0 && (
        <div
          key={levelFeedback.sequence}
          className="level-celebration"
          aria-hidden="true"
        >
          <Icon name="sparkle" size={20} /> Nível {progress.level} alcançado!
        </div>
      )}
      <div className="player-content relative">
        <div className="player-identity flex items-center gap-4">
          <div className="relative shrink-0">
            {portrait ?? (
              <CharacterAvatar
                avatar={character.avatar}
                name={player.name}
                className="player-avatar"
              />
            )}
            <span
              aria-label={`Nível do personagem: ${progress.level}`}
              className="character-level-badge"
            >
              {progress.level}
            </span>
          </div>
          <div className="player-details">
            <p className="eyebrow mb-2 text-red-400">Ficha do personagem</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {player.name}
            </h2>
            <p className="player-class">
              <span
                aria-label="Classe automática"
                className="player-class-badge"
              >
                <Icon name={currentClass?.icon ?? 'target'} size={15} />
                <strong>{currentClass?.name ?? 'Sem classe definida'}</strong>
              </span>
              <strong className="player-level">Nível {progress.level}</strong>
            </p>
            <p className="player-journey">
              Classe automática · últimos 30 dias
            </p>
          </div>
        </div>
        <div className="player-experience">
          {xpFeedback.delta > 0 && (
            <span
              key={xpFeedback.sequence}
              className="xp-gain"
              aria-hidden="true"
            >
              +{xpFeedback.delta} XP
            </span>
          )}
          <div className="mb-3 flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 font-medium">
              <Icon name="bolt" size={14} className="text-red-400" />
              Experiência
            </span>
            <span className="font-mono text-muted">
              <strong className="font-medium text-foreground">
                {progress.xp.toLocaleString('pt-BR')}
              </strong>{' '}
              / {progress.xpPerLevel.toLocaleString('pt-BR')} XP
            </span>
          </div>
          <ProgressBar
            label="Experiência do jogador"
            value={progress.xp}
            max={progress.xpPerLevel}
            className="h-3"
          />
          <p className="mt-2.5 text-xs text-muted">
            <strong className="xp-percentage">
              {Math.round((progress.xp / progress.xpPerLevel) * 100)}%
            </strong>
            Faltam{' '}
            <span className="text-foreground">
              {(progress.xpPerLevel - progress.xp).toLocaleString('pt-BR')} XP
            </span>{' '}
            para o nível {progress.level + 1}
          </p>
        </div>
        <div className="radar-shortcut">
          <EvolutionRadar scores={dedication} compact />
          <button
            type="button"
            onClick={onOpenEvolution}
            className="radar-open"
            aria-label="Ver Radar de Evolução em Estatísticas"
            title="Ver evolução em Estatísticas"
          />
        </div>
      </div>
    </section>
  );
}
