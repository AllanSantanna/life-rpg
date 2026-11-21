import {
  initialCharacter,
  isCharacterState,
  type CharacterState,
} from '../modules/profile/character';
import { emptyGoals, type GoalState } from '../modules/goals/types';
import { isGoalState } from '../modules/goals/commands';
import { startingProgress } from '../modules/gamification/realProgress';
import {
  legacyMissionCatalog,
  type MissionEvent,
} from '../modules/missions/catalog';
import { isDate } from '../modules/records/dates';
import { emptyRecords, type LifeRecords } from '../modules/records/types';
import { isLifeRecords } from '../modules/records/commands';
import { legacyMissions, legacyAchievementIds } from './legacyPlayerCatalog';
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
  character: CharacterState;
  records: LifeRecords;
  missionEvents: MissionEvent[];
  goals: GoalState;
}
export const PLAYER_STORAGE_KEY = 'life-rpg:player-state';
/**
 * v8: mesmo formato de dados da v7. A troca de versão marca o contrato ampliado
 * depois da v7 (Treinos Avançados, cotações de mercado, Trapézio, horário de
 * início): uma versão antiga do app passa a ver os dados como desconhecidos e
 * não grava por cima deles. Toda ampliação futura do vocabulário salvo exige
 * nova versão (ver storageContract.test.ts).
 */
export const PLAYER_STORAGE_VERSION = 8;

export function createInitialPlayerState(): PlayerState {
  return {
    character: initialCharacter(),
    records: emptyRecords(),
    goals: emptyGoals(),
    missionEvents: [],
    profile: {
      name: 'Jogador',
      initials: 'JO',
      title: 'Jogador',
      journey: 'O caminho da constância',
      joined: new Date().toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
      focus: 'Evoluir um pouco, todos os dias.',
    },
    progressOrigin: { ...startingProgress },
    missionCompletion: legacyMissionCatalog.map(({ id }) => ({
      id,
      completed: false,
    })),
    unlockedAchievementIds: [],
    activityHistory: [],
    preferences: { radarPeriod: 7, missionFilter: 'all' },
  };
}
/** Alias de compatibilidade para consumidores anteriores; não cria mais demonstração. */
export const createDemoPlayerState = createInitialPlayerState;
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
    origin.xpPerLevel !== startingProgress.xpPerLevel ||
    origin.xp >= origin.xpPerLevel
  )
    return false;
  const missions = value.missionCompletion;
  if (
    !Array.isArray(missions) ||
    missions.length !== legacyMissions.length ||
    !missions.every(
      (item: unknown) =>
        record(item) &&
        legacyMissions.some((mission) => mission.id === item.id) &&
        typeof item.completed === 'boolean',
    ) ||
    new Set(missions.map((item: { id: string }) => item.id)).size !==
      missions.length
  )
    return false;
  const unlocked = value.unlockedAchievementIds;
  if (
    !Array.isArray(unlocked) ||
    !unlocked.every(
      (id: unknown) =>
        typeof id === 'string' && legacyAchievementIds.includes(id),
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

function isProgressState(
  value: unknown,
): value is Omit<PlayerState, 'goals' | 'character'> {
  if (
    !record(value) ||
    !isLegacyPlayerState(value) ||
    !isLifeRecords(value.records)
  )
    return false;
  if (
    value.progressOrigin.level !== 1 ||
    value.progressOrigin.xp !== 0 ||
    value.activityHistory.length ||
    value.unlockedAchievementIds.length ||
    value.missionCompletion.some((m) => m.completed)
  )
    return false;
  const events = value.missionEvents;
  return (
    Array.isArray(events) &&
    events.length <= 10000 &&
    events.every(
      (event: unknown) =>
        record(event) &&
        legacyMissionCatalog.some((m) => m.id === event.missionId) &&
        isDate(event.date) &&
        typeof event.completed === 'boolean' &&
        event.source === 'user',
    ) &&
    new Set(
      events.map((event: MissionEvent) => `${event.missionId}:${event.date}`),
    ).size === events.length
  );
}
function isV4PlayerState(
  value: unknown,
): value is Omit<PlayerState, 'character'> {
  return isProgressState(value) && 'goals' in value && isGoalState(value.goals);
}
export function isPlayerState(value: unknown): value is PlayerState {
  return (
    isV4PlayerState(value) &&
    'character' in value &&
    isCharacterState(value.character)
  );
}
export function migratePlayerState(
  version: number,
  value: unknown,
): PlayerState | null {
  // v7 → v8 só troca o envelope: os dados são validados e mantidos intactos.
  if (version === 7) return isPlayerState(value) ? value : null;
  if (version === 5 || version === 6) {
    if (
      !isV4PlayerState(value) ||
      !('character' in value) ||
      !record(value.character) ||
      !record(value.character.classification)
    )
      return null;
    const { avatar, classification } = value.character;
    const character = {
      avatar,
      classification: {
        ...classification,
        current:
          classification.current === 'adventurer'
            ? null
            : classification.current,
        pending:
          record(classification.pending) &&
          classification.pending.id === 'adventurer'
            ? null
            : classification.pending,
      },
    };
    return isCharacterState(character) ? { ...value, character } : null;
  }
  if (version === 4)
    return isV4PlayerState(value)
      ? { ...value, character: initialCharacter() }
      : null;
  if (version === 3)
    return isProgressState(value)
      ? { ...value, goals: emptyGoals(), character: initialCharacter() }
      : null;
  if ((version !== 1 && version !== 2) || !isLegacyPlayerState(value))
    return null;
  if (version === 2 && (!record(value) || !isLifeRecords(value.records)))
    return null;
  const records =
    version === 2 ? (value as unknown as PlayerState).records : emptyRecords();
  // No catálogo antigo, somente os itens inicialmente pendentes permitem comprovar
  // uma marcação do usuário. A missão water já vinha marcada pelo demonstrativo.
  const missionEvents: MissionEvent[] = value.missionCompletion.flatMap(
    (item) => {
      const old = legacyMissions.find((m) => m.id === item.id);
      return item.completed && old && !old.completed
        ? [
            {
              missionId: item.id,
              date: '2026-11-13',
              completed: true,
              source: 'user' as const,
            },
          ]
        : [];
    },
  );
  return {
    ...value,
    character: initialCharacter(),
    goals: emptyGoals(),
    records,
    progressOrigin: { ...startingProgress },
    missionCompletion: legacyMissionCatalog.map(({ id }) => ({
      id,
      completed: false,
    })),
    unlockedAchievementIds: [],
    activityHistory: [],
    missionEvents,
  };
}
