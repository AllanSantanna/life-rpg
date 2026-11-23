import type { View } from '../../app/Navigation';
const pillarLinks = [
  {
    view: 'finances',
    title: 'Finanças',
  },
  {
    view: 'workouts',
    title: 'Treinos',
  },
  {
    view: 'rest',
    title: 'Descanso',
  },
  {
    view: 'knowledge',
    title: 'Conhecimento',
  },
] as const;
export function PillarLinks({
  current,
  navigate,
}: {
  current: View;
  navigate: (view: View) => void;
}) {
  return (
    <nav
      aria-label="Quatro pilares"
      className={`pillar-links ${current === 'pillars' ? 'pillar-hub' : ''}`}
    >
      {pillarLinks.map((pillar) => (
        <button
          type="button"
          key={pillar.view}
          data-area={pillar.title}
          className={current === pillar.view ? 'selected' : ''}
          aria-current={current === pillar.view ? 'page' : undefined}
          onClick={() => navigate(pillar.view)}
        >
          <strong>{pillar.title}</strong>
        </button>
      ))}
    </nav>
  );
}
