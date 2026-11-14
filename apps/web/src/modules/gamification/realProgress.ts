import type { Attribute, Achievement, PlayerProgress } from './types';
import type { LifeRecords } from '../records/types';
import type { Mission } from '../missions/types';
import { realEfforts } from '../records/progression';
import {
  scorePeriod,
  type EffortActivity,
  type Scores,
} from '../evolution/scoring';
import { shiftDate } from '../records/dates';
import { bookProgress } from '../knowledge/calculations';
export const startingProgress: PlayerProgress = {
  level: 1,
  xp: 0,
  xpPerLevel: 2000,
};
export function realAttributes(scores: Scores): Attribute[] {
  return [
    { name: 'Força', value: scores.Treinos, icon: 'dumbbell' },
    {
      name: 'Disciplina',
      value: Math.round(
        Object.values(scores).reduce((sum, n) => sum + n, 0) / 4,
      ),
      icon: 'flame',
    },
    { name: 'Conhecimento', value: scores.Conhecimento, icon: 'book' },
    { name: 'Riqueza', value: scores.Finanças, icon: 'wallet' },
  ].map((item) => ({
    ...item,
    icon: item.icon as Attribute['icon'],
    max: 100,
    description: 'Dedicação real nos últimos 7 dias',
  }));
}
export function realAchievements(
  records: LifeRecords,
  missions: readonly Mission[],
  today: string,
  activities: EffortActivity[],
): Achievement[] {
  const qualifying = realEfforts(records, missions).filter(
    (day) => day.qualifies && day.date <= today,
  );
  const dates = new Set(qualifying.map((day) => day.date));
  let longest = 0,
    streak = 0;
  for (const date of [...dates].sort()) {
    streak = dates.has(shiftDate(date, -1)) ? streak + 1 : 1;
    longest = Math.max(longest, streak);
  }
  const books = records.books.filter(
    (book) =>
      bookProgress(
        book,
        records.readings.filter((entry) => entry.date <= today),
      ).remaining === 0,
  ).length;
  const covered = new Set(qualifying.map((day) => day.area)).size;
  const score = scorePeriod(activities, 7);
  const balanced = Object.values(score).every((value) => value === 100);
  const first = qualifying.length > 0;
  // Conquistas são projeções reversíveis, sem bônus de XP ou flags artificiais.
  return [
    {
      id: 'first',
      title: 'Primeiro passo',
      description:
        'Registrar sua primeira atividade válida; confirmações históricas são preservadas.',
      tier: 'Nível I',
      icon: 'sword',
      unlocked: first,
      progress: first ? 'Conquistada' : '0 de 1 atividade',
    },
    {
      id: 'consistent',
      title: 'Em chamas',
      description: '7 dias seguidos com atividades válidas.',
      tier: 'Nível II',
      icon: 'flame',
      unlocked: longest >= 7,
      progress:
        longest >= 7 ? 'Conquistada' : `${Math.min(7, longest)} de 7 dias`,
    },
    {
      id: 'reader',
      title: 'Mente curiosa',
      description: 'Concluir a leitura de 3 livros.',
      tier: 'Nível III',
      icon: 'book',
      unlocked: books >= 3,
      progress: books >= 3 ? 'Conquistada' : `${books} de 3 livros`,
    },
    {
      id: 'balance',
      title: 'Em equilíbrio',
      description:
        'Atingir as metas de dedicação dos quatro pilares em 7 dias.',
      tier: 'Nível IV',
      icon: 'shield',
      unlocked: balanced,
      progress: balanced
        ? 'Conquistada'
        : `${Object.values(score).filter((value) => value === 100).length} de 4 metas · ${covered} pilares com atividade`,
    },
  ];
}
