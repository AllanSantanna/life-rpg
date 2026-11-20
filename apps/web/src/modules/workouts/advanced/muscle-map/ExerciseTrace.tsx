import { useId, useState } from 'react';
import { Icon } from '../../../../shared/components/Icon';
import { number } from '../calculations';
import { displaySessionDate } from '../sessionTiming';
import type { MapMode, MuscleContribution, MuscleSummary } from './model';
import { roleLabels } from './participation';

const visibleLimit = 5;
const plural = (n: number, one: string, many: string) =>
  `${number(n)} ${n === 1 ? one : many}`;

function contributionText(item: MuscleContribution, mode: MapMode) {
  if (item.units === 0)
    return 'Não entra no cálculo: participação estabilizadora.';
  const weight = item.units / item.sets;
  if (mode === 'effort')
    return `Contribuição: ${plural(item.units, 'série equivalente', 'séries equivalentes')} (${number(item.sets)} × ${number(weight)}).`;
  return `Carga residual atual: ${number(item.residual)} (inicial ${number(item.burden)}).`;
}

function TraceList({
  items,
  mode,
  label,
}: {
  items: MuscleContribution[];
  mode: MapMode;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visible = expanded ? items : items.slice(0, visibleLimit);
  return (
    <>
      <ul id={id} className="muscle-v2-trace-list" aria-label={label}>
        {visible.map((item) => (
          <li key={item.key} className="muscle-v2-trace-item">
            <div className="muscle-v2-trace-head">
              <strong>{item.exerciseName}</strong>
              <span
                className={`muscle-v2-role muscle-v2-role-${item.role}`}
                aria-label={`Papel: ${roleLabels[item.role]}`}
              >
                {roleLabels[item.role]}
              </span>
            </div>
            <p className="muscle-v2-trace-meta">
              {displaySessionDate({
                date: item.date,
                ...(item.startedAt ? { startedAt: item.startedAt } : {}),
              })}{' '}
              · {plural(item.sets, 'série válida', 'séries válidas')}
            </p>
            <p className="muscle-v2-trace-value">
              {contributionText(item, mode)}
            </p>
            <p className="muscle-v2-trace-reason">
              Motivo: {item.reason}
              {item.source === 'record' &&
                ' Papel conforme o cadastro do exercício.'}
            </p>
          </li>
        ))}
      </ul>
      {items.length > visibleLimit && (
        <button
          type="button"
          className="text-action muscle-v2-trace-more"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Mostrar menos' : `Mostrar todos (${items.length})`}
        </button>
      )}
    </>
  );
}

/** Exercícios reais que explicam o grupo selecionado; nada é inferido ou salvo. */
export function ExerciseTrace({
  summary,
  mode,
  days,
}: {
  summary: MuscleSummary | undefined;
  mode: MapMode;
  days: number;
}) {
  const scope = mode === 'effort' ? 'inPeriod' : 'inRecoveryWindow';
  const all = (summary?.contributions ?? []).filter((c) => c[scope]);
  const counted = all.filter((c) => c.units > 0);
  const stabilizing = all.filter((c) => c.units === 0);
  const window =
    mode === 'effort' ? `${days} dias` : '14 dias da janela de recuperação';
  return (
    <section
      className="muscle-v2-trace"
      aria-label="Exercícios que estimularam este músculo"
    >
      <h5>
        <Icon name="dumbbell" size={18} />
        Exercícios que estimularam este músculo
      </h5>
      <p className="record-hint">
        Somente sessões concluídas e registradas · {window}. Participação não é
        o mesmo que estímulo contabilizado
        {mode === 'recovery' ? ' ou recuperação estimada' : ''}.
      </p>
      {counted.length ? (
        <TraceList
          key={`${mode}-counted`}
          items={counted}
          mode={mode}
          label="Estímulo contabilizado"
        />
      ) : (
        <p className="muscle-v2-trace-empty">
          {mode === 'effort'
            ? 'Nenhum estímulo contabilizado para este músculo no período selecionado.'
            : 'Nenhum estímulo contabilizado para este músculo nos últimos 14 dias.'}
        </p>
      )}
      {stabilizing.length > 0 && (
        <>
          <h6>Participação estabilizadora · não contabilizada</h6>
          <p className="record-hint">
            {plural(stabilizing.length, 'registro', 'registros')} em que o grupo
            estabilizou postura ou articulação. Ficam visíveis para
            transparência, mas não geram séries equivalentes nem carga de
            recuperação.
          </p>
          <TraceList
            key={`${mode}-stabilizer`}
            items={stabilizing}
            mode={mode}
            label="Participação estabilizadora"
          />
        </>
      )}
    </section>
  );
}
