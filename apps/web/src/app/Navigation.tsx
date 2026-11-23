import { BrandLogo } from '../shared/components/BrandLogo';
import { Icon, type IconName } from '../shared/components/Icon';
import { pillarViews, type View } from './views';
export type { View } from './views';
const links: { id: View; label: string; icon: IconName; number: string }[] = [
  { id: 'home', label: 'Início', icon: 'home', number: '01' },
  { id: 'goals', label: 'Quests', icon: 'clipboard', number: '02' },
  { id: 'stats', label: 'Estatísticas', icon: 'chart', number: '03' },
  { id: 'pillars', label: 'Pilares', icon: 'grid', number: '04' },
  { id: 'profile', label: 'Perfil', icon: 'user', number: '05' },
];
/** Pilares agrupa as páginas dos pilares; Perfil agrupa a galeria de classes. */
function isActive(link: View, current: View) {
  return (
    current === link ||
    (link === 'pillars' && pillarViews.includes(current)) ||
    (link === 'profile' && current === 'classes')
  );
}
export function Navigation({
  current,
  onNavigate,
}: {
  current: View;
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="hidden lg:block">
        <a
          href="#main"
          className="mb-12 flex items-center gap-3 px-3"
          aria-label="Life RPG — ir ao conteúdo"
        >
          <BrandLogo />
        </a>
        <p className="eyebrow mb-4 px-3 text-muted">Área do jogador</p>
      </div>
      <nav
        aria-label="Navegação principal"
        className="flex w-full justify-around gap-1 lg:flex-col lg:gap-2"
      >
        {links.map((link) => (
          <button
            type="button"
            key={link.id}
            className={`nav-item ${isActive(link.id, current) ? 'active' : ''}`}
            onClick={() => onNavigate(link.id)}
            aria-current={isActive(link.id, current) ? 'page' : undefined}
          >
            <Icon name={link.icon} size={20} />
            <span>{link.label}</span>
            <span
              aria-hidden="true"
              className="ml-auto hidden font-mono text-[10px] opacity-40 lg:block"
            >
              {link.number}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
