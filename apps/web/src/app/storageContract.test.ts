import { describe, expect, it } from 'vitest';
import { investmentCategories } from '../modules/finances/types';
import { emptyRecords } from '../modules/records/types';
import { muscleLabels } from '../modules/workouts/advanced/types';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_VERSION,
} from './playerState';

/**
 * Guarda do contrato salvo. Os validadores rejeitam valores fora destes
 * vocabulários; uma versão antiga do app que encontre um valor novo trataria
 * os registros como inválidos. Por isso, ampliar qualquer item abaixo exige
 * subir PLAYER_STORAGE_VERSION, criar a migração e atualizar este teste: uma
 * versão antiga verá a versão nova como desconhecida e não gravará por cima.
 */
describe('contrato do armazenamento versionado', () => {
  it('vocabulário persistido corresponde à versão declarada', () => {
    expect({
      version: PLAYER_STORAGE_VERSION,
      state: Object.keys(createInitialPlayerState()).sort(),
      records: Object.keys(emptyRecords()).sort(),
      muscles: Object.keys(muscleLabels),
      investmentCategories,
    }).toEqual({
      version: 8,
      state: [
        'activityHistory',
        'character',
        'goals',
        'missionCompletion',
        'missionEvents',
        'preferences',
        'profile',
        'progressOrigin',
        'records',
        'unlockedAchievementIds',
      ],
      records: [
        'books',
        'investmentEntries',
        'investments',
        'movements',
        'readings',
        'sleep',
        'sleepGoalHours',
        'workouts',
      ],
      muscles: [
        'chest',
        'back',
        'trapezius',
        'shoulders',
        'biceps',
        'triceps',
        'quadriceps',
        'hamstrings',
        'glutes',
        'calves',
        'core',
        'forearms',
      ],
      investmentCategories: [
        'Ações',
        'Fundos imobiliários',
        'Renda fixa',
        'Caixinhas bancárias',
        'Bitcoin',
        'Dólar (USD)',
        'Outros',
      ],
    });
  });
});
