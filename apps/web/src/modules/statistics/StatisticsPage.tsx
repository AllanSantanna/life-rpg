import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { View } from '../../app/views';
import type { EffortActivity, Period } from '../evolution/scoring';
import type { LifeRecords } from '../records/types';
import { ActivityCalendar } from './ActivityCalendar';
import {
  evolutionSeries,
  indexActivities,
  pillarSummaries,
} from './aggregation';
import { CustomizePanel, CustomizeTrigger } from './CustomizePanel';
import { EvolutionLandscape } from './EvolutionLandscape';
import { PeriodSelector } from './PeriodSelector';
import { PillarCards } from './PillarCards';
import { useStatisticsView } from './viewPreferences';
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
  const [view, setView] = useStatisticsView();
  const [customizing, setCustomizing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const index = useMemo(() => indexActivities(records), [records]);
  const series = useMemo(
    () => evolutionSeries(activities, today, period),
    [activities, today, period],
  );
  const summaries = useMemo(
    () => pillarSummaries(index, activities, today, period),
    [index, activities, today, period],
  );
  // As preferências filtram somente a apresentação; os cálculos acima não mudam.
  const cards = summaries.filter((summary) => view.cards[summary.area]);
  const usesPeriod = view.landscape || cards.length > 0;
  const scope = [
    view.landscape ? 'paisagem' : '',
    cards.length ? 'cartões' : '',
  ]
    .filter(Boolean)
    .join(' e ');
  const periodScope = scope.charAt(0).toUpperCase() + scope.slice(1);
  const nothingVisible =
    !view.radar && !view.landscape && !view.calendar && cards.length === 0;
  return (
    <div className="statistics-dashboard">
      <div className="statistics-toolbar">
        <div>
          <p className="eyebrow">Visão geral</p>
          <p className="statistics-copy">
            {usesPeriod
              ? `${periodScope} · últimos ${period} dias.`
              : 'Seções com período estão ocultas.'}
            {view.radar && ' O Radar mantém seu próprio filtro.'}
          </p>
        </div>
        <div className="statistics-toolbar-actions">
          {usesPeriod && (
            <PeriodSelector period={period} onChange={setPeriod} />
          )}
          <CustomizeTrigger
            ref={trigger}
            open={customizing}
            controls={panelId}
            onToggle={() => setCustomizing((current) => !current)}
          />
        </div>
      </div>
      {customizing && (
        <CustomizePanel
          id={panelId}
          view={view}
          onChange={setView}
          onClose={() => {
            setCustomizing(false);
            trigger.current?.focus();
          }}
        />
      )}
      {nothingVisible && (
        <p className="panel statistics-empty-view" role="status">
          Todas as seções estão ocultas. Seus registros continuam salvos; use
          Personalizar visualização para reativá-las.
        </p>
      )}
      {(view.radar || view.landscape) && (
        <div className="statistics-overview">
          {view.radar && <div className="statistics-radar-frame">{radar}</div>}
          {/* Sem renderizar a paisagem, o chunk WebGL nunca é solicitado. */}
          {view.landscape && (
            <EvolutionLandscape series={series} period={period} />
          )}
        </div>
      )}
      {view.calendar && <ActivityCalendar index={index} today={today} />}
      {cards.length > 0 && (
        <PillarCards
          summaries={cards}
          series={series}
          period={period}
          onNavigate={onNavigate}
        />
      )}
      {achievements}
    </div>
  );
}
