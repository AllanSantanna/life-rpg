import { useEffect, useSyncExternalStore } from 'react';
import type { View } from './Navigation';

export const viewPaths: Record<View, string> = {
  home: '/',
  goals: '/quests',
  stats: '/estatisticas',
  profile: '/perfil',
  classes: '/perfil/classes',
  pillars: '/pilares',
  finances: '/financas',
  workouts: '/treinos',
  rest: '/descanso',
  knowledge: '/conhecimento',
};
const navigationEvent = 'life-rpg:navigate';
/**
 * Prefixo de publicação do Vite (`/` localmente, `/life-rpg/` no GitHub
 * Pages). As rotas do app são sempre relativas a ele; nunca presumem a raiz.
 */
const basePrefix = import.meta.env.BASE_URL.replace(/\/+$/, '');
/** Caminho do app (`/perfil`) a partir do caminho da URL publicada. */
export function appPath(pathname: string, base = basePrefix) {
  const inside =
    base && (pathname === base || pathname.startsWith(`${base}/`))
      ? pathname.slice(base.length)
      : pathname;
  return inside.replace(/\/+$/, '') || '/';
}
/** Caminho da URL publicada a partir do caminho do app. */
export function publicPath(path: string, base = basePrefix) {
  return base + (path === '/' ? '/' : path);
}
const normalizePath = (pathname: string) => appPath(pathname);
/** Detalhe de uma classe: `/perfil/classes/<classe>`. */
export function classFromPath(pathname: string) {
  const path = normalizePath(pathname);
  const prefix = `${viewPaths.classes}/`;
  if (!path.startsWith(prefix)) return null;
  const slug = path.slice(prefix.length);
  return slug && !slug.includes('/') ? decodeURIComponent(slug) : null;
}
export function viewFromPath(pathname: string): View {
  const path = normalizePath(pathname);
  if (path === '/missoes' || path === '/metas') return 'goals';
  if (classFromPath(pathname) !== null) return 'classes';
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
/** `detail` identifica a quest (`?quest=`) ou a classe (`/perfil/classes/<classe>`). */
function navigate(view: View, detail?: string) {
  const suffix = !detail
    ? ''
    : view === 'goals'
      ? `?quest=${encodeURIComponent(detail)}`
      : view === 'classes'
        ? `/${encodeURIComponent(detail)}`
        : '';
  const path = viewPaths[view] + suffix;
  if (normalizePath(window.location.pathname) + window.location.search === path)
    return;
  window.history.pushState(
    null,
    '',
    publicPath(viewPaths[view]) + path.slice(viewPaths[view].length),
  );
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
      publicPath(viewPaths.goals) +
        (query ? `?${query}` : '') +
        window.location.hash,
    );
    window.dispatchEvent(new Event(navigationEvent));
  }, [url.pathname, url.search]);
  return {
    view: viewFromPath(url.pathname),
    classSlug: classFromPath(url.pathname),
    goalId: url.searchParams.get('quest') ?? url.searchParams.get('meta'),
    navigate,
  };
}
