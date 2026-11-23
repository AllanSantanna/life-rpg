import { PlayerPortrait } from '../modules/profile/PlayerPortrait';
import { BrandLogo } from '../shared/components/BrandLogo';
import { ProfilePage } from '../modules/profile/ProfilePage';
import { realAttributes } from '../modules/gamification/realProgress';
import { GoalsPage } from '../modules/goals/GoalsPage';
import { GoalsSummary } from '../modules/goals/GoalsSummary';
import { dashboardGoals } from '../modules/goals/dashboardGoals';
import { applyGoalCommand } from '../modules/goals/commands';
import type { GoalCommand } from '../modules/goals/types';
import { useUsdQuote } from '../modules/finances/useUsdQuote';
import { useBitcoinQuote } from '../modules/finances/useBitcoinQuote';
import { useMarketQuotes } from '../modules/finances/useMarketQuotes';
import { applyRecordCommand } from '../modules/records/commands';
import type { RecordCommand } from '../modules/records/types';
import { recordMetrics } from '../modules/records/metrics';
import { useToday } from '../modules/records/useToday';
import { displayDate } from '../modules/records/dates';
import { PillarLinks } from '../modules/records/PillarLinks';
import { FinancesPage } from '../modules/finances/FinancesPage';
import { WorkoutsPage } from '../modules/workouts/WorkoutsPage';
import { RestPage } from '../modules/rest/RestPage';
import { KnowledgePage } from '../modules/knowledge/KnowledgePage';
import { usePlayerState, type Persistence } from './usePlayerState';
import { StorageBackups } from './StorageBackups';
import { DataBackup } from './DataBackup';
import { StorageNotice } from './StorageNotice';
import { LegacyStorageNotice } from './LegacyStorageNotice';
import { downloadRaw } from '../shared/storage/backups';
import { ActionButton } from '../shared/components/ActionButton';
import { EvolutionPanel } from '../modules/evolution/EvolutionPanel';
import { StatisticsPage } from '../modules/statistics/StatisticsPage';
import { useEffect, useRef, useState } from 'react';
import { useUrlNavigation } from './useUrlNavigation';
import { Navigation, type View } from './Navigation';
import { pillarViews } from './views';
import { PlayerHeader } from '../modules/profile/PlayerHeader';
import { AttributesPanel } from '../modules/gamification/AttributesPanel';
import { AchievementsPanel } from '../modules/gamification/AchievementsPanel';
import { MetricCard } from '../shared/components/MetricCard';
import { SectionHeading } from '../shared/components/SectionHeading';
import { Icon } from '../shared/components/Icon';

