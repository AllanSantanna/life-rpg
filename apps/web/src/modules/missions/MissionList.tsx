import { Icon } from '../../shared/components/Icon';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { SectionHeading } from '../../shared/components/SectionHeading';
import type { Mission, MissionFilter } from './types';
export function MissionList({
  missions,
  onToggle,
  expanded = false,
  onViewAll,
  filter = 'all',
  onFilterChange,
}: {
  missions: Mission[];
  onToggle: (id: string) => void;
  expanded?: boolean;
  onViewAll?: () => void;
  filter?: MissionFilter;
  onFilterChange?: (filter: MissionFilter) => void;
}) {
  const completed = missions.filter((mission) => mission.completed).length;
  const visible = missions.filter(
    (mission) =>
      filter === 'all' ||
      (filter === 'done' ? mission.completed : !mission.completed),
  );
  return (
    <section
      aria-label="Missões diárias"
      className="panel missions-panel overflow-hidden"
    >
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <SectionHeading title="Missões da jornada" eyebrow="Seu próximo passo">
          {!expanded && (
            <button className="text-action" onClick={onViewAll}>
              Ver todas <Icon name="arrow" size={14} />
            </button>
          )}
        </SectionHeading>
        <p className="mb-3 text-xs text-muted">
          Confirme somente ações que você realizou hoje. Registros e missões da
          mesma área compartilham o limite diário de XP.
        </p>
        <div className="mb-5 flex items-center gap-3">
          <ProgressBar
            label="Missões concluídas"
            value={completed}
            max={missions.length}
            className="flex-1"
          />
          <span className="whitespace-nowrap font-mono text-[11px] text-muted">
            {completed}/{missions.length} concluídas
          </span>
        </div>
        {expanded && (
          <div
            className="mb-5 flex flex-wrap gap-2"
            aria-label="Filtrar missões"
          >
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'pending', label: 'Pendentes' },
                { id: 'done', label: 'Concluídas' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={filter === item.id}
                onClick={() => onFilterChange?.(item.id)}
                className={`filter-button ${filter === item.id ? 'active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="mission-list">
        {visible.map((mission) => (
          <li key={mission.id}>
            <label
              className={`mission-row group flex cursor-pointer items-center gap-3 px-5 py-4 sm:gap-4 sm:px-6 ${mission.completed ? 'is-complete' : ''}`}
            >
              <input
                type="checkbox"
                className="mission-checkbox size-5 shrink-0 cursor-pointer accent-primary"
                checked={mission.completed}
                onChange={() => onToggle(mission.id)}
                aria-label={`Concluir missão: ${mission.title}`}
              />
              <span className="mission-icon text-muted">
                <Icon name={mission.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${mission.completed ? 'text-foreground' : ''}`}
                >
                  {mission.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {mission.description}
                </span>
              </span>
              <span
                className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 font-mono text-[11px] ${mission.completed ? 'bg-white/[0.04] text-muted' : 'bg-primary/10 text-red-300'}`}
              >
                <Icon name={mission.completed ? 'check' : 'bolt'} size={12} />+
                {mission.xp} XP
              </span>
            </label>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-muted">
          Nenhuma missão neste filtro. Que tal dar o próximo passo?
        </p>
      )}
      <div className="border-t border-white/[0.05] bg-background/20 px-5 py-3.5 text-xs text-muted sm:px-6">
        {completed === missions.length
          ? 'Todas as missões concluídas. Você fez o dia valer!'
          : 'A constância transforma o comum em extraordinário.'}
      </div>
    </section>
  );
}
