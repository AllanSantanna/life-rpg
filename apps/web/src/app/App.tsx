import {
  startingProgress,
  realAttributes,
  realAchievements,
} from '../modules/gamification/realProgress';
import {
  missionsForDay,
  realMissionHistory,
} from '../modules/missions/catalog';
import { useUsdQuote } from '../modules/finances/useUsdQuote';
import { useBitcoinQuote } from '../modules/finances/useBitcoinQuote';
import { applyRecordCommand } from '../modules/records/commands';
import type { RecordCommand } from '../modules/records/types';
import {
  projectEffortActivities,
  recordReward,
  weeklyRecordXP,
} from '../modules/records/progression';
import { recordMetrics } from '../modules/records/metrics';
import { useToday } from '../modules/records/useToday';
import { displayDate } from '../modules/records/dates';
import { PillarLinks } from '../modules/records/PillarLinks';
import { FinancesPage } from '../modules/finances/FinancesPage';
import { WorkoutsPage } from '../modules/workouts/WorkoutsPage';
import { RestPage } from '../modules/rest/RestPage';
import { KnowledgePage } from '../modules/knowledge/KnowledgePage';
import { usePlayerState } from './usePlayerState';
import { scorePeriod } from '../modules/evolution/scoring';
import { EvolutionPanel } from '../modules/evolution/EvolutionPanel';
import { useEffect, useRef, useState } from 'react';
import { useUrlNavigation } from './useUrlNavigation';
import { Navigation, type View } from './Navigation';
import { pillarViews } from './views';
import { PlayerHeader } from '../modules/profile/PlayerHeader';
import { AttributesPanel } from '../modules/gamification/AttributesPanel';
import { AchievementsPanel } from '../modules/gamification/AchievementsPanel';
import { projectProgress } from '../modules/gamification/progression';
import { MissionList } from '../modules/missions/MissionList';
import { MetricCard } from '../shared/components/MetricCard';
import { SectionHeading } from '../shared/components/SectionHeading';
import { Icon } from '../shared/components/Icon';

