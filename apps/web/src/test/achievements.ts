import { fireEvent, screen, within } from '@testing-library/react';

/** Abre o Perfil pela navegação principal, onde fica a galeria de conquistas. */
export function openProfile() {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name: 'Perfil' }),
  );
}

/** Card da galeria do Perfil pelo nome da conquista. */
export function achievementCard(name: string) {
  const card = screen
    .getByRole('heading', { name, level: 4 })
    .closest('article');
  if (!card) throw new Error(`Card da conquista "${name}" não encontrado`);
  return card;
}

/** Estado calculado exibido no card: `locked` ou `unlocked`. */
export function achievementState(name: string) {
  return achievementCard(name).getAttribute('data-state');
}
