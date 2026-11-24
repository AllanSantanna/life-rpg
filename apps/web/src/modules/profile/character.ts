import type { PlayerState } from '../../app/playerState';
import { scorePeriod } from '../evolution/scoring';
import { projectProgress } from '../gamification/progression';
import {
  realAchievements,
  startingProgress,
} from '../gamification/realProgress';
import { goalRewards } from '../goals/rewards';
import { realMissionHistory } from '../missions/catalog';
import { projectEffortActivities, recordReward } from '../records/progression';
import { isDate } from '../records/dates';
import {
  classCatalog,
  evaluateClass,
  initialClass,
  type ClassState,
} from './classes';

export interface CharacterState {
  avatar: 'wanderer' | 'knight' | 'mage' | 'ranger';
  classification: ClassState;
}

export function initialCharacter(): CharacterState {
  return { avatar: 'wanderer', classification: initialClass() };
}

export function projectCharacter(state: PlayerState, today: string) {
  const missions = realMissionHistory(state.missionEvents);
  const activities = projectEffortActivities(
    [],
    missions,
    state.records,
    today,
  );
  const rewards = goalRewards(state.goals, state.records, missions, today);
  const progress = projectProgress(
    startingProgress,
    recordReward(state.records, missions, today) + rewards.total,
  );
  const achievements = realAchievements({
    records: state.records,
    missions,
    goals: state.goals,
    today,
  });
  return {
    missions,
    activities,
    rewards,
    progress,
    achievements,
    dedication: scorePeriod(activities, 7),
    classification: evaluateClass(
      activities,
      state.character.classification,
      today,
    ),
  };
}
export type CharacterProjection = ReturnType<typeof projectCharacter>;

/** A classe é metadado: não altera registros, quests, conquistas ou progresso. */
export function reconcileCharacter(
  state: PlayerState,
  facts: CharacterProjection,
): PlayerState {
  if (state.character.classification === facts.classification.state)
    return state;
  return {
    ...state,
    character: {
      ...state.character,
      classification: facts.classification.state,
    },
  };
}

export function renameCharacter(state: PlayerState, name: string): PlayerState {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40)
    throw new Error('Use um nome entre 1 e 40 caracteres.');
  return {
    ...state,
    profile: {
      ...state.profile,
      name: trimmed,
      initials: trimmed.slice(0, 2).toUpperCase(),
    },
  };
}

/** Ignora campos cosméticos antigos; a migração copia somente estes dois campos. */
export function isCharacterState(value: unknown): value is CharacterState {
  if (!value || typeof value !== 'object') return false;
  const c = value as CharacterState;
  const classId = (id: unknown) =>
    typeof id === 'string' && Object.hasOwn(classCatalog, id);
  const dateOrNull = (date: unknown) => date === null || isDate(date);
  return (
    ['wanderer', 'knight', 'mage', 'ranger'].includes(c.avatar) &&
    !!c.classification &&
    (c.classification.current === null || classId(c.classification.current)) &&
    dateOrNull(c.classification.changedOn) &&
    (c.classification.pending === null ||
      (!!c.classification.pending &&
        classId(c.classification.pending.id) &&
        isDate(c.classification.pending.since)))
  );
}
