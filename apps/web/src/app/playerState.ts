import { emptyRecords, type LifeRecords } from '../modules/records/types';
import { isLifeRecords } from '../modules/records/commands';
import {
  player,
  initialProgress,
  initialMissions,
  achievements,
} from './mocks/dashboard';
import { effortHistory } from './mocks/effort';
import {
  areas,
  type EffortActivity,
  type Period,
} from '../modules/evolution/scoring';
import type { PlayerProfile } from '../modules/profile/types';
import type { PlayerProgress } from '../modules/gamification/types';
import type { MissionFilter } from '../modules/missions/types';

export interface LegacyPlayerState {
  profile: PlayerProfile;
  /** Origem da projeção, não o XP/nível derivados atuais. */
  progressOrigin: PlayerProgress;
  missionCompletion: { id: string; completed: boolean }[];
  unlockedAchievementIds: string[];
  activityHistory: EffortActivity[];
  preferences: { radarPeriod: Period; missionFilter: MissionFilter };
}
export interface PlayerState extends LegacyPlayerState {
  records: LifeRecords;
}
export const PLAYER_STORAGE_KEY = 'life-rpg:player-state';
export const PLAYER_STORAGE_VERSION = 2;

export function createDemoPlayerState(): PlayerState {
  return {
    records: emptyRecords(),
    profile: { ...player },
    progressOrigin: { ...initialProgress },
    missionCompletion: initialMissions.map(({ id, completed }) => ({
      id,
      completed,
    })),
    unlockedAchievementIds: achievements
      .filter((item) => item.unlocked)
      .map((item) => item.id),
    activityHistory: effortHistory.map((item) => ({ ...item })),
    preferences: { radarPeriod: 7, missionFilter: 'all' },
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 500
  );
}
function integer(value: unknown, min = 0): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min
  );
}
function activity(value: unknown): value is EffortActivity {
  return (
    record(value) &&
    text(value.id) &&
    areas.some((area) => area === value.area) &&
    integer(value.daysAgo) &&
    value.daysAgo <= 365000 &&
    typeof value.effort === 'number' &&
    Number.isFinite(value.effort) &&
    value.effort > 0 &&
    value.effort <= 1
  );
}

/** Valida o contrato inteiro antes da hidratação. IDs/regras pertencem ao catálogo. */
export function isLegacyPlayerState(
  value: unknown,
): value is LegacyPlayerState {
  if (
    !record(value) ||
    !record(value.profile) ||
    !record(value.progressOrigin) ||
    !record(value.preferences)
  )
    return false;
  const profile = value.profile;
  if (
    !['name', 'initials', 'title', 'journey', 'joined', 'focus'].every((key) =>
      text(profile[key]),
    )
  )
    return false;
  const origin = value.progressOrigin;
  if (
    !integer(origin.level, 1) ||
    !integer(origin.xp) ||
    origin.xpPerLevel !== initialProgress.xpPerLevel ||
    origin.xp >= origin.xpPerLevel
  )
    return false;
  const missions = value.missionCompletion;
  if (
    !Array.isArray(missions) ||
    missions.length !== initialMissions.length ||
    !missions.every(
      (item: unknown) =>
        record(item) &&
        initialMissions.some((mission) => mission.id === item.id) &&
        typeof item.completed === 'boolean',
    ) ||
    new Set(missions.map((item: { id: string }) => item.id)).size !==
      missions.length
  )
    return false;
  const unlocked = value.unlockedAchievementIds;
  if (
    !Array.isArray(unlocked) ||
    !unlocked.every((id: unknown) =>
      achievements.some((item) => item.id === id),
    ) ||
    new Set(unlocked).size !== unlocked.length
  )
    return false;
  const history = value.activityHistory;
  if (
    !Array.isArray(history) ||
    history.length > 10000 ||
    !history.every(activity) ||
    new Set(history.map((item: EffortActivity) => item.id)).size !==
      history.length
  )
    return false;
  const preferences = value.preferences;
  return (
    [7, 30, 90].some((period) => period === preferences.radarPeriod) &&
    ['all', 'pending', 'done'].some(
      (filter) => filter === preferences.missionFilter,
    )
  );
}

export function isPlayerState(value: unknown): value is PlayerState {
  return (
    record(value) && isLegacyPlayerState(value) && isLifeRecords(value.records)
  );
}
export function migratePlayerState(
  version: number,
  value: unknown,
): PlayerState | null {
  if (version !== 1 || !isLegacyPlayerState(value)) return null;
  return { ...value, records: emptyRecords() };
}