const titles: Record<View, string> = {
  home: 'Visão geral',
  missions: 'Suas missões',
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
  const { view, navigate } = useUrlNavigation();
  const { state, setState, storageAvailable } = usePlayerState();
  const recordsRef = useRef(state.records);
  recordsRef.current = state.records;
  const player = state.profile;
  const missions = missionsForDay(state.missionEvents, today);
  const realMissions = realMissionHistory(state.missionEvents);
  const [announcement, setAnnouncement] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const currentReward = recordReward(
    {
      ...state.records,
      movements: [],
      investmentEntries: [],
      workouts: [],
      sleep: [],
      readings: [],
    },
    missions,
    today,
  );
  const progress = projectProgress(
    startingProgress,
    recordReward(state.records, realMissions, today),
  );
  const activities = projectEffortActivities(
    [],
    realMissions,
    state.records,
    today,
  );
  const dedication = scorePeriod(activities, 7);
  const attributes = realAttributes(dedication);
  const achievements = realAchievements(
    state.records,
    realMissions,
    today,
    activities,
  );
  const weeklyActivity = weeklyRecordXP(state.records, realMissions, today);
  const maxWeeklyXP = Math.max(100, ...weeklyActivity.map((day) => day.xp));
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
  const recordProps = {
    records: state.records,
    today,
    onCommand: changeRecords,
  };
  const bitcoin = useBitcoinQuote(recordProps);
  const usd = useUsdQuote(recordProps);
  const completed = missions.filter((mission) => mission.completed).length;
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [view]);
  function toggleMission(id: string) {
    const mission = missions.find((item) => item.id === id);
    if (!mission) return;
    const event = {
      missionId: id,
      date: today,
      source: 'user' as const,
      completed: !mission.completed,
    };
    const events = [
      ...state.missionEvents.filter(
        (item) => item.missionId !== id || item.date !== today,
      ),
      event,
    ];
    setState((previous) => ({ ...previous, missionEvents: events }));
    const delta =
      recordReward(state.records, realMissionHistory(events), today) -
      recordReward(state.records, realMissions, today);
    setAnnouncement(
      delta === 0
        ? `${mission.title}: atividade já contabilizada nos registros do dia.`
        : delta > 0
          ? `${mission.title}: missão concluída! Você ganhou ${delta} XP.`
          : `${mission.title}: conclusão desfeita, ${-delta} XP removidos.`,
    );
  }
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
                  : view === 'missions'
                    ? 'Cada missão é uma oportunidade de ir além.'
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
            {(view === 'home' || view === 'profile') && (
              <PlayerHeader
                player={player}
                progress={progress}
                dedication={dedication}
                onOpenEvolution={() => navigate('stats')}
              />
            )}
            {view === 'stats' && (
              <>
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
                <AttributesPanel attributes={attributes} />
              </>
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
                <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
                  <MissionList
                    missions={missions}
                    onToggle={toggleMission}
                    onViewAll={() => navigate('missions')}
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
            {view === 'missions' && (
              <div className="mx-auto max-w-4xl">
                <div className="mb-5 grid grid-cols-2 gap-4">
                  <div className="panel p-5">
                    <p className="eyebrow text-muted">Missões concluídas</p>
                    <p className="mt-3 text-3xl font-semibold">
                      {completed}
                      <span className="text-lg font-normal text-muted">
                        {' '}
                        / {missions.length} missões
                      </span>
                    </p>
                  </div>
                  <div className="panel p-5">
                    <p className="eyebrow text-muted">
                      Recompensas das missões
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-red-400">
                      {currentReward}
                      <span className="text-sm font-normal text-muted">
                        {' '}
                        XP
                      </span>
                    </p>
                  </div>
                </div>
                <MissionList
                  missions={missions}
                  onToggle={toggleMission}
                  expanded
                  filter={state.preferences.missionFilter}
                  onFilterChange={(missionFilter) =>
                    setState((previous) => ({
                      ...previous,
                      preferences: { ...previous.preferences, missionFilter },
                    }))
                  }
                />
              </div>
            )}
            {view === 'stats' && (
              <div className="grid items-start gap-5 xl:grid-cols-2">
                <section className="panel p-5 sm:p-6">
                  <SectionHeading
                    title="A constância deixa marcas"
                    eyebrow="Atividade semanal"
                  />
                  <p className="mb-7 text-xs text-muted">
                    XP por dia dos registros e missões datados. O saldo inicial
                    do personagem não entra no gráfico.
                  </p>
                  <div className="flex h-56 items-end gap-3 sm:gap-5">
                    {weeklyActivity.map((day) => (
                      <div
                        key={day.date}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="font-mono text-[10px] text-muted">
                          {day.xp}
                        </span>
                        <div
                          role="img"
                          aria-label={`${day.day}: ${day.xp} XP`}
                          className="weekly-bar w-full max-w-10 rounded-t-md"
                          style={{ height: `${(day.xp / maxWeeklyXP) * 70}%` }}
                        />
                        <span className="text-xs text-muted">{day.day}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 border-t border-white/[0.06] pt-4 text-xs text-muted">
                    Seu ritmo importa mais do que a velocidade.
                  </p>
                </section>
                <AchievementsPanel achievements={achievements} />
              </div>
            )}
            {view === 'profile' && (
              <div className="grid items-start gap-5 xl:grid-cols-2">
                <section className="panel p-6">
                  <SectionHeading
                    title="Sua ficha de jogador"
                    eyebrow="Seu perfil"
                  />
                  <dl className="divide-y divide-white/[0.06]">
                    {[
                      { label: 'Nome', value: player.name },
                      { label: 'Classe', value: player.title },
                      { label: 'Jornada', value: player.journey },
                      { label: 'Início da jornada', value: player.joined },
                      { label: 'Foco', value: player.focus },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-wrap justify-between gap-2 py-4 text-sm"
                      >
                        <dt className="text-muted">{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-5 rounded-lg border border-white/10 p-4 text-xs leading-relaxed text-muted">
                    Seu progresso é calculado somente a partir de atividades
                    reais. As informações do perfil são mantidas neste
                    navegador.
                  </p>
                </section>
                <AchievementsPanel achievements={achievements} />
              </div>
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
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </p>
      </div>
    </div>
  );
}
