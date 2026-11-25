import { displaySessionDate, elapsedLabel } from '../sessionTiming';
import { Icon } from '../../../../shared/components/Icon';
import { displayDate } from '../../../records/dates';
import { number } from '../calculations';
import { starterExercises } from '../catalog';
import { libraryExercises } from '../library';
import { muscleLabels } from '../types';
import {
  mapGroupLabels,
  reviewedExerciseIds,
  type MapGroup,
} from './participation';
import { ExerciseTrace } from './ExerciseTrace';
import {
  anatomicalGroups,
  anatomicalLabels,
  findSurface,
  type Selection,
} from './anatomy';
import {
  isStabilizerTone,
  muscleTone,
  windowMetrics,
  toneLabels,
  type MapMode,
  type MuscleSummary,
} from './model';
const catalogNames = new Map(
  [...starterExercises, ...libraryExercises].map((e) => [e.id, e.name]),
);
/**
 * Rastreabilidade: grupos que só existem no mapa (Lombar, Adutores, Abdutores)
 * dependem da revisão por ID. Sem participação na janela, o painel diz quais
 * exercícios os identificam, em vez de um cinza sem explicação.
 */
function identificationHint(group: MapGroup) {
  if (Object.hasOwn(muscleLabels, group)) return null;
  const names = reviewedExerciseIds(group).flatMap((id) => {
    const name = catalogNames.get(id);
    return name ? [name] : [];
  });
  if (!names.length) return null;
  return `Este grupo só é identificado nos exercícios revisados do catálogo: ${new Intl.ListFormat('pt-BR').format(names)}. Exercícios próprios usam apenas os grupos do cadastro e não o registram.`;
}
export interface HistoryPoint {
  date: string;
  endDate?: string;
  value: number | null;
}
export function MuscleDetails({
  selection,
  summary,
  mode,
  history,
  days,
}: {
  selection: Selection;
  summary: MuscleSummary | undefined;
  mode: MapMode;
  history: HistoryPoint[];
  days: number;
}) {
  const surface = findSurface(selection);
  const group = anatomicalGroups[surface.group];
  const value = summary?.[mode] ?? null;
  const timing =
    mode === 'recovery' ? summary?.recoveryTiming : summary?.lastTiming;
  const lastDate = timing?.date;
  const tone = muscleTone(summary, mode);
  const stabilizer = isStabilizerTone(tone);
  const metrics = windowMetrics(summary, mode);
  const participated = (summary?.contributions ?? []).some((c) =>
    mode === 'effort' ? c.inPeriod : c.inRecoveryWindow,
  );
  const hint = group && !participated ? identificationHint(group) : null;
  const windowLabel =
    mode === 'effort'
      ? `nos últimos ${days} dias`
      : 'nos últimos 14 dias (janela da recuperação)';
  const max =
    mode === 'recovery'
      ? 100
      : Math.max(1, ...history.map((d) => d.value ?? 0));
  const points = history.map(
    (d) =>
      `${displayDate(d.date)}${d.endDate && d.endDate !== d.date ? ` a ${displayDate(d.endDate)}` : ''}: ${d.value === null ? 'sem registro' : `${number(d.value)}${mode === 'effort' ? ' séries equivalentes' : '% estimado'}`}`,
  );
  return (
    <aside
      className={`muscle-v2-details muscle-tone-${tone}`}
      aria-label="Detalhes do músculo selecionado"
    >
      <header>
        <span className="muscle-v2-emblem">
          <Icon name="dumbbell" size={28} />
        </span>
        <div>
          <p className="eyebrow">
            Região selecionada ·{' '}
            {selection.view === 'front' ? 'Frontal' : 'Traseira'}
          </p>
          <h4>{anatomicalLabels[surface.group]}</h4>
          <p>
            Grupo:{' '}
            {group ? mapGroupLabels[group] : 'Não registrado separadamente'}
          </p>
        </div>
      </header>
      <div className="muscle-v2-summary">
        <div
          className="muscle-v2-gauge"
          role="img"
          aria-label={`${mode === 'effort' ? 'Esforço relativo' : 'Índice estimado'}: ${value === null ? (stabilizer ? `${mode === 'effort' ? 'não quantificado' : 'não calculado'}, participação estabilizadora` : 'indeterminado') : `${value}%`}`}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="muscle-v2-track" cx="60" cy="60" r="51" />
            {value !== null && (
              <circle
                className="muscle-v2-progress"
                cx="60"
                cy="60"
                r="51"
                pathLength="100"
                strokeDasharray={`${value} 100`}
                transform="rotate(-90 60 60)"
              />
            )}
          </svg>
          <div>
            <strong>{value === null ? '—' : `${value}%`}</strong>
            <span>
              {stabilizer && mode === 'recovery'
                ? 'Não calculado'
                : mode === 'effort'
                  ? 'Esforço relativo'
                  : 'Índice estimado'}
            </span>
          </div>
        </div>
        <dl>
          <div>
            <dt>
              <Icon name="layers" size={16} />
              Séries válidas
            </dt>
            <dd>{metrics.sets || '—'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="chart" size={16} />
              Volume envolvido
            </dt>
            <dd>{metrics.sets ? `${number(metrics.volume)} kg·rep` : '—'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="calendar" size={16} />
              Último estímulo
            </dt>
            <dd>
              {lastDate
                ? displaySessionDate({
                    date: lastDate,
                    ...(timing?.startedAt
                      ? { startedAt: timing.startedAt }
                      : {}),
                  })
                : '—'}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="history" size={16} />
              Tempo transcorrido
            </dt>
            <dd>{timing ? elapsedLabel(timing) : '—'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="history" size={16} />
              Sessões
            </dt>
            <dd>{metrics.sessions || '—'}</dd>
          </div>
        </dl>
      </div>
      <p className="muscle-v2-status">
        {toneLabels[tone]}
        {mode === 'recovery' && value !== null ? ' · incerteza elevada' : ''}
      </p>
      {stabilizer && (
        <div className="muscle-v2-stabilizer-note">
          <h5>Participação estabilizadora</h5>
          <p>
            {mode === 'effort'
              ? 'Este músculo participou da estabilização durante o exercício, mas não recebeu séries equivalentes no cálculo de esforço.'
              : 'Este músculo participou da estabilização, mas não possui carga de recuperação estimada.'}
          </p>
        </div>
      )}
      {group ? (
        <p className="record-hint">
          Dados agregados de {mapGroupLabels[group]}; o histórico não distingue
          lados ou subdivisões.{' '}
          {metrics.sets
            ? `${metrics.direct} séries diretas e ${metrics.secondary} secundárias ${windowLabel}.`
            : `Nenhuma série válida ${windowLabel}.`}
          {hint && ` ${hint}`}
        </p>
      ) : (
        <p className="record-hint">
          Os exercícios atuais não distinguem este grupo. Não atribuímos séries
          ou percentuais por aproximação.
        </p>
      )}
      <div className="muscle-v2-history">
        <h5>
          <Icon name="history" size={18} />
          {mode === 'effort'
            ? `Histórico de esforço · ${days} dias`
            : 'Índice estimado · últimos 14 dias'}
        </h5>
        <div
          className="muscle-v2-bars"
          role="img"
          aria-label={
            group
              ? `Histórico de ${anatomicalLabels[surface.group]}. ${points.join('; ')}`
              : 'Histórico indisponível para este grupo'
          }
        >
          {history.map((point, i) => (
            <div key={point.date} className="muscle-v2-bar-column">
              <div className="muscle-v2-bar-space">
                <span
                  className={`muscle-v2-bar ${point.value === null ? 'muscle-v2-bar-empty' : ''}`}
                  style={{
                    height:
                      point.value === null
                        ? '2px'
                        : `${Math.max(2, (100 * point.value) / max)}%`,
                  }}
                  title={points[i]}
                />
              </div>
              <small>
                {displayDate(point.endDate ?? point.date).slice(0, 5)}
              </small>
            </div>
          ))}
        </div>
        <details>
          <summary>Consultar valores do histórico</summary>
          <ul>
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      </div>
      {group && (
        // Outro grupo ou período: seções voltam fechadas e com 5 registros.
        <ExerciseTrace
          key={`${group}:${days}`}
          summary={summary}
          mode={mode}
          days={days}
        />
      )}
      {mode === 'recovery' && (
        <p className="record-hint">
          {value === null
            ? stabilizer
              ? 'Não calculado: nos últimos 14 dias houve apenas participação estabilizadora. O verde é uma convenção visual e não indica recuperação medida.'
              : 'Indeterminado: sem estímulo válido nos últimos 14 dias para estimar.'
            : 'Janela de 14 dias; atualização a cada minuto enquanto a tela está visível. RIR ausente não equivale a zero.'}{' '}
          {timing &&
            !timing.startedAt &&
            'Horário não informado: usamos o menor tempo decorrido possível, sem atribuir um horário ao registro. '}
          {timing?.startedAt &&
            `Início registrado no fuso UTC${timing.startedAt.slice(-6)}; sem duração inferida. `}
          Estimativa baseada no histórico registrado; não substitui percepção de
          fadiga e recuperação.
        </p>
      )}
    </aside>
  );
}
