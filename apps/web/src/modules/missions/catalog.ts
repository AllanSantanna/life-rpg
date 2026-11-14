import type { Mission } from './types';
/** Somente metadados de compatibilidade para recompensas já confirmadas.
 * Não são metas sugeridas, missões ativas ou fontes de novas conclusões. */
export const legacyMissionCatalog: Mission[] = [
  { id: 'water', category: 'Descanso', icon: 'moon', xp: 120 },
  { id: 'workout', category: 'Treinos', icon: 'dumbbell', xp: 150 },
  { id: 'read', category: 'Conhecimento', icon: 'book', xp: 100 },
  { id: 'finance', category: 'Finanças', icon: 'wallet', xp: 80 },
  { id: 'sleep', category: 'Descanso', icon: 'moon', xp: 120 },
].map((metadata) => ({
  ...metadata,
  category: metadata.category as Mission['category'],
  icon: metadata.icon as Mission['icon'],
  title: 'Confirmação histórica',
  description:
    'Atividade confirmada pelo usuário antes da retirada das missões fixas.',
  completed: false,
}));
export interface MissionEvent {
  missionId: string;
  date: string;
  completed: boolean;
  source: 'user';
}
export function realMissionHistory(events: readonly MissionEvent[]): Mission[] {
  return events.flatMap((event) => {
    const template = legacyMissionCatalog.find(
      (item) => item.id === event.missionId,
    );
    return template && event.source === 'user' && event.completed
      ? [
          {
            ...template,
            completed: true,
            completedOn: event.date,
            source: 'user' as const,
          },
        ]
      : [];
  });
}
