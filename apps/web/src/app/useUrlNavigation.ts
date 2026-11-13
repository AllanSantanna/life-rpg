import { useSyncExternalStore } from 'react';
import type { View } from './Navigation';

export const viewPaths: Record<View, string> = {
  home: '/',
  missions: '/missoes',
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
function navigate(view: View) {
  const path = viewPaths[view];
  if (normalizePath(window.location.pathname) === path) return;
  window.history.pushState(null, '', path);
  // pushState não dispara popstate. Notificamos apenas a navegação do app.
  window.dispatchEvent(new Event(navigationEvent));
}

/** A URL é a única fonte da página atual; não usa o armazenamento do jogador. */
export function useUrlNavigation() {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
  );
  return { view: viewFromPath(pathname), navigate };
}
