import { useMemo, useState, type ReactNode } from 'react';
import type { View } from '../../app/views';
import type { EffortActivity, Period } from '../evolution/scoring';
import type { LifeRecords } from '../records/types';
import { ActivityCalendar } from './ActivityCalendar';
import {
  evolutionSeries,
  indexActivities,
  pillarSummaries,
} from './aggregation';
import { EvolutionLandscape } from './EvolutionLandscape';
import { PeriodSelector } from './PeriodSelector';
import { PillarCards } from './PillarCards';
import './statistics.css';

export function StatisticsPage({
  records,
  activities,
  today,
  radar,
  achievements,
  onNavigate,
}: {
  records: LifeRecords;
  activities: readonly EffortActivity[];
  today: string;
  radar: ReactNode;
  achievements: ReactNode;
  onNavigate: (view: View) => void;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const index = useMemo(() => indexActivities(records), [records]);
  const series = useMemo(
    () => evolutionSeries(activities, today, period),
    [activities, today, period],
  );
  const summaries = useMemo(
    () => pillarSummaries(index, activities, today, period),
    [index, activities, today, period],
  );
  return (
    <div className="statistics-dashboard">
      <div className="statistics-toolbar">
        <div>
          <p className="eyebrow">Visão geral</p>
          <p className="statistics-copy">
            Paisagem e cartões · últimos {period} dias. O Radar mantém seu
            próprio filtro.
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>
      <div className="statistics-overview">
        <div className="statistics-radar-frame">{radar}</div>
        <EvolutionLandscape series={series} period={period} />
      </div>
      <ActivityCalendar index={index} today={today} />
      <PillarCards
        summaries={summaries}
        series={series}
        period={period}
        onNavigate={onNavigate}
      />
      {achievements}
    </div>
  );
}
