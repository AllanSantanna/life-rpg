import type { View } from '../../app/Navigation';
const pillarLinks = [
  {
    view: 'finances',
    title: 'Finanças',
    description: 'Organize receitas, despesas e investimentos.',
  },
  {
    view: 'workouts',
    title: 'Treinos',
    description: 'Marque seus treinos e construa constância.',
  },
  {
    view: 'rest',
    title: 'Descanso',
    description: 'Acompanhe seu sono com uma meta pessoal.',
  },
  {
    view: 'knowledge',
    title: 'Conhecimento',
    description: 'Sua biblioteca e cada página da jornada.',
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
          key={pillar.view}
          data-area={pillar.title}
          className={current === pillar.view ? 'selected' : ''}
          aria-current={current === pillar.view ? 'page' : undefined}
          onClick={() => navigate(pillar.view)}
        >
          <strong>{pillar.title}</strong>
          {current === 'pillars' && <span>{pillar.description}</span>}
        </button>
      ))}
    </nav>
  );
}
