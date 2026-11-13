import { EvolutionRadar } from '../evolution/EvolutionRadar';
import type { Scores } from '../evolution/scoring';
import { useProgressFeedback } from '../../shared/hooks/useProgressFeedback';
import {
  HeroPortrait,
  JourneyLandscape,
} from '../../shared/components/JourneyArt';
import { Icon } from '../../shared/components/Icon';
import { ProgressBar } from '../../shared/components/ProgressBar';
import type { PlayerProfile } from './types';
import type { PlayerProgress } from '../gamification/types';

export function PlayerHeader({
  player,
  progress,
  dedication,
  onOpenEvolution,
}: {
  player: PlayerProfile;
  progress: PlayerProgress;
  dedication: Scores;
  onOpenEvolution: () => void;
}) {
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
          <div
            role="img"
            aria-label={`Avatar de ${player.name}`}
            className="player-avatar relative grid size-16 shrink-0 place-items-center rounded-2xl border border-primary/40 text-xl font-semibold sm:size-20 sm:text-2xl"
          >
            <HeroPortrait />
            <span
              aria-hidden="true"
              className="absolute -bottom-2 -right-2 grid size-7 place-items-center rounded-lg border border-background bg-primary text-[11px]"
            >
              {progress.level}
            </span>
          </div>
          <div className="player-details">
            <p className="eyebrow mb-2 text-red-400">Sua jornada começa aqui</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {player.name}
              <span className="ml-3 inline-flex align-middle text-red-400">
                <Icon name="shield" size={18} />
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted">
              {player.title} <span className="mx-1.5 text-white/20">/</span>{' '}
              <strong className="player-level">Nível {progress.level}</strong>
            </p>
            <p className="player-journey">{player.journey}</p>
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
