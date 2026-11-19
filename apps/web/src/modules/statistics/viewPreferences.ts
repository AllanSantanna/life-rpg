import { useCallback, useState } from 'react';
import {
  createLocalStateStorage,
  type StateStorage,
  type StorageAccess,
} from '../../shared/storage/localStateStorage';
import { areas } from '../evolution/scoring';
import type { Pillar } from './types';

/**
 * Preferências somente visuais da página Estatísticas. Ficam em chave própria
 * para não alterar o esquema, a validação ou as migrações de `PlayerState`.
 */
export interface StatisticsView {
  radar: boolean;
  landscape: boolean;
  calendar: boolean;
  cards: Record<Pillar, boolean>;
}
export type StatisticsSection = Exclude<keyof StatisticsView, 'cards'>;

export const STATISTICS_VIEW_KEY = 'life-rpg:statistics-view';
export const STATISTICS_VIEW_VERSION = 1;

export function defaultStatisticsView(): StatisticsView {
  return {
    radar: true,
    landscape: true,
    calendar: true,
    cards: {
      Finanças: true,
      Treinos: true,
      Descanso: true,
      Conhecimento: true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isStatisticsView(value: unknown): value is StatisticsView {
  if (!isRecord(value) || !isRecord(value.cards)) return false;
  const cards = value.cards;
  return (
    Object.keys(value).length === 4 &&
    Object.keys(cards).length === areas.length &&
    (['radar', 'landscape', 'calendar'] as const).every(
      (key) => typeof value[key] === 'boolean',
    ) &&
    areas.every((area) => typeof cards[area] === 'boolean')
  );
}

export function createStatisticsViewStorage(
  access?: StorageAccess,
): StateStorage<StatisticsView> {
  return createLocalStateStorage(
    STATISTICS_VIEW_KEY,
    STATISTICS_VIEW_VERSION,
    isStatisticsView,
    access,
  );
}

/**
 * Lê uma vez na montagem e grava somente quando o usuário altera algo. Dados
 * ausentes ou inválidos usam o padrão (tudo visível) sem gravar na leitura.
 */
export function useStatisticsView(given?: StateStorage<StatisticsView>) {
  const [storage] = useState(() => given ?? createStatisticsViewStorage());
  const [view, setView] = useState<StatisticsView>(() => {
    const result = storage.load();
    return result.status === 'loaded' ? result.data : defaultStatisticsView();
  });
  const update = useCallback(
    (next: StatisticsView) => {
      setView(next);
      storage.save(next);
    },
    [storage],
  );
  return [view, update] as const;
}
