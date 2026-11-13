import type { Mission } from './types';
/** Modelos de ações reais: nenhum começa concluído ou concede XP automaticamente. */
export const missionCatalog: Mission[] = [
  {
    id: 'water',
    title: 'Comece com o essencial',
    description: 'Confirmar que bebeu 2 litros de água hoje',
    category: 'Descanso',
    icon: 'moon',
    xp: 120,
    completed: false,
  },
  {
    id: 'workout',
    title: 'Um passo mais forte',
    description: 'Confirmar que concluiu o treino de hoje',
    category: 'Treinos',
    icon: 'dumbbell',
    xp: 150,
    completed: false,
  },
  {
    id: 'read',
    title: 'Alimente a sua mente',
    description: 'Confirmar que leu 20 páginas hoje',
    category: 'Conhecimento',
    icon: 'book',
    xp: 100,
    completed: false,
  },
  {
    id: 'finance',
    title: 'Cada escolha conta',
    description: 'Confirmar que revisou os gastos de hoje',
    category: 'Finanças',
    icon: 'wallet',
    xp: 80,
    completed: false,
  },
  {
    id: 'sleep',
    title: 'Prepare o próximo capítulo',
    description: 'Confirmar que se desconectou das telas antes de dormir',
    category: 'Descanso',
    icon: 'moon',
    xp: 120,
    completed: false,
  },
];
export interface MissionEvent {
  missionId: string;
  date: string;
  completed: boolean;
  source: 'user';
}
export function realMissionHistory(events: readonly MissionEvent[]): Mission[] {
  return events.flatMap((event) => {
    const template = missionCatalog.find((item) => item.id === event.missionId);
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
export function missionsForDay(events: readonly MissionEvent[], today: string) {
  return missionCatalog.map((mission) => ({
    ...mission,
    completed: events.some(
      (event) =>
        event.missionId === mission.id &&
        event.date === today &&
        event.completed &&
        event.source === 'user',
    ),
    completedOn: today,
    source: 'user' as const,
  }));
}
