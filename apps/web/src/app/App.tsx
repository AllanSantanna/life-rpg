import { ProfilePage } from '../modules/profile/ProfilePage';
import { realAttributes } from '../modules/gamification/realProgress';
import { GoalsPage } from '../modules/goals/GoalsPage';
import { GoalsSummary } from '../modules/goals/GoalsSummary';
import { dashboardGoals } from '../modules/goals/dashboardGoals';
import { applyGoalCommand } from '../modules/goals/commands';
import type { GoalCommand } from '../modules/goals/types';
import { useUsdQuote } from '../modules/finances/useUsdQuote';
import { useBitcoinQuote } from '../modules/finances/useBitcoinQuote';
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
import { usePlayerState } from './usePlayerState';
import { EvolutionPanel } from '../modules/evolution/EvolutionPanel';
import { StatisticsPage } from '../modules/statistics/StatisticsPage';
import { useEffect, useRef } from 'react';
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
export function App() {
  const today = useToday();
  const { view, navigate, goalId } = useUrlNavigation();
  const { state, setState, storageAvailable, facts } = usePlayerState(today);
  const recordsRef = useRef(state.records);
  recordsRef.current = state.records;
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
      const records = applyRecordCommand(recordsRef.current, command, today);
      recordsRef.current = records;
      setState((previous) => ({ ...previous, records }));
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Não foi possível salvar o registro.';
    }
  }
  const goalsRef = useRef(state.goals);
  goalsRef.current = state.goals;
  function changeGoals(command: GoalCommand): string | null {
    try {
      const goals = applyGoalCommand(goalsRef.current, command, today);
      goalsRef.current = goals;
      setState((previous) => ({ ...previous, goals }));
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
  const activeGoals = dashboardGoals(state.goals, state.records, today);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [view, goalId]);
  return (
    <div className={`app-shell view-${view}`}>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <Navigation current={view} onNavigate={navigate} />
      <div className="min-w-0 lg:ml-60">
        <header className="topbar flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold tracking-wide text-foreground lg:hidden">
              <Icon name="mountain" size={28} className="inline text-red-500" />{' '}
              Life RPG
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
          <div className="page-intro mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2 text-muted">
                {view === 'home'
                  ? `BEM-VINDO DE VOLTA, ${player.name.toUpperCase()}`
                  : 'SUA JORNADA CONTINUA'}
              </p>
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
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {view === 'home'
                  ? 'Pequenos passos hoje. Uma nova versão de você amanhã.'
                  : view === 'stats'
                    ? 'A evolução acontece quando você continua.'
                    : 'O protagonista dessa história é você.'}
              </p>
            </div>
            <span className="flex items-center gap-2 text-xs text-muted">
              <Icon name="flame" size={16} className="text-red-400" />
              <strong className="font-medium text-foreground">
                Um dia de cada vez
              </strong>
            </span>
          </div>
          <div className="view-content" key={view}>
            {view === 'home' && (
              <PlayerHeader
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
                  <SectionHeading
                    title="Uma vida em equilíbrio"
                    eyebrow="Seus quatro pilares"
                  >
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
              />
            )}
            {view === 'workouts' && <WorkoutsPage {...recordProps} />}
            {view === 'rest' && <RestPage {...recordProps} />}
            {view === 'knowledge' && <KnowledgePage {...recordProps} />}
            {view === 'profile' && (
              <ProfilePage
                state={state}
                facts={facts}
                onChange={setState}
                onOpenEvolution={() => navigate('stats')}
              />
            )}
          </div>
          <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-[11px] text-muted">
            <span className="flex items-center gap-2">
              <Icon name="sparkle" size={14} />A sua melhor versão é construída
              todos os dias.
            </span>
            <span>
              {storageAvailable
                ? 'Registros salvos neste navegador · evolução real'
                : 'Salvamento local indisponível · alterações apenas nesta sessão'}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
