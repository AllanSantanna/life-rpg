import type { LifeRecords } from './types';
import type { MetricSnapshot } from '../../shared/components/MetricCard';
import type { Scores } from '../evolution/scoring';
import {
  investmentTotals,
  money,
  monthlyBalance,
} from '../finances/calculations';
import { workoutStats } from '../workouts/calculations';
import { sleepStats } from '../rest/calculations';
import { readingStats } from '../knowledge/calculations';
export function recordMetrics(
  records: LifeRecords,
  today: string,
  scores: Scores,
): MetricSnapshot[] {
  const balance = monthlyBalance(records.movements, today.slice(0, 7));
  const invested = investmentTotals(
    records.investments,
    records.investmentEntries,
  );
  const workout = workoutStats(records.workouts, today);
  const sleep = sleepStats(records.sleep, today, records.sleepGoalHours);
  const reading = readingStats(records.books, records.readings, today);
  const entries: Pick<
    MetricSnapshot,
    'id' | 'title' | 'icon' | 'value' | 'unit' | 'details'
  >[] = [
    {
      id: 'finances',
      title: 'Finanças',
      icon: 'wallet',
      value: money(balance.balance),
      unit: 'saldo no mês',
      details: [
        { label: 'Receitas', value: money(balance.income) },
        { label: 'Patrimônio aplicado', value: money(invested.total) },
      ],
    },
    {
      id: 'workouts',
      title: 'Treinos',
      icon: 'dumbbell',
      value: String(workout.weekly),
      unit: 'dias nos últimos 7',
      details: [
        { label: 'Mês atual', value: `${workout.monthly} dias` },
        { label: 'Consistência mensal', value: `${workout.consistency}%` },
      ],
    },
    {
      id: 'rest',
      title: 'Descanso',
      icon: 'moon',
      value: sleep.weeklyAverage.toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
      }),
      unit: 'horas · média semanal',
      details: [
        { label: 'Meta diária', value: `${records.sleepGoalHours} h` },
        { label: 'Consistência mensal', value: `${sleep.consistency}%` },
      ],
    },
    {
      id: 'knowledge',
      title: 'Conhecimento',
      icon: 'book',
      value: String(reading.weekly),
      unit: 'páginas nos últimos 7 dias',
      details: [
        { label: 'Mês atual', value: `${reading.monthly} páginas` },
        { label: 'Livros concluídos', value: String(reading.completed) },
      ],
    },
  ];
  return entries.map((entry) => ({
    ...entry,
    category: 'Seus registros',
    change: 'Dedicação recente · inclui legado identificado',
    trend: [],
    progress: {
      label: 'Dedicação · 7 dias',
      value: scores[entry.title as keyof Scores],
      max: 100,
      text: `${scores[entry.title as keyof Scores]}/100`,
    },
  }));
}
