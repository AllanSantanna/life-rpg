import { currentSessionStart } from './sessionTiming';
import {
  Icon as WorkoutIcon,
  type IconName as WorkoutIconName,
} from '../../../shared/components/Icon';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ActionButton } from '../../../shared/components/ActionButton';
import { StatusDialog } from '../../../shared/components/StatusDialog';
import { plural } from '../../../shared/lib/plural';
import type { SaveOutcome } from '../../records/types';
import { displayDate } from '../../records/dates';
import type { ImportReceipt } from './importing/receipt';
import { TextWorkoutImport } from './importing/TextWorkoutImport';
import { PlansPanel } from './PlansPanel';
import { SessionPanel } from './SessionPanel';
import { HistoryPanel } from './HistoryPanel';
import { StatisticsPanels } from './StatisticsPanels';
import type { AdvancedCommandHandler, AdvancedWorkoutState } from './types';
const tabs = [
  { id: 'plans', label: 'Minhas fichas', short: 'Fichas', icon: 'dumbbell' },
  {
    id: 'session',
    label: 'Registrar treino',
    short: 'Registrar',
    icon: 'play',
  },
  { id: 'history', label: 'Histórico', short: 'Histórico', icon: 'history' },
  {
    id: 'progress',
    label: 'Evolução de cargas',
    short: 'Evolução',
    icon: 'chart',
  },
  {
    id: 'records',
    label: 'Recordes pessoais',
    short: 'Recordes',
    icon: 'trophy',
  },
  {
    id: 'volume',
    label: 'Volume de treinamento',
    short: 'Volume',
    icon: 'layers',
  },
  {
    id: 'muscles',
    label: 'Mapa muscular',
    short: 'Mapa muscular',
    icon: 'body',
  },
] as const;
type Tab = (typeof tabs)[number]['id'];
export function AdvancedWorkouts({
  state,
  today,
  onCommand,
  whenSaved,
}: {
  state: AdvancedWorkoutState;
  today: string;
  onCommand: AdvancedCommandHandler;
  whenSaved?: () => Promise<SaveOutcome>;
}) {
  const activeSession = state.sessions.findLast(
    (s) => s.status === 'in_progress',
  );
  const [tab, setTab] = useState<Tab>(activeSession ? 'session' : 'plans');
  const [sessionId, setSessionId] = useState<string | null>(
    activeSession?.id ?? null,
  );
  const id = useId();
  const [importing, setImporting] = useState(false);
  const importButton = useRef<HTMLButtonElement>(null);
  // Fica no componente pai para sobreviver ao fechamento da importação.
  const [imported, setImported] = useState<ImportReceipt | null>(null);
  function open(id: string) {
    setSessionId(id);
    setTab('session');
  }
  function start(planId: string) {
    const existing = state.sessions.findLast(
      (s) => s.status === 'in_progress' && s.planId === planId,
    );
    if (existing) {
      open(existing.id);
      return;
    }
    const id = crypto.randomUUID();
    const startedAt = currentSessionStart(today);
    if (
      !onCommand({
        type: 'startSession',
        id,
        planId,
        date: today,
        ...(startedAt !== undefined ? { startedAt } : {}),
      })
    )
      open(id);
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index + tabs.length - 1) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      setTab(tabs[next]!.id);
      document.getElementById(`${id}-tab-${tabs[next]!.id}`)?.focus();
    }
  }
  return (
    <section
      className="panel record-section strength-workspace"
      aria-label="Ferramentas avançadas de musculação"
    >
      {importing ? (
        <TextWorkoutImport
          state={state}
          today={today}
          selectedId={sessionId}
          onCommand={onCommand}
          {...(whenSaved ? { whenSaved } : {})}
          onCancel={() => {
            setImporting(false);
            requestAnimationFrame(() => importButton.current?.focus());
          }}
          onSaved={(receipt) => {
            setImporting(false);
            open(receipt.sessionId);
            setImported(receipt);
          }}
        />
      ) : (
        <>
          <div className="strength-heading strength-toolbar">
            <ActionButton
              ref={importButton}
              icon="plus"
              onClick={() => setImporting(true)}
            >
              Importar treino
            </ActionButton>
          </div>
          <div role="tablist" aria-label="Musculação" className="strength-tabs">
            {tabs.map((t, index) => (
              <button
                type="button"
                role="tab"
                key={t.id}
                id={`${id}-tab-${t.id}`}
                aria-label={t.label}
                aria-controls={`${id}-panel`}
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => moveTab(e, index)}
              >
                <WorkoutIcon name={t.icon as WorkoutIconName} />
                <span>{t.short}</span>
              </button>
            ))}
          </div>
          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab}`}
            tabIndex={0}
            className="strength-tabpanel"
          >
            {tab === 'plans' && (
              <PlansPanel
                today={today}
                state={state}
                onCommand={onCommand}
                onStart={start}
              />
            )}
            {tab === 'session' && (
              <SessionPanel
                state={state}
                today={today}
                selectedId={sessionId}
                onSelect={setSessionId}
                onCommand={onCommand}
              />
            )}
            {tab === 'history' && (
              <HistoryPanel state={state} onCommand={onCommand} onOpen={open} />
            )}
            {['progress', 'records', 'volume', 'muscles'].includes(tab) && (
              <StatisticsPanels
                key={tab}
                state={state}
                today={today}
                view={tab as 'progress' | 'records' | 'volume' | 'muscles'}
              />
            )}
          </div>
        </>
      )}
      {imported && (
        <StatusDialog
          tone="success"
          title="Treino importado!"
          message="O treino foi adicionado com sucesso à sua biblioteca."
          summary={[
            { label: 'Treino', value: imported.name },
            { label: 'Data', value: displayDate(imported.date) },
            {
              label: 'Exercícios importados',
              value: plural(imported.exercises, 'exercício', 'exercícios'),
            },
            {
              label: 'Séries importadas',
              value: plural(imported.sets, 'série', 'séries'),
            },
            ...(imported.pendingSets > 0
              ? [
                  {
                    label: 'Séries planejadas pendentes',
                    value: plural(imported.pendingSets, 'série', 'séries'),
                  },
                ]
              : []),
          ]}
          primary={{ label: 'OK', onClick: () => setImported(null) }}
          onClose={() => setImported(null)}
          returnFocus={() => importButton.current}
        >
          <p className="status-dialog__notice">
            {imported.status === 'completed'
              ? 'A sessão concluída foi atualizada e seus indicadores serão recalculados.'
              : 'A sessão está em andamento: confira e conclua em Registrar treino.'}
          </p>
        </StatusDialog>
      )}
    </section>
  );
}