const titles: Record<View, string> = {
  home: 'Visão geral',
  goals: 'Quests',
  stats: 'Sua evolução',
  profile: 'Seu personagem',
  pillars: 'Quatro pilares da vida',
  finances: 'Finanças',
  workouts: 'Treinos',
  rest: 'Descanso',
  knowledge: 'Conhecimento',
};
const persistenceLabels: Record<Persistence['kind'], string> = {
  loading: 'Carregando registros protegidos…',
  saving: 'Gravação em andamento · aguarde a confirmação',
  saved: 'Registros salvos neste navegador · evolução real',
  session: 'Salvamento local indisponível · alterações apenas nesta sessão',
  protected:
    'Registros salvos protegidos · nada é gravado até você decidir o que fazer',
  conflict: 'Alteração não salva · registros modificados em outra aba',
};
export function App() {
  const today = useToday();
  const { view, navigate, goalId } = useUrlNavigation();
  const {
    state,
    setState,
    persistence,
    facts,
    reloadStored,
    startFreshKeepingCopy,
    restoreBackup,
    ready,
    legacyChange,
    acknowledgeLegacy,
    copies,
    draftRaw,
    readBackupSource,
    beginBackupImport,
    importBackup,
  } = usePlayerState(today);
  // Remonta formulários locais do Perfil e a lista de cópias após restaurar
  // um backup, para não exibirem valores do estado substituído.
  const [dataEpoch, setDataEpoch] = useState(0);
  const player = state.profile;
  const {
    rewards: goalReward,
    progress,
    activities,
    dedication,
    achievements,
  } = facts;
  const heading = useRef<HTMLHeadingElement>(null);
  const attributes = realAttributes(dedication);
  const currentMetrics = recordMetrics(state.records, today, dedication);
  function changeRecords(command: RecordCommand): string | null {
    try {
      // Aplicado sobre o estado mais recente (inclusive de outra aba); erros de
      // validação lançados pelo comando chegam ao formulário.
      setState((previous) => ({
        ...previous,
        records: applyRecordCommand(previous.records, command, today),
      }));
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Não foi possível salvar o registro.';
    }
  }
  function changeGoals(command: GoalCommand): string | null {
    try {
      setState((previous) => ({
        ...previous,
        goals: applyGoalCommand(previous.goals, command, today),
      }));
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Não foi possível atualizar a quest.';
    }
  }
  const recordProps = {
    records: state.records,
    today,
    onCommand: changeRecords,
  };
  const bitcoin = useBitcoinQuote(recordProps);
  const usd = useUsdQuote(recordProps);
  const market = useMarketQuotes(recordProps);
  const activeGoals = dashboardGoals(state.goals, state.records, today);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [view, goalId, ready]);
  if (!ready)
    return (
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-[1480px] px-5 py-9"
      >
        <section
          className="panel record-section"
          role={persistence.kind === 'loading' ? 'status' : 'alert'}
        >
          <h1>
            {persistence.kind === 'loading'
              ? 'Carregando seus registros'
              : 'Não foi possível acessar os registros protegidos'}
          </h1>
          <p className="record-hint">
            {persistence.kind === 'loading'
              ? 'Aguarde a validação do armazenamento deste navegador.'
              : 'Os dados existentes não foram substituídos. Nenhum jogador novo foi gravado. Tente novamente para continuar.'}
          </p>
          {persistence.kind !== 'loading' && (
            <ActionButton
              onClick={() => {
                void reloadStored();
              }}
            >
              Tentar novamente
            </ActionButton>
          )}
        </section>
      </main>
    );
  return (
    <div className={`app-shell view-${view}`}>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <Navigation current={view} onNavigate={navigate} />
      <div className="min-w-0 lg:ml-60">
        <header className="topbar flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="lg:hidden">
              <BrandLogo compact />
            </span>
            <span className="hidden sm:inline">Área do jogador</span>
            <Icon name="chevron" size={12} />
            <span className="text-foreground">
              {view === 'home'
                ? 'Início'
                : view === 'stats'
                  ? 'Estatísticas'
                  : view === 'profile'
                    ? 'Perfil'
                    : titles[view]}
            </span>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-muted">
            <span className="size-1.5 rounded-full bg-red-400" />
            <span className="sm:hidden">LOCAL</span>
            <span className="hidden sm:inline">SALVAMENTO LOCAL</span>
          </span>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-[1480px] px-5 pb-28 pt-7 sm:px-8 lg:px-10 lg:pb-8 lg:pt-9"
        >
          <StorageNotice
            persistence={persistence}
            today={today}
            onReload={reloadStored}
            onStartFresh={startFreshKeepingCopy}
            onDownloadDraft={() =>
              downloadRaw(draftRaw(), 'life-rpg-alteracao-nao-salva.json')
            }
          />
          {legacyChange && (
            <LegacyStorageNotice
              change={legacyChange}
              onAcknowledge={acknowledgeLegacy}
            />
          )}
          <div className="page-intro mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1
                ref={heading}
                tabIndex={-1}
                className="w-fit text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                {titles[view]}
                <span aria-hidden="true" className="text-primary">
                  .
                </span>
              </h1>
            </div>
          </div>
          <div className="view-content" key={view}>
            {view === 'home' && (
              <PlayerHeader
                portrait={
                  <PlayerPortrait
                    classId={state.character.classification.current}
                    level={progress.level}
                    name={player.name}
                  />
                }
                player={player}
                character={state.character}
                progress={progress}
                dedication={dedication}
                onOpenEvolution={() => navigate('stats')}
              />
            )}
            {view === 'stats' && (
              <StatisticsPage
                records={state.records}
                activities={activities}
                today={today}
                onNavigate={navigate}
                achievements={<AchievementsPanel achievements={achievements} />}
                radar={
                  <EvolutionPanel
                    activities={activities}
                    referenceDate={displayDate(today)}
                    period={state.preferences.radarPeriod}
                    onPeriodChange={(radarPeriod) =>
                      setState((previous) => ({
                        ...previous,
                        preferences: { ...previous.preferences, radarPeriod },
                      }))
                    }
                  />
                }
              />
            )}
            {view === 'home' && (
              <>
                <section
                  aria-label="Pilares da jornada"
                  className="pillars mb-6"
                >
                  <SectionHeading title="Seus quatro pilares">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="size-1 rounded-full bg-primary" />
                      Seus registros · dedicação recente
                    </span>
                  </SectionHeading>
                  <div className="metrics-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {currentMetrics.map((metric) => (
                      <MetricCard
                        key={metric.id}
                        metric={metric}
                        onOpen={() => navigate(metric.id as View)}
                      />
                    ))}
                  </div>
                </section>
                <div
                  className={`dashboard-secondary${activeGoals.length ? ' dashboard-secondary--with-goals' : ''}`}
                >
                  <GoalsSummary
                    items={activeGoals}
                    onOpen={() => navigate('goals')}
                    onOpenGoal={(id) => navigate('goals', id)}
                  />
                  <AchievementsPanel achievements={achievements} />
                </div>
                <div className="home-attributes">
                  <AttributesPanel attributes={attributes} />
                </div>
              </>
            )}
            {pillarViews.includes(view) && (
              <PillarLinks current={view} navigate={navigate} />
            )}
            {view === 'goals' && (
              <GoalsPage
                selectedGoalId={goalId}
                onShowAll={() => navigate('goals')}
                state={state.goals}
                records={state.records}
                today={today}
                onCommand={changeGoals}
                rewards={goalReward.entries}
              />
            )}
            {view === 'finances' && (
              <FinancesPage
                {...recordProps}
                quoteError={bitcoin.error}
                quoteStale={bitcoin.stale}
                usdError={usd.error}
                usdStale={usd.stale}
                market={market}
              />
            )}
            {view === 'workouts' && <WorkoutsPage {...recordProps} />}
            {view === 'rest' && <RestPage {...recordProps} />}
            {view === 'knowledge' && <KnowledgePage {...recordProps} />}
            {view === 'profile' && (
              <ProfilePage
                key={`profile-${dataEpoch}`}
                state={state}
                facts={facts}
                onChange={setState}
                onOpenEvolution={() => navigate('stats')}
              />
            )}
            {view === 'profile' && (
              <DataBackup
                readSource={readBackupSource}
                beginImport={beginBackupImport}
                onImport={importBackup}
                onImported={() => setDataEpoch((n) => n + 1)}
              />
            )}
            {view === 'profile' && (
              <StorageBackups
                key={`copies-${dataEpoch}`}
                onRestore={restoreBackup}
                {...(copies ? { copyStore: copies } : {})}
              />
            )}
          </div>
          <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-[11px] text-muted">
            <span>{persistenceLabels[persistence.kind]}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
