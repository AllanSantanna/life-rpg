import { useProgressFeedback } from '../../shared/hooks/useProgressFeedback';
import { Icon } from '../../shared/components/Icon';
import { SectionHeading } from '../../shared/components/SectionHeading';
import type { Achievement } from './types';
export function AchievementsPanel({
  achievements,
}: {
  achievements: Achievement[];
}) {
  return (
    <section
      aria-label="Conquistas"
      className="panel achievements-panel p-5 sm:p-6"
    >
      <SectionHeading title="Conquistas" eyebrow="Suas conquistas">
        <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] text-muted">
          {achievements.filter((item) => item.unlocked).length}/
          {achievements.length}
        </span>
      </SectionHeading>
      <div className="achievement-grid grid grid-cols-2 gap-3">
        {achievements.map((item) => (
          <AchievementMedal key={item.id} item={item} />
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted">
        Coleção ilustrativa · sem desbloqueios nesta versão.
      </p>
    </section>
  );
}

function AchievementMedal({ item }: { item: Achievement }) {
  const feedback = useProgressFeedback(Number(item.unlocked));
  return (
    <article
      className={`achievement ${feedback.delta > 0 ? 'achievement-earned' : ''} rounded-xl border p-4 text-center ${item.unlocked ? 'is-unlocked border-primary/20' : 'is-locked border-white/[0.05]'}`}
    >
      {feedback.delta > 0 && (
        <span className="achievement-new">Nova conquista!</span>
      )}
      <div
        className={`medal mx-auto mb-3 grid size-12 place-items-center ${item.unlocked ? 'text-red-400' : 'text-muted'}`}
      >
        <Icon name={item.icon} size={23} />
      </div>
      <p
        className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${item.unlocked ? 'text-red-400' : 'text-muted'}`}
      >
        {item.tier}
      </p>
      <h3 className="text-xs font-semibold">{item.title}</h3>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        {item.description}
      </p>
      <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted">
        <Icon name={item.unlocked ? 'check' : 'lock'} size={11} />
        {item.progress}
      </p>
    </article>
  );
}
