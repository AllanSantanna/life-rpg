import { Icon, type IconName } from '../shared/components/Icon';
import { pillarViews, type View } from './views';
export type { View } from './views';
const links: { id: View; label: string; icon: IconName; number: string }[] = [
  { id: 'home', label: 'Início', icon: 'home', number: '01' },
  { id: 'goals', label: 'Quests', icon: 'target', number: '02' },
  { id: 'stats', label: 'Estatísticas', icon: 'chart', number: '03' },
  { id: 'pillars', label: 'Pilares', icon: 'target', number: '04' },
  { id: 'profile', label: 'Perfil', icon: 'user', number: '05' },
];
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
          <span className="brand-mark">
            <Icon name="mountain" size={32} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Life <span>RPG</span>
            <span className="mt-0.5 block font-mono text-[8px] font-normal tracking-[.3em] text-muted">
              SUA VIDA. SUA JORNADA.
            </span>
          </span>
        </a>
        <p className="eyebrow mb-4 px-3 text-muted">Área do jogador</p>
      </div>
      <nav
        aria-label="Navegação principal"
        className="flex w-full justify-around gap-1 lg:flex-col lg:gap-2"
      >
        {links.map((link) => (
          <button
            key={link.id}
            className={`nav-item ${current === link.id || (link.id === 'pillars' && pillarViews.includes(current)) ? 'active' : ''}`}
            onClick={() => onNavigate(link.id)}
            aria-current={
              current === link.id ||
              (link.id === 'pillars' && pillarViews.includes(current))
                ? 'page'
                : undefined
            }
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
      <div className="mt-auto hidden px-2 pt-16 lg:block">
        <div className="journey-note rounded-xl border border-primary/20 p-4">
          <Icon name="flame" size={24} className="mb-3 text-red-400" />
          <p className="text-sm font-medium">Continue a jornada.</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Você não precisa ser perfeito. Só precisa continuar.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-red-300">
            <span className="size-1.5 rounded-full bg-primary" />
            UM DIA DE CADA VEZ
          </div>
        </div>
        <p className="mt-6 text-[10px] text-muted">
          LIFE RPG <span className="mx-1 text-white/20">/</span> SPRINT 01
        </p>
      </div>
    </aside>
  );
}
