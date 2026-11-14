import { useEffect, useSyncExternalStore } from 'react';
import type { View } from './Navigation';

export const viewPaths: Record<View, string> = {
  home: '/',
  goals: '/quests',
  stats: '/estatisticas',
  profile: '/perfil',
  pillars: '/pilares',
  finances: '/financas',
  workouts: '/treinos',
  rest: '/descanso',
  knowledge: '/conhecimento',
};
const navigationEvent = 'life-rpg:navigate';

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}
export function viewFromPath(pathname: string): View {
  const path = normalizePath(pathname);
  if (path === '/missoes' || path === '/metas') return 'goals';
  return (
    (Object.keys(viewPaths) as View[]).find(
      (view) => viewPaths[view] === path,
    ) ?? 'home'
  );
}
function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(navigationEvent, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(navigationEvent, onChange);
  };
}
function navigate(view: View, goalId?: string) {
  const path =
    viewPaths[view] +
    (view === 'goals' && goalId ? `?quest=${encodeURIComponent(goalId)}` : '');
  if (normalizePath(window.location.pathname) + window.location.search === path)
    return;
  window.history.pushState(null, '', path);
  // pushState não dispara popstate. Notificamos apenas a navegação do app.
  window.dispatchEvent(new Event(navigationEvent));
}

/** A URL é a única fonte da página atual; não usa o armazenamento do jogador. */
export function useUrlNavigation() {
  const location = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
  );
  const url = new URL(location, window.location.origin);
  useEffect(() => {
    if (!['/missoes', '/metas'].includes(normalizePath(url.pathname))) return;
    const params = new URLSearchParams(url.search);
    const legacyId = params.get('meta');
    if (legacyId && !params.has('quest')) params.set('quest', legacyId);
    params.delete('meta');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      viewPaths.goals + (query ? `?${query}` : '') + window.location.hash,
    );
    window.dispatchEvent(new Event(navigationEvent));
  }, [url.pathname, url.search]);
  return {
    view: viewFromPath(url.pathname),
    goalId: url.searchParams.get('quest') ?? url.searchParams.get('meta'),
    navigate,
  };
}
