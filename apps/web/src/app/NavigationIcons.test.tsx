import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Navigation } from './Navigation';

afterEach(cleanup);
it('mantém ordem, ícones distintos e seleção do pilar na navegação compartilhada', () => {
  const navigate = vi.fn();
  render(<Navigation current="finances" onNavigate={navigate} />);
  const buttons = within(
    screen.getByRole('navigation', { name: 'Navegação principal' }),
  ).getAllByRole('button');
  expect(
    buttons.map((button) => button.querySelector('span')?.textContent),
  ).toEqual(['Início', 'Quests', 'Estatísticas', 'Pilares', 'Perfil']);
  const paths = buttons.map((button) =>
    button.querySelector('path')?.getAttribute('d'),
  );
  expect(new Set(paths).size).toBe(5);
  for (const button of buttons) {
    expect(button.querySelector('svg')).toHaveAttribute('width', '20');
    expect(button.querySelector('svg')).toHaveAttribute('stroke-width', '1.65');
  }
  expect(buttons[3]).toHaveAttribute('aria-current', 'page');
  fireEvent.click(buttons[1]!);
  expect(navigate).toHaveBeenCalledWith('goals');
});
