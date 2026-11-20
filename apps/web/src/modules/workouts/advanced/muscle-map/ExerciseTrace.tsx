import { useEffect, useId, useRef, useState } from 'react';
import { Disclosure } from '../../../../shared/components/Disclosure';
import { number } from '../calculations';
import { displaySessionDate } from '../sessionTiming';
import type { MapMode, MuscleContribution, MuscleSummary } from './model';
import { roleLabels } from './participation';

/** Paginação apenas visual: não altera período, registros nem cálculos. */
export const traceStep = 5;
const plural = (n: number, one: string, many: string) =>
  `${number(n)} ${n === 1 ? one : many}`;
const detailsHint = { open: 'Ocultar detalhes', closed: 'Mostrar detalhes' };

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
  const [visible, setVisible] = useState(traceStep);
  const id = useId();
  const moreButton = useRef<HTMLButtonElement>(null);
  const lessButton = useRef<HTMLButtonElement>(null);
  // O botão clicado pode desaparecer; o foco segue para o controle que resta.
  const pendingFocus = useRef<'more' | 'less' | null>(null);
  const shown = items.slice(0, visible);
  const remaining = items.length - shown.length;
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'more') moreButton.current?.focus();
    if (target === 'less') lessButton.current?.focus();
  }, [visible]);
  return (
    <>
      <ul id={id} className="muscle-v2-trace-list" aria-label={label}>
        {shown.map((item) => (
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
      {items.length > traceStep && (
        <div className="muscle-v2-trace-pager">
          <p className="sr-only" aria-live="polite">
            Exibindo {shown.length} de {items.length} registros.
          </p>
          {remaining > 0 && (
            <button
              ref={moreButton}
              type="button"
              className="text-action"
              aria-controls={id}
              onClick={() => {
                if (remaining <= traceStep) pendingFocus.current = 'less';
                setVisible((n) => n + traceStep);
              }}
            >
              Mostrar mais {Math.min(traceStep, remaining)}
            </button>
          )}
          {shown.length > traceStep && (
            <button
              ref={lessButton}
              type="button"
              className="text-action"
              aria-controls={id}
              onClick={() => {
                pendingFocus.current = 'more';
                setVisible(traceStep);
              }}
            >
              Mostrar menos
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Exercícios reais que explicam o grupo selecionado; nada é inferido ou salvo.
 * Duas seções recolhíveis e independentes, fechadas por padrão. O componente
 * pai troca a `key` ao mudar de grupo ou período, reiniciando tudo.
 */
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
    <div className="muscle-v2-trace">
      <Disclosure
        title="Exercícios que estimularam este músculo"
        count={counted.length}
        hint={detailsHint}
        animated
        level={5}
        className="muscle-v2-trace-section"
      >
        <p className="record-hint">
          Somente sessões concluídas e registradas · {window}. Participação não
          é o mesmo que estímulo contabilizado
          {mode === 'recovery' ? ' ou recuperação estimada' : ''}. Mais recentes
          primeiro.
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
      </Disclosure>
      {stabilizing.length > 0 && (
        <Disclosure
          title="Participação estabilizadora · não contabilizada"
          count={stabilizing.length}
          hint={detailsHint}
          animated
          level={6}
          className="muscle-v2-trace-section muscle-v2-trace-stabilizer"
        >
          <p className="record-hint">
            Registros em que o grupo estabilizou postura ou articulação. Ficam
            visíveis para transparência, mas estabilização não equivale a
            estímulo contabilizado: não gera séries equivalentes nem carga de
            recuperação.
          </p>
          <TraceList
            key={`${mode}-stabilizer`}
            items={stabilizing}
            mode={mode}
            label="Participação estabilizadora"
          />
        </Disclosure>
      )}
    </div>
  );
}
