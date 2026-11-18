import type { View } from '../../app/views';
import {
  MetricCard,
  type MetricSnapshot,
} from '../../shared/components/MetricCard';
import { SectionHeading } from '../../shared/components/SectionHeading';
import type { Period } from '../evolution/scoring';
import { displayDate } from '../records/dates';
import type { EvolutionPoint, PillarSummary } from './types';

const presentation = {
  Finanças: {
    id: 'finances',
    icon: 'wallet',
    days: 'Dias com atividade financeira',
  },
  Treinos: { id: 'workouts', icon: 'dumbbell', days: 'Dias treinados' },
  Descanso: { id: 'rest', icon: 'moon', days: 'Dias com sono registrado' },
  Conhecimento: { id: 'knowledge', icon: 'book', days: 'Dias de leitura' },
} as const;

export function PillarCards({
  summaries,
  series,
  period,
  onNavigate,
}: {
  summaries: PillarSummary[];
  series: EvolutionPoint[];
  period: Period;
  onNavigate: (view: View) => void;
}) {
  return (
    <section aria-label="Estatísticas individuais">
      <SectionHeading
        title="Seus quatro pilares"
        eyebrow={`Indicadores · últimos ${period} dias`}
      />
      <div className="statistics-pillar-grid">
        {summaries.map((summary) => {
          const config = presentation[summary.area];
          const delta = summary.score - summary.previous;
          const metric: MetricSnapshot = {
            id: config.id,
            title: summary.area,
            icon: config.icon,
            value: summary.hasEffort ? String(summary.score) : '—',
            unit: `dedicação · últimos ${period} dias`,
            category: 'Histórico real',
            change: summary.comparable
              ? `${delta > 0 ? '+' : ''}${delta} pontos · período anterior: ${summary.previous}/100`
              : 'Sem registros pontuados no período anterior.',
            details: [
              {
                label: config.days,
                value: `${summary.area === 'Treinos' ? summary.trainedDays : summary.days}/${period}`,
              },
              {
                label: 'Consistência de registro',
                value: `${summary.consistency}%`,
              },
            ],
            trend: summary.hasEffort
              ? series.map((point) => point.scores[summary.area])
              : [],
            trendLabel: `Dedicação móvel de 7 dias de ${summary.area}, ${displayDate(series[0]!.date)} a ${displayDate(series.at(-1)!.date)}`,
            progress: {
              label: 'Dedicação no período',
              value: summary.score,
              max: 100,
              text: summary.hasEffort
                ? `${summary.score}/100`
                : 'Sem dedicação pontuada',
            },
          };
          return (
            <MetricCard
              key={summary.area}
              metric={metric}
              actionLabel="Ver detalhes"
              onOpen={() => onNavigate(config.id)}
            />
          );
        })}
      </div>
      <p className="statistics-copy statistics-card-note">
        Dedicação: mesma fórmula do Radar, no período indicado. As linhas
        mostram a dedicação móvel de 7 dias. Consistência: dias com atividade no
        calendário ÷ dias do período; sessões detalhadas não acrescentam pontos.
      </p>
    </section>
  );
}
