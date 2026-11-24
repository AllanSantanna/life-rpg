import { plural } from '../../../shared/lib/plural';
import {
  achievementCatalog,
  achievementMetrics as metricInfo,
  achievementRarities,
  type AchievementDefinition,
} from './catalog';
import {
  achievementMetrics,
  type AchievementMetrics,
  type AchievementSources,
} from './metrics';

export interface AchievementStatus extends AchievementDefinition {
  unlocked: boolean;
  /** Valor real da métrica, limitado ao objetivo para a barra de progresso. */
  current: number;
  /** Data dos registros em que o objetivo foi atingido, se determinável. */
  unlockedOn: string | null;
  /** Texto do progresso: nunca estimado nem arredondado para cima. */
  progress: string;
}

function progressText(definition: AchievementDefinition, value: number) {
  const { kind, unit } = metricInfo[definition.metric];
  const goal = plural(definition.target, unit[0], unit[1]);
  const shown = Math.min(value, definition.target);
  if (kind === 'streak') return `Maior sequência: ${shown} de ${goal}`;
  if (kind === 'best') return `Melhor janela: ${shown} de ${goal}`;
  return `${shown} de ${goal}`;
}

export function evaluateAchievements(
  metrics: AchievementMetrics,
  catalog: readonly AchievementDefinition[] = achievementCatalog,
): AchievementStatus[] {
  return catalog.map((definition) => {
    const metric = metrics[definition.metric];
    const unlocked = metric.value >= definition.target;
    return {
      ...definition,
      unlocked,
      current: Math.min(metric.value, definition.target),
      unlockedOn: unlocked ? metric.reachedOn(definition.target) : null,
      progress: unlocked
        ? 'Conquistada'
        : progressText(definition, metric.value),
    };
  });
}

/** Projeção pura: recalculada a cada alteração dos registros, sem gravar nada. */
export function projectAchievements(sources: AchievementSources) {
  return evaluateAchievements(achievementMetrics(sources));
}

const rarityRank = (status: AchievementStatus) =>
  achievementRarities.indexOf(status.rarity);

export function achievementTotals(statuses: readonly AchievementStatus[]) {
  const unlocked = statuses.filter((status) => status.unlocked).length;
  return {
    total: statuses.length,
    unlocked,
    locked: statuses.length - unlocked,
    // Arredondado para baixo: 100% só quando todas estiverem conquistadas.
    percent: statuses.length
      ? Math.floor((unlocked / statuses.length) * 100)
      : 0,
  };
}

/** Mais recentes pela data dos registros; sem data, as mais raras. */
export function recentAchievements(
  statuses: readonly AchievementStatus[],
  limit = 3,
) {
  return statuses
    .filter((status) => status.unlocked)
    .sort(
      (a, b) =>
        (b.unlockedOn ?? '').localeCompare(a.unlockedOn ?? '') ||
        rarityRank(b) - rarityRank(a),
    )
    .slice(0, limit);
}

/** Destaques automáticos: maior raridade e, em seguida, mais recentes. */
export function featuredAchievements(
  statuses: readonly AchievementStatus[],
  limit = 4,
) {
  return statuses
    .filter((status) => status.unlocked)
    .sort(
      (a, b) =>
        rarityRank(b) - rarityRank(a) ||
        (b.unlockedOn ?? '').localeCompare(a.unlockedOn ?? ''),
    )
    .slice(0, limit);
}

/**
 * Bloqueada com maior fração real do objetivo. Sem nenhum progresso, não há
 * "mais próxima": a interface explica como começar em vez de inventar um valor.
 */
export function nearestAchievement(statuses: readonly AchievementStatus[]) {
  return (
    statuses
      .filter((status) => !status.unlocked && status.current > 0)
      .sort(
        (a, b) =>
          b.current / b.target - a.current / a.target ||
          a.target - b.target ||
          rarityRank(a) - rarityRank(b),
      )[0] ?? null
  );
}
